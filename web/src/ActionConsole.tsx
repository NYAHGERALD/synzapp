import React from 'react';
import { ClipboardList } from 'lucide-react';
import {
  getConsoleAction,
  listConsoleActions,
  type ConsoleAction,
  type ConsoleActionEvent
} from './complianceApi';
import {
  buildActionCsv,
  buildActionFileName,
  buildActionRegisterCsv,
  buildActionRegisterFileName,
  describeActionStatus
} from './actionExport';

/**
 * Actions, for the person who has to answer for them.
 *
 * The phone is where actions are raised, worked and verified. This is where
 * somebody proves it happened: what was reported, who fixed it, who confirmed
 * it, and a file to hand to an auditor.
 */
export function ActionConsole() {
  const [actions, setActions] = React.useState<ConsoleAction[]>([]);
  const [selected, setSelected] = React.useState<ConsoleAction | null>(null);
  const [events, setEvents] = React.useState<ConsoleActionEvent[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    void (async () => {
      try {
        const result = await listConsoleActions();

        setActions(result.actions || []);
        setCursor(result.nextCursor);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Actions could not be loaded.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const openAction = React.useCallback(async (action: ConsoleAction) => {
    setSelected(action);
    setEvents([]);
    setIsLoadingDetail(true);

    try {
      const detail = await getConsoleAction(action.actionId);

      setSelected(detail.action);
      setEvents(detail.events);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'That action could not be loaded.');
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  const loadMore = React.useCallback(async () => {
    if (!cursor) {
      return;
    }

    setIsLoading(true);

    try {
      const page = await listConsoleActions({ startAfterId: cursor });

      setActions((current) => [...current, ...page.actions]);
      setCursor(page.nextCursor);
    } finally {
      setIsLoading(false);
    }
  }, [cursor]);

  const download = React.useCallback((contents: string, fileName: string) => {
    const blob = new Blob([contents], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.download = fileName;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  /**
   * The whole register, not the page on screen.
   *
   * An export of the thirty rows somebody happened to have scrolled to is not
   * a record. This walks the pages until they run out.
   */
  const exportRegister = React.useCallback(async () => {
    setIsLoading(true);

    try {
      const everything: ConsoleAction[] = [];
      let nextCursor: string | null = null;

      do {
        const page: { actions: ConsoleAction[]; nextCursor: string | null } =
          await listConsoleActions({ startAfterId: nextCursor || undefined });

        everything.push(...page.actions);
        nextCursor = page.nextCursor;
      } while (nextCursor);

      download(buildActionRegisterCsv(everything), buildActionRegisterFileName());
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'That export failed.');
    } finally {
      setIsLoading(false);
    }
  }, [download]);

  return (
    <div className="announcement-console">
      <div className="page-inner">
        <header className="page-hero">
          <div className="page-hero-text">
            <span className="page-eyebrow">Records</span>
            <h1>Actions</h1>
            <p className="page-hero-lead">
              What was reported, who fixed it, and who confirmed it. Every list here can be
              exported for an auditor.
            </p>
          </div>
        </header>

        {error ? <p className="contact-error">{error}</p> : null}

        {isLoading && !actions.length ? (
          <p className="page-section-note">Loading…</p>
        ) : (
          <div className="announcement-split">
            <section className="page-section" aria-label="Actions">
              <div className="page-section-head">
                <h2>All actions</h2>
                <button className="button-secondary" onClick={() => void exportRegister()} type="button">
                  Export the register
                </button>
              </div>

              {actions.length ? (
                <ul className="announcement-list">
                  {actions.map((action) => (
                    <li key={action.actionId}>
                      <button
                        className={
                          selected?.actionId === action.actionId
                            ? 'announcement-item is-selected'
                            : 'announcement-item'
                        }
                        onClick={() => void openAction(action)}
                        type="button"
                      >
                        <span className="announcement-subject">
                          {action.bodyRemovedAtMs ? 'Removed under a retention rule' : action.title}
                        </span>
                        <span className="announcement-meta">
                          {action.responsibleGroupName} ·{' '}
                          {new Date(action.createdAtMs).toLocaleDateString()}
                        </span>
                        <span className="announcement-counts">
                          {describeActionStatus(action.status)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="announcement-empty">
                  <ClipboardList aria-hidden="true" size={20} />
                  <p>No actions yet. Ones raised from a chat appear here.</p>
                </div>
              )}

              {cursor ? (
                <button
                  className="button-secondary"
                  disabled={isLoading}
                  onClick={() => void loadMore()}
                  type="button"
                >
                  {isLoading ? 'Loading…' : 'Show more'}
                </button>
              ) : null}
            </section>

            <section className="page-section" aria-label="What happened">
              {selected ? (
                <>
                  <div className="page-section-head">
                    <h2>
                      {selected.bodyRemovedAtMs
                        ? 'Removed under a retention rule'
                        : selected.title}
                    </h2>
                    <button
                      className="button-primary"
                      onClick={() => download(
                        buildActionCsv(selected, events),
                        buildActionFileName(selected)
                      )}
                      type="button"
                    >
                      Export for an auditor
                    </button>
                  </div>

                  <dl className="fact-rows">
                    <div className="fact-row">
                      <dt>Status</dt>
                      <dd>{describeActionStatus(selected.status)}</dd>
                    </div>
                    <div className="fact-row">
                      <dt>Priority</dt>
                      <dd>{selected.priority}</dd>
                    </div>
                    <div className="fact-row">
                      <dt>Responsible team</dt>
                      <dd>{selected.responsibleGroupName}</dd>
                    </div>
                    <div className="fact-row">
                      <dt>Responsible person</dt>
                      <dd>{selected.responsiblePersonName || 'Nobody named'}</dd>
                    </div>
                    <div className="fact-row">
                      <dt>Raised by</dt>
                      <dd>{selected.createdByName}</dd>
                    </div>
                    <div className="fact-row">
                      <dt>Raised in</dt>
                      <dd>{selected.sourceChatName || 'A chat'}</dd>
                    </div>
                    <div className="fact-row">
                      <dt>Raised at</dt>
                      <dd>{new Date(selected.createdAtMs).toLocaleString()}</dd>
                    </div>
                    {selected.completedByName ? (
                      <div className="fact-row">
                        <dt>Completed by</dt>
                        <dd>
                          {selected.completedByName}
                          {selected.completedAtMs
                            ? `, ${new Date(selected.completedAtMs).toLocaleString()}`
                            : ''}
                        </dd>
                      </div>
                    ) : null}
                    {selected.verifiedByName ? (
                      <div className="fact-row">
                        <dt>Verified by</dt>
                        <dd>
                          {selected.verifiedByName}
                          {selected.verifiedAtMs
                            ? `, ${new Date(selected.verifiedAtMs).toLocaleString()}`
                            : ''}
                        </dd>
                      </div>
                    ) : null}
                  </dl>

                  {selected.completionNote ? (
                    <p className="announcement-body">{selected.completionNote}</p>
                  ) : null}

                  <table className="policy-table">
                    <thead>
                      <tr>
                        <th>What happened</th>
                        <th>Who</th>
                        <th>When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((event) => (
                        <tr key={event.eventId}>
                          <td>
                            {describeEventText(event)}
                            {event.note ? <><br /><small>{event.note}</small></> : null}
                          </td>
                          <td>{event.actorName}</td>
                          <td>{new Date(event.atMs).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {isLoadingDetail ? <p className="page-section-note">Loading…</p> : null}
                </>
              ) : (
                <p className="page-section-note">Choose an action to see what happened to it.</p>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function describeEventText(event: ConsoleActionEvent): string {
  if (event.kind === 'CREATED') return 'Raised from a message';
  if (event.kind === 'VERIFIED') return 'Verified';
  if (event.toStatus === 'IN_PROGRESS') return 'Work started';
  if (event.toStatus === 'BLOCKED') return 'Waiting on something';
  if (event.toStatus === 'DONE') return 'Marked done';

  return 'Reopened';
}
