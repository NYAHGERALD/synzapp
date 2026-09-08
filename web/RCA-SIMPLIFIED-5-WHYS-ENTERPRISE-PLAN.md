# RCA Simplified 5 Whys Enterprise Plan

## Objective

Keep the RCA canvas as a clean executive process map while preserving the detailed investigation record inside controlled node detail panels.

## Enterprise Direction

The RCA canvas should show the major investigation flow:

`Incident -> Incident Details -> Containment -> Problem Statement -> Cause -> 5 Whys -> CAPA`

The canvas should not create separate `Answer` nodes for every Why. Answers are investigation records, not separate map stages.
The `5 Whys` node is a governed test of a suspected `Cause`; it should be connected manually from the `Cause` output to the `5 Whys` input when the manager is ready to test that cause.

## Implementation Rules

- Rename the user-facing `Why` node role to `5 Whys`.
- Stop creating standalone `Answer` nodes in the automated 5 Whys flow.
- Store the full 5-step why investigation inside the `5 Whys` node detail panel.
- Add answer, per-step verification, evidence strength, owner, contributor, final finding, and decision fields to the `5 Whys` detail panel.
- Rename the user-facing `Root Cause` node to `Cause`.
- Preserve old `Answer` and `ROOT_CAUSE` role keys in code so existing stored RCA canvases remain readable.
- Keep the generated flow visually clean by adding the `5 Whys` node in view without auto-connecting it.
- Permit the governed `5 Whys` connection only from `Cause` output to `5 Whys` input.
- When a `Cause` is connected to `5 Whys`, automatically copy the Cause Statement into the `Cause Being Tested` field.
- When a connected `Cause` statement is later edited, keep `Cause Being Tested` synchronized only if it is blank or still matches the previous Cause Statement, preserving any manager-customized wording.
- Generate each Why question from the previous verified answer so the user is guided through a real 5 Whys chain instead of filling five unrelated text boxes.
- Require a governed decision before the 5 Whys can update the linked Cause: direct cause, contributing cause, ruled out, no direct impact, or needs more evidence.
- Applying the 5 Whys decision updates the linked Cause node validation status, suspected/root-cause flags, prevention judgment, validation date, and comments.
- A ruled-out or no-direct-impact decision must preserve the cause as an audit record instead of deleting it.

## User Experience

- Managers click `5 Whys` once and get one visible, selected investigation node.
- Managers manually connect the suspected `Cause` output to the `5 Whys` input when that cause is ready to test.
- Opening the `5 Whys` node shows the structured five-question chain plus answer and verification fields.
- After the fifth answer, managers complete the final disposition panel and apply the decision to the linked Cause node.
- The Cause node then clearly shows whether it is verified as direct, contributing, rejected, or still under investigation.
- The canvas stays readable for large enterprise RCA reviews.
- Existing legacy Answer nodes remain compatible, but the app no longer guides users to create new Answer nodes.

## Verification

- Build the web app after implementation.
- Confirm the Add Node menu no longer offers `Answer`.
- Confirm the bottom toolbar `5 Whys` button creates only one unconnected `5 Whys` node in view.
- Confirm `Problem Statement -> 5 Whys` is no longer accepted as a new connection.
- Confirm `Cause -> 5 Whys` is accepted and fills `Cause Being Tested`.
- Confirm later Cause Statement edits update connected `5 Whys` nodes without overwriting manually customized `Cause Being Tested` text.
- Confirm the `5 Whys` detail panel contains answer and verification fields.
- Confirm completing all five answers and applying a direct/contributing/ruled-out decision updates the linked Cause node.
- Confirm a ruled-out 5 Whys decision does not delete the Cause node and keeps the decision visible in the Cause details.
- Confirm user-facing `Root Cause` labels now read `Cause`.
