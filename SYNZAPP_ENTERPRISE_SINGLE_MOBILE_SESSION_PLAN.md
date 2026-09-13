# Synzapp Enterprise Plan — Chat Lives On One Phone

Source of truth for binding chat to a single handset. Written before any code,
from an audit of the live codebase. Everything marked **verified** was read out of
the source, not assumed.

## The idea in one line

An account's **chat** lives on one phone. Signing in on a second phone asks first,
then moves chat across and signs the old one out of chat.

## Why this wording matters

Not "one session per account". The account stays available on more than one
surface — the web console for RCA, RAILS, LSW and compliance; the phone for chat.
What is bound to a single handset is the **chat identity**, nothing else.

Three things follow, and they are the reason to phrase it this way:

- **The web needs no carve-out.** There is no chat on the web, so there is nothing
  to conflict. Using synzapp.com can never sign a phone out, because the browser
  never registers a device at all (**verified** — the web never calls
  `registerDeviceIdentity` and never sends `X-Synzapp-Device-Id`).
- **No new gates on the rest of the product.** The earlier draft asked whether 187
  un-gated routes across compliance, RAILS, LSW, RCA and the interpreter should be
  brought behind a device check. Under this framing, no. Those are legitimately
  multi-surface. The device gate stays exactly where it already is, on chat. That
  removes the riskiest phase of the work.
- **It is honest.** "You have been signed out of your account" would be false.
  "Chat moved to your new phone" is true.

## Why do it at all

Not because of the push-token bug. That is already fixed at the root —
registration now claims a token across the whole tenant, so one installation
cannot serve two accounts.

Do it because **one device per account is the right shape for end-to-end encrypted
chat**, and because it makes Delivered mean one unambiguous thing rather than
"reached one of their devices".

This is the WhatsApp and Signal model, and for the same reason: the encryption keys
live on the handset. Teams and Slack allow many devices and would treat this as a
regression — but they are not end-to-end encrypted, and they control devices with
MDM instead. Synzapp is in the first camp.

---

## Order of work

Steps 1 to 3 are worth doing on their own merits and should each ship separately.
Step 4 turned out to be already built — see the correction there. Step 5 is the
feature, and it should not start until step 3 has shipped.

Step 1 is a live exposure and step 2 a live compliance failure. Neither needs this
feature to justify it, and neither should wait for it.

### Step 1 — Store the chat keys per account, not per device (independent, ship first)

**Decided: per account.** Two accounts on one handset must not be able to read
each other's chat.

Both keys are device-global today (**verified**):

- `CHAT_BACKUP_RECOVERY_KEY_STORAGE_KEY = 'synzapp.chatBackupRecoveryKey.v1'`
  (`chatBackup.ts:62`)
- `LOCAL_CHAT_KEY_STORAGE_KEY = 'synzapp.localChatKey.v1'`
  (`localChatStore.ts:203`)

**The recovery key is the urgent one.** It is not a cache — it is the credential to
somebody's chat backup. Device-global means the second account to use a handset
holds the key to the first account's backup. Fix this one on its own, immediately;
it does not depend on anything else in this plan.

**The local chat key is the quieter one but the deeper hole.** It seals every
cached conversation, and both accounts' rows live in the same database sealed with
the same key. What separates them is a query filter, not encryption. Anyone with
the handset and that key can read the other person's cached messages regardless of
who is signed in.

This matters for Synzapp specifically: shift handover on a shared handset is a
normal working pattern for the customers this is built for.

And the one-phone rule does **not** remove it. That rule means one account at a
time, not one account ever. Handsets are still passed on and people still leave.

**How.** Follow the pattern already in the codebase — device identity is stored as
`synzapp.deviceIdentity.v1.user.<uid>` via `getDeviceIdentityStorageKeyForUid`
(`deviceIdentity.ts:436`). Key the chat keys the same way.

**Also per account:** the chat media directories. Photos and videos from
conversations.

**Deliberately left device-global:** the profile photo cache. Those are directory
photos already visible across the tenant, so scoping them buys nothing.

**The cost, stated plainly.** Cached history is discarded once on upgrade, because
it is sealed with the old device key and re-sealing per account is not worth
building. That is acceptable — it is a cache and it re-syncs from the server — but
it should land at a quiet moment and be named in the release note.

Once this is done, a wipe is naturally complete: each account owns its own key and
its own rows, so clearing one cannot touch the other.

### Step 2 — Repair the admin revoke (independent)

**When an admin wipes a lost phone today, nothing happens.**

`GET /api/profile/me/company-data-wipe-commands` requires an ACTIVE device
(`profileRoutes.ts:384`), but `revokeTenantDevice` marks the device REVOKED and
*then* writes the wipe command. The order is addressed to a device that is, from
that moment, blocked from the only endpoint that could collect it. The mobile
poller throws on the 403 and the screen swallows it (**verified**).

This is a live compliance failure with real tenants, and it has nothing to do with
the rest of this plan.

Four fixes, all small:

1. Let a device read and complete **its own** wipe commands on an ownership check
   alone — authenticated uid, plus a device id owned by that uid — without
   requiring the device to still be ACTIVE, and without touching `lastSeenAt`.
2. `revokeCurrentUserDevice` writes no wipe command at all. Give it one.
3. Its idempotence check is
   `if (userDevice.status === 'REVOKED' || tenantDevice.status === 'REVOKED') return;`
   — **either** document already revoked aborts the whole revoke. The two copies do
   drift, because dormancy retirement and push-token cleanup write them separately
   and non-atomically (**verified**). Make it idempotent per document: skip the one
   already revoked, always write the other.
4. The phone cannot recognise a revoked session. It decides a session is dead by
   regex-matching the error **prose**, and the backend's message
   (`'This device is not authorized.'`) matches none of those words.
   `chatApi.ts` and `profileApi.ts` never inspect `response.status` (**verified**).
   Give the 403 a machine-readable code and branch on the code, not another word in
   a regex.

### Step 3 — Fix the group history encryption (independent)

**It is locking with one key and opening with another.**

`buildGroupHistoryKeyGrants` seals with
`nacl.box(messageKey, nonce, targetPublicKey, GRANTER_privateKey)`
(`chatEncryption.ts:337`). `decryptMessageKeyCandidate` opens with
`nacl.box.open(ct, nonce, envelope.senderKeyAgreementPublicKey, localPrivateKey)`
(`chatEncryption.ts:421`). NaCl box needs the **granter's** public key. It is
opening against the sender's (**verified**).

A failed grant also permanently occupies the slot it failed on. The existing test
only checks JSON shape.

So group history already fails to reach a new phone today, with or without this
feature.

Fix: carry the granter's public key on each grant and open against it. Add the
crypto round-trip test that does not exist — seal, transmit, open.

**Do this before deciding what the confirmation screen is allowed to promise.** It
is a few hours and it changes the answer.

### Step 4 — ~~Make backup automatic~~ — already built (corrected 2026-09-13)

**This step was written on a false premise and needs no work.** Checked against
the source rather than the audit that produced it:

- Backup **is** automatic. `queueEncryptedChatBackup()` is called from nine places
  across the message paths — after receiving, after saving, after sending — and
  debounces at 1800ms. The claim that `createEncryptedChatBackup` is "only reached
  from a settings action" was wrong.
- It is **gated on the tenant policy**, read from the server, and says so plainly
  when a tenant has backups switched off.
- The recovery key **is escrowed** to the organization, wrapped by Cloud KMS, at
  the moment a backup is made — so a reinstalled handset can recover it rather
  than holding the only copy.
- Restore already handles the hard case: it tries the local key, then a release an
  administrator has approved, and otherwise raises a request. An employee is never
  asked to type a key they were never given.

**The defaults do not contradict each other either**, which the audit also
claimed. `DEFAULT_CHAT_BACKUP_POLICY` is `false` on both the client and the
server. What differs is `mapChatBackupPolicy`, which reads an *unconfigured*
tenant as enabled (`policy?.encryptedBackupsEnabled !== false`). That is a
separate question from the constant, which is the fallback used when the policy
cannot be read at all — and refusing to upload when you do not know the policy is
the right answer there.

Worth a decision at some point, but not a blocker and not a contradiction:
should a tenant that never configured backup have it on by default?

**What is genuinely missing** belongs to step 5, not here: nothing offers to
restore on a **fresh** device. Somebody moving to a new phone has to find it in
settings. That matters only once phone-swap is routine, which is exactly what
step 5 makes it.

### Step 5 — Bind chat to one phone

Only once 2 and 3 are done.

**Where it is enforced.** Inside `registerDeviceIdentity`
(`deviceIdentityService.ts:119`). It already runs one transaction reading the org,
the user and both device documents, and already refuses a device id owned by
another uid. It is the one place a phone becomes real, and the web never reaches
it.

**How the incumbent is recorded.** A pointer at
`identityDirectory/{uid}.activeMobileSeat`.

Not a query for "other active devices" — that is not reliably atomic. Two phones
registering at the same moment write two *different* documents, so nothing
collides and both can succeed. One shared pointer gives both transactions a single
document to contend on, which Firestore does serialise. It is also free to read:
`buildAuthSession` already reads exactly that document on every gated request
(`authSessionService.ts:57`, **verified**).

**Do not write the rule as `platform !== 'web'`.** `devicePlatformSchema` accepts
`'web'` and the value is written verbatim from the client (**verified**), so a
second phone could declare itself web and skip the rule. The web is excluded
because it creates no device row — that is the guarantee, and nobody can opt out
of it.

**The prompt, both halves.**

- The **new** phone asks before anything is destroyed, showing the other phone's
  platform and when it was last used.
- The **old** phone is told afterwards: "Chat moved to another phone at 14:32."

The second half is what the current thinking is missing. WhatsApp does both.

Wording: do not say "you have been signed out" — they can still use the web. Do
not promise messages travel unless steps 2 and 3 are actually done.

---

## Security requirements

Each came out of an adversarial pass and each is a real hole.

**The confirm step must require fresh authentication.**
`POST /api/profile/me/devices` carries only `verifyAppCheck`, which is a no-op on
mobile by default (**verified**). This feature turns that call into a *destructive*
one — it revokes the other phone and queues a wipe on it. Someone holding a lifted
refresh token, which persists in the keychain and which this design deliberately
never revokes so the web stays signed in, could evict the real user and destroy
their cache, repeatedly. Today that token can only read.

Use the pattern that already exists: `assertRecentAuthentication`
(`organizationDeletionService.ts:316`) rejects anything whose `auth_time` is older
than ten minutes. Add a per-uid rate limit through the existing `assertRateLimit`.

**A claim must never address another person's device.** `firestore.rules` lets any
active tenant member `get` and `list` `deviceKeys` (**verified**), so a colleague
can read a co-worker's device id. The displaced device must come **only** from the
uid-scoped query inside the transaction; `claimFromDeviceId` is matched against
that set and never used to address a document. Test it: a claim naming another
user's device must return not-found and revoke nothing.

**The local wipe is not currently a wipe.** `LOCAL_CHAT_KEY_STORAGE_KEY` — the key
sealing every cached conversation — is never deleted. There are exactly four
`SecureStore.deleteItemAsync` calls in the app and none is this one.
`clearLocalChatKeyCache` only nulls an in-process promise. With row `DELETE` and no
`VACUUM` in WAL mode the data stays recoverable (**verified**). Destroy the key,
then VACUUM, in that order.

**What revocation does not do — say this plainly.** The revoked phone's Firebase
refresh token is never revoked, deliberately, so the web stays signed in. And
`firestore.rules` grants an active tenant member direct read access. So the device
gate protects the API and not the database.

Those envelopes are ciphertext, so **confidentiality after revocation rests
entirely on destroying the handset's key material, not on the revoke.** That makes
the key destruction above the real compliance control and the thing that must be
tested. Write the compliance claim to match: revocation stops new messages and API
access; past messages stay readable until the local keys are gone.

---

## Limits to accept deliberately

**A reinstall looks exactly like a second phone.** `appInstallationId` cannot tell
them apart — it is minted inside the same stored blob as the device id, so a
reinstall that loses one loses both (**verified**). Any "this is the same handset"
softening would be wrong precisely when it is needed. Show the platform and
last-seen time, and let the person judge.

**There is still no way to revoke a device from a browser.** `web/src` has no
references to the admin device routes, and both revoke routes require an active
registered device — so you need a working phone to revoke a phone (**verified**).

This feature *improves* the employee case: a replacement phone evicts the lost one
automatically, where today the lost one stays active forever. Worth saying in the
release note. The **admin** case is unchanged and needs either a web surface or a
documented break-glass procedure.

**Eleven private copies of `getDecodedToken`** and two of
`requireActiveRegisteredDevice` have already drifted: some treat the raw header as
a token, some return 401 where others return 403 (**verified**). Extract one shared
helper before adding session logic, not after.

## What must not break

- RAILS, LSW, RCA and the interpreter — shipped, per `mobile/CLAUDE.md`.
- The web staying signed in when a phone is claimed or revoked.
- Employee-lifecycle reactivation, the one case a revoked device may re-register.
- Admin device revocation, which step 1 repairs rather than replaces.

## Verification

- A claim naming another user's device revokes nothing and returns not-found.
- A claim with a stale `auth_time` is refused.
- Two concurrent claims leave exactly one phone holding chat.
- A revoke starting from divergent device documents ends with both revoked.
- A revoked device can still read and complete its own wipe command.
- After the purge the account's chat key is gone and its cache cannot be reopened.
- A second account on the same handset keeps its own cache intact through that purge.
- Neither account can open the other's cached rows.
- A crypto round-trip on the group history grant: seal, transmit, open.
- The web keeps working throughout, and creates no device row.

## Decisions taken

- **Scope is chat only.** The web and the rest of the product are untouched.
- **History is fixed, not worded around** — steps 3 and 4.
- **Keys are per account, not per device** — step 1.

Nothing is left open. The plan is ready to build against.

## Status

- **Step 1 — done.** Both the backup recovery key and the local chat key are
  stored per account, sharing one tested implementation, and the purge destroys
  the account's chat key so a wipe is actually a wipe.
- **Step 2 — done, deployed.** The wipe endpoints check ownership rather than
  authorisation, self-revoke writes a wipe order, and the revoke is idempotent
  per document so drift no longer strands a device.
- **Step 3 — done, deployed.** Grants carry the sealer's public key and are opened
  against it, and a fixed grant may replace a broken one that was holding its
  slot.
- **Step 4 — nothing to do.** Already built; the step was written on a false
  premise. See the correction above.
- **Step 5 — done.** The seat is enforced where a phone becomes real, a second
  phone is refused with a code naming the incumbent, confirming moves the seat
  and revokes and wipes the old handset, a claim needs a sign-in from the last
  ten minutes and is rate limited, a signed-out handset now recognises itself by
  code and wipes, and a phone that has just taken over is offered its history
  back.

### Still open after step 5

- **No web surface for device revocation.** Both revoke routes need an active
  registered device, so an administrator still needs a working phone to revoke a
  phone. This feature improves the *employee* case — a replacement evicts the lost
  handset automatically, where today it stays active forever — but the admin case
  is unchanged and wants either a web surface or a written break-glass procedure.
- **The 187 un-gated routes.** Out of scope by decision, not by oversight: the
  limit is on chat, and compliance, RAILS, LSW, RCA and the interpreter are
  legitimately multi-surface. Worth revisiting only if the promise ever widens
  from "chat lives on one phone" to "the account lives on one phone".
- **Eleven private copies of `getDecodedToken`** and two of
  `requireActiveRegisteredDevice`, already drifted. Worth extracting before the
  next change to the session contract, not as part of this one.
