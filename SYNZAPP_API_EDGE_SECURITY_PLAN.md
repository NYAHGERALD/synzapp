# Synzapp API edge security

Source of truth for hardening the boundary in front of the Synzapp API. Written
14 September 2026, after establishing what is actually deployed rather than what
was assumed.

## What is true today

Verified against the live project, not inferred.

- The API is **Express 5** on Cloud Run, `synzapp-backend`, region `us-central1`,
  `maxScale` 3.
- **There is no API Gateway, no Cloud Endpoints and no load balancer.** The
  `apigateway.googleapis.com` and `compute.googleapis.com` APIs are both
  disabled on `synzapp-a7ee3`.
- **Cloud Run ingress is `all`.** The `run.app` URL is reachable by anyone on
  the internet. App Check and Firebase auth reject bad requests *after* they
  have arrived and started an instance.
- Clients call that `run.app` hostname directly. `web/src/config.ts:1` hardcodes
  it as the default; Firebase Hosting serves static files only and proxies
  nothing.
- Three WebSocket servers share the HTTP server: chat, calls and RCA realtime
  (`chatRealtimeService.ts:89`, `callRealtimeService.ts:85`,
  `rcaRealtimeService.ts:127`).
- Rate limiting is an in-process `Map` (`src/middleware/rateLimit.ts:16`), used
  by 22 service call sites and 3 route middlewares.

## Decision: a load balancer, not an API Gateway

**GCP API Gateway does not pass WebSocket upgrades.** Putting one in front would
take chat, calls and RCA realtime offline. For a product whose main feature is
chat that is not a trade-off, it is a non-starter.

An **HTTPS Load Balancer with Cloud Armor** gives the same edge controls, passes
WebSockets, and is the supported way to put Cloud Armor in front of Cloud Run.

This decision is recorded here so it is not revisited from the name alone: the
answer to "should we have an API gateway" is no, and the reason is specific to
this architecture rather than a general preference.

## What this closes, and what it does not

Closes:

- **No WAF or DDoS protection** beyond Google's baseline. Cloud Armor cannot
  attach to bare Cloud Run.
- **Rate limiting that is not auditable.** In-memory, per instance, across up to
  three instances — a stated 12/minute is really up to 36, and it resets
  whenever an instance recycles. A brake, not a quota.
- **No API domain.** `run.app` is what a customer's security review sees, and it
  cannot be allowlisted by anyone.

Does not close, and should not be described as closing:

The security defects found in this codebase have been inside the application,
where an edge device has no visibility — an internal Firestore id written into
a third-party AI prompt, a device lockout caused by matching prose instead of a
code, a tenant AI policy failure caught and silently swallowed, a PDF embedded
as an image because nothing checked the type. Edge hardening is worth doing. It
is not where the next incident is most likely to come from.

## Steps

### 1. Durable rate limiting on the credential surface — code, done

The public, unauthenticated routes are the ones where a per-instance counter is
least defensible: OTP preflight, session exchange, and the public contact form.
These are low volume, so the cost of a shared counter is small, and they are the
ones an attacker probes.

A Firestore-backed limiter now backs those three. Every other call site keeps
the in-process brake, which is appropriate for authenticated, high-volume reads
(interpreter transcript reading allows 240/minute per user; a transaction per
call there would be the wrong trade).

The decision logic is a pure module with tests. The store is separate, so the
rules can be exercised without Firestore.

### 2. Cloud Armor policy and load balancer — infrastructure, not yet applied

Configuration is version-controlled at `backend/infra/`. It has **not** been
applied: it is billable (roughly $20/month for the forwarding rule plus policy
costs), needs a DNS record only the domain owner can create, and must be proven
to pass WebSockets before anything depends on it.

Order matters. Applying step 3 before this one takes the product offline.

### 3. Ingress lockdown — after step 2 is serving traffic

Once the load balancer is verified end to end, including a WebSocket upgrade,
set Cloud Run ingress to `internal-and-cloud-load-balancing` so the `run.app`
URL stops being a way in.

Both client defaults must point at the new hostname first, and a mobile build
carrying the old URL must have aged out. A phone still on the old build loses
chat the moment ingress closes.

## Ownership

| Step | Who | State |
| --- | --- | --- |
| Durable rate limiting | Engineering | Done |
| Cloud Armor + LB config in the repo | Engineering | Done, not applied |
| Reserve IP, certificate, DNS record | Domain owner | Not started |
| Apply the load balancer | Whoever holds billing | Not started |
| Verify WebSockets through the LB | Engineering | Blocked on the above |
| Point clients at `api.synzapp.com` | Engineering | Blocked on the above |
| Close Cloud Run ingress | Engineering | Blocked on all of the above |
