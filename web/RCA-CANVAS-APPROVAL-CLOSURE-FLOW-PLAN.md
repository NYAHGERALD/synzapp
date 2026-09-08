# RCA Canvas Approval & Closure Flow Improvement Plan

## Objective

Move the RCA canvas to an enterprise case-closure model:

- Keep each verified Root Cause connected to its own CAPA workflow.
- Keep CAPA stage nodes under the CAPA that owns them.
- Use one final Approval & Closure node for the entire RCA case.
- Connect the final Approval & Closure node from the Fault Gate.
- Do not allow CAPA stage outputs to connect to Approval & Closure or any other RCA node.
- Preserve the existing canvas structure, branch layout, Root Cause workflow layout, and CAPA stage layout.

## Enterprise Flow

The accepted flow is:

1. Cause investigation happens through Evidence and 5 Whys.
2. Validated causes become Root Cause or contributing cause records.
3. Each Root Cause can have its own CAPA.
4. Each CAPA can have its own Corrective Action, Preventive Action, Risk Assessment, Effectiveness, and Lessons Learned stages.
5. The Fault Gate owns the final RCA governance path.
6. One Approval & Closure node connected from the Fault Gate approves and closes the entire RCA case.

## Implementation Steps

1. Update connection rules.
   - Allow Fault Gate output to connect to Approval & Closure.
   - Block CAPA stage outputs from connecting to Approval & Closure or any other node.
   - Keep CAPA output to CAPA stages.
   - Keep Root Cause output to CAPA.

2. Update edge rendering.
   - Stop rendering CAPA stage convergence edges to Approval & Closure.
   - Continue rendering Problem Statement to Fault Gate and Fault Gate governance splines.

3. Update auto-rearrange layout.
   - Remove Approval & Closure from individual CAPA workflow columns.
   - Place one Approval & Closure node to the right of the Fault Gate on the same horizontal plane.
   - Maintain a reasonable gap from the Fault Gate.
   - Keep the Approval & Closure output inactive in practice by connection rules.

4. Update Guided RCA Path.
   - Treat Approval & Closure as case-level closure, not CAPA-block closure.
   - Check that required CAPA workflows and stages exist under Root Causes.
   - Recommend one case-level Approval & Closure connected from Fault Gate.
   - Stop recommending CAPA stage links to Approval & Closure.

5. Update node guide and AI-facing guidance.
   - CAPA stages should no longer say they connect to Approval & Closure.
   - Approval & Closure should say it accepts from Fault Gate and validates the entire RCA case.

6. Improve Approval & Closure detail fields.
   - Add enterprise case closure controls: closure readiness, approver, approval date, residual risk decision, CAPA verification status, evidence review, closure conditions, reopen trigger, and final closure decision.
   - The detail panel should communicate that closure reviews the complete RCA and CAPA stage readiness, not direct incoming splines from every stage.

7. Verify.
   - Run frontend typecheck.
   - Run production build.
   - Restart frontend.
   - Confirm served frontend includes the new flow logic.

## Completion Criteria

- Users can connect Fault Gate to the final Approval & Closure node.
- Users cannot connect CAPA stage outputs to Approval & Closure or unrelated nodes.
- Rearrange places Approval & Closure to the right of Fault Gate without disturbing CAPA stage blocks.
- Guided RCA Path understands the new enterprise closure model.
- Node guide language matches the new flow.
- Approval & Closure detail fields support enterprise final case closure.
