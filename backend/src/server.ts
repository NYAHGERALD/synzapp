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
