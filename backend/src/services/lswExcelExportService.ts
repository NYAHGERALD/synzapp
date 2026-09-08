import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { DecodedIdToken } from 'firebase-admin/auth';
import {
  getLswContext,
  listLswDailyTasks,
  listLswFollowUps,
  listLswImprovementProjects,
  listLswMeetingRails,
  listLswPersonalGoals,
  listLswRcaTriggers,
  listLswScheduledTasks,
  listLswTodoTasks,
  type DayKey,
  type LswScheduledTaskFrequency
} from './lswService.js';
import { getCompanyKeyResultsForCurrentUser } from './keyResultsService.js';

type LswExportContextInput = {
  observeUserId?: string;
  timeZone?: string;
  week?: number;
  year?: number;
};

type LswExcelExportResult = {
  buffer: Buffer;
  fileName: string;
  metadata: {
    companyName: string;
    departmentName: string;
    isObservation: boolean;
    ownerUid: string;
    tenantId: string;
    userName: string;
    week: number;
    year: number;
  };
};

type RowRange = {
  end: number;
  start: number;
};

type ExcelCheckboxTarget = {
  checked: boolean;
  columnIndex: number;
  ref: string;
  rowNumber: number;
};

type LswExcelTemplateLayout = {
  daily: RowRange;
  followUps: RowRange;
  improvementProjects: RowRange;
  keyResults: RowRange;
  meetingRails: RowRange;
  personalGoals: RowRange;
  rcaTriggers: RowRange;
  scheduledTasks: Record<LswScheduledTaskFrequency, RowRange>;
  todo: RowRange;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATE_PATH = path.resolve(__dirname, '../../assets/templates/LSW_TEMPLATE.xlsx');
const DAY_COLUMNS: Array<{ key: DayKey; column: string }> = [
  { key: 'mon', column: 'D' },
  { key: 'tue', column: 'E' },
  { key: 'wed', column: 'F' },
  { key: 'thu', column: 'G' },
  { key: 'fri', column: 'H' },
  { key: 'sat', column: 'I' },
  { key: 'sun', column: 'J' }
];
const DAILY_TEMPLATE_HEADER_VALUES: Record<string, string> = {
  A: 'Min',
  B: 'Daily & Weekly Standard tasks/meetings',
  C: 'Time',
  D: 'M',
  E: 'T',
  F: 'W',
  G: 'H',
  H: 'F',
  I: 'S',
  J: 'S'
};
const DAILY_TASK_ROW_MIN_HEIGHT = 18;
const DAILY_TASK_ROW_LINE_HEIGHT = 15;
const DAILY_TASK_TEXT_CHARS_PER_LINE = 52;
const TODO_TASK_TEXT_CHARS_PER_LINE = 34;
const SCHEDULED_ROW_START_BY_FREQUENCY: Record<LswScheduledTaskFrequency, number> = {
  BI_WEEKLY: 3,
  MONTHLY: 6,
  QUARTERLY: 10,
  ANNUALLY: 14
};

export async function generateLswExcelExport(
  decodedToken: DecodedIdToken,
  input: LswExportContextInput = {}
): Promise<LswExcelExportResult> {
  const context = await getLswContext(decodedToken, input);
  const exportInput = {
    observeUserId: input.observeUserId,
    timeZone: input.timeZone,
    week: context.week.selectedWeek,
    year: context.week.selectedYear
  };
  const [
    dailyTasks,
    todoTasks,
    meetingRails,
    personalGoals,
    improvementProjects,
    scheduledTasks,
    followUps,
    rcaTriggers,
    keyResults
  ] = await Promise.all([
    listLswDailyTasks(decodedToken, exportInput),
    listLswTodoTasks(decodedToken, exportInput),
    listLswMeetingRails(decodedToken, exportInput),
    listLswPersonalGoals(decodedToken, exportInput),
    listLswImprovementProjects(decodedToken, exportInput),
    listLswScheduledTasks(decodedToken, exportInput),
    listLswFollowUps(decodedToken, exportInput),
    listLswRcaTriggers(decodedToken, exportInput),
    getCompanyKeyResultsForCurrentUser(decodedToken).catch(() => ({ groups: [], units: [] }))
  ]);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_PATH);
  const worksheet = workbook.getWorksheet('Weekly') || workbook.worksheets[0];

  if (!worksheet) {
    throw new Error('The LSW Excel template does not contain a usable worksheet.');
  }

  worksheet.pageSetup = {
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    orientation: 'landscape'
  };

  const layout = prepareTemplateLayout(worksheet, {
    dailyTaskCount: dailyTasks.tasks.length,
    followUpCount: followUps.followUps.length,
    improvementProjectCount: improvementProjects.projects.length,
    keyResultMetricCount: (keyResults.groups || []).reduce((total, group) => total + (group.metrics?.length || 0), 0),
    meetingRailCount: meetingRails.rails.length,
    personalGoalCount: personalGoals.goals.length,
    rcaTriggerCount: rcaTriggers.triggers.length,
    scheduledTaskCounts: countScheduledTasksByFrequency(scheduledTasks.tasks),
    todoCount: todoTasks.tasks.length
  });
  normalizeExpandedTopBlockBorders(worksheet, layout);

  populateWorkbookProperties(workbook, context);
  restoreDailyTemplateHeader(worksheet);
  populateDailyTasks(worksheet, dailyTasks.tasks, layout);
  populateTodoTasks(worksheet, todoTasks.tasks, layout);
  populateScheduledTasks(worksheet, scheduledTasks.tasks, layout);
  populateImprovementProjects(worksheet, improvementProjects.projects, layout);
  populateMeetingRails(worksheet, meetingRails.rails, layout);
  populateFollowUps(worksheet, followUps.followUps, layout);
  populateKeyResults(worksheet, keyResults, layout);
  populateRcaTriggers(worksheet, rcaTriggers.triggers, layout);
  populatePersonalGoals(worksheet, personalGoals.goals, layout);
  normalizeWorkbook(worksheet);

  const generatedAt = new Date();
  const safeCompanyName = sanitizeFilePart(context.company.companyName || 'Company');
  const safeUserName = sanitizeFilePart(context.user.displayName || 'Leader');
  const fileName = `${safeCompanyName}-${safeUserName}-LSW-Week-${context.week.selectedWeek}.xlsx`;
  worksheet.getCell('A41').value = `Generated ${generatedAt.toLocaleString('en-US', { timeZone: input.timeZone || 'UTC' })}`;

  const output = await workbook.xlsx.writeBuffer();
  const outputWithCheckboxes = await addDailyTaskExcelCheckboxes(
    Buffer.from(output),
    [
      ...collectDailyTaskCheckboxTargets(dailyTasks.tasks, layout),
      ...collectTodoTaskCheckboxTargets(todoTasks.tasks, layout)
    ]
  );

  return {
    buffer: outputWithCheckboxes,
    fileName,
    metadata: {
      companyName: context.company.companyName,
      departmentName: context.department.name,
      isObservation: context.observation.isObserving,
      ownerUid: context.user.uid,
      tenantId: context.company.tenantId,
      userName: context.user.displayName,
      week: context.week.selectedWeek,
      year: context.week.selectedYear
    }
  };
}

function populateWorkbookProperties(workbook: ExcelJS.Workbook, context: Awaited<ReturnType<typeof getLswContext>>) {
  workbook.creator = 'Synzapp';
  workbook.company = context.company.companyName;
  workbook.subject = `Leader Standard Work - ${context.user.displayName}`;
  workbook.title = `LSW Week ${context.week.selectedWeek} ${context.week.selectedYear}`;
  workbook.keywords = [
    context.department.name,
    context.week.weekBeginningLabel,
    context.week.weekEndingLabel
  ].filter(Boolean).join(', ');
}

function populateDailyTasks(worksheet: ExcelJS.Worksheet, tasks: Array<{
  dayStatuses: Record<DayKey, string>;
  minutes: number;
  task: string;
  time: string;
}>, layout: LswExcelTemplateLayout) {
  const rows = rowsFor(layout.daily);
  rows.forEach((rowNumber, index) => {
    const task = tasks[index];
    setValue(worksheet, `A${rowNumber}`, task?.minutes ?? '');
    setValue(worksheet, `B${rowNumber}`, task?.task ?? '');
    setValue(worksheet, `C${rowNumber}`, task?.time ?? '');
    formatDailyTaskRow(worksheet, rowNumber, task?.task ?? '');
    DAY_COLUMNS.forEach(({ key, column }) => {
      setDayStatus(worksheet, `${column}${rowNumber}`, task?.dayStatuses?.[key] || 'not_completed');
    });
  });
}

function collectDailyTaskCheckboxTargets(tasks: Array<{
  dayStatuses: Record<DayKey, string>;
}>, layout: LswExcelTemplateLayout): ExcelCheckboxTarget[] {
  return rowsFor(layout.daily).flatMap((rowNumber, index) => {
    const task = tasks[index];
    return DAY_COLUMNS.map(({ key, column }) => ({
      checked: isCompletedDayStatus(task?.dayStatuses?.[key] || 'not_completed'),
      columnIndex: colLetterToIndex(column),
      ref: `${column}${rowNumber}`,
      rowNumber
    }));
  });
}

function restoreDailyTemplateHeader(worksheet: ExcelJS.Worksheet) {
  Object.entries(DAILY_TEMPLATE_HEADER_VALUES).forEach(([column, value]) => {
    const cell = worksheet.getCell(`${column}1`);
    cell.value = value;
    cell.alignment = {
      ...(cell.alignment || {}),
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true
    };
  });
}

function populateTodoTasks(worksheet: ExcelJS.Worksheet, tasks: Array<{
  completed: boolean;
  dueDate: string;
  dueTime: string;
  task: string;
}>, layout: LswExcelTemplateLayout) {
  const rows = rowsFor(layout.todo);
  rows.forEach((rowNumber, index) => {
    const task = tasks[index];
    setCheckboxValue(worksheet, `L${rowNumber}`, Boolean(task?.completed));
    setValue(worksheet, `M${rowNumber}`, task?.task ?? '');
    formatTodoTaskRow(worksheet, rowNumber, task?.task ?? '', Boolean(task?.completed));
  });
  applyTodoTaskCompletionFormatting(worksheet, layout.todo);
}

function collectTodoTaskCheckboxTargets(tasks: Array<{
  completed: boolean;
}>, layout: LswExcelTemplateLayout): ExcelCheckboxTarget[] {
  return rowsFor(layout.todo).map((rowNumber, index) => {
    const task = tasks[index];
    return {
      checked: Boolean(task?.completed),
      columnIndex: colLetterToIndex('L'),
      ref: `L${rowNumber}`,
      rowNumber
    };
  });
}

function populateScheduledTasks(worksheet: ExcelJS.Worksheet, tasks: Array<{
  dueDate: string;
  frequency: LswScheduledTaskFrequency;
  minutes: number;
  task: string;
}>, layout: LswExcelTemplateLayout) {
  const grouped = new Map<LswScheduledTaskFrequency, typeof tasks>();
  for (const task of tasks) {
    const list = grouped.get(task.frequency) || [];
    list.push(task);
    grouped.set(task.frequency, list);
  }

  for (const frequency of Object.keys(SCHEDULED_ROW_START_BY_FREQUENCY) as LswScheduledTaskFrequency[]) {
    const sectionTasks = grouped.get(frequency) || [];
    const rows = rowsFor(layout.scheduledTasks[frequency]);
    rows.forEach((rowNumber, index) => {
      const task = sectionTasks[index];
      setValue(worksheet, `O${rowNumber}`, task ? task.minutes : '');
      setValue(worksheet, `P${rowNumber}`, task ? task.task : '');
      setValue(worksheet, `Q${rowNumber}`, task ? formatDateOnly(task.dueDate) : '');
    });
  }
}

function populateImprovementProjects(worksheet: ExcelJS.Worksheet, projects: Array<{
  project: string;
  updates: Array<{ text: string }>;
}>, layout: LswExcelTemplateLayout) {
  const rows = rowsFor(layout.improvementProjects);
  rows.forEach((rowNumber, index) => {
    const project = projects[index];
    setValue(worksheet, `A${rowNumber}`, '');
    setValue(worksheet, `B${rowNumber}`, project?.project ?? '');
    setValue(worksheet, `G${rowNumber}`, project?.updates?.at(-1)?.text ?? '');
  });
}

function populateMeetingRails(worksheet: ExcelJS.Worksheet, rails: Array<{
  completed: boolean;
  dueDate: string;
  dueTime: string;
  rail: string;
}>, layout: LswExcelTemplateLayout) {
  const rows = rowsFor(layout.meetingRails);
  rows.forEach((rowNumber, index) => {
    const rail = rails[index];
    setValue(worksheet, `O${rowNumber}`, rail ? (rail.completed ? 'Done' : 'Open') : '');
    setValue(worksheet, `P${rowNumber}`, rail?.rail ?? '');
    setValue(worksheet, `Q${rowNumber}`, rail ? `${formatDateOnly(rail.dueDate)} ${rail.dueTime || ''}` : '');
  });
}

function populateFollowUps(worksheet: ExcelJS.Worksheet, followUps: Array<{
  comments: string;
  dueDate: string;
  followUp: string;
  responsible: string;
}>, layout: LswExcelTemplateLayout) {
  const rows = rowsFor(layout.followUps);
  rows.forEach((rowNumber, index) => {
    const followUp = followUps[index];
    setValue(worksheet, `A${rowNumber}`, followUp?.followUp ?? '');
    setValue(worksheet, `G${rowNumber}`, followUp?.responsible ?? '');
    setValue(worksheet, `J${rowNumber}`, followUp ? formatDateOnly(followUp.dueDate) : '');
    setValue(worksheet, `L${rowNumber}`, followUp?.comments ?? '');
  });
}

function populateKeyResults(worksheet: ExcelJS.Worksheet, config: {
  groups?: Array<{ metrics?: Array<{ label?: string; target?: string; value?: string }> }>;
}, layout: LswExcelTemplateLayout) {
  const metrics = (config.groups || []).flatMap((group) => group.metrics || []);
  const rows = rowsFor(layout.keyResults);
  rows.forEach((rowNumber, index) => {
    const metric = metrics[index];
    setValue(worksheet, `P${rowNumber}`, metric?.label || '');
    setValue(worksheet, `Q${rowNumber}`, metric ? [metric.value, metric.target].filter(Boolean).join(' / ') : '');
  });
}

function populateRcaTriggers(worksheet: ExcelJS.Worksheet, triggers: Array<{
  comments: string;
  eventDate: string;
  trigger: string;
}>, layout: LswExcelTemplateLayout) {
  const rows = rowsFor(layout.rcaTriggers);
  rows.forEach((rowNumber, index) => {
    const trigger = triggers[index];
    setValue(worksheet, `A${rowNumber}`, trigger?.trigger ?? '');
    setValue(worksheet, `J${rowNumber}`, trigger ? formatDateOnly(trigger.eventDate) : '');
    setValue(worksheet, `L${rowNumber}`, trigger?.comments ?? '');
  });
}

function populatePersonalGoals(worksheet: ExcelJS.Worksheet, goals: Array<{
  dueDate: string;
  objective: string;
  progress: number;
}>, layout: LswExcelTemplateLayout) {
  const rows = rowsFor(layout.personalGoals);
  rows.forEach((rowNumber, index) => {
    const goal = goals[index];
    setValue(worksheet, `O${rowNumber}`, goal?.objective ?? '');
    setValue(worksheet, `P${rowNumber}`, goal ? `${goal.progress}%` : '');
    setValue(worksheet, `Q${rowNumber}`, goal ? formatDateOnly(goal.dueDate) : '');
  });
}

function prepareTemplateLayout(
  worksheet: ExcelJS.Worksheet,
  counts: {
    dailyTaskCount: number;
    followUpCount: number;
    improvementProjectCount: number;
    keyResultMetricCount: number;
    meetingRailCount: number;
    personalGoalCount: number;
    rcaTriggerCount: number;
    scheduledTaskCounts: Record<LswScheduledTaskFrequency, number>;
    todoCount: number;
  }
): LswExcelTemplateLayout {
  const scheduledRows = {
    BI_WEEKLY: { start: 3, end: 4 },
    MONTHLY: { start: 6, end: 7 },
    QUARTERLY: { start: 10, end: 11 },
    ANNUALLY: { start: 14, end: 15 }
  } satisfies Record<LswScheduledTaskFrequency, RowRange>;
  const blockOneExtra = Math.max(
    0,
    counts.dailyTaskCount - 15,
    counts.todoCount - 11,
    counts.scheduledTaskCounts.BI_WEEKLY - 2,
    counts.scheduledTaskCounts.MONTHLY - 2,
    counts.scheduledTaskCounts.QUARTERLY - 2,
    counts.scheduledTaskCounts.ANNUALLY - 2
  );
  const blockTwoExtra = Math.max(0, counts.improvementProjectCount - 3, counts.meetingRailCount - 3);
  const blockThreeExtra = Math.max(0, counts.followUpCount - 7, counts.keyResultMetricCount - 7);
  const blockFourExtra = Math.max(0, counts.rcaTriggerCount - 5, counts.personalGoalCount - 5);

  duplicateRowsWhenNeeded(worksheet, 39, blockFourExtra);
  duplicateRowsWhenNeeded(worksheet, 32, blockThreeExtra);
  duplicateRowsWhenNeeded(worksheet, 22, blockTwoExtra);
  duplicateRowsWhenNeeded(worksheet, 16, blockOneExtra);

  const afterBlockOne = blockOneExtra;
  const afterBlockTwo = afterBlockOne + blockTwoExtra;
  const afterBlockThree = afterBlockTwo + blockThreeExtra;

  return {
    daily: { start: 2, end: 16 + blockOneExtra },
    followUps: { start: 26 + afterBlockTwo, end: 32 + afterBlockTwo + blockThreeExtra },
    improvementProjects: { start: 20 + afterBlockOne, end: 22 + afterBlockOne + blockTwoExtra },
    keyResults: { start: 26 + afterBlockTwo, end: 32 + afterBlockTwo + blockThreeExtra },
    meetingRails: { start: 20 + afterBlockOne, end: 22 + afterBlockOne + blockTwoExtra },
    personalGoals: { start: 35 + afterBlockThree, end: 39 + afterBlockThree + blockFourExtra },
    rcaTriggers: { start: 35 + afterBlockThree, end: 39 + afterBlockThree + blockFourExtra },
    scheduledTasks: {
      BI_WEEKLY: shiftRange(scheduledRows.BI_WEEKLY, 0, blockOneExtra),
      MONTHLY: shiftRange(scheduledRows.MONTHLY, 0, blockOneExtra),
      QUARTERLY: shiftRange(scheduledRows.QUARTERLY, 0, blockOneExtra),
      ANNUALLY: shiftRange(scheduledRows.ANNUALLY, 0, blockOneExtra)
    },
    todo: { start: 2, end: 16 + blockOneExtra }
  };
}

function countScheduledTasksByFrequency(
  tasks: Array<{ frequency: LswScheduledTaskFrequency }>
): Record<LswScheduledTaskFrequency, number> {
  return tasks.reduce<Record<LswScheduledTaskFrequency, number>>((counts, task) => {
    counts[task.frequency] += 1;
    return counts;
  }, {
    ANNUALLY: 0,
    BI_WEEKLY: 0,
    MONTHLY: 0,
    QUARTERLY: 0
  });
}

function duplicateRowsWhenNeeded(worksheet: ExcelJS.Worksheet, rowNumber: number, count: number) {
  if (count > 0) {
    worksheet.duplicateRow(rowNumber, count, true);
  }
}

function normalizeExpandedTopBlockBorders(worksheet: ExcelJS.Worksheet, layout: LswExcelTemplateLayout) {
  const topBlockRange = { start: layout.daily.start, end: layout.daily.end };

  normalizeSectionBottomBorders(worksheet, layout.daily, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
  normalizeSectionBottomBorders(worksheet, topBlockRange, ['L', 'M']);
  normalizeSectionBottomBorders(worksheet, topBlockRange, ['O', 'P', 'Q']);
  normalizeSectionBottomBorders(worksheet, layout.improvementProjects, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']);
  normalizeSectionBottomBorders(worksheet, layout.meetingRails, ['O', 'P', 'Q']);
  normalizeSectionBottomBorders(worksheet, layout.followUps, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']);
  normalizeSectionBottomBorders(worksheet, layout.keyResults, ['O', 'P', 'Q']);
  normalizeSectionBottomBorders(worksheet, layout.rcaTriggers, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']);
  normalizeSectionBottomBorders(worksheet, layout.personalGoals, ['O', 'P', 'Q']);
}

function normalizeSectionBottomBorders(worksheet: ExcelJS.Worksheet, range: RowRange, columns: string[]) {
  rowsFor(range).forEach((rowNumber) => {
    const bottomStyle: ExcelJS.BorderStyle = rowNumber === range.end ? 'medium' : 'thin';

    columns.forEach((column) => {
      const cell = worksheet.getCell(`${column}${rowNumber}`);
      const style = cloneCellStyle(cell.style);
      style.border = {
        ...(style.border || {}),
        bottom: {
          color: { argb: 'FF000000' },
          style: bottomStyle
        }
      };
      cell.style = style;
    });
  });
}

function cloneCellStyle(style: Partial<ExcelJS.Style> = {}): Partial<ExcelJS.Style> {
  return JSON.parse(JSON.stringify(style)) as Partial<ExcelJS.Style>;
}

function rowsFor(range: RowRange): number[] {
  return Array.from({ length: range.end - range.start + 1 }, (_, index) => range.start + index);
}

function shiftRange(range: RowRange, startOffset: number, endOffset = startOffset): RowRange {
  return {
    end: range.end + endOffset,
    start: range.start + startOffset
  };
}

function setDayStatus(worksheet: ExcelJS.Worksheet, cellRef: string, status: string) {
  setCheckboxValue(worksheet, cellRef, isCompletedDayStatus(status));
}

function setCheckboxValue(worksheet: ExcelJS.Worksheet, cellRef: string, checked: boolean) {
  const cell = worksheet.getCell(cellRef);
  cell.value = checked;
  cell.numFmt = ';;;';
  cell.alignment = {
    ...(cell.alignment || {}),
    horizontal: 'center',
    vertical: 'middle'
  };
}

function isCompletedDayStatus(status: string) {
  return ['completed_on_time', 'completed_late', 'completed_early'].includes(status);
}

function formatDailyTaskRow(worksheet: ExcelJS.Worksheet, rowNumber: number, taskText: string) {
  const row = worksheet.getRow(rowNumber);
  const taskCell = worksheet.getCell(`B${rowNumber}`);
  const estimatedLines = estimateWrappedLineCount(taskText, DAILY_TASK_TEXT_CHARS_PER_LINE);

  row.height = Math.max(DAILY_TASK_ROW_MIN_HEIGHT, estimatedLines * DAILY_TASK_ROW_LINE_HEIGHT);
  taskCell.alignment = {
    ...(taskCell.alignment || {}),
    horizontal: 'left',
    shrinkToFit: false,
    vertical: 'top',
    wrapText: true
  };
  worksheet.getCell(`A${rowNumber}`).alignment = { horizontal: 'center', vertical: 'top' };
  worksheet.getCell(`C${rowNumber}`).alignment = { horizontal: 'center', vertical: 'top' };
}

function formatTodoTaskRow(worksheet: ExcelJS.Worksheet, rowNumber: number, taskText: string, completed: boolean) {
  const row = worksheet.getRow(rowNumber);
  const checkboxCell = worksheet.getCell(`L${rowNumber}`);
  const taskCell = worksheet.getCell(`M${rowNumber}`);
  const estimatedLines = estimateWrappedLineCount(taskText, TODO_TASK_TEXT_CHARS_PER_LINE);

  row.height = Math.max(DAILY_TASK_ROW_MIN_HEIGHT, estimatedLines * DAILY_TASK_ROW_LINE_HEIGHT);
  checkboxCell.alignment = {
    ...(checkboxCell.alignment || {}),
    horizontal: 'center',
    vertical: 'middle'
  };
  taskCell.alignment = {
    ...(taskCell.alignment || {}),
    horizontal: 'left',
    shrinkToFit: false,
    vertical: 'top',
    wrapText: true
  };
  taskCell.font = {
    ...(taskCell.font || {}),
    strike: completed
  };
}

function applyTodoTaskCompletionFormatting(worksheet: ExcelJS.Worksheet, range: RowRange) {
  worksheet.addConditionalFormatting({
    ref: `M${range.start}:M${range.end}`,
    rules: [
      {
        formulae: [`$L${range.start}=TRUE`],
        priority: 1,
        style: {
          font: {
            strike: true
          }
        },
        type: 'expression'
      }
    ]
  });
}

function setValue(worksheet: ExcelJS.Worksheet, cellRef: string, value: string | number) {
  const cell = worksheet.getCell(cellRef);
  cell.value = value;
  cell.alignment = {
    ...(cell.alignment || {}),
    shrinkToFit: false,
    vertical: 'middle',
    wrapText: true
  };
}

function normalizeWorkbook(worksheet: ExcelJS.Worksheet) {
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      if (typeof cell.value === 'boolean') {
        return;
      }

      cell.font = {
        ...(cell.font || {}),
        bold: false
      };
    });
  });
}

function estimateWrappedLineCount(value: string, charsPerLine: number): number {
  if (!value.trim()) {
    return 1;
  }

  return value
    .split(/\r?\n/)
    .reduce((lineCount, line) => lineCount + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
}

function sanitizeFilePart(value: string): string {
  const safeValue = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '')
    .slice(0, 80);

  return safeValue || 'Leader';
}

function formatDateOnly(value: string): string {
  if (!value) {
    return '';
  }

  const date = new Date(`${value}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric'
  }).format(date);
}

async function addDailyTaskExcelCheckboxes(buffer: Buffer, targets: ExcelCheckboxTarget[]): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  await normalizeWorksheetPartsForExcel(zip);

  if (!targets.length) {
    return zip.generateAsync({ compression: 'DEFLATE', type: 'nodebuffer' });
  }

  const weeklySheetPath = await resolveWorksheetPath(zip, 'Weekly');

  if (!weeklySheetPath) {
    return zip.generateAsync({ compression: 'DEFLATE', type: 'nodebuffer' });
  }

  const sheetXml = await readZipText(zip, weeklySheetPath);
  if (!sheetXml) {
    return buffer;
  }

  const contentTypesXml = await readZipText(zip, '[Content_Types].xml');

  if (!contentTypesXml) {
    return buffer;
  }

  const normalizedSheetXml = await readZipText(zip, weeklySheetPath) || sheetXml;
  const stylesXml = await readZipText(zip, 'xl/styles.xml');
  const workbookRelsXml = await readZipText(zip, 'xl/_rels/workbook.xml.rels');

  if (!stylesXml || !workbookRelsXml) {
    return zip.generateAsync({ compression: 'DEFLATE', type: 'nodebuffer' });
  }

  const checkboxStyleIds = collectCellStyleIds(normalizedSheetXml, targets.map((target) => target.ref));

  zip.file('xl/styles.xml', addCheckboxFeatureToStyles(stylesXml, checkboxStyleIds));
  zip.file('xl/featurePropertyBag/featurePropertyBag.xml', buildCheckboxFeaturePropertyBag());
  zip.file('xl/_rels/workbook.xml.rels', ensureFeaturePropertyBagRelationship(workbookRelsXml));
  zip.file('[Content_Types].xml', ensureFeaturePropertyBagContentType(contentTypesXml));

  return zip.generateAsync({ compression: 'DEFLATE', type: 'nodebuffer' });
}

async function normalizeWorksheetPartsForExcel(zip: JSZip) {
  const worksheetPaths = Object.keys(zip.files).filter((fileName) => /^xl\/worksheets\/sheet\d+\.xml$/.test(fileName));

  await Promise.all(
    worksheetPaths.map(async (worksheetPath) => {
      const worksheetXml = await readZipText(zip, worksheetPath);

      if (!worksheetXml) {
        return;
      }

      const normalizedXml = normalizeWorksheetXmlForExcel(worksheetXml);

      if (normalizedXml !== worksheetXml) {
        zip.file(worksheetPath, normalizedXml);
      }
    })
  );
}

function normalizeWorksheetXmlForExcel(worksheetXml: string) {
  return worksheetXml
    .replace(/\s+horizontalDpi="4294967295"/g, '')
    .replace(/\s+verticalDpi="4294967295"/g, '');
}

function collectCellStyleIds(sheetXml: string, cellRefs: string[]) {
  const styleIds = new Set<number>();

  cellRefs.forEach((cellRef) => {
    const cellMatch = sheetXml.match(new RegExp(`<c\\b(?=[^>]*\\br="${escapeRegExp(cellRef)}")[^>]*>`));
    const styleMatch = cellMatch?.[0].match(/\bs="(\d+)"/);

    if (styleMatch) {
      styleIds.add(Number(styleMatch[1]));
    }
  });

  return styleIds;
}

function addCheckboxFeatureToStyles(stylesXml: string, checkboxStyleIds: Set<number>) {
  if (!checkboxStyleIds.size) {
    return stylesXml;
  }

  const cellXfsMatch = stylesXml.match(/<cellXfs\b[^>]*>[\s\S]*?<\/cellXfs>/);

  if (!cellXfsMatch) {
    return stylesXml;
  }

  const cellXfsXml = cellXfsMatch[0];
  const xfs = parseCellXfs(cellXfsXml);
  const updatedXfs = xfs.map((xf, index) => (
    checkboxStyleIds.has(index) ? addCheckboxFeatureToXf(xf) : xf
  ));

  return stylesXml.replace(cellXfsXml, cellXfsXml.replace(xfs.join(''), updatedXfs.join('')));
}

function parseCellXfs(cellXfsXml: string) {
  const xfs: string[] = [];
  let cursor = 0;

  while (cursor < cellXfsXml.length) {
    const start = cellXfsXml.indexOf('<xf', cursor);

    if (start === -1) {
      break;
    }

    const startTagEnd = cellXfsXml.indexOf('>', start);

    if (startTagEnd === -1) {
      break;
    }

    const isSelfClosing = cellXfsXml.slice(Math.max(start, startTagEnd - 1), startTagEnd + 1) === '/>';
    const end = isSelfClosing
      ? startTagEnd + 1
      : cellXfsXml.indexOf('</xf>', startTagEnd) + '</xf>'.length;

    if (end < startTagEnd) {
      break;
    }

    xfs.push(cellXfsXml.slice(start, end));
    cursor = end;
  }

  return xfs;
}

function addCheckboxFeatureToXf(xfXml: string) {
  if (xfXml.includes('xfComplement')) {
    return xfXml;
  }

  const checkboxExtension = '<ext uri="{C7286773-470A-42A8-94C5-96B5CB345126}" xmlns:xfpb="http://schemas.microsoft.com/office/spreadsheetml/2022/featurepropertybag"><xfpb:xfComplement i="0"/></ext>';

  if (xfXml.includes('<extLst>')) {
    return xfXml.replace('<extLst>', `<extLst>${checkboxExtension}`);
  }

  if (xfXml.endsWith('/>')) {
    return `${xfXml.slice(0, -2)}><extLst>${checkboxExtension}</extLst></xf>`;
  }

  return xfXml.replace('</xf>', `<extLst>${checkboxExtension}</extLst></xf>`);
}

function buildCheckboxFeaturePropertyBag() {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<FeaturePropertyBags xmlns="http://schemas.microsoft.com/office/spreadsheetml/2022/featurepropertybag">',
    '<bag type="Checkbox"/>',
    '<bag type="XFControls"><bagId k="CellControl">0</bagId></bag>',
    '<bag type="XFComplement"><bagId k="XFControls">1</bagId></bag>',
    '<bag type="XFComplements" extRef="XFComplementsMapperExtRef"><a k="MappedFeaturePropertyBags"><bagId>2</bagId></a></bag>',
    '</FeaturePropertyBags>'
  ].join('');
}

function ensureFeaturePropertyBagRelationship(workbookRelsXml: string) {
  if (workbookRelsXml.includes('relationships/FeaturePropertyBag')) {
    return workbookRelsXml;
  }

  const maxRelationshipNumber = Math.max(
    0,
    ...Array.from(workbookRelsXml.matchAll(/Id="rId(\d+)"/g), (match) => Number(match[1]))
  );
  const relationship = `<Relationship Id="rId${maxRelationshipNumber + 1}" Type="http://schemas.microsoft.com/office/2022/11/relationships/FeaturePropertyBag" Target="featurePropertyBag/featurePropertyBag.xml"/>`;

  return workbookRelsXml.replace('</Relationships>', `${relationship}</Relationships>`);
}

function ensureFeaturePropertyBagContentType(contentTypesXml: string) {
  if (contentTypesXml.includes('/xl/featurePropertyBag/featurePropertyBag.xml')) {
    return contentTypesXml;
  }

  const override = '<Override PartName="/xl/featurePropertyBag/featurePropertyBag.xml" ContentType="application/vnd.ms-excel.featurepropertybag+xml"/>';
  return contentTypesXml.replace('</Types>', `${override}</Types>`);
}

async function resolveWorksheetPath(zip: JSZip, sheetName: string): Promise<string | null> {
  const workbookXml = await readZipText(zip, 'xl/workbook.xml');
  const workbookRelsXml = await readZipText(zip, 'xl/_rels/workbook.xml.rels');

  if (!workbookXml || !workbookRelsXml) {
    return null;
  }

  const escapedSheetName = escapeRegExp(escapeXmlAttribute(sheetName));
  const sheetMatch = workbookXml.match(new RegExp(`<sheet\\b[^>]*name="${escapedSheetName}"[^>]*r:id="([^"]+)"[^>]*/?>`));

  if (!sheetMatch) {
    return null;
  }

  const relationshipId = sheetMatch[1];
  const relMatch = workbookRelsXml.match(new RegExp(`<Relationship\\b[^>]*Id="${escapeRegExp(relationshipId)}"[^>]*Target="([^"]+)"[^>]*/?>`));

  if (!relMatch) {
    return null;
  }

  return `xl/${relMatch[1].replace(/^\/?xl\//, '')}`;
}

async function readZipText(zip: JSZip, filePath: string): Promise<string | null> {
  const file = zip.file(filePath);
  return file ? file.async('text') : null;
}

function worksheetRelationshipsPath(sheetPath: string) {
  const lastSlash = sheetPath.lastIndexOf('/');
  const directory = sheetPath.slice(0, lastSlash);
  const fileName = sheetPath.slice(lastSlash + 1);
  return `${directory}/_rels/${fileName}.rels`;
}

function emptyRelationshipsXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
}

function buildVmlDrawingRelationship(relsXml: string, vmlDrawingName: string) {
  const maxRelationshipNumber = Math.max(
    0,
    ...Array.from(relsXml.matchAll(/Id="rId(\d+)"/g), (match) => Number(match[1]))
  );
  const vmlRelationshipId = `rId${maxRelationshipNumber + 1}`;
  const relationship = `<Relationship Id="${vmlRelationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing" Target="../drawings/${vmlDrawingName}.vml"/>`;

  return {
    vmlRelationshipId,
    xml: relsXml.replace('</Relationships>', `${relationship}</Relationships>`)
  };
}

function ensureWorksheetControlNamespaces(sheetXml: string) {
  const rootMatch = sheetXml.match(/<worksheet\b[^>]*>/);

  if (!rootMatch) {
    return sheetXml;
  }

  let rootTag = rootMatch[0];
  const originalRootTag = rootTag;

  if (!rootTag.includes('xmlns:r=')) {
    rootTag = rootTag.replace('<worksheet', '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"');
  }

  if (!rootTag.includes('xmlns:xdr=')) {
    rootTag = rootTag.replace('<worksheet', '<worksheet xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"');
  }

  if (!rootTag.includes('xmlns:x14=')) {
    rootTag = rootTag.replace('<worksheet', '<worksheet xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main"');
  }

  if (!rootTag.includes('xmlns:mc=')) {
    rootTag = rootTag.replace('<worksheet', '<worksheet xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"');
  }

  if (rootTag.includes('mc:Ignorable=')) {
    rootTag = rootTag.replace(/mc:Ignorable="([^"]*)"/, (_match, value: string) => {
      const tokens = new Set(value.split(/\s+/).filter(Boolean));
      tokens.add('x14');
      return `mc:Ignorable="${Array.from(tokens).join(' ')}"`;
    });
  } else {
    rootTag = rootTag.replace(/>$/, ' mc:Ignorable="x14">');
  }

  return sheetXml.replace(originalRootTag, rootTag);
}

function addLegacyCheckboxDrawingToWorksheetXml(sheetXml: string, vmlRelationshipId: string) {
  const xmlWithoutExistingCheckboxDrawing = sheetXml.replace(/<legacyDrawing\b[^>]*\/>/g, '');
  const legacyDrawingXml = `<legacyDrawing r:id="${vmlRelationshipId}"/>`;

  if (xmlWithoutExistingCheckboxDrawing.includes('<extLst>')) {
    return xmlWithoutExistingCheckboxDrawing.replace('<extLst>', `${legacyDrawingXml}<extLst>`);
  }

  return xmlWithoutExistingCheckboxDrawing.replace('</worksheet>', `${legacyDrawingXml}</worksheet>`);
}

function addCheckboxControlsToWorksheetXml(
  sheetXml: string,
  vmlRelationshipId: string,
  targets: ExcelCheckboxTarget[],
  controlRelationshipIds: string[]
) {
  const xmlWithoutExistingControls = sheetXml
    .replace(/<legacyDrawing\b[^>]*\/>/g, '')
    .replace(/<mc:AlternateContent[^>]*>\s*<mc:Choice Requires="x14">\s*<controls>[\s\S]*?<\/controls>\s*<\/mc:Choice>\s*<\/mc:AlternateContent>/g, '');
  const controlsXml = [
    `<legacyDrawing r:id="${vmlRelationshipId}"/>`,
    '<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">',
    '<mc:Choice Requires="x14">',
    '<controls>',
    ...targets.map((target, index) => buildWorksheetControlXml(target, index, controlRelationshipIds[index])),
    '</controls>',
    '</mc:Choice>',
    '</mc:AlternateContent>'
  ].join('');

  if (xmlWithoutExistingControls.includes('<extLst>')) {
    return xmlWithoutExistingControls.replace('<extLst>', `${controlsXml}<extLst>`);
  }

  return xmlWithoutExistingControls.replace('</worksheet>', `${controlsXml}</worksheet>`);
}

function buildWorksheetControlXml(target: ExcelCheckboxTarget, index: number, relationshipId: string) {
  const shapeId = 30000 + index + 1;
  const zeroBasedColumn = target.columnIndex - 1;
  const zeroBasedRow = target.rowNumber - 1;

  return [
    '<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">',
    '<mc:Choice Requires="x14">',
    `<control shapeId="${shapeId}" r:id="${relationshipId}" name="LSW Day Check ${index + 1}">`,
    '<controlPr defaultSize="0" autoFill="0" autoLine="0" autoPict="0">',
    '<anchor moveWithCells="1" sizeWithCells="1">',
    '<from>',
    `<xdr:col>${zeroBasedColumn}</xdr:col>`,
    '<xdr:colOff>38100</xdr:colOff>',
    `<xdr:row>${zeroBasedRow}</xdr:row>`,
    '<xdr:rowOff>38100</xdr:rowOff>',
    '</from>',
    '<to>',
    `<xdr:col>${zeroBasedColumn + 1}</xdr:col>`,
    '<xdr:colOff>0</xdr:colOff>',
    `<xdr:row>${zeroBasedRow + 1}</xdr:row>`,
    '<xdr:rowOff>0</xdr:rowOff>',
    '</to>',
    '</anchor>',
    '</controlPr>',
    '</control>',
    '</mc:Choice>',
    '</mc:AlternateContent>'
  ].join('');
}

function buildCheckboxRelationships(
  relsXml: string,
  vmlDrawingName: string,
  nextControlPropNumber: number,
  targetCount: number
) {
  const maxRelationshipNumber = Math.max(
    0,
    ...Array.from(relsXml.matchAll(/Id="rId(\d+)"/g), (match) => Number(match[1]))
  );
  const vmlRelationshipId = `rId${maxRelationshipNumber + 1}`;
  const controlRelationshipIds = Array.from({ length: targetCount }, (_, index) => `rId${maxRelationshipNumber + 2 + index}`);
  const newRelationships = [
    `<Relationship Id="${vmlRelationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing" Target="../drawings/${vmlDrawingName}.vml"/>`,
    ...controlRelationshipIds.map((relationshipId, index) => (
      `<Relationship Id="${relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/ctrlProp" Target="../ctrlProps/ctrlProp${nextControlPropNumber + index}.xml"/>`
    ))
  ].join('');

  return {
    controlRelationshipIds,
    vmlRelationshipId,
    xml: relsXml.replace('</Relationships>', `${newRelationships}</Relationships>`)
  };
}

function buildCheckboxVmlDrawing(targets: ExcelCheckboxTarget[]) {
  return [
    '<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">',
    '<o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="30"/></o:shapelayout>',
    '<v:shapetype id="_x0000_t201" coordsize="21600,21600" o:spt="201" path="m,l,21600r21600,l21600,xe">',
    '<v:stroke joinstyle="miter"/>',
    '<v:path shadowok="f" o:extrusionok="f" strokeok="f" fillok="f" o:connecttype="rect"/>',
    '<o:lock v:ext="edit" shapetype="t"/>',
    '</v:shapetype>',
    ...targets.map((target, index) => buildCheckboxVmlShape(target, index)),
    '</xml>'
  ].join('');
}

function buildCheckboxVmlShape(target: ExcelCheckboxTarget, index: number) {
  const shapeId = 30000 + index + 1;
  const zeroBasedColumn = target.columnIndex - 1;
  const zeroBasedRow = target.rowNumber - 1;
  const styleLeft = Math.max(0, zeroBasedColumn) * 24;
  const styleTop = Math.max(0, zeroBasedRow) * DAILY_TASK_ROW_MIN_HEIGHT;
  const checkedXml = target.checked ? '<x:Checked>1</x:Checked>' : '';

  return [
    `<v:shape id="_x0000_s${shapeId}" type="#_x0000_t201" style='position:absolute;margin-left:${styleLeft}pt;margin-top:${styleTop}pt;width:14pt;height:14pt;z-index:${index + 1};mso-wrap-style:tight' filled="f" fillcolor="window [65]" stroked="f" strokecolor="windowText [64]" o:insetmode="auto">`,
    '<v:path shadowok="t" strokeok="t" fillok="t"/>',
    '<o:lock v:ext="edit" rotation="t"/>',
    "<v:textbox style='mso-direction-alt:auto' o:singleclick=\"f\"><div style='text-align:left'></div></v:textbox>",
    '<x:ClientData ObjectType="Checkbox">',
    '<x:SizeWithCells/>',
    `<x:Anchor>${zeroBasedColumn}, 8, ${zeroBasedRow}, 2, ${zeroBasedColumn + 1}, 8, ${zeroBasedRow + 1}, 2</x:Anchor>`,
    '<x:AutoFill>False</x:AutoFill>',
    '<x:AutoLine>False</x:AutoLine>',
    '<x:TextVAlign>Center</x:TextVAlign>',
    checkedXml,
    `<x:FmlaLink>$${columnIndexToLetter(target.columnIndex)}$${target.rowNumber}</x:FmlaLink>`,
    '<x:NoThreeD/>',
    '</x:ClientData>',
    '</v:shape>'
  ].join('');
}

function buildCheckboxControlProperty(target: ExcelCheckboxTarget) {
  const checkedAttribute = target.checked ? ' checked="Checked"' : '';
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    `<formControlPr xmlns="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main" objectType="CheckBox"${checkedAttribute} fmlaLink="$${columnIndexToLetter(target.columnIndex)}$${target.rowNumber}" lockText="1" noThreeD="1"/>`
  ].join('');
}

function ensureVmlContentType(contentTypesXml: string) {
  if (contentTypesXml.includes('Extension="vml"')) {
    return contentTypesXml;
  }

  return contentTypesXml.replace(
    /<Default Extension="xml" ContentType="application\/xml"\/>/,
    '<Default Extension="xml" ContentType="application/xml"/><Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/>'
  );
}

function nextVmlDrawingName(zip: JSZip) {
  const max = Math.max(
    0,
    ...Object.keys(zip.files)
      .map((fileName) => fileName.match(/^xl\/drawings\/vmlDrawing(\d+)\.vml$/)?.[1])
      .filter((value): value is string => Boolean(value))
      .map(Number)
  );

  return `vmlDrawing${max + 1}`;
}

function nextControlPropertyNumber(zip: JSZip) {
  return Math.max(
    0,
    ...Object.keys(zip.files)
      .map((fileName) => fileName.match(/^xl\/ctrlProps\/ctrlProp(\d+)\.xml$/)?.[1])
      .filter((value): value is string => Boolean(value))
      .map(Number)
  ) + 1;
}

function colLetterToIndex(letter: string): number {
  return letter.toUpperCase().split('').reduce((index, char) => (index * 26) + char.charCodeAt(0) - 64, 0);
}

function columnIndexToLetter(index: number) {
  let value = '';
  let cursor = index;

  while (cursor > 0) {
    const modulo = (cursor - 1) % 26;
    value = String.fromCharCode(65 + modulo) + value;
    cursor = Math.floor((cursor - modulo) / 26);
  }

  return value;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeXmlAttribute(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
