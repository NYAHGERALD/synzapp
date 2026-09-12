import { describe, expect, it } from 'vitest';

import { createSerialTaskQueue } from './serialTaskQueue';

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

describe('createSerialTaskQueue', () => {
  it('applies slow work before fast work that was handed over later', async () => {
    // The disappearing message, reproduced: the first payload takes longer than
    // the second. Run in parallel the second lands first and the first
    // overwrites it. Queued, the last write is the newest.
    const applied: string[] = [];
    const queue = createSerialTaskQueue();

    queue.push(async () => {
      await wait(30);
      applied.push('first');
    });
    queue.push(async () => {
      await wait(1);
      applied.push('second');
    });

    await queue.whenIdle();

    expect(applied).toEqual(['first', 'second']);
  });

  it('keeps arrival order across a burst', async () => {
    const applied: number[] = [];
    const queue = createSerialTaskQueue();
    const durations = [12, 2, 9, 1, 6];

    durations.forEach((duration, index) => {
      queue.push(async () => {
        await wait(duration);
        applied.push(index);
      });
    });

    await queue.whenIdle();

    expect(applied).toEqual([0, 1, 2, 3, 4]);
  });

  it('carries on after a task throws, and reports it', async () => {
    // One malformed payload must not stop the conversation updating.
    const applied: string[] = [];
    const errors: unknown[] = [];
    const queue = createSerialTaskQueue({ onError: (error) => errors.push(error) });

    queue.push(() => {
      applied.push('before');
    });
    queue.push(async () => {
      throw new Error('malformed payload');
    });
    queue.push(() => {
      applied.push('after');
    });

    await queue.whenIdle();

    expect(applied).toEqual(['before', 'after']);
    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toBe('malformed payload');
  });

  it('accepts work handed over while it is already running', async () => {
    const applied: string[] = [];
    const queue = createSerialTaskQueue();

    queue.push(async () => {
      await wait(5);
      applied.push('running');
      queue.push(() => {
        applied.push('queued from inside');
      });
    });

    await queue.whenIdle();
    await queue.whenIdle();

    expect(applied).toEqual(['running', 'queued from inside']);
  });

  it('lets the queue past a task that never finishes', async () => {
    // The regression this exists to stop: a realtime payload whose token fetch
    // hangs used to hold every later message, receipt and presence update
    // behind it, and the conversation went dead until the app restarted.
    const applied: string[] = [];
    let timedOut = 0;
    const queue = createSerialTaskQueue({
      onTimeout: () => {
        timedOut += 1;
      },
      taskTimeoutMs: 20
    });

    queue.push(() => new Promise<void>(() => {
      // Never settles, like a token fetch on a dead connection.
    }));
    queue.push(() => {
      applied.push('after the stall');
    });

    await queue.whenIdle();

    expect(applied).toEqual(['after the stall']);
    expect(timedOut).toBe(1);
  });

  it('does not time out work that finishes in time', async () => {
    let timedOut = 0;
    const queue = createSerialTaskQueue({
      onTimeout: () => {
        timedOut += 1;
      },
      taskTimeoutMs: 200
    });
    const applied: string[] = [];

    queue.push(async () => {
      await wait(5);
      applied.push('done');
    });

    await queue.whenIdle();

    expect(applied).toEqual(['done']);
    expect(timedOut).toBe(0);
  });
});
