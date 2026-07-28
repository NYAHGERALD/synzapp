# Synzapp Sent Photo Editor Plan

## Goal
Add a WhatsApp-style editor for photos already visible in chat without mutating the original message. A sent photo opens in the existing media previewer, the edit icon opens a full-screen editor, and the user can send an edited copy back into the same conversation through the normal encrypted media pipeline.

## Enterprise Behavior
- Preserve the original sent media record for audit integrity.
- Generate an edited copy only when the user taps Send from the editor.
- Send the edited copy through the existing local-first queue, encryption, upload, delivery, and retry flow.
- Keep the editor isolated so drawing, crop, text, and emoji interaction does not block the chat thread.
- Avoid adding new native dependencies before the next build by using the installed WebView runtime as the canvas editor surface.

## Editor Scope
- Crop with an adjustable crop rectangle.
- Pen drawing with color and size controls.
- Text annotations with editable placed text.
- Emoji/sticker placement using a curated emoji row.
- Undo support for added edits.
- Caption input before sending.
- Photo-only edit entry point from the media previewer.

## Safety
- Do not edit videos through this flow.
- Do not overwrite original sent media.
- Do not bypass chat device readiness checks.
- Do not use AI or cloud editing services.
- Export a bounded JPEG image from the editor to control memory and upload size.

## Validation
- Run TypeScript typecheck.
- Run native build preflight.
- Confirm the edited photo uses the existing media queue and appears immediately as a local outgoing bubble.
