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

### 2.3 Sign-out revokes nothing, and no session has a lifetime

`POST /api/auth/logout` verifies the token, writes an audit event and returns
`{ok:true}` (`authRoutes.ts:193-233`). No `revokeRefreshTokens` anywhere. No
idle timeout, no absolute age, no forced re-auth in backend, web or mobile. The
only step-up in the product is the 10-minute window on the mobile seat claim
(`deviceIdentityService.ts:1032-1038`). A Firebase refresh token lives until
explicitly revoked.

This matters operationally in your verticals: warehouse and plant floors share
tablets, and a signed-out shift worker's credential is still live.

**Fix.** Revoke refresh tokens on logout. Add a tenant-configurable absolute
lifetime and idle timeout enforced in `buildAuthSession` by comparing
`decodedToken.auth_time` against a policy on the organization document — the
machinery already exists in `isTokenOlderThan` (`authSessionService.ts:216-221`).
Add step-up re-auth before privileged admin actions: employee deactivation,
compliance export, retention change.

### 2.4 The rate limiter is per-instance for everything except two routes

`middleware/rateLimit.ts:26` holds buckets in a module-level Map. The durable
Firestore counter built this session is consulted only when `options.durable` is
set (`:40-42`), which only the OTP preflight and session routes do
(`authRoutes.ts:34, 75`). On Cloud Run the effective limit everywhere else is the
configured limit multiplied by the instance count.

**Fix.** Make the durable path the default for authentication-adjacent limits.

---

## Step 3 — The session model, built

This is the step that implements the decisions recorded at the top.

### 3.1 Mobile: a six-digit PIN with biometric unlock

The design point that matters: **the PIN has to gate the local chat database
key**, not just draw a lock screen. A PIN that only hides the UI is defeated by
reading the device's storage; a PIN that derives the key means a locked app has
nothing readable in it.

Needs `expo-local-authentication` (a native dependency, so a rebuild), PIN setup
during onboarding, a re-auth screen on cold start and on return from background
past a threshold, a lockout after repeated failures, and a recovery path that
does not become a bypass.

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

### 4.1 SYSTEM_ADMIN is a fully-privileged role nothing assigns

Accepted as a valid session role (`authorizationPolicy.ts:190-197`) and granting
org-wide authority across interpreter export and management
(`interpreterService.ts:1678, 5232, 5240`), RAILS approvals
(`railsService.ts:5088, 5183`), LSW (`lswService.ts:2124, 3862, 3873`) and AI
policy (`tenantAiPolicyService.ts:473`). No code assigns it — but one path
derives it from a free-text role **name**.

**Fix.** Delete the role, or give it a documented, audited provisioning path.
Delete the role-name fallback in `railsService` either way: authority must never
be derived from a display string.

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

### 4.5 One static shared secret authorises cross-tenant destruction

`complianceRoutes.ts:427-456` (`/retention/scheduled-run`, runs retention across
every tenant) and `:600-632` (`/exports/:exportId/run`, packages an export for
any `tenantId` in the body) authorise on `X-Synzapp-Scheduler-Secret`. The
comparison is constant-time and fails closed if unset (`:746-755`, `:429-435`) —
that part is right. There is no rotation path and no audit event when it is used.

**Fix.** Move to Cloud Run service-to-service OIDC identity tokens. Failing that:
rotate on a schedule, use a distinct secret per job, and write an audit event on
every invocation naming the tenant affected.

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

### 5.3 A compliance export is an unencrypted zip behind a 24-hour bearer link

Built as a plain JSZip with decrypted message bodies and media
(`complianceExportService.ts:296, 304, 632, 659`), written to
`complianceExports/{tenantId}/{exportId}.zip`. `createComplianceExportDownloadUrl`
signs a v4 read URL with a 24-hour TTL (`:72`, used at `:890-899`). A signed URL
is a bearer credential that bypasses Storage rules entirely. The gating itself is
sound (`requireComplianceAdmin`, `complianceAccess.ts:30-32`) — only the link is
the problem.

**Fix.** Cut the TTL to an hour, or stream the download through an authenticated
API route. Encrypting the zip to a key the requesting admin already holds is
better still.

### 5.4 Export bundles carry no integrity digest

`complianceExportManifest.ts:59-81` defines the manifest with no hash field, and
`createHash` appears nowhere in `complianceExportService.ts`. The same codebase
already does this correctly for the interpreter —
`interpreterService.ts:1550-1552` stores a `contentDigest` with the comment "the
digest is what makes a dispute settleable". An eDiscovery bundle whose contents
cannot be verified after handover is worth much less in the proceeding it was
produced for.

**Fix.** SHA-256 every file as it is added to the zip, record the digest per
entry, and add a manifest-level digest. A few lines, given the pattern exists.

### 5.5 Offboarding a customer leaves decrypted copies in the bucket forever

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

**Fix.** Before `recursiveDelete`: delete the `complianceExports/{tenantId}/`
prefix, recursively delete `tenants/{tenantId}`, and delete the tenant's
root-collection audit documents. Add a standalone orphan sweep that lists Storage
prefixes and `tenants/` docs with no matching `organizations/` document.

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

### 6.1 The tenant audit console cannot show a single failure

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

**Fix.** Resolve `tenantId` before the try block and pass it on every
failure-path write. Add DENIED events to `complianceRoutes` for
`requireComplianceAdmin` rejections and scheduler-secret mismatches. A shared
error-handler hook stops it regressing.

### 6.2 A legal hold does not protect the audit log

`retentionScheduleService.ts:102` calls `disposeExpiredAuditEvents` inside
`runTenantRetention`. `auditDisposalService.ts:1-6` never imports or calls
`listActiveLegalHolds` — confirmed, the grep returns 0. Every other destruction
path re-checks holds (`dispositionShredderService.ts:110, 121-132`;
`actionService.ts:1241-1245`). So while a tenant is under a preservation
obligation, the nightly job keeps deleting the events proving who accessed and
altered the preserved material. Any buyer with in-house counsel will read that as
spoliation exposure.

**Fix.** Call `listActiveLegalHolds(tenantId)` at the top of
`disposeExpiredAuditEvents` and return immediately with a `heldBack` count when
any hold is active. Audit events are the one class that should never age out
under a hold — they are the evidence about the evidence.

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

### 6.5 The invite audit records a role that was discarded

`adminRoutes.ts:1233-1244` writes `EMPLOYEE_INVITES_CREATED` with
`roleId: body.roleId` — the role the admin selected, which
`employeeInviteService.ts:265-266` has already thrown away (see 1.1). An auditor
reading the log for a new org admin sees "invited as Forklift Operator". The
trail does not merely omit the promotion, it misstates it.

**Fix.** Return the effective role and permissions from `inviteEmployeeContacts`
(already in the response object at `:396-397`) and log those alongside the
requested `roleId`. One hour.

### 6.6 The audit log's IP address is attacker-controlled

`middleware/rateLimit.ts:77-85` `getClientIp` returns the **first** entry of
`X-Forwarded-For`. On Cloud Run the platform *appends* the real peer address, so
the first entry is whatever the client sent. `auditService.ts:20` stores it
verbatim and `auditExport.ts:42` writes it into the auditor CSV. `trust proxy` is
not configured in `app.ts`, so the `req.ip` fallback is unreliable too.

**Fix.** Take the second-to-last entry, or set `app.set('trust proxy', <hops>)`
and use `req.ip`. Until then, do not present the IP column as evidence.

### 6.7 The whole retention configuration is dead code

`auditDisposalService.ts:58-63` reads `recordRetentionDays` and
`auditRetentionDays` from the organization document;
`recordBodyDisposalService.ts:39` reads the former. A full-repo grep finds **no
write site for either**. Three consequences: audit retention always collapses to
`bounds.minimumDays` (365 on the data-minimising template) with no tenant control
and no field in `RetentionConsole.tsx`; the stated invariant "audit outlives the
records it describes" (`auditRetentionRules.ts:88-91`) can never fire; and
`disposeExpiredRecordBodies` returns early on every run, so action and
announcement bodies are never aged out at all.

**Fix.** Add an audit retention control to the compliance console that writes
`auditRetentionDays` within the published bounds, and derive
`recordRetentionDays` from the tenant's active policies. Until then make
`disposeExpiredRecordBodies` report an explicit NOT_CONFIGURED state rather than
a zero that looks like success.

### 6.8 Retention only ever examines the same first 500 conversations

`retentionEvaluatorService.ts:46` sets `MAX_CONVERSATIONS_PER_RUN = 500`;
`:90-92` runs `.limit(500).get()` with no `orderBy` and no `startAfter`.
Firestore's default order is by document name, so every nightly run re-reads the
identical first 500 documents. Any tenant larger than that has a permanent tail
that is never evaluated, never queued and never deleted.

**Fix.** Persist a per-tenant cursor on the tenant settings doc, order by
`__name__`, and resume from it each run so the scan wraps the whole collection
over successive nights.

### 6.9 The product displays a retention commitment it does not implement

`orgAdminProfileService.ts:154` stamps every new organization with
`retentionPolicy: '3_YEARS'`. `companyProfileService.ts:311` returns it and
`mobile/src/components/settings/CompanyProfileSettings.tsx:173` renders it as the
Retention row. Nothing in any retention service reads that field — they read the
`retentionPolicies` subcollection and `recordRetentionDays`.

**Fix.** Delete the field and the UI row, or make the screen read the tenant's
actual active policies. Do not ship a screen stating a retention period the
system does not enforce.

### 6.10 Audit disposal is capped at 200 events per tenant per night

`auditDisposalService.ts:21` sets `DISPOSAL_BATCH_SIZE = 200`; `:78-83` fetches
one page; `:104` breaks on the first non-disposable document;
`retentionScheduleService.ts:102` calls it once per tenant per run. A tenant
generating more than 200 expired events a day accumulates indefinitely, so the
stated retention period is not actually enforced.

**Fix.** Loop within the run until a page contains a non-expired event, with a
wall-clock budget so it cannot dominate live traffic.

### 6.11 The root `auditLogs` collection is a permanent cross-tenant PII store

`auditService.ts:31` writes every event there with `uid`, `phoneMasked`,
`ipAddress` and full metadata. Grep finds that one write site — no read path, no
delete path. `auditDisposalService` disposes only the tenant subcollection, and
`recursiveDelete` on organization deletion does not touch it.

**Fix.** Decide what it is for. If it is a tamper-evidence second copy, make that
explicit, put it behind a locked log bucket and document it in the DPA. If it is
vestigial, stop writing and purge what is there.

### 6.12 The archive search audit omits who was searched and what for

`complianceRoutes.ts:457-462` states "every search is written to the audit log
with the question that was asked… A search nobody can account for later is
indistinguishable from a fishing expedition." The actual metadata at `:479-492`
records `custodianCount`, `fromMs`, `toMs`, `holdId` and `hits` — not
`custodianUids` and not `text`. The export audit at `:544-553` has the same
omission. Since `purgeExpiredComplianceExports` deletes the export record after
30 days, after a month there is no record anywhere of whose messages an export
contained.

**Fix.** Record `custodianUids` and the search text. An admin reading one named
colleague's private messages must be attributable to that colleague by name.

### 6.13 Reading and exporting the audit log is itself not audited

`adminRoutes.ts:516-532` (`GET /audit-events`) writes no audit event.
`AuditConsole.tsx:90-122` loops until the cursor runs out and assembles the whole
log client-side, with no server-side record that an export happened.

**Fix.** Write `AUDIT_LOG_VIEWED` on the read route and `AUDIT_LOG_EXPORTED`
carrying the filters and row count. Move CSV assembly server-side and audit it
there.

### 6.14 The audit console and auditor CSV show raw Firebase UIDs

`AuditConsole.tsx:199` renders `event.actorUid`; `auditExport.ts:39` writes it
into the "Actor" column; `auditQueryService.ts:126` maps `uid` straight through.
The tenant already has a name directory — `listCompliancePeople`, used at
`complianceRoutes.ts:677`. An auditor currently receives a file of 28-character
identifiers.

**Fix.** Join against the people directory in `listAuditEvents` and add a display
name column to both the console and the CSV, keeping the UID alongside.

### 6.15 The audit console's filtered views will fail at runtime

`auditQueryService.ts:81-94` combines `orderBy('createdAt','desc')` with
`where('action','in',[...])` and `createdAt` range filters, requiring a composite
index on (action ASC, createdAt DESC). `firestore.indexes.json` holds 8 indexes
across `actions`, `pushTokens` and `tenantAiUsageEvents` only.

**Fix.** Add the composite index (collection group `auditLogs`) and deploy it.
Verify against the emulator so it cannot recur.

### 6.16 Record body disposal reports every error as a legal hold

`recordBodyDisposalService.ts:126-133` is a bare `catch` incrementing
`heldBack`, with the comment "A legal hold, almost always." A permissions error,
a Firestore outage and a code bug all report as the counter the design treats as
"the system working, not breaking".

**Fix.** Catch the named `legalHoldError` thrown by `actionService.ts:1244`
specifically, count that as `heldBack`, and let anything else surface as a
genuine failure in the run result.

### 6.17 Audit writes are not atomic with the change they describe

`auditService.ts:31-39` performs two sequential `.add()` calls outside a batch,
so the root copy can land while the tenant copy fails. Callers audit after the
mutation has committed (`adminRoutes.ts:931`, `complianceRoutes.ts:159`), so a
crash in between leaves the change with no record.

**Fix.** Use a `firestore.batch()` for the two writes. Where the mutation is
already transactional, write the event inside the same transaction.

### 6.18 The audit correlation id is client-supplied

`auditService.ts:24` takes `X-Request-Id` verbatim with no validation and no
server-side fallback, so it can be forged or deliberately collided.

**Fix.** Generate a server-side request id in middleware and store that; keep the
client value in metadata as a separate, clearly-labelled field.

### 6.19 Releasing a legal hold never checks the hold exists

`legalHoldService.ts:105-110` calls `.doc(input.holdId).set({...}, {merge:true})`
with no prior `get()`. A bad id creates a phantom released hold, which
`isHoldActive` then treats as released-with-delay, and
`complianceRoutes.ts:246-254` audits as a successful release.

**Fix.** Read the document first and throw 404 when it does not exist, the way
`approveDispositionItem` already does (`dispositionService.ts:129-131`).

---

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
