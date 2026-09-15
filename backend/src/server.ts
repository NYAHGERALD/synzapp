import { createServer } from 'node:http';
import { env } from './config/env.js';
import {
  describeProductionEnvProblems,
  describeProductionEnvWarnings,
  findProductionEnvProblems,
  findProductionEnvWarnings
} from './config/envGuards.js';
import { createSynzappApp } from './app.js';
import { attachCallRealtimeServer } from './services/callRealtimeService.js';
import { attachChatRealtimeServer } from './services/chatRealtimeService.js';
import { startInterpreterReminderWorker } from './services/interpreterService.js';
import { attachRcaRealtimeServer } from './services/rcaRealtimeService.js';

/**
 * Before anything is built, and only here.
 *
 * This is the real process entry; `createSynzappApp` is also used by tests, and
 * a check that fires there would make every test set production secrets. A boot
 * that fails loudly costs one deploy. A boot that succeeds on the placeholder
 * key published in this repository costs everything that key protects.
 */
const productionEnvProblems = findProductionEnvProblems(env);

if (productionEnvProblems.length) {
  console.error(describeProductionEnvProblems(productionEnvProblems));
  process.exit(1);
}

const productionEnvWarnings = findProductionEnvWarnings(env);

if (productionEnvWarnings.length) {
  console.warn(describeProductionEnvWarnings(productionEnvWarnings));
}

const app = createSynzappApp();
const server = createServer(app);

attachCallRealtimeServer(server);
attachChatRealtimeServer(server);
attachRcaRealtimeServer(server);
startInterpreterReminderWorker();
server.on('upgrade', (request, socket) => {
  if (!(request as { __synzappRealtimeHandled?: boolean }).__synzappRealtimeHandled) {
    socket.destroy();
  }
});

server.listen(env.port, () => {
  console.log(`Synzapp backend listening on port ${env.port}`);
});

/**
 * Finish what is in flight before going away.
 *
 * There was no signal handling at all, so Node exited the instant Cloud Run sent
 * SIGTERM — which it does on every revision swap and every scale-down. Requests
 * being served at that moment simply stopped, mid-work.
 *
 * That is not only a dropped request. It is the dominant cause of the failure
 * behind the audit atomicity finding: a mutation commits, the process dies
 * before the audit event is written, and the change exists with no record of it.
 * A deploy, not a crash, is what usually opens that window. Closing it here
 * reduces the frequency more cheaply than anything built around it could.
 *
 * The realtime servers hold sockets open indefinitely, so waiting for every
 * connection would hang until the platform sends SIGKILL and undo the point.
 * New connections stop, in-flight requests get a bounded grace period, and the
 * process leaves on its own terms.
 */
const SHUTDOWN_GRACE_MS = 8_000;

let shuttingDown = false;

function shutDown(signal: NodeJS.Signals): void {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(`Synzapp backend received ${signal}, finishing in-flight requests`);

  const forceExit = setTimeout(() => {
    console.warn('Synzapp backend shutting down with requests still in flight');
    process.exit(0);
  }, SHUTDOWN_GRACE_MS);

  // Let the timer sit outside the event loop's reasons to stay alive, so a
  // server that closes early leaves early rather than waiting out the grace.
  forceExit.unref();

  server.close(() => {
    clearTimeout(forceExit);
    console.log('Synzapp backend closed cleanly');
    process.exit(0);
  });
}

process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);
