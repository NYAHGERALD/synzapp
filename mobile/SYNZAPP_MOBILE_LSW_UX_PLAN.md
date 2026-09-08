# Synzapp Mobile Leaders Standard Work UX Plan

## Purpose

Create an enterprise-grade mobile Leaders Standard Work experience for:

1. Follow Ups
2. To Do Today & This Week
3. Daily & Weekly Standard Tasks/Meetings

The backend already exists and the web app is already using it. The mobile app must use the same LSW backend records, permissions, week context, tenant calendar rules, and user profile scope so work completed on web appears on mobile, and work completed on mobile appears on web.

## Current State

- Mobile main navigation already includes `LEADERS STANDARD WORK`.
- Mobile `src/services/lswApi.ts` currently supports creating To Do and Follow Up records from chat messages.
- Web app uses the full LSW backend through `web/src/lswApi.ts` and `web/src/LswPrototype.tsx`.
- Backend routes already exist in `backend/src/routes/lswRoutes.ts`.
- The relevant backend collections already exist:
  - `dailyWeeklyTasks`
  - `todoTasks`
  - `followUps`
  - `scheduledTasksMeetings`
- The mobile app needs a full LSW workspace surface instead of only chat-to-LSW creation.

## Product Goals

- Make mobile LSW feel like a daily operating tool, not a squeezed web table.
- Keep web and mobile fully synchronized through the same API.
- Make the first screen useful in under one second after cached/local state is available.
- Support quick checkoff, quick add, edit, delete, and refresh.
- Respect role and observation permissions already enforced by the backend.
- Preserve company calendar week behavior so mobile matches web weekly status and verification.

## Navigation

Entry point:

- User taps `LEADERS STANDARD WORK` in the Synzapp main menu.

Mobile destination:

- Open a full-screen `Leaders Standard Work` surface.
- Header:
  - Back button returns to Chats.
  - Title: `Leaders Standard Work`
  - Refresh icon.
  - Optional overflow menu for week picker, observation, and settings when permissions allow.

Primary tabs:

- `Today`
- `Week`
- `Follow Ups`

The tabs map to the requested sections:

- `Today`: To Do Today & This Week, filtered to today and past due first.
- `Week`: Daily & Weekly Standard Tasks/Meetings.
- `Follow Ups`: Follow Ups list.

Scheduled Tasks/Meetings should be included inside `Week` as a collapsible subsection or secondary tab after the first release of the core three sections, because the backend supports `scheduledTasksMeetings` but the user request names it as part of Daily & Weekly Standard Tasks/Meetings.

## UX Architecture

### Today: To Do Today & This Week

Purpose:

- Give the user a fast operating list of immediate work.

Layout:

- Compact summary strip:
  - Due today
  - Past due
  - Completed this week
- Segmented filters:
  - `Open`
  - `Today`
  - `This Week`
  - `Done`
- List rows:
  - Checkbox
  - Task text
  - Due date/time
  - Late/today/week chip
  - Swipe actions: Edit, Delete

Primary actions:

- Add To Do
- Mark complete/incomplete
- Edit task, due date, due time
- Delete task after confirmation

Backend mapping:

- `GET /api/lsw/todo-tasks`
- `POST /api/lsw/todo-tasks`
- `PATCH /api/lsw/todo-tasks/:taskId`
- `DELETE /api/lsw/todo-tasks/:taskId`

### Week: Daily & Weekly Standard Tasks/Meetings

Purpose:

- Let leaders check off standard tasks/meetings by day without a desktop table.

Layout:

- Week header:
  - Company week label from `/api/lsw/context`
  - Week picker: previous/current/next
  - Work days from LSW settings
- Daily task cards:
  - Minutes
  - Task/meeting title
  - Scheduled time
  - Day chips for visible work days
  - Completion status per day:
    - not completed
    - completed on time
    - completed late
    - completed early
- Each row/card supports:
  - Tap day chip to toggle completion for that day.
  - Long press or overflow to edit task.
  - Delete with confirmation.

Primary actions:

- Add standard task/meeting
- Edit minutes, task/meeting name, time, visible days
- Mark day complete/not complete
- Delete row

Backend mapping:

- `GET /api/lsw/context`
- `GET /api/lsw/daily-tasks`
- `POST /api/lsw/daily-tasks`
- `PATCH /api/lsw/daily-tasks/:taskId`
- `DELETE /api/lsw/daily-tasks/:taskId`
- `PATCH /api/lsw/settings` for work-days settings when the user has permission

### Follow Ups

Purpose:

- Keep follow-up commitments visible and editable from mobile.

Layout:

- Summary strip:
  - Open
  - Past due
  - Due this week
- Segmented filters:
  - `Open`
  - `Past Due`
  - `This Week`
  - `All`
- List rows:
  - Follow-up text
  - Responsible person
  - Due date
  - Comments preview
  - Status/past due chip
  - Swipe actions: Edit, Delete

Primary actions:

- Add Follow Up
- Edit follow up, responsible, due date, comments
- Delete follow up after confirmation

Backend mapping:

- `GET /api/lsw/follow-ups`
- `POST /api/lsw/follow-ups`
- `PATCH /api/lsw/follow-ups/:followUpId`
- `DELETE /api/lsw/follow-ups/:followUpId`

### Scheduled Tasks/Meetings

Purpose:

- Support recurring standard work that is not represented by the daily checkoff table.

Initial mobile placement:

- Add as a collapsible `Scheduled` section inside the `Week` tab after Daily & Weekly Standard Tasks/Meetings.

Backend mapping:

- `GET /api/lsw/scheduled-tasks`
- `POST /api/lsw/scheduled-tasks`
- `PATCH /api/lsw/scheduled-tasks/:taskId`
- `DELETE /api/lsw/scheduled-tasks/:taskId`

Frequency options:

- Bi-weekly
- Monthly
- Quarterly
- Annually

## API Service Work

Extend `mobile/src/services/lswApi.ts` so mobile exposes the same core API surface used by web:

- Context:
  - `getLswContext`
- Daily tasks:
  - `listLswDailyTasks`
  - `createLswDailyTask`
  - `updateLswDailyTask`
  - `deleteLswDailyTask`
- To Do:
  - `listLswTodoTasks`
  - existing `createLswTodoTask`
  - `updateLswTodoTask`
  - `deleteLswTodoTask`
- Follow Ups:
  - `listLswFollowUps`
  - existing `createLswFollowUp`
  - `updateLswFollowUp`
  - `deleteLswFollowUp`
- Scheduled Tasks/Meetings:
  - `listLswScheduledTasks`
  - `createLswScheduledTask`
  - `updateLswScheduledTask`
  - `deleteLswScheduledTask`

All calls must:

- Use `getSynzappApiBaseUrl()`.
- Include Firebase bearer token.
- Include registered device headers.
- Include App Check headers if the mobile API pattern requires them.
- Preserve query support for `week`, `year`, `timeZone`, and `observeUserId` where supported.

## Data Synchronization

Source of truth:

- Backend Firestore through existing `/api/lsw/*` routes.

Mobile behavior:

- Load from backend on entering LSW.
- Optimistically update UI for checkoff and simple edits.
- Roll back and show an inline error if backend save fails.
- Refresh on pull-to-refresh and app foreground.
- Re-fetch LSW data after creating To Do or Follow Up from chat so the LSW surface reflects chat-created records.

Web/mobile consistency:

- Mobile must not create a separate local schema for LSW.
- Mobile date, week, due status, and completion state must match web transformations.
- Mobile must send the same date/time formats:
  - dates: `YYYY-MM-DD`
  - times: `HH:mm`
  - day statuses: backend enum values

## Offline Behavior

Phase 1:

- Read-through cache for last loaded LSW workspace using local storage.
- Show cached LSW immediately when available.
- Mark screen as `Offline view` when network is unavailable.
- Disable destructive writes while offline unless a reliable queued write layer is added.

Phase 2:

- Add queued writes for checkoffs and simple completion changes only.
- Queue records with idempotency metadata if the backend supports it later.
- Sync queued writes on reconnect.

Do not implement offline mutation for deletes in the first mobile LSW release.

## Permissions

Mobile must rely on backend authorization and also reflect read-only state in the UI.

Rules:

- User can edit their own LSW when backend allows.
- Org Admin/Department Admin observation mode can be added after the personal workspace is stable.
- If the backend returns read-only context, disable add/edit/delete and show `View only`.
- Do not expose admin verification controls in this first mobile UX unless already supported by mobile permissions.

## UX Components

New components should be scoped and reusable:

- `LswWorkspaceScreen`
- `LswHeader`
- `LswSummaryStrip`
- `LswSegmentedTabs`
- `LswTodoList`
- `LswTodoRow`
- `LswDailyTaskBoard`
- `LswDailyTaskCard`
- `LswDayStatusChip`
- `LswFollowUpsList`
- `LswFollowUpRow`
- `LswScheduledTasksSection`
- `LswEditSheet`
- `LswDeleteConfirmModal`

Use existing app conventions:

- Native date/time pickers where date/time editing is needed.
- App theme colors from `useAppTheme`.
- Ionicons/Feather icons already used in the mobile app.
- Compact enterprise UI, not a marketing page.
- No nested cards.
- Stable row/card heights where possible to prevent layout jumping.

## Forms

Use bottom sheets or full-screen native-feeling forms depending on complexity:

- Add To Do:
  - Task
  - Due date
  - Due time
- Add Follow Up:
  - Follow up
  - Responsible
  - Due date
  - Comments
- Add Daily/Weekly Standard Task:
  - Task/meeting
  - Minutes
  - Time
  - Days of week toggles
- Add Scheduled Task/Meeting:
  - Task/meeting
  - Frequency
  - Due date
  - Minutes

Validation:

- Require task/follow-up text.
- Require responsible for Follow Ups.
- Validate backend date/time formats before submit.
- Show native alert or app-consistent inline error depending on the screen pattern.

## Implementation Phases

### Phase 1: Mobile LSW Service Parity

Status: API surface implemented for the requested mobile sections. Dedicated LSW API unit tests remain.

- Expand `mobile/src/services/lswApi.ts` to support list/update/delete for requested sections.
- Add TypeScript interfaces matching web/backend contracts.
- Add unit tests for response normalization and error handling.

### Phase 2: Navigation Shell

Status: Implemented.

- Add `LSW` to mobile tab/screen state or create a dedicated full-screen surface launched from main navigation.
- Wire `LEADERS STANDARD WORK` menu item to open the new screen.
- Back button returns to Chats.
- Add loading, empty, error, and pull-to-refresh states.

### Phase 3: To Do Today & This Week

Status: Implemented.

- Build To Do tab.
- Support list, add, complete/uncomplete, edit, delete.
- Ensure chat-created To Dos appear after refresh.

### Phase 4: Follow Ups

Status: Implemented.

- Build Follow Ups tab.
- Support list, add, edit, delete.
- Ensure chat-created Follow Ups appear after refresh.

### Phase 5: Daily & Weekly Standard Tasks/Meetings

Status: Implemented.

- Build Week tab using card-based mobile layout.
- Support add/edit/delete standard tasks.
- Support per-day checkoff updates through `dayStatusUpdates`.
- Match web week/day behavior from `/api/lsw/context`.

### Phase 6: Scheduled Tasks/Meetings

Status: Implemented as a Week subsection.

- Add scheduled tasks section inside Week.
- Support list/add/edit/delete.
- Keep recurrence labels consistent with backend frequency enum.

### Phase 7: Cache, Sync Polish, and QA

Status: Remaining.

- Replace text-only quick prompts in the workspace with a shared LSW edit sheet that reuses the existing app-consistent LSW native date/time controls used by chat-to-LSW creation.
- Add read-through cache for last loaded LSW state.
- Add pull-to-refresh and app foreground refresh.
- Test web-to-mobile and mobile-to-web synchronization.
- Test slow network and backend validation errors.
- Test iPhone physical device UX and Android layout.

## Acceptance Criteria

- Tapping `LEADERS STANDARD WORK` opens the mobile LSW workspace.
- Follow Ups created or edited on web appear on mobile after refresh.
- Follow Ups created or edited on mobile appear on web after refresh.
- To Do items created or edited on web appear on mobile after refresh.
- To Do items created or edited on mobile appear on web after refresh.
- Daily task day checkoffs on mobile match web status for the same week.
- Daily task edits on web/mobile remain consistent.
- Scheduled Tasks/Meetings display in mobile and sync with web.
- Date/time values are sent in backend-compatible formats.
- The UI works in light and dark app themes.
- Empty, loading, error, read-only, and offline states are handled.
- Existing chat, Library, Interpreter, RAILS, and Settings flows are not regressed.

## Verification Plan

- `npm run typecheck` passes.
- `npm run test:unit` passes.
- Manual web/mobile sync test:
  - Create To Do on web, refresh mobile.
  - Complete To Do on mobile, refresh web.
  - Create Follow Up on mobile, refresh web.
  - Edit Follow Up comments on web, refresh mobile.
  - Add Daily/Weekly task on web, check off today on mobile, refresh web.
  - Add Scheduled Task/Meeting on mobile, refresh web.
- Physical iPhone validation:
  - Navigation entry.
  - One-handed row actions.
  - Native date/time picker ergonomics.
  - Large text accessibility.
  - Offline cached view.

## Open Decisions

- Whether mobile observation mode should ship in the first release or after personal LSW is stable.
- Whether scheduled tasks should be a collapsible Week section or a fourth top-level tab.
- Whether completion write queue should be included in the first release or limited to read-through cache.
- Whether mobile should expose Excel export, or leave export as web-only initially.
