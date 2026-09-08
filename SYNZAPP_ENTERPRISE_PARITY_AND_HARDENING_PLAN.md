# Synzapp Enterprise Parity & Hardening Plan

**Status:** Source of truth. Supersedes ad-hoc fixes; every workstream below lands against this document.
**Scope:** Mobile chat and media, backend chat services, tenant governance.
**Explicitly out of scope for now:** Desktop and web chat clients. Deferred by decision, not oversight — see [Deferred](#deferred).

## The goal, stated precisely

Synzapp should feel like WhatsApp for people who use it all day, and answer like an enterprise system when an admin or an auditor asks a question.

Those are two different bars and they fail differently:

- **The consumer bar** is about *nothing going wrong in the ordinary case*. Sending a video is fast. Photos are still there tomorrow. The app does not stutter while a large file uploads. This bar is lost through accumulated small defects, not missing features.
- **The enterprise bar** is about *being able to prove what happened*. Retention is enforced, holds are honored, exports are complete, and every one of those claims survives a security questionnaire.

Synzapp's feature surface already exceeds WhatsApp — live interpretation, meeting records, LSW/RAILS/RCA, tenant governance. What it lacks is the infrastructure that makes a chat product feel inevitable. This plan closes that.

## Honest starting position

Written from direct inspection of the codebase, not from optimism.

| Area | Reality today |
|---|---|
| Automated verification | **7 mobile test files, ~36 tests**, all on small pure services. **No CI exists** — `.github/workflows` is absent, so nothing runs on push. |
| `AdminChatScreen.tsx` | **47,381 lines in one file.** Contains the outbox, message reconciliation, the media pipeline, the viewer, calls, LSW, Library, and settings. **Zero tests.** |
| Media at scale | Unmeasured. No benchmark exists for a thread with hundreds of media items. |
| Global message search | Does not exist. In-conversation search only; the chat list searches contacts. |
| Typing indicators | Do not exist. Presence and last-seen do. |
| Localization | Does not exist anywhere in mobile or web. English only. |
| Server-side retention / legal hold / disposition | Do not exist. Planned in [SYNZAPP_TENANT_RETENTION_AND_LEGAL_HOLD_PLAN.md](SYNZAPP_TENANT_RETENTION_AND_LEGAL_HOLD_PLAN.md). |
| Backup completeness | Backups carry conversations, not media bytes. Restore is conditional on server retention. |
| Admin chat observability | Does not exist. An admin cannot see that one employee's sends are failing. |
| Server media lifecycle | No tiering, no cold storage. Storage grows linearly forever. |

### The pattern behind the recent defect run

A series of media and chat defects were found on-device, one at a time, over a single working session: a bubble that vanished and returned, an unread badge that cleared itself, black thumbnails after restart, a progress ring on already-sent videos, and a transcoder that deadlocked. Several were introduced by the fix for the previous one.

They were not caused by carelessness in any single change. They were caused by **a system where the only detector is a human opening the app.** Every one of them was mechanically detectable:

- The outbox-wipe was a handler that never merged the outbox — findable by a test asserting "an in-flight message survives every thread refresh path".
- The self-clearing badge was a background fetch marking a chat read — findable by a test asserting "hydration does not change unread state".
- Black thumbnails were absolute paths outliving their container — findable by a test resolving a path written under a different container.
- The transcoder deadlock was a serial queue waiting on itself — findable by a timeout on a single transcode.

**This is the root cause the plan must fix first.** Everything else is faster, safer, and cheaper afterwards.

## Scope — what this plan covers, and what it must not touch

This plan is about **Synzapp Chat** and the **tenant retention console on the web admin dashboard**. Nothing else.

**Explicitly out of scope. Do not modify as part of this plan:**

| Area | Why it is excluded |
|---|---|
| `screens/InterpreterScreen.tsx` and all Interpreter AI code | A separate, working subsystem with its own plan documents. No test coverage, so a mechanical change cannot be verified |
| Any working surface not reached from chat | Same reasoning: the cost of breaking something that works exceeds the benefit of tidying it |

**The "no file over 3,000 lines" exit criterion in Phase 2 applies to the chat surface only.** It is a target for the code this plan is decomposing, not a repository-wide rule.

This is written down because it was already violated once. `InterpreterScreen.tsx` was split into four modules on the reasoning that the line target applied everywhere — the plan said "never in scope for this phase" on the same line as the file name. The split left the Interpreter unable to compile and had to be reversed. A size limit is not a mandate to touch code the plan excludes.

**Before restructuring any file, the question is not "is it too big" but "is it in scope, and is there a test that would catch me being wrong".**

---

## Workstreams

Ordered. Later phases assume earlier ones.

---

### Phase 0 — Verify what already exists

**Why first:** roughly a dozen fixes are sitting on devices unconfirmed, including whether video sending is actually fast now. Building on unverified ground compounds risk, and some of these may still be broken.

| Item | Claim to verify | Status |
|---|---|---|
| Unread badge | Stays until the chat is opened; clears permanently after | **Confirmed** |
| Transfer ring | Correct geometry, real percentage, no ring on completed media | **Confirmed** |
| Onboarding | Four screens, swipe-only, correct in light and dark | **Confirmed** |
| UI responsiveness during upload | Typing and sending stay responsive while a large video uploads | **Confirmed** |
| Text send latency | A plain message reaches "Sent" without a visible wait | **Confirmed** — ~1s |
| Message bubble | One bubble, no flicker, through the full send lifecycle | **Confirmed** — no bouncing after the forward-only status rule |
| Video transcoder | Produces a playable file, correct rotation and audio, and is materially faster than the source upload | **Confirmed** |
| Media persistence | Survives force-quit, reopen, and an app update | **Confirmed** |
| Black thumbnail recovery | Existing broken thumbnails self-heal | **Confirmed** |
| New Chat directory | An employee sees the Org Admin and colleagues without refreshing | **Confirmed** |
| Library | Video posters, clean filenames, tap-to-play | **Confirmed** |
| Thread store migration | No regression in send, switch, scroll, delete, react, reply, viewer | **Confirmed** |

**Exit criteria:** every row confirmed on a physical iPhone and a physical Android device, or a defect filed. — *iPhone done; Android outstanding.*

**Phase 0 is closed.** Every row was confirmed on a physical iPhone. Two defects were found and fixed during verification rather than deferred: the photo editor's pen tool did nothing (IMG.LY, unlicensed and unthemeable — replaced in-house), and free cropping did not work because the crop handles were views offset outside their parent's bounds, which cannot receive touches.

The one row still owed a second platform is Android. Every confirmation here is iOS-only, and the exit criteria asked for both.

---

### Android — what the first real run found

Running on a physical Galaxy A10e (Android 11) and an API 36 emulator, side by side. Everything below was **invisible on iOS** and would have shipped.

**Bugs only Android exposed**

| Fault | Cause |
|---|---|
| Voice notes could not be sent | Media was written to `noBackupFilesDir`; expo-file-system refuses to write outside `files/` and `cache/` |
| Build failed at resource merge | Three Library thumbnails were WebP with a `.png` extension — iOS sniffs content, AAPT trusts the extension |
| Video filename shown as `content-com.android.providers...` | The on-disk uniqueness prefix was reported as the display name |
| No video thumbnail | The Android native module produces none, and the JS fallback was not wired to that path |
| Push never registers | Still open — the phone logs nothing at all, while the emulator registers an FCM token cleanly |

**The receive path: 20,000ms → 73ms**

Four fixes to one underlying mistake — *read everything and write everything on every event*:

1. Every save re-encrypted and re-inserted the **entire thread** (up to 1,000 messages), one pure-JS secretbox and several bridge calls each. Now only rows whose content signature changed are written.
2. Every realtime update **re-decrypted every envelope**. The server resends the recent thread with each update, and one message produces several updates — measured at 103 events for one short conversation. Decrypted payloads are now cached by envelope id.
3. **Failed decrypts were retried forever** and are the most expensive case, since a failure only concludes after trying every candidate key. Failures are cached too. This is not a rare state: every reinstall produces a device that cannot read anything sent before it existed.
4. Every save **decrypted the whole cached thread** to read a list of hidden message ids. One small decrypt now does that.

| | Before | After |
|---|---|---|
| `decryptMs` | 3,520–9,630 | 2–31 |
| `persistMs` | 1,030–10,058 | 6–14 |
| `totalMs` | ~20,000 | 36–78 |

**The lesson worth keeping.** Three attempts were made at this by reading code — a keystore round trip, the write loop, a write skip. All were real inefficiencies; none was the dominant cost. **A timing log found it in one reading.** Cheap instrumentation on the suspect path should come before the first fix, not after the third. The same applied to decryption: `candidateKeyCount` in one log line separated "the sender never encrypted to this device" from "this device cannot open the key it was given" — two problems with completely different fixes that were otherwise indistinguishable.

**Also worth keeping: an emulator is a diagnostic instrument.** The phone alone could not separate "slow device" from "slow app". The emulator answered it immediately, and exposed the retry loop in (3), which was masked on the phone by threads that happened to decrypt.

**Still unmeasured:** video send. Reported as minutes for a 10-second clip with a frozen keyboard — the signature of a blocked JS thread — but no transcode or encryption timing has been captured yet, so no conclusion is claimed.



---

### Phase 1 — Make the system self-verifying

**The single highest-leverage workstream.** Detail lives in [SYNZAPP_TEST_STRATEGY_AND_PLAN.md](SYNZAPP_TEST_STRATEGY_AND_PLAN.md); the summary:

1. **CI from day one.** GitHub Actions running typecheck, lint, unit tests, and the native build preflight on every push. Nothing merges red.
2. **Characterization tests around the send/receive path** before any refactor — they define current correct behavior so the refactor can be proven safe.
3. **Regression tests for every defect from the recent run.** Each becomes a permanent test. A bug that escapes twice is a process failure.
4. **A device smoke suite** — the Phase 0 list, automated where possible.

**Exit criteria:** CI green on every push; the send path, outbox reconciliation, and media path resolution covered; every known past defect has a failing-before/passing-after test.

**Progress**

- [x] CI pipeline added — [.github/workflows/ci.yml](.github/workflows/ci.yml). Four jobs: mobile (typecheck, unit, native preflight), backend (typecheck, unit), backend rules (emulators), web (typecheck, build). Runs on every push and pull request.
- [x] Reconciliation logic extracted to [chatMessageReconciliation.ts](mobile/src/services/chatMessageReconciliation.ts) — message identity, dedup, merge, media merge, outbox re-attachment, row keys. Previously unreachable inside the chat screen.
- [x] Outbox handover extracted to [chatOutboxReconciliation.ts](mobile/src/services/chatOutboxReconciliation.ts) — accepted-message reconciliation, local media preservation, uploaded state, and missing-media repair decisions.
- [x] Regression tests written: R1–R9, R12, R13, R14. Mobile 36 → 69 tests; backend 96 → 102.
- [x] **Proven red.** R2/R14, R3 and R7 were each re-run against their pre-fix logic and failed, then passed once restored. A regression test that has never been red proves nothing.
- [ ] Remaining regressions: R10, R11 — transcoder timing and completion; these need a device or native harness.
- [ ] Device smoke suite.

---

### Phase 2 — Decompose `AdminChatScreen`

**Why now:** 47,381 lines is why defects hide. The outbox-wipe handler was invisible because no one can hold that file in their head. Every subsequent workstream touches this file.

**Why not earlier:** refactoring untested code is how you introduce silent regressions. Phase 1 buys the safety net.

Target structure — extract by seam, one at a time, each behind green tests:

| Module | Responsibility |
|---|---|
| `chat/outbox/` | Pending message lifecycle, send orchestration, retry |
| `chat/reconciliation/` | Message identity, dedup, merge, thread assembly |
| `chat/media/` | Upload, download, preparation, transfer state |
| `chat/viewer/` | Media viewer and photo editor — **photo editor extracted** to `components/photoEditor/` |
| `chat/calls/` | Call UI and signaling |
| `chat/screens/` | Presentational components |

**Rules:** one seam per PR; no behavior change in a refactor PR; tests written before extraction, unchanged after. **Exit criteria:** no file over 3,000 lines; each module independently testable.

**Progress: 47,473 → 13,933 lines (−71%).** 176 module files now exist where there was one. Every step was verified by typecheck, the unit suite and a device build, and no behaviour was changed anywhere.

**What came out**

| Area | Modules | Notable |
|---|---|---|
| Stylesheet | `screens/adminChatStyles.ts` | 8,772 lines. The enabling move — nothing could leave while the styles it needed were trapped inside |
| Messages | `components/messages/` | 3,657 lines: thread, bubble, media previews, action overlay |
| Chat list | `components/chatList/` | rows, tabs, archive, spam, new chat, clear, overflow |
| Calls | `components/calls/`, `services/chatCallSupport.ts` | overlay, keypad, scheduling, history, favourites, signalling |
| Groups | `components/groups/` | info, details, members, permissions, switcher |
| Contacts & directory | `components/contacts/`, `components/directory/`, `services/chatContactSupport.ts` | |
| Media | `components/mediaViewer/`, `components/mediaReview/`, `services/chatMediaSupport.ts` | |
| Company Library | `components/companyLibrary/`, `services/companyLibraryDisplay.ts`, `services/companyLibraryChatSources.ts` | |
| Non-chat surfaces | `components/lsw/`, `keyResults/`, `aiCredits/`, `offlineSettings/`, `archiveSettings/`, `guidedSetup/` | Never chat code; only lived here because the file grew into the whole admin app |
| Shared | `components/chatUiPrimitives.tsx`, `types/featherIcon.ts`, `services/chatDisplayFormatting.ts`, `services/chatMessagePreview.ts`, `services/adminChatSupport.ts` | |

Unit tests went from 173 to **216**. All 43 new ones cover code that had shipped and never been tested, because nothing inside a 47,000-line component is reachable from a test.

**Three rules this work established, all learned the hard way.**

*Helpers before components.* Every extraction stalled on a handful of small pure helpers the whole screen shared — `getErrorMessage` alone had 108 callers. Nothing moves until those have a home.

*A declaration ends where the next one's docblock begins, not at its `function` line.* Getting this wrong made adjacent spans overlap, and one cut silently swallowed a neighbouring function — `getCompanyLibraryKindLabel`. Typecheck only caught it because the leftover half no longer parsed; a clean removal would have failed nothing and the function would simply have been gone. **Any tool that moves code by line range needs an explicit overlap check and a removed-line-count assertion, not just a green build.** Both guards are now in the extractor, and the overlap guard caught a second instance immediately.

*Automated extraction must be paired with a compiler that sees the whole tree.* Three further classes of bug surfaced only in typecheck: spread references (`...name`) invisible to the reference scanner, modules needing both a default and named imports, and duplicate React hook imports.

---

### Phase 2 exit criteria — NOT met

The criterion is *no file over 3,000 lines*. Five files still exceed it:

| File | Lines | |
|---|---|---|
| `screens/AdminChatScreen.tsx` | 13,933 | 13,300 of it is one function |
| `screens/InterpreterScreen.tsx` | 11,117 | Never in scope for this phase |
| `screens/adminChatStyles.ts` | 8,772 | A stylesheet; splitting it buys nothing |
| `components/messages/MessageThread.tsx` | 3,657 | Splittable, low risk |
| `services/localChatStore.ts` | 3,064 | Pre-existing |

**Why `AdminChatScreen` stopped here, measured rather than asserted.** The remaining body is **244 `useState` calls, 48 refs and 421 inner functions over ~12,000 lines**. Only **17 functions (218 lines)** close over nothing and could be lifted mechanically; they were. A clustering pass over the rest — with the 31 most widely shared bindings treated as shared context — yields **one component of 402 functions and 10,540 lines**, because the functions are transitively linked by direct calls. There is no mechanical partition left.

The seams the plan names are real but turn out to be **one seam, not two**: uploading media *is* part of sending, so the media closure pulls in `sendQueuedChatPayload`, `queueAndSendChatPayload` and `syncPendingMessagesForChat`. Together that is **50 functions, 2,126 lines, requiring 52 component bindings injected**.

That extraction is worth doing, and it is a design change rather than a move. It is deliberately not being attempted in the same pass as thirty mechanical extractions, for the reason this plan gave for sequencing Phase 1 before Phase 2: **refactoring untested code is how you introduce silent regressions, and this screen has no runtime test coverage at all.** Today already produced one instance of tooling silently deleting a live function.

**To actually close Phase 2**, in order, one per session with a device check between each:

1. **Send pipeline** → `chat/sendPipeline/` (50 functions, 2,126 lines). Extract as a hook taking an explicit context object; destructuring at the hook top keeps every function body byte-identical. Watch for temporal-dead-zone errors — inner function declarations are hoisted today and a `const { … } = useHook()` is not.
2. **Write screen-level tests first.** There are none. Without them, steps 3–5 are unsafe at any speed.
3. **Realtime and hydration** → `chat/realtime/`.
4. **Contacts, groups and directory state** → `chat/directory/`.
5. **Split the 1,300-line JSX return** by tab, once the state above is behind hooks and the prop lists are therefore small.

`MessageThread.tsx` (3,657) is the cheapest remaining win and needs none of the above.

---

### Phase 3 — Prove media performance at scale

You cannot claim "smooth after hundreds of files" without measuring it. The recent work (progress moved out of React state, identity-preserving merges) should achieve it — **that is a hypothesis, not a result.**

**Benchmarks to build:** a seeded thread of 500 messages with 200 media items, measuring scroll frame rate, time-to-interactive on chat open, input latency during three concurrent uploads, and memory ceiling.

**Targets:** sustained 60fps scroll on a mid-tier device; chat opens in under 400ms from cache; typing stays responsive during concurrent large uploads; no unbounded memory growth over a long session.

**Exit criteria:** benchmarks run in CI on a schedule, with numbers published in this document and a regression budget agreed.

---

### Phase 4 — Retention, legal hold, and complete exports

Follows [SYNZAPP_TENANT_RETENTION_AND_LEGAL_HOLD_PLAN.md](SYNZAPP_TENANT_RETENTION_AND_LEGAL_HOLD_PLAN.md). Summary of sequencing, which matters:

1. **Derived blob retention** — `derived_retain_until` plus the refcount invariant, enforced as a database constraint. Stops hollow restores before any UI exists.
2. **Preservation plane and disposer** — destruction off the request path, crypto-shredding at the end.
3. **Legal hold with override**, plus the append-only audit log.
4. **Materialized exports with a manifest** — an export taken today stays whole forever, and a partial export is never presented as complete.
5. **Admin console wiring** — the prototype at [web/src/RetentionConsole.tsx](web/src/RetentionConsole.tsx) connected to real controls.

**Hard rule:** the retention UI does not ship before hold override works. A retention dial with no backstop is a documented method for destroying discoverable evidence.

---

### Phase 5 — Search

**Why it matters:** in workplace chat, search *is* the archive. It is how an organization justifies keeping history at all, and it is the first thing a Teams or Slack evaluator tries.

**Why it is hard here:** content is end-to-end encrypted. The server cannot index ciphertext, so the index must be local, encrypted, and built as messages arrive.

**Approach:** extend the existing local SQLite store with an encrypted inverted index over decrypted message text, populated on receive and on decrypt. Search executes entirely on-device. Media is searchable by filename, type, sender, and date — never by content.

**Security boundary:** the index is tenant-scoped, encrypted at rest with the existing local key material, cleared by the same wipe path as chat data, and never leaves the device. **A search index is a plaintext derivative — it must be governed exactly as strictly as the messages themselves.**

**Exit criteria:** global search across conversations returning in under 300ms on a large history; index covered by the tenant wipe test.

---

### Phase 6 — Presence, polish, and localization

**Typing indicators.** Realtime already carries presence; typing is an additional ephemeral event. Never persisted, never in the audit log, and suppressed for users under legal hold so app behavior cannot reveal an investigation.

**Localization.** Currently English-only, in a product that ships live interpretation — a contradiction that will be noticed. Extract strings, add a locale layer, prioritize the languages of existing tenants. This is mechanical but wide, and touches every screen, so it lands after decomposition rather than before.

**Accessibility.** Not yet assessed. Audit against screen readers and dynamic type; enterprise buyers increasingly require a VPAT.

---

### Phase 7 — Operational visibility

**Admin chat health.** An Org Admin is accountable for the tool and is currently blind. Surface per-tenant transfer failure rates, stuck outboxes, devices not syncing, and media cache pressure. Aggregates and metadata only — **never message content**, and the boundary must be documented, because "admin visibility" in a chat product is exactly where privacy commitments get quietly broken.

**Server media lifecycle.** Storage grows linearly forever today. Add tiering to cold storage driven by access recency, with retrieval latency as the only user-visible effect. Tiering changes latency, never existence — that invariant is what keeps the retention guarantee intact.

**Client telemetry.** Crash and error reporting with tenant-scoped, content-free payloads, so the next defect run is detected before a user reports it.

---

## Security requirements that bind every phase

Non-negotiable, and each is a place where a plausible shortcut would break a promise already made:

1. **No plaintext leaves the device unencrypted.** Applies to the search index, telemetry, and admin observability alike.
2. **Every plaintext derivative is governed like the original.** Search indexes, thumbnails, transcoded video, and decrypted caches are all covered by tenant wipe and cache policy. A derivative that escapes governance is a data leak with extra steps.
3. **Admin visibility is metadata-only**, with the boundary written down and tested.
4. **Legal hold outranks everyone**, including the Org Admin and including tenant deletion.
5. **Audit is append-only at the storage layer** and not governed by the retention policies it records.
6. **Holds are invisible to end users.** No banner, no changed delete behavior, no typing-indicator difference.

## Sequencing rationale

| Phase | Why here |
|---|---|
| 0 | Do not build on unverified ground |
| 1 | Everything after is faster and safer with a net |
| 2 | Refactor only once tests can prove it safe |
| 3 | Measure the performance claim before making it |
| 4 | Enterprise credibility; independent of 5–7 and can run in parallel after 2 |
| 5 | Largest product gap once desktop is deferred |
| 6 | Polish, wide but shallow; easier post-decomposition |
| 7 | Operational maturity; needs real usage to tune |

**Parallelism:** Phase 4 is backend-heavy and can run alongside 2–3 once CI exists. Phases 5–7 should not start until Phase 2 lands, because they all touch the chat screen.

## Deferred

**Desktop and web chat.** Deferred by decision. Worth recording why it will matter later: it is the largest single product gap for workplace positioning, people work at laptops all day, and Teams and Slack win on that alone. The device-key and envelope infrastructure needed for multi-device already exists; the hard part is key distribution to a second device without weakening E2EE. Phase 5's local index design should assume it will one day need to work on a second device — **that assumption is free now and expensive to retrofit.**

## Definition of done

Synzapp meets the bar when:

- CI is green on every push and no known defect lacks a regression test.
- A one-minute video sends in seconds, and the thread stays smooth while it does.
- Media survives restarts, updates, and storage pressure — verified, not assumed.
- An Org Admin can set retention, apply a hold, review disposition, and take an export that is provably complete.
- Search finds anything the user can see, and nothing leaves the device to do it.
- Nothing on this list is believed rather than measured.
