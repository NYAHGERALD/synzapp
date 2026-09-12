/**
 * Runs async work one piece at a time, in the order it was handed over.
 *
 * Written for realtime chat payloads. Handling one runs cache reads and writes,
 * a token fetch, group key granting and envelope decryption, so how long it
 * takes depends on the message. Started in parallel, a later message whose work
 * was quick finished first, and an earlier, slower one finished last and wrote
 * its own older snapshot of the conversation over the newer one — so a message
 * disappeared from the thread until the next event repainted it.
 *
 * Order of arrival becomes order of effect. Nothing here makes the work faster;
 * it makes the result predictable, which is what the disappearing message was
 * really about.
 */
export type SerialTaskQueue = {
  /** Hands over a task. It runs once everything already queued has finished. */
  push: (task: () => Promise<void> | void) => void;
  /** Resolves when everything queued so far has settled. For tests and teardown. */
  whenIdle: () => Promise<void>;
};

/**
 * How long one task may hold the queue before the rest are let past.
 *
 * Ordering is only worth having if the queue keeps moving. Handling a realtime
 * payload fetches a token, and that call has no timeout of its own — on a flaky
 * network it can hang indefinitely. Unqueued, that cost one lost event. Queued
 * behind it, every later message, receipt and presence update stopped arriving
 * too, and the conversation simply went dead until the app was restarted.
 *
 * Long enough to cover a slow decrypt on a poor connection, short enough that a
 * stall is a hiccup rather than a broken chat.
 */
export const DEFAULT_SERIAL_TASK_TIMEOUT_MS = 15000;

export function createSerialTaskQueue(options?: {
  onError?: (error: unknown) => void;
  onTimeout?: () => void;
  taskTimeoutMs?: number;
}): SerialTaskQueue {
  const onError = options?.onError;
  const timeoutMs = options?.taskTimeoutMs ?? DEFAULT_SERIAL_TASK_TIMEOUT_MS;
  let tail: Promise<void> = Promise.resolve();

  /**
   * Lets the queue move on, without pretending the task is finished.
   *
   * A promise cannot be cancelled, so a task that overran keeps running and may
   * still complete its work. All this does is stop the queue waiting on it.
   * Applying a late result out of order is a smaller fault than never applying
   * anything again.
   */
  function withTimeout(task: () => Promise<void> | void): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        options?.onTimeout?.();
        resolve();
      }, timeoutMs);

      Promise.resolve()
        .then(task)
        .then(() => {
          clearTimeout(timer);
          resolve();
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  return {
    push(task) {
      /**
       * The catch belongs to each task, not to the chain.
       *
       * Without it one rejection would poison `tail`, and every task queued
       * afterwards would be skipped — one malformed payload would stop the
       * conversation updating at all.
       */
      tail = tail
        .then(() => withTimeout(task))
        .catch((error) => {
          onError?.(error);
        });
    },
    whenIdle() {
      return tail;
    }
  };
}
