/**
 * Turning the guide's markdown into something the panel can draw.
 *
 * The model writes markdown, and the panel was printing it raw — "##" and "**"
 * on screen as characters. A parser rather than a markdown library: the answer
 * is untrusted text from a model, and this never produces HTML for the browser
 * to interpret. The component builds elements from these blocks, so a stray
 * angle bracket in an answer is a stray angle bracket, not a tag.
 *
 * Only the subset the guide actually writes. Anything unrecognised stays as the
 * literal text it was, which is the right failure: readable, never broken.
 *
 * No react import, so it can be tested.
 */

export interface RcaAnswerSpan {
  bold: boolean;
  text: string;
}

export type RcaAnswerBlock =
  | { level: number; spans: RcaAnswerSpan[]; type: 'heading' }
  | { spans: RcaAnswerSpan[]; type: 'paragraph' }
  | { depth: number; marker: string | null; spans: RcaAnswerSpan[]; type: 'listItem' };

const HEADING = /^(#{1,6})\s+(.*)$/;
const ORDERED = /^(\s*)(\d+)[.)]\s+(.*)$/;
const BULLET = /^(\s*)[-*•]\s+(.*)$/;

/** Two spaces of indent is one level in everything the guide emits. */
const SPACES_PER_DEPTH = 2;

export function parseRcaAnswer(text: string): RcaAnswerBlock[] {
  const blocks: RcaAnswerBlock[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) {
      return;
    }

    blocks.push({ spans: parseInlineSpans(paragraph.join(' ')), type: 'paragraph' });
    paragraph = [];
  };

  (text || '').split('\n').forEach((rawLine) => {
    const line = rawLine.replace(/\s+$/, '');

    if (!line.trim()) {
      flushParagraph();

      return;
    }

    const heading = HEADING.exec(line);

    if (heading) {
      flushParagraph();
      blocks.push({
        level: Math.min(3, heading[1].length),
        spans: parseInlineSpans(heading[2]),
        type: 'heading'
      });

      return;
    }

    const ordered = ORDERED.exec(line);

    if (ordered) {
      flushParagraph();
      blocks.push({
        depth: Math.floor(ordered[1].length / SPACES_PER_DEPTH),
        marker: `${ordered[2]}.`,
        spans: parseInlineSpans(ordered[3]),
        type: 'listItem'
      });

      return;
    }

    const bullet = BULLET.exec(line);

    if (bullet) {
      flushParagraph();
      blocks.push({
        depth: Math.floor(bullet[1].length / SPACES_PER_DEPTH),
        marker: null,
        spans: parseInlineSpans(bullet[2]),
        type: 'listItem'
      });

      return;
    }

    paragraph.push(line.trim());
  });

  flushParagraph();

  return blocks;
}

/**
 * Splits **bold** out of a line.
 *
 * An unclosed `**` is left as the characters it is, which happens constantly
 * while a stream is still arriving mid-word.
 */
export function parseInlineSpans(text: string): RcaAnswerSpan[] {
  const spans: RcaAnswerSpan[] = [];
  const pattern = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match = pattern.exec(text);

  while (match) {
    if (match.index > lastIndex) {
      spans.push({ bold: false, text: text.slice(lastIndex, match.index) });
    }

    spans.push({ bold: true, text: match[1] });
    lastIndex = match.index + match[0].length;
    match = pattern.exec(text);
  }

  if (lastIndex < text.length) {
    spans.push({ bold: false, text: text.slice(lastIndex) });
  }

  return spans.filter((span) => span.text.length > 0);
}
