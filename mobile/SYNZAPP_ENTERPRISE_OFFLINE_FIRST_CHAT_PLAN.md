# Synzapp Enterprise Offline-First Chat Plan

Date: August 26, 2026

Go ahead and implement the improvement thoroughly with no shortcuts or demos. each implementation should be done fullly and with precision, no room for mistakes. 
you must very current implementation care fully, before any improvements to make sure you are not impacting othe features indirectly or directly, so things doesn't feel broken. securely implement the improvement in the plan document with care and precision

## Executive Summary

Synzapp chat should behave like an enterprise-grade offline-first messenger: the chat list appears immediately, profile pictures are already present when available, opening a conversation renders recent history instantly, and media feels available without waiting on a network request. This must not weaken Synzapp's company-data governance, device revocation, or end-to-end encryption model.

The target architecture is local-first, server-authoritative, and wipe-aware:

- Local-first reads: chat lists, conversation messages, thumbnails, profile photos, and available media are read from encrypted local storage first.
- Server-authoritative sync: the backend remains the source of truth for membership, revocation, retention, and message delivery state.
- E2EE preserved: plaintext content is only available on approved devices after local device decryption; cached content remains protected at rest.
- Revocation respected: when a user or device is removed, all tenant-scoped local company data is purged immediately through existing governance paths.
- Performance first: huge histories and large media must not freeze the UI, block chat open, or force full conversation hydration.

## Research Baseline

The design follows established mobile architecture guidance:

- Android's official offline-first guidance says offline-first apps must have a local data source and must be able to read critical data without network access. It also recommends fetching/syncing in ways that consider battery and network state.
  Source: https://developer.android.com/topic/architecture/data-layer/offline-first
- Expo SQLite provides persisted local relational storage across app restarts, which fits Synzapp's existing React Native/Expo stack better than expanding AsyncStorage for high-volume chat history.
  Source: https://docs.expo.dev/versions/latest/sdk/sqlite/
- Apple URLSession supports HTTP uploads/downloads, and background URLSession configurations allow upload/download work to continue through system-managed background transfer behavior.
  Sources: https://developer.apple.com/documentation/foundation/urlsession and https://developer.apple.com/documentation/foundation/urlsessionconfiguration/background%28withidentifier%3A%29
- OWASP MASVS storage guidance requires sensitive mobile data to be protected at rest and protected from unintended leakage.
  Source: https://mas.owasp.org/MASVS/05-MASVS-STORAGE/

## Current Synzapp State

Synzapp already has important foundations:

- `src/services/localChatStore.ts`
  - Encrypted local chat contact cache.
  - SQLite-backed local conversation/message cache with AsyncStorage fallback.
  - Tenant/owner scoped cache keys.
  - Pending outbox queue for local optimistic sends.
  - Hidden-message support for delete-for-me behavior.
- `src/services/chatMediaApi.ts`
  - Local media copy/cache.
  - Encrypted media upload/download.
  - Chunked upload for larger files.
  - Media size limits by type.
- `src/services/profilePhotoCache.ts`
  - Profile-photo local cache.
- `src/services/companyDataGovernance.ts`
  - Central tenant-data purge point for local chat, media, profile photos, recovery keys, and device identity.
- `src/services/companyDataWipeApi.ts`
  - Remote wipe command polling and completion.
- `src/screens/AdminChatScreen.tsx`
  - Loads cached contacts before network contacts.
  - Loads cached messages before live messages when opening a chat.
  - Queues media downloads for recent messages.
  - Syncs pending messages when the conversation is opened.

The gap is that these are still partial/offline-assisted behaviors. The product should evolve to a full offline-first repository model where the UI always reads from local state first and network sync only reconciles local state.

## Product Goals

1. Instant chat list
   - On app open, render cached chat list within 100-250 ms on typical devices.
   - Include names, last message preview, unread counts, archived/pinned/favorite state, and cached profile photos.

2. Instant conversation open
   - On tap, render latest cached page immediately.
   - Do not wait for `getChatMessages`.
   - Continue network refresh in the background.

3. Offline media feel
   - Recently viewed and recently received photos/audio/videos/documents should open from local cache.
   - Media thumbnails should always render from cache or embedded thumbnail metadata.
   - Uploads should appear immediately in the chat with durable local send state.

4. Enterprise governance
   - Local storage is tenant-scoped and owner-scoped.
   - Revocation, employee removal, device removal, organization deletion, access denial, or remote wipe clears all local company data.
   - E2EE keys and backup recovery keys remain protected in secure storage.

5. Scale
   - Must support large companies, many conversations, and very large chat histories.
   - Chat UI must use pagination/windowing and must never deserialize a whole company history into React state.

## Target Architecture

### 1. Offline-First Repository Layer

Introduce a formal `chatRepository` boundary:

- `getConversationListSnapshot(scope)`
  - Reads local SQLite contacts, conversation summaries, unread state, pinned/favorite/archive state, and profile photo cache references.
  - Returns immediately.

- `observeConversationList(scope, callback)`
  - Emits local changes after sync, outbox changes, message receipt, profile photo cache changes, and preference changes.

- `refreshConversationList(scope)`
  - Fetches direct and group chats.
  - Reconciles with local rows inside one transaction.
  - Does not block initial render.

- `getMessagePage(scope, contactId, cursor, limit)`
  - Reads a single indexed message page from SQLite.
  - Default latest page: 40-60 messages.

- `refreshConversation(scope, contactId, sinceCursor)`
  - Fetches server deltas.
  - Decrypts envelopes off the critical UI path.
  - Persists decrypted message metadata and encrypted/plain render payload according to local-security design.
  - Emits repository update.

Why: Android's offline-first guidance centers on a repository that combines local and network data sources. Synzapp should follow this pattern so the UI always renders local data first and network sync becomes reconciliation.

### 2. SQLite-First Local Store

Move from "conversation blob plus SQLite fallback" to SQLite as the primary store.

Recommended tables:

- `local_chat_contacts`
  - `owner_uid`
  - `tenant_id`
  - `contact_id`
  - `chat_type`
  - `display_name`
  - `profile_photo_cache_key`
  - `profile_photo_local_uri`
  - `profile_photo_remote_url`
  - `last_message_id`
  - `last_message_at_ms`
  - `preview`
  - `unread_count`
  - `is_archived`
  - `is_pinned`
  - `is_favorite`
  - `is_spam`
  - `has_active_device`
  - `payload_ciphertext`
  - `updated_at_ms`

- `local_chat_messages`
  - `owner_uid`
  - `tenant_id`
  - `contact_id`
  - `message_id`
  - `sender_uid`
  - `sent_at_ms`
  - `is_mine`
  - `delivery_status`
  - `message_kind`
  - `text_preview`
  - `has_media`
  - `media_count`
  - `payload_ciphertext`
  - `updated_at_ms`

- `local_chat_media`
  - `owner_uid`
  - `tenant_id`
  - `contact_id`
  - `message_id`
  - `media_id`
  - `kind`
  - `content_type`
  - `file_name`
  - `size_bytes`
  - `duration_ms`
  - `width`
  - `height`
  - `thumbnail_local_uri`
  - `thumbnail_data_url`
  - `plain_local_uri`
  - `encrypted_local_uri`
  - `transfer_status`
  - `transfer_progress`
  - `last_accessed_at_ms`
  - `cache_tier`
  - `payload_ciphertext`

- `local_chat_outbox`
  - `owner_uid`
  - `tenant_id`
  - `queue_id`
  - `contact_id`
  - `chat_type`
  - `created_at_ms`
  - `attempt_count`
  - `status`
  - `last_error`
  - `payload_ciphertext`

- `local_chat_sync_state`
  - `owner_uid`
  - `tenant_id`
  - `contact_id`
  - `latest_server_cursor`
  - `oldest_local_cursor`
  - `last_refresh_at_ms`
  - `has_more_before`
  - `has_more_after`

Required indexes:

- `(owner_uid, tenant_id, last_message_at_ms DESC)` for chat list.
- `(owner_uid, tenant_id, contact_id, sent_at_ms DESC)` for latest message page.
- `(owner_uid, tenant_id, contact_id, message_id)` unique.
- `(owner_uid, tenant_id, transfer_status)` for media queue.
- `(owner_uid, tenant_id, status, created_at_ms)` for outbox queue.

### 3. Local Security Model

Local cache should remain usable offline but protected:

- Keep tenant-scoped local cache encryption.
- Store database payloads as encrypted JSON for sensitive fields, or migrate to a database-level encryption solution if product constraints allow.
- Keep local cache keys in SecureStore with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, matching the current direction.
- Never store server auth tokens in SQLite.
- Never write plaintext company files to public folders.
- Disable OS backup for company cache where native config allows, especially media and database paths.
- Store media under app-private directories only.
- Treat thumbnails as company data too.

Important distinction:

- E2EE in transit and server storage: message content/media keys are end-to-end encrypted per approved devices.
- Local offline cache: approved device may cache decrypted render payloads and downloaded media so the chat feels offline-first.
- Revocation response: wipe local keys, database, media, thumbnails, and profile photos so cached company data is no longer available on the removed device.

### 4. Conversation List Startup Flow

Target flow:

1. App opens.
2. `chatRepository.getConversationListSnapshot()` reads SQLite immediately.
3. UI renders list with cached avatars and previews.
4. `refreshConversationList()` runs in background.
5. Any changed contacts are reconciled into SQLite.
6. Repository emits updated list without replacing the entire screen state.
7. Remote wipe/access checks run in parallel and can immediately purge local data if required.

Rules:

- Never show a blocking spinner if local chat list exists.
- Show "syncing" or subtle progress only when useful.
- If network fails, keep local list visible and show non-blocking offline status.
- If user is revoked/access denied, stop all sync workers and purge local data before rendering company content.

### 5. Conversation Open Flow

Target flow:

1. User taps a chat.
2. Query latest 40-60 local messages by index.
3. Render immediately.
4. Load visible media thumbnails/local URIs from `local_chat_media`.
5. Start background delta sync.
6. Merge server messages into SQLite.
7. Update visible page only if the current viewport is affected.
8. Fetch older messages only when user scrolls up.

Rules:

- Do not load all cached messages into React state for large conversations.
- Use cursor pagination and viewport-aware rendering.
- Keep `FlatList`/virtualized rendering tuned with stable item heights where possible.
- Keep message media objects lightweight in message rows; full media metadata can be lazily joined from `local_chat_media`.

### 6. Media Offline-First Strategy

Media must feel local but storage must stay controlled.

Media tiers:

- Tier 0: Embedded metadata
  - File name, kind, size, duration, dimensions, thumbnail data URL.
  - Always available in message row.

- Tier 1: Thumbnail cache
  - Photos/videos/documents have local thumbnail previews.
  - Always prefetch for recent messages and visible chat list previews.

- Tier 2: Recent full media cache
  - Full media for recently sent, recently received, and recently opened items.
  - Default retention controlled by size budget.

- Tier 3: On-demand archive media
  - Older/larger files retain metadata and encrypted media keys.
  - Download/decrypt on open.

Recommended cache budgets:

- Profile photos: 100-300 MB max, LRU by last access.
- Thumbnails: 500 MB max per tenant, LRU.
- Full media: admin-configurable, default 2-5 GB per tenant/device if device storage allows.
- Per-conversation prefetch: last 25-50 media thumbnails, last 5-10 full media items depending on type and network.

Upload behavior:

- Copy selected media to app-private cache immediately.
- Create optimistic local message immediately.
- Generate/compress thumbnail before upload.
- For video and large documents, enqueue upload and show durable progress.
- Upload in chunks and persist per-part progress.
- Resume failed upload when network returns.
- Do not block the chat composer or thread while media encrypts/uploads.

Download behavior:

- Show thumbnail instantly.
- Auto-download recent small media according to network policy.
- Defer large videos/documents unless on Wi-Fi or user opens them.
- Persist download progress and resume where platform APIs allow.
- Use background transfer for native builds for large uploads/downloads.

### 7. Background Work and Sync Queue

Introduce a unified local queue:

- Outbox send queue
- Media upload queue
- Media download/prefetch queue
- Contact/profile photo refresh queue
- Read receipt/delivery state queue
- Reaction queue
- Delete-for-me queue

Queue principles:

- Durable in SQLite.
- Idempotent server APIs using client IDs.
- Exponential backoff with jitter.
- Network-aware scheduling.
- Battery/data-aware prefetch policy.
- Max concurrency:
  - Text sends: 2-4.
  - Photo uploads: 2.
  - Video/document uploads: 1.
  - Downloads: 2 foreground, 1 background.

### 8. Sync Conflict and Reconciliation Model

Server remains authoritative for:

- Membership.
- User/device revocation.
- Message acceptance.
- Group history key grants.
- Delivery/read state.
- Retention/deletion policy.

Client is authoritative only for:

- Local pending queue order.
- Local cache availability.
- Local UI preferences until server ack.
- Delete-for-me hidden state.

Merge strategy:

- Messages use `messageId` or `clientMessageId` for dedupe.
- Pending messages reconcile when server returns the matching message.
- Server delivery state can update local optimistic status.
- Reactions merge by `(messageId, uid, emoji)`.
- Media rows merge by `mediaId`, with local URI preserved if valid.

### 9. Revocation and Company Data Wipe

Existing `purgeTenantCompanyData` should become the mandatory terminal path for:

- Employee removed.
- Device revoked.
- Access denied from API.
- Organization deleted.
- Remote wipe command.
- Session invalidation.
- User sign-out where company policy requires purge.

Enhancements:

- Add a `local_company_data_manifest` table listing all tenant-scoped database files, media dirs, thumbnail dirs, profile photo dirs, backup artifacts, and pending queue dirs.
- On purge, stop sync/media workers first.
- Delete SQLite tenant rows in a transaction.
- Delete tenant media directories.
- Delete profile photo cache entries for tenant contacts.
- Delete SecureStore local cache keys for the tenant/device where required.
- Mark purge completion locally and remotely.
- On next launch, if local session has no valid tenant/device identity, do not render cached company content.

This preserves the product principle: active approved employees get fast offline-first chat; revoked employees do not keep company data.

### 10. Performance Architecture

UI performance:

- Initial chat list: local query under 100 ms target, render under 250 ms target.
- Chat open: first message page visible under 200 ms from tap with cache.
- Avoid full-history state.
- Use page size 40-60, then incremental older-page loading.
- Memoize message rows and keep media layout dimensions stable.
- Keep thumbnails small and precomputed.

Storage performance:

- Use SQLite transactions for batch message/contact updates.
- Use indexes for chat list and message pages.
- Avoid `AsyncStorage.getAllKeys()` for high-volume chat reads.
- Keep payload encryption chunked or row-based to avoid giant JSON blobs.

Media performance:

- Never base64 large media in React state.
- Avoid decrypting large videos/documents on the JS thread where possible.
- Prefer native/background transfer modules for large files.
- Generate thumbnails once and persist them.
- Use LRU cleanup when cache budget is exceeded.

Enterprise scale:

- The server should provide deltas and cursors, not full conversation dumps.
- Client should maintain per-contact sync cursors.
- Company library should reuse the same local media index where chat-originated files are surfaced.
- Large group chats should avoid per-open full member/photo refresh.

### 11. Backend API Requirements

Add or confirm:

- `GET /chat/sync`
  - Returns contact deltas, unread deltas, membership changes, revoke state.

- `GET /chat/conversations/:id/messages?afterCursor=&beforeCursor=&limit=`
  - Cursor-based deltas and pagination.

- `POST /chat/outbox/ack`
  - Idempotent acceptance by `clientMessageId`.

- `GET /chat/media/:mediaId/download`
  - Existing pattern is good; ensure resumable/range/background compatibility.

- `POST /chat/media/upload-session`
  - Existing chunked approach is good; add persisted resume metadata.

- `GET /profile/me/company-data-wipe-commands`
  - Already exists; ensure it is checked at app start, foreground resume, and after access-denied responses.

### 12. Implementation Phases

#### Phase 1: Make Existing Cache Feel Immediate

- Keep current APIs.
- Ensure chat list renders cached contacts on every app start before network.
- Ensure profile photo local URI is persisted in contact rows.
- Ensure conversation open always reads SQLite before network.
- Add non-blocking offline/sync status.
- Stop showing full-screen loading when local data exists.
- Instrument startup/chat-open timings.

Acceptance:

- Airplane mode app launch shows existing chat list.
- Airplane mode chat open shows cached messages.
- Cached profile pictures appear without network.

#### Phase 2: SQLite Primary Store

- Move contact list from encrypted AsyncStorage into SQLite primary tables.
- Keep AsyncStorage migration path for existing users.
- Add message pagination API in local store.
- Store message/media rows separately.
- Add local query helpers for latest page, older page, media by message IDs.

Acceptance:

- Opening a chat with 10,000+ cached messages only loads latest page.
- Scrolling up loads older pages without freezing.
- Chat list query does not scan all conversations.

#### Phase 3: Durable Queue and Media Pipeline

- Move pending outbox from AsyncStorage to SQLite.
- Add media queue table.
- Persist chunk upload/download progress.
- Add queue worker with network-aware backoff.
- Add media cache budgets and LRU cleanup.
- Add thumbnail-first rendering for all media types.

Acceptance:

- Send multiple photos/videos/documents offline; all appear immediately.
- Relaunch app; queued messages/media still show with progress.
- Reconnect; uploads resume.
- Large media does not freeze chat UI.

#### Phase 4: Background Transfer

- Add native iOS background URLSession integration for large uploads/downloads.
- Add Android background worker integration for durable transfer.
- Keep Expo-compatible fallback for foreground transfer.
- Persist native transfer IDs in media queue.

Acceptance:

- Large video/document upload can continue or resume after app backgrounding.
- Progress state survives app restart.

#### Phase 5: Enterprise Wipe Hardening

- Add local company data manifest.
- Expand purge to cover all offline-first tables/directories.
- Add purge tests.
- Add access-denied interceptor that triggers purge when backend confirms removal/revocation.
- Block cached company rendering if device/session is revoked.

Acceptance:

- Removed employee sees no company cached chat list/media after revocation is received.
- Remote wipe deletes database rows, media, thumbnails, profile photos, recovery key if policy requires.
- Wipe process is idempotent and reports completion.

#### Phase 6: Observability and Admin Controls

- Add local metrics:
  - chat list cache load ms
  - chat open cache load ms
  - SQLite query ms
  - media queue depth
  - upload/download failure rate
  - cache size by tenant
  - purge success/failure

- Add admin policy controls:
  - Offline media cache allowed
  - Full-media cache budget
  - Wi-Fi-only media prefetch
  - Cache retention days
  - Purge-on-signout policy

Acceptance:

- Admins can tune media caching for company risk tolerance.
- Engineering can measure whether Synzapp feels offline-first.

## Test Plan

Functional tests:

- Launch app offline with cached contacts.
- Open direct chat offline.
- Open group chat offline.
- Open cached photo/audio/video/document offline.
- Send text offline, relaunch, verify pending message persists.
- Send media offline, relaunch, verify local preview persists.
- Reconnect and verify queued messages send in order.
- Revoke user/device and verify local data purges.

Performance tests:

- 500 contacts.
- 5,000 contacts.
- 10,000 messages in one conversation.
- 100,000 messages across cached conversations.
- 500 cached profile photos.
- 10 GB media cache budget simulation.
- 10 simultaneous pending media uploads.

Security tests:

- Verify no company media in public directories.
- Verify tenant data removed by purge.
- Verify local DB rows are encrypted or protected as designed.
- Verify old AsyncStorage keys are migrated/deleted.
- Verify revoked session cannot render cached company content.

## Risks and Decisions

- Native background transfer may require additional native module work beyond Expo-managed APIs.
- Full local media caching improves UX but increases storage and governance responsibility.
- SQLite row encryption protects data but can complicate indexing; store searchable/sortable metadata separately and encrypt payload bodies.
- iOS and Android background execution differ; queue design must tolerate partial progress and app termination.

## Recommended Next Step

Start with Phase 1 and Phase 2 together:

1. Make the current cache-first behavior unconditional and measurable.
2. Convert chat list/conversation storage into a SQLite-primary repository.
3. Keep the existing company-data purge path active from day one.

This gives users the immediate enterprise-chat feel quickly while laying the foundation for durable offline media and large-scale history.
