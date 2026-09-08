import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildConversationTranscript, type TranscriptMessage } from '../src/services/complianceTranscript.ts';
import type { ExportManifestEntry } from '../src/services/complianceExportManifest.ts';

const NAMES: Record<string, string> = {
  'user-1': 'Amara Obi',
  'user-2': 'Tom Reid'
};

const nameForUid = (uid: string) => NAMES[uid] || uid;

function entry(overrides: Partial<ExportManifestEntry> = {}): ExportManifestEntry {
  return {
    conversationId: 'chat-1',
    conversationKind: 'DIRECT',
    envelopeId: 'env-1',
    excludedReason: null,
    media: [],
    messageFilePath: 'data/messages/chat-1/a.json',
    senderUid: 'user-1',
    sentAtMs: Date.UTC(2026, 2, 1, 9, 30),
    ...overrides
  };
}

function build(messages: TranscriptMessage[]) {
  return buildConversationTranscript({
    conversationId: 'chat-1',
    conversationKind: 'DIRECT',
    criteriaSummary: 'all messages',
    exportId: 'export-1',
    generatedAtMs: Date.UTC(2026, 5, 2),
    messages,
    nameForUid
  });
}

describe('the transcript reads as a conversation', () => {
  it('shows names, not identifiers', () => {
    const html = build([{ entry: entry(), text: 'The invoice was approved.' }]);

    assert.match(html, /Amara Obi/);
    assert.doesNotMatch(html, /user-1/);
  });

  it('puts messages in the order they were sent, whatever order they arrive in', () => {
    const html = build([
      { entry: entry({ envelopeId: 'b', sentAtMs: Date.UTC(2026, 2, 1, 11, 0) }), text: 'Second' },
      { entry: entry({ envelopeId: 'a', sentAtMs: Date.UTC(2026, 2, 1, 9, 0) }), text: 'First' }
    ]);

    assert.ok(html.indexOf('First') < html.indexOf('Second'));
  });

  it('lists the participants and the search that produced it', () => {
    const html = build([
      { entry: entry(), text: 'Hello' },
      { entry: entry({ envelopeId: 'b', senderUid: 'user-2' }), text: 'Hi' }
    ]);

    assert.match(html, /Amara Obi, Tom Reid/);
    assert.match(html, /all messages/);
    assert.match(html, /export-1/);
  });
});

describe('nothing is hidden from the reader', () => {
  it('shows an unreadable message in place, with the reason', () => {
    // Skipping it would show an unbroken exchange where there is a gap.
    const html = build([
      { entry: entry({ excludedReason: 'NOT_ARCHIVED', messageFilePath: null }), text: null }
    ]);

    assert.match(html, /class="unreadable"/);
    assert.match(html, /cannot be corrected/i);
  });

  it('links an included attachment to the real file', () => {
    const html = build([{
      entry: entry({
        media: [{
          contentType: 'video/mp4',
          excludedReason: null,
          fileName: 'clip.mp4',
          filePath: 'attachments/chat-1/clip.mp4',
          mediaId: 'm1',
          sizeBytes: 2048
        }]
      }),
      text: 'Look at this'
    }]);

    assert.match(html, /href="\.\.\/attachments\/chat-1\/clip\.mp4"/);
    assert.match(html, /clip\.mp4/);
    assert.match(html, /2 KB/);
  });

  it('names an attachment that was left out and says why', () => {
    const html = build([{
      entry: entry({
        media: [{
          contentType: 'video/mp4',
          excludedReason: 'MEDIA_TOO_LARGE',
          fileName: 'huge.mp4',
          filePath: null,
          mediaId: 'm1',
          sizeBytes: 900000000
        }]
      }),
      text: 'Look at this'
    }]);

    assert.match(html, /class="file missing"/);
    assert.match(html, /huge\.mp4/);
    assert.match(html, /larger than a single export/i);
  });
});

describe('message text cannot run code in the reader browser', () => {
  it('escapes markup in a message', () => {
    // The bundle is opened by somebody outside the organization. Unescaped
    // message text would let a message run code on their machine.
    const html = build([
      { entry: entry(), text: '<script>alert(1)</script>' }
    ]);

    assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
    assert.match(html, /&lt;script&gt;/);
  });

  it('escapes markup in a file name', () => {
    const html = build([{
      entry: entry({
        media: [{
          contentType: 'image/png',
          excludedReason: null,
          fileName: '"><img src=x onerror=alert(1)>',
          filePath: 'attachments/chat-1/x.png',
          mediaId: 'm1',
          sizeBytes: 10
        }]
      }),
      text: ''
    }]);

    assert.doesNotMatch(html, /<img src=x onerror/);
    assert.match(html, /&quot;&gt;&lt;img/);
  });

  it('escapes a name taken from a profile', () => {
    const html = buildConversationTranscript({
      conversationId: 'chat-1',
      conversationKind: 'DIRECT',
      criteriaSummary: 'all messages',
      exportId: 'export-1',
      generatedAtMs: Date.UTC(2026, 5, 2),
      messages: [{ entry: entry({ senderUid: 'evil' }), text: 'hi' }],
      nameForUid: () => '<script>bad()</script>'
    });

    assert.doesNotMatch(html, /<script>bad\(\)<\/script>/);
  });
});
