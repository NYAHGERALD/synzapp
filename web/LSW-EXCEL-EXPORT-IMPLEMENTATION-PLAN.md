# Synzapp LSW Excel Export Implementation Plan

## Purpose

Create a professional Leaders Standard Work Excel export for Synzapp using the existing `LSW_TEMPLATE.xlsx` workbook as the presentation template. The export must load real LSW data into the workbook, preserve the template styling, and let users download a polished `.xlsx` file from the LSW section.

The Dashmet backend export is the reference implementation. Synzapp should use the same proven pattern, but adapted to Synzapp's tenant-scoped Firestore model, observation mode, admin roles, and current LSW section names.

## Template Location

The source template has been copied from:

`dashmet-rca-backend/backend/assets/templates/LSW_TEMPLATE.xlsx`

Into Synzapp:

`SYNZAPP/backend/assets/templates/LSW_TEMPLATE.xlsx`

The temporary Excel lock file `~$LSW_TEMPLATE.xlsx` must not be copied or used.

## Enterprise Principles

1. Export generation belongs in the backend, not the browser.
2. The backend must enforce tenancy, role scope, and observation permissions before producing a file.
3. The template should remain a real Excel workbook with formatting, merged cells, section layout, and printable structure preserved.
4. The export should use real LSW records from Firestore only.
5. The export should never rely on frontend state as the source of truth.
6. Download activity should be audit logged.
7. The implementation should support the current user's own LSW first, then extend cleanly to observed-user, department, and company exports.

## Reference Learned From Dashmet

Dashmet uses `ExcelJS` in the backend and follows this pattern:

1. Load `LSW_TEMPLATE.xlsx` from backend assets.
2. Read the selected user's LSW data through the LSW service.
3. Split data into template sections:
   - Daily & Weekly Standard Tasks/Meetings
   - To Do Today & This Week
   - Scheduled Tasks/Meetings
   - Improvement Projects and Updates
   - Level 1, 2 & 3 Meeting Rails
   - Follow Ups
   - Key Results
   - Plant Specific Cause RCA Triggers
   - Personal Objectives/Goals
4. Calculate overflow row requirements for each workbook block.
5. Clear template merges before row insertion.
6. Duplicate styled rows bottom-up so formatting is preserved.
7. Rebuild merged cells after rows are inserted.
8. Write values into known ranges.
9. Normalize wrapping, borders, strike-through, and checkbox-like cells.
10. Stream the workbook with the correct Excel content type and attachment filename.

This is the correct baseline architecture for Synzapp.

## Synzapp Backend Design

### Dependency

Add `exceljs` to `SYNZAPP/backend/package.json`.

Reason: the existing `xlsx` package is present in the web app, but template-preserving workbook export should run in the backend with ExcelJS because it handles styled workbook loading, row duplication, merges, borders, and streaming better for this use case.

### New Service

Create:

`SYNZAPP/backend/src/services/lswExcelExportService.ts`

Responsibilities:

1. Load `backend/assets/templates/LSW_TEMPLATE.xlsx`.
2. Resolve the authorized LSW context using the existing LSW service rules.
3. Fetch all sections for the selected user/week/year.
4. Map Synzapp records into workbook-safe export rows.
5. Expand template sections without corrupting merged cells.
6. Fill workbook cells.
7. Normalize formatting.
8. Return a `Buffer` plus export metadata.

### Data Aggregation

Add or reuse a service-level helper that returns a complete export model:

```ts
interface LswExcelExportModel {
  owner: {
    uid: string;
    displayName: string;
    departmentName: string;
  };
  week: {
    weekNumber: number;
    year: number;
    weekBeginning: string;
    weekEnding: string;
    workDaysPerWeek: 5 | 6 | 7;
  };
  sections: {
    dailyTasks: LswDailyTaskExportRow[];
    todoTasks: LswTodoTaskExportRow[];
    meetingRails: LswMeetingRailExportRow[];
    improvementProjects: LswImprovementProjectExportRow[];
    followUps: LswFollowUpExportRow[];
    scheduledTasks: LswScheduledTaskExportRow[];
    rcaTriggers: LswRcaTriggerExportRow[];
    personalGoals: LswPersonalGoalExportRow[];
    keyResults: LswKeyResultExportGroup[];
  };
}
```

The export model should be built from server-side Firestore reads. It should not be assembled from frontend arrays.

### Route

Add:

`GET /api/lsw/export`

Query parameters:

```text
week=<number>
year=<number>
timeZone=<IANA time zone>
observeUserId=<optional user id>
includePastDueFollowUps=<optional boolean>
includePastDueTriggers=<optional boolean>
includePastDueScheduledTasks=<optional boolean>
includePastDueRails=<optional boolean>
includePastDueGoals=<optional boolean>
```

Behavior:

1. Authenticated user downloads their own LSW by default.
2. Department Admin can export observed users only inside their department scope.
3. Organization Admin can export any active user inside the company.
4. Read-only observation status does not block export, but must be audited.
5. Reject cross-tenant access.
6. Return:

```http
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="<CompanyName>-<UserName>-LSW-Week-<Week>.xlsx"
```

Filename parts are normalized to compact ASCII words with spaces removed, for example:

```text
DonMiguel-GeraldNyah-LSW-Week-43.xlsx
```

### Audit Logging

Log every export request:

- actor UID
- actor role
- target LSW owner UID
- company ID / tenant ID
- department ID
- week and year
- export type: `LSW_EXCEL`
- observation mode: yes/no
- timestamp
- request status: success/failure

This matters because exports are compliance-relevant.

## Workbook Mapping

Use the Dashmet workbook layout as the starting map:

### Block 1

Rows 2-16:

- Daily & Weekly Standard Tasks/Meetings
- To Do Today & This Week
- Scheduled Tasks/Meetings frequency groups

Required Synzapp upgrades:

- Use Synzapp's day status values, not only booleans.
- Represent completed on time, late, early, and not completed clearly.
- Export only the selected week.
- Respect work days per week.
- Future days should remain blank or neutral rather than counting against the user.

### Block 2

Rows 20-22:

- Improvement Projects and Updates
- Level 1, 2 & 3 Meeting Rails

Required Synzapp upgrades:

- Export every project and its latest/current update.
- Preserve row order from Synzapp.
- Meeting rails should show completion and due date.
- Past-due inclusion should follow the selected export options.

### Block 3

Rows 26-32:

- Follow Ups
- Key Results

Required Synzapp upgrades:

- Follow Ups should include owner/responsible, due date, notes, and completion state when available.
- Key Results should be loaded from Synzapp company key results configuration.

### Block 4

Rows 35-39:

- Plant Specific Cause RCA Triggers
- Personal Objectives/Goals

Required Synzapp upgrades:

- RCA triggers should include event date and notes.
- Personal goals should include objective, due date, progress percentage, and status.

### Footer / Info Block

Fill:

- Department
- User display name
- Week number and date range
- Export generated timestamp

If the template does not already have a generated timestamp field, add it in a controlled cell that does not damage layout.

## Frontend Design

### LSW Header Action

Add a compact export/download button to the LSW header, near existing print/week controls.

Button label:

`Export Excel`

Behavior:

1. Uses selected week/year from `LswContext`.
2. If observing another user's LSW, exports that observed user's LSW.
3. Uses the same read-only scope rules as observation mode.
4. Downloads the file directly.
5. Shows a professional loading state while the workbook is being generated.
6. Shows a clear error message if export fails.

### API Client

Add to:

`SYNZAPP/web/src/lswApi.ts`

```ts
export async function downloadLswExcelExport(options: LswContextOptions): Promise<void>
```

The helper should:

1. Build the query string with week/year/timeZone/observeUserId.
2. Fetch the binary file from `/api/lsw/export`.
3. Read the filename from `Content-Disposition` when available.
4. Create a browser download without navigating away from the LSW page.
5. Revoke the object URL after the download starts.

## Quality Requirements

1. Export must open cleanly in Excel and Numbers.
2. Template styling must remain intact.
3. Row expansion must not break merged cells.
4. Long text must wrap without clipping important fields.
5. Empty sections must clear template placeholder text.
6. Completed rows should be visually distinct where the template supports it.
7. Dates must be real Excel dates or consistent readable date strings, not malformed values.
8. No frontend-hardcoded export data.
9. No cross-tenant export leakage.
10. TypeScript build must pass.

## Implementation Phases

## Current Implementation Status

Implemented in Synzapp:

- Copied the real Excel template to `SYNZAPP/backend/assets/templates/LSW_TEMPLATE.xlsx`.
- Added backend `exceljs` support.
- Added `SYNZAPP/backend/src/services/lswExcelExportService.ts`.
- Added authenticated `GET /api/lsw/export`.
- Export now uses Synzapp backend LSW service reads, including the selected week and observed-user context.
- Export includes Daily & Weekly Standard Tasks/Meetings, To Do Today & This Week, Scheduled Tasks/Meetings, Improvement Projects and Updates, Level 1, 2 & 3 Meeting Rails, Follow Ups, Key Results, Plant Specific Cause RCA Triggers, and Personal Objectives/Goals.
- Added audit logging for successful and failed export requests.
- Added `downloadLswExcelExport` to the web LSW API client.
- Added an Excel download icon button to the LSW header beside the print button.

Verified:

- Backend TypeScript typecheck passes.
- Backend production build passes.
- Frontend production build passes.

Still recommended before production release:

- Test an authenticated workbook download against live Firebase data.
- Open the generated workbook in Excel and Numbers to confirm the template renders without repair warnings.
- Add automated route tests for own export, observed-user export, department scope, org scope, and denied cross-scope export.

### Phase 1 - Template and Backend Export Foundation

- Add backend `exceljs`.
- Create `lswExcelExportService.ts`.
- Port the safe workbook helpers from Dashmet:
  - merge clearing
  - row duplication
  - merge rebuilding
  - cell value sanitation
  - checkbox/status cell rendering
  - border normalization
- Add `/api/lsw/export`.
- Export the current user's selected week.

### Phase 2 - Synzapp Data Accuracy

- Build a Synzapp-native export model from existing LSW service records.
- Map day statuses accurately.
- Respect work days per week and selected week.
- Ensure past-due filters match the LSW UI.
- Include key results and all eight governed LSW sections.

### Phase 3 - Observation and Admin Scope

- Support `observeUserId`.
- Enforce Department Admin scope.
- Enforce Organization Admin company scope.
- Audit all exports.
- Make export behavior match read-only observation mode.

### Phase 4 - Frontend Download UX

- Add `Export Excel` action to the LSW header.
- Add download helper in `lswApi.ts`.
- Add loading and error states.
- Ensure the export does not interrupt typing or autosave.

### Phase 5 - Verification

- Add backend tests for:
  - own export
  - department scoped observed export
  - org admin observed export
  - cross-tenant rejection
  - blank section clearing
  - dynamic row expansion
- Manually open generated workbook and verify:
  - rows align
  - sections are populated
  - formatting is preserved
  - date/status values are readable
  - Daily & Weekly day columns render as editable Excel checkboxes linked to the exported checked/unchecked values
  - no Excel repair warning appears

## Deployment Notes

This feature includes backend changes. After implementation:

1. Run backend typecheck/build.
2. Run frontend typecheck.
3. Deploy backend.
4. Restart frontend.
5. Verify download against the hosted backend.

## Open Engineering Decisions

1. Should export include only the selected user's LSW, or should admin exports later support department/company workbook packs?
2. Should observation notes be included in the workbook, or remain in the application only?
3. Should the workbook show daily task status as checkmarks only, or show explicit labels for early/on-time/late/not completed?
4. Should the exported workbook include a hidden metadata/audit sheet?

Recommended first release:

Build the selected-user weekly export first, including observed-user support. Add department/company bulk export only after the single-user workbook is perfect.
