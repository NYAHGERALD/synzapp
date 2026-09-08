import React from 'react';
import { Megaphone } from 'lucide-react';
import {
  listConsoleAnnouncementRecipients,
  listConsoleAnnouncements,
  type ConsoleAnnouncement,
  type ConsoleAnnouncementRecipient
} from './complianceApi';
import {
  buildAcknowledgementCsv,
  buildAcknowledgementFileName
} from './announcementExport';

/**
 * Announcements, for the person who has to answer for them.
 *
 * The phone is where announcements are sent and confirmed. This is where
 * somebody proves it happened: the counts, the names, and a file to hand to an
 * auditor.
 */
export function AnnouncementConsole() {
  const [announcements, setAnnouncements] = React.useState<ConsoleAnnouncement[]>([]);
  const [selected, setSelected] = React.useState<ConsoleAnnouncement | null>(null);
  const [recipients, setRecipients] = React.useState<ConsoleAnnouncementRecipient[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isLoadingRecipients, setIsLoadingRecipients] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    void (async () => {
      try {
        const result = await listConsoleAnnouncements();

        setAnnouncements(result.announcements || []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Announcements could not be loaded.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const openAnnouncement = React.useCallback(async (announcement: ConsoleAnnouncement) => {
    setSelected(announcement);
    setRecipients([]);
    setCursor(null);
    setIsLoadingRecipients(true);

    try {
      const page = await listConsoleAnnouncementRecipients({
        announcementId: announcement.announcementId
      });

      setRecipients(page.recipients);
      setCursor(page.nextCursor);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'That list could not be loaded.');
    } finally {
      setIsLoadingRecipients(false);
    }
  }, []);

  const loadMore = React.useCallback(async () => {
    if (!selected || !cursor) {
      return;
    }

    setIsLoadingRecipients(true);

    try {
      const page = await listConsoleAnnouncementRecipients({
        announcementId: selected.announcementId,
        startAfterUid: cursor
      });

      setRecipients((current) => [...current, ...page.recipients]);
      setCursor(page.nextCursor);
    } finally {
      setIsLoadingRecipients(false);
    }
  }, [cursor, selected]);

  /**
   * Downloads every recipient, not the page on screen.
   *
   * An export of the fifty names somebody happened to have scrolled to is not
   * a record. This walks the pages until they run out.
   */
  const exportRecord = React.useCallback(async () => {
    if (!selected) {
      return;
    }

    setIsLoadingRecipients(true);

    try {
      const everybody: ConsoleAnnouncementRecipient[] = [];
      let nextCursor: string | null = null;

      do {
        const page: {
          nextCursor: string | null;
          recipients: ConsoleAnnouncementRecipient[];
        } = await listConsoleAnnouncementRecipients({
          announcementId: selected.announcementId,
          startAfterUid: nextCursor || undefined
        });

        everybody.push(...page.recipients);
        nextCursor = page.nextCursor;
      } while (nextCursor);

      const blob = new Blob([buildAcknowledgementCsv(selected, everybody)], {
        type: 'text/csv;charset=utf-8'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.download = buildAcknowledgementFileName(selected);
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'That export failed.');
    } finally {
      setIsLoadingRecipients(false);
    }
  }, [selected]);

  return (
    <div className="announcement-console">
      <div className="page-inner">
        <header className="page-hero">
          <div className="page-hero-text">
            <span className="page-eyebrow">Records</span>
            <h1>Announcements</h1>
            <p className="page-hero-lead">
              What was sent, who was told, and who confirmed it. Every list here can be exported
              for an auditor.
            </p>
          </div>
        </header>

        {error ? <p className="contact-error">{error}</p> : null}

        {isLoading ? (
          <p className="page-section-note">Loading…</p>
        ) : (
          <div className="announcement-split">
            <section className="page-section" aria-label="Announcements">
              {announcements.length ? (
                <ul className="announcement-list">
                  {announcements.map((announcement) => (
                    <li key={announcement.announcementId}>
                      <button
                        className={
                          selected?.announcementId === announcement.announcementId
                            ? 'announcement-item is-selected'
                            : 'announcement-item'
                        }
                        onClick={() => void openAnnouncement(announcement)}
                        type="button"
                      >
                        <span className="announcement-subject">{announcement.subject}</span>
                        <span className="announcement-meta">
                          {announcement.audienceSummary} ·{' '}
                          {new Date(announcement.createdAtMs).toLocaleDateString()}
                        </span>
                        <span className="announcement-counts">
                          {announcement.requiresAcknowledgement
                            ? `${announcement.acknowledgedCount} of ${announcement.expectedRecipientCount} confirmed`
                            : `Sent to ${announcement.expectedRecipientCount}`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="announcement-empty">
                  <Megaphone aria-hidden="true" size={20} />
                  <p>No announcements yet. Ones sent from the app appear here.</p>
                </div>
              )}
            </section>

            <section className="page-section" aria-label="Who confirmed">
              {selected ? (
                <>
                  <div className="page-section-head">
                    <h2>{selected.subject}</h2>
                    <button className="button-primary" onClick={() => void exportRecord()} type="button">
                      Export for an auditor
                    </button>
                  </div>

                  <dl className="fact-rows">
                    <div className="fact-row">
                      <dt>Sent by</dt>
                      <dd>{selected.createdByName}</dd>
                    </div>
                    <div className="fact-row">
                      <dt>Sent at</dt>
                      <dd>{new Date(selected.createdAtMs).toLocaleString()}</dd>
                    </div>
                    <div className="fact-row">
                      <dt>Sent to</dt>
                      <dd>{selected.audienceSummary}</dd>
                    </div>
                    <div className="fact-row">
                      <dt>Confirmed</dt>
                      <dd>
                        {selected.acknowledgedCount} of {selected.expectedRecipientCount}
                      </dd>
                    </div>
                  </dl>

                  <p className="announcement-body">
                    {selected.bodyRemovedAtMs
                      ? 'The message was removed under a retention rule. The confirmations below are kept.'
                      : selected.body}
                  </p>

                  <table className="policy-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Status</th>
                        <th>Confirmed at</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipients.map((recipient) => (
                        <tr key={recipient.uid}>
                          <td>{recipient.displayName}</td>
                          <td>
                            {recipient.acknowledgedAtMs
                              ? 'Confirmed'
                              : recipient.readAtMs
                                ? 'Opened, not confirmed'
                                : 'Not opened'}
                          </td>
                          <td>
                            {recipient.acknowledgedAtMs
                              ? new Date(recipient.acknowledgedAtMs).toLocaleString()
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {cursor ? (
                    <button
                      className="button-secondary"
                      disabled={isLoadingRecipients}
                      onClick={() => void loadMore()}
                      type="button"
                    >
                      {isLoadingRecipients ? 'Loading…' : 'Show more'}
                    </button>
                  ) : null}
                </>
              ) : (
                <p className="page-section-note">Choose an announcement to see who confirmed it.</p>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
