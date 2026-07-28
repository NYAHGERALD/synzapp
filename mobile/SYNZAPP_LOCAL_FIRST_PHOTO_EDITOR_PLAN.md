# Synzapp Local-First Photo Editor Plan

## Purpose

Synzapp photo editing must behave like a serious enterprise chat product: the editor opens immediately from local media, the original message media remains immutable, and edits are exported only when the user explicitly sends an edited copy.

## Problems Being Corrected

- The previous editor path prepared or converted the image before opening the editor.
- The editor depended on WebView/base64 image decoding, which can open blank or stall on mobile.
- The original media path was being treated like an editable source instead of an immutable audit record.
- Export work happened too close to the open flow, making the app feel slow compared with Teams, WhatsApp, and iMessage.

## Enterprise Flow

1. User opens a sent photo preview.
2. User taps the pen icon.
3. Synzapp opens the editor immediately from the already local photo or cached preview.
4. The original sent photo is never changed.
5. User adds non-destructive overlay objects:
   - pen strokes
   - text
   - stickers or emojis
   - crop frame
6. When the user taps send, Synzapp captures the edited composition as a new local media file.
7. The edited copy is queued through the same offline-first encrypted media pipeline.
8. The user returns to chat immediately while upload continues in the existing queue.

## Implementation Rules

- Do not convert the original just to open the editor.
- Do not use WebView/base64 as the editor rendering engine.
- Use native React Native image rendering so HEIC/HEIF photos displayed by the app can also appear in the editor.
- Use a native overlay layer for marks and text.
- Use a native capture/export step only after the user taps send.
- Keep export errors in the existing friendly modal style.
- Keep UI interactions local and responsive.

## Validation

- TypeScript must pass.
- Native build preflight must pass.
- Manual device verification is required after a native rebuild because this change adds native editor export dependencies.
