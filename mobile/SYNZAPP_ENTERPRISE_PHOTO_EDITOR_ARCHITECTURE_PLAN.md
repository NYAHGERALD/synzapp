# Synzapp Enterprise Photo Editor Architecture Plan

## Problem

The current sent-photo editor has behaved like a fragile custom editor: opening the editor can close the app, iPhone camera photos can expose HEIC/rendering edge cases, and editor startup has depended too much on the chat screen state. That is not acceptable for an enterprise messaging app.

## Enterprise Direction

Synzapp should follow the same architecture pattern used by mature messaging products:

1. Preserve the original media record.
2. Keep a render-safe local preview ready for instant viewing.
3. Dismiss the media viewer first, then open the editor as its own top-level surface after the native transition.
4. Edit a local working copy or render-safe preview surface.
5. Export a new edited media record only when the user taps send.
6. Keep all heavy export/upload work outside the UI interaction path.
7. Contain editor failures so the chat and media viewer remain usable.

## Current Stabilization Implemented

1. The media viewer is dismissed before the photo editor opens so iOS does not stack two full-screen surfaces.
2. The editor chooses a render-safe display URI for iPhone camera photos and other formats.
3. Media dimensions are sanitized before being used for editor layout.
4. The editor is wrapped in a crash boundary so render failures produce a Synzapp error instead of closing the app.
5. The original sent media remains untouched; edited output is sent as a new media reply.
6. Pen strokes are now rendered as vector paths instead of hundreds of layout nodes, which is closer to a production editor render model and reduces UI-thread pressure.

## Production Editor Recommendation

For a full WhatsApp/Teams-grade photo editor, Synzapp should not keep expanding a custom JS-only editor forever. The production-grade path is:

1. Introduce a dedicated native image editor surface or vetted image-editor SDK.
2. Support crop, rotate, draw, text, stickers, emoji, undo, and export natively.
3. Use local cached image files for instant editor startup.
4. Export edited results as new encrypted media attachments.
5. Keep audit metadata: original message ID, edited media ID, editor version, sender, and timestamp.

## Researched Implementation Options

1. IMG.LY CreativeEditor SDK / PhotoEditor SDK
   - React Native support.
   - Purpose-built photo editing tools: crop, text, stickers, drawing, templates, export.
   - Better fit for a native-feeling enterprise editor than maintaining a custom JS canvas layer.

2. Pintura Image Editor
   - Strong crop, annotate, resize, filter, and mobile editor tooling.
   - React Native integration is WebView-based, which may be acceptable for simple editing but requires careful memory handling for large iPhone images.

3. Custom React Native editor
   - Acceptable only for a narrow MVP.
   - High maintenance risk for gestures, text editing, stickers, crop handles, HEIC, export quality, memory, and release-build stability.
   - Not recommended as Synzapp's long-term enterprise editor.

## Immediate Modal Ownership Rule

React Native/iOS full-screen modals should not be stacked for this workflow. The media viewer must dismiss first, then the editor opens after the native transition. This prevents the editor from appearing behind the viewer and avoids the confusing behavior where the editor only appears after the user presses Back.

## Acceptance Criteria

1. Tapping the pen icon opens the editor without closing the app.
2. Closing the editor returns to the media viewer or chat without freezing.
3. HEIC/HEIF/iPhone camera photos open through a render-safe path.
4. Failed editor startup shows a controlled Synzapp modal/error and keeps navigation usable.
5. Original media is never overwritten.
6. Edited media is queued, encrypted, and uploaded as a normal local-first message.
