import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { listConsoleAuditEvents, type ConsoleAuditEvent } from './complianceApi';
import { buildAuditCsv, buildAuditFileName } from './auditExport';

/**
 * The audit log, for the person who has to answer for it.
 *
 * Read only, by design. There is no control here that deletes, edits or clears
 * an event, and there must never be: an audit log an administrator can erase is
 * a diary. Events age out by retention policy and by nothing else.
 *
 * It lives on the web rather than the phone because it is wide tabular data
 * read at a desk — filters, a date range, and a file to hand to an auditor.
 * The phone keeps the operational Actions list, used on a floor. See section
 * 5.2 of SYNZAPP_ACTIONS_GOVERNANCE_PLAN.md.
 */

/** The events worth singling out. Anything else is still shown under "All". */
const ACTION_FILTERS: { actions: string[]; label: string }[] = [
  { actions: [], label: 'All' },
  { actions: ['ACTION_CANCELLED'], label: 'Cancellations' },
  {
    actions: ['ACTION_CREATED', 'ACTION_STATUS_CHANGED', 'ACTION_VERIFIED', 'ACTION_CANCELLED'],
    label: 'Actions'
  },
  {
    actions: ['CHAT_BACKUP_RESTORE_APPROVED', 'CHAT_BACKUP_RESTORE_DENIED', 'CHAT_BACKUP_POLICY_UPDATED'],
    label: 'Backups'
  },
  {
    // Every point in the life of a scheduled message, in one filter. The one
    // that matters is the cancellation: an administrator stopping somebody
    // else's message is the most answerable-for thing on this list, and its
    // metadata carries the reason they gave.
    actions: [
      'CHAT_MESSAGE_SCHEDULED',
      'CHAT_MESSAGE_SCHEDULE_RELEASED',
      'CHAT_MESSAGE_SCHEDULE_CANCELLED',
      'CHAT_MESSAGE_SCHEDULE_FAILED',
      'SCHEDULED_MESSAGE_POLICY_UPDATED'
    ],
    label: 'Scheduled messages'
  }
];

export function AuditConsole() {
  const [events, setEvents] = React.useState<ConsoleAuditEvent[]>([]);
  const [filterIndex, setFilterIndex] = React.useState(0);
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fromMs = fromDate ? new Date(`${fromDate}T00:00:00Z`).getTime() : null;
  const toMs = toDate ? new Date(`${toDate}T23:59:59Z`).getTime() : null;

  const load = React.useCallback(async (startAfterId: string | null = null) => {
    setIsLoading(true);

    try {
      const page = await listConsoleAuditEvents({
        actions: ACTION_FILTERS[filterIndex].actions,
        fromMs,
        startAfterId,
        toMs
      });

      setEvents((current) => (startAfterId ? [...current, ...page.events] : page.events));
      setCursor(page.nextCursor);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'The audit log could not be read.');
    } finally {
      setIsLoading(false);
    }
  }, [filterIndex, fromMs, toMs]);

  React.useEffect(() => {
    void load();
  }, [load]);

  /**
   * Exports every matching event, not the page on screen.
   *
   * A file holding the hundred rows somebody happened to have scrolled to is
   * not a record. This walks the pages until they run out.
   */
  const exportCsv = React.useCallback(async () => {
    setIsLoading(true);

    try {
      const everything: ConsoleAuditEvent[] = [];
      let nextCursor: string | null = null;

      do {
        const page: { events: ConsoleAuditEvent[]; nextCursor: string | null } =
          await listConsoleAuditEvents({
            actions: ACTION_FILTERS[filterIndex].actions,
            fromMs,
            startAfterId: nextCursor,
            toMs
          });

        everything.push(...page.events);
        nextCursor = page.nextCursor;
      } while (nextCursor);

      const blob = new Blob([buildAuditCsv(everything)], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.download = buildAuditFileName(fromMs, toMs);
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'That export failed.');
    } finally {
      setIsLoading(false);
    }
  }, [filterIndex, fromMs, toMs]);

  return (
    <div className="audit-console">
      <div className="page-inner">
        <header className="page-hero">
          <div className="page-hero-text">
            <span className="page-eyebrow">Records</span>
            <h1>Audit log</h1>
            <p className="page-hero-lead">
              Who did what, and when. Nothing here can be edited or removed — events age out
              under your organization&rsquo;s retention policy and in no other way.
            </p>
          </div>
        </header>

        <section className="page-section" aria-label="Filters">
          <div className="page-section-head">
            <div className="filters">
              {ACTION_FILTERS.map((filter, index) => (
                <button
                  className={index === filterIndex ? 'chip is-selected' : 'chip'}
                  key={filter.label}
                  onClick={() => setFilterIndex(index)}
                  type="button"
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <button
              className="button-primary"
              disabled={isLoading}
              onClick={() => void exportCsv()}
              type="button"
            >
              Export for an auditor
            </button>
          </div>

          <div className="filters">
            <label>
              From <input onChange={(event) => setFromDate(event.target.value)} type="date" value={fromDate} />
            </label>
            <label>
              To <input onChange={(event) => setToDate(event.target.value)} type="date" value={toDate} />
            </label>
          </div>
        </section>

        {error ? <p className="contact-error">{error}</p> : null}

        <section className="page-section" aria-label="Events">
          {!isLoading && events.length === 0 ? (
            <div className="announcement-empty">
              <ShieldCheck aria-hidden="true" size={20} />
              <p>No events match these filters.</p>
            </div>
          ) : (
            <table className="policy-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Event</th>
                  <th>Outcome</th>
                  <th>Actor</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.eventId}>
                    <td>{event.createdAtMs ? new Date(event.createdAtMs).toLocaleString() : '—'}</td>
                    <td>{event.action}</td>
                    <td>{event.status}</td>
                    {/*
                      * A name, falling back to the identifier.
                      *
                      * This showed the raw uid, so the console read as a list of
                      * 28-character strings and nobody could tell who had done
                      * anything without looking each one up by hand.
                      */}
                    <td title={event.actorUid || undefined}>
                      {event.actorName || event.actorUid || '—'}
                    </td>
                    <td>{event.reason || describeMetadata(event.metadata)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {cursor ? (
            <button
              className="button-secondary"
              disabled={isLoading}
              onClick={() => void load(cursor)}
              type="button"
            >
              {isLoading ? 'Loading…' : 'Show more'}
            </button>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function describeMetadata(metadata: Record<string, unknown>): string {
  return Object.entries(metadata)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(', ');
}
