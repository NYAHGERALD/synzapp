import { createServer } from 'node:http';
import { env } from './config/env.js';
import { createSynzappApp } from './app.js';
import { attachCallRealtimeServer } from './services/callRealtimeService.js';
import { attachChatRealtimeServer } from './services/chatRealtimeService.js';
import { startInterpreterReminderWorker } from './services/interpreterService.js';
import { attachRcaRealtimeServer } from './services/rcaRealtimeService.js';

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
