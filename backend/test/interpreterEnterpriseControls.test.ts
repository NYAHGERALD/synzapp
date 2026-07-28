import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(testDir, '..');
const interpreterRoutes = readFileSync(resolve(backendRoot, 'src', 'routes', 'interpreterRoutes.ts'), 'utf8');
const interpreterService = readFileSync(resolve(backendRoot, 'src', 'services', 'interpreterService.ts'), 'utf8');
const server = readFileSync(resolve(backendRoot, 'src', 'server.ts'), 'utf8');

describe('interpreter enterprise controls', () => {
  it('keeps every interpreter route behind App Check and Firebase session verification', () => {
    const routeBlocks = getRouteBlocks(interpreterRoutes, 'interpreterRouter', ['get', 'post', 'delete']);

    assert.ok(routeBlocks.length > 0, 'Expected interpreter routes to be present.');

    routeBlocks.forEach((block) => {
      assert.match(block.header, /verifyAppCheck/, `${block.header} must require App Check middleware.`);

      if (!block.header.includes('/languages')) {
        assert.match(block.body, /getDecodedToken/, `${block.header} must verify a Firebase session.`);
      }
    });
  });

  it('exposes the summaries read endpoint promised by the interpreter plan', () => {
    assert.match(
      interpreterRoutes,
      /interpreterRouter\.get\('\/meetings\/:meetingId\/summaries'/,
      'Interpreter summaries must be readable without fetching the full meeting envelope.'
    );
    assert.match(interpreterRoutes, /listInterpreterSummaries/);
  });

  it('supports controlled participant discovery and meeting invitation updates', () => {
    assert.match(
      interpreterRoutes,
      /interpreterRouter\.get\('\/participants'/,
      'Interpreter needs a tenant-scoped participant directory instead of reusing admin employee management.'
    );
    assert.match(
      interpreterRoutes,
      /interpreterRouter\.post\('\/meetings\/:meetingId\/invitations'/,
      'Interpreter meeting access must be updated through a dedicated secured endpoint.'
    );
    assert.match(interpreterService, /listInterpreterParticipants/);
    assert.match(interpreterService, /updateInterpreterMeetingInvitations/);
    assert.match(interpreterService, /invitedUserIds/);
    assert.match(interpreterService, /One or more selected interpreter participants are not active company users\./);
  });

  it('validates source language, scheduled dates, and reminder dependencies before meeting creation', () => {
    assert.match(interpreterService, /validateCreateInterpreterMeetingInput\(input\)/);
    assert.match(interpreterService, /The selected speaker language is not supported yet\./);
    assert.match(interpreterService, /Scheduled interpreter meetings must be set for a future time\./);
    assert.match(interpreterService, /A reminder requires a scheduled meeting date and time\./);
  });

  it('runs interpreter reminder dispatch from the backend, not the mobile client', () => {
    assert.match(server, /startInterpreterReminderWorker\(\)/);
    assert.match(interpreterService, /runInterpreterReminderDispatchCycle/);
    assert.match(interpreterService, /claimInterpreterReminder/);
    assert.match(interpreterService, /sendInterpreterPushNotification/);
    assert.match(interpreterService, /INTERPRETER_MEETING_REMINDER_SENT/);
    assert.match(interpreterService, /reminderNextAtIso/);
    assert.match(interpreterService, /listScheduledInterpreterReminderMeetingDocs/);
    assert.doesNotMatch(interpreterService, /collectionGroup\(INTERPRETER_MEETINGS_COLLECTION\)/);
  });

  it('audits meeting memory writes without duplicating sensitive transcript text in audit metadata', () => {
    assert.match(interpreterService, /INTERPRETER_TRANSCRIPT_SEGMENT_RECORDED/);
    assert.match(interpreterService, /INTERPRETER_TRANSLATION_SEGMENT_RECORDED/);
    assert.match(interpreterService, /textCharacterCount/);
    assert.match(interpreterService, /translatedCharacterCount/);
    assert.doesNotMatch(interpreterService, /metadata:\s*\{[^}]*text:/s);
    assert.doesNotMatch(interpreterService, /metadata:\s*\{[^}]*translatedText:/s);
  });

  it('returns only short-lived realtime client secrets to mobile clients', () => {
    assert.match(interpreterService, /return\s*\{\s*clientSecret,/);
    assert.doesNotMatch(interpreterService, /clientSecretResponse,\s*$/m);
    assert.match(interpreterService, /extractRealtimeClientSecret/);
  });

  it('keeps the backend realtime SDP exchange endpoint guarded for compatibility', () => {
    assert.match(
      interpreterRoutes,
      /interpreterRouter\.post\('\/meetings\/:meetingId\/realtime-sdp-answer'/,
      'Compatibility SDP answer endpoint must stay authenticated and validated.'
    );
    assert.match(interpreterService, /createInterpreterRealtimeSdpAnswer/);
    assert.match(interpreterService, /INTERPRETER_REALTIME_SDP_EXCHANGED/);
    assert.match(interpreterService, /normalizeRealtimeOfferSdp/);
    assert.match(interpreterRoutes, /application\/sdp/);
    assert.doesNotMatch(interpreterService, /return\s*\{\s*answerSdp,[\s\S]{0,220}clientSecret/);
  });

  it('supports controlled interpreter meeting deletion with audit retention', () => {
    assert.match(
      interpreterRoutes,
      /interpreterRouter\.delete\('\/meetings\/:meetingId'/,
      'Interpreter meetings need a controlled delete endpoint.'
    );
    assert.match(interpreterService, /deleteInterpreterMeeting/);
    assert.match(interpreterService, /INTERPRETER_MEETING_DELETED/);
    assert.match(interpreterService, /deletedAtIso/);
    assert.match(interpreterService, /End this live interpreter session before deleting it\./);
  });

  it('provides an admin-only realtime provider diagnostic before live testing on devices', () => {
    assert.match(interpreterRoutes, /interpreterRouter\.post\('\/realtime-diagnostics'/);
    assert.match(interpreterService, /runInterpreterRealtimeProviderDiagnostic/);
    assert.match(interpreterService, /canRunInterpreterProviderDiagnostic/);
    assert.match(interpreterService, /INTERPRETER_REALTIME_PROVIDER_DIAGNOSTIC/);
    assert.match(interpreterService, /expectedInvalidOfferResponse/);
    assert.doesNotMatch(interpreterService, /metadata:\s*\{[^}]*clientSecret/s);
  });
});

function getRouteBlocks(
  source: string,
  routerName: string,
  methods: Array<'delete' | 'get' | 'post'>
): Array<{ body: string; header: string }> {
  const routePattern = new RegExp(`${routerName}\\.(${methods.join('|')})\\(`, 'g');
  const blocks: Array<{ body: string; header: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = routePattern.exec(source))) {
    const start = match.index;
    const nextRoutePattern = new RegExp(`${routerName}\\.(get|post|patch|delete)\\(`, 'g');

    nextRoutePattern.lastIndex = start + 1;
    const nextRouteMatch = nextRoutePattern.exec(source);
    const end = nextRouteMatch?.index ?? source.length;
    const block = source.slice(start, end);
    const header = block.split('\n')[0] || `${routerName}.${match[1]}`;

    blocks.push({
      body: block,
      header
    });
  }

  return blocks;
}
