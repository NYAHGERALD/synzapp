# RCA Canvas Enterprise Workflow Roadmap

## Purpose

This roadmap defines the next enterprise workflow improvements for the Synzapp RCA canvas. The goal is to speed up investigation, review, and live presentation workflows without destabilizing the existing RCA layout, node positioning, rearrange behavior, spline connections, CAPA flow, Root Cause flow, or canvas interactions.

Implementation must proceed one workflow at a time. After each workflow is completed and verified, the user tests it in the UI. Work on the next workflow starts only after explicit approval.

## Enterprise Implementation Rules

- Implement one numbered workflow at a time.
- Preserve existing RCA structures, node layout rules, connection rules, and rearrange behavior.
- Do not introduce demo-only behavior, shortcuts, temporary hacks, or speculative rewrites.
- Prefer focused, production-ready changes that fit the existing codebase patterns.
- Verify every frontend workflow with typecheck, production build, and local served-source checks.
- Restart the frontend after frontend changes.
- Deploy and verify the hosted backend only when a workflow requires backend changes.
- Stop after each completed numbered workflow and wait for user approval before continuing.

## Roadmap

### 1. Presentation Mode

Create a professional presentation state for the RCA canvas.

Scope:
- Add a Presentation Mode toggle.
- Hide editing noise such as side panels, nonessential controls, and transient UI while presenting.
- Keep the RCA canvas readable and focused.
- Add next/previous focus navigation through the RCA flow.
- Fit the focused presentation step into view.
- Allow Escape or the toggle to exit Presentation Mode.
- Do not change stored node positions.
- Do not disrupt rearrange, zoom-region, context menu, node connections, CAPA, or Root Cause workflows.

Completion criteria:
- Presentation Mode can be entered and exited reliably.
- Existing edit mode behavior is unchanged after exit.
- Presentation navigation focuses meaningful RCA sections.
- The canvas remains interactive only where appropriate for presentation.

### 2. Guided RCA Path

Add a next-best-action workflow engine that inspects the active RCA and guides the user.

Scope:
- Detect missing investigation steps.
- Recommend next actions such as adding evidence, completing 5 Whys, connecting Root Cause, or completing CAPA.
- Keep guidance contextual to the selected node or active case.
- Use professional, simple language.

Completion criteria:
- Guidance reflects actual canvas state.
- Recommendations do not mutate the canvas unless the user chooses an action.
- Guidance remains useful for first-time and experienced users.

### 3. Auto-Focus On Selection

Add an optional mode that automatically fits a selected node and its connected neighborhood into view.

Scope:
- Toggleable behavior.
- Center selected node plus directly connected nodes.
- Avoid disrupting normal manual navigation when disabled.
- Preserve current selection and canvas state.

Completion criteria:
- Selection focus works for node families, not only single nodes.
- It does not interfere with dragging, connecting, or multi-select workflows.

### 4. Branch Walkthrough

Allow users to isolate and focus a single Ishikawa branch such as PEOPLE, MACHINE, METHOD, MATERIAL, MEASUREMENT, or ENVIRONMENT.

Scope:
- Select a branch and fit its connected RCA structure into view.
- Support upper and lower branch sections.
- Keep branch spacing and existing layout intact.
- Provide next/previous branch navigation for presentations.

Completion criteria:
- Branch focus does not move nodes.
- Branch walkthrough works for branches with many or few nodes.
- Empty or sparse branches still focus cleanly.

### 5. Connection Recommendations

Add intelligent connection guidance for selected nodes.

Scope:
- Show valid incoming and outgoing connection targets.
- Recommend practical next connections based on node type.
- Support one-click create-and-connect actions where safe.
- Respect existing connection validation rules.

Completion criteria:
- Recommendations match real connection rules.
- No existing manual connection behavior is broken.
- CAPA and Approval & Closure multi-connection rules remain intact.

### 6. Missing Data Badges

Add node-level completeness indicators.

Scope:
- Show concise status badges such as Needs evidence, Needs owner, Needs verification, Ready for CAPA, and Awaiting approval.
- Use node-specific rules.
- Keep badges visually compact and nonintrusive.

Completion criteria:
- Badges reflect actual node data and connection state.
- Badges do not affect node size enough to break layout.
- Badges remain readable at common zoom levels.

### 7. RCA Quality Score

Create a case-readiness score that helps users understand RCA completeness.

Scope:
- Score evidence completeness, cause validation, 5 Whys completion, Root Cause classification, CAPA completeness, and approval state.
- Explain what is missing.
- Avoid fake precision or arbitrary scoring.

Completion criteria:
- Score is transparent and explainable.
- It updates from real case and canvas data.
- It supports leadership review without replacing professional judgment.

### 8. Auto-Generate Review Package

Generate a polished leadership or audit review package from the active RCA.

Scope:
- Include incident summary, timeline, verified root causes, contributing factors, evidence, CAPA actions, risk profile, and approval status.
- Use the current canvas and incident record as source of truth.
- Produce a professional review artifact or view.

Completion criteria:
- Output is structured and enterprise-ready.
- Generated content is traceable to case data.
- Missing required sections are clearly identified.

### 9. Timeline Playback

Create an investigation playback experience.

Scope:
- Show how the RCA evolved over time.
- Include node creation, evidence attachment, cause verification, CAPA updates, and approval actions.
- Support review and audit use cases.

Completion criteria:
- Playback is chronological and understandable.
- It uses real activity data where available.
- It does not alter the canvas.

### 10. Focus Bookmarks

Allow users to save and return to named canvas views.

Scope:
- Save named focus views such as People branch, Root causes, CAPA plan, and Management review.
- Restore viewport without changing node positions.
- Support presentation workflows.

Completion criteria:
- Bookmarks persist where appropriate.
- Restoring a bookmark is reliable across sessions.
- Bookmark controls do not clutter normal investigation mode.

## Execution Order

Start with Workflow 1: Presentation Mode.

After Workflow 1 is implemented:
1. Verify locally.
2. Restart the frontend.
3. Report exactly what changed.
4. Wait for user testing and explicit approval.
5. Start Workflow 2 only after approval.

## Current Execution Status

- Workflow 1: Presentation Mode - implemented locally and awaiting UI validation.
- Workflow 2: Guided RCA Path - implemented locally and awaiting UI validation.
- Workflow 3: Auto-Focus On Selection - implemented locally and awaiting UI validation.
- Workflow 4: Branch Walkthrough - implemented locally and awaiting UI validation.
- Workflow 5: Connection Recommendations - implemented locally and awaiting UI validation.
- Workflow 6: Missing Data Badges - implemented locally and awaiting UI validation.
- Workflow 7: RCA Quality Score - implemented locally and awaiting UI validation.
- Workflow 8: Auto-Generate Review Package - not started.
- Workflow 9: Timeline Playback - not started.
- Workflow 10: Focus Bookmarks - not started.
