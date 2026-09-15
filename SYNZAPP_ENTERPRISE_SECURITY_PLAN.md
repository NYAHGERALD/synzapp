# Synzapp enterprise security readiness

Source of truth for making Synzapp pass an enterprise buyer's security review.
Written 14 September 2026 from an assessment of the live codebase, with every
serious finding adversarially re-checked before it was written down.

## Verdict

Not ready today. The foundations are better than most products at this stage and
the gaps are a specific list rather than a rebuild.

**What is genuinely strong, and must not be traded away while fixing the rest:**

- No client touches the database. Mobile ships only the Firebase Auth SDK; every
  read and write goes through the API.
- Authorisation is re-read from Firestore on every request. Custom claims are a
  cache, never the authority (`authSessionService.ts:59-62`).
- Tenant isolation is structural — collection paths, not `where` clauses — so a
  forgotten filter cannot leak another tenant.
- The audit log has no edit or delete path anywhere in the application, and
  clients are denied read and write on it.
- The retention and legal hold engine is unusually complete: four-stage
  destruction, a named human, and a fresh phone verification before shredding.

**One finding was raised and refuted, and is recorded so nobody re-raises it:**
realtime chat sessions *are* revalidated — `ensureRealtimeSessionStillActive` is
called at six sites in `chatRealtimeService.ts`. The agent that reported
otherwise had read half the file.

**One was half-refuted and is worse than that sounds.** The storage rule on
`rcaIncidents/{incidentId}/evidence/` does not expose real RCA evidence — the
backend writes elsewhere, so the path is an orphan. But the rule is live, and it
grants every employee an unlimited, unaudited 50 MB upload path into the bucket
that nothing ever deletes. It is in step 1.5 below, not dismissed.

## The session model — decided

Recorded because it is a deliberate departure from the usual advice, and the
reasoning matters more than the rule.

**Mobile sessions do not expire.** A frontline worker on a plant floor cannot
re-authenticate mid-shift, and a timeout there would be turned off by the first
customer who hit it. Teams, WhatsApp and Slack all keep mobile sessions alive
for the same reason.

**What makes that safe is not the session, it is what guards it.** Two things,
and the first is a prerequisite rather than a nice-to-have:

1. **Revocation has to actually work.** A long-lived session is only acceptable
   if an administrator can end it instantly. Today revoking a device does not
   revoke its tokens and eleven of thirteen routers never check the device at
   all, so a "revoked" phone keeps working. Until step 2 below is done, the
   mobile session model is a liability rather than a considered trade.
2. **A local gate on the device.** A six-digit PIN on app open, with Face ID or
   fingerprint as a convenience over it — the Teams arrangement. This protects
   an unlocked, unattended phone, which is the realistic threat on a shift floor.

**Web sessions do expire**, with an idle timeout and an absolute lifetime, both
tenant-configurable. Web is where administrators sit, where the compliance
console lives, and where a shared desk is a normal thing.


## How to read the rest of this document

Every finding from the assessment is here — 54 of them — with the evidence that
proves it and the fix that closes it. Nothing has been left in a side document
or in conversation. Where a finding was raised and then knocked down, it is in
**Refuted** at the end rather than deleted, so nobody spends a day re-finding it.

Ordering is by danger, not by severity label. Step 1 is exploitable today by
anyone with a normal employee login. Step 7 is paperwork that blocks a signature
but harms nobody.

Two things live outside this file and are referenced, not duplicated:
[SYNZAPP_API_EDGE_SECURITY_PLAN.md](SYNZAPP_API_EDGE_SECURITY_PLAN.md) for the
load balancer and Cloud Armor decision, and `backend/infra/README.md` for the
policy that is written but not applied.

---

## Step 1 — Dangerous now

Live in production, reachable with an ordinary employee account, and none of it
needs a sophisticated attacker. This is the step that gets done first.

### 1.1 The HR department is an org-admin factory — DONE (commit 655108a)

Any department **named** "Human Resources" mints full organization admins, and a
department admin scoped to HR can mint unlimited ones for the whole tenant.

`employeeInviteService.ts:260-266` overwrites the role the admin actually chose
with `ORG_ADMIN` and the full `ORG_ADMIN_PERMISSIONS` set whenever
`isHumanResourcesDepartment` matches. That helper (`tenantDefaults.ts:4-11`)
matches the fixed id `dept_human-resources` **or** any department whose name
normalises to "human resources" — so renaming a department flips it on. The
values are written to the approved-phone record (`:345-346`) and the global
directory (`:371-372`), then into Firebase custom claims when the invitee
completes their profile (`employeeProfileService.ts:190-196`). The grant is all
ten permissions, including `users.manage`, `security.manage`, `roles.manage` and
`audit.read`.

The escalation: `inviteEmployeeContacts` is gated by
`requireOrgAdmin(token, 'users.invite')` at `:208`, which also admits a
`DEPT_ADMIN` (`:438-470`), and `:222` only checks the target department equals
the dept admin's own. A DEPT_ADMIN of HR therefore creates full ORG_ADMINs. The
UI never warns — grep for "Human Resources" across `web/src` returns nothing.

**Shipped.** The grant is asked for, never inferred. `orgAdminInvitePolicy.ts`
holds the decision with no Firebase import, so it is unit tested: a genuine
ORG_ADMIN (no department scope — which a department admin always carries),
holding `users.manage` rather than the weaker `users.invite` that opens the
endpoint, inviting into Human Resources **by id**. The audit records the role and
permissions actually granted and names who received them; a refused grant now
carries the uid and tenant so the attempt reaches the tenant's own log.
`isHumanResourcesDepartment` is narrowed to an id, its name clause commented
rather than deleted. Mobile gained a switch — shown only where the server would
accept it — and a destructive confirmation naming what the person will be able to
do. `npm run admins:review` lists existing admins across all three stores.

**Two things the mapping turned up that were not in the original finding:**

- An organization admin invited anywhere but Human Resources never settles.
  `userProfileService.ts:818` moves them into HR on every profile request while
  the approved-phone record puts them back, costing a Firestore write and fresh
  custom claims forever. That is why the department is constrained rather than
  free.
- `railsService.ts:6366-6377` turns a role **name** into `ORG_ADMIN` when the
  stored role is missing, and `createRole` accepted any name — so a tenant role
  called "Org Admin" decided who may approve a high-risk RAILS loop. The same
  defect one level down. RAILS is shipped and untouched, so `createRole` now
  refuses the five names it recognises. The RAILS-side derivation is still there
  and is listed at 4.7 below.

**Accepted risks, recorded deliberately:**

- There is no second approver — one admin acting alone creates a peer (4.2).
- An invited admin cannot be demoted, and an existing employee cannot be
  promoted (4.7 — do this next).
- Nobody is notified when an admin is created. The only record is an audit entry
  behind a permission most people do not hold.
- The switch is reachable only from the Human Resources department, chosen two
  prompts earlier, so the one remaining route to a second admin is not obvious.
- An older installed mobile build that still invites into HR now silently
  creates a plain employee. It returns 201 and looks right. Mobile is the only
  client, so this resolves as builds roll forward, but it is silent while it
  lasts.
- The web app has no invite UI at all, so there is no web control to add. That
  is a fact about the product, not an omission in this change.

### 1.2 Firestore rules let every employee read all RCA data — DONE

`firestore.rules:213-214` grants `get, list` on `rcaIncidents` to any active
tenant member with only a `tenantId` match as a condition. The same repeats for
`rcaSessions` (224-225), nodes (236-237), `capaActions` (260-261),
`auditSignatures` (269-270) and `evidenceLogs` (276-277).

The backend is far narrower: `canAccessRcaIncident`
(`rcaService.ts:1644-1650`) requires the caller to be `createdByUid` or in
`participantUids`. Any employee bypasses that with their own ID token against the
Firestore REST API. The data is exactly what the codebase itself flags as too
sensitive to send to a third party — `rcaAiContext.ts:5-13` names
`whoWasInvolved`, `wasAnyoneInjured`, `reportedBy`, lot numbers and shift
records. An injury investigation readable by the whole plant floor is an HR and
GDPR problem, demonstrable in a pen test with nothing but a normal login.

**Shipped.** Replaced with a single recursive deny,
`match /rcaIncidents/{document=**}`, so a subcollection added later cannot be
left open by omission. Verified first that no client can reach Firestore at all:
mobile and web import only `firebase/app`, `firebase/app-check` and
`firebase/auth`.

Seven emulator tests now cover it, and they were run against the **old** rules to
confirm they fail there — six of the seven did.

### 1.3 The same rules allow client writes to RCA records — DONE

`firestore.rules:215-220`, `226-232`, `238-244` and `259-265` allow create and
update to any active tenant member. The only content check is that the
**existing** document is not `CLOSED` — nothing constrains what the write sets,
so `createdByUid`, `participantUids`, `rootCause` and `status` are all
client-settable.

The backend refuses all of this: `updateRcaIncident` throws "This RCA is closed
and can only be opened through a governed reopen workflow"
(`rcaService.ts:991-992`, repeated at `1096`), and every mutation runs through
`getAuthorizedSession` / `assertSessionIsEditable`.

In food manufacturing an RCA/CAPA record is regulatory evidence. A buyer's
quality team will ask who can alter a closed investigation. Today: any employee,
silently, with no audit entry.

**Fix.** Deny client writes on the four blocks. If a future feature needs them,
gate on participant membership and validate the changed field set in the rule,
not just the prior status.

### 1.4 Storage rules trust the token alone, and one rule is an open upload path — PART DONE

Two defects in the same place.

**The orphan rule.** `storage.rules:52-57` allows any active tenant member to
create objects up to 50 MB under
`organizations/{tenantId}/rcaIncidents/{incidentId}/evidence/{fileName}`, with no
content-type check. Real evidence goes to a *different* path —
`organizations/{tenantId}/rca/{incidentId}/sessions/{sessionId}/evidence/{evidenceId}`
(`rcaService.ts:2571-2587`, written by the Admin SDK at `:926`) — so no real
evidence is exposed. What is live is an unlimited, unaudited, retention-invisible
write primitive inside the customer's bucket that nothing ever deletes. The
deployed ruleset was fetched from the Firebase Rules API
(ruleset `e339b0da-edd0-416b-98c7-fd476e8c82fb`, released 5 September 2026) and is
byte-identical to the repo file.

**The structural defect.** `storage.rules:9-13` `isActiveTenant` reads only
`request.auth.token.tenantId` and `.status`. Storage rules cannot read Firestore,
so they cannot do the live profile check `firestore.rules:42-47` does, and they
cannot see refresh-token revocation — so `revokeRefreshTokens` in
`employeeLifecycleService.ts:230` does not help, and a just-deactivated employee
keeps direct Storage access for up to an hour.

**Shipped, the orphan half.** The rule is now `allow read, write: if false`,
matching the RAILS evidence rule directly below it, with an emulator test that
fails against the old rule. Still to do once deployed: list the bucket under that
prefix to confirm nothing was dumped there while it was open.

**Still open, the structural half.** `isActiveTenant` reads only the token, so a
just-deactivated employee keeps direct Storage access until it expires. The
answer is to deny client Storage access outright and serve everything through the
short-lived signed URLs the backend already issues for action attachments
(`storage.rules:42-50`). That touches the three paths clients still read — the
company logo, profile photos and a person's own chat backup — so it is its own
change.

### 1.5 App Check is unenforced everywhere — BLOCKED, and bigger than a config flip

The Firebase App Check API for project `synzapp-a7ee3` reports
`enforcementMode: UNENFORCED` for `firebasestorage`, `firestore`,
`identitytoolkit` and `firebasedatabase`. The live Cloud Run service also has
`SYNZAPP_REQUIRE_APP_CHECK=false`, which through `env.ts:68` makes
`verifyAppCheck` a pass-through on every route that uses it
(`rcaRoutes.ts:431`, `adminRoutes.ts:1226`, and the rest).

Worse, it fails **open**: `middleware/appCheck.ts:16-20` lets a request with no
App Check token straight through when the flag is false, and `env.ts:67` defaults
it to false. Both deployment templates ship it off (`render.yaml:26-27`,
`cloudrun.env.example.yaml:5`).

**This is not half a day, and the plan was wrong about why.** The step assumed
both clients already attach tokens and only the flag was missing. They do not:
**the mobile app attaches no App Check token at all.** Only `web/src/firebase.ts`
initialises App Check and sends `X-Firebase-AppCheck`; a search of `mobile/src`
finds the string only inside an error-message regex. Turning enforcement on today
would reject every request the phone app makes.

So the boot guard added in 1.6 **warns** about this rather than refusing to
start. Making it fatal would leave exactly two options on the next deploy: a
server that will not start, or an app that cannot reach it.

**Fix, in order.** Add App Check to the mobile app — the SDK, Play Integrity on
Android and DeviceCheck or App Attest on iOS, registered in the Firebase console
— and attach the header in `adminApi`. Then enable it in staging, confirm both
clients, then set `SYNZAPP_REQUIRE_APP_CHECK=true` and move each Firebase service
to `ENFORCED` one at a time, watching the metrics page for unverified traffic
between each. The mobile half is a native dependency and a rebuild, not a flag.

### 1.6 The phone secrets fall back to a placeholder published in the repository — DONE

`env.ts:30-31` falls back to the literal `'change-this-before-production'` for
both `PHONE_HASH_SECRET` and `PHONE_ENCRYPTION_SECRET`, and
`backend/.env.example:14` ships that exact string. That value is the HMAC key for
the phone lookup index (`utils/phoneHash.ts:8`) and, SHA-256'd, the AES-256-GCM
key for stored phone numbers (`employeeInviteService.ts:655, 679`) — protecting
the only authentication factor the product has.

**Checked against production:** on the live `synzapp-backend` service both are
bound to Secret Manager, so the placeholder is **not** live. The defect is the
silent fallback, not the current value. `cloudrun.env.example.yaml` does not list
`PHONE_HASH_SECRET` at all, so the next deployment from that template boots with
the published key and nothing complains.

**Shipped.** `envGuards.ts` holds the rules, pure and tested; `server.ts` runs
them at boot and exits when production configuration is unsafe. It reports every
problem at once rather than the first, because one-at-a-time turns a
misconfigured deploy into four deploys each ending in the same surprise. The
check lives in `server.ts` rather than `app.ts` so tests and `createSynzappApp`
are unaffected.

The literal is gone from `.env.example`, which now carries no value at all for
either secret — a placeholder in an example file is a placeholder that reaches
production. Both Cloud Run templates gained a header saying the secrets come from
Secret Manager via `--set-secrets`, and naming the `SYNZAPP_STAFF_DOMAIN` trap:
deploying with `--env-vars-file` replaces the live environment and drops it,
locking every Synzapp staff account out.

### 1.7 CORS is a wildcard on the live service — DONE in code, needs the deploy

`CORS_ORIGIN=*` on the live Cloud Run service, matching
`backend/cloudrun.env.yaml:2`, `render.yaml:22` and `.env.example:2`, consumed at
`env.ts:26`.

**Shipped in code.** Both templates now name the four real origins. The middleware
also had a second defect: it passed `env.corsOrigin` to `cors` as a single
string, and `cors` reads a comma separated string as one long origin that matches
nothing — so a service configured with two origins would have silently refused
both. `parseCorsOrigins` splits it into a list, and the boot guard refuses `*` in
production.

**Still needs the deploy** to take effect on the live service, which is `*`
today.

### 1.8 Any employee can enumerate the company's device inventory and presence — DONE

`firestore.rules:171-174` allows `get, list` on `deviceKeys` to any active tenant
member. Those documents hold more than the public keys peers need — the record at
`deviceIdentityService.ts:274-300` includes `appInstallationId`, `platform`,
`lastSeenAt`, `uid`, `status`, `revokedByUid` and `revocationReason`. One list
call returns a live presence map of the whole company.

**Shipped.** Denied to clients entirely, with an emulator test. Senders still get
what they need from the encryption-context endpoints in `profileRoutes`, which
return exactly the six public fields of `EncryptionDevicePublicKey` and nothing
else — no installation id, no last seen time, no revocation reason.

---

## Step 2 — Revocation, the prerequisite for the mobile session decision

The no-expiry mobile decision in the section above is only defensible once this
step is done. Until then a long-lived session is a liability, not a trade.

### 2.1 Revoking a device does not revoke its tokens — DONE

`revokeTenantDevice` writes REVOKED records and calls `createDeviceWipeCommand`
(`adminDeviceService.ts:85-166`) but never calls `adminAuth.revokeRefreshTokens`
— `adminAuth` is not even imported into the file (`:2`). The phone keeps working
and only stops if the app voluntarily obeys a wipe order it has to ask for.

**Shipped.** `revokeTenantDevice` now calls
`adminAuth.revokeRefreshTokens(targetUid)` before the seat release and the wipe
order, because it is the only step that does not depend on the lost device
cooperating.

Firebase revokes per user rather than per device, so this signs the owner out
everywhere. That is the right trade for this action: an administrator revoking a
device is dealing with a phone they no longer control, and leaving their other
sessions alive for convenience would defeat the point.

Note what this does **not** fix: eleven of thirteen routers still never check the
device, so the record being REVOKED still means little on its own. 2.2 is what
makes that true.

### 2.2 Device binding is enforced on two routers of thirteen — DONE, differently

Only `adminRoutes` and `profileRoutes` carry `requireActiveRegisteredDevice`.
`railsRoutes`, `lswRoutes`, `rcaRoutes`, `interpreterRoutes`, `complianceRoutes`,
`actionRoutes` and `announcementRoutes` need only a valid ID token — e.g.
`railsRoutes.ts:232-241`. The guard-coverage test only asserts the three routers
that already pass (`test/apiRouteGuardCoverage.test.ts:9-11`), so the gap is
invisible to CI.

**The fix as written here would have taken the web app down.** It assumed the
browser could carry a device. It cannot — the web app registers no device and
sends no device header at all — and web is not a minor surface: it calls `lsw` 44
times, `rails` 31 and `rca` 21, plus compliance, staff and admin. Requiring a
registered device on every router would have broken all of it.

**Shipped, inverted.** The rule is now that **a device id which is presented must
be real**. A request carrying `X-Synzapp-Device-Id` is claiming to be a
registered phone, and that claim is checked on all thirteen routers instead of
two, so a revoked device is refused the moment its app asks for anything. A
request with no device id is a browser session and is left to the route's own
authorisation, exactly as before — it costs the web app nothing, because the
check returns before any token work.

Mounted once in `app.ts` ahead of every router, which also keeps it out of RAILS,
LSW, RCA and the interpreter, none of which are edited. Two paths are exempt and
tested: sign-in, and the request that registers the device — onboarding sends a
locally generated id before anything exists, so without that exemption nobody
could sign in on a new phone. A malformed id is refused rather than ignored,
since ignoring it would let a caller skip the check by sending rubbish.

`apiRouteGuardCoverage.test.ts` now asserts the guard is mounted globally and
ahead of the first router; the assertion fails against the previous `app.ts`.

**Said plainly, what it does not do:** somebody who steals a phone and crafts
requests without the header still passes on the token alone. Revoking refresh
tokens in 2.1 is what bounds that, to the life of the token rather than to
whether the app cooperates. Neither is sufficient alone.

### 2.3 Sign-out revokes nothing, and no session has a lifetime — SIGN-OUT DONE

`POST /api/auth/logout` verifies the token, writes an audit event and returns
`{ok:true}` (`authRoutes.ts:193-233`). No `revokeRefreshTokens` anywhere. No
idle timeout, no absolute age, no forced re-auth in backend, web or mobile. The
only step-up in the product is the 10-minute window on the mobile seat claim
(`deviceIdentityService.ts:1032-1038`). A Firebase refresh token lives until
explicitly revoked.

This matters operationally in your verticals: warehouse and plant floors share
tablets, and a signed-out shift worker's credential is still live.

**Shipped, the sign-out half.** `POST /auth/logout` now revokes the account's
refresh tokens.

**And it works immediately, which the finding understated.**
`verifyFirebaseSession` passes `checkRevoked: true`
(`authSessionService.ts:15`), so every later request is rejected the moment it
arrives rather than whenever the token happens to expire. That also makes 2.1
stronger than it was written: revoking a lost device cuts it off at once, not
within the hour. A guard test asserts that second argument, because without it
both revocations would be worth very little.

Firebase revokes per account, not per device, so signing out ends every session
that person has rather than only the one in front of them. That is the right
trade for an explicit sign-out — somebody who meant to leave should not have to
wonder which of their sessions actually ended — and it is recorded here so it is
a decision rather than a surprise.

**Still open, the lifetime half.** There is no idle timeout and no maximum
session age. That belongs with 3.2, because the policy has to be configurable
rather than a number chosen in code: the standing rule is that decisions
affecting tenants live in the Synzapp staff console. Step-up re-authentication
before privileged actions — deactivation, compliance export, retention change —
is also still open.

### 2.4 The rate limiter is per-instance for everything except two routes — DONE

`middleware/rateLimit.ts:26` holds buckets in a module-level Map. The durable
Firestore counter built this session is consulted only when `options.durable` is
set (`:40-42`), which only the OTP preflight and session routes do
(`authRoutes.ts:34, 75`). On Cloud Run the effective limit everywhere else is the
configured limit multiplied by the instance count.

**Shipped, and the finding was slightly out of date.** All three
`createRateLimiter` sites — the OTP preflight, the session route and the public
contact form — were already `durable: true`. What was still per-instance were the
limits inside `authSessionService`: how often one account or one phone number may
establish a session, and how often one phone number may be sent a code.

That last one matters most. The route's own limiter is keyed on the caller's
address, so it does not stop a single number being targeted from many of them.
The per-phone limit is what does — and held per instance it rose with the
instance count, which is to say it loosened precisely when somebody was
hammering it.

`assertDurableRateLimit` is a sibling rather than a replacement, deliberately.
`assertRateLimit` is synchronous and is called from the interpreter in a dozen
places; making it async would mean editing a shipped module this work does not
touch. The free local count is still consulted first, so somebody already over
the limit on this instance is refused without a Firestore round trip.

**Residual, recorded rather than hidden:** the interpreter's own limits — create,
export, realtime, transcript reading and the rest — remain per-instance for that
same reason. They guard cost and abuse of a paid API rather than authentication,
which is why this is a note and not a blocker, but it is still true.

---

## Step 3 — The session model, built

This is the step that implements the decisions recorded at the top.

### 3.1 Mobile: a six-digit PIN with biometric unlock — CORE DONE, screen and biometric to come

**The design point in the plan was half right, and the half that was wrong
matters.** "The PIN has to gate the local chat database key" assumes the PIN can
carry cryptographic weight. It cannot. Six digits is a million possibilities, and
the app has no slow key derivation available — `expo-crypto` offers SHA-256 and
random bytes, not scrypt or Argon2. Anybody holding the extracted keystore could
try every PIN in moments. Building it that way would have produced something that
reads as strong and is not.

So the protection is arranged where it holds, and the threat it is actually for —
an unlocked handset left on a bench for a few minutes — is served better by it:

- **Guessing is online only.** The chat key stays in the hardware-backed
  keystore behind the device lock. The PIN gates the running app and the key
  material it holds in memory.
- **Guessing is slow.** Nothing for the first three slips, then a wait doubling
  from five seconds to a five-minute cap.
- **Guessing is finite.** At ten failures the local chat database is destroyed.
  That is what makes the limit mean something rather than a delay somebody sits
  out. The messages are on the server and come back after a real sign-in; what
  is destroyed is the copy on a phone somebody else is holding.

**Shipped: the whole decision layer, tested.** `appLockPolicy.ts` holds PIN
rules, the failure ladder and when the lock is asked for; `appLockCredential.ts`
stores a salted, iterated digest and never the PIN, compares in constant time,
and carries its round count so the cost can be raised later without locking
anybody out.

The round count was measured rather than guessed: 120,000 rounds cost 248ms on
the development machine, 20,000 cost 48ms. A phone running Hermes is several
times slower, so the larger figure would have put one to two seconds in front of
every cold start — and a lock people turn off protects nothing. 20,000 it is.

**Still to build:** the PIN screens, storage through `SecureStore`, biometric
unlock via `expo-local-authentication`, wiring into app start and background, and
a recovery path that does not become a bypass. `expo-local-authentication` is a
native dependency, so that part needs a rebuild.

### 3.2 Web: idle timeout and absolute lifetime

Both tenant-configurable, enforced server-side per 2.3 — a client-side timer is
decoration.

### 3.3 Web: company email verification

Worth doing, and it is **not SSO**. It proves a person controls a mailbox at the
tenant's domain. It does not let a customer's IT department provision or
deprovision anyone, which is what an enterprise buyer is actually asking for. It
narrows self-service tenant creation (see 4.3) and it does not close the item in
step 7.1.

---

## Step 4 — Identity, privilege and Synzapp's own access

### 4.1 SYSTEM_ADMIN is a fully-privileged role nothing assigns — DONE

Accepted as a valid session role (`authorizationPolicy.ts:190-197`) and granting
org-wide authority across interpreter export and management
(`interpreterService.ts:1678, 5232, 5240`), RAILS approvals
(`railsService.ts:5088, 5183`), LSW (`lswService.ts:2124, 3862, 3873`) and AI
policy (`tenantAiPolicyService.ts:473`). No code assigns it — but one path
derives it from a free-text role **name**.

**Shipped, by refusing it rather than deleting it.** Deleting the role outright is
not possible from here — RAILS, LSW, RCA and the interpreter all reference it and
are shipped modules this work does not edit. So `isKnownRole` no longer admits
it, and a session presenting SYSTEM_ADMIN cannot form an active tenant session at
all. For anything reaching the product through an ordinary request, which is
everything, that has the same effect as deleting it.

**Refused, not downgraded.** Downgrading would let somebody in with less than
they claimed and no sign anything was wrong. A role nobody grants should never
appear, so its appearance is worth failing on.

**It is a behaviour change, so it is checkable first.** `npm run admins:review`
now reports any record carrying SYSTEM_ADMIN across users, approved phones and
the global directory. It should return nothing; if it does not, those accounts
lose access on the next deploy and somebody needs to know beforehand rather than
after.

**Still open, and it belongs to 4.8:** the role-name fallback in `railsService`
that derives SYSTEM_ADMIN from the string "system admin". The door into it is
shut — `createRole` refuses all five reserved names — but the derivation itself
is inside a module this work does not edit.

### 4.2 No separation of duties, no dual control

The founding admin is written with the full `ORG_ADMIN_PERMISSIONS` array
(`orgAdminProfileService.ts:187, 227`), which holds `users.manage`,
`security.manage`, `audit.read` and `roles.manage` together. No service reduces
an ORG_ADMIN's permissions. No dual-control or second-approver machinery exists
anywhere in the backend. SOC 2 CC6.3 and ISO 27001 A.5.15 both name this.

**Fix.** Split the permission set so security, compliance export and user
administration can be held by different people. Require a second approver for
compliance search/export and for bulk deactivation. The audit log gives you the
detection half already; this adds prevention.

### 4.3 Anyone with a phone number can create an organization

`orgAdminProfileService.ts:50-73` — the only precondition is a verified phone and
no existing tenant on that identity. The tenant id is generated on the spot
(`:62`) and the caller becomes ORG_ADMIN with all permissions.

**Fix.** Separate self-service trial tenants from verified enterprise tenants,
with domain or contract verification before a tenant counts as a customer. Add an
admin-succession path so an org is not orphaned when its founding admin leaves.

### 4.4 Synzapp staff have no add, suspend or remove path in the product

`upsertStaffMember` (`staffAccessService.ts:146-162`) is exported and has **no
caller** — `staffRoutes.ts` has 15 routes and none creates, suspends or deletes a
staff record; only `GET /team` reads. Staff are added by
`backend/scripts/addStaffMember.mjs`, writing directly to `synzappStaff` with
project credentials. There is no suspension path at all, so removing someone is a
manual database edit. Staff-list changes are the only staff action with no audit
record, and the staff console has no App Check on any of its 15 routes and no
device binding.

**Fix.** Wire the dead function up: `POST /staff/team` and
`POST /staff/team/:uid/status` behind `requireStaffAdmin` with `writeAuditEvent`
on both — roughly two hours, since `upsertStaffMember` already handles status.
Keep the script for the first bootstrap entry only. Require App Check on the
staff console, and require and document hardware-key MFA on the staff Workspace
accounts.

### 4.5 One static shared secret authorises cross-tenant destruction — PART DONE

`complianceRoutes.ts:427-456` (`/retention/scheduled-run`, runs retention across
every tenant) and `:600-632` (`/exports/:exportId/run`, packages an export for
any `tenantId` in the body) authorise on `X-Synzapp-Scheduler-Secret`. The
comparison is constant-time and fails closed if unset (`:746-755`, `:429-435`) —
that part is right. There is no rotation path and no audit event when it is used.

**Two things were missing rather than wrong.** The comparison was already
constant-time and already failed closed when unset, which is the part most people
get wrong.

**Shipped: it can be rotated.** The secret is read as a list, newest first, so
the new value and the old one are both accepted while callers catch up. A single
value made rotation a flag day — the moment the new secret is set, anything still
sending the old one fails — which is how a static secret becomes a permanent one.
Which value matched is reported on every call, so "rotation is finished" is
something somebody can know rather than assume.

**Shipped: its use is recorded.** `SCHEDULER_JOB_INVOKED` is written on every
invocation and on every refusal, naming the job, and the tenant on the export
worker — that route packages a readable archive of whatever tenant the body
names, so which tenant somebody was reaching for is the interesting part of a
refused attempt. Nothing was written before, in either direction: cross-tenant
destruction ran with no trace of who asked, and somebody guessing at the header
left none either.

The comparison was also duplicated in `complianceRoutes` and `schedulerRoutes`,
so a change to one never reached the other. It lives in one tested module now.

**Still open: the identity.** OIDC service-to-service tokens remain the right
answer, and a distinct secret per job is still worth doing. Both are
infrastructure changes — who calls the job has to be configured to present an
identity — rather than code, so neither is done here.

### 4.6 Nothing addresses your engineers' access through the Cloud console

The staff console is genuinely clean and chat is end-to-end encrypted, but RAILS,
RCA, LSW, interpreter transcripts, actions and announcements are plaintext
Firestore documents — `firestore.rules:184-210` denies clients precisely because
the backend reads them in the clear. There is no IAM policy, access-approval
configuration or data-access logging in the repository; `backend/infra` contains
only the Cloud Armor policy and a README.

The staff console answers "can a Synzapp employee use the product to read
customer data". The buyer is asking "can a Synzapp employee read our data at
all".

**Fix.** A GCP configuration and documentation workstream, not application code:
least-privilege IAM, Cloud Audit Logs for data access with alerting, and ideally
Access Approval or a break-glass procedure with customer notification. It has to
exist before the question can be answered honestly.

### 4.7 An organization admin cannot be demoted or removed — DONE

Every service that could take admin away refuses any approved-phone record whose
role is `ORG_ADMIN`. `isEmployeeManagedRole`
(`employeeLifecycleService.ts:592-594`) returns true only for `EMPLOYEE`,
`DEPT_ADMIN` or no role, and the guard at `:105-110` throws "Employee was not
found." in front of every lifecycle action — deactivate, suspend, delete,
permanent delete, reactivate, anonymise. `updateEmployeeCompanyRole`
(`employeeRoleAssignmentService.ts:101-106`) refuses the same records, and in any
case only changes the tenant role, never the system role.

Until 1.1 this bit only the rare account escalated by accident through HR. Now
that creating an admin is a deliberate button, it is the normal case: an admin
invites a peer, sees them in the list, and every management action on them fails.

It is also the reason 1.1 carries an accepted risk rather than a clean close. The
confirmation says so in as many words — "This cannot be undone from the app yet"
— which is honest, but honesty is not a control.

**And there is no way in, either.** The only route to ORG_ADMIN is a fresh
invite, and `inviteEmployeeContacts` refuses any phone that already has a tenant
user, an approved-phone record or a directory entry. So a company promoting a
long-serving employee cannot: the account has to be destroyed and re-created.
Promotion and demotion are the same missing operation seen from two ends.

A third consequence: the invite writes a permanent record into the **global**
`approvedPhoneDirectory` for a phone the caller does not control, and with no
revoke path nobody can ever remove it — including the person who created it.

**Shipped.** `PATCH /employees/:approvedPhoneId/org-admin` moves a record either
way, writing `approvedPhones`, the global `approvedPhoneDirectory`, the tenant
user document, `identityDirectory` and custom claims.

The design point worth keeping: **nothing in `employeeLifecycleService` was
touched.** Demotion turns the record back into an `EMPLOYEE`, after which every
existing lifecycle action applies to it unchanged. A working service was left
alone and the role stopped hiding people from it.

`canChangeOrgAdminRole` holds the rules, with no Firebase import so they are
tested:

- You cannot change your own access, checked before anything else. An admin who
  can demote themselves strands a company by accident; one who can promote
  themselves has been checked by nobody.
- The last active organization admin cannot be demoted. The count is read inside
  the same transaction as the write, so two admins cannot demote each other at
  once and leave nobody.
- Status gates the way **up** only. Taking authority away is never the dangerous
  direction, and a record in an unexpected state is exactly the one somebody
  needs to fix — a status check there would recreate this very trap.

Mobile now offers an organization admin exactly one action, "Remove admin
access", because every other action in that sheet was refused by the server; and
the swipe gesture is withdrawn for them, since it looked up a lifecycle option
that no longer exists and would have revealed a button that silently did nothing.
Demotion opens the role picker first — somebody stepping down has to land on a
real role.

**What the adversarial review caught, all fixed:** the last-admin count was taken
from `approvedPhones`, which does not contain the founding administrator at all —
`orgAdminProfileService` writes the organization, the user document and the
identity directory and nothing else. A founder who invited a second admin could
never have demoted them: the count said nobody else remained while the founder
sat right there. It counts live `users` now. Demotion also did not revoke refresh
tokens, so the old role stayed live in the token for up to an hour and
`firestore.rules` reads authority straight out of it; the claims write hardcoded
`status: 'ACTIVE'`, which on a blocked record would have forged an active
session; promotion never validated a supplied `roleId`; the tenant user document
was written without being read; and promotion moved somebody into Human Resources
with no record of where they came from, so demotion left them parked there.

**Still open, and it belongs to 4.3:** an organization whose only admin leaves
has no succession path. Demotion is refused for the last admin precisely to
prevent that state, which means the founding admin cannot hand over and go. That
needs an owner-transfer operation, not a role change.

### 4.8 RAILS still derives authority from a role name

`normalizeRailsTenantRole` (`railsService.ts:6366-6377`) maps the normalised
strings "organization admin", "org admin" and "tenant admin" to `ORG_ADMIN`, and
"department admin" / "dept admin" to `DEPT_ADMIN`, whenever the stored role is
absent or unrecognised. It gates high-risk RAILS approval (`:5086-5090`) and
org-wide reviewer routing (`:5143-5156`).

Latent today, because every write path sets a real role. The door that fed it is
now shut at `createRole`, so no new role can carry those names — but existing
tenant roles were never checked, and the derivation itself remains.

**Fix.** Two parts. Run a read-only sweep for existing tenant roles whose name
normalises to one of the five, since those pre-date the guard. Then delete the
name-to-role fallback in `railsService` — authority must never come from a
display string. That second part edits a shipped module and needs explicit
sign-off.

---

## Step 5 — Data protection and third parties

### 5.1 Chat backup keys are escrowed, and the approval step was removed

`escrowChatBackupKey` (`chatBackupEscrowService.ts:130-150`) KMS-wraps each
device's backup key and stores it per user. The documented design at `:24-32` is
request → named-admin approval → one-time burn, implemented in
`claimApprovedChatBackupKey` (`:314-374`). But `releaseChatBackupKeyToOwner`
(`:285-312`) returns the same unwrapped key with no approval, no burn and no
expiry, checking only active membership — and its own docblock at `:267-284`
states the approval was deliberately dropped. Separately, every message is also
encrypted to a per-tenant archive key created silently on first send
(`tenantArchiveKeyService.ts:115-142`) with no tenant opt-out.

"End-to-end encrypted" therefore does not mean what a security reviewer will
assume, and being caught on that in a review is far more damaging than the
architecture itself.

**Fix.** Two things, mostly documentation. State plainly in the security pack
what Synzapp can and cannot decrypt: message bodies in transit and on devices are
sealed to device keys; a KMS-wrapped per-tenant archive key and a KMS-wrapped
per-user backup key exist and can be unwrapped by the service. Then close the
operator path — split KMS decrypt permission from the Cloud Run runtime service
account so unwrapping needs a second identity, and log every release as an audit
event (today only a `lastReleasedAtMs` field, `:306-309`).

### 5.2 Customer content goes to OpenAI at default retention, on by default

Every OpenAI call is a plain POST with no `store:false` and no zero-retention
configuration — `rcaKnowledgeService.ts:312, 417`,
`railsKnowledgeService.ts:164`, `interpreterService.ts:3370, 4547, 4760, 5014`,
plus audio at `703, 2127, 5092`. New tenants are created with
`companyAiEnabled: true` (`tenantAiPolicyService.ts:319`) — opt-out, not opt-in.
Live meeting audio goes from the employee's phone straight to OpenAI on an
ephemeral client secret (`interpreterService.ts:2709-2745`) with the meeting name
embedded in the transcription prompt (`:2717`). One global API key serves all
tenants (`env.ts:32`), so there is no per-tenant separation at OpenAI either.

**Fix.** Set `store:false` on the Responses calls and enable zero data retention
on the OpenAI account. Flip `companyAiEnabled` to false for new tenants so AI is
a deliberate choice. Write the sub-processor disclosure: which features call
OpenAI, what content leaves, what is retained and for how long.

### 5.3 A compliance export is an unencrypted zip behind a 24-hour bearer link — PART DONE

Built as a plain JSZip with decrypted message bodies and media
(`complianceExportService.ts:296, 304, 632, 659`), written to
`complianceExports/{tenantId}/{exportId}.zip`. `createComplianceExportDownloadUrl`
signs a v4 read URL with a 24-hour TTL (`:72`, used at `:890-899`). A signed URL
is a bearer credential that bypasses Storage rules entirely. The gating itself is
sound (`requireComplianceAdmin`, `complianceAccess.ts:30-32`) — only the link is
the problem.

**Shipped, the link.** The TTL is an hour rather than a day. That is the window
to *start* a download, not to finish one, so a large bundle is unaffected — and
twenty-four hours of a bearer credential sitting in browser history, proxy logs
and whatever the link was pasted into is what made the exposure.

**Still open, the zip itself.** It is still unencrypted. Encrypting it to a key
the requesting admin already holds is the real answer and it is a bigger change:
somebody has to be able to open it at the other end, which is a key-handling
question rather than a code one. The gating was always sound —
`requireComplianceAdmin` decides who may ask — so what remains is the shape of
the answer, not who gets it.

### 5.4 Export bundles carry no integrity digest — DONE

`complianceExportManifest.ts:59-81` defines the manifest with no hash field, and
`createHash` appears nowhere in `complianceExportService.ts`. The same codebase
already does this correctly for the interpreter —
`interpreterService.ts:1550-1552` stores a `contentDigest` with the comment "the
digest is what makes a dispute settleable". An eDiscovery bundle whose contents
cannot be verified after handover is worth much less in the proceeding it was
produced for.

**Shipped, and over the whole bundle rather than per file.** The archive is
digested as it is streamed to Storage — one pass over bytes that were passing
anyway, not a second download of something that may be gigabytes — and the digest
is stored on the export record and handed back **with the download link**, since
a digest nobody is given is a digest nobody checks.

**Per-file digests were the plan's suggestion and are not possible as described.**
Media is handed to the zip as a stream and drained later, long after the manifest
has been serialised, so a per-file digest could not reach the manifest without
buffering entire videos in memory. The bundle digest is also the one a receiver
actually checks: it answers "is the file I hold the file you produced".

### 5.5 Offboarding a customer leaves decrypted copies in the bucket forever — DONE

`organizationDeletionService.ts:302-306` deletes only the
`organizations/{tenantId}/` Storage prefix. Export bundles live under
`complianceExports/{tenantId}/` — a different prefix, holding readable decrypted
messages and files up to 4 GB. Their 30-day purge runs only from
`runScheduledRetention`, which enumerates tenants via
`organizations.listDocuments()` (`retentionScheduleService.ts:133`). After
`recursiveDelete(context.organizationRef)` the tenant is no longer in that list,
so the purge never runs for it again. Separately `tenants/{tenantId}` — legal
holds, disposition items, export records, settings — is never deleted at all.

"What happens to our data when we leave?" is a standard questionnaire item.

**Shipped.** Offboarding now removes the `complianceExports/{tenantId}/` Storage
prefix and recursively deletes `tenants/{tenantId}` — legal holds, disposition
items, export records and retention policies, none of which this flow had ever
touched.

The tenant tree goes **after** the organization, deliberately.
`assertTenantDeletableUnderHolds` has already refused the deletion if any hold is
in force, so what is removed is the record of holds that are over; and if
anything earlier failed, the holds are still there to be read. A guard test pins
that ordering, because reversing it would destroy the records that decide whether
the deletion was allowed.

**A read-only report for the tenants already gone**, `npm run tenants:orphans`.
It lists `tenants/` documents and export prefixes with no organization, and the
**size** of each — because "three orphan prefixes" reads as tidying and "eleven
gigabytes of readable chat history belonging to companies that left" does not.

**Deliberately a report, not a sweep.** Deleting everything with no matching
organization is a one-line query and the wrong thing: a transient read failure
would then destroy a live customer's archive, and there is no undoing that.

**One thing the plan asked for that I did not do.** It also said to delete the
tenant's root-collection audit documents. I left them, because 6.11 is an open
question about what that collection is *for* — it is written on every event,
read by nothing, and disposed of nowhere. Deleting records while unsure why they
exist is the wrong order to settle that in. It stays with 6.11.

### 5.6 No data subject access or erasure path for an individual

A repo-wide grep for `subjectAccess`, `dataSubject`, `rightToErasure`, `erasure`
or `DSAR` matches only prose. `organizationDeletionService` handles a whole
tenant. `employeeLifecycleService.ts:113-197` marks a record deleted and removes
phone-directory entries, but leaves that person's messages, actions, RCA nodes,
LSW entries, interpreter transcripts and audit events in place. There is no
per-person export anywhere.

**Fix.** Two functions over the existing search infrastructure: export-everything
about one uid (`complianceSearchService` already filters by custodian), and a
per-person erasure routed through the disposition queue so a legal hold can still
block it. The pipeline exists; only the subject scoping is missing.

---

## Step 6 — Audit and retention

The engine here is unusually complete, which makes these gaps costly: an auditor
who finds one assumes the rest is decoration too.

### 6.1 The tenant audit console cannot show a single failure — DONE

`writeAuditEvent` only writes the tenant-readable copy when `tenantId` is
supplied (`auditService.ts:33-39`). Of the 64 DENIED/FAILED audit writes, **2**
pass `tenantId` and 62 do not — `adminRoutes.ts:946-951, 1171-1176, 1332-1337`,
`profileRoutes.ts:518, 555, 598, 706, 766, 805, 841, 875, 937, 1079, 1162, 1200`.
Those land only in the root `auditLogs` collection, which no route reads
(`auditQueryService.ts:79-80`). `complianceRoutes.ts` has 12 audit writes and
**zero** failure ones — a non-admin attempting an archive search or hold release
leaves no trace anywhere.

SOC 2 CC7.2 and ISO 27001 A.8.15 both require failed attempts to be logged and
reviewable. An auditor sampling a log with a 100% success rate reads it as a
broken control.

**Shipped, and not by editing sixty handlers.** 60 of the 64 failure-path writes
passed neither a uid nor a tenant, so there was nothing to resolve *from* at the
call site — the event was entirely unattributed. Instead `writeAuditEvent`
resolves the identity itself when the caller did not supply a tenant, which is
exactly the failure path. A request that succeeds already carries one, so the
ordinary traffic pays nothing.

**Signature only, deliberately.** `verifyIdToken(token, false)` proves who sent
the request, which is what attribution asks. Checking revocation would answer a
different question — may they do this — and would throw for exactly the caller
most worth recording: somebody using a credential that has been taken away. A
failure to attribute never becomes a second failure on top of the first.

**And the compliance console now records refusals.** All twelve of its audit
calls were success-only, with bare `next(error)` catches — so a non-admin
attempting an archive search or a hold release left no trace anywhere, the
precise thing that control exists to prevent. Ten mutating routes gained a
failure event carrying the action they already declare.

### 6.2 A legal hold does not protect the audit log — DONE

`retentionScheduleService.ts:102` calls `disposeExpiredAuditEvents` inside
`runTenantRetention`. `auditDisposalService.ts:1-6` never imports or calls
`listActiveLegalHolds` — confirmed, the grep returns 0. Every other destruction
path re-checks holds (`dispositionShredderService.ts:110, 121-132`;
`actionService.ts:1241-1245`). So while a tenant is under a preservation
obligation, the nightly job keeps deleting the events proving who accessed and
altered the preserved material. Any buyer with in-house counsel will read that as
spoliation exposure.

**Shipped.** `disposeExpiredAuditEvents` reads `listActiveLegalHolds` first and
returns with `heldBack: true` when any hold is in force, removing nothing.

### 6.3 Three of the six modules produce no tenant audit trail at all

Zero `writeAuditEvent` hits in `railsRoutes.ts` (22 mutating endpoints),
`interpreterRoutes.ts` (22), `railsService.ts`, `railsKnowledgeService.ts`,
`lswService.ts` and `interpreterService.ts`. `lswRoutes.ts` has 29 mutating
endpoints and audits only the Excel export (`:248, 272`). RCA keeps a separate
per-session change feed at `activityLogs` which is not in the audit console, not
covered by audit retention, not in the auditor CSV — and clients can POST
arbitrary entries into it (`rcaRoutes.ts:501-524`). `test/auditCoverage.test.ts`
only reads three routers, so none of this is caught.

**Fix.** Extend `auditCoverage.test.ts` to cover `lswRoutes`, `railsRoutes`,
`rcaRoutes` and `interpreterRoutes`, then add the audit writes it demands — at
minimum create, edit, delete, status change, export and evidence access on each
record type. Either fold RCA activity logs into the tenant audit log or stop
describing them as an audit trail.

*Note: this touches RAILS, LSW and the interpreter, which are off limits under
the standing rule. Adding an audit write is additive and does not change their
behaviour, but it needs explicit sign-off before anyone starts.*

### 6.4 Audit records have no integrity protection

`auditService.ts:16-40` writes a plain document via `.add()`. No hash chain, no
previous-event digest, no sequence number, no signature, no append-only sink.
Anyone with the service account or Firestore console access can edit or delete
individual events and nothing detects it. There is no external sink either —
`monitoringService.ts` is a 30-line health endpoint, and grep for
logging/BigQuery/PubSub/SIEM returns nothing.

**Fix.** A per-tenant hash chain: store `prevHash` and a SHA-256 over the
canonicalised event, plus a monotonic sequence number, and expose a verify
endpoint. Separately mirror events to Cloud Logging with a locked bucket, or to a
BigQuery sink the app's service account cannot delete from. The chain gives
tamper-evidence; the sink gives tamper-resistance.

### 6.5 The invite audit records a role that was discarded — DONE (with 1.1)

`adminRoutes.ts:1233-1244` writes `EMPLOYEE_INVITES_CREATED` with
`roleId: body.roleId` — the role the admin selected, which
`employeeInviteService.ts:265-266` has already thrown away (see 1.1). An auditor
reading the log for a new org admin sees "invited as Forklift Operator". The
trail does not merely omit the promotion, it misstates it.

**Fix.** Return the effective role and permissions from `inviteEmployeeContacts`
(already in the response object at `:396-397`) and log those alongside the
requested `roleId`. One hour.

### 6.6 The audit log's IP address is attacker-controlled — DONE

`middleware/rateLimit.ts:77-85` `getClientIp` returns the **first** entry of
`X-Forwarded-For`. On Cloud Run the platform *appends* the real peer address, so
the first entry is whatever the client sent. `auditService.ts:20` stores it
verbatim and `auditExport.ts:42` writes it into the auditor CSV. `trust proxy` is
not configured in `app.ts`, so the `req.ip` fallback is unreliable too.

**Shipped**, in `clientIp.ts`, pure and tested — the address is read from the end
of the forwarded list where the platform writes, not the beginning where the
caller does. The hop count is a named constant, because a load balancer in front
of Cloud Run (see the edge plan) makes it two.

**It closed a second hole nobody had counted.** `getClientIp` also keys the
per-IP rate limits, so a caller sending a different fabricated first entry each
request got a fresh bucket every time — the limits could be walked straight
past.

### 6.7 The whole retention configuration is dead code — PART DONE

`auditDisposalService.ts:58-63` reads `recordRetentionDays` and
`auditRetentionDays` from the organization document;
`recordBodyDisposalService.ts:39` reads the former. A full-repo grep finds **no
write site for either**. Three consequences: audit retention always collapses to
`bounds.minimumDays` (365 on the data-minimising template) with no tenant control
and no field in `RetentionConsole.tsx`; the stated invariant "audit outlives the
records it describes" (`auditRetentionRules.ts:88-91`) can never fire; and
`disposeExpiredRecordBodies` returns early on every run, so action and
announcement bodies are never aged out at all.

**Shipped, the honest half.** `disposeExpiredRecordBodies` now returns
`notConfigured`, carried up into the nightly run record. Nothing writes
`recordRetentionDays`, so this path has returned early on every run there has
ever been — and three zeros read exactly like a tenant with nothing overdue. A
control that has never once run looked identical to a control with nothing to do.

**Deliberately not guessing a period.** Deriving `recordRetentionDays` from the
chat retention policies was the plan's suggestion and it is the wrong move: those
policies name conversations and people, and actions and announcements are neither.
Inferring a deletion period for one record type from a policy written for another
is the one mistake that cannot be undone.

**Still open:** the console control that lets a tenant set these periods. It is a
web console change and a staff-console bounds question, not a service fix.

### 6.8 Retention only ever examines the same first 500 conversations — DONE

`retentionEvaluatorService.ts:46` sets `MAX_CONVERSATIONS_PER_RUN = 500`;
`:90-92` runs `.limit(500).get()` with no `orderBy` and no `startAfter`.
Firestore's default order is by document name, so every nightly run re-reads the
identical first 500 documents. Any tenant larger than that has a permanent tail
that is never evaluated, never queued and never deleted.

**Shipped.** The pass orders by document id, resumes from a stored cursor and
wraps to the beginning on reaching the end, so a large tenant is covered over
several nights instead of never. The cursor is written **after** the pass, so a
run that fails part way re-examines rather than skipping past.

`completedFullScan` is carried into the run record, because "we reached the end of
this tenant" is the only honest way to say a policy has been applied to all of it
— and it is the question an auditor asks. Before this, the run reported five
hundred examined every night and looked healthy while the tail was never touched.

### 6.9 The product displays a retention commitment it does not implement — DONE

`orgAdminProfileService.ts:154` stamps every new organization with
`retentionPolicy: '3_YEARS'`. `companyProfileService.ts:311` returns it and
`mobile/src/components/settings/CompanyProfileSettings.tsx:173` renders it as the
Retention row. Nothing in any retention service reads that field — they read the
`retentionPolicies` subcollection and `recordRetentionDays`.

**Shipped.** New organizations are no longer stamped with a retention label at
all, and the company profile derives its line from the policies that actually run
— the period when one is live, a count when several are, and "Not configured"
when none is.

"Not configured" is the point. It is the true answer, and it is the one that
sends somebody to go and set a policy up, which the old fiction actively
prevented because it looked done. Several policies are never reduced to a single
period: they cover different people, conversations and content types, and a
number invented from them would be the same lie in a new form.

### 6.10 Audit disposal is capped at 200 events per tenant per night — DONE

`auditDisposalService.ts:21` sets `DISPOSAL_BATCH_SIZE = 200`; `:78-83` fetches
one page; `:104` breaks on the first non-disposable document;
`retentionScheduleService.ts:102` calls it once per tenant per run. A tenant
generating more than 200 expired events a day accumulates indefinitely, so the
stated retention period is not actually enforced.

**Shipped.** Disposal pages until the tenant is caught up or a wall-clock budget
runs out, and reports `ranOutOfTime` when the budget ended a pass with events
still waiting — so "disposed two hundred" and "disposed two hundred with
thousands left" stop looking like the same fact.

The budget matters as much as the loop: this runs beside live traffic, so a
tenant with an enormous backlog gets what fits and the rest tomorrow rather than
holding the nightly pass open while every other tenant waits behind it.

### 6.11 The root `auditLogs` collection is a permanent cross-tenant PII store — DONE

`auditService.ts:31` writes every event there with `uid`, `phoneMasked`,
`ipAddress` and full metadata. Grep finds that one write site — no read path, no
delete path. `auditDisposalService` disposes only the tenant subcollection, and
`recursiveDelete` on organization deletion does not touch it.

**Decided: it is neither, and it is both halves of the question at once.**

It was **not** working as a tamper-evidence second copy, and could not have been.
Since 6.17 both writes share one batch, so they land together or not at all — the
second copy cannot survive the original. Duplicating every uid, masked phone
number, IP address and metadata blob bought nothing.

It is **not** vestigial either. A handful of events genuinely have no tenant to
file them under: somebody probing an endpoint with no credential, or a caller
whose token cannot be read at all. Those matter, and after 6.1 resolves a tenant
wherever one exists, they are the only things left with nowhere else to go.

**So it is now exactly that, and nothing else.** The root copy is written only in
the `else` branch — when there is no tenant — and a nightly sweep ages those
events out on their own short period, which is configuration rather than a number
in code and belongs in the staff console when there is a surface for it. The
sweep runs once per run rather than once per tenant, because these events belong
to no tenant, and what it removed is recorded so it is not silent.

No legal hold check on that sweep, and that is correct rather than an omission: a
hold belongs to a tenant and these events have none. Anything attributable is
written to its tenant instead, where holds do apply.

**What is not done:** the events already in there. Every event ever written, from
every customer including offboarded ones, is still present and will now age out
over the configured period rather than being purged at once — which is the
cautious order, since the sweep deletes from the oldest end and can be watched on
its first runs before it reaches anything recent.

### 6.12 The archive search audit omits who was searched and what for — DONE

`complianceRoutes.ts:457-462` states "every search is written to the audit log
with the question that was asked… A search nobody can account for later is
indistinguishable from a fishing expedition." The actual metadata at `:479-492`
records `custodianCount`, `fromMs`, `toMs`, `holdId` and `hits` — not
`custodianUids` and not `text`. The export audit at `:544-553` has the same
omission. Since `purgeExpiredComplianceExports` deletes the export record after
30 days, after a month there is no record anywhere of whose messages an export
contained.

**Shipped.** Both the search and the export now record `custodianUids`,
`conversationIds` and the search text itself, in plaintext — the log is already
admin-only, and a hash cannot be read back by the person reviewing it.

The export matters more than the search, for a reason the finding names:
`purgeExpiredComplianceExports` deletes the export record thirty days after it is
built, so after that the audit event is the only thing left anywhere that says
whose messages an export contained.

### 6.13 Reading and exporting the audit log is itself not audited — PART DONE

`adminRoutes.ts:516-532` (`GET /audit-events`) writes no audit event.
`AuditConsole.tsx:90-122` loops until the cursor runs out and assembles the whole
log client-side, with no server-side record that an export happened.

**Shipped, the read.** `GET /audit-events` writes `AUDIT_LOG_VIEWED` on success
and on failure, carrying the filters — because a page fetch with no filters and
one narrowed to a single person are very different acts, and both used to be
recorded as nothing at all. The write is guarded: the read has already happened
and the caller is entitled to it, so failing to record it must not turn a
permitted read into an error.

**Still open, the export.** The CSV is still assembled in the browser by paging
the API until the cursor runs out, so there is no single act to record. Moving
assembly server-side is the fix and it is a new endpoint, not a line — recorded
rather than half-done, because an `AUDIT_LOG_EXPORTED` event written by the
client would be a claim rather than a record.

### 6.14 The audit console and auditor CSV show raw Firebase UIDs — DONE

`AuditConsole.tsx:199` renders `event.actorUid`; `auditExport.ts:39` writes it
into the "Actor" column; `auditQueryService.ts:126` maps `uid` straight through.
The tenant already has a name directory — `listCompliancePeople`, used at
`complianceRoutes.ts:677`. An auditor currently receives a file of 28-character
identifiers.

**Shipped.** `listAuditEvents` resolves names once per page from the people
directory the tenant already has, and both the console and the auditor's CSV show
the name with the identifier beside it — the console as a tooltip, the CSV as its
own column, because two people can share a name and only the identifier settles
which one acted.

Read tolerantly: a page still opens if the directory read fails, and a row with
no name falls back to the uid, which is what every row showed before. This is the
same defect already found and fixed once for archive search, where somebody's
messages "appeared in search results under a raw identifier".

### 6.15 The audit console's filtered views will fail at runtime — DONE

`auditQueryService.ts:81-94` combines `orderBy('createdAt','desc')` with
`where('action','in',[...])` and `createdAt` range filters, requiring a composite
index on (action ASC, createdAt DESC). `firestore.indexes.json` holds 8 indexes
across `actions`, `pushTokens` and `tenantAiUsageEvents` only.

**Shipped.** The `(action ASC, createdAt DESC)` index is in
`firestore.indexes.json`, with a test asserting it stays there. It still has to
be deployed before the console's filtered views work.

### 6.16 Record body disposal reports every error as a legal hold — DONE

`recordBodyDisposalService.ts:126-133` is a bare `catch` incrementing
`heldBack`, with the comment "A legal hold, almost always." A permissions error,
a Firestore outage and a code bug all report as the counter the design treats as
"the system working, not breaking".

**Shipped.** `legalHoldError` now carries a `code`, and disposal counts only
that as held back; anything else is thrown. A code rather than the error's name
or its wording, because matching prose is the mistake this codebase has made
before — a revoked device once never recognised itself because the message had
changed.

### 6.17 Audit writes are not atomic with the change they describe — REFRAMED

`auditService.ts:31-39` performs two sequential `.add()` calls outside a batch,
so the root copy can land while the tenant copy fails. Callers audit after the
mutation has committed (`adminRoutes.ts:931`, `complianceRoutes.ts:159`), so a
crash in between leaves the change with no record.

**Shipped, the first half.** Both copies of an event now go in one batch, so the
root copy can no longer land while the tenant copy fails.

**The second half was examined properly and the finding is aimed at the wrong
thing.** Three designs were put up and judged against the real code. What came
back:

**The proposed fix is impossible on the routes that matter most, not merely
expensive.** `PATCH /employees/:id/role` commits a Firestore transaction
(`employeeRoleAssignmentService.ts:219`) and then calls
`adminAuth.setCustomUserClaims` — Firebase Auth, not Firestore. Two commit
points, one of them outside the database, so no Firestore transaction can ever
span that mutation. Recorded here so nobody re-opens it as an unexplored option.

**A worse failure sits in the same file and needs no crash at all.** 86 of the 93
success-path call sites await the audit write unguarded, after the mutation has
committed. One Firestore hiccup throws, lands in the route's catch, and that
catch writes a second event marked FAILED — for a change that succeeded — while
the caller gets a 500 for work that was done. The log is then confidently wrong,
which is worse than a log with a hole in it.

**Shipped for that:** the commit is wrapped, the event is written to Cloud
Logging under an `AUDIT_WRITE_FAILED` marker either way, and what happens next is
`SYNZAPP_AUDIT_WRITE_FAILURE_MODE`. It defaults to `throw`, which is exactly
today's behaviour everywhere, so the deploy is behaviour-neutral. Cloud Logging
is append-only and outside every tenant's reach, so this is also the nearest
thing to the external sink 6.4 wants, at no Firestore cost.

**The one operational step left, and it must come first:** alert on the
`AUDIT_WRITE_FAILED` marker, *then* flip the flag to `continue`. Flipping it
first replaces a loud lie with a silent gap and nobody notices either. That is
the single biggest way this goes wrong.

**Also shipped:** a per-request correlation id
(`middleware/auditContext.ts`). Every event from one request now carries the
same id — including the SUCCESS and FAILED pair above, which described one moment
and had nothing tying them together.

**Still open, honestly.** None of this closes the window. A crash between a
mutation and its audit write still loses the event on any route without a
write-ahead intent. The write-ahead itself is deliberately deferred until the
failure marker has been watched for a week, because its value depends on how
often this actually fires — and because it should start on five privileged routes
rather than twenty.

### 6.20 The server had no graceful shutdown — DONE

No `SIGTERM`, `SIGINT` or `server.close` anywhere in `backend/src`;
`server.ts` was a bare `listen`. Node exited the instant Cloud Run sent SIGTERM,
which it does on every revision swap and every scale-down, so requests being
served at that moment simply stopped mid-work.

This is not only a dropped request. **It is the dominant cause of the failure
behind 6.17** — a mutation commits, the process dies before the audit event is
written, and the change exists with no record. A deploy, not a crash, is what
usually opens that window.

**Shipped.** New connections stop, in-flight requests get a bounded grace period,
and the process leaves on its own terms. The realtime servers hold sockets open
indefinitely, so waiting for every connection would hang until SIGKILL and undo
the point; the grace period is bounded for that reason.

### 6.21 The device check ran twice per request — DONE

Introduced by 2.2, and found by the review of 6.17 rather than by me.
`verifyActiveRegisteredDevice` is not a read: it stamps `lastSeenAt` on two
documents every time it runs. Once the guard was mounted globally, every route
that also checked a device paid four writes where it used to pay two — on the
busiest authenticated path in the product, where the audit batch is only 2 of 11
writes.

**Shipped.** The middleware keeps what it verified on the request, and the route
guards reuse it rather than proving the same device again. The security check is
unchanged; it simply happens once.

### 6.22 Ninety-eight mutating routes write no audit event at all

Larger than 6.17, with a probability of loss of 1. Eighty-seven are in the
off-limits modules — `lswRoutes` 29, `railsRoutes` 22, `interpreterRoutes` 22,
`rcaRoutes` 14 — and eleven are in `profileRoutes`. This overlaps 6.3 but is
wider than it: 6.3 counted modules, this counts routes.

`complianceRoutes` deserves its own line. All twelve of its audit calls are
success-only, and `POST /holds` has a bare `next(error)` catch with no audit
write of any kind — so a failure there leaves no record, not even a failed one.
That is the real hole 6.17 was looking for.

### 6.18 The audit correlation id is client-supplied — DONE

`auditService.ts:24` takes `X-Request-Id` verbatim with no validation and no
server-side fallback, so it can be forged or deliberately collided.

**Shipped.** `requestId` is generated with `randomUUID`; what the caller sent is
kept beside it as `clientRequestId`, clearly theirs.

### 6.19 Releasing a legal hold never checks the hold exists — DONE

`legalHoldService.ts:105-110` calls `.doc(input.holdId).set({...}, {merge:true})`
with no prior `get()`. A bad id creates a phantom released hold, which
`isHoldActive` then treats as released-with-delay, and
`complianceRoutes.ts:246-254` audits as a successful release.

**Shipped.** The hold is read first and a missing one is a 404, so a mistyped id
can no longer create a phantom released hold that `isHoldActive` reads as real
and the route audits as a success.

---

## Step 8 — Input, injection and trust boundaries

Added 15 September 2026, after three questions that the original assessment never
asked: is form input sanitised, is there prompt injection defence, and are
controls enforced in the backend rather than the interface.

**They were genuine blind spots.** A search of the original 54 findings returns
nothing on prompt injection, nothing on output encoding, and nothing on
client-side-only enforcement. Thirty-six closed items did not touch any of it. A
plan that looks comprehensive is exactly what stops anyone asking what it left
out.

Audited across three dimensions and then adversarially verified; the verifier
refuted two claims and found two things all three audits had walked past.

### 8.1 Evidence content type becomes script in a colleague's browser — FIX FIRST

`sanitizeEvidenceContentType` (`railsService.ts:2535-2539`) shape-checks only
`type/subtype`, and RCA's `normalizeEvidenceContentType`
(`rcaService.ts:2549-2559`) explicitly permits `text/...`. Both are echoed back as
the response content type with `Content-Disposition: inline`
(`railsRoutes.ts:641-643`, `rcaRoutes.ts:453-454`), and the web app then reissues
the bytes as a `blob:` URL **on its own origin**
(`RailsWorkspace.tsx:2084-2085`, `EvidenceLibraryWindow.tsx:522-523`).

Nothing blunts it. A blob document inherits the CSP of the page that created it,
and the web app has no Content-Security-Policy at all — not in `firebase.json`,
not in `index.html`, nowhere. The evidence library is tenant-wide rather than
per-item (`railsService.ts:2783-2799`), so one uploader reaches every viewer.

This is the only finding on the list that gives an attacker script execution as
another logged-in employee. It subsumes the rest: script running as a viewer can
close an RCA, reopen a session, end a live meeting and overwrite transcript
segments on that person's behalf, with their token.

**Fix.** A render-safe allowlist instead of a shape regex in both normalizers;
`Content-Disposition: attachment` on both routes; stop the `createObjectURL` plus
`window.open` pattern in the two web components. Add a CSP to the web app. None
of it changes shipped-module logic.

### 8.2 RCA closure is enforced only by the interface

The entire twenty-field Approval and Closure review exists in
`RcaWorkspace.tsx`. `PATCH /api/rca/incidents/:id` with `{"status":"CLOSED"}`
closes an RCA with nothing filled in: `rcaRoutes.ts:78-83` accepts the status and
`rcaService.ts:1019-1021` is the whole handling. `normalizeIncidentStatus` only
coerces.

And closure is permanent — the post-closure freeze at `rcaService.ts:991-993` is
real — so a fabricated closure cannot be undone. In food manufacturing that
record is regulatory evidence.

The actor must already be a participant on the canvas, so this is insider record
tampering rather than a tenant-wide primitive. It is still a blocker.

Related, same module: `updateRcaSession` (`rcaService.ts:1126-1157`) calls
neither `assertSessionIsEditable` nor `assertIncidentIsEditable`, and
`normalizeSessionStatus` maps anything unrecognised to ACTIVE — so a closed
session can be reopened by sending a status. And in the interpreter,
`startInterpreterMeeting` and `endInterpreterMeeting`
(`interpreterService.ts:1080-1136`) write the status unconditionally, while
`deleteInterpreterMeeting` immediately below them checks properly.

**RAILS is the counter-example and the pattern to copy.**
`validateRailsStatusTransition` (`railsService.ts:4292`) genuinely enforces
New → Triaged → In Progress → Verification → Approved → Closed with per-stage
blockers, and is wired at three call sites rather than merely defined.

### 8.3 Three WebSockets validate nothing and bypass every middleware

`rcaRealtimeService.ts:397-420`, `chatRealtimeService.ts:188-206` and
`callRealtimeService.ts:184-202` all `JSON.parse` a frame, type-assert on
`message.type`, and return it. RCA then hands `message.input` straight to the
same `createRcaNode` and `updateRcaNode` the HTTP routes validate with
`nodeBodySchema`.

All three construct `WebSocketServer` with only `{ noServer: true }`, so the
`ws` default payload cap of 100 MiB applies — against `express.json({ limit:
'8mb' })` on the HTTP side. And the upgrade is handled in `server.ts` outside the
Express chain, so `enforceDeviceBinding` and `verifyAppCheck` never run on any of
them.

`relaySignal` (`callRealtimeService.ts:328-353`) forwards `message.payload`
verbatim to another user's socket with no shape or size check, so an oversized
frame is amplified to a peer rather than merely costing this server.

**Fix.** Parse with the schema that already exists before calling the writers;
pass `maxPayload` to all three servers.

### 8.4 Prompt injection: real, and there is a tool the model can call

Seventeen OpenAI call sites. RAILS and RCA keep instructions in a system entry
but concatenate customer context into the user turn unfenced. The interpreter is
worse: the **meeting name** — a bare `z.string().trim().min(2).max(140)`,
settable by any tenant user for up to fifty invitees — is placed last in the
realtime session `instructions` (`interpreterService.ts:2872, 2898`), in the TTS
`instructions` (`:2114, :4705, :4870`) and in the transcription prompt
(`:2716`). Raw transcript slices go into TTS `instructions` inside unescaped
quotes (`:2119, :2122`, and a third site at `:2112-2114` the audit missed).

There is one declared tool, `lookup_backend_approved_knowledge` (`:2813, :2926`),
whose invocation the model decides and the phone executes as an authenticated
POST. It is currently read-only, rate limited and audited — which is what keeps
this serious rather than a blocker.

Model output is parsed as JSON and, on parse failure, the raw body is spoken and
stored (`:5149-5178`). Summaries and segment translations are stored and re-fed
into TTS, which is where a single injection becomes persistent.

**One genuine relief:** nothing renders model output as HTML or markdown
anywhere, and there is no `dangerouslySetInnerHTML` or `.innerHTML` in backend,
web or mobile. So injected output cannot become script.

**Fix.** Fence customer text rather than concatenating it; keep the meeting name
out of instruction channels entirely and put it in a data field; constrain the
name's charset; treat model output as untrusted at the parse boundary rather than
falling back to speaking the raw body.

### 8.5 Upload size limits are declared and never measured

`getSignedStorageUrl` (`chatMediaService.ts:398-412`) passes no
`extensionHeaders`, so the write URL carries no `x-goog-content-length-range` and
has no cap at all. Completion checks only `.exists()`
(`chatMediaService.ts:227-231`, `actionService.ts:1548-1562`). The declared size
is a number the client sent.

**RAILS does this correctly** at `railsService.ts:2512-2521`, with a real
`getMetadata()` size comparison — so the fix is to copy the sibling.

### 8.6 A client-controlled document id overwrites another person's transcript

Found by the verifier, not by any of the three audits.
`interpreterService.ts:1199-1203` builds `segmentId = itr_${versionId}` from the
client's own `versionId` and writes `.doc(segmentId).set(segment, { merge: true })`
at `:1225-1226` with no check that the existing document's `createdByUid` matches
the caller. The mobile app pins a well-known literal `'saved-transcripts'` as one
version id.

So any invited participant can overwrite another participant's stored transcript
segment in a live meeting. The translation path beside it uses a server-generated
random id (`:1289`) and is safe — the pattern was understood and simply not
applied here.

### 8.7 Formula injection in the two backend CSV builders

`complianceExportManifest.ts:231-238` and `railsService.ts:3767-3774` quote a
cell only when it contains `"`, `,` or a newline. A cell beginning `=`, `+`, `-`
or `@` is executed by Excel when the file is opened, and both carry user-typed
free text — display names in the eDiscovery manifest, titles and reasons in the
RAILS export.

**The three web builders already do this correctly**
(`web/src/announcementExport.ts:22-26`, copied by `auditExport.ts` and
`actionExport.ts`), so the backend simply never picked it up.

### 8.8 What was checked and found sound

Recorded so it is not re-audited, and because some of it corrects an assumption
in this plan.

- **Input validation is genuinely good.** Of 316 route handlers, exactly one
  mutating route reads `req.body` without a zod parse (`complianceRoutes.ts:734`).
  Every `z.array` carries a `.max()`; every `z.string()` carries a `.max()`, a
  `.regex()` or `.datetime()`.
- **A non-strict `z.object` strips unknown keys, it does not accept them.** This
  was assumed to be a risk and is not. There is no `.passthrough()`,
  `.catchall()`, `z.any()` or `z.unknown()` anywhere in routes or services, so no
  unknown key can reach Firestore through a spread of a parsed body.
- **No output is rendered unescaped.** No `dangerouslySetInnerHTML`, no
  `.innerHTML`, and the compliance transcript escapes every interpolation.
- **Route parameters reaching `.doc()` are not a cross-tenant risk.** Express
  decodes `%2F` into a literal slash and Firestore accepts it, but the tenant
  segment always comes from the session, so the worst case is a same-tenant
  redirect and a 500.

## Step 7 — Procurement

### 7.1 SSO and SCIM

No SSO, no SAML, no OIDC, no SCIM. Authentication is SMS one-time-code only, and
that is the only factor. `authSessionService.ts:26-41` blocks any token without
`phone_number`; a grep for saml/oidc/scim/okta/entra/workos across backend, web
and mobile returns zero matches. The only non-phone path is Google sign-in for
Synzapp's own staff (`staffAccessService.ts:94`).

Every enterprise questionnaire asks both. Two no answers, and for most IT
departments the SSO answer alone ends the evaluation — the app becomes an
identity island their offboarding process cannot reach.

**Fix.** A product decision, not a bug fix. At minimum: SAML 2.0 or OIDC for the
web console (Firebase Auth supports both as providers, so this is an
auth-provider addition plus a tenant-to-provider mapping on the organization
document, not a rewrite), and SCIM 2.0 provisioning mapped onto the existing
`approvedPhones`/`identityDirectory` lifecycle. Keep phone sign-in for frontline
staff with no corporate identity — enterprises accept that split.

### 7.2 What no code will fix

- SOC 2 Type II. Twelve months of evidence; the audit trail work above is a
  prerequisite, not a substitute.
- An independent penetration test, with the report available under NDA.
- A Data Processing Agreement naming every sub-processor — which requires 5.1
  and 5.2 to be settled first, because the DPA has to state what Synzapp can
  decrypt and what leaves for OpenAI.
- A published incident response and breach notification process with committed
  timelines.

---

## Deliberately not doing now

Recorded so they are decisions rather than oversights.

- **`normalizeNodeDetailFields` accepts any key** (`rcaService.ts:2803-2823`). It
  caps at 80 entries, sanitises keys and truncates values, and is never called
  raw on a write path. Essentially no security impact. Higher value for the same
  hour: confirm the RCA export builders prefix CSV cells against formula
  injection.
- **Firestore rules cost 3–8 document reads per evaluation**
  (`firestore.rules:38-47, 54-60, 62-69`) against a limit of ten. A cost and
  headroom issue, not a security one, and largely moot once 1.2 and 1.3 close the
  highest-traffic rules.

## Refuted

- **Realtime chat sessions are not revalidated.** They are.
  `ensureRealtimeSessionStillActive` is called at six sites in
  `chatRealtimeService.ts`. The agent reporting otherwise had read half the file.
- **The storage rule exposes RCA evidence.** It does not — the backend writes to
  a different path. The rule is still live and still a problem for a different
  reason, which is why it is at 1.4 rather than here.
