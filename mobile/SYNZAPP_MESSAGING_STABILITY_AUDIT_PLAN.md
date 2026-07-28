# Synzapp Messaging Stability Audit Plan

## Goal
Make chat messaging, media sharing, offline state, and avatars stable before the next native build. The app must avoid UI freezes, disappearing media, blinking chat rows, missing avatars, and unstable pending/synced message reconciliation.

## Audit Areas
1. Message send queue and optimistic UI
   - Keep outgoing bubbles visible immediately.
   - Replace queued bubbles with synced server messages without duplicates or blinking.
   - Do not auto-retry hard media validation failures in a way that freezes the app later.

2. Media upload and download
   - Use chunked encrypted upload for large media.
   - Yield between expensive work so navigation and touches remain responsive.
   - Keep local thumbnails visible while upload and server reconciliation finish.
   - Keep failed media visible as failed instead of disappearing.

3. iPhone photo formats
   - Do not block send flow with HEIC/HEIF conversion.
   - Preserve iPhone camera photos as supported image attachments.
   - Use thumbnail/local URI immediately for the sender experience.

4. Offline-first behavior
   - Keep pending outgoing messages in the local outbox.
   - Keep cached conversations stable while live server data loads.
   - Avoid removing pending media unless the user intentionally deletes it.

5. Profile pictures
   - Cache avatars locally for offline use.
   - Preserve existing remote or cached URLs when a cache attempt fails.
   - Bound avatar cache concurrency to avoid UI stalls on large contact/group lists.

## Fixes Applied In This Pass
- Preserve contact and member profile photo URLs when local avatar caching fails.
- Bound profile photo cache work instead of starting every avatar download/manipulation at once.
- Add explicit UI yields between multi-media upload items.
- Keep hard failed media sends visible as failed instead of removing the bubble.
- Ensure chunked encrypted media is accepted by message encryption and download logic.

## Validation
- Run TypeScript typecheck.
- Run native build preflight.
- Review git diff for accidental generated native files or unrelated changes.
