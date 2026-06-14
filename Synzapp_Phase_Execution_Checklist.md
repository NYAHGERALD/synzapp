# Synzapp Phase Execution Checklist

**Source reviewed:** `Synzapp_Chief_Architect_Enterprise_Architecture.md`  
**Created:** 2026-06-06  
**Purpose:** Step-by-step implementation tracker for building Synzapp seriously, testing each phase with real UX and real data before moving to the next service.

## How To Use This File

- Check an item only after it is implemented, tested, and accepted.
- Do not skip tenant isolation, backend authorization, auditability, or database persistence.
- UI completion alone is not enough for a phase that requires backend or database behavior.
- The next immediate product direction is: login, profile creation stored in database, approved employee onboarding, then app features.

## Shared Platform Scope

Synzapp is not mobile-only. The backend and database must be designed as a shared platform for:

- React Native mobile app.
- Future Synzapp web app.
- Future Leader Standard Work module.
- Future Root Cause Analysis module.
- Future admin portal, analytics, search, audit, and AI services.

The mobile app and web app should share the same tenant model, user profiles, roles, permissions, audit logs, file storage rules, and backend authorization layer. Chat must be mobile-first and end-to-end encrypted by default, while the backend remains the shared control plane. Avoid mobile-only database structures that would block the future web app, but do not let the future web app force plaintext chat storage into the backend.

## Current Status Summary

- [x] Architecture file fully reviewed for implementation sequencing.
- [x] Mobile Expo project exists.
- [x] Firebase phone login flow has started.
- [x] Login screen UI has been refined.
- [x] SMS code verification screen UI has been refined.
- [x] Firebase Auth session persistence has been added for remembered devices.
- [x] The app restores an existing Firebase session on launch.
- [x] Phase 1 backend foundation now exists under `SYNZAPP/backend`.
- [x] Mobile login now calls the backend before SMS send and after Firebase verification.
- [x] Org Admin tenant and user profile persistence has been implemented in the backend.
- [x] Employee profiles are now persisted in the database after approved-phone validation.
- [ ] Org Admin tenant/profile persistence still needs live Firebase-device verification.
- [x] Backend session contract is defined for login, restore, role/status/tenant checks, custom claims, and profile-required routing.
- [x] Org Admin user and tenant records that feed the backend session contract are created in Phase 2.
- [x] Employee user records that feed the backend session contract are created in Phase 3.
- [ ] Shared mobile/web backend contract beyond authentication is not yet defined.
- [ ] Leader Standard Work and Root Cause Analysis database modules are not yet defined.
- [x] Mobile-first E2EE chat foundation is implemented for the active direct-message path.
- [ ] App chat-feature expansion must wait until profile, tenant, and encrypted messaging foundations are complete.

---

# Database Scale Guardrails

The architecture can scale if the database is designed around tenant-scoped, modular collections from the beginning.

## Enterprise Database Decision

Firestore is the primary operational database for Synzapp. It must support the mobile app, future web app, tenant profiles, user profiles, chat control-plane records, encrypted delivery queues, files metadata, work orders, action plans, Leader Standard Work metadata, Root Cause Analysis metadata, and audit-linked application records.

PostgreSQL and BigQuery are not planned because Firestore is too small for enterprise use. They are optional future additions for specialized workloads:

- PostgreSQL: relational reporting, complex operational reporting, or SQL-heavy dashboard workloads.
- BigQuery: analytics, enterprise reporting, historical trend analysis, and large-scale BI.

The main product must be designed so Firestore can carry the operational workload through tenant-scoped collections, pagination, indexes, summary documents, backend authorization, encrypted message envelopes, and Cloud Storage for large encrypted files. Firestore must not become the permanent plaintext message store for human chat.

## Required Rules

- [ ] Use `organizations/{tenantId}` as the tenant root.
- [ ] Store users under `organizations/{tenantId}/users/{userId}`.
- [ ] Store mobile and web app feature data under tenant-scoped collections.
- [ ] Never embed large growing arrays inside organization, user, chat, LSW, or RCA documents.
- [ ] Use subcollections for high-volume records, events, comments, tasks, evidence, attachments, and audit trails.
- [ ] Use Cloud Storage for files and keep Firestore documents as metadata only.
- [ ] Design all documents with `tenantId`, `createdAt`, `createdBy`, `updatedAt`, and `status` where applicable.
- [ ] Create summary documents for dashboards instead of scanning large collections.
- [ ] Paginate all lists.
- [ ] Add composite indexes intentionally for real query patterns.
- [ ] Keep backend APIs as the enforcement point for cross-module workflows.
- [ ] Keep audit logs append-only.
- [x] Store human chat content as encrypted envelopes, not plaintext backend message bodies.
- [x] Store delivered chat history in encrypted local mobile storage.
- [x] Generate chat previews locally after decryption.

## Future Tenant-Scoped Module Roots

Recommended future collection roots:

```text
organizations/{tenantId}/leaderStandardWork/{lswId}
organizations/{tenantId}/leaderStandardWork/{lswId}/tasks/{taskId}
organizations/{tenantId}/leaderStandardWork/{lswId}/checks/{checkId}
organizations/{tenantId}/rootCauseAnalyses/{rcaId}
organizations/{tenantId}/rootCauseAnalyses/{rcaId}/evidence/{evidenceId}
organizations/{tenantId}/rootCauseAnalyses/{rcaId}/actions/{actionId}
organizations/{tenantId}/auditLogs/{auditLogId}
organizations/{tenantId}/files/{fileId}
```

## Scale Answer

- [x] The database direction is capable of scaling if every module stays tenant-scoped, indexed, paginated, and backend-authorized.
- [ ] The exact schemas for Leader Standard Work and Root Cause Analysis still need to be designed before those modules are built.

## Firebase Cost Control Gate

Firebase can be cost-effective for Synzapp, but only if reads, listeners, storage, SMS verification, functions, and bandwidth are designed deliberately.

- [ ] Add Firebase and Google Cloud budget alerts before production testing.
- [ ] Track Firestore reads, writes, deletes, storage, and network usage.
- [ ] Track Firebase Auth SMS usage separately.
- [ ] Use test phone numbers during development to avoid unnecessary SMS cost.
- [x] Keep users signed in instead of forcing repeated SMS verification.
- [ ] Use paginated queries and cursors instead of loading full collections.
- [ ] Use realtime listeners only on active screens and unsubscribe immediately when screens close.
- [ ] Use summary documents for dashboards instead of scanning operational collections.
- [ ] Store large files in Cloud Storage, not Firestore documents.
- [ ] Compress images and videos before upload.
- [ ] Add App Check, rate limiting, and abuse controls before public release.
- [ ] Review Firebase cost metrics before each major phase is checked off.

## LSW/RCA Schema Timing Gate

This must not be left to memory.

- [x] During Phase 2, reserve the shared tenant-scoped database pattern so future LSW and RCA modules fit cleanly.
- [ ] Before Phase 12 implementation starts, design the exact Leader Standard Work schemas.
- [ ] Before Phase 12 implementation starts, design the exact Root Cause Analysis schemas.
- [ ] Do not build LSW screens, RCA screens, web app APIs, dashboards, or AI workflows until these schemas are reviewed and checked off.
- [ ] The schemas must define document fields, subcollections, indexes, permissions, audit events, file attachment paths, dashboard summaries, and lifecycle statuses.

## Mobile-First E2EE Messaging Gate

This must be completed before expanding chat beyond the current direct-message UX validation.

- [x] Decide that Synzapp human chat is mobile-first and end-to-end encrypted by default.
- [ ] Choose the E2EE protocol/library for direct messages and group messages.
- [ ] Define per-device identity keys, signed pre-keys, one-time pre-keys or protocol-equivalent key material.
- [x] Add backend device registration records for active tenant users.
- [x] Add backend device revocation records and admin revocation flow.
- [x] Enforce active registered device identity on protected profile, admin, chat, media, and realtime routes.
- [x] Store private device identity keys only on device using platform secure storage.
- [x] Add encrypted local mobile message store foundation for delivered chat history.
- [x] Add encrypted local pending outbound queue foundation.
- [x] Add retry and cleanup behavior for the encrypted local pending outbox foundation.
- [ ] Add encrypted local mobile database for delivered chat history.
- [x] Add local queue for pending outbound encrypted messages.
- [x] Replace plaintext Firestore message bodies with encrypted message envelopes for the active chat send/read path.
- [x] Keep chat previews local after decryption; do not store plaintext previews in Firestore.
- [x] Add expiry timestamp and opportunistic cleanup foundation for encrypted envelopes.
- [x] Add server TTL/delete policy for delivered or expired encrypted envelopes.
- [x] Cache profile photos and downloaded chat media locally.
- [ ] Add versioned thumbnail cache keys for generated media thumbnails.
- [x] Support offline chat loading from local encrypted storage.
- [x] Prevent server temporary-delivery sync from wiping encrypted local conversation history after app restart.
- [x] Design end-to-end encrypted chat backup and restore for app reinstall, device loss, and device replacement.
- [x] Add encrypted backup metadata records scoped by tenant, user, device, and conversation.
- [x] Add encrypted backup upload from authorized devices without backend plaintext access.
- [x] Add encrypted backup restore after phone auth, backend membership check, and active device registration.
- [x] Block backup restore when a user is removed, suspended, or no longer belongs to the tenant.
- [x] Add high-entropy recovery-key foundation for restoring encrypted chat backups after reinstall.
- [x] Add tenant-controlled encrypted chat backup policy that defaults to disabled.
- [x] Add Org Admin settings to enable or disable encrypted backups.
- [x] Add Org Admin settings to allow or block self-service recovery-key restore.
- [x] Enforce tenant backup policy on the backend before backup upload or restore.
- [ ] Add admin-approved restore request workflow for enterprises that disable self-service restore.
- [ ] Purge or legally retain encrypted backups when an org admin closes the tenant account.
- [x] Design encrypted media upload/download flow for chat attachments.
- [x] Implement encrypted temporary media relay for direct-message photo, video, and file attachments.
- [x] Compress chat photos and videos before encrypted upload.
- [x] Keep documents/files uncompressed while encrypting them end to end.
- [x] Show chat-bubble upload/download progress for media attachments.
- [ ] Define tenant-controlled encrypted retention/legal-hold mode, if required.
- [x] Update security rules and backend authorization tests for device keys and encrypted envelopes.
- [x] Add migration plan and audited cleanup endpoint for current transitional plaintext message documents.
- [ ] Do not expand department channels, announcement channels, attachments, replies, reactions, search, or AI over chat until this gate is complete.

---

# Phase 0: Project Foundation and Engineering Discipline

## Goal

Create a reliable foundation so Synzapp is built as a real enterprise product, not a prototype.

## Checklist

- [x] Confirm `SYNZAPP` folder as the active project scope.
- [x] Confirm the architecture source file.
- [x] Establish React Native, Expo, TypeScript, and Firebase as the current mobile foundation.
- [ ] Define development, staging, and production environment strategy.
- [ ] Create separate Firebase projects or environment files for each environment.
- [ ] Document required environment variables.
- [ ] Add linting command.
- [ ] Add unit test command.
- [ ] Add mobile build verification command.
- [x] Add security rule test strategy.
- [ ] Add no-secrets committed check.

## Exit Criteria

- [ ] The project can be installed, typechecked, tested, and run from clean instructions.
- [ ] Development and future production configuration are separated.

---

# Phase 1: Login and Phone Authentication

## Goal

Let a user authenticate with phone number OTP in a polished mobile experience.

## Completed So Far

- [x] Firebase config wrapper exists.
- [x] Firebase phone OTP send service exists.
- [x] Firebase phone OTP verify service exists.
- [x] Login screen accepts phone numbers.
- [x] Country code selector supports United States, Canada, Mexico, and United Kingdom.
- [x] Phone number formatting keeps country code separate from the national number.
- [x] Device phone autofill is supported and formatted correctly.
- [x] SMS verification screen exists.
- [x] SMS verification screen masks the phone number in the UI.
- [x] reCAPTCHA verification modal is centered.
- [x] Login and verification screens use a consistent flat UI style.
- [x] Firebase Auth state persists on the device through React Native storage.
- [x] The app restores a signed-in Firebase user on launch.
- [x] Org Admin setup screen masks the phone number and hides Firebase UID/token details.
- [x] Mobile app calls backend OTP preflight before sending SMS.
- [x] Mobile app has resend-code cooldown.
- [x] Firebase auth errors are mapped to user-friendly messages.
- [x] Backend `/api/auth/session` verifies Firebase ID token.
- [x] Backend verifies revoked Firebase sessions.
- [x] Backend checks identity directory, approved phone directory, tenant, role, status, and permissions when records exist.
- [x] Backend returns role, status, tenantId, permissions, and profile-required routing.
- [x] Backend supports Firebase custom claims for tenantId, role, status, permissions, and claims version.
- [x] Mobile app refreshes Firebase ID token after backend custom-claim updates.
- [x] Backend blocks deactivated or suspended users.
- [x] Backend writes OTP preflight, login, restore, denied, and failed auth audit events.
- [x] Backend has App Check enforcement hook controlled by `SYNZAPP_REQUIRE_APP_CHECK`.
- [x] App Check enforcement behavior is covered by backend tests.
- [x] Backend has IP, phone, and UID rate limits for OTP preflight and session verification.
- [x] Backend has abuse-monitoring audit events for repeated OTP and failed verification attempts.

## Manual Verification Gate

- [ ] Configure Firebase Admin credentials for the backend in local/staging/prod.
- [ ] Confirm Firebase phone auth works on a real device with real SMS.
- [ ] Confirm backend `/api/auth/otp/preflight` writes Firestore audit event with real Firebase credentials.
- [ ] Confirm backend `/api/auth/session` verifies a real Firebase ID token with real Firebase credentials.
- [ ] Configure Firebase App Check in Firebase console before public release, then set `SYNZAPP_REQUIRE_APP_CHECK=true`.
- [ ] Confirm real iOS and Android devices send valid App Check tokens before enforcement is enabled.

## Exit Criteria

- [ ] A real phone number can authenticate through Firebase.
- [x] A signed-in device reopens without sending another SMS unless the user signs out, the session is revoked, or security policy requires reauthentication.
- [x] OTP resend cooldown and backend rate limits are implemented.
- [x] The app does not enter the product experience until backend membership and profile status are checked.
- [x] No full phone number is shown in regular UI after verification.

## Phase 1 Status

Phase 1 implementation is complete. Phase 1 final signoff requires the manual verification gate above because real SMS delivery and Firebase Admin credential checks must be confirmed against the live Firebase project.

---

# Phase 2: Profile Creation and Database Persistence

## Goal

After login, ask the verified user whether they are an Organization Admin or an Employee, then create and store the correct profile path in the database before app features begin. Employee access must be based on backend-approved phone records, not organization-name entry.

## Immediate Next Work

- [x] Add role selection screen after phone verification.
- [x] Provide Organization Admin and Employee options.
- [x] Route Organization Admin selection to company profile creation.
- [x] Route Employee selection to employee profile creation.
- [x] Keep UI consistent with the login and verification screens.
- [x] Remove card-heavy styling from the profile creation path.
- [x] Do not show raw Firebase UID or full ID token in normal user-facing UI.
- [x] Mask phone number in all visible profile UI.
- [x] Remove organization-name entry from the Employee profile path.
- [x] Employee profile path must first require backend-approved phone record.
- [x] Persist Organization Admin role and profile data through backend services.
- [x] Persist Employee profile data through backend services after approved-phone lookup.

## Tenant Profile Checklist

- [x] Define `organizations/{tenantId}` Firestore document shape.
- [x] Store `tenantId`.
- [x] Store `companyName`.
- [x] Store `companyAddress`.
- [x] Reserve `companyLogoUrl`.
- [x] Store `status`.
- [x] Store `createdBy`.
- [x] Store `createdAt`.
- [x] Store `securityMode`.
- [x] Store `retentionPolicy`.
- [x] Validate company name.
- [x] Validate company address.
- [x] Generate unique tenantId server-side.
- [x] Prevent duplicate/confusing company names where needed.
- [ ] Plan organization invite code.
- [x] Reserve the tenant-scoped collection conventions that future Leader Standard Work and Root Cause Analysis modules will follow.

## Org Admin Profile Checklist

- [x] Define `organizations/{tenantId}/users/{userId}` profile document shape.
- [x] Store Firebase UID.
- [x] Store masked/display-safe phone value separately from canonical phone value.
- [x] Store phone hash instead of raw phone number in the user profile document.
- [x] Store first name.
- [x] Store last name.
- [x] Store optional Org Admin profile photo storage path.
- [x] Store role as `ORG_ADMIN`.
- [x] Store status as `ACTIVE`.
- [x] Store permissions for Org Admin.
- [x] Store createdAt and updatedAt.
- [x] Store lastLoginAt.
- [x] Store profile completion status.
- [x] Assign creator as Org Admin.

## Employee Profile Checklist

- [x] Define `organizations/{tenantId}/users/{userId}` employee profile document shape.
- [x] Employee profile creation must require an approved phone record.
- [x] Employee cannot type or guess organization name to gain access.
- [x] Employee sees company confirmation only after backend approved-phone match.
- [x] Company confirmation shows company name, Org Admin name, and Org Admin or company support phone number.
- [x] Employee profile requires first name and last name.
- [x] Employee department is preassigned or restricted to backend-approved department options.
- [x] Employee role is preassigned or restricted to backend-approved role options.
- [x] Employee role selection cannot elevate permissions beyond the approved phone record.
- [x] Profile photo is optional and uses native device picker.
- [x] Backend creates employee profile with tenantId, departmentId, roleId, permissions, status, and profileComplete.

## Backend and Security Checklist

- [x] Create backend tenant creation service.
- [x] Create backend Org Admin user profile service.
- [x] Create backend approved-phone lookup service for employee profile path.
- [x] Validate Firebase ID token on tenant creation.
- [x] Ensure one authenticated user cannot create duplicate active tenants accidentally.
- [x] Set Firebase custom claims after tenant creation.
- [x] Write audit event for tenant creation.
- [x] Write audit event for Org Admin profile creation.
- [ ] Add Firestore security rules for tenant profile reads/writes.
- [ ] Add Firestore security rule tests for tenant isolation.
- [ ] Add API tests for tenant creation.
- [x] Add error handling for duplicate profile and failed profile creation.

## Mobile Checklist

- [x] Submit Org Admin profile creation form to backend.
- [x] Add optional Org Admin profile photo using native device picker.
- [x] Show success state only after database write succeeds.
- [x] Refresh auth token after claims are set.
- [x] Show native success alert after Org Admin profile creation.
- [x] Route completed Org Admin to the starter chat screen.
- [x] Route incomplete profiles back to profile completion.
- [x] Handle network failure without losing entered form data.

## Exit Criteria

- [ ] Org Admin can create a company profile and personal profile on a real device with a real Firebase ID token.
- [ ] Profiles are verified in the database after real-device creation.
- [ ] Firebase custom claims are verified to include tenantId, role, and status after real-device creation.
- [ ] Reloading the app returns the user to the correct authenticated state.

---

# Phase 3: Approved Employee Registration

## Goal

Employees cannot self-join freely. Access requires company approval through an approved phone record created by an Org Admin or approved Dept Admin.

## Checklist

- [x] Define `organizations/{tenantId}/approvedPhones/{phoneId}` document shape.
- [x] Define global `approvedPhoneDirectory/{phoneHash}` lookup document shape.
- [x] Add shared app footer with Chats, Employees, and Settings tabs.
- [x] Add Employees tab entry point with Invite action.
- [x] Org Admin can add one approved employee phone number from the native contact picker.
- [x] Org Admin can add approved employees in batches from a multi-select contacts list, with one-by-one native picker fallback.
- [ ] Replace the custom batch contact selector with a selected-only platform-native multi-select contact picker in production native builds where supported.
- [x] Contact import uses native contacts access and uploads only admin-selected contacts.
- [x] Batch add requires selecting department before adding contacts.
- [x] Batch add requires selecting role before adding contacts.
- [x] Tenant approved-phone record includes encrypted phone number, phone hash, phone last four digits, tenantId, departmentId, roleId, permissions, status, invitedBy, createdAt, and optional job title.
- [x] Approved phone record never stores raw phone number in global lookup documents.
- [x] Employee cannot search/select organization during join.
- [x] Employee cannot type organization name during join.
- [x] Employee can verify phone with Firebase OTP.
- [x] Backend checks approved phone list after OTP verification.
- [x] If approved and invited, backend shows company confirmation before profile completion.
- [x] Company confirmation shows company name, Org Admin name, and Org Admin or company support phone number.
- [x] If approved and invited, backend creates employee profile after required fields are submitted.
- [x] Employee profile requires first name, last name, department, and role.
- [x] Employee profile photo is optional and uses native device picker.
- [x] If not approved, app shows a clear access-denied message.
- [x] Access-denied message does not reveal whether an organization exists.
- [x] Employee profile stores assigned roleId and effective permissions from backend.
- [x] Employee status becomes `ACTIVE`.
- [x] Audit events are written for user invited and user registered.
- [x] Audit events are written for employee invite creation.
- [x] Audit events are written for denied employee join attempts.

## Exit Criteria

- [ ] A phone number not approved by the company cannot enter the tenant.
- [ ] An approved employee can complete registration and receive tenant-scoped access.
- [ ] Employee cannot gain access by guessing company name.
- [ ] Employee cannot self-select a role that was not approved by the company.

---

# Phase 4: Tenant Isolation, RBAC, and Permission Foundation

## Goal

Enforce enterprise security before building broad app features.

## Checklist

- [ ] Use tenantId on all important records.
- [ ] Enforce `user.tenantId == resource.tenantId`.
- [x] Define base roles: ORG_ADMIN, DEPT_ADMIN, EMPLOYEE, SYSTEM_ADMIN.
- [x] Define permission flags.
- [ ] Backend authorization checks authenticated user, active status, tenant, role, permission, and resource ownership.
- [x] Reusable backend authorization policy helper covers active session, tenant, role, permission, and Department Admin department scope.
- [x] Backend authorization policy helper is wired into employee invite/list scope, group management, and encrypted chat backup policy updates.
- [x] Firestore rules enforce tenant boundaries.
- [x] Storage rules enforce tenant paths.
- [x] Security rules use default-deny fallback and block client writes for backend-owned tenant records.
- [x] Search and notification designs include tenant scoping.
- [x] Add tests for cross-tenant denial.
- [x] Add tests for deactivated user denial.
- [x] Add Firebase Emulator rule tests for Firestore tenant boundaries, direct-chat reads, encrypted-envelope reads, Storage tenant paths, encrypted backup reads, and blocked client writes.

## Exit Criteria

- [ ] No user can read, write, search, upload, or receive notifications across tenant boundaries.

---

# Phase 5: Admin Controls

## Goal

Allow Org Admin to manage the company workspace safely.

## Checklist

- [x] Shared You profile tab for Org Admin and Employee users.
- [x] Backend current-user profile endpoint for tenant-scoped profile display.
- [x] Self-service profile photo update endpoint and mobile native camera/library picker.
- [x] Employee-safe Settings list hides unauthorized admin settings while exposing allowed employee settings.
- [x] My devices settings for Org Admin and Employee users.
- [x] Current-user device list endpoint requires active session, active tenant membership, and active registered device.
- [x] Users can revoke their own non-current devices.
- [x] Profile photos are resized and compressed before upload, with backend size limits.
- [x] Profile photos use a stable versioned backend URL with cache headers to reduce repeated downloads.
- [x] Employee list avatars show profile photos when available and fall back to initials.
- [x] Profile avatars fall back to initials on Android image-load failures.
- [x] Android profile photos are downloaded with auth and rendered from local app cache.
- [x] Company profile management.
- [x] Company logo upload.
- [x] Audit logs for company logo updates.
- [x] User management list.
- [x] Add employee manually.
- [x] Add employee from contacts.
- [x] Add employees in batches from contacts.
- [x] Department creation.
- [x] Role creation.
- [x] Department admin assignment.
- [x] Department Admin profile display shows the company role plus Department Admin status.
- [x] Department Admin gets the Employees tab through scoped `users.invite` permission.
- [x] Department Admin employee list is scoped to the assigned department.
- [x] Department Admin can invite employees only into the assigned department.
- [x] Department Admin cannot deactivate, archive, delete, or anonymize employees.
- [x] Group creation foundation for tenant-scoped company and department groups.
- [x] Department creation automatically creates a system-managed department group with backend-owned visibility.
- [x] Department system groups and normal user-created groups use the same encrypted group-chat feature set.
- [x] Groups footer tab lists only backend-authorized groups for Org Admin, Department Admin, and Employee users.
- [ ] Group member management for adding or removing external employees and external Department Admins from department groups.
- [x] Encrypted group-chat messaging for department and custom groups.
- [x] Role assignment.
- [x] Permission assignment.
- [x] Department Admin permission settings catalog and mobile settings screen for invite users, department groups, announcements, work orders, action plans, and department activity.
- [x] Department-scoped backend authorization for Department Admin employee invite and group creation.
- [ ] Department-scoped backend authorization for every Department Admin permission.
- [x] Deactivate user.
- [x] Reactivate deactivated or archived user.
- [x] Archive user.
- [x] Delete or anonymize user.
- [x] Lifecycle actions revoke employee refresh tokens, custom claims, and registered devices.
- [x] Deactivated, archived, suspended, or deleted users are blocked by backend session checks.
- [x] Realtime chat authentication checks revoked Firebase tokens and revalidates active device/session status before sending updates.
- [x] Blocked users see a generic native access-denied alert instead of technical session or lifecycle details.
- [x] Reactivated employees can sign in again after phone verification while manually revoked devices stay blocked.
- [x] Employee lifecycle actions require Org Admin `users.manage` permission.
- [x] Confirmation screens for sensitive admin actions.
- [x] Audit logs for department and role creation.
- [x] Audit logs for user self-service device revocation.
- [x] Audit logs for company profile updates.
- [x] Audit logs for employee deactivate, archive, and anonymize actions.
- [x] Audit logs for every admin action.

## Exit Criteria

- [ ] Org Admin can manage users and company basics without direct database editing.

---

# Phase 6: Chat Core

## Goal

Build secure tenant-scoped workplace communication on a mobile-first E2EE foundation.

## Checklist

- [x] Define chat document shape.
- [x] Define transitional message document shape for early UX validation.
- [x] Define final encrypted message envelope document shape.
- [x] Add per-device key registration.
- [x] Require active registered device identity on protected chat APIs and realtime chat sessions.
- [x] Add encrypted local mobile message store foundation.
- [x] Add encrypted local pending outbound queue foundation.
- [x] Add retry and cleanup behavior for queued local outbound messages.
- [ ] Add encrypted local mobile message database.
- [x] Replace plaintext backend message body storage with encrypted envelopes for the active chat send/read path.
- [x] Add expiry timestamp and opportunistic cleanup foundation for encrypted envelopes.
- [x] Add temporary backend retention and TTL deletion for delivered encrypted envelopes.
- [x] Add offline chat loading from encrypted local storage.
- [x] Prevent server temporary-delivery sync from wiping encrypted local conversation history after app restart.
- [x] Add end-to-end encrypted chat backup and restore.
- [x] Restore encrypted backups after app reinstall only for active tenant members on registered devices.
- [x] Block backup restore and future backup sync for removed, suspended, or deactivated tenant users.
- [x] Add Settings controls for encrypted backup, restore, and recovery-key copy.
- [x] Add tenant-governed backup policy managed by Org Admin.
- [x] Hide or disable employee backup/restore actions when organization policy does not allow them.
- [ ] Add admin-approved restore request workflow for managed enterprise recovery.
- [ ] Add tenant-account closure cleanup for encrypted chat backups.
- [x] Generate chat previews locally after decryption.
- [x] Chat screen lists real tenant people: Org Admin sees employees, employees see admins.
- [x] Chat contact avatars show profile photos when available and fall back to initials.
- [x] Chat list shows real last-message preview, last-message time, and unread counts.
- [x] Add chat list search under the Chats title.
- [x] Add full-screen native New Chat modal with search, New Group entry, and tenant member contact list.
- [x] Add full-screen native Add Members group flow with search, selected count, circular check controls, and Next action.
- [x] Add full-screen native New Group details flow with group photo picker entry point, group name field, permissions entry point, selected member removal, and Create validation.
- [x] Direct message screen opens from a chat contact and sends real messages.
- [x] Direct message screen sends encrypted photo, video, and file attachments through temporary server ciphertext relay.
- [x] Received media auto-downloads into local encrypted/offline chat cache by default.
- [x] Add first secure E2EE group-chat text slice for selected tenant members: backend group creation, explicit member records, group encryption context, encrypted text envelope send/load, and mobile local-cache reuse.
- [x] Add secure E2EE group chat backend creation for selected tenant members.
- [x] Persist group chat metadata, member list, and permissions without exposing message plaintext.
- [ ] Add group photo reference and group avatar management.
- [x] Enforce group membership authorization in backend APIs, realtime listeners, media routes, and push notification routing.
- [x] Add encrypted group message send, delivery/read receipt, reaction, reply, forward, attachment, media/file/voice-note upload and download, and local backup reuse support.
- [x] Group chat bubbles show the sender profile photo or initials avatar on the right side of the bubble.
- [ ] Department channels.
- [ ] Announcement channels.
- [x] Chat list with message previews.
- [ ] Paginated message loading.
- [x] Realtime listeners for new messages.
- [ ] Message replies.
- [x] Reactions.
- [x] Read receipts.
- [x] Delivered receipts.
- [ ] Typing indicators.
- [ ] Presence or online status.
- [ ] Edit message within rule window.
- [ ] Delete for everyone within rule window.
- [ ] Delete for me.
- [ ] Retain edit/delete history where required.

## Exit Criteria

- [ ] Users can only see chats where they are authorized members.
- [ ] Messages are realtime, paginated, tenant-scoped, E2EE, and offline-readable from encrypted local storage after delivery.
- [ ] Backend cannot read human chat message plaintext.
- [ ] Backend stores only encrypted envelopes, metadata, receipts, and tenant-control records for chat.

---

# Phase 7: Files, Media, and Storage Security

## Goal

Support file sharing without weakening tenant security.

## Checklist

- [x] Image upload.
- [x] Video upload.
- [x] Document upload.
- [ ] Audio or voice note upload.
- [ ] File type allowlist.
- [x] File size limits.
- [x] Temporary upload path.
- [ ] Final tenant-scoped storage path for non-E2EE workflow attachments.
- [x] File metadata document.
- [ ] Virus/malware scan plan.
- [x] No public file URLs.
- [x] Signed URL expiration.
- [ ] Audit file uploads.
- [ ] Audit file downloads.
- [x] E2EE chat attachments store ciphertext only on the backend.
- [x] Photos and videos are compressed before encrypted upload; files are not compressed.
- [x] Backend-issued upload and download URLs require active Firebase session, App Check path, active registered device, and chat participant authorization.

## Exit Criteria

- [ ] Files are accessible only to authorized users in the same tenant and related chat/workflow.

---

# Phase 8: Notifications

## Goal

Deliver useful notifications without leaking sensitive content.

## Checklist

- [x] Register device tokens.
- [ ] Store notification preferences.
- [x] New message notification.
- [ ] Mention notification.
- [ ] Group invite notification.
- [ ] Announcement notification.
- [ ] Work order notification.
- [ ] Action plan notification.
- [ ] Quiet hours support.
- [x] Default private notification preview.
- [x] Notification delivery logs.
- [x] Tenant-scoped recipient resolution.

## Exit Criteria

- [ ] Notifications go only to authorized recipients and do not expose sensitive message content by default.
  - Current chat push foundation stores device tokens under the active user's tenant-scoped registered device, resolves recipients on the backend, writes `notificationEvents`, and sends private "New message" previews without plaintext chat content. Final Phase 8 exit signoff still requires notification preferences, quiet hours, non-chat notification types, and live push credential validation.

---

# Phase 9: Workflows

## Goal

Convert communication into trackable operational work.

## Work Orders

- [ ] Create work order from chat message.
- [ ] Pre-fill work order from message.
- [ ] Assign user or department.
- [ ] Set priority.
- [ ] Set due date.
- [ ] Statuses: OPEN, IN_PROGRESS, ON_HOLD, COMPLETED, CANCELLED.
- [ ] Notify assigned user.
- [ ] Audit work order creation and status changes.

## Action Plans

- [ ] Create action plan from chat message.
- [ ] Add action plan tasks.
- [ ] Assign task owners.
- [ ] Set due dates.
- [ ] Statuses: OPEN, IN_PROGRESS, COMPLETED, BLOCKED, CANCELLED.
- [ ] Notify assigned users.
- [ ] Audit action plan creation and changes.

## Announcements

- [ ] Company-wide announcements.
- [ ] Department announcements.
- [ ] Safety announcements.
- [ ] Emergency announcements.
- [ ] Acknowledgement tracking.
- [ ] Audit announcement sending.

## Exit Criteria

- [ ] Work orders, action plans, and announcements are tenant-scoped and permission-controlled.

---

# Phase 10: Search

## Goal

Allow users to find authorized information without breaking tenant or group boundaries.

## Checklist

- [ ] Search messages by keyword where feasible.
- [ ] Search by date.
- [ ] Search by sender.
- [ ] Search by group.
- [ ] Search by department.
- [ ] Search by file type.
- [ ] Search work orders.
- [ ] Search action plans.
- [ ] Search announcements.
- [ ] Scope results by tenantId.
- [ ] Scope results by user role.
- [ ] Scope results by group membership.
- [ ] Audit enterprise search activity when needed.

## Exit Criteria

- [ ] Search never returns unauthorized tenant, group, or restricted data.

---

# Phase 11: Security Hardening, Audit, and Compliance

## Goal

Harden the product toward enterprise readiness.

## Checklist

- [x] Audit login.
- [x] Audit failed login.
- [x] Audit logout.
- [x] Audit user invited.
- [x] Audit user registered.
- [x] Audit user deactivated.
- [x] Audit user reactivated.
- [x] Audit user archived.
- [x] Audit user deleted or anonymized.
- [x] Audit role changed.
- [x] Audit permission changed.
- [x] Audit group created.
- [ ] Audit group deleted.
- [ ] Audit file uploaded/downloaded.
- [ ] Audit data export.
- [x] Audit security setting change.
- [x] Implement App Check backend enforcement hook and tests.
- [ ] Enable App Check enforcement in Firebase console and backend production environment.
- [x] Firestore security rule tests.
- [x] Storage security rule tests.
- [x] Security rules foundation guard tests for Firebase config, default-deny posture, tenant claim checks, and blocked client writes.
- [x] Audit coverage guard tests for admin mutations, authentication outcomes, and registration/profile-owned security mutations.
- [x] API route guard coverage tests for App Check middleware, Firebase session verification, and active-device requirements.
- [x] API authorization request tests for missing Firebase bearer tokens on protected admin, profile, and auth-session routes.
- [x] Permission catalog validation tests for role and Department Admin permission assignment.
- [x] Authorization policy unit tests for RBAC, tenant isolation, active status, and Department Admin department scope.
- [x] API authorization tests.
- [x] Dependency scanning.
- [x] Dependency remediation plan documented.
- [ ] Resolve backend Firebase Admin / Google Cloud transitive audit findings without unsafe major downgrade.
- [ ] Resolve mobile Expo / reCAPTCHA audit findings through a tested Expo-compatible upgrade path.
- [ ] Resolve backend Firebase emulator tooling audit findings when a compatible update is available.
- [x] Mobile security review.
- [x] Backup policy.
- [x] Restore procedure test.
- [x] Monitoring and alerting runbook.
- [ ] Connect production monitoring provider and alert destinations.
- [ ] Run real-device encrypted restore rehearsal before enterprise pilot.

## Exit Criteria

- [ ] Security controls are tested, monitored, and auditable in production.

---

# Phase 12: Shared Web App, Leader Standard Work, and Root Cause Analysis

## Goal

Add the Synzapp web app on the same backend and database foundation as the mobile app, with Leader Standard Work and Root Cause Analysis as first-class tenant-scoped modules.

## Shared Backend Checklist

- [ ] Define web app authentication flow using the same Firebase identity model.
- [ ] Use the same backend API authorization middleware for mobile and web.
- [ ] Use the same tenantId, role, status, and permission custom claims.
- [ ] Ensure web app access is role and permission controlled.
- [ ] Ensure web app reads and writes the same tenant-scoped database roots.
- [ ] Add audit logging for web app actions.
- [ ] Add web-specific route protection.
- [ ] Add API tests that cover both mobile and web clients.

## Leader Standard Work Checklist

- [ ] Define Leader Standard Work document schema.
- [ ] Define LSW task/check schema.
- [ ] Support recurring checks.
- [ ] Support assigned leader or department.
- [ ] Support due date and completion status.
- [ ] Support notes, evidence, and attachments.
- [ ] Support escalations from incomplete checks.
- [ ] Support dashboards using summary documents.
- [ ] Audit LSW creation, assignment, completion, and escalation.
- [ ] Enforce tenant, role, and department permissions.

## Root Cause Analysis Checklist

- [ ] Define RCA document schema.
- [ ] Support problem statement.
- [ ] Support containment action.
- [ ] Support 5 Why analysis.
- [ ] Support fishbone categories.
- [ ] Support evidence and attachments.
- [ ] Support corrective actions.
- [ ] Support preventive actions.
- [ ] Link RCA to chat messages, work orders, action plans, or LSW checks when relevant.
- [ ] Support RCA status workflow.
- [ ] Audit RCA creation, edits, ownership changes, and closure.
- [ ] Enforce tenant, role, and department permissions.

## Exit Criteria

- [ ] Web app can use the same backend and tenant database safely.
- [ ] Leader Standard Work and Root Cause Analysis are database-backed, tenant-scoped, auditable, and permission-controlled.

---

# Phase 13: Enterprise Growth

## Goal

Move beyond MVP toward enterprise SaaS capabilities.

## Checklist

- [ ] Web admin portal.
- [ ] Production Synzapp web app.
- [ ] Leader Standard Work dashboards.
- [ ] Root Cause Analysis dashboards.
- [ ] Advanced search.
- [ ] Analytics.
- [ ] Data export.
- [ ] AI summaries.
- [ ] Translation.
- [ ] RCA generator.
- [ ] Fishbone diagrams.
- [ ] 5 Why analysis.
- [ ] Enterprise reporting.
- [ ] SSO.
- [ ] SOC 2 readiness.
- [ ] Enterprise compliance dashboard.
- [ ] Tenant-controlled encrypted backup, retention, and legal-hold mode for E2EE chat.
- [ ] Enterprise key-management or passkey-backed recovery for encrypted chat backups.

## Exit Criteria

- [ ] Synzapp has a secure MVP foundation and a clear enterprise expansion path.

---

# Immediate Next Phase To Build

The next phase is **Phase 2: Profile Creation and Database Persistence**.

Start with:

- [x] Add post-verification role selection before profile creation.
- [x] Redesign Org Admin profile creation screen to match login UI.
- [x] Add Employee profile creation screen to match login UI.
- [x] Define tenant profile schema.
- [x] Define Org Admin user profile schema.
- [ ] Define Employee user profile schema.
- [x] Decide backend endpoint shape for Org Admin tenant/profile creation.
- [x] Implement company and Org Admin profile persistence.
- [ ] Replace Employee organization-name input with backend-approved company confirmation.
- [ ] Persist Employee profile to database after approved-phone validation.
- [x] Set Org Admin custom claims after profile creation.
- [x] Refresh Firebase token after Org Admin claims are set.
- [x] Route completed Org Admin into the starter chat screen after profile creation.

Do not start chat, files, work orders, action plans, or announcements until the profile and tenant database path is working with real data.
