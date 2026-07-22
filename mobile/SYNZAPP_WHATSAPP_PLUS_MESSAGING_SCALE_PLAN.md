# Synzapp WhatsApp-Plus Messaging Scale Plan

## Purpose

Synzapp messaging must feel instant like WhatsApp, but with stronger enterprise controls: encrypted local data, tenant isolation, device identity, audit-safe backend writes, durable offline queues, realtime receipts, and predictable performance under large company usage.

## Target Experience

- Sender taps Send and the bubble appears immediately.
- Sender can keep typing while encryption, uploads, and network sync run in the background.
- Offline messages stay visible and retry automatically.
- Backend retries cannot create duplicates.
- Receiver messages hydrate locally as soon as realtime or push metadata arrives.
- Delivery and read status updates without manual refresh.
- Chat history stays fast even with thousands of messages.
- Storage remains encrypted at rest and scoped by tenant and user.

## Enterprise Gaps Being Closed

### 1. Indexed Local Storage

Old behavior used encrypted AsyncStorage JSON arrays. That is acceptable for small conversations but slow at enterprise scale because every save rewrites a full conversation blob.

New architecture stores messages in SQLite rows:

- One encrypted payload per message.
- Indexed by owner, tenant, contact, and sent time.
- Conversation metadata stored separately.
- Old AsyncStorage cache remains as a fallback during migration.

### 2. True Local-First Outbox

The prior fix made send optimistic. This phase hardens it:

- Queue id becomes the stable `clientMessageId`.
- Optimistic messages stay `queued` until backend confirmation.
- Network and encryption run outside the tap handler.
- Active queue guards prevent duplicate local sends.

### 3. Backend Idempotency

Backend now treats `clientMessageId` as the duplicate-safe send identity:

- Direct messages use sender + client id.
- Group messages use sender + client id.
- Retries return the original envelope.
- Duplicate retries do not resend push notifications.

### 4. Realtime Receipts

The current realtime pipeline already carries message status through encrypted envelope snapshots. The near-term approach is to keep this path stable while making local storage fast enough that receipt merges are cheap.

Future dedicated receipt events can be added later for even smaller updates.

### 5. Push-to-Local Hydration

Push notification handling should not only open a chat. It should trigger a lightweight fetch for that conversation so received messages are written into local storage quickly.

This builds the foundation for a WhatsApp-like experience where the app feels alive even after background activity.

## Implementation Sequence

1. Install and configure `expo-sqlite`.
2. Add SQLite-backed encrypted local conversation/message storage.
3. Keep AsyncStorage fallback for compatibility and migration safety.
4. Preserve local encrypted outbox behavior.
5. Keep server idempotency and duplicate push suppression.
6. Add lightweight push-triggered chat hydration hooks after SQLite is stable.
7. Run mobile typecheck, backend typecheck, and native build preflight.

## Longer-Term Enterprise Upgrades

- Dedicated receipt event stream for delivered/read updates.
- Background task retry worker for longer app lifecycle windows.
- Batched media upload scheduling with per-chat concurrency limits.
- Local full-text search index for messages and files.
- Storage compaction and retention policies per tenant.

## Success Standard

Synzapp should not merely copy WhatsApp. It should provide WhatsApp-level responsiveness with stronger company controls: encrypted local persistence, auditable backend behavior, tenant-aware device trust, and reliable offline recovery.
