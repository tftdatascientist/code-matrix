import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PtyReader } from './pty-reader.js';
import { BridgeWSServer } from './ws-server.js';
import { SessionParser } from './session-parser.js';
import { CommandRouter, type CommandPayload } from './command-router.js';

const WS_PORT = parseInt(process.env.MATRIX_WS_PORT || '7999', 10);
const PTY_SOURCE = process.env.MATRIX_PTY_SOURCE || 'pipe';
const PTY_PIPE = process.env.MATRIX_PTY_PIPE || join(tmpdir(), 'cc-matrix-pipe');
const BUFFER_SIZE = parseInt(process.env.MATRIX_BUFFER_SIZE || '10000', 10);
const COMMAND_ENABLED = process.env.MATRIX_COMMAND_ENABLED === 'true';

console.log('Matrix Bridge starting...');
console.log(`  PTY source: ${PTY_SOURCE}`);
console.log(`  Pipe path:  ${PTY_PIPE}`);
console.log(`  Commands:   ${COMMAND_ENABLED ? 'ENABLED' : 'disabled'}`);

// Start WebSocket server
const wsServer = new BridgeWSServer(WS_PORT, BUFFER_SIZE);

wsServer.onListening(() => {
  console.log(`WebSocket server listening on :${WS_PORT}`);
});

wsServer.startHeartbeat();

// Start session parser
const sessionParser = new SessionParser();

// Send current session state to newly connected clients
wsServer.onConnect((ws) => {
  wsServer.sendToClient(ws, 'session:metrics', sessionParser.getMetrics());
  wsServer.sendToClient(ws, 'session:state', sessionParser.getState());
});

sessionParser.on('metrics', (metrics) => {
  wsServer.broadcast('session:metrics', metrics);
});

sessionParser.on('state', (state) => {
  wsServer.broadcast('session:state', state);
});

// Start PTY reader
const ptyReader = new PtyReader(PTY_SOURCE, PTY_PIPE);

// Command router (disabled by default)
const commandRouter = new CommandRouter(COMMAND_ENABLED, ptyReader);

wsServer.onMessage((msg) => {
  if (msg.channel === 'command:input') {
    commandRouter.handle(msg.payload as CommandPayload);
  }
});

ptyReader.on('data', (chunk: Buffer) => {
  wsServer.sendTerminalData(chunk);
  sessionParser.feed(chunk);
});

ptyReader.on('error', (err: Error) => {
  console.error('PTY reader error:', err.message);
});

ptyReader.on('close', () => {
  console.log('PTY source closed');
  wsServer.ptyConnected = false;
});

ptyReader.start()
  .then(() => {
    console.log('PTY reader connected');
    wsServer.ptyConnected = true;
  })
  .catch((err: Error) => {
    console.error('PTY reader failed to start:', err.message);
    console.log('Bridge running without PTY source — waiting for connection...');
  });

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  ptyReader.stop();
  wsServer.close();
  process.exit(0);
});
