# RCA Canvas Enterprise Layout Plan

## Objective

Make the RCA canvas behave like an enterprise visual analysis tool: users can type inside detail forms without disturbing the canvas, add comments as first-class RCA annotations, and use Rearrange Canvas without nodes stacking, overlapping, or scattering into unreadable layouts.

## Layout Rules

- Keep the intake chain vertical and predictable: Incident, Incident Details, Containment, Problem Statement, Fault Gate.
- Keep fishbone branch columns separated with enough horizontal reserve for Cause, Evidence, 5 Whys, Sticky Note, and Comment nodes.
- Treat Evidence, Sticky Note, and Comment as branch satellites, not part of the primary cause tree.
- Preserve clean RCA reading flow: Cause nodes attach to branches, 5 Whys can attach to Causes, and annotations sit beside the node they explain.
- Resolve collisions after arrangement and give every branch a minimum X/Y lane gap.

## Interaction Rules

- Detail panels own their keyboard input. Space, arrow keys, and typing inside fields must never trigger canvas shortcuts or rearrange behavior.
- Comment nodes behave like sticky notes: manually placed, connectable to any RCA node, editable inline, copyable, deletable, and included in reports.
- Rearrange Canvas is the only intentional automated layout action. Typing in node fields must not move nodes.

## Implementation Checklist

- [x] Add Comment node creation from the RCA context menu.
- [x] Unify Sticky Note and Comment behavior through shared freeform annotation helpers.
- [x] Expand fishbone horizontal spacing and reserve satellite lanes before assigning branch columns.
- [x] Stop form keyboard and pointer events at capture phase inside the detail panels.
- [x] Build and verify the web app after implementation.
