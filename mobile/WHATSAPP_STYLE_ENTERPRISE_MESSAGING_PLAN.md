# WhatsApp-Style Enterprise Messaging Plan

## Goal

Make Synzapp messaging feel instant, durable, and trustworthy while keeping enterprise controls: encrypted payloads, device identity, auditability, idempotent backend writes, realtime delivery/read status, and offline recovery.

## Current Gap

Synzapp already has encrypted local cache, a pending outbox, realtime sockets, and delivery/read states. The issue is that sending still behaves too much like an online request:

- The UI creates a local bubble but marks it as sent too early.
- The send flow waits on device headers, encryption context, encryption, media upload, and network work inside the same user action.
- The backend accepts a `clientMessageId`, but the mobile sender does not use the outbox queue id as the stable idempotency key.
- Failed or offline sends are visible, but retry/reconciliation can feel heavy because network work is mixed with UI updates.

## Enterprise Architecture

### 1. Local-first send path

When the user taps Send:

- Create the local message immediately.
- Save it to an encrypted local outbox with `deliveryStatus: queued`.
- Clear the input immediately.
- Render the bubble immediately.
- Update the chat list preview immediately.
- Start a background outbox worker without blocking the UI.

### 2. Durable outbox worker

The worker:

- Reads pending messages by contact.
- Marks each item `sending`.
- Uploads media if needed.
- Encrypts the message for recipient and sender devices.
- Sends it to the backend with the outbox queue id as `clientMessageId`.
- Replaces the local queued id with the server envelope id after confirmation.
- Marks network failures as retryable and keeps the bubble visible.
- Removes invalid messages only for permanent authorization/device errors.

### 3. Backend idempotency

The backend should treat `(tenant, conversation/group, sender, clientMessageId)` as a stable send identity:

- If the same client id is retried after a network drop, return the existing envelope instead of creating a duplicate.
- Keep the original server timestamp and envelope id.
- Continue auditing successful sends, while duplicate retries remain safe.

### 4. Realtime delivery and read state

Realtime updates should keep bubbles current:

- Receiver opens or syncs message, backend marks delivered/read.
- Sender receives updated envelope status via existing contact/conversation realtime snapshots.
- Mobile merges server envelopes with local messages and updates `sent`, `delivered`, and `read` without requiring manual refresh.

### 5. Performance controls

- Keep UI state updates synchronous and small.
- Move encryption/network/media work out of the tap handler.
- Persist cache in the background.
- Keep a per-message active-send guard to avoid duplicate sends.
- Longer term: migrate encrypted chat storage from AsyncStorage JSON arrays to SQLite/WatermelonDB-style indexed storage for very large histories.

## Implementation Steps

1. Pass the outbox queue id through mobile encryption as `clientMessageId`.
2. Keep optimistic message status `queued` until backend confirmation.
3. Make the tap handler fire the outbox worker in the background.
4. Add backend direct-message idempotency lookup by sender and `clientMessageId`.
5. Add backend group-message idempotency lookup by sender and `clientMessageId`.
6. Preserve local retry behavior for network errors.
7. Verify TypeScript builds for mobile and backend.

## Result

The sender sees the bubble instantly, offline sends remain visible and retryable, backend writes are duplicate-safe, and delivery/read receipts can update in realtime as the other user receives or reads the message.
