# Synzapp Interpreter Media Output and Versioned Summary Plan

## Goal
Make Interpreter speech playback behave like normal device media output and make spoken summaries belong to the active live interpretation version.

## Audio Output Architecture
- Treat interpreter speech, replay, summaries, and speaker previews as media playback, not call audio.
- Do not force playback through `react-native-incall-manager`; that API is for call routing and can fight Bluetooth, external speakers, and the OS media route.
- Keep recording/listening separate from playback:
  - Listening uses microphone-enabled audio mode.
  - Speaking and replay use media playback audio mode with earpiece routing disabled.
- Default output is the system media route, meaning the same route used by music and videos. If Bluetooth or an external speaker is connected, the OS should route there.
- Keep microphone selection independent from output selection. Input changes take effect on the next Listen action; output changes take effect on the next playback.

## Summary Versioning Architecture
- Every Listen action creates a live interpretation version.
- Summary creation uses only the currently selected version transcript, not the whole meeting by default.
- Backend stores `versionId` and `versionSequence` on each summary record.
- Summary UI groups saved summaries by version so managers can replay exactly what was summarized.
- Older summaries without version metadata remain visible under a meeting-level group for backward compatibility.

## Validation
- Type-check mobile and backend after changes.
- Confirm the backend request schema accepts version metadata.
- Confirm mobile summary creation sends the selected version metadata and transcript snapshot.
- Confirm interpreter playback no longer uses call-audio route forcing for spoken interpretation or summaries.
