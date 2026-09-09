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

**A picker list keeps its tick too.** A tick against a row marks what somebody
chose from many; that is a selection, not a setting.

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
