import React from 'react';

import { parseRcaAnswer, type RcaAnswerSpan } from './rcaAnswerFormat';

/**
 * The guide's answer, drawn rather than printed.
 *
 * Elements are built from parsed blocks, never from HTML, so nothing a model
 * writes can become markup. Headings are real headings, bold is real weight,
 * and the markdown characters never reach the screen.
 *
 * Spacing is deliberately tight. This is a narrow panel beside a canvas, and
 * every empty line is a line of the answer somebody cannot see.
 */
export function RcaAnswerText({ text }: { text: string }) {
  const blocks = React.useMemo(() => parseRcaAnswer(text), [text]);

  return (
    <div className="rca-answer px-0.5">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return (
            <p
              className={block.level <= 2
                ? 'rca-answer-heading rca-answer-heading-major'
                : 'rca-answer-heading'}
              key={index}
            >
              <Spans spans={block.spans} />
            </p>
          );
        }

        if (block.type === 'listItem') {
          return (
            <div
              className="rca-answer-item"
              key={index}
              style={{ paddingLeft: block.depth * 14 }}
            >
              <span aria-hidden="true" className="rca-answer-marker">
                {block.marker || '•'}
              </span>
              <span>
                <Spans spans={block.spans} />
              </span>
            </div>
          );
        }

        return (
          <p className="rca-answer-paragraph" key={index}>
            <Spans spans={block.spans} />
          </p>
        );
      })}
    </div>
  );
}

function Spans({ spans }: { spans: RcaAnswerSpan[] }) {
  return (
    <>
      {spans.map((span, index) => (
        span.bold
          ? <strong className="rca-answer-strong" key={index}>{span.text}</strong>
          : <React.Fragment key={index}>{span.text}</React.Fragment>
      ))}
    </>
  );
}
