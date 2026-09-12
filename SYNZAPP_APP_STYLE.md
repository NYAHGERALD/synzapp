# Synzapp app style

The house style for every screen, sheet and modal in the mobile app. Agreed
5 September 2026 after the Create Action sheets. If a screen and this document
disagree, the screen is wrong.

The point is that a person moving between the chat, the settings and an action
is looking at one app, not three.

---

## 0. The rule broken most often

**The entire background is `groupedBackground`.** Headers, footers, page bodies,
blank space, all of it.

**The only white surfaces are:**

- cards with rounded corners
- the floating footer navigation bar

Light: background `#F2F2F6`, cards `#FFFFFF`.
Dark: background `#000000`, cards `#1C1C1E`.

A white page with a grey panel sitting on it is this rule applied upside down.
That has shipped once already. If a surface is not a rounded card, it is not
white.

**Exception: the chat list.** A conversation list is one continuous list, not a
stack of cards. Its rows share the page colour and a 1px `separator` divider
separates one conversation from the next. Cards would make each conversation
look like a separate object, when the point of the screen is the sequence.

This is repeated at the top of `mobile/src/theme/colors.ts` and in
`mobile/CLAUDE.md`, so it is in front of whoever is about to change a screen.

## 1. Colour

Never a raw hex value in a component. Every colour is a token from
`mobile/src/theme/colors.ts`, so light and dark both work from one set of rules.

| Token | Light | Dark | Used for |
| --- | --- | --- | --- |
| `groupedBackground` | `#F2F2F6` | `#000000` | The ground a card list sits on |
| `groupedCard` | `#FFFFFF` | `#1C1C1E` | Cards on that ground |
| `separator` | `#DCDCE0` | `#2C2C2E` | Hairline between rows in a card |
| `link` | `#0079FE` | `#0A84FF` | Text that acts as a button |
| `ink` | | | Primary text |
| `muted` | | | Secondary text, values, footnotes |
| `destructive` | | | Anything that deletes or cannot be undone |

`primary` is the brand teal. It stays the brand accent. It is **not** the colour
of a link.

A card must stay clearly lighter than the ground in both themes. This is why
dark has its own pair rather than reusing `card` and `surface`, which are
almost the same shade of near-black.

## 2. Layout

Cards on a tinted ground. No shadows anywhere, with exactly one exception noted
in section 4. Depth comes from the card being lighter than the page, which is
what the platform does.

- Card corner radius: **22**
- Card inset from the screen edge: **15**, in sheets and in tabs alike
- Section label above a card: `marginLeft: 15`, so it lines up with the card
- Row padding **inside** a card: **16**. Different number, different job
- **Watch for double padding.** `coreStyles.screen` carries
  `paddingHorizontal: 10` for tabs whose rows have none of their own, so a card
  inside a tab would land at 25. The settings tab cancels it with
  `styles.groupedTabContent`. Cancel the page padding that way; never shrink a
  card's own margin to compensate

  **Every card says `marginHorizontal: 15`, everywhere, with no arithmetic.**
  A card written as `5` because its parent happens to pay `10` is right until
  somebody changes the parent, and then every card on that screen moves and
  nothing says why. If a surface pays horizontal padding and holds cards, set
  that padding to `0` and let the header, the search field and the cards each
  state their own 15 — as `workspaceScreen` does on the interpreter list
- Row padding inside a card: **16** horizontal
- Divider: **1px**, `separator`, inset **16 on both sides** so it never touches
  the card edge
- Section title above a card: 13pt, `muted`, 16 from the left
- Section footnote below a card: 12.5pt, `muted`, explains the rule above it

Build these with `mobile/src/components/ui/GroupedList.tsx`, never by hand:

| Component | For |
| --- | --- |
| `ListSection` | A card, with optional title and footnote |
| `ListRow` | Label left, value right |
| `ListNavRow` | Icon, title, subtitle, chevron. Opens something |
| `ListActionRow` | An action, as tinted text |
| `ListTextRow` | Free text, history, an input |

## 3. Type

**No bold. Anywhere a person reads.**

Regular weight (`400`) throughout: titles, section labels, names in a list,
values in a settings row. No `500`, no `600`, no `700`, no `800`.

Weight is not how this app separates things. **Colour, size, spacing and an
icon** are, and they carry more meaning: a heading is a heading because it is
quiet grey above a card, not because it shouts. A screen where four things are
bold has nothing emphasised at all.

A number or a word that must stand out takes `colors.link`, `colors.amber` or
`colors.destructive` — never extra weight.

## 4. Buttons

**No large filled buttons.** An action is a row of tinted text inside a card.
Three filled slabs on one screen shout at somebody who only wanted to read.

The one exception is a control that moves a flow forward, which may be a filled
circle. There is at most one per screen.

Destructive actions use `destructive`, and are never the only thing in a card
with a harmless action.

## 5. Close, Back and Next

**Never a word. Never a typed character like `‹` or `×`.**

Use `mobile/src/components/ui/CircleIconButton.tsx`:

| Action | Icon |
| --- | --- |
| `back` | `chevron-left` |
| `close` | `x` |
| `next` | `chevron-right` |

- 44 point circle in `groupedCard` white, 23 point icon, `hitSlop` of 8 so a
  near miss still counts
- **One of the three things allowed a shadow**, with the search field and the
  chat header. It floats above whatever it sits on, because it has to be
  findable over a photo, a list or a card without changing colour to suit each
  one. Nothing outside those three gets one
- `tone="plain"` by default; `tone="accent"` fills it for the forward control
- `CircleIconSpacer` balances the other side so a title stays centred

A word has to be read and translated. A chevron is understood at a glance,
which matters when the person holding the phone is wearing gloves.

### The options button is the same circle

A screen's `•••` or menu button takes the identical treatment: **44 across,
`groupedCard` white, and the same shadow** — offset 2, opacity 0.16, radius 6,
elevation 4. It is a round icon button like the others and belongs to the same
family, so it is built the same way and never as a flat tinted disc.

It needs the shadow for the same reason the back button does: it sits over a
list that scrolls, and a disc with no lift disappears the moment something pale
passes beneath it.

**Where it goes:** opposite the screen's action. Where a screen has a back
button on the left, the options button is on the right; where a screen has no
back button, the options go left and the action right — as Calls and Notices
do. Two controls crowded into one corner read as one control with a spare
part.

### The heading sits on its own row

**Controls on one row, the name of the screen on the next.** 26pt, regular
weight, left aligned, 15 from the edge — as Chats, Calls and Notices already
do.

Never centred between the buttons. A title in the middle of a control row has
to shrink to fit whatever is beside it, is pushed off centre the moment one
side gains a button, and stops reading as the heading of the page — it becomes
a label on a toolbar.

**A sheet is the exception.** A bottom sheet's title is centred between its
close button and its action, because a sheet is one thing and its title names
that thing rather than heading a page of them.

## 6. Settings and choices

**A setting is a switch.** `mobile/src/components/ui/AppSwitch.tsx`, on
`#36C75A`, off `#C5C5C7`, never brand-tinted. **Never a checkbox, and never a
radio button.**

Where two choices exclude each other, they become **two switches that are always
opposite**: turning either one off turns the other on. Every gesture then lands
somewhere valid, and the setting can never be left with no answer — which is
what a pair of radio buttons allows the moment somebody deselects one.

Two rows rather than one switch when each choice needs explaining. What "admins
only" actually means is worth reading before it is chosen, and a single switch
has room for one description, not two.

**Three or more choices keep a tick**, not switches. A switch works for two
because turning one off plainly means the other; among three it says nothing —
turning *Light* off does not say whether *System* or *Dark* was meant. Draw them
as rows in a card with a `check` in `colors.link` against the one in force.

**There are no checkboxes in this app.** Not for a setting, not for choosing
one thing, not for choosing several. A chosen row is marked with a **tick** —
a bare `checkmark` in `colors.link` — and an unchosen row is marked with
nothing.

**The tick sits at the end of the row**, never at the start. A mark of what is
chosen belongs after the thing it marks: the eye reads the name first and the
answer second, and every list in the app — the pickers, the audience list, the
appearance choices — already puts it there. A marker on the left indents the
whole list to make room for something that is usually not shown.

**Selecting several** works the same way: tick the ones chosen, and keep the
tick's slot at its width so rows do not jump sideways one at a time as somebody
works down a list. Entering selection mode moves them all at once, which reads
as a change of mode; a row shifting on its own reads as a glitch.

**Select all is a link**, not a box with a label. Blue text that ticks
everything, and reads "Clear selection" once everything is ticked, so the one
control says what it will do next rather than what state it is in.

**A picker list keeps its tick too.** A tick against a row marks what somebody
chose from many; that is a selection, not a setting.

**A date is chosen with the platform's own picker.** `DateTimePickerAndroid`
opens the calendar dialog on Android, and `ScheduleDateTimePickerModal` shows the
inline picker in a sheet on iOS. Never a wheel, a grid or a set of fields built
by hand: a lookalike is close enough for years and then wrong for anybody using
large text, another calendar or a screen reader.

The row that opens it carries the chosen date as its value, at the end beside
the tick, so the card says which day is in force without opening anything. And
**the row opens the picker on the first tap.** Choosing "a day" and then hunting
for where to say *which* day is two taps for one decision.

A date that has been picked is **kept while another choice is in force**, so
switching to "Last 7 days" and back does not quietly throw it away.

**A flag stands for a region, never for a language.** `getLanguageFlagEmoji` in
`mobile/src/services/languageFlags.ts` reads the region out of the language code
— `es-MX` is Mexican Spanish and gets Mexico's flag — and answers **nothing**
where the code names no country. A globe is drawn instead.

Never pick a country for a language spoken across borders. Swahili is not
Tanzania to somebody in Kenya, and people read a flag as a fact rather than as
decoration. The same goes for "Auto detect": nothing has been heard yet, so
there is no country to show.

## 7. The search field

**One field, everywhere.** `ChatSearchBar` in
`mobile/src/components/chatUiPrimitives.tsx`, and no screen keeps its own.

- `groupedCard` white, so it reads as a card on the tinted page
- **A blue outline**, `colors.link`, at 1.5
- A soft shadow: 3 down, 10% opacity, 8 blur, elevation 3. It has to sit
  **above** the page rather than be drawn on it, and a border alone does not do
  that
- Fully rounded ends, and the whole width of the page inside the usual 15

It takes no props for its appearance. It began as an opt-in tone on two screens
and became the house style, which is the right way round: a field that looks the
same everywhere is worth more than any screen's own version of one.

**Nothing shares the row with it.** Controls that used to sit beside a search
field — a view toggle, a refresh — belong in the header. A search box somebody
cannot type a whole word into is a search box nobody uses.

## 8. The safe areas

**The bottom safe area is paid for exactly once.**

React Native's `SafeAreaView` at the app root pads on **iOS** and does nothing at
all on **Android**, so the two platforms need opposite answers. Never read
`insets.bottom` directly for anything that sits against the bottom of the
screen. Ask `resolveScreenBottomInset` in `mobile/src/services/rootSafeArea.ts`:

- **iOS: nothing.** The root already moved every screen clear of the home
  indicator. Adding it again lays a second copy under the content, which is what
  left an empty band beneath the iPhone composer
- **Android: the navigation bar**, clamped to 64 — gesture navigation reports
  about 24 and three buttons about 48, and anything larger is a keyboard being
  mistaken for a bar

**Everything that reaches the foot of the screen owes this**: a bottom sheet, a
full-height modal's scroll content, a fixed footer, a pinned line of text. A
sheet that stops at the screen edge has its last line under the navigation bar.

**The top is the same story in reverse.** A full-height modal is drawn over the
status bar on Android, so it adds `getFullScreenModalTopPadding(insets.top)`;
iOS insets the sheet itself and reports 0, so one number is right on both. **An
absolutely positioned child does not inherit its parent's padding** — it has to
be given the offset, or it lands at the very top of the window.

**Every full-height surface asks that helper, never `insets.top` directly.**
Android under edge to edge can report `insets.top` as **0**, and the helper is
the only thing that knows to fall back to the measured status bar height. A
screen that adds its own small number to `insets.top` looks correct on the
phone it was written on and puts its buttons under the clock on the next one.

**A `Modal` is not covered by the app root's `SafeAreaView`.** It is its own
window on both platforms, so the rule above — paid once at the root, nothing
added on iOS — does not hold inside one, and `resolveScreenBottomInset` is the
wrong helper there. A modal asks the safe area directly on iOS, and on Android
falls back to a measurement, because **a Modal reports no safe area at all**:
`insets.bottom` is 0 in one even on a phone with a navigation bar. Both
mistakes have shipped — content on the iPhone home indicator, and a panel
running under the Android navigation bar.

**A bottom sheet is capped, and what is capped scrolls.** A sheet sized by its
content grows until it covers the status bar, so one extra row is enough to put
its close button behind the clock. Cap it — 92% — and put the body in a
`ScrollView`, because **padding cannot rescue content taller than the box
holding it**: a cap with no scroll simply makes the last rows unreachable. Both
halves are needed; each on its own has shipped a broken sheet.

## 9. Movement

Screens should settle, not snap.

- Content fades in over 260ms once it has loaded
- Anything that changes layout calls a 220ms `easeInEaseOut` layout animation
- On Android, `UIManager.setLayoutAnimationEnabledExperimental(true)` must be
  called or nothing animates at all

## 10. Keyboard

Any screen with a text field wraps its scrolling part in a `KeyboardAvoidingView`,
`padding` on iOS and `height` on Android. A field near the bottom must ride
above the keyboard, never hide behind it.

## 11. Testing

Pure wording and colour logic lives in a service module with **no native
import**. A helper that imports `react-native` or `expo-image-picker` cannot be
tested, and this has already broken the suite twice: `describeCounts` and the
attachment size rules both had to be moved out afterwards.

Put the rule in a service, test it there, and let the component only render it.

## 12. Where this is applied

Done:

- `components/actions/ActionDetailModal.tsx`
- `components/actions/CreateActionModal.tsx`
- `components/actions/ActionBubble.tsx`
- `components/settings/SettingsList.tsx`
- `components/chatHeader/BackHeader.tsx`

Not yet converted, in rough order of how often they are seen:

- The settings sub-screens: directory, security, groups, company profile,
  my devices, chat backup, offline chat, key results, role permissions
- The announcement sheets and the audience picker
- Group info, chat settings and the call screens

Convert them as they are touched. Do not convert a working screen for its own
sake without asking.
