import React from 'react';
import {
  getLswContext,
  type LswContext
} from './lswApi';

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri';

interface DailyTask {
  days: Record<DayKey, boolean>;
  minutes: number;
  task: string;
  time: string;
}

interface ProjectUpdate {
  text: string;
}

interface ProjectRow {
  name: string;
  updates: ProjectUpdate[];
}

interface FollowUpRow {
  comments: string;
  dueDate: string;
  responsible: string;
  task: string;
}

interface TriggerRow {
  comments: string;
  eventDate: string;
  trigger: string;
}

interface FrequencyTask {
  dueDate: string;
  frequency: 'Bi-Weekly' | 'Monthly' | 'Quarterly' | 'Annually';
  minutes: number;
  task: string;
}

interface TodoItem {
  completed: boolean;
  dueTime: string;
  pastDue?: boolean;
  task: string;
}

interface RailItem {
  completed: boolean;
  dueDate: string;
  rail: string;
}

interface GoalItem {
  dueDate: string;
  objective: string;
  progress: number;
}

const visibleDays: Array<{ key: DayKey; label: string }> = [
  { key: 'mon', label: 'M' },
  { key: 'tue', label: 'T' },
  { key: 'wed', label: 'W' },
  { key: 'thu', label: 'T' },
  { key: 'fri', label: 'F' }
];

const dailyTasks: DailyTask[] = [
  {
    days: { fri: false, mon: true, thu: true, tue: true, wed: true },
    minutes: 15,
    task: 'Review line readiness, staffing, and handoff notes',
    time: '07:30'
  },
  {
    days: { fri: false, mon: true, thu: true, tue: true, wed: true },
    minutes: 30,
    task: 'Gemba walk: safety, quality, people, delivery, and cost checks',
    time: '08:15'
  },
  {
    days: { fri: false, mon: true, thu: false, tue: true, wed: true },
    minutes: 20,
    task: 'Daily production review with supervisors',
    time: '09:00'
  },
  {
    days: { fri: false, mon: false, thu: true, tue: false, wed: true },
    minutes: 10,
    task: 'Verify open corrective actions and overdue follow-ups',
    time: '13:30'
  }
];

const projects: ProjectRow[] = [
  {
    name: 'Reduce unplanned downtime on Line 2',
    updates: [
      { text: 'Maintenance checklist moved to pre-shift review.' },
      { text: 'Operator training refresh scheduled for Wednesday.' }
    ]
  },
  {
    name: 'Improve sanitation handoff accuracy',
    updates: [
      { text: 'QA verified revised sign-off fields with department leads.' }
    ]
  }
];

const followUps: FollowUpRow[] = [
  {
    comments: 'Waiting on vendor confirmation.',
    dueDate: 'Jun 25',
    responsible: 'Maintenance',
    task: 'Confirm replacement parts for sealer guard'
  },
  {
    comments: 'Use new standard work template.',
    dueDate: 'Jun 27',
    responsible: 'Production',
    task: 'Publish Friday line startup checklist'
  }
];

const triggers: TriggerRow[] = [
  {
    comments: 'Escalate if repeat issue occurs this week.',
    eventDate: 'Jun 24',
    trigger: 'Foreign material hold over 30 minutes'
  },
  {
    comments: 'Review sanitation verification data.',
    eventDate: 'Jun 26',
    trigger: 'Customer complaint or repeat quality defect'
  }
];

const frequencyTasks: FrequencyTask[] = [
  { dueDate: 'Jun 28', frequency: 'Bi-Weekly', minutes: 30, task: 'Review training matrix gaps' },
  { dueDate: 'Jun 30', frequency: 'Monthly', minutes: 45, task: 'Department performance review' },
  { dueDate: 'Jul 05', frequency: 'Quarterly', minutes: 60, task: 'Audit standard work adherence' },
  { dueDate: 'Aug 01', frequency: 'Annually', minutes: 90, task: 'Refresh LSW expectations with leadership team' }
];

const todos: TodoItem[] = [
  { completed: false, dueTime: '9:30 AM', pastDue: true, task: 'Close out yesterday production hold note' },
  { completed: true, dueTime: '10:00 AM', task: 'Send bakery staffing update' },
  { completed: false, dueTime: '1:00 PM', task: 'Validate sanitation follow-up photos' }
];

const rails: RailItem[] = [
  { completed: true, dueDate: 'Today', rail: 'L1 Daily direction setting' },
  { completed: false, dueDate: 'Jun 25', rail: 'L2 department health review' },
  { completed: false, dueDate: 'Jun 27', rail: 'L3 monthly business review prep' }
];

const keyResultGroups = [
  {
    metrics: [
      { label: 'Safety observations', value: '12 / 15' },
      { label: 'Quality holds', value: '1 open' }
    ],
    name: 'People, Safety, Quality'
  },
  {
    metrics: [
      { label: 'Schedule attainment', value: '94%' },
      { label: 'Waste variance', value: '-2.4%' }
    ],
    name: 'Delivery, Cost'
  }
];

const goals: GoalItem[] = [
  { dueDate: 'Jun 28', objective: 'Coach two new supervisors on daily accountability routines', progress: 65 },
  { dueDate: 'Jul 03', objective: 'Complete handoff playbook for weekend coverage', progress: 40 }
];

export function LswPrototype() {
  const [lswContext, setLswContext] = React.useState<LswContext | null>(null);
  const [isLoadingContext, setIsLoadingContext] = React.useState(false);
  const [contextError, setContextError] = React.useState('');
  const [workDaysPerWeek, setWorkDaysPerWeek] = React.useState(5);
  const requestIdRef = React.useRef(0);

  React.useEffect(() => {
    void loadContext();
  }, []);

  async function loadContext(options: { week?: number; year?: number } = {}) {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setIsLoadingContext(true);
    setContextError('');

    try {
      const nextContext = await getLswContext(options);

      if (requestIdRef.current === requestId) {
        setLswContext(nextContext);
      }
    } catch (error) {
      if (requestIdRef.current === requestId) {
        setContextError(getErrorMessage(error));
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoadingContext(false);
      }
    }
  }

  function handleWeekOffset(offset: number) {
    if (!lswContext || isLoadingContext) {
      return;
    }

    void loadContext({
      week: lswContext.week.selectedWeek + offset,
      year: lswContext.week.selectedYear
    });
  }

  function handleCurrentWeek() {
    if (isLoadingContext) {
      return;
    }

    void loadContext();
  }

  const hasBlockingContextError = Boolean(contextError && !lswContext);
  const departmentId = lswContext?.department.departmentId || 'unassigned';
  const departmentName = lswContext?.department.name || (hasBlockingContextError ? 'Unavailable' : 'Loading department');
  const selectedWeek = lswContext?.week.selectedWeek;
  const weekNumberLabel = selectedWeek
    ? `Week ${selectedWeek}`
    : hasBlockingContextError
      ? 'Week unavailable'
      : 'Week --';
  const pendingDateLabel = hasBlockingContextError ? 'Unavailable' : 'Loading';

  return (
    <div className="lsw-prototype" aria-busy={isLoadingContext} aria-label="Leaders Standard Work board preview">
      <header className="lsw-toolbar">
        <div className="lsw-toolbar-inner">
          <div className="lsw-toolbar-left">
            <label className="lsw-select-group">
              <span>Department:</span>
              <select aria-label="Department" disabled value={departmentId}>
                <option value={departmentId}>{departmentName}</option>
              </select>
            </label>

            <div className="lsw-today-card" aria-label="Today">
              <span aria-hidden="true">📅</span>
              <div>
                <small>Today is:</small>
                <strong>{lswContext?.week.todayLabel || 'Loading...'}</strong>
              </div>
            </div>

            <button className="lsw-icon-button lsw-print-button" type="button" title="Print Report" aria-label="Print Report">
              <PrinterIcon />
            </button>

            <button className="lsw-log-button" type="button">
              <ZapIcon />
              <span>Early Completion Log</span>
              <strong>3</strong>
            </button>

            <button className="lsw-icon-button lsw-bell-button" type="button" title="Task notifications" aria-label="Task notifications">
              <BellIcon />
              <span>2</span>
            </button>
          </div>

          <div className="lsw-week-controls">
            <div className="lsw-week-stepper" aria-label="Week selector">
              <button
                aria-label="Previous week"
                disabled={!lswContext || isLoadingContext}
                onClick={() => handleWeekOffset(-1)}
                type="button"
              >
                <ChevronLeftIcon />
              </button>
              <button className="lsw-week-number" disabled={!lswContext || isLoadingContext} type="button">
                {weekNumberLabel}
              </button>
              <button
                aria-label="Next week"
                disabled={!lswContext || isLoadingContext}
                onClick={() => handleWeekOffset(1)}
                type="button"
              >
                <ChevronRightIcon />
              </button>
            </div>

            <DateRangeLabel label="Week Beginning" value={lswContext?.week.weekBeginningLabel || pendingDateLabel} />
            <span className="lsw-range-dash">-</span>
            <DateRangeLabel label="Week Ending" value={lswContext?.week.weekEndingLabel || pendingDateLabel} />
            {hasBlockingContextError ? (
              <button className="lsw-current-badge" disabled={isLoadingContext} onClick={() => void loadContext()} type="button">
                Retry
              </button>
            ) : lswContext?.week.isCurrentWeek ? (
              <span className="lsw-current-badge">Current week</span>
            ) : (
              <button className="lsw-current-badge" disabled={isLoadingContext} onClick={handleCurrentWeek} type="button">
                Current week
              </button>
            )}
            {isLoadingContext && lswContext ? <span className="lsw-syncing-label">Syncing...</span> : null}
            {hasBlockingContextError ? <span className="lsw-syncing-label is-error">Context not loaded</span> : null}
          </div>
        </div>
      </header>

      <main className="lsw-main">
        {contextError ? (
          <div className="lsw-context-alert" role="alert">
            <div>
              <strong>LSW workspace needs attention</strong>
              <span>{contextError}</span>
            </div>
            <button onClick={() => void loadContext()} type="button">Retry</button>
          </div>
        ) : null}

        {lswContext ? <WeekPreview context={lswContext} /> : <WeekPreviewSkeleton />}

        <div className="lsw-board-grid">
          <div className="lsw-left-column">
            <SectionPanel
              accent="emerald"
              action={
                <label className="lsw-workdays">
                  <span>Days/week:</span>
                  <select
                    aria-label="Work days per week"
                    onChange={(event) => setWorkDaysPerWeek(Number(event.target.value))}
                    value={workDaysPerWeek}
                  >
                    <option value={5}>5 (Mon-Fri)</option>
                    <option value={6}>6 (Mon-Sat)</option>
                    <option value={7}>7 (All days)</option>
                  </select>
                </label>
              }
              icon="📅"
              title="Daily & Weekly Standard Tasks/Meetings"
            >
              <DailyTasksTable />
              <PanelFooter label="Add Task" tone="emerald" />
            </SectionPanel>

            <BlackDivider />

            <SectionPanel accent="blue" icon="🚀" title="Improvement Projects and Updates">
              <ProjectsTable />
              <PanelFooter label="Add Project" tone="blue" />
            </SectionPanel>

            <BlackDivider />

            <SectionPanel accent="amber" action={<PastDueToggle count={1} />} icon="📌" title="Follow Ups">
              <FollowUpsTable />
              <PanelFooter label="Add Follow Up" tone="amber" />
            </SectionPanel>

            <BlackDivider />

            <SectionPanel accent="red" action={<PastDueToggle count={1} />} icon="⚠️" title="Plant Specific Cause RCA Triggers">
              <TriggersTable />
              <PanelFooter label="Add Trigger" tone="red" />
            </SectionPanel>

            <BlackDivider />

            <SectionPanel accent="violet" action={<PastDueToggle count={2} />} icon="📆" title="Scheduled Tasks/Meetings">
              <FrequencyTasks />
            </SectionPanel>
          </div>

          <aside className="lsw-right-column">
            <SectionPanel
              accent="cyan"
              action={
                <div className="lsw-clock">
                  <span>Wednesday, 24</span>
                  <strong>8:42:19 AM</strong>
                </div>
              }
              icon="✅"
              title="To Do Today & This Week"
            >
              <TodoList />
              <PanelFooter label="Add Item" tone="blue" />
            </SectionPanel>

            <BlackDivider />

            <SectionPanel accent="purple" action={<PastDueToggle count={1} />} icon="🚂" title="Level 1, 2 & 3 Meeting Rails">
              <RailsList />
              <PanelFooter label="Add Meeting Rail" tone="purple" />
            </SectionPanel>

            <BlackDivider />

            <SectionPanel accent="teal" icon="📊" title="Key Results Metrics">
              <KeyResults />
            </SectionPanel>

            <BlackDivider />

            <SectionPanel accent="pink" action={<PastDueToggle count={1} />} icon="🎯" title="Personal Objectives/Goals">
              <GoalsList />
              <PanelFooter label="Add Objective" tone="pink" />
            </SectionPanel>
          </aside>
        </div>
      </main>
    </div>
  );
}

function SectionPanel({
  accent,
  action,
  children,
  icon,
  title
}: {
  accent: 'amber' | 'blue' | 'cyan' | 'emerald' | 'pink' | 'purple' | 'red' | 'teal' | 'violet';
  action?: React.ReactNode;
  children: React.ReactNode;
  icon: string;
  title: string;
}) {
  return (
    <section className="lsw-panel">
      <div className={`lsw-panel-header lsw-panel-header-${accent}`}>
        <h2>
          <span aria-hidden="true">{icon}</span>
          {title}
        </h2>
        {action ? <div className="lsw-panel-action">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function DateRangeLabel({ label, value }: { label: string; value: string }) {
  return (
    <div className="lsw-date-label">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function WeekPreview({ context }: { context: LswContext }) {
  return (
    <section className="lsw-week-preview" aria-label="Company calendar week preview">
      <header>
        <div>
          <h2>
            <span aria-hidden="true">👁️</span>
            Week Preview
          </h2>
          <p>Weeks are calculated from the company calendar year start date.</p>
        </div>
        <span>{context.storageScope.weekKey}</span>
      </header>

      <div className="lsw-week-preview-metrics">
        <div className="lsw-week-preview-card is-year-start">
          <span>Year start date</span>
          <strong>{context.calendar.startDateLabel}</strong>
        </div>
        <div className="lsw-week-preview-card is-current-week">
          <span>Current week</span>
          <strong>Week {context.week.currentWeek}</strong>
        </div>
        <div className="lsw-week-preview-card is-total-weeks">
          <span>Total weeks / year</span>
          <strong>{context.week.totalWeeksInYear}</strong>
        </div>
      </div>

      <div className="lsw-week-preview-table-shell">
        <table className="lsw-week-preview-table">
          <thead>
            <tr>
              <th>Week</th>
              <th>Start date</th>
              <th>End date</th>
            </tr>
          </thead>
          <tbody>
            {context.week.previewRows.map((row) => (
              <tr key={row.week}>
                <td>Week {row.week}</td>
                <td>{row.startDateLabel}</td>
                <td>{row.endDateLabel}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={3}>... and so on through the year</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function WeekPreviewSkeleton() {
  return (
    <section className="lsw-week-preview is-loading" aria-label="Loading company calendar week preview">
      <header>
        <div>
          <h2>
            <span aria-hidden="true">👁️</span>
            Week Preview
          </h2>
          <p>Loading company calendar settings...</p>
        </div>
      </header>

      <div className="lsw-week-preview-metrics">
        <div className="lsw-week-preview-card" />
        <div className="lsw-week-preview-card" />
        <div className="lsw-week-preview-card" />
      </div>
    </section>
  );
}

function DailyTasksTable() {
  return (
    <div className="lsw-table-scroll">
      <table className="lsw-table lsw-daily-table">
        <thead>
          <tr>
            <th className="lsw-drag-column" />
            <th>Min</th>
            <th>Task/Meeting</th>
            <th className="lsw-center">Time</th>
            {visibleDays.map((day) => (
              <th className={day.key === 'wed' ? 'lsw-day-today' : ''} key={day.key}>{day.label}</th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {dailyTasks.map((task) => (
            <tr key={task.task}>
              <td className="lsw-drag-column"><DragHandle /></td>
              <td>{task.minutes}</td>
              <td className="lsw-task-cell">{task.task}</td>
              <td className="lsw-center">{task.time}</td>
              {visibleDays.map((day) => (
                <td className="lsw-check-cell" key={day.key}>
                  <input checked={task.days[day.key]} readOnly type="checkbox" />
                </td>
              ))}
              <td className="lsw-delete-cell"><XIcon /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProjectsTable() {
  return (
    <div className="lsw-table-scroll">
      <table className="lsw-table lsw-project-table">
        <thead>
          <tr>
            <th className="lsw-action-column" />
            <th className="lsw-number-column">#</th>
            <th>Project</th>
            <th>Update</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project, index) => (
            <tr key={project.name}>
              <td className="lsw-row-actions"><XIcon /><StyleIcon /></td>
              <td><span className="lsw-number-pill">{index + 1}</span></td>
              <td className="lsw-project-name">{project.name}</td>
              <td className="lsw-update-list">
                {project.updates.map((update) => (
                  <div key={update.text}>{update.text}</div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FollowUpsTable() {
  return (
    <div className="lsw-table-scroll">
      <table className="lsw-table">
        <thead>
          <tr>
            <th className="lsw-action-column" />
            <th>Follow Up</th>
            <th>Due Date</th>
            <th>Responsible</th>
            <th>Comments/Notes</th>
          </tr>
        </thead>
        <tbody>
          {followUps.map((followUp) => (
            <tr key={followUp.task}>
              <td className="lsw-row-actions"><XIcon /></td>
              <td className="lsw-task-cell">{followUp.task}</td>
              <td><DateBadge value={followUp.dueDate} /></td>
              <td>{followUp.responsible}</td>
              <td>{followUp.comments}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TriggersTable() {
  return (
    <div className="lsw-table-scroll">
      <table className="lsw-table">
        <thead>
          <tr>
            <th className="lsw-action-column" />
            <th>RCA Event Trigger</th>
            <th>Event Date</th>
            <th>Comments/Notes</th>
          </tr>
        </thead>
        <tbody>
          {triggers.map((trigger) => (
            <tr key={trigger.trigger}>
              <td className="lsw-row-actions"><XIcon /><PlusMiniIcon /></td>
              <td className="lsw-task-cell">{trigger.trigger}</td>
              <td><DateBadge value={trigger.eventDate} /></td>
              <td>{trigger.comments}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FrequencyTasks() {
  return (
    <div className="lsw-frequency-list">
      {(['Bi-Weekly', 'Monthly', 'Quarterly', 'Annually'] as const).map((frequency) => {
        const tasks = frequencyTasks.filter((task) => task.frequency === frequency);

        return (
          <div className="lsw-frequency-group" key={frequency}>
            <div className="lsw-frequency-title">
              <h3>{frequency} (Standard Tasks/Meetings)</h3>
              <PlusMiniIcon />
            </div>
            <table className="lsw-table lsw-frequency-table">
              <thead>
                <tr>
                  <th>Min</th>
                  <th>Task/Meeting</th>
                  <th>Due Date</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.task}>
                    <td>{task.minutes}</td>
                    <td className="lsw-task-cell">{task.task}</td>
                    <td><DateBadge value={task.dueDate} /></td>
                    <td className="lsw-row-actions"><PlusMiniIcon /><XIcon /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function TodoList() {
  return (
    <div className="lsw-list lsw-todo-list">
      {todos.map((item) => (
        <div className={`lsw-todo-item ${item.completed ? 'is-complete' : ''} ${item.pastDue ? 'is-past-due' : ''}`} key={item.task}>
          <DragHandle />
          <span className={`lsw-round-check ${item.completed ? 'is-checked' : ''}`}>{item.completed ? <CheckIcon /> : null}</span>
          <div className="lsw-todo-copy">
            <span>{item.task}</span>
            {item.completed ? <strong>✓ Great, Item is Completed!</strong> : null}
          </div>
          {item.pastDue ? <em>⚠️ Past Due</em> : null}
          <time>{item.dueTime}</time>
          <XIcon />
        </div>
      ))}
    </div>
  );
}

function RailsList() {
  return (
    <div className="lsw-list">
      {rails.map((rail) => (
        <div className="lsw-rail-item" key={rail.rail}>
          <span className={`lsw-square-check ${rail.completed ? 'is-checked purple' : ''}`}>{rail.completed ? <CheckIcon /> : null}</span>
          <p className={rail.completed ? 'is-struck' : ''}>{rail.rail}</p>
          <DateBadge value={rail.dueDate} />
          <PlusMiniIcon />
          <XIcon />
        </div>
      ))}
    </div>
  );
}

function KeyResults() {
  return (
    <div className="lsw-key-results">
      {keyResultGroups.map((group) => (
        <div className="lsw-key-result-group" key={group.name}>
          <h3>{group.name}</h3>
          {group.metrics.map((metric) => (
            <div className="lsw-metric-row" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function GoalsList() {
  return (
    <div className="lsw-list">
      {goals.map((goal) => (
        <div className="lsw-goal-item" key={goal.objective}>
          <div className="lsw-goal-topline">
            <p>{goal.objective}</p>
            <DateBadge value={goal.dueDate} />
          </div>
          <div className="lsw-progress-row">
            <div className="lsw-progress-track">
              <span style={{ width: `${goal.progress}%` }} />
            </div>
            <strong>{goal.progress}%</strong>
          </div>
        </div>
      ))}
    </div>
  );
}

function DateBadge({ value }: { value: string }) {
  return <span className="lsw-date-badge">{value}</span>;
}

function PastDueToggle({ count }: { count: number }) {
  return (
    <button className="lsw-past-due-toggle" type="button">
      <span>Show past due</span>
      <strong>{count}</strong>
    </button>
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'The LSW workspace could not be loaded.';
}

function PanelFooter({ label, tone }: { label: string; tone: string }) {
  return (
    <div className="lsw-panel-footer">
      <button className={`lsw-add-row lsw-add-row-${tone}`} type="button">
        <PlusMiniIcon />
        {label}
      </button>
    </div>
  );
}

function BlackDivider() {
  return <hr className="lsw-black-divider" />;
}

function DragHandle() {
  return (
    <svg aria-hidden="true" className="lsw-drag-handle" fill="currentColor" viewBox="0 0 24 24">
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

function PrinterIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2m2 4h6a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2Zm8-12V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v4h10Z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-4-5.7V5a2 2 0 1 0-4 0v.3A6 6 0 0 0 6 11v3.2c0 .5-.2 1-.6 1.4L4 17h11Zm0 0v1a3 3 0 1 1-6 0v-1" />
    </svg>
  );
}

function ZapIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7Z" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m15 19-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 5 7 7-7 7" />
    </svg>
  );
}

function PlusMiniIcon() {
  return (
    <svg aria-hidden="true" className="lsw-mini-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg aria-hidden="true" className="lsw-mini-icon lsw-x-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="m5 13 4 4L19 7" />
    </svg>
  );
}

function StyleIcon() {
  return (
    <svg aria-hidden="true" className="lsw-mini-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 0 1-4-4V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v12a4 4 0 0 1-4 4Zm0 0h12a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-2.3M11 7.3l1.7-1.6a2 2 0 0 1 2.8 0l2.8 2.8a2 2 0 0 1 0 2.8l-8.5 8.5M7 17h.01" />
    </svg>
  );
}
