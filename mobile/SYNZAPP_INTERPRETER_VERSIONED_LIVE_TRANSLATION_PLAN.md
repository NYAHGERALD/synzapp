# Synzapp Interpreter Versioned Live Translation Plan

## Goal

Make live interpreter sessions behave like controlled enterprise interpreting, not summarization. Each time the user taps `Listen`, Synzapp creates a system-managed live version. That version captures the spoken turn, prepares sentence-sized interpretation audio for every selected response language, and lets users replay that same version in any selected language.

## Enterprise Flow

1. User opens an interpreter meeting.
2. User taps `Listen`.
3. Synzapp creates the next live version automatically, starts realtime listening, and captures transcript text.
4. While the AI listens, Synzapp prepares short sentence-level interpretation audio for each selected response language.
5. User taps `Stop` or taps a language.
6. Listening stops for that version, but the transcript, translations, and prepared audio stay available in the room.
7. Tapping a language always plays that selected version from the beginning in that language.
8. Tapping `Listen` again creates the next version. New speech and translations are isolated under that version.
9. The user can select an earlier version and replay its translation in any prepared language.
10. Ending the session closes live realtime audio and returns the user to the interpreter list.

## Required Changes

- Replace the old `Current` and `Continue` interruption model with automatic versioning.
- Stop using one global room buffer for all speech.
- Store live audio buffers by version and language.
- Keep language buttons replayable after one playback.
- Keep `Stop` separate from `Listen`.
- Make segment audio translation faithful, natural, and complete without becoming a summary.
- Remove automatic intros from live segment playback so consecutive segments feel continuous.
- Keep Summary as the only summary generator.

## Version Model

Each live version stores:

- `versionId`
- `sequence`
- `createdAtIso`
- `endedAtIso`
- `status`
- `selectedLanguageCode`
- `sourceTranscript`
- `translationsByLanguage`
- `bufferedAudioByLanguage`
- `bufferedCursorByLanguage`

The app keeps versions in memory while the live room is open. Saved summaries remain permanent through the backend summary service.

## Translation Rules

Realtime interpretation audio must:

- Translate the speaker's meaning faithfully.
- Preserve names, numbers, dates, instructions, risk statements, decisions, and sequence.
- Correct obvious grammar and vocabulary mistakes naturally.
- Avoid word-for-word robotic phrasing.
- Avoid summarizing, shortening, explaining, or adding conclusions.
- Avoid repeated intro phrases during live segment playback.

## UI Rules

- Show a compact version rail, such as `V1`, `V2`, `V3`, with active and ready states.
- Show `Listen` when idle or after playback.
- Show `Stop` while listening.
- Language buttons replay the selected version and should not get permanently disabled after one playback.
- The player remains visible while speaking or when a replay exists.
- Transcript scrolling stays inside the transcript area.

## Backend Rules

- Segment audio endpoint may accept optional version metadata for audit and later storage evolution.
- Segment translation prompt must be translation-first, not summary-first.
- Live segment speech should not include an intro unless explicitly requested.
- Summary endpoint remains the only summary generator.

## Verification

- Run mobile typecheck.
- Run backend typecheck.
- Run backend build.
- Manually test `Listen -> Stop -> language replay -> Listen again -> previous version replay -> End`.
