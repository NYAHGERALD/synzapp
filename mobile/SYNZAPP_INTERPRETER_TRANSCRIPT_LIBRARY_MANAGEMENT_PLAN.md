# Synzapp Interpreter Saved Transcript Library Management Plan

## Purpose
Saved transcripts are a separate read/review workflow beside the controlled GPT Live interpreter room. This feature must never alter the working Listen -> Respond -> Listen live control loop.

## Non-Negotiable Guardrails
- Do not route saved transcript playback, deletion, filtering, or audio preparation through the GPT Live WebRTC session.
- Keep the live interpreter session responsive while saved transcript work is loading, filtering, deleting, or preparing read-aloud audio.
- Prepared read-aloud audio is a backend artifact keyed by transcript text fingerprint, language, and voice. If an artifact already exists, reuse it instead of generating a duplicate.
- Mobile JavaScript must not be relied on for long-running background work after the app is minimized or killed. Long-running transcript audio preparation belongs on the backend.
- Deleting saved transcripts must be tenant-scoped, permission checked, audited, and must remove related saved audio artifacts.

## User Experience
1. The Saved Transcripts screen has a native-feeling header:
   - Back button at the top left.
   - Options button at the top right.
2. Options:
   - `Delete transcripts` enters selection mode.
   - `Filter transcripts` opens native filter choices.
3. Delete mode:
   - Every visible transcript row shows a modern accessible checkbox.
   - A Select All checkbox appears below the header.
   - A Delete button appears beside Select All only after one or more transcripts are selected.
   - Delete uses a native alert confirmation before calling the backend.
4. Filter mode:
   - All transcripts.
   - Ready read-aloud audio.
   - Preparing read-aloud audio.
   - Needs read-aloud audio.
5. Empty states must be clear without implying an app error.

## Backend Contract
- `DELETE /api/interpreter/meetings/:meetingId/transcripts`
  - Body: `{ "segmentIds": string[] }`
  - Max 50 transcript IDs per request.
  - Verifies the meeting belongs to the same tenant and is accessible to the caller.
  - Deletes transcript records, nested audio artifact records, and audio files from storage.
  - Writes one audit event with the deleted transcript IDs and audio artifact count.

## Implementation Notes
- The transcript-library badge must count only saved cleaned transcript records.
- Filtering is local after the server returns the current saved library.
- Backend audio preparation remains idempotent through the existing `artifactId = segmentId + language + voice + textFingerprint` strategy.
- This implementation intentionally avoids installing a new native dependency; checkboxes are accessible native Pressables styled consistently with the app and exposed with `accessibilityRole="checkbox"`.

## Verification
- Mobile TypeScript typecheck must pass.
- Backend TypeScript build must pass.
- Backend must be deployed after the delete endpoint is added.
- Manual validation on iPhone:
  - Saved transcript icon opens the screen.
  - Badge is zero when no cleaned transcripts exist.
  - Delete mode shows checkboxes and Select All.
  - Confirmed deletion removes selected transcripts and updates the badge.
  - Filter choices do not interrupt the live room.
