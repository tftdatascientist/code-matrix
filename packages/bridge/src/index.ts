import { config } from 'dotenv';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Load .env from project root (three levels up from packages/bridge/src/)
config({ path: resolve(import.meta.dirname ?? '.', '../../../.env') });

import { PtyReader } from './pty-reader.js';
import { PtySpawner } from './pty-spawner.js';
import { BridgeWSServer } from './ws-server.js';
import { SessionParser } from './session-parser.js';
import { CommandRouter, type CommandPayload } from './command-router.js';

const WS_PORT = parseInt(process.env.MATRIX_WS_PORT || '7999', 10);
const PTY_SOURCE = process.env.MATRIX_PTY_SOURCE || 'pipe';
const PTY_PIPE = process.env.MATRIX_PTY_PIPE || join(tmpdir(), 'cc-matrix-pipe');
const BUFFER_SIZE = parseInt(process.env.MATRIX_BUFFER_SIZE || '10000', 10);
const COMMAND_ENABLED = process.env.MATRIX_COMMAND_ENABLED === 'true';
const PTY_COMMAND = process.env.MATRIX_PTY_COMMAND || 'claude';
const PTY_ARGS = process.env.MATRIX_PTY_ARGS?.split(' ').filter(Boolean) ?? [];
const PTY_COLS = parseInt(process.env.MATRIX_PTY_COLS || '120', 10);
const PTY_ROWS = parseInt(process.env.MATRIX_PTY_ROWS || '40', 10);

console.log('Matrix Bridge starting...');
console.log(`  PTY source: ${PTY_SOURCE}`);
if (PTY_SOURCE === 'node-pty') {
  console.log(`  PTY command: ${PTY_COMMAND} ${PTY_ARGS.join(' ')}`);
  console.log(`  PTY size:    ${PTY_COLS}x${PTY_ROWS}`);
} else {
  console.log(`  Pipe path:  ${PTY_PIPE}`);
}
console.log(`  Commands:   ${COMMAND_ENABLED || PTY_SOURCE === 'node-pty' ? 'ENABLED' : 'disabled'}`);

// Start WebSocket server
const wsServer = new BridgeWSServer(WS_PORT, BUFFER_SIZE);

wsServer.onListening(() => {
  console.log(`WebSocket server listening on :${WS_PORT}`);
});

wsServer.startHeartbeat();

// Start session parser
const sessionParser = new SessionParser();

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

// Create PTY source based on config
type PtySource = PtyReader | PtySpawner;

let ptySource: PtySource;

if (PTY_SOURCE === 'node-pty') {
  ptySource = new PtySpawner({
    command: PTY_COMMAND,
    args: PTY_ARGS,
    cols: PTY_COLS,
    rows: PTY_ROWS,
  });
} else {
  ptySource = new PtyReader(PTY_SOURCE, PTY_PIPE);
}

// Command router — auto-enabled for node-pty mode
const commandsActive = COMMAND_ENABLED || PTY_SOURCE === 'node-pty';

const commandRouter = new CommandRouter(commandsActive, {
  writeStdin: (data: string) => ptySource.writeStdin(data),
});

wsServer.onMessage((msg) => {
  if (msg.channel === 'command:input') {
    commandRouter.handle(msg.payload as CommandPayload);
  }
  if (msg.channel === 'terminal:resize' && ptySource instanceof PtySpawner) {
    const { cols, rows } = msg.payload as { cols: number; rows: number };
    ptySource.resize(cols, rows);
  }
});

ptySource.on('data', (chunk: Buffer) => {
  wsServer.sendTerminalData(chunk);
  sessionParser.feed(chunk);
});

ptySource.on('error', (err: Error) => {
  console.error('PTY error:', err.message);
});

ptySource.on('close', (...args: unknown[]) => {
  if (PTY_SOURCE === 'node-pty') {
    const exitCode = args[0] as number | undefined;
    console.log(`Claude process exited (code: ${exitCode ?? 'unknown'})`);
  } else {
    console.log('PTY source closed');
  }
  wsServer.ptyConnected = false;
});

ptySource.start()
  .then(() => {
    console.log('PTY source connected');
    wsServer.ptyConnected = true;
  })
  .catch((err: Error) => {
    console.error('PTY source failed to start:', err.message);
    console.log('Bridge running without PTY source — waiting for connection...');
  });

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  ptySource.stop();
  wsServer.close();
  process.exit(0);
});
