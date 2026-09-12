import { describe, expect, it } from 'vitest';
import { describeDownloadFailure } from './downloadFailureMessage';

describe('describeDownloadFailure', () => {
  it('prefers what the server said, because the server knows why', () => {
    expect(describeDownloadFailure({
      body: '{"error":"You do not have permission to download meeting documents. Ask your company admin to turn on \\"Export meeting documents\\" for your role in Settings, then try again."}',
      status: 403
    })).toContain('Ask your company admin');
  });

  it('explains a refusal even when the reply cannot be read', () => {
    const message = describeDownloadFailure({ body: null, status: 403 });

    expect(message).toContain('permission');
    expect(message).toContain('company admin');
  });

  it('tells somebody to sign in again rather than blaming the document', () => {
    expect(describeDownloadFailure({ body: null, status: 401 })).toContain('session has expired');
  });

  it('separates being rate limited from being broken', () => {
    expect(describeDownloadFailure({ body: null, status: 429 })).toContain('Wait a moment');
    expect(describeDownloadFailure({ body: null, status: 503 })).toContain('Try again in a moment');
  });

  it('says the document is gone when it is gone', () => {
    expect(describeDownloadFailure({ body: null, status: 404 })).toContain('no longer available');
  });

  it('never shows somebody an HTML error page', () => {
    // A proxy in the way returns HTML. Printing it at somebody is worse than
    // saying nothing useful.
    const message = describeDownloadFailure({
      body: '<html><body><h1>502 Bad Gateway</h1></body></html>',
      status: 502
    });

    expect(message).not.toContain('<html>');
    expect(message).toContain('Try again in a moment');
  });

  it('ignores an empty reason rather than showing an empty message', () => {
    expect(describeDownloadFailure({ body: '{"error":"   "}', status: 500 }))
      .toContain('could not build');
  });
});
