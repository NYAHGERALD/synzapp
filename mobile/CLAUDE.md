# Synzapp mobile app

## Read before changing any screen

The house style is [SYNZAPP_APP_STYLE.md](../SYNZAPP_APP_STYLE.md) at the repo
root. It is not a suggestion. Every UI change is checked against it.

### Rule 0, the one broken most often

**The entire background is `colors.groupedBackground`.** Headers, footers, page
bodies, blank space, all of it. Light `#F2F2F6`, dark `#000000`.

**The only white surfaces are:**
- cards with rounded corners (`colors.groupedCard`, light `#FFFFFF`, dark `#1C1C1E`)
- the floating footer navigation bar

A white page with a grey panel sitting on it is this rule upside down. That has
shipped once already. If a surface is not a rounded card, it is not white.

**Exception: continuous lists.** The chat list, the departments and roles list,
and the groups list are one continuous list rather than a stack of cards. Their
rows share the page colour and a 1px `separator` divider separates one from the
next. Do not put those rows in cards and do not paint them white.

Rows carry 15 of horizontal padding, and **the divider starts where the text
starts**, past the avatar or icon, never at the screen edge. A border on the row
itself spans the row's whole width and cannot be inset, so draw the line as its
own element: between rows in a mapped list, or absolutely along the bottom of a
row that has to stay a single Pressable.

### The rest, in short

- **Cards sit exactly 15 from the screen edge.** One number, everywhere, in
  sheets and in tabs. Section labels above a card use `marginLeft: 15` so they
  line up with it. Row padding *inside* a card stays 16
- **How the horizontal space is built.** `coreStyles.screen` has **no**
  horizontal padding. Each thing inside it states what it needs:
  `topActions` and `title` 15, `tabContent` 10, `fixedTabSurface` 10,
  `messageListContent` 10, `noticeWrap` 15, and Settings opts out with
  `groupedTabContent` (0) because its cards already carry 15
- **Never use a negative margin to cancel page padding.** A `contentContainer`
  is exactly as wide as the scroll view, so a negative margin makes the content
  wider than the screen and pushes it off both edges rather than moving it.
  That was shipped once and had to be undone
- **No bold anywhere a person reads.** Regular weight (`400`) only — no `500`,
  `600`, `700` or `800` on a title, a label, a name or a value. Emphasis comes
  from colour, size, spacing and an icon, never from weight. A screen with four
  bold things has nothing emphasised at all
- Cards: 22px corners, **no shadows**
- **Three things cast a shadow, and nothing else ever does:** the round icon
  button, the search field and the chat header. All three are `groupedCard`
  white and float above whatever they sit on
- **The search field is `ChatSearchBar`, and it takes no appearance props.**
  Card white, a **blue outline** (`colors.link`, 1.5) and a soft shadow, on
  every screen that searches. Nothing shares its row: a view toggle or a
  refresh belongs in the header, because a search box somebody cannot type a
  whole word into is one nobody uses
- Dividers: 1px `colors.separator`, inset **16 on both sides**, never touching
  a card edge. A border on a row cannot be inset; let the card draw the rule
- **Rows inside a card have 16 of horizontal padding.** No text, value, icon or
  action ever touches a card edge. A row with no padding is the most common
  version of this mistake
- An icon slot with no icon still takes its width, leaving a row indented for
  something that is not there. Give the row a real icon or render no slot
- **Destructive actions are `colors.destructive`, never `colors.link`.** Delete
  is red even when every other action on the screen is blue
- **Do not hide the only way to delete behind a swipe.** A gesture with nothing
  on screen to suggest it is a feature nobody finds. Offer selection from the
  header menu, tick the rows, and confirm from a floating bar
- **Editing and selecting are separate modes.** While selecting, every field is
  read-only and the whole row toggles the tick, so the keyboard cannot open.
  Prevent the clash rather than reacting to it; a selection that vanishes on
  its own because a keyboard appeared is work the person silently lost. Keep
  the reactive exit as a safety net only
- Buttons: tinted text rows in a card, never large filled slabs. `colors.link`,
  light `#0079FE`, dark `#0A84FF`
- **This includes small ones and round ones.** A filled square with a `+`, and a
  floating action button, are both filled buttons. Use the word, in
  `colors.link`: "Add", "Save", "Remove". The brand green is never a button
  background
- **A screen's one action goes in its header**, as blue text beside the round
  back button. Not floating over the content
- **The heading is on its own row, below the controls.** 26pt, regular, left
  aligned, 15 from the edge. Never centred between the buttons: it shrinks to
  fit them and reads as a toolbar label rather than the page's name. A bottom
  sheet is the exception — its title is centred between close and action
- **Check what is painted *behind* a card.** A swipe wrapper, a shell or a
  parent that fills its width with a colour will hide the card's margin and
  corners completely, and the card will look edge to edge no matter what its
  own style says. This has happened once, on key results
- Close, Back, Next: `CircleIconButton` only. Never a word, never `‹` or `×`
- Switches: `AppSwitch` only. On `#36C75A`, off `#C5C5C7`. Never brand-tinted
- **A setting is a switch. Never a checkbox, never a radio button.** Two
  choices that exclude each other become two switches that are always opposite,
  so turning either off turns the other on and no gesture can leave the setting
  with no answer
- **There are no checkboxes anywhere, for anything.** A chosen row carries a
  bare tick in `colors.link`; an unchosen row carries nothing. **The tick goes
  at the end of the row**, never the start — a mark of what is chosen belongs
  after the thing it marks. Keep its slot at its width so rows do not jump
  sideways one at a time. **Select all is a blue text link**, not a box with a
  label, and it reads "Clear selection" once everything is ticked
- **A date is chosen with the platform's own picker** — `DateTimePickerAndroid`
  on Android, `ScheduleDateTimePickerModal` on iOS. Never a hand-built wheel or
  grid. The row that opens it shows the chosen date as its value and opens the
  picker on the first tap
- **A flag stands for a region, never for a language.** `getLanguageFlagEmoji`
  reads the region out of the code (`es-MX` → Mexico) and answers nothing when
  the code names no country, where a globe is drawn instead. Never guess a
  country for a language spoken across borders
- Never a raw hex in a component. Always a token from `src/theme/colors.ts`
- **A `presentationStyle="pageSheet"` modal is full screen on Android**, so its
  header sits under the status bar unless it adds `insets.top`. iOS insets the
  sheet itself and reports `insets.top` as 0, so the same padding is right on
  both. Every full-height sheet needs it
- **A `Modal` is not covered by the app root's `SafeAreaView`** — it is its own
  window, so `resolveScreenBottomInset` is the wrong helper inside one. On
  Android a Modal reports **no safe area at all** (`insets.bottom` is 0 even
  with a navigation bar), so it needs the measured fallback; on iOS it needs
  the real inset. Both mistakes have shipped
- **A bottom sheet is capped, and what is capped scrolls.** A sheet sized by
  its content grows until it covers the status bar — one extra row put a close
  button behind the clock. Cap it at 92% *and* put the body in a `ScrollView`;
  a cap with no scroll just makes the last rows unreachable

### Building blocks, use them rather than restyling by hand

- `src/components/ui/GroupedList.tsx`: `ListSection`, `ListRow`, `ListNavRow`,
  `ListActionRow`, `ListSwitchRow`, `ListTextRow`
- `src/components/ui/CircleIconButton.tsx`
- `src/components/ui/AppSwitch.tsx`

### Resolving a face is not free

`getCachedProfilePhotoUri` costs three native round trips **per person, even on
a cache hit**: a disk stat, a SQLite write and a Keychain read through
`SecureStore`. The Keychain one goes through `securityd` on iOS and is far
slower there than its Android equivalent.

Screens re-resolve every face each time they open, and await all of them before
drawing anything, so a company of fifty cost a hundred and fifty native calls
per visit. That is what made the app feel like it lagged a beat behind the tap.

A session memo in `src/services/profilePhotoMemo.ts` now answers a repeat
without touching the platform. **Do not add work to the cache hit path**, and if
a screen needs faces, let it draw first rather than awaiting them all.

### Never run JavaScript crypto over anything media-sized

The single JS thread answers taps. A `nacl.secretbox` over a payload cannot be
interrupted, so its size **is** the freeze duration. Three of these shipped:

- Thumbnails were sealed into the message payload, so every save re-encrypted
  them and every chat open decrypted them all. A thread with three videos took
  **1566ms** to persist three envelopes; the same three with no video took
  **10ms**. The thumbnail was already stored in the clear in its own column.
- The media row sealed a second copy of the attachment, thumbnail included,
  beside that same column. Same mistake, second place, on the hottest write.
- Native media encryption was gated at 8 MB, so photos and transcoded videos —
  the entire common case — went through the JavaScript path instead.

Payloads stay small: `stripThumbnailsForPayload` and `stripMediaThumbnail` on
the way in, the column on the way out. Anything above a quarter of a megabyte is
encrypted natively.

**Before adding anything to a stored payload, ask how big it gets.** Kilobytes
of base64 in a row that is written on every progress tick is the shape of this
bug.

### A refresh must not drop a message that is still being sent

`reconcileChatThread` takes membership from the caller, so a message left out
has been removed. That cannot be true of one whose `deliveryStatus` is still
`queued`: the server has never seen it, so a cache rebuild or a snapshot simply
does not know about it yet.

Dropping those made a video bubble appear the moment it was recorded, vanish
when the next refresh landed, and come back once the send finished. Queued
messages are now carried through. Everything else still obeys the caller, so
deletes and clears keep working.

### Deleting a chat is scoped to an account, and actions are company records

Those two facts collide. `clearedAt` records the moment a person deleted a chat;
nothing is destroyed. Actions live in their own store, keyed by `sourceChatId`,
because a record anybody can erase by deleting a chat is worthless and the
console and the auditor's export read from it.

So a re-opened chat used to fill straight back up with action bubbles, each
quoting the message it was raised from. **Anything drawn into a thread from
another store must honour `clearedAt`** — see `filterActionsAfterChatCleared`.
Filter the view; never delete the record.

### Never let the main thread into the transcode loop

`SurfaceTexture.setOnFrameAvailableListener(listener)` with no handler delivers
on the thread that created the texture **if it has a Looper, and on the main
thread otherwise**. Transcoding runs on a plain background thread, which has
none, so every decoded frame was announced through the thread React Native draws
on, and the transcode waited on it before drawing.

Measured on a Galaxy S23 FE: **38 seconds to compress 26 seconds of video**, from
Qualcomm hardware codecs that should manage many times real time. Always pass a
`Handler` on a `HandlerThread` of its own.

The codecs were checked first and were hardware (`c2.qti.avc.*`), not the
`c2.android.*` software fallback. Check that before blaming the pipeline, and
check the pipeline before blaming the codecs.

### Pin the Android decoder's rotation, never assume it

`MediaExtractor` puts `KEY_ROTATION` in the track format, and Android's own
documentation says a video decoder **may or may not** honour it. Identical code
and an identical file give upright frames on one handset and stored-orientation
frames on the next. Whichever the pipeline is written for, the other half of
devices comes out sideways — which is why this looked fixed twice and was not.

`sourceFormat.setInteger(MediaFormat.KEY_ROTATION, 0)` before
`decoder.configure` settles it on every device: frames always arrive in the
stored orientation, and the muxer's orientation hint is the single place that
says how to display them.

iOS never had this: `AVAssetExportSession` owns the whole pipeline, so the
question never arises. **A bug on one platform and not the other, in code that
looks symmetrical, usually means one platform is deciding something for you.**

### Carry a video's rotation on the container, never in the pixels

The Android transcoder used to turn frames upright in its GL pass and set
`setOrientationHint(0)`. That fights the decoder: where the SurfaceTexture
transform already carries the rotation, the frame is turned **twice**, and the
sent video plays on its side while the original still sitting in the outbox
plays correctly. "Right while queued, wrong once sent" is the signature.

Encode in the orientation the frames are stored in and pass the source rotation
to `setOrientationHint`, the way the camera wrote the original. Every player
honours it, and it does not depend on the decoder behaving identically
everywhere.

**Videos are transcoded on the upload path too**, in
`compressChatVideoForUpload`, not only in the preparation queue. Camera
recordings only ever hit that one.

### The two platforms disagree about who turns a video poster upright

A phone records "portrait" video as a **landscape raster plus a rotation flag**.

- **iOS** sets `appliesPreferredTrackTransform`, so the poster arrives upright.
- **Android** uses `MediaMetadataRetriever.getFrameAtTime`, which returns the
  frame exactly as stored and never reads the flag. A portrait recording gives a
  poster lying on its side.

Ask `resolvePosterRotationDegrees` and turn it before resizing. **It compares
the poster's shape with the video's before turning anything**, because
`getFrameAtTime` applies the rotation on some devices and not others — the same
split `KEY_ROTATION` causes one layer down. Trusting the flag alone fixes the
phones that ignore it and breaks the phones that honour it. That mistake was
made twice, once in each layer.

This reads as a **playback** bug and is not one. The poster covers the player
whenever the video is paused, `opacity: 0` only while it is actually running, so
a video that plays perfectly looks wrong at 0:00 and again on every pause. Two
rounds went into the native encoders looking for a rotation bug that was never
there. Check the still before suspecting the pixels.

`expo-image-picker` reports the flag as `rotation` on Android and is not in its
published types, so read it defensively.

### A video's poster is framed like the video

The still shown over a paused video stands in for it, so its `resizeMode` must
match the player's `contentFit`. Both are `contain`.

On `cover` a landscape still in a tall stage is scaled up until it covers and
cropped to a narrow strip, so a video looked hugely zoomed and stretched **before
it was played** — the complaint reads as a playback bug but the player has not
started. Small square strip thumbnails are the exception; `cover` is right there.

### Never point an `Image` at a video file

A video has no image of its own. An `Image` given an mp4 draws nothing and, on
iOS, usually reports no error either, so a "try the file, fall back to the
poster on error" arrangement never recovers and the tile stays empty for good.
That is what left every video bubble blank.

Use `resolveBubbleMediaUri`. For a video the poster is the only candidate, never
a fallback tried after the file. For a photo it is the other way round.

### A video's poster has to exist before the message is sent

The still frame shown in a video bubble travels **inside the message**, beside
the encrypted file rather than in it. That is what lets the other side see
something before downloading tens of megabytes, and lets both sides see it
offline.

So it must be attached **before encryption**. A poster generated afterwards is
one only the sender will ever have: it updates the local copy and the local
database, and the recipient's bubble stays empty. That shipped once, as a
fire-and-forget call in the preparation queue, and it is why videos recorded on
the phone arrived blank while videos from the library were fine — the library
picker attaches a poster at pick time and the camera path does not.

**Nothing on the picking path may hold the bubble back.** A send that does not
appear the instant it is tapped reads as broken, however good the reason. The
poster gets a deadline there (`settleWithinTimeLimit`); past it the bubble goes
up without one and the upload path attaches it before encryption.

**The poster is taken when the attachment is built**, in `prepareVideoMedia`,
the way WhatsApp and Signal do it: one frame, on the sender, before the message
exists. Not as a later enrichment.

That matters because **the preparation queue cannot be relied on to run.** Entry
to it requires `nativeAssetIdentifier`, which only the native *library* picker
supplies. Nothing recorded on the camera has one, so a recorded video skips the
queue entirely — no transcode, and for a long time no poster, which is why
library videos had thumbnails and recorded ones never did. Anything that must
happen to every attachment cannot live in that queue.

`attachChatMediaPoster` in `src/services/chatMediaPosterQueue.ts` stays as a net
on the upload path, for videos queued by an older build. It costs nothing for
photos or for a video that already has a poster.

### Images that blink

An `Image` `source` built inline is a **new object on every render**, and
Android treats a new source as a new image to fetch. The picture reloads and
whatever sits behind it, initials or a placeholder, flashes through.

- Memoise the `source`, keyed on the **values** it contains (the uri, the auth
  token), never on the header object itself
- Memoise the headers object where it is created, or every avatar downstream
  gets a new source anyway
- Wrap avatar components in `React.memo`, especially inside a message list
  where they re-render on every scroll and every new message

This was the cause of faces blinking in chat. It is not a caching problem and
no amount of offline-first storage fixes it.

### The keyboard

**Do not use React Native's `KeyboardAvoidingView`.** The app targets SDK 36 and
Android 16 enforces edge to edge, which disables `adjustResize`: the window is
never padded for the keyboard and its height never changes. Measured on a
device, it stayed at 832 with the keyboard open. `KeyboardAvoidingView` sizes
itself from that frame, so every mode fails: `height` and `padding` both leave a
band behind, and removing it leaves the field covered.

Use `react-native-keyboard-controller`, which reads the real IME inset.
`KeyboardProvider` wraps the app in `App.tsx`; the message thread's root is its
`KeyboardAvoidingView` with `behavior="padding"`. Keep
`softwareKeyboardLayoutMode` on `resize`: `pan` moves the whole window and
fights it.

**It needs `keyboardVerticalOffset` on iOS.** The library measures its own
frame with `onLayout`, which is **parent-relative**, then compares it against an
absolute screen height. That only balances when its parent sits at the top of
the window. The thread's parent does not: the app root's `SafeAreaView` pads the
tree down by the top inset three levels up, where `onLayout` cannot see it, so
the thread lifts the composer short by exactly that much and the keyboard covers
it. Android needs 0, because `SafeAreaView` pads nothing there and the top
padding that exists is on the thread's own parent, so it *is* measured.

Ask `resolveKeyboardVerticalOffset` in `src/services/rootSafeArea.ts`.

React Native's own `KeyboardAvoidingView` measures in window coordinates
instead, so the search footer's `keyboardVerticalOffset={0}` is correct and must
not be "fixed" to match.

**There is no `babel.config.js` and there must not be one.** Expo applies its own
preset, and adding a config pulled in the wrong `babel-preset-expo` major, which
left private class fields that Hermes cannot compile. The build failed with
"private properties are not supported".

### Adding a native module means `pod install`

Android's Gradle autolinks on every build. **CocoaPods does not.** It only knows
what was there the last time `pod install` ran, so an iOS build after adding a
native dependency ships JavaScript that calls native code the binary does not
contain. The app launches and closes immediately, with no JavaScript error to
find, because it dies before JavaScript gets that far.

`scripts/install-ios-release-device.sh` now runs it first. If a fresh iOS build
dies on launch, check `ios/Podfile.lock` against `package.json` before anything
else.

### The bottom safe area is consumed once

React Native's `SafeAreaView` at the app root pads on **iOS** and does nothing
at all on **Android**. So a screen must add the bottom inset on Android and
must **not** add it on iOS, where the root already did.

Ask `resolveScreenBottomInset` in `src/services/rootSafeArea.ts`. Never
read `insets.bottom` directly for anything that sits against the bottom of the
screen.

Reading it directly is why the iPhone composer had an empty band under it while
Android looked right: 34 from the root, then another 38 from the composer. The
footer bar escaped the same bug only because it clamps its offset to 6.

### Android insets

The activity is `windowSoftInputMode="adjustResize"`, so **the window height
shrinks by the whole keyboard** when one opens. Anything derived from
`Dimensions.get('screen').height - windowHeight` therefore measures the
keyboard, not the navigation bar, and pushes the tab bar and the composer
hundreds of points up the screen. It stayed wrong until the app restarted,
because the window height does not always report its way back.

Use `resolveAndroidNavigationInset` in `src/services/androidNavigationInset.ts`.
The safe area wins outright when it reports anything; the measurement is only a
fallback, is taken from the **tallest window ever seen**, and is clamped to 64.
Never reintroduce a raw screen-minus-window subtraction on the live height.

**And never put `paddingBottom` on a view that positions the tab bar.** An
absolutely positioned child is placed against its parent's padding edge, so
padding on the page lifts the floating bar off the bottom of the screen by that
much. Space for a list to scroll under the bar belongs on the list's
`contentContainerStyle`, never on the page.

### Two traps already hit

**Removing a border from a card that had no background** makes the card
disappear into the page. Check what is holding a surface together before taking
a property away.

**Pure logic in a file that imports `react-native`** cannot be tested. Wording,
colours and rules go in a service module with no native import; the component
only renders them.

### Floating things and the keyboard

- **Anything that floats must be rendered outside the scroll view.** A bar
  inside a `ScrollView` scrolls away with the content however it is positioned.
  Render it as a sibling of the scroll, absolutely positioned against the screen
- A floating bar sits **directly on the keyboard** when one is open, using the
  measured `endCoordinates.height`. A fixed offset leaves a strip of dead space
  that makes the screen look broken
- **Never reserve space for a bar that is not showing.** The tab bar's 98pt is
  held only when the tab bar is actually there; holding it while the keyboard
  is up, or on a back-button screen, is where phantom gaps come from
- **A screen with a back button never shows the tab bar.** One way out, not two
- The floating action bar is the second thing allowed a shadow, after the round
  icon button, because it has to read as sitting above the page it covers

## Off limits

RAILS, LSW, RCA and the interpreter are working, shipped features. Do not edit
them. See section 3 of [SYNZAPP_CREATE_ACTION_PLAN.md](../SYNZAPP_CREATE_ACTION_PLAN.md).

## Checks before saying something is done

```bash
npx tsc --noEmit -p .
npx vitest run
bash scripts/install-android-release-device.sh
```
