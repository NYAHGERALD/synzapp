# Synzapp Enterprise Company Data Device Governance Plan

## Purpose

Synzapp must treat company chat data, documents, photos, media, backups, and downloaded files as company-owned data. Employees should be able to use that data while they are active members of the company, but they should not retain permanent copies on their phone after they leave the company, are deactivated, or have a device revoked.

This plan is the source of truth for hardening Synzapp Chat and related company-data storage. It is intentionally enterprise-focused: no demo flows, no client-only trust, and no shortcuts that depend on users manually deleting data.

## Current State Found During Code Review

### Strong Existing Foundations

- `SYNZAPP/mobile/src/services/localChatStore.ts` encrypts cached chat contacts and conversations locally before saving them through AsyncStorage / SQLite. The encryption key is stored in SecureStore and scoped by signed-in user and tenant.
- `SYNZAPP/mobile/src/services/chatMediaApi.ts` encrypts chat media before upload and downloads encrypted media from backend-signed URLs.
- `SYNZAPP/backend/src/services/chatMediaService.ts` stores encrypted chat media under tenant-scoped Firebase Storage paths and only issues upload/download sessions after authorization checks.
- `SYNZAPP/backend/src/services/deviceIdentityService.ts` already verifies active organization membership, active user status, and active registered device status for protected profile/device paths.
- `SYNZAPP/backend/src/services/adminDeviceService.ts` and `SYNZAPP/backend/src/services/employeeLifecycleService.ts` already provide important building blocks for device revocation and employee lifecycle control.
- `SYNZAPP/mobile/src/screens/AdminChatScreen.tsx` already has a manual clear-media path for an individual chat.

### Enterprise Gaps

- Decrypted chat media is written to `FileSystem.documentDirectory/Synzapp/Media`, which can persist longer than an enterprise data-governance policy should allow.
- The app has manual media clearing, but no guaranteed tenant-wide purge on sign-out, employee deactivation, device revocation, or failed membership/device validation.
- `clearRegisteredDeviceIdentityCache` currently clears in-memory registration state, but does not erase the SecureStore device identity record.
- Chat attachments can be opened through native share/open-in paths in `SYNZAPP/mobile/src/services/chatAttachmentOpener.ts`, which may create unmanaged copies outside Synzapp.
- Encrypted chat backups can preserve company conversations unless restore is blocked by current membership, device state, and tenant policy.
- Thumbnail data and local media references can remain inside encrypted local chat records until a cleanup path runs.
- There is no complete admin proof loop showing that a device wipe was requested, received, completed, failed, or still pending.

## Enterprise Target Architecture

Company data should remain server-owned. Mobile devices may hold only a controlled, encrypted, expiring working cache that can be revoked and purged.

Core principles:

- Server authorization is required for every media download, backup restore, and protected data refresh.
- Device registration status and employee lifecycle status must be enforced by the backend, not just hidden in the UI.
- Local decrypted files should be temporary, encrypted at rest when cached, and purged automatically.
- Revocation must be multi-layered: block backend access immediately, push a wipe command to the device, wipe again on next app open, and keep audit proof.
- External open/share/export must be policy-controlled and audited.
- Offline access must expire. A device that cannot revalidate company access should not keep company data indefinitely.

### Sign-Out Is Not Offboarding

Normal user sign-out must not be treated as company removal, device revocation, or remote wipe.

Required behavior:

- Ordinary sign-out ends the active app session, clears visible local company working data for that signed-in user, stops sync, and returns the device to the login flow.
- Ordinary sign-out must not revoke the backend registered device record.
- Ordinary sign-out must not destroy the user-scoped secure device identity because that identity is required for stable encrypted chat continuity when the same employee signs back in.
- Device identities are stored per signed-in user, not as one global phone identity. This allows a shared physical device to support account switching without exposing one user’s local company data to another user or rotating another user’s encryption identity.
- Company offboarding, employee removal, device revocation, access-denied membership checks, and remote wipe commands are the only flows that clear the user-scoped secure device identity and purge company data as a compliance event.

This rule is deliberately strict. Future mobile changes must not reintroduce device revocation or secure identity deletion into the ordinary sign-out button.

## Implementation Plan

### 1. Define A Tenant Data Governance Policy

Add a backend policy model for each organization:

- Local media cache TTL.
- Offline grace period.
- Whether external share/open-in is allowed.
- Whether chat backup is allowed.
- Whether document download is allowed or view-only.
- Whether screenshots or screen recording should be discouraged through OS-level flags where supported.
- Which roles can export, share, or open company media outside Synzapp.

Recommended default:

- Chat media cached locally only as encrypted temporary cache.
- No permanent decrypted files in app document storage.
- External share disabled by default for employees.
- External share allowed only by policy for approved roles.
- Offline cache expires after a short, configured window.

### 2. Harden Backend Authorization And Revocation

Extend backend enforcement around these existing services:

- `SYNZAPP/backend/src/services/chatMediaService.ts`
- `SYNZAPP/backend/src/services/deviceIdentityService.ts`
- `SYNZAPP/backend/src/services/adminDeviceService.ts`
- `SYNZAPP/backend/src/services/employeeLifecycleService.ts`
- `SYNZAPP/backend/src/routes/adminRoutes.ts`

Required backend work:

- Add a tenant/user access version or data epoch that increments when an employee is deactivated, archived, removed, or a device is revoked.
- Reject chat media download sessions when user status, tenant membership, or device status is no longer active.
- Reject chat backup restore when the employee or device is inactive.
- Create server-side wipe commands for every registered device during employee deactivation/removal.
- Audit every media download URL, export/share request, device revocation, wipe command, and wipe completion.
- Make device revocation invalidate refresh/session paths immediately where possible.

Backend should be the source of truth. A stale mobile client should never be able to fetch new company media just because it still has old local state.

### 3. Replace Permanent Decrypted Media Cache With A Governed Cache

Refactor `SYNZAPP/mobile/src/services/chatMediaApi.ts`.

Current risk:

- Downloaded decrypted media is written to `FileSystem.documentDirectory/Synzapp/Media`.

Target behavior:

- Store company media under a tenant-scoped cache path, preferably `FileSystem.cacheDirectory/Synzapp/Tenants/{tenantId}/Media`.
- Keep an encrypted cache index with media id, tenant id, owner uid, chat id, classification, created time, last accessed time, and expiry time.
- Decrypt only for immediate viewing, and write decrypted viewer files to a short-lived temporary path.
- Delete decrypted viewer files as soon as the viewer closes, the app backgrounds, or TTL expires.
- Never save chat photos/documents to Camera Roll, public Downloads, or unmanaged OS storage unless an approved export/share policy allows it.
- Migrate or purge the legacy `documentDirectory/Synzapp/Media` folder.

Acceptance standard:

- A filesystem inspection after normal chat use should not find long-lived decrypted company attachments in document storage.

### 4. Add Tenant-Wide Local Data Purge

Create a single mobile purge service, for example:

- `purgeTenantCompanyData({ tenantId, ownerUid, reason })`

It should delete:

- Encrypted local chat contacts and conversations for the tenant.
- All tenant media cache files.
- Temporary decrypted viewer files.
- Profile/photo caches tied to the tenant.
- Pending upload/download temporary files.
- Local chat backup restore material for the tenant when policy requires it.
- Any queued messages that contain company media references.

Trigger it from:

- Sign out.
- Employee deactivation/removal response.
- Device revocation response.
- App resume membership validation failure.
- Push/silent wipe command.
- Repeated 401/403 responses from protected tenant APIs.

This must be idempotent and safe to run more than once.

### 5. Add Remote Wipe Command Handling

When an admin removes an employee or revokes a device:

- Backend creates a wipe command with tenant id, affected user id, affected device id, reason, and timestamp.
- Push notification or silent notification asks the device to wipe local company data.
- Mobile app confirms receipt and completion back to the backend.
- If push is missed, the app checks for pending wipe commands on next launch/resume.
- Backend dashboard shows pending, completed, failed, and last-seen status.

This does not replace backend access revocation. Backend access must be blocked immediately, and remote wipe is the cleanup proof layer.

### 6. Control Open, Share, And Export

Refactor `SYNZAPP/mobile/src/services/chatAttachmentOpener.ts`.

Recommended behavior:

- Default to an in-app viewer for documents, images, and media.
- If policy allows external share/open-in, create a temporary export copy in cache only.
- Delete the temporary export copy after the share flow returns and again through a scheduled cleanup pass.
- Audit who opened or exported which file, from which device, at what time.
- Show users a clear enterprise notice when a file is protected and cannot be shared outside Synzapp.

Important limitation:

No mobile app can fully prevent screenshots, another camera recording the screen, or copies made by an external app after export is allowed. Enterprise control is achieved by minimizing local data, disabling export by default, using MDM/MAM where available, watermarking sensitive previews, and auditing access.

### 7. Govern Chat Backups

Refactor backup restore paths around:

- `SYNZAPP/mobile/src/services/chatBackup.ts`
- `SYNZAPP/backend/src/services/chatBackupService.ts`
- `SYNZAPP/backend/src/services/chatBackupPolicyService.ts`

Required behavior:

- Backup restore requires active tenant membership and active registered device validation.
- Deactivated or removed employees cannot restore company chat backups.
- Tenant policy can disable backup for chat media and sensitive conversations.
- Backup recovery material should be wiped from the device during tenant purge when policy requires it.
- Backup restore events should be audited.

### 8. Add A Governed Mobile Library Workspace

The mobile navigation includes a `LIBRARY` destination. This section must be the controlled company document and media workspace, not a separate unmanaged storage area.

The Library workspace should show company-owned documents, photos, videos, and other approved file records that the signed-in employee is allowed to access.

Required top-level organization:

- Company public.
- Associated with me.

Required file categories:

- Documents: PDF, Word, Excel, PowerPoint, TXT, and other document types.
- Photos.
- Videos.
- Other approved file types.

Enterprise behavior:

- Library records are server-owned and tenant-scoped.
- Mobile stores only encrypted, expiring cache copies.
- Public company files are visible only to active employees in the same company.
- Associated files are visible only when the file is explicitly linked to the user, their role, department, group, case, RCA, RAIL, LSW, chat, or other governed work object.
- Department admins can view department-scoped files.
- Organization admins can view company-wide files.
- Removed employees, revoked devices, inactive users, and users outside the tenant cannot list, preview, download, restore, or open files.

Backend requirements:

- Add a company file metadata model with tenant id, owner, visibility scope, associated users, departments, groups, work-object links, classification, retention policy, file type, size, checksum, created by, updated by, and audit timestamps.
- Store file binaries in tenant-scoped object storage.
- Use short-lived signed URLs only after active membership, active device, role, scope, and policy checks pass.
- Audit every list, preview, download, external share, deletion, retention change, and permission change.
- Support legal hold and retention policies for company-controlled records.
- Do not expose raw storage paths to the client.

Mobile requirements:

- The `LIBRARY` navigation screen should be a professional file library with:
  - Scope tabs for `Company public` and `Associated with me`.
  - Category filters for documents, photos, videos, and other files.
  - Search by file name, type, uploader, tag, date, and associated work object.
  - Sort by recent, name, type, size, and owner.
  - File previews that do not require permanent download.
  - Clear empty states that explain access without exposing internal tenant language.
- Use in-app preview by default.
- If external open/share is allowed by company policy, create a temporary export copy, audit the event, and delete the temporary copy after use.
- Cached files must be stored in the same governed tenant cache used for chat media.
- Cached file thumbnails must also follow tenant purge, TTL, and revocation rules.
- A file opened from Chat and the same file opened from `LIBRARY` should reference one governed file record, not duplicate unmanaged local copies.

Security requirements:

- Company public does not mean public internet. It means visible to active users inside the company according to policy.
- Associated with me is not personal ownership. It means company data linked to that employee for work purposes.
- File access must be denied immediately after employee removal or device revocation.
- Offline access is allowed only inside the configured company offline grace period.
- Screenshots and external sharing cannot be fully prevented by app code alone; sensitive preview should support watermarking and MDM/MAM policy where available.

Acceptance criteria:

- An active employee can view allowed company files.
- A department admin can only see files inside their scope unless their role grants wider access.
- An organization admin can see company-wide files.
- A removed employee cannot list or download files.
- A revoked device cannot list, preview, download, restore, or open cached files after validation.
- Local cached file copies disappear during tenant purge.
- Legacy local files are purged or migrated into governed encrypted cache.
- External share/open events are policy-controlled and audited.

### 9. Add App Resume And Offline Validation

On app launch/resume:

- Validate current profile, tenant membership, and registered device status.
- Pull pending wipe commands.
- Compare local tenant data epoch with backend epoch.
- If backend state says revoked, inactive, archived, removed, or epoch mismatch, purge tenant company data.

Offline policy:

- Allow short offline use only inside the configured grace period.
- After grace expires, hide company data until backend access is revalidated.
- Do not allow opening decrypted media while offline beyond policy.

### 10. Add Admin Proof And Compliance Dashboard

Admins need proof, not just controls.

Add dashboard/audit data for:

- Devices with company data access.
- Last device heartbeat.
- Last chat media download.
- Wipe requested time.
- Wipe completed time.
- Wipe failed or pending state.
- Employee lifecycle action that triggered wipe.
- External share/export attempts and results.
- Backup restore attempts and results.

Department admins should see scoped department data only. Organization admins should see the whole company.

### 11. Migration Plan

On first app launch after this upgrade:

- Scan for legacy `documentDirectory/Synzapp/Media`.
- If tenant cannot be confidently validated, delete legacy media.
- If tenant is active and policy allows migration, move media into governed encrypted cache and remove plaintext originals.
- Remove stale local media references from cached chat messages if files are purged.
- Write a local migration completion marker per app version.

### 12. Testing And Acceptance Criteria

Enterprise acceptance tests:

- Active employee can view chat media, close viewer, and no permanent decrypted file remains.
- Employee signs out and tenant chat/media/profile cache is wiped.
- Admin revokes a device and backend immediately blocks media downloads for that device.
- Admin deactivates employee and all devices receive wipe commands.
- Device misses push, opens app later, receives pending wipe command, and purges data.
- Removed employee cannot restore encrypted chat backup.
- External share is blocked when policy disables it.
- External share is audited when policy allows it.
- Group chat durable media remains on the server but local copies are still governed by TTL and revocation.
- Legacy `documentDirectory/Synzapp/Media` is purged or migrated safely.
- Active employee can browse the mobile `LIBRARY` workspace without creating permanent local company-data copies.
- Public company files, associated-user files, and admin-scoped files respect role, department, tenant, and device policy.

## Recommended Implementation Order

1. Backend policy and audit model.
2. Backend membership/device/media/backup enforcement.
3. Mobile tenant-wide purge service.
4. Mobile media cache refactor away from permanent decrypted document storage.
5. Governed mobile `LIBRARY` metadata, listing, preview, and cache model.
6. App resume and revocation handling.
7. Remote wipe command handling.
8. Open/share/export policy controls.
9. Backup restore hardening.
10. Admin compliance dashboard.
11. Migration and regression tests.

## Implementation Progress

### 2026-08-25 Initial Governance Foundation

Implemented:

- Mobile chat media now writes new local chat media cache files under app cache storage instead of long-lived document storage.
- Mobile chat media cleanup can remove both the new cache media directory and the legacy document-storage media directory.
- Added a centralized mobile `purgeTenantCompanyData` service for company-data cleanup on sign-out, session invalidation, access denial, organization deletion, and future remote-wipe paths.
- Added explicit secure device identity deletion for stronger revocation/offboarding cleanup.
- Added explicit encrypted chat backup recovery-key deletion for stronger tenant cleanup when required.
- Mobile sign-out now purges local tenant company data before ending the Firebase session.
- Mobile organization deletion now uses the centralized purge path and clears backup/device identity material.
- Mobile access-denied/session-invalid flow now schedules tenant company-data purge and secure device identity cleanup.
- Backend device revocation now creates a company-data wipe command for the revoked device.
- Backend employee deactivation, archive, delete, permanent removal, and anonymization now create wipe commands for all devices revoked by that lifecycle action.
- Backend now exposes narrow authenticated wipe-command retrieval and completion acknowledgement endpoints for the exact signed-in user and local device id. These endpoints do not return company content and do not reactivate revoked access.
- Mobile now checks for pending wipe commands on app open and foreground resume, purges tenant company data, acknowledges completion, clears secure device identity material, and signs the user out of the revoked company session.
- Mobile now stores only a minimal last-known tenant/user cleanup scope in secure storage so company-data purge can still run if session restoration is denied before the main app opens. The scope marker is cleared on sign-out and organization deletion.
- Mobile now exposes `LIBRARY` from the main navigation instead of the old `FILES` placeholder.
- Mobile Library now lists backend-governed evidence-library records using authenticated requests, separates `Company public` and `Associated with me`, filters documents/photos/videos/other records, and renders photos plus document thumbnails using the same thumbnail assets used by Synzapp web.
- Mobile Library photo preview uses authenticated in-app viewing and does not create a permanent local download copy.

Still pending:

- Full governed mobile `LIBRARY` metadata model beyond evidence-library records, including explicit user/department/work-object associations.
- Company data policy model and admin policy UI.
- External open/share/export policy enforcement and audit expansion.
- Admin dashboard for wipe command status and compliance proof.
- Legacy media migration/purge marker and automated regression tests.

## Final Enterprise Position

Synzapp already has good security foundations, especially encrypted local chat records, encrypted server media, tenant-scoped backend paths, and registered device validation. The main enterprise issue is local data governance after access ends. The correct fix is not a single delete button. The correct fix is a full company-data lifecycle: policy, authorization, revocation, encrypted temporary cache, automatic purge, remote wipe, export control, and audit proof.
