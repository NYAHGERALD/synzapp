# Root Cause Analysis — Tortilla output posted against a dough-batch production order

**Prepared for entry into the Synzapp RCA workspace.**
Every heading below is one node on the canvas. Every bullet is one field in the
Node Details panel, written as `Field label` → the exact value to type or select.

Select values are quoted exactly as they appear in the dropdown. Where a value
must come from your records rather than from the incident account, it is marked
**[CONFIRM]** — type your real value, do not leave it blank, because these are
gate fields and the canvas will not let the case close without them.

---

## Methodology: Main View (Ishikawa), with governed 5 Whys decisions

**Use Main View.** Press `M`, or use the Main View button on the control bar.

This incident has causes in five different families at once — a paper-handling
method, a training-succession failure, a staffing decision, a missing system
control and an irreversible transaction design. A bare 5 Whys chain would force
that into a single line of reasoning and quietly drop whichever branches did not
fit the line somebody started with.

Main View organises the causes by category first. Each candidate cause then gets
its own **5 Whys node**, which is where Synzapp records the governed decision —
the chain, the verification status of each step, the evidence behind it, and the
disposition that rolls back into the cause record.

So both are used, each for what it is good at: **Fishbone to find the candidates,
5 Whys to test each one to depth.**

---

# 1. Incident

The parent container. Create this first; everything else hangs off it.

| Field | Value |
| --- | --- |
| Incident ID | *(system generated — leave as shown)* |
| Incident Title | `Tortilla output posted against dough-batch production order on Line 3` |
| Incident Category | `Production` |
| Department | `Production` |
| Area / Location | `Tortilla Production — Lines 3 and 5, Sign-Out Control station` |
| Line / Machine / Process | `Line 3 tortilla output posting; mixer dough-batch posting; Sign-Out Control placard preparation` |
| Shift | **[CONFIRM]** `1st Shift` / `2nd Shift` / `3rd Shift` |
| Date of Incident | **[CONFIRM]** date the shift ran |
| Time of Incident | **[CONFIRM]** approximate shift start, when the first bad placard was used |
| Reported By | **[CONFIRM]** name of the person who raised it |
| Supervisor on Duty | **[CONFIRM]** your name, as the supervisor who prints the job cards |
| Severity Level | `High` |
| Incident Description | *(see below)* |
| Immediate Impact | *(see below)* |
| Product Affected? | `Yes` |
| Product Name / Code | **[CONFIRM]** tortilla item number and description |
| Lot Number | **[CONFIRM]** lot codes produced on the affected shift |
| Quantity Affected | `8,342 units posted as dough batches against a maximum expected of approximately 21 batches` |
| Incident Status | `Investigation` |

**Incident Description**

> Finished tortilla output from Line 3 was posted against the production order
> used for mixer flour-dough batches for most of one shift. The pallet placard
> carried a hand-written production-order number taken from the mixer job card
> rather than the tortilla job card. The output was entered manually into the
> tablet instead of being scanned from the barcode on the correct job card, so
> no system check compared what was being posted against what the order was for.
> Tortilla output is counted in dozens and dough output in batches, so the wrong
> unit of measure was also posted. The error was found only when the system
> showed approximately 8,342 dough batches against an expected shift maximum of
> about 21.

**Immediate Impact**

> Inventory records for both the tortilla item and the dough item were wrong for
> a full shift. 8,342 units were then transferred to the main plant without a
> unit-of-measure check. Because the inventory location changed during that
> transfer, the item-tracking number changed with it, and the quantities can no
> longer be reversed through the normal correction process. Both the finished
> goods balance and the dough balance now require a manual, controlled
> adjustment.

**Evidence required at this node:** none. The Incident node holds the summary
only; evidence is attached to the Evidence nodes below.

---

# 2. Incident Details

| Field | Value |
| --- | --- |
| What Happened? | *(see below)* |
| Where Did It Happen? | `Sign-Out Control station serving Lines 3 and 5; posting completed at the Line 3 tablet` |
| When Did It Happen? | **[CONFIRM]** shift date and start time |
| Who Was Involved? | `Sign-Out Control (experienced operator), Sign-Out Control (operator in training), shift supervisor, transfer driver` |
| Who Discovered It? | **[CONFIRM]** name and role of whoever noticed the dough output figure |
| Was Anyone Injured? | `No` |
| Was Product Affected? | `Yes` |
| Was Equipment Affected? | `No` |
| Was Production Interrupted? | `No` |
| Downtime Duration | `None — production ran normally; the failure was in posting, not in making product` |
| Initial Business Impact | `Quality Defect` |
| Detailed Description | *(see below)* |

**What Happened?**

> The supervisor printed the production-order job cards for Lines 3 and 5 and
> handed them to Sign-Out Control. The job cards for the mixer operation and the
> job cards for Sign-Out Control were left together in one stack on the
> preparation table rather than separated. While preparing the pallet placards
> for finished tortillas, the mixer production-order number — the one used to
> post flour-dough batches — was written onto a tortilla pallet placard.
>
> At posting, the tablet accepted a manually typed production-order number taken
> from that placard. The required step is to scan the barcode on the tortilla job
> card and verify the item number, location code, quantity, finished quantity and
> unit of measure on screen. That step was skipped, and nothing in the system
> required it.
>
> The result was that tortilla output, counted in dozens, was posted against a
> dough-batch order counted in batches, for most of the shift.

**Detailed Description**

> Normal staffing for Sign-Out Control across Lines 3 and 5 is two competent
> operators. On the shift in question one operator was still in training and the
> Spanish-speaking employee who had been training her was no longer with the
> company, leaving no bilingual trainer. The single experienced operator was
> therefore preparing paperwork for both lines and supervising a trainee at the
> same time.
>
> The error was not detected at the point of entry, at any point during the
> shift, or at transfer. It surfaced only when the dough output figure — about
> 8,342 batches against a realistic maximum of 21 — became impossible to miss on
> a report. The transfer driver had by then moved all 8,342 units to the main
> plant without checking whether the figure represented dozens of tortillas or
> batches of dough. The location change during that transfer altered the
> item-tracking number, which removed the ordinary route for reversing the
> quantities.

**Evidence required at this node:** none directly. It is the narrative record.

---

# 3. Containment

| Field | Value |
| --- | --- |
| Containment Title | `Freeze affected postings, quarantine the transferred pallets, and stop manual production-order entry` |
| Is the Issue Still Active? | `No` |
| Containment Type | `Product Hold` |
| Was Production Stopped? | `No` |
| Time Production Stopped | *(leave blank — production was not stopped)* |
| Was Equipment Isolated? | `Not Applicable` |
| Lockout/Tagout Required? | `Not Applicable` |
| Was Product Placed on Hold? | `Yes` |
| Hold Tag Number | **[CONFIRM]** hold tag issued for the transferred pallets |
| Quantity on Hold | `8,342 transferred units, pending reconciliation to true tortilla dozens` |
| Was QA Notified? | `Yes` |
| Was Safety Notified? | `Not Applicable` |
| Was Maintenance Notified? | `Not Applicable` |
| Was Warehouse Notified? | `Yes` |
| Temporary Fix Applied? | `Yes` |
| Temporary Fix Description | *(see below)* |
| Containment Owner | **[CONFIRM]** name of the person who owned containment |
| Containment Status | `Completed` |
| Containment Completion Time | **[CONFIRM]** date and time containment finished |

**Temporary Fix Description**

> Three immediate measures, all manual and all temporary pending CAPA:
>
> 1. Sign-Out Control instructed, in writing and in both languages, that
>    production-order numbers must be scanned from the job card barcode. Manual
>    entry is not permitted until the system enforces it.
> 2. Mixer job cards and Sign-Out Control job cards are physically separated at
>    the point of printing — different coloured trays, handed over separately.
> 3. A supervisor check of the first placard of every shift for Lines 3 and 5,
>    verifying the production-order number against the job card before any output
>    is posted.
>
> These are controls that depend on people remembering. They are containment, not
> the fix.

**Evidence required at this node — 3 items**

| # | What | Type to select | Amount |
| --- | --- | --- | --- |
| C1 | Photograph of the product hold tag on the quarantined pallets | `Photo` | 1–2 photos |
| C2 | The written work instruction issued to Sign-Out Control (both languages) | `SOP / Work Instruction` | 1 document |
| C3 | The product hold record raised in the system | `Product Hold Record` | 1 record |

---

# 4. Problem

| Field | Value |
| --- | --- |
| Problem Statement | *(see below)* |
| Expected Standard | *(see below)* |
| Actual Condition | *(see below)* |
| Measurable Gap | *(see below)* |
| RCA Analysis Scope | *(see below)* |
| Out of Scope | *(see below)* |

**Problem Statement**

> Finished tortilla output was posted against a flour-dough production order for
> most of one shift because the posting system accepted a manually typed
> production-order number without requiring the job card barcode scan, and
> without validating the unit of measure or the plausibility of the quantity.

**Expected Standard**

> Sign-Out Control scans the barcode on the production-order job card for the
> item being posted, verifies on screen the item number, location code, quantity,
> finished quantity and unit of measure, and only then posts the output. Output
> in dozens is posted against an order denominated in dozens. Any quantity far
> outside the achievable range for a shift is stopped by the system before it is
> committed.

**Actual Condition**

> A production-order number was hand-copied from a mixer job card onto a tortilla
> pallet placard and typed into the tablet from the placard. No scan was
> performed and none was required. Tortilla output measured in dozens was
> accepted against a dough order measured in batches. Approximately 8,342 batches
> were committed with no warning, and the resulting stock was transferred without
> any downstream check.

**Measurable Gap**

> Expected maximum dough output for the shift: approximately **21 batches**.
> Actually posted: **8,342 batches** — roughly **397 times** the achievable
> figure, committed across an entire shift with zero system or human
> interception at any of the four points where it could have been caught: entry,
> in-shift review, transfer, and receipt.

**RCA Analysis Scope**

> The production-order job card handling process for Lines 3 and 5 from printing
> through placard preparation; the output posting transaction and its system
> controls, including barcode enforcement, unit-of-measure validation and
> quantity plausibility limits; the training and staffing arrangements for
> Sign-Out Control; the pallet transfer verification step; and the reversibility
> of posted quantities after an inventory location change.

**Out of Scope**

> Tortilla and dough product quality — no product was mis-made and nothing
> physical was wrong with what was produced. Line equipment performance,
> maintenance, sanitation and food safety are also out of scope. The individual
> conduct of the employees involved is expressly out of scope; this analysis
> examines the process, training, staffing, verification and system controls that
> allowed a single transcription slip to run unchecked for a shift.

**Evidence required at this node:** none. It defines the gap.

---

# 5. Evidence nodes

Create these as separate Evidence nodes and connect each to the cause it proves.
Verify every one — the canvas will not accept `Pending Review` at closure.

For each: `Evidence Verified?` → `Yes`, and `Verified By` → **[CONFIRM]** name.
`Date Collected` and `Time Collected` → **[CONFIRM]**.

### E1 — The two job cards
| Field | Value |
| --- | --- |
| Evidence Title | `Mixer and tortilla job cards for the affected shift` |
| Evidence Type | `Production Record` |
| Evidence Category | `Method` |
| Evidence Description | `The two printed job cards, showing the mixer dough production-order number and the tortilla production-order number, demonstrating how similar they appear on paper and that both were in one stack.` |
| Collected By | **[CONFIRM]** |
| Source of Evidence | `Shift job card print run, Lines 3 and 5` |
| Evidence Relevance | `Supports Cause` |

**Attach: 2 photographs** — one of each job card, production-order number legible.
**Verification document: 1** — the job card print log or ERP print record proving both were printed in the same run.

### E2 — The incorrect pallet placard
| Field | Value |
| --- | --- |
| Evidence Title | `Tortilla pallet placard carrying the mixer production-order number` |
| Evidence Type | `Photo` |
| Evidence Category | `Method` |
| Evidence Description | `The finished-tortilla pallet placard with the hand-written mixer dough production-order number, which is the number that was typed into the tablet.` |
| Collected By | **[CONFIRM]** |
| Source of Evidence | `Quarantined pallets, Line 3` |
| Evidence Relevance | `Supports Cause` |

**Attach: 2–3 photographs** — the placard in full, a close-up of the written number, and one showing it on the pallet.
**Verification document: none required** — the placard is the artefact itself.

### E3 — The posting transaction record
| Field | Value |
| --- | --- |
| Evidence Title | `Output posting transactions for the affected shift` |
| Evidence Type | `Machine Data` |
| Evidence Category | `Measurement` |
| Evidence Description | `System transaction log for the shift showing each posting against the dough production order, the entry method, the user, the timestamp and the quantity — establishing that entries were manual rather than scanned, and that 8,342 batches accumulated across the shift without interception.` |
| Collected By | **[CONFIRM]** |
| Source of Evidence | `ERP / production posting transaction log` |
| Evidence Relevance | `Supports Cause` |

**Attach: 1 export** — the full transaction list for the shift (PDF or spreadsheet).
**Verification document: 1** — IT or systems confirmation that the log distinguishes scanned from keyed entries. **This is the single most important piece of evidence in the case**; it is what proves the control was bypassable rather than merely bypassed.

### E4 — Dough output report showing the impossible figure
| Field | Value |
| --- | --- |
| Evidence Title | `Shift dough output report showing 8,342 batches against ~21 expected` |
| Evidence Type | `Production Record` |
| Evidence Category | `Measurement` |
| Evidence Description | `The report on which the error was discovered, showing posted dough batches for the shift beside the achievable maximum.` |
| Collected By | **[CONFIRM]** |
| Source of Evidence | `Production reporting system` |
| Evidence Relevance | `Supports Cause` |

**Attach: 1 report export.**
**Verification document: 1** — the mixer capacity or standard-rate document establishing that ~21 batches is the true shift maximum. Without it, "impossible" is an assertion.

### E5 — Training records for Sign-Out Control
| Field | Value |
| --- | --- |
| Evidence Title | `Sign-Out Control training records and trainer availability` |
| Evidence Type | `Training Record` |
| Evidence Category | `People` |
| Evidence Description | `Training records for both Sign-Out Control operators, showing completed and outstanding competencies for barcode scanning and output posting, and the date the bilingual trainer left the company.` |
| Collected By | **[CONFIRM]** |
| Source of Evidence | `Training records / HR` |
| Evidence Relevance | `Supports Cause` |

**Attach: 2 records** — one per operator.
**Verification documents: 2** — the training matrix for the Sign-Out Control role, and HR confirmation of the trainer's leaving date.

### E6 — The transfer record
| Field | Value |
| --- | --- |
| Evidence Title | `Pallet transfer record for 8,342 units to the main plant` |
| Evidence Type | `Warehouse Scan Record` |
| Evidence Category | `Method` |
| Evidence Description | `The transfer transaction showing the quantity moved, the originating and receiving locations, and the item-tracking number before and after the move — establishing both that no unit-of-measure check occurred and why the quantities can no longer be reversed normally.` |
| Collected By | **[CONFIRM]** |
| Source of Evidence | `Warehouse management system` |
| Evidence Relevance | `Supports Cause` |

**Attach: 1 transfer record export.**
**Verification document: 1** — the written transfer/receipt procedure, to establish whether a verification step exists on paper and was missed, or does not exist at all. These are different findings and the CAPA differs accordingly.

### E7 — The posting work instruction
| Field | Value |
| --- | --- |
| Evidence Title | `Current SOP for output posting at Sign-Out Control` |
| Evidence Type | `SOP / Work Instruction` |
| Evidence Category | `Method` |
| Evidence Description | `The governing work instruction, showing what it requires for barcode scanning and verification, whether manual entry is addressed at all, and which languages it exists in.` |
| Collected By | **[CONFIRM]** |
| Source of Evidence | `Document control` |
| Evidence Relevance | `Supports Cause` |

**Attach: 1 controlled copy** (all language versions that exist).
**Verification document: 1** — the document control record showing revision and approval date.

**Evidence totals: 7 nodes · 9–10 photographs and exports · 7 verification documents.**

---

# 6. Cause categories and candidate causes (Main View)

Create one branch per category, with the causes beneath it.

### Method
- **M1 — Mixer and Sign-Out Control job cards are handled as one undifferentiated stack**, with no physical or visual separation at the point of printing or handover.
- **M2 — Placards are prepared by hand-copying a production-order number**, creating a transcription step between two documents that are never machine-compared.
- **M3 — No verification of unit of measure at pallet transfer**; the driver moves whatever number appears.

### Management System
- **S1 — Barcode scanning is a procedural expectation, not a system requirement.** The transaction accepts a keyed production-order number.
- **S2 — No unit-of-measure validation** between the output being posted and the order it is posted against.
- **S3 — No quantity plausibility limit.** A figure 397 times the achievable maximum commits without challenge.
- **S4 — Posted quantities become irreversible once an inventory location change alters the item-tracking number**, with no controlled reversal path.

### People
- **P1 — The only bilingual trainer left with no succession plan**, halting the trainee's structured progression.
- **P2 — A trainee was posting output without a qualified person able to verify in her language.**

### Measurement
- **X1 — No in-shift review of output against expected range.** The error ran a full shift before a report surfaced it.

### Material
- **T1 — Job cards for different operations are visually near-identical**, differing only in a number, with no colour, shape or marking to distinguish them.

**Staffing note (Management System):** one qualified operator covering two lines
while training a second person is a workload decision, not an individual failing.
It removed the informal second pair of eyes that had been the only real check.

---

# 7. Five Whys decisions

Attach a 5 Whys node to each candidate cause you intend to rule in or out. Each
node holds the chain, a verification status per step, and the disposition.

Common fields for every 5 Whys node:

| Field | Value |
| --- | --- |
| Priority Level | `Critical` for FW-1, `High` for the rest |
| Investigation Owner | **[CONFIRM]** |
| Decision Owner | **[CONFIRM]** |
| 5 Whys Status | `Decision Applied` |
| Evidence Strength | `Strong` |
| Is This Answer Verified? | `Yes` |
| Verified By | **[CONFIRM]** |

### FW-1 — Manual entry accepted in place of a barcode scan *(primary)*

- **Cause Being Tested:** `The posting transaction accepts a manually typed production-order number instead of requiring the job card barcode scan.`
- **Why Is This Cause Worth Testing?** `Every other failure in this incident is downstream of it. If the scan had been required, the wrong number could not have entered the system regardless of what was written on the placard.`

| Step | Answer | Verification status | Evidence note |
| --- | --- | --- | --- |
| Why 1 | Tortilla output was posted against a dough production order. | `Verified` | E3 transaction log |
| Why 2 | The production-order number came from a placard, not from the job card barcode. | `Verified` | E2 placard, E3 entry method |
| Why 3 | The tablet accepted a keyed number without a scan. | `Verified` | E3 — entries recorded as manual |
| Why 4 | Scanning is written as a procedural expectation but never enforced by the transaction. | `Verified` | E7 SOP against E3 system behaviour |
| Why 5 | The control was designed as an instruction to people rather than as a constraint in the system, so it fails whenever a person is rushed, new, or working from a placard. | `Verified` | E3 + E7 + E5 |

- **Final Finding:** `Barcode scanning is enforced only by instruction, not by the system, so the sole barrier against posting to the wrong production order depends on a person performing an optional step correctly every time.`
- **Reason for Decision:** `The transaction log confirms manual entry was accepted, and the SOP confirms scanning was expected. A control that is optional in software is not a control.`
- **Cause Disposition:** `Ruled In - Direct Cause`

### FW-2 — No unit-of-measure validation

- **Cause Being Tested:** `The system does not validate the unit of measure of the output being posted against the unit of measure of the production order.`
- **Why Is This Cause Worth Testing?** `Dozens were posted against an order denominated in batches. A single comparison would have stopped it at the first entry.`

| Step | Answer | Verification status | Evidence note |
| --- | --- | --- | --- |
| Why 1 | Output in dozens was accepted against an order in batches. | `Verified` | E3 |
| Why 2 | Nothing compared the two units at entry. | `Verified` | E3 |
| Why 3 | The transaction treats quantity as a bare number. | `Verified` | E3 |
| Why 4 | Unit compatibility was never specified as a requirement for the transaction. | `Verified` | E7 |
| Why 5 | The design assumed the correct order would always be selected, so validating the pairing appeared unnecessary. | `Verified` | E3 + E7 |

- **Final Finding:** `The posting transaction has no unit-of-measure compatibility check, so an output can be committed against an order it could never belong to.`
- **Reason for Decision:** `Demonstrated by the transaction record: dozens accepted against a batch-denominated order with no warning.`
- **Cause Disposition:** `Ruled In - Direct Cause`

### FW-3 — No quantity plausibility limit

- **Cause Being Tested:** `The system permits a posted quantity far outside any achievable range without challenge.`
- **Why Is This Cause Worth Testing?** `8,342 against a maximum of ~21 is not a borderline case. Any ceiling at all would have caught it within minutes.`

| Step | Answer | Verification status | Evidence note |
| --- | --- | --- | --- |
| Why 1 | 8,342 dough batches were committed for one shift. | `Verified` | E4 |
| Why 2 | The realistic maximum is about 21. | `Verified` | E4 verification document |
| Why 3 | No warning or block was raised at any point. | `Verified` | E3 |
| Why 4 | No maximum is configured for the transaction. | `Verified` | E3 |
| Why 5 | Plausibility limits were never established for output postings, so the system cannot distinguish a normal shift from an impossible one. | `Verified` | E3 + E4 |

- **Final Finding:** `No upper-bound or tolerance check exists on posted output quantity, so an impossible figure accumulates silently for as long as it is entered.`
- **Reason for Decision:** `397 times the achievable maximum was committed without a single system challenge.`
- **Cause Disposition:** `Ruled In - Direct Cause`

### FW-4 — Job cards not separated at source

- **Cause Being Tested:** `Mixer job cards and Sign-Out Control job cards are handled together with no separation.`
- **Why Is This Cause Worth Testing?** `It is what put the wrong number within reach at the moment the placard was written.`

| Step | Answer | Verification status | Evidence note |
| --- | --- | --- | --- |
| Why 1 | A mixer production-order number was written on a tortilla placard. | `Verified` | E2 |
| Why 2 | Both job cards were in the same stack on the preparation table. | `Verified` | E1 + statement |
| Why 3 | Job cards are printed as one run and handed over as one bundle. | `Verified` | E1 verification document |
| Why 4 | No step separates them by operation, and nothing on the cards distinguishes them at a glance. | `Verified` | E1 + E7 |
| Why 5 | The handover was designed around one person who knew the difference, rather than around documents that show it. | `Verified` | E1 + E5 |

- **Final Finding:** `Job cards for different operations are printed, handed over and stored together with no visual or physical distinction, so selecting the wrong one requires no error beyond ordinary inattention.`
- **Reason for Decision:** `Confirmed by the print record and by the placard itself.`
- **Cause Disposition:** `Ruled In - Contributing Cause`

### FW-5 — Training succession failure

- **Cause Being Tested:** `The trainee had no qualified trainer in her language after the bilingual employee left.`
- **Why Is This Cause Worth Testing?** `It determines whether the verification step was ever genuinely available to the person performing it.`

| Step | Answer | Verification status | Evidence note |
| --- | --- | --- | --- |
| Why 1 | An operator still in training posted output unsupervised. | `Verified` | E5 |
| Why 2 | The only experienced operator was covering both lines. | `Verified` | E5 + statement |
| Why 3 | The bilingual trainer had left and was not replaced. | `Verified` | E5 HR confirmation |
| Why 4 | No succession or interim cover was arranged for the training role. | `Verified` | E5 training matrix |
| Why 5 | Training capacity depended on one individual with no documented backup, so it ended the day that person left. | `Verified` | E5 |

- **Final Finding:** `Training for Sign-Out Control rested on a single bilingual employee with no succession plan, leaving a trainee performing a verification step she had not been signed off to perform.`
- **Reason for Decision:** `Training records show the competency outstanding; HR records confirm the trainer's departure with no replacement.`
- **Cause Disposition:** `Ruled In - Contributing Cause`

### FW-6 — No verification at transfer

- **Cause Being Tested:** `The transfer of 8,342 units to the main plant occurred with no unit-of-measure or plausibility check.`
- **Why Is This Cause Worth Testing?** `It was the last opportunity to catch the error before it became irreversible.`

| Step | Answer | Verification status | Evidence note |
| --- | --- | --- | --- |
| Why 1 | All 8,342 units were transferred. | `Verified` | E6 |
| Why 2 | No check compared the figure against a realistic pallet count. | `Verified` | E6 |
| Why 3 | The transfer step has no verification requirement. | `Verified` | E6 verification document |
| Why 4 | Transfer is treated as a movement task, not a control point. | `Verified` | E6 |
| Why 5 | The process assumes upstream figures are correct, so no stage downstream is asked to question them. | `Verified` | E6 + E3 |

- **Final Finding:** `The transfer step carries no verification duty, so an impossible quantity passed through the final checkpoint unchallenged and became irreversible.`
- **Reason for Decision:** `The transfer record shows the movement completed with no verification field or check.`
- **Cause Disposition:** `Ruled In - Contributing Cause`

### FW-7 — Irreversibility after location change

- **Cause Being Tested:** `Changing the inventory location alters the item-tracking number, removing the normal reversal path.`
- **Why Is This Cause Worth Testing?** `It converted a correctable error into a permanent one, and it will do so again for any future error.`

| Step | Answer | Verification status | Evidence note |
| --- | --- | --- | --- |
| Why 1 | The quantities cannot be reversed through the normal process. | `Verified` | E6 |
| Why 2 | The item-tracking number changed during the transfer. | `Verified` | E6 |
| Why 3 | The tracking number is derived from the inventory location. | `Verified` | E6 verification document |
| Why 4 | No controlled correction path exists once tracking has changed. | `Verified` | E6 |
| Why 5 | The design assumed postings would be correct before movement, so no recovery route was built for the case where they are not. | `Verified` | E6 + E3 |

- **Final Finding:** `A posting error becomes unrecoverable as soon as stock is moved, because the tracking identity changes and no controlled reversal exists.`
- **Reason for Decision:** `Confirmed by the transfer record showing the tracking number before and after the move.`
- **Cause Disposition:** `Ruled In - Contributing Cause`

---

# 8. Root Cause nodes

Common to every Root Cause node:

| Field | Value |
| --- | --- |
| Is This Blaming an Individual? | `No` |
| Other Causes Ruled Out? | `Yes` |
| Validation Status | `Approved` |
| Validated By | **[CONFIRM]** |
| Validation Date | **[CONFIRM]** |

### RC-1 — Primary root cause

| Field | Value |
| --- | --- |
| Root Cause Statement | `The output posting transaction accepts a manually keyed production-order number without requiring the job card barcode scan, and validates neither unit-of-measure compatibility nor quantity plausibility — so a single transcription error commits silently and repeats for an entire shift.` |
| Cause Classification | `Root Cause` |
| Cause Type | `Management System` |
| Cause Description | `Three absent system controls in one transaction: scanning is expected but not enforced; the unit of measure of the output is never compared with that of the order; and no upper bound exists on posted quantity. Any one of the three would have stopped this incident at the first entry. Their absence means the only barrier was a person performing an optional verification correctly, every time, while covering two lines and training a colleague.` |
| Would Fixing This Prevent Recurrence? | `Yes` |
| Is This a System Failure? | `Yes` |
| Ruled Out Cause List | `Equipment malfunction — no equipment fault; product was made correctly. Product quality defect — no physical defect. Deliberate misconduct — no evidence, and the error pattern is consistent with transcription under workload. Barcode or scanner failure — scanning was not attempted, so scanner condition is not implicated.` |
| Validation Comments | `Confirmed by the transaction log showing manual entry accepted, dozens committed against a batch-denominated order, and 8,342 units committed against a maximum of approximately 21, with no system challenge at any point.` |

### RC-2 — Contributing: job card segregation
| Field | Value |
| --- | --- |
| Root Cause Statement | `Mixer and Sign-Out Control job cards are printed, handed over and stored as one undifferentiated stack, with nothing on the documents to distinguish them at a glance.` |
| Cause Classification | `Contributing Cause` |
| Cause Type | `Method` |
| Cause Description | `The wrong production-order number was available at arm's reach at the moment the placard was written, and nothing about the two documents made the difference visible.` |
| Would Fixing This Prevent Recurrence? | `Partially` |
| Is This a System Failure? | `Yes` |
| Validation Comments | `Confirmed by the print record showing a single run and by the placard carrying the mixer number.` |

### RC-3 — Contributing: training succession
| Field | Value |
| --- | --- |
| Root Cause Statement | `Sign-Out Control training capacity depended on a single bilingual employee with no succession plan, so structured training stopped when that employee left and a trainee performed an unverified competency alone.` |
| Cause Classification | `Contributing Cause` |
| Cause Type | `People` |
| Cause Description | `The verification step was, in practice, unavailable to the person expected to perform it: not signed off, not trained in her language, and supervised by someone simultaneously covering two lines.` |
| Would Fixing This Prevent Recurrence? | `Partially` |
| Is This a System Failure? | `Yes` |
| Validation Comments | `Training records show the competency outstanding; HR records confirm the departure with no replacement.` |

### RC-4 — Contributing: no downstream verification
| Field | Value |
| --- | --- |
| Root Cause Statement | `The pallet transfer step carries no unit-of-measure or plausibility verification, so the final opportunity to intercept the error passed unchallenged.` |
| Cause Classification | `Contributing Cause` |
| Cause Type | `Method` |
| Cause Description | `Transfer is treated as movement rather than as a control point, and no stage downstream is asked to question an upstream figure.` |
| Would Fixing This Prevent Recurrence? | `Partially` |
| Is This a System Failure? | `Yes` |
| Validation Comments | `Confirmed by the transfer record: 8,342 units moved with no verification step recorded.` |

### RC-5 — Contributing: irreversibility
| Field | Value |
| --- | --- |
| Root Cause Statement | `Posted quantities become unrecoverable once an inventory location change alters the item-tracking number, because no controlled reversal path exists.` |
| Cause Classification | `Contributing Cause` |
| Cause Type | `Machine` |
| Cause Description | `This did not cause the error but determined its cost. It converts any posting mistake into a permanent inventory discrepancy the moment stock moves.` |
| Would Fixing This Prevent Recurrence? | `Partially` |
| Is This a System Failure? | `Yes` |
| Validation Comments | `Confirmed by the transfer record showing the tracking number before and after the location change.` |

---

# 9. CAPA

| Field | Value |
| --- | --- |
| CAPA ID | *(system generated)* |
| CAPA Summary | *(see below)* |
| CAPA Owner | **[CONFIRM]** |
| CAPA Status | `In Progress` |
| CAPA Due Date | **[CONFIRM]** |
| CAPA Priority | `Critical` |

**CAPA Summary**

> Make the posting transaction enforce what the procedure has only ever asked
> for. Three system controls — mandatory barcode scan, unit-of-measure
> validation, quantity plausibility limit — remove the possibility of this class
> of error rather than reducing its likelihood. Supporting actions correct job
> card segregation, restore training capacity with succession cover, add a
> verification duty at transfer, and establish a controlled reversal path for
> posted quantities.

---

# 10. Corrective Actions

Each is a separate node. All: `Approval Required?` → `Yes`, `Approved By` →
**[CONFIRM]**, `Action Status` → `Completed` at closure, with `Completion Date`
and `Completion Notes`.

### CA-1 — Enforce the barcode scan *(primary)*
| Field | Value |
| --- | --- |
| Corrective Action Title | `Require barcode scan to select a production order at output posting` |
| Action Description | `Remove manual entry of the production-order number from the posting transaction. The order must be selected by scanning the job card barcode. Where a scan is genuinely impossible, require a supervisor override that is logged with a reason and reviewed weekly.` |
| Action Owner | **[CONFIRM]** |
| Department Responsible | `Engineering` |
| Priority | `Critical` |
| Due Date | **[CONFIRM]** |
| Required Resources | `ERP / MES configuration change, test environment, validation window, scanner availability check at both stations` |
| Estimated Cost | **[CONFIRM]** |

### CA-2 — Unit-of-measure validation
| Field | Value |
| --- | --- |
| Corrective Action Title | `Block postings where the output unit of measure does not match the production order` |
| Action Description | `Add a hard validation comparing the unit of measure of the output being posted with that of the target order. Dozens cannot post to a batch-denominated order. The block is not overridable.` |
| Action Owner | **[CONFIRM]** |
| Department Responsible | `Engineering` |
| Priority | `Critical` |
| Due Date | **[CONFIRM]** |
| Required Resources | `ERP configuration, UoM master data review across all tortilla and dough items` |
| Estimated Cost | **[CONFIRM]** |

### CA-3 — Quantity plausibility limit
| Field | Value |
| --- | --- |
| Corrective Action Title | `Apply maximum-quantity limits to output postings` |
| Action Description | `Configure a per-item shift maximum derived from line capacity. Postings above it are blocked and require supervisor review. Set the dough limit against the documented ~21 batch maximum with an agreed tolerance.` |
| Action Owner | **[CONFIRM]** |
| Department Responsible | `Engineering` |
| Priority | `High` |
| Due Date | **[CONFIRM]** |
| Required Resources | `Capacity data per item, ERP tolerance configuration` |
| Estimated Cost | **[CONFIRM]** |

### CA-4 — Reconcile the affected inventory
| Field | Value |
| --- | --- |
| Corrective Action Title | `Correct the tortilla and dough inventory balances arising from the incident` |
| Action Description | `Establish true tortilla dozens produced and true dough batches for the shift, and process a controlled inventory adjustment with finance and QA approval, since the normal reversal route is unavailable after the tracking number change.` |
| Action Owner | **[CONFIRM]** |
| Department Responsible | `Quality` |
| Priority | `Critical` |
| Due Date | **[CONFIRM]** |
| Required Resources | `Production records, physical count at the main plant, finance and QA sign-off` |
| Estimated Cost | **[CONFIRM]** |

**Evidence required at CA-4 — 2 items:** the physical count sheet (`Production
Record`, 1) and the approved adjustment document (`Quality Record`, 1).

---

# 11. Preventive Actions

All: `Action Status` → `Completed` at closure.

### PA-1 — Separate job cards at printing
| Field | Value |
| --- | --- |
| Preventive Action Title | `Print and hand over mixer and Sign-Out Control job cards separately, with visual distinction` |
| Preventive Action Scope | `Entire Plant` |
| Action Description | `Split the print run by operation. Apply a distinct colour or header band per operation so the documents differ at a glance and not only by number. Hand them over in separate trays.` |
| Area Affected | `All lines using production-order job cards` |
| Action Owner | **[CONFIRM]** |
| Department Responsible | `Production` |
| Priority | `High` |
| Due Date | **[CONFIRM]** |
| Training Required? | `Yes` |
| SOP Update Required? | `Yes` |
| PM Update Required? | `No` |
| HACCP / Food Safety Plan Update Required? | `Not Applicable` |

### PA-2 — Training succession cover
| Field | Value |
| --- | --- |
| Preventive Action Title | `Establish named backup trainers and bilingual training materials for Sign-Out Control` |
| Preventive Action Scope | `Entire Plant` |
| Action Description | `Name at least two qualified trainers per critical role, with at least one able to train in Spanish. Produce the Sign-Out Control work instruction in English and Spanish. Add a rule that no trainee performs output posting unaccompanied until the competency is signed off.` |
| Area Affected | `Sign-Out Control and equivalent roles across all lines` |
| Action Owner | **[CONFIRM]** |
| Department Responsible | `Production` |
| Priority | `High` |
| Due Date | **[CONFIRM]** |
| Training Required? | `Yes` |
| SOP Update Required? | `Yes` |
| PM Update Required? | `No` |
| HACCP / Food Safety Plan Update Required? | `Not Applicable` |

### PA-3 — Verification duty at transfer
| Field | Value |
| --- | --- |
| Preventive Action Title | `Add a quantity and unit-of-measure verification step to pallet transfers` |
| Preventive Action Scope | `Warehouse Network` |
| Action Description | `Require the transferring driver to confirm unit of measure and that the quantity is consistent with the physical pallet count before the movement is committed, recorded in the transfer transaction.` |
| Area Affected | `All finished goods transfers to the main plant` |
| Action Owner | **[CONFIRM]** |
| Department Responsible | `Warehouse` |
| Priority | `High` |
| Due Date | **[CONFIRM]** |
| Training Required? | `Yes` |
| SOP Update Required? | `Yes` |
| PM Update Required? | `No` |
| HACCP / Food Safety Plan Update Required? | `Not Applicable` |

### PA-4 — Controlled reversal path
| Field | Value |
| --- | --- |
| Preventive Action Title | `Create a controlled correction route for postings after an inventory location change` |
| Preventive Action Scope | `Enterprise-Wide` |
| Action Description | `Define and configure an approved adjustment transaction that can correct a posting after the item-tracking number has changed, with dual approval and a full audit record — so a posting error is recoverable rather than permanent.` |
| Area Affected | `All inventory movements between plants` |
| Action Owner | **[CONFIRM]** |
| Department Responsible | `Engineering` |
| Priority | `Medium` |
| Due Date | **[CONFIRM]** |
| Training Required? | `Yes` |
| SOP Update Required? | `Yes` |
| PM Update Required? | `No` |
| HACCP / Food Safety Plan Update Required? | `Not Applicable` |

### PA-5 — In-shift output review
| Field | Value |
| --- | --- |
| Preventive Action Title | `Add a mid-shift output review against expected range` |
| Preventive Action Scope | `Same Department` |
| Action Description | `Supervisor reviews posted output against expected range at mid-shift for Lines 3 and 5, so a posting error is caught within hours rather than at end of shift. This is a detection control and is secondary to the system limits in CA-1 to CA-3.` |
| Area Affected | `Lines 3 and 5` |
| Action Owner | **[CONFIRM]** |
| Department Responsible | `Production` |
| Priority | `Medium` |
| Due Date | **[CONFIRM]** |
| Training Required? | `Yes` |
| SOP Update Required? | `Yes` |
| PM Update Required? | `No` |
| HACCP / Food Safety Plan Update Required? | `Not Applicable` |

---

# 12. Risk Assessment

Create **two** nodes — the canvas supports before and after.

### RA-1 — Before CAPA
| Field | Value |
| --- | --- |
| Assessment Type | `Before CAPA` |
| Severity Score | `4 High` |
| Occurrence Score | `4 Likely` |
| Detection Score | `5 Not Detectable` |
| Risk Justification | `Severity high — a full shift of inventory in two items was corrupted and became unrecoverable. Occurrence likely — nothing prevented a repeat; the same conditions existed on every shift. Detection not detectable — the error passed entry, the whole shift, transfer and receipt without interception, and surfaced only because the number became absurd.` |
| Residual Risk Acceptable? | `No` |
| Risk Approved By | **[CONFIRM]** |
| Risk Approval Comments | `Not acceptable without system controls. Procedural instruction alone leaves detection unchanged.` |

### RA-2 — After CAPA
| Field | Value |
| --- | --- |
| Assessment Type | `After CAPA` |
| Severity Score | `4 High` |
| Occurrence Score | `1 Rare` |
| Detection Score | `2 Likely Detected` |
| Risk Justification | `Severity unchanged — the consequence of a mis-post is the same. Occurrence rare — mandatory scanning plus unit-of-measure validation removes the mechanism rather than discouraging it. Detection likely — quantity limits stop an implausible figure at entry, with mid-shift review and transfer verification behind it.` |
| Residual Risk Acceptable? | `Yes` |
| Risk Approved By | **[CONFIRM]** |
| Risk Approval Comments | `Acceptable once CA-1 to CA-3 are live and verified. Severity is inherent to the transaction and cannot be reduced further; the reduction is in occurrence and detection.` |

---

# 13. Effectiveness Verification

| Field | Value |
| --- | --- |
| Verification ID | *(system generated)* |
| Verification Method | `Audit` |
| Verification Owner | **[CONFIRM]** |
| Verification Due Date | **[CONFIRM]** — 90 days after CAPA completion |
| Verification Interval | `90 Days` |
| Success Criteria | *(see below)* |
| Verification Result | `Pass` *(set only after the audit actually passes)* |
| Verification Notes | **[CONFIRM]** — record what was audited, sample size and findings |
| If Failed, Reopen RCA? | `Yes` |
| Reopened Reason | *(leave blank unless it fails)* |

**Success Criteria**

> Over 90 days following CAPA completion, all of the following hold:
>
> 1. Zero output postings recorded as manual entry. Every posting shows a scanned
>    order selection, or a logged supervisor override with a reason.
> 2. Zero postings where output unit of measure differs from the order's.
> 3. Zero postings above the configured item maximum without documented review.
> 4. Zero recurrences of output posted against a wrong production order.
> 5. Both Sign-Out Control operators signed off for barcode scanning and posting,
>    with at least two named trainers available including one bilingual.
> 6. Transfer records show unit-of-measure verification completed on every
>    finished goods transfer sampled.

**Evidence required — 3 items:** the audit report (`Audit Record`, 1); a
transaction extract for the period showing entry method, unit of measure and
quantity (`Machine Data`, 1); updated training records for both operators
(`Training Record`, 2 — one per operator).

---

# 14. Lessons Learned

| Field | Value |
| --- | --- |
| Lesson Learned Summary | `A control that exists only as an instruction to people is not a control. Barcode scanning was required by procedure and optional in software, so it failed the first time someone was rushed, new, or working from a placard instead of a job card.` |
| What Went Wrong? | *(see below)* |
| What Worked Well? | *(see below)* |
| What Should Change? | *(see below)* |
| Can This Happen Elsewhere? | `Yes` |
| Other Lines / Areas Affected | `Every line where output is posted against a production order, and every transfer between plants — the same three system gaps exist wherever the same transaction is used.` |
| SOP Update Needed? | `Yes` |
| PM Update Needed? | `No` |
| Training Update Needed? | `Yes` |
| Share With Other Departments? | `Yes` |
| Knowledge Base Article Required? | `Yes` |
| Lesson Owner | **[CONFIRM]** |
| Lesson Approval Status | `Approved` |

**What Went Wrong?**

> Four separate opportunities to catch the error were all missed, and none of
> them failed because someone was careless. Entry accepted a keyed number because
> the system allowed it. The shift passed without review because no review
> existed. Transfer passed without a check because transfer carries no
> verification duty. Receipt accepted the quantity because nothing downstream is
> asked to question an upstream figure. The single transcription slip was
> ordinary; what made it a shift-long inventory failure was that nothing was
> built to stop it.
>
> Underneath that, training capacity for a critical role rested on one person,
> and ended when that person left.

**What Worked Well?**

> The error was recognised as soon as the dough figure was seen — the reporting
> was clear enough that 8,342 against 21 was obvious. Containment was quick and
> proportionate: product held, scanning mandated in writing in both languages,
> job cards separated, supervisor check added at shift start.

**What Should Change?**

> Move the control from the person to the system. Scanning must be mandatory,
> unit of measure must be validated, and quantities must have a ceiling. Verify
> at transfer as well as at entry, because a single check point is a single point
> of failure. Never let a critical competency depend on one trainer. And build a
> reversal path, because a process that cannot correct its own errors turns small
> mistakes into permanent ones.

---

# 15. Approval & Closure

Every field here is a gate. The canvas refuses closure unless each is set to one
of the values shown.

| Field | Value |
| --- | --- |
| Closure Review ID | *(system generated)* |
| Closure Scope | `Entire RCA Case` |
| Closure Readiness | `Approved to Close` |
| Final Investigation Summary | *(see below)* |
| Root Cause Verification Status | `All Verified` |
| CAPA Workflow Status | `All CAPA Work Complete` |
| Corrective Actions Complete? | `Yes` |
| Preventive Actions Complete? | `Yes` |
| Risk Assessment Complete? | `Yes` |
| Effectiveness Verified? | `Yes` |
| Lessons Learned Completed? | `Yes` |
| Evidence Review Status | `Complete` |
| Residual Risk Decision | `Accepted With Controls` |
| Final Risk Level | `Low` |
| Regulatory / Customer Notification | `Not Required` |
| Closure Conditions / Open Follow-Ups | *(see below)* |
| Reopen Trigger | *(see below)* |
| Closure Recommendation | `Close RCA` |
| Final Approver | **[CONFIRM]** |
| Approver Role | `Plant Manager` |
| Closure Date | **[CONFIRM]** |
| Closure Comments | *(see below)* |

**Final Investigation Summary**

> Finished tortilla output was posted against a flour-dough production order for
> most of one shift, resulting in approximately 8,342 batches posted against an
> achievable maximum of about 21. The immediate trigger was a mixer
> production-order number hand-copied onto a tortilla pallet placard and typed
> into the tablet rather than scanned from the job card barcode.
>
> The root cause is not that transcription: it is that the posting transaction
> permitted it. Barcode scanning was required by procedure and optional in
> software; no validation compared the output's unit of measure with the order's;
> and no limit existed on posted quantity. Any one of those three controls would
> have stopped the incident at the first entry.
>
> Contributing causes were job cards handled as one undifferentiated stack with
> nothing to distinguish them, a training programme that depended on a single
> bilingual employee and ended when that employee left, a transfer step carrying
> no verification duty, and an inventory design in which a location change alters
> the item-tracking number and removes the normal reversal path — which is what
> made the error permanent rather than correctable.
>
> Four corrective and five preventive actions were completed. The three system
> controls are live and verified. Residual risk is accepted with controls: the
> severity of a mis-post is unchanged and inherent, but its occurrence and
> detectability have both moved decisively.

**Closure Conditions / Open Follow-Ups**

> The 90-day effectiveness audit has passed and is on file. PA-4, the controlled
> reversal path, is enterprise-wide and continues under its own change record —
> it reduces the cost of a future error rather than the likelihood of this one,
> and does not gate closure. The knowledge base article is published and shared.

**Reopen Trigger**

> Reopen immediately on any of: output posted against a wrong production order on
> any line; any manual production-order entry recorded without a logged supervisor
> override; any posting accepted where output unit of measure differs from the
> order's; any posting above the configured item maximum committed without
> documented review; or an effectiveness audit at any later interval returning a
> result other than Pass.

**Closure Comments**

> Closed with the root cause addressed at the system level rather than by
> instruction. The test applied was whether this incident could occur again if
> every person involved behaved exactly as they did on the day — and with
> mandatory scanning, unit-of-measure validation and quantity limits in place, it
> could not. The analysis found no individual fault and none is recorded; the
> people involved were operating a process that offered them no way to catch the
> error.

---

# Evidence and verification summary

| Where | Evidence items | Photos / exports | Verification documents |
| --- | --- | --- | --- |
| Containment | 3 | 1–2 photos, 1 hold record | 1 (work instruction) |
| Evidence nodes E1–E7 | 7 | 9–10 | 7 |
| CA-4 inventory correction | 2 | 1 count sheet | 1 (approved adjustment) |
| Effectiveness verification | 3 | 1 audit report, 1 extract | 2 (training records) |
| **Total** | **15 evidence items** | **~14 attachments** | **11 verification documents** |

**Before you start typing:** confirm every **[CONFIRM]** value — names, dates,
lot numbers, hold tag, costs and due dates. Those are gate fields, and the canvas
will refuse to close the case with any of them empty.
