# Synzapp Staff Console — Plan

**Source of truth for the operator-facing surface.** Synzapp the company needs a
place to answer its customers, publish its policies, and see the health of the
organizations that use the product. This document says what that is, what it is
deliberately not, and why.

Last updated: 30 August 2026.

---

## The rule everything else follows

**Synzapp staff cannot read customer messages, and nothing in this console may
change that.**

The product's central claim is that a conversation is readable only by the
people in it. Messages are encrypted on the sending device, and Synzapp holds no
key that opens them. A support tool that let staff "just look at the customer's
chat to help them" would destroy the one property the product is sold on.

So the console is built to answer support **about** a customer without reading
**from** them. Staff can see that an organization raised a question, when, and
what they typed into the form. Staff cannot see a single message, attachment or
meeting.

This is not a policy that could be relaxed later without a rewrite. It is a
consequence of where the keys live.

---

## What this is

| Surface | Purpose |
|---|---|
| Support inbox | Requests from customers and enquiries from the public site, with state and replies |
| Policy publishing | Privacy and terms, edited and published as versions, with history |
| Organizations | Which organizations exist and their basic health |

## What this is not

- **Not a way into customer data.** No chat, no interpreter recordings, no
  compliance exports.
- **Not a second product.** It is an internal tool and should look like one:
  dense, fast, unglamorous.
- **Not a role in the customer app.** See below.

---

## Identity: why not the existing `SYSTEM_ADMIN` role

The product already has a `SYSTEM_ADMIN` role, honoured across the interpreter,
group chat, Leaders Standard Work, device identity and AI policy services.

**The console must not use it.** That role lives in the customer identity
system, reached by phone sign-in, and every service already grants it elevated
access. One compromised account, or one missing check in one service, and a
Synzapp employee is inside a customer's data. It is also the first thing a
buyer's security review asks about, and "our staff use an admin role in the same
app" ends that conversation.

**Staff identity is separate and additive:**

1. Sign in with a Google Workspace account on the company domain — never a phone
   code, never a password Synzapp stores.
2. The email domain alone is **not** sufficient. A record must exist in the
   staff list marking that person active. Domain checks alone fail the day
   somebody registers a lookalike account or the domain is misconfigured.
3. Both conditions are required on every request. Neither is cached.

Removing somebody is one change in the staff list, and their access ends on the
next request. Their Workspace account being disabled ends it as well.

---

## Where it runs

| | Decision | Why |
|---|---|---|
| Database | **Shared** with the product | A support request must name the organization that raised it, and the public site must read the published policy. Two databases would mean copying between them. |
| Backend | **Same service**, routes under `/api/staff/*` | The boundary that matters is which requests are authorized, not which machine answers. A second service doubles what a small team deploys and patches. |
| Console site | **Separate site** on its own subdomain | Customers should never download staff code, and the public site should never show a staff sign-in. |

**When to split the backend:** when Synzapp has employees who are not
administrators of everything. A separate service lets staff code and customer
code fail independently. That is a contained job later, and the wrong cost now.

---

## Policy publishing, and why it is not a code change

Today the privacy policy is text compiled into the website. Changing it means
editing source and deploying, which fails three things an enterprise buyer
checks:

- **Version history.** Buyers compare this year's policy to last year's before
  renewing. Compiled text leaves nothing to compare.
- **Attribution.** "When did you begin sending meeting audio to a third party,
  and who approved that wording?" needs an answer with a name and a date.
- **Who can edit.** A solicitor cannot edit source code, so their wording gets
  retyped by an engineer — which is how a policy drifts from what the software
  actually does.

**The design:** policies are stored as versions. A draft can be edited freely. A
published version is never modified again — publishing creates a new version and
moves the pointer. The public site reads the published version at request time,
so a wording change is a save, not a deployment. Every past version stays
readable at its own address.

**Rule: a published version is immutable.** A policy that can be edited after
publication is not evidence of anything.

---

## Security decisions worth keeping

- **Staff actions are audited** — who, what, when — including reading the
  support inbox. Support access that nobody can account for later is
  indistinguishable from browsing.
- **The public enquiry form is write-only.** Nothing returns a list, and the
  acknowledgement is identical whatever happens, so it cannot be used to probe
  what is already held.
- **Support requests carry the organization from the session**, never from the
  form. Nobody can raise a request in another company's name.
- **No customer content is reachable** from any staff route. Enforced by the
  routes that exist, not by a filter that could be forgotten.

---

## Build order

| | Work | State |
|---|---|---|
| 1 | Staff identity: Workspace sign-in plus an active staff record | |
| 2 | Support inbox: list, filter, change state, reply | |
| 3 | Policy versioning: draft, publish, history, public read | |
| 4 | Organizations list: who exists, basic health | |
| 5 | Notification when a request arrives | |

Steps 1–3 close gaps that exist now. Steps 4–5 are improvements on a working
system.

---

## Scope boundary — do not cross

This console covers Synzapp's own operations. It does not read, modify or reach
customer chat, interpreter, or compliance data, and it must not acquire the
ability to. The Interpreter AI and every other part of the product remain out of
scope for changes made under this plan.
