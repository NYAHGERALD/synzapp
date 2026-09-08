import React from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { SupportArtwork, SupportEmptyArtwork } from './AccountArtwork';
import {
  listSupportRequests,
  raiseSupportRequest,
  type SupportRequest
} from './complianceApi';

/**
 * Support, from inside the organization's own console.
 *
 * Raised here rather than through the public form, because everything that
 * matters is already known: who is asking, and which organization they belong
 * to. Both are taken from their session on the server, so nobody can raise a
 * request in another company's name, and nobody has to type their company into
 * a box and get it slightly wrong.
 *
 * It also shows what has already been asked. A support screen that only accepts
 * and never reports leaves an administrator wondering whether their message
 * arrived, and the usual answer is to send it again.
 *
 * Scope note: this is Synzapp's support channel. It reads no chat, interpreter
 * or compliance content.
 */

export function SupportWorkspace({
  adminName,
  organizationName
}: {
  adminName: string;
  organizationName: string;
}) {
  /**
   * Asked for, because Synzapp does not hold one.
   *
   * People sign in with a phone number, so there is no address on file to reply
   * to. Remembered in this browser so it is typed once rather than every time.
   */
  const [replyEmail, setReplyEmail] = React.useState(() => {
    try {
      return window.localStorage.getItem('synzapp.support.replyEmail') || '';
    } catch {
      return '';
    }
  });
  const [requests, setRequests] = React.useState<SupportRequest[]>([]);
  const [subject, setSubject] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [sentId, setSentId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      setRequests((await listSupportRequests()).requests);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Your requests could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSending(true);

    try {
      try {
        window.localStorage.setItem('synzapp.support.replyEmail', replyEmail);
      } catch {
        // A browser refusing storage is not a reason to fail the request.
      }

      const result = await raiseSupportRequest({
        email: replyEmail,
        message,
        name: adminName,
        organizationName,
        subject
      });

      setSentId(result.id);
      setSubject('');
      setMessage('');
      await refresh();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'That could not be sent.');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="support-workspace">
      <header className="support-head">
        <div>
          <p className="section-eyebrow">Support</p>
          <h2>Contact Synzapp</h2>
          <p className="support-lead">
            Raised from here, your request reaches us with your organization already attached, so
            you do not need to explain who you are.
          </p>
        </div>
        <SupportArtwork />
      </header>

      <div className="support-split">
        <section className="support-panel" aria-label="Raise a request">
          <h3>Ask a question</h3>

          {sentId ? (
            <div className="staff-note is-ok" role="status">
              <ShieldCheck aria-hidden size={16} />
              <p>
                Sent. We reply to {replyEmail}. Your request is listed on the right so you can see
                it arrived.
              </p>
            </div>
          ) : null}

          {error ? (
            <div className="staff-note is-warn" role="alert">
              <AlertTriangle aria-hidden size={16} />
              <p>{error}</p>
            </div>
          ) : null}

          <form className="support-form" onSubmit={(event) => void handleSend(event)}>
            <label className="form-field">
              <span>Email we should reply to</span>
              <input
                onChange={(event) => setReplyEmail(event.target.value)}
                placeholder="you@yourcompany.com"
                required
                type="email"
                value={replyEmail}
              />
            </label>

            <label className="form-field">
              <span>Subject</span>
              <input
                onChange={(event) => setSubject(event.target.value)}
                placeholder="A short summary"
                required
                type="text"
                value={subject}
              />
            </label>

            <label className="form-field">
              <span>What do you need?</span>
              <textarea
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Tell us what is happening. If it is urgent, say so."
                required
                rows={8}
                value={message}
              />
            </label>

            <p className="support-note">
              Sent as <strong>{adminName}</strong> at <strong>{organizationName}</strong>. Your
              organization is attached automatically, so you do not need to explain who you are.
            </p>

            <button
              className="button-primary"
              disabled={isSending || !replyEmail.trim() || !subject.trim() || !message.trim()}
              type="submit"
            >
              {isSending ? 'Sending…' : 'Send to Synzapp'}
            </button>
          </form>
        </section>

        <section className="support-panel" aria-label="Your requests">
          <h3>What you have asked</h3>

          {isLoading ? <p className="staff-muted">Loading…</p> : null}

          {!isLoading && !requests.length ? (
            <div className="support-empty">
              <SupportEmptyArtwork />
              <p>Nothing yet. Anything you send will be listed here.</p>
            </div>
          ) : null}

          {requests.map((item) => (
            <article className="support-item" key={item.id}>
              <div className="staff-row-top">
                <span className="staff-row-subject">{item.subject}</span>
                <SupportStateTag state={item.state} />
              </div>
              <p className="staff-row-meta">
                {new Date(item.createdAtMs).toLocaleString()}
              </p>
              <p className="support-message">{item.message}</p>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}

/**
 * The state, in the words a customer would use.
 *
 * "Acknowledged" is our word for it; what the customer wants to know is whether
 * a person has looked at it yet.
 */
function SupportStateTag({ state }: { state: SupportRequest['state'] }) {
  const label = state === 'NEW'
    ? 'Waiting for us'
    : state === 'ACKNOWLEDGED'
      ? 'We have replied'
      : 'Closed';

  return <span className={`staff-tag is-${state.toLowerCase()}`}>{label}</span>;
}
