# Exported meeting documents: security and compliance

Source of truth for how a meeting summary or transcript may leave Synzapp.

Written because the export feature shipped working and **not** compliant. The
five gaps below were identified in review before any customer found them, and
this document records what each one is, why it matters, and what was done.

## The principle

**An export is a different act from reading.** Reading a summary on a phone
leaves the record inside Synzapp, where it is access-controlled, retained to
policy and auditable. Exporting produces a file that leaves entirely — it is
forwarded, filed, attached to disputes and read by people who were never granted
anything. Everything below follows from taking that difference seriously.

## Gap 1 — Exports had no retention

**What was wrong.** Every export was written to Cloud Storage and served by a
signed link. The link expired; the file did not. The interpreter has a 90-day
retention policy, and exports quietly outliving it is the kind of contradiction
that surfaces in a security review rather than in testing.

**What was done. Nothing is stored at all.** The document is built in memory and
returned in the response. There is no object to retain, no link to forward after
it expires, and no bucket to sweep. A copy that does not exist cannot leak, and
cannot outlive a policy.

This is stricter than a lifecycle rule and simpler than one.

## Gap 2 — Anyone who could read could export

**What was wrong.** Any member of a meeting could produce a file and walk out
with it. The action was audited but not permissioned, so the audit recorded
something nobody had been allowed or denied.

**What was done.** A distinct permission, `interpreter.export`, in the role
catalogue, so it is granted per role rather than decided in code.

**Who grants it: the tenant's own ORG_ADMIN**, from the mobile app under
Settings → Roles and permissions. `requireRoleAdmin` requires the `ORG_ADMIN`
role *and* `roles.manage`, and everything it writes is scoped to that admin's own
`tenantId`. No Synzapp employee is involved, and no tenant can alter another's
roles.

This is worth stating plainly because there are two kinds of decision in this
product and they are easy to confuse:

| Decision | Who decides | Where |
| --- | --- | --- |
| Which roles in *this* company may export | That tenant's ORG_ADMIN | Mobile → Settings → Roles |
| Anything spanning tenants, or Synzapp's own settings | Synzapp staff | admin.synzapp.com |

Export permission is the first kind, and belongs in the tenant's hands.

Org and system administrators hold it inherently, so nobody is locked out of
their own data by the change; everybody else is granted it deliberately.

A denied export is audited too. Refusals are the entries a reviewer looks for.

## Gap 3 — Nothing said the documents were confidential

**What was wrong.** No classification, no handling instruction, no marking of
any kind. Once a `.docx` is forwarded there is nothing on the page telling the
tenth recipient it was not meant for them.

**What was done.** Every page carries a classification band naming the company
and stating the document is internal and not for distribution. It sits under the
header on the first page and repeats in the footer of every page, because a
document is read from whichever page it was forwarded on.

## Gap 4 — A translated transcript did not say it was translated

**What was wrong, and it is the one that could mislead somebody.** A transcript
exported in a language nobody spoke was translated on the way out, and the
document said nothing about it. For a summary that is unremarkable. For a
transcript — which is a record of **what was said** and may end up in front of
somebody deciding a dispute — presenting a machine translation as the words
spoken is the most serious of these five.

**What was done.** Where the export language differs from the language spoken,
the document says so on the page, naming both languages, and the words are
described as a translation rather than as a transcript. Where they match, it
says the transcript is in the language it was spoken in.

## Gap 5 — Nothing could show a document had been altered

**What was wrong.** A `.docx` is editable. A summary could be changed and
forwarded as an original, and Synzapp had no way to say whether a document
presented to it was the one it produced.

**What was done.** Every export records a SHA-256 of the exact text, printed on
the document as a short reference and written in full to the audit event. A
document in dispute can be checked against the audit log: recompute the digest
of the text and compare. It does not prevent alteration — nothing short of
signing does — but it makes alteration **detectable**, which is what a record
needs.

## What is deliberately not done

- **Cryptographic signing.** Detection is proportionate here; signing means key
  custody, rotation and a verification tool customers must be taught to use.
  Worth doing when a customer asks; not worth pre-empting.
- **Visible watermarking of every page.** The classification band does the same
  work legibly. A diagonal watermark makes a document harder to read and is
  removed as easily as it is added.
- **Blocking export by device or network.** That is a mobile device management
  concern, and pretending to solve it in an app is theatre.
