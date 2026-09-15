import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(testDir, '..');
const read = (...parts: string[]) => readFileSync(resolve(backendRoot, ...parts), 'utf8');

const SOCKETS = ['rcaRealtimeService', 'chatRealtimeService', 'callRealtimeService'];

describe('every realtime socket bounds what it will accept', () => {
  SOCKETS.forEach((socket) => {
    it(`${socket} caps the frame size`, () => {
      /**
       * All three were constructed with `{ noServer: true }` and nothing else,
       * which leaves the ws default of 100 MiB per frame — against an 8 MB limit
       * on the HTTP side. They are also wired to the upgrade event outside the
       * Express chain, so neither device binding nor App Check runs on them:
       * the largest and least guarded intake in the product.
       */
      const source = read('src', 'services', `${socket}.ts`);

      assert.match(source, /maxPayload: REALTIME_MAX_PAYLOAD_BYTES/);
      assert.doesNotMatch(
        source,
        /new WebSocketServer\(\{ noServer: true \}\)/,
        'An unbounded WebSocketServer accepts 100 MiB frames.'
      );
    });
  });

  it('keeps the cap generous enough not to be raised back to infinity', () => {
    // A limit that breaks a real message is a limit somebody removes. RCA node
    // input alone allows 80 detail fields of 1200 characters.
    const limits = read('src', 'services', 'realtimeLimits.ts');

    assert.match(limits, /512 \* 1024/);
  });
});

describe('the canvas socket validates what the HTTP route validates', () => {
  it('parses node input with the same schema', () => {
    /**
     * parseMessage only ever checked `type`, so everything else arrived
     * unexamined — and this is the door the web client prefers whenever the
     * canvas socket is up. Every bound the route enforces simply did not exist
     * here.
     */
    const realtime = read('src', 'services', 'rcaRealtimeService.ts');
    const parses = realtime.match(/nodeBodySchema\.parse\(message\.input \|\| \{\}\)/g) || [];

    assert.equal(parses.length, 2, 'Both createNode and updateNode must validate.');
  });

  it('shares one schema module rather than importing a route from a service', () => {
    /**
     * rcaRoutes already imports the realtime service, so importing the schema
     * back out of the route would be a cycle. One module both sides depend on,
     * and neither depends on the other.
     */
    const realtime = read('src', 'services', 'rcaRealtimeService.ts');

    assert.match(realtime, /from '\.\/rcaNodeInputSchema\.js'/);
    assert.doesNotMatch(realtime, /from '\.\.\/routes\//);
  });

  it('carries detailFields, so validating does not silently drop them', () => {
    /**
     * The schema had no detailFields key, and zod strips unknown keys — so
     * applying it to the socket without this would have deleted the one field
     * that only ever worked because the socket did not validate.
     */
    const schema = read('src', 'services', 'rcaNodeInputSchema.ts');

    assert.match(schema, /detailFields: z\.record/);
    assert.match(schema, /length <= 80/);
  });
});
