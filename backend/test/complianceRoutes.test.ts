import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  assertDispositionApprovalAuthentication,
  DISPOSITION_SLA_DAYS
} from '../src/services/dispositionService.ts';

const testDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(testDir, '..');
// The console's API is its own router, not part of the mobile profile router:
// that one requires a registered device on every route and a browser has none.
const complianceRoutes = readFileSync(
  resolve(backendRoot, 'src', 'routes', 'complianceRoutes.ts'),
  'utf8'
);
const dispositionService = readFileSync(
  resolve(backendRoot, 'src', 'services', 'dispositionService.ts'),
  'utf8'
);

function token(authTimeSeconds: number) {
  return { auth_time: authTimeSeconds } as never;
}

describe('approving a deletion needs a fresh phone verification', () => {
  it('accepts a verification from moments ago', () => {
    assert.doesNotThrow(() => assertDispositionApprovalAuthentication(token(Date.now() / 1000)));
  });

  it('rejects a stale session', () => {
    // A long-lived session on an unlocked laptop must not be enough to destroy
    // a company's records.
    assert.throws(
      () => assertDispositionApprovalAuthentication(token(Date.now() / 1000 - 3600)),
      /Verify your phone number again/
    );
  });

  it('rejects a token with no sign-in time at all', () => {
    assert.throws(() => assertDispositionApprovalAuthentication(token(0)), /Verify your phone number/);
  });
});

describe('the published timeline', () => {
  it('is 16 days, matching the work Microsoft does silently', () => {
    assert.equal(DISPOSITION_SLA_DAYS, 16);
  });

  it('is returned to the console so it can be shown', () => {
    // The plan's improvement over Purview is stating the number, not beating it.
    assert.match(complianceRoutes, /slaDays: DISPOSITION_SLA_DAYS/);
  });

  it('sets each batch a concrete completion date', () => {
    assert.match(dispositionService, /purgeByMs: input\.eligibleAtMs \+ DISPOSITION_SLA_MS/);
  });
});

describe('compliance routes are Org Admin only', () => {
  const routeLines = complianceRoutes
    .split('\n')
    .filter((line) => /complianceRouter\.(get|post)\(/.test(line));

  it('registers the console\'s routes', () => {
    assert.ok(routeLines.length >= 6, `expected the compliance routes, saw ${routeLines.length}`);
  });

  it('gates every one behind the compliance admin check', () => {
    const complianceSection = complianceRoutes.slice(complianceRoutes.indexOf("complianceRouter."));
    const handlers = complianceSection.split('complianceRouter.').filter((chunk) => chunk.includes("'/compliance"));

    handlers.forEach((handler) => {
      assert.match(handler, /requireComplianceAdmin\(decodedToken\)/);
    });
  });
});

describe('destructive actions need step-up, safe ones do not', () => {
  function handlerFor(path: string): string {
    const start = complianceRoutes.indexOf(path);
    assert.ok(start > 0, `route not found: ${path}`);
    const next = complianceRoutes.indexOf('complianceRouter.', start);
    return complianceRoutes.slice(start, next > start ? next : undefined);
  }

  it('requires step-up to approve a destruction', () => {
    assert.match(handlerFor("'/disposition/:itemId/approve'"), /assertDispositionApprovalAuthentication/);
  });

  it('requires step-up to release a hold', () => {
    // Releasing exposes preserved evidence to the disposer.
    assert.match(handlerFor("'/holds/:holdId/release'"), /assertDispositionApprovalAuthentication/);
  });

  it('requires step-up to activate a policy', () => {
    assert.match(handlerFor("'/retention/policies/:policyId/state'"), /assertDispositionApprovalAuthentication/);
  });

  it('does not require step-up to keep data longer', () => {
    // The safe direction should never be the harder one.
    assert.doesNotMatch(handlerFor("'/disposition/:itemId/extend'"), /assertDispositionApprovalAuthentication/);
  });
});

describe('every compliance action is audited', () => {
  ['RETENTION_POLICY_SAVED', 'RETENTION_POLICY_STATE_CHANGED', 'LEGAL_HOLD_APPLIED',
   'LEGAL_HOLD_RELEASED', 'DISPOSITION_APPROVED', 'DISPOSITION_EXTENDED'].forEach((action) => {
    it(`writes ${action}`, () => {
      assert.match(complianceRoutes, new RegExp(`action: '${action}'`));
    });
  });
});

describe('a hold re-checked at approval time', () => {
  it('refuses approval when a hold appeared after queueing', () => {
    // The queue may sit for days; a hold applied in between must win.
    assert.match(dispositionService, /const activeHolds = await listActiveLegalHolds\(input\.tenantId\);/);
    assert.match(dispositionService, /prevents this deletion/);
  });

  it('records withheld batches rather than hiding them', () => {
    // An empty queue cannot distinguish "nothing expired" from "all frozen".
    assert.match(dispositionService, /'WITHHELD'/);
  });
});

describe('route paths match where the router is mounted', () => {
  const appSource = readFileSync(resolve(backendRoot, 'src', 'app.ts'), 'utf8');

  it('mounts the router under /api/compliance', () => {
    assert.match(appSource, /app\.use\('\/api\/compliance', complianceRouter\)/);
  });

  it('does not repeat the mount prefix in any route path', () => {
    // These routes were moved out of the profile router, where their paths began
    // with /compliance. Kept as-is under a /api/compliance mount they resolved
    // to /api/compliance/compliance/... and every one returned 404 in
    // production while typecheck and the unit tests stayed green.
    const paths = [...complianceRoutes.matchAll(/complianceRouter\.(?:get|post)\('([^']+)'/g)]
      .map((match) => match[1]);

    assert.ok(paths.length >= 8, `expected the compliance routes, saw ${paths.length}`);

    paths.forEach((path) => {
      assert.doesNotMatch(path, /^\/compliance\b/, `${path} repeats the /api/compliance mount prefix`);
    });
  });

  it('registers the paths the console actually calls', () => {
    const expected = [
      '/retention',
      '/retention/policies',
      '/retention/policies/:policyId/state',
      '/retention/evaluate',
      '/holds',
      '/holds/:holdId/release',
      '/disposition/:itemId/approve',
      '/disposition/:itemId/extend'
    ];

    expected.forEach((path) => {
      assert.match(complianceRoutes, new RegExp(`complianceRouter\\.(get|post)\\('${path.replace(/[:/]/g, '\\$&')}'`));
    });
  });
});

describe('turning destruction on is itself a destructive act', () => {
  function handlerFor(path: string): string {
    const start = complianceRoutes.indexOf(path);
    assert.ok(start > 0, `route not found: ${path}`);
    const next = complianceRoutes.indexOf('complianceRouter.', start);
    return complianceRoutes.slice(start, next > start ? next : undefined);
  }

  it('requires a phone check to switch destruction on', () => {
    // From that moment, approved batches start being destroyed for real.
    assert.match(handlerFor("'/retention/shredding'"), /assertDispositionApprovalAuthentication/);
  });

  it('requires a phone check to run the destruction pass', () => {
    assert.match(handlerFor("'/retention/shred'"), /assertDispositionApprovalAuthentication/);
  });

  it('records switching it on and off separately in the audit log', () => {
    assert.match(complianceRoutes, /RETENTION_SHREDDING_ENABLED/);
    assert.match(complianceRoutes, /RETENTION_SHREDDING_DISABLED/);
  });

  it('records every destruction run', () => {
    assert.match(complianceRoutes, /RETENTION_SHREDDER_RUN/);
  });
});
