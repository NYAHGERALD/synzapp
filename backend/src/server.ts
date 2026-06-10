import { createServer } from 'node:http';
import { env } from './config/env.js';
import { createSynzappApp } from './app.js';
import { attachChatRealtimeServer } from './services/chatRealtimeService.js';

const app = createSynzappApp();
const server = createServer(app);

attachChatRealtimeServer(server);

server.listen(env.port, () => {
  console.log(`Synzapp backend listening on port ${env.port}`);
});
