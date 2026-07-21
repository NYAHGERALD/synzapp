# RAILS AI Assistant Enterprise Plan

## Objective

Add a secure, backend-backed AI assistant to the RAILS workspace so managers can ask simple questions about the active RAILS flow, current loop status, gates, evidence, actions, LSW/RCA linkage, collaborators, logs, standardization, and closure readiness.

## Enterprise approach

1. Backend owns the RAILS knowledge.
   - Keep the RAILS flow guidance in a versioned backend knowledge pack, not inside the UI.
   - Include stage rules, page-by-page completion expectations, evidence rules, LSW/RCA linkage rules, approval gates, audit expectations, and closure controls.
   - Make the knowledge pack easy to expand as new RAILS features are added.

2. Backend owns the data context.
   - The frontend only sends the user question and optional active loop id.
   - The backend verifies Firebase session and App Check before doing anything.
   - The backend loads only tenant-authorized RAILS workspace data.
   - The AI receives a sanitized summary, not raw documents, secrets, tokens, storage paths, or internal-only identifiers.

3. Backend owns safety controls.
   - Rate-limit assistant questions per signed-in user.
   - Limit question length and response length.
   - Restrict answers to RAILS guidance.
   - Fall back to deterministic guidance when the AI provider is unavailable or not configured.
   - Treat backend workflow gates as the source of truth; the assistant guides users but does not bypass controls.

4. Frontend provides a consistent enterprise UI.
   - Add an AI badge icon to the RAILS Controls panel header.
   - Clicking the badge switches the left panel into AI Assistant mode.
   - The AI panel has short starter prompts, conversation history, a responsive input, and clear close behavior.
   - Closing AI mode returns the panel to its normal controls or filter purpose.

5. Verification.
   - Add typed frontend API support.
   - Add backend route and service with validation.
   - Run backend typecheck, frontend typecheck, and frontend build.

## Initial knowledge coverage

- What RAILS is and when to use it.
- New, Triaged, Reopened, In Progress, Verification, Approved, Closed stage purpose.
- How to start a loop correctly.
- How to document containment, corrective action, verification, and standardization.
- How centralized evidence links to governed steps.
- How LSW observations become RAILS loops.
- How RCA linkage and triage decision fit the flow.
- How collaborators, ownership, approval, logs, and audit history support control.
- What must be completed before moving forward on each detail page.

## Future scaling path

- Move the knowledge pack into tenant-configurable policy documents when the organization needs custom RAILS language.
- Add embedding search over published SOPs, LSW standards, RCA policy, and department-specific playbooks.
- Add suggested next actions generated from backend gate blockers.
- Add read-only citations to the exact RAILS page, field, or gate that drove the guidance.
