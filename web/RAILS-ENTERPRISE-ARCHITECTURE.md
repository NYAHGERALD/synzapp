# RAILS Enterprise Architecture

RAILS stands for Rapid Action and Improvement Looping System. In Synzapp, RAILS is the enterprise execution layer that converts observations, RCA findings, meeting decisions, audits, and frontline improvement ideas into accountable, verified improvement loops.

## Strategic Role

RAILS completes the Synzapp operating system:

```txt
LSW observes the work
RCA explains the cause
RAILS drives the action loop
```

The product should not behave like a generic task list. It should manage structured improvement loops with ownership, collaboration, evidence, approvals, escalation, and enterprise reporting.

## Core Workflow

1. Capture
   - Create improvement loops from LSW, RCA, audits, customer issues, safety observations, quality defects, downtime, training gaps, and team suggestions.
   - Preserve source context so leaders can see where the issue came from.

2. Classify
   - Assign category, priority, risk level, site, department, source, owner, due date, and expected verification method.
   - Use templates for repeatable operational scenarios.

3. Assign
   - Each loop has one accountable owner.
   - Contributors, approvers, and watchers support collaboration without weakening accountability.

4. Execute
   - Track work through clear statuses: New, Triaged, In Progress, Verification, Approved, Closed, and Reopened.
   - Require comments and evidence when status changes matter.

5. Verify
   - Closure requires evidence such as photo, file, checklist, metric result, supervisor signoff, or follow-up inspection.
   - High-risk loops require approval before closure.

6. Standardize
   - Successful corrective actions should update standards, training, schedules, checks, or process controls.
   - Repeat failures should trigger RCA or escalation.

7. Learn
   - Dashboards expose overdue loops, risk concentration, category trends, closure quality, repeat issues, and improvement velocity.

## Enterprise Information Architecture

Recommended Firestore shape:

```txt
organizations/{tenantId}/railsItems/{railsItemId}
organizations/{tenantId}/railsItems/{railsItemId}/actions/{actionId}
organizations/{tenantId}/railsItems/{railsItemId}/comments/{commentId}
organizations/{tenantId}/railsItems/{railsItemId}/evidence/{evidenceId}
organizations/{tenantId}/railsItems/{railsItemId}/approvals/{approvalId}
organizations/{tenantId}/railsItems/{railsItemId}/activity/{activityId}
organizations/{tenantId}/railsTemplates/{templateId}
organizations/{tenantId}/railsEscalationRules/{ruleId}
organizations/{tenantId}/railsMetrics/{metricId}
```

## Core Entities

### railsItems

Primary improvement loop record.

Fields:

- `tenantId`
- `title`
- `problemStatement`
- `sourceType`
- `sourceId`
- `category`
- `priority`
- `riskLevel`
- `status`
- `ownerUid`
- `contributorUids`
- `approverUids`
- `watcherUids`
- `departmentId`
- `siteId`
- `dueDate`
- `verificationMethod`
- `standardizationTarget`
- `linkedLswId`
- `linkedRcaId`
- `createdAt`
- `createdByUid`
- `updatedAt`
- `closedAt`

### railsActions

Discrete action steps inside the loop.

Fields:

- `title`
- `ownerUid`
- `status`
- `dueDate`
- `sequence`
- `blockedReason`
- `completedAt`

### railsEvidence

Evidence required for verification and closure.

Fields:

- `type`
- `filePath`
- `thumbnailPath`
- `note`
- `uploadedByUid`
- `createdAt`

### railsApprovals

Approval records for verification and closure gates.

Fields:

- `approverUid`
- `decision`
- `comment`
- `decidedAt`

### railsActivityLog

Immutable audit trail.

Fields:

- `actorUid`
- `action`
- `before`
- `after`
- `createdAt`

## Permissions

RAILS should combine role-based access with item-level responsibility.

- Admin: configure categories, templates, escalation rules, and retention.
- Executive: view enterprise dashboards and all high-level reporting.
- Manager: manage department loops, assign owners, and review performance.
- Supervisor: create loops, assign work, verify completion, and escalate.
- Contributor: update assigned work, comment, and upload evidence.
- Viewer: read approved or shared loops.

Closure, deletion, reassignment, approval, and escalation should always be audited.

## Collaboration Model

RAILS should include:

- Threaded comments
- Mentions for people and teams
- Watchers and followers
- Attachments and evidence
- Status change notes
- Approval gates
- Activity timeline
- Linked LSW records
- Linked RCA records
- Optional live presence for collaborative review

## First Production Slice

The first enterprise-quality slice should include:

- RAILS command center with operational metrics
- Board grouped by workflow status
- Create loop form
- Detail panel with owner, risk, due date, linked records, collaborators, evidence, comments, and audit trail
- Status movement controls
- Local state model shaped like the future backend API
- Responsive layout for supervisor and manager use

## Integration Path

1. Ship UI and domain model.
2. Add `railsApi.ts` with authenticated backend calls.
3. Add backend routes with tenant-scoped authorization.
4. Add Firestore rules and storage paths for evidence.
5. Add notifications for assignment, mention, due date, escalation, and approval.
6. Add analytics aggregations for dashboard performance.

## Design Principles

- One accountable owner per loop.
- Collaboration without ambiguity.
- Evidence before closure.
- Auditability by default.
- LSW and RCA integration as first-class inputs.
- Dense, calm, operational UI instead of a marketing-style screen.
- Enterprise controls without making frontline updates painful.
