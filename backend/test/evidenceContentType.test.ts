import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ALLOWED_EVIDENCE_CONTENT_TYPES,
  FALLBACK_EVIDENCE_CONTENT_TYPE,
  isRenderableAsDocument,
  normalizeEvidenceContentType
} from '../src/services/evidenceContentType.ts';

describe('what an evidence file may claim to be', () => {
  it('refuses text/html, which is the whole reason this exists', () => {
    /**
     * A shape check of type/subtype let this through, it was echoed back as the
     * response content type with Content-Disposition: inline, and the web app
     * reissued the bytes as a blob URL on its own origin. An uploaded file
     * became a page running as the colleague viewing it, and the evidence
     * library is tenant-wide.
     */
    assert.equal(normalizeEvidenceContentType('text/html'), FALLBACK_EVIDENCE_CONTENT_TYPE);
    assert.equal(normalizeEvidenceContentType('TEXT/HTML'), FALLBACK_EVIDENCE_CONTENT_TYPE);
    assert.equal(
      normalizeEvidenceContentType('text/html; charset=utf-8'),
      FALLBACK_EVIDENCE_CONTENT_TYPE
    );
  });

  it('refuses image/svg+xml, which looks like a picture and hosts script', () => {
    assert.equal(normalizeEvidenceContentType('image/svg+xml'), FALLBACK_EVIDENCE_CONTENT_TYPE);
  });

  it('refuses anything else a browser renders as a document', () => {
    ['application/xhtml+xml', 'text/xml', 'application/xml', 'application/rdf+xml']
      .forEach((contentType) => {
        assert.equal(isRenderableAsDocument(contentType), true);
        assert.equal(normalizeEvidenceContentType(contentType), FALLBACK_EVIDENCE_CONTENT_TYPE);
      });
  });

  it('never allows a type it would call renderable', () => {
    // The two lists cannot drift apart: anything the allowlist admits must not
    // be something a browser would run.
    ALLOWED_EVIDENCE_CONTENT_TYPES.forEach((contentType) => {
      assert.equal(
        isRenderableAsDocument(contentType),
        false,
        `${contentType} is on the allowlist and a browser would render it.`
      );
    });
  });

  it('allows the photographs and scans evidence actually is', () => {
    ['image/jpeg', 'image/png', 'image/heic', 'image/webp'].forEach((contentType) => {
      assert.equal(normalizeEvidenceContentType(contentType), contentType);
    });
  });

  it('allows video, audio and the usual documents', () => {
    ['video/mp4', 'audio/mpeg', 'application/pdf', 'text/csv'].forEach((contentType) => {
      assert.equal(normalizeEvidenceContentType(contentType), contentType);
    });
  });

  it('corrects image/jpg, because phones send it and it is the same picture', () => {
    assert.equal(normalizeEvidenceContentType('image/jpg'), 'image/jpeg');
  });

  it('falls back rather than guessing at anything unrecognised', () => {
    // A worse experience for an odd file type, and the right default for a file
    // somebody else uploaded.
    ['', '   ', 'nonsense', 'application/x-msdownload', 'image/', '/png', null, undefined]
      .forEach((contentType) => {
        assert.equal(
          normalizeEvidenceContentType(contentType as string),
          FALLBACK_EVIDENCE_CONTENT_TYPE
        );
      });
  });

  it('is not fooled by a parameter appended to a safe-looking type', () => {
    assert.equal(normalizeEvidenceContentType('image/png; charset=utf-8'), 'image/png');
  });
});
