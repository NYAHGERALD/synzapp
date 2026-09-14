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

**Two findings were raised and then refuted. They are recorded so nobody
re-raises them:** the storage rules do *not* expose RCA evidence (the rule path
does not match where the backend writes; it is an unused orphan path), and
realtime sessions *are* revalidated, at six call sites in
`chatRealtimeService.ts`.

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

## Step 1 — Dangerous now

These are live in production and are not about passing a review.

### 1.1 The HR department is an org-admin factory
Anyone invited into a department named or ided Human Resources is silently made
a full ORG_ADMIN with every permission. A department admin scoped to HR can
mint unlimited org admins for the whole tenant. The role the inviter chose is
discarded — **and the audit event records the discarded role**, so the
promotion does not appear in the trail.
`employeeInviteService.ts:260-266`, `tenantDefaults.ts:4-11`

Fix: remove the implicit promotion. If HR genuinely needs elevated rights, grant
them through the permission catalogue like everything else. Audit the role
actually granted.

### 1.2 Firestore rules allow employees to read and write all RCA data
Any employee can read every RCA incident, session, node, CAPA action and
evidence record in their company, bypassing the participant model — and can
write them too, bypassing the closed-case rules the service layer enforces.

Fix: deny client access to RCA collections outright. Nothing legitimate reads
them directly; the app goes through the API.

### 1.3 The phone-hash secret falls back to a placeholder in the repository
`phoneHash.ts` defaults to the literal string `change-this-before-production`
when the env var is unset. Phone is the only authentication factor.

Fix: fail to boot when it is unset, rather than defaulting. Confirm it is set on
the live service before shipping that change.

### 1.4 App Check is unenforced
Unenforced on every service, and the backend's own gate is off. It is not the
authentication layer, so this is not catastrophic alone — it is what makes other
holes reachable.

## Step 2 — Revocation, the prerequisite for the mobile session decision

### 2.1 Revoking a device does not revoke its tokens
`revokeTenantDevice` marks the record REVOKED and queues a wipe, but never calls
`adminAuth.revokeRefreshTokens`. The phone keeps working until it chooses to
obey a wipe order it has to ask for.

### 2.2 Device binding is enforced on two routers of thirteen
`railsRoutes`, `lswRoutes`, `rcaRoutes`, `interpreterRoutes`, `complianceRoutes`,
`actionRoutes` and `announcementRoutes` need only a valid ID token. A revoked
phone retains access to all of them.

Fix: shared middleware on every authenticated router, and extend
`apiRouteGuardCoverage.test.ts` to assert it so the gap cannot reopen.

### 2.3 Sign-out revokes nothing server-side
`POST /api/auth/logout` verifies the token, writes an audit event and returns.

## Step 3 — The session model, built

### 3.1 Mobile: a six-digit PIN with biometric unlock
- Set during onboarding, stored only as a salted hash in SecureStore — never the
  PIN itself, and never sent to the server.
- **The PIN must gate the local chat database key, not just a screen.** A lock
  screen that can be stepped around on a rooted phone protects nothing; deriving
  or releasing the key from the PIN is what makes it real.
- Attempt limit with escalating delay, then local data destruction — the Teams
  arrangement, and the reason a stolen phone is not worth brute-forcing.
- Complexity rules: no sequences, no repeats, tenant-configurable minimum.
- Face ID and fingerprint unlock the stored PIN. Biometrics are a convenience
  over the PIN and never a replacement: anyone holding the device passcode can
  enrol their own face.
- Needs `expo-local-authentication`, which is a native dependency — pod install
  and a rebuild, per `mobile/CLAUDE.md`.

### 3.2 Web: idle timeout and absolute lifetime
Enforced in `buildAuthSession` against `decodedToken.auth_time`; the machinery
already exists in `isTokenOlderThan`. Tenant-configurable, following the
established policy pattern.

### 3.3 Web: company email verification
A verified company email address as a second signal on web, using the pattern
already shipped for Synzapp's own staff console — verified address, domain
match, provider check.

**This is worth doing and it is not SSO.** It does not let a customer's IT
department provision or deprovision anybody, which is what a security
questionnaire is asking about. It improves the product; it does not close 5.1.

## Step 4 — Audit and compliance

- **A legal hold does not protect the audit log.** The nightly age-out job keeps
  deleting audit events while a tenant is under a preservation obligation.
- **RAILS, LSW and the interpreter write no tenant audit trail at all** — zero
  audit writes across 73 mutating endpoints. Three of the six modules you sell.
- **The customer-facing audit console cannot show a failed or denied attempt.**
  A tenant reads a success-only view of their own history.
- **Offboarding leaves decrypted copies of messages and attachments** in the
  Storage bucket permanently, with no owner and no expiry.
- **The retention configuration is dead code.** The two fields the disposal jobs
  read are written nowhere, and every organization is shown a "Retention:
  3 Years" commitment the engine has never heard of.
- **Retention only ever examines the first 500 conversations.** A larger tenant
  has a permanent tail that is never evaluated.
- **The IP address in the audit log is attacker-controlled**, taken from a header
  the caller sets.
- **No data subject access or erasure path** exists for an individual person.

## Step 5 — Procurement

### 5.1 SSO and SCIM
No SAML, no OIDC, no SCIM. Authentication is SMS one-time-code only. Every
enterprise questionnaire asks; two no answers usually ends the evaluation,
because the app becomes an identity island their offboarding cannot reach.

Keep phone sign-in for frontline staff who have no corporate identity.
Enterprises accept that split when administrators and office staff are
federated.

### 5.2 What no code will fix
SOC 2 Type II, a penetration test report, a data processing agreement. These are
process, time and money. They will be asked for.
