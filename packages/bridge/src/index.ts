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

const WS_PORT = parseInt(process.env.MATRIX_WS_PORT || '7999', 10);
const PTY_SOURCE = process.env.MATRIX_PTY_SOURCE || 'pipe';
const PTY_PIPE = process.env.MATRIX_PTY_PIPE || join(tmpdir(), 'cc-matrix-pipe');
const BUFFER_SIZE = parseInt(process.env.MATRIX_BUFFER_SIZE || '10000', 10);
const PTY_COMMAND = process.env.MATRIX_PTY_COMMAND || 'claude';
const PTY_ARGS = process.env.MATRIX_PTY_ARGS?.split(' ').filter(Boolean) ?? [];
const PTY_COLS = parseInt(process.env.MATRIX_PTY_COLS || '120', 10);
const PTY_ROWS = parseInt(process.env.MATRIX_PTY_ROWS || '40', 10);

// Multi-session config
const SESSION_COUNT = parseInt(process.env.MATRIX_SESSION_COUNT || '1', 10);

console.log('Matrix Bridge starting...');
console.log(`  PTY source:  ${PTY_SOURCE}`);
console.log(`  Sessions:    ${SESSION_COUNT}`);
if (PTY_SOURCE === 'node-pty') {
  console.log(`  PTY command: ${PTY_COMMAND} ${PTY_ARGS.join(' ')}`);
  console.log(`  PTY size:    ${PTY_COLS}x${PTY_ROWS}`);
} else {
  console.log(`  Pipe path:  ${PTY_PIPE}`);
}
console.log(`  Input:      direct (xterm.js → PTY stdin)`);

// Start WebSocket server
const wsServer = new BridgeWSServer(WS_PORT, BUFFER_SIZE, SESSION_COUNT);

wsServer.onListening(() => {
  console.log(`WebSocket server listening on :${WS_PORT}`);
});

wsServer.startHeartbeat();

// Create PTY sources and session parsers for each session
type PtySource = PtyReader | PtySpawner;

interface Session {
  index: number;
  pty: PtySource;
  parser: SessionParser;
}

const sessions: Session[] = [];

for (let i = 0; i < SESSION_COUNT; i++) {
  // Per-session CWD from env: MATRIX_SESSION_0_CWD, MATRIX_SESSION_1_CWD, ...
  const sessionCwd = process.env[`MATRIX_SESSION_${i}_CWD`] || process.cwd();

  let ptySource: PtySource;

  if (PTY_SOURCE === 'node-pty') {
    ptySource = new PtySpawner({
      command: PTY_COMMAND,
      args: PTY_ARGS,
      cols: PTY_COLS,
      rows: PTY_ROWS,
      cwd: sessionCwd,
    });
  } else {
    // Pipe mode only supports single session
    ptySource = new PtyReader(PTY_SOURCE, PTY_PIPE);
  }

  const parser = new SessionParser();
  parser.setCwd(sessionCwd);

  sessions.push({ index: i, pty: ptySource, parser });

  console.log(`  Session ${i}: cwd=${sessionCwd}`);
}

// Send initial state for all sessions on new client connect
wsServer.onConnect((ws) => {
  for (const session of sessions) {
    wsServer.sendToClient(ws, `session:metrics:${session.index}`, session.parser.getMetrics());
    wsServer.sendToClient(ws, `session:state:${session.index}`, session.parser.getState());
    wsServer.sendToClient(ws, `session:info:${session.index}`, session.parser.getInfo());
  }
});

// Wire up session parser events per session
for (const session of sessions) {
  session.parser.on('metrics', (metrics) => {
    wsServer.broadcast(`session:metrics:${session.index}`, metrics);
  });

  session.parser.on('state', (state) => {
    wsServer.broadcast(`session:state:${session.index}`, state);
  });

  session.parser.on('info', (info) => {
    wsServer.broadcast(`session:info:${session.index}`, info);
  });
}

// Route incoming WS messages to the correct session
// Channel format: terminal:input:0, terminal:resize:0
wsServer.onMessage((msg) => {
  // Parse session index from channel: "terminal:input:0" → index 0
  const parts = msg.channel.split(':');
  const lastPart = parts[parts.length - 1];
  const sessionIndex = parseInt(lastPart, 10);

  const idx = isNaN(sessionIndex) ? 0 : sessionIndex;
  const session = sessions[idx];
  if (!session) return;

  const channelBase = isNaN(sessionIndex)
    ? msg.channel
    : parts.slice(0, -1).join(':');

  if (channelBase === 'terminal:input') {
    const { data } = msg.payload as { data: string };
    if (typeof data === 'string' && data.length <= 10000) {
      session.pty.writeStdin(data);
    }
  }
  if (channelBase === 'terminal:resize' && session.pty instanceof PtySpawner) {
    const { cols, rows } = msg.payload as { cols: number; rows: number };
    session.pty.resize(cols, rows);
  }
});

// Wire up PTY data/error/close events per session
for (const session of sessions) {
  session.pty.on('data', (chunk: Buffer) => {
    wsServer.sendTerminalData(session.index, chunk);
    session.parser.feed(chunk);
  });

  session.pty.on('error', (err: Error) => {
    console.error(`PTY error (session ${session.index}):`, err.message);
  });

  session.pty.on('close', (...args: unknown[]) => {
    if (PTY_SOURCE === 'node-pty') {
      const exitCode = args[0] as number | undefined;
      console.log(`Claude process exited (session ${session.index}, code: ${exitCode ?? 'unknown'})`);
    } else {
      console.log(`PTY source closed (session ${session.index})`);
    }
    wsServer.setPtyConnected(session.index, false);
  });
}

// Start all sessions
Promise.all(
  sessions.map((session) =>
    session.pty.start()
      .then(() => {
        console.log(`PTY source connected (session ${session.index})`);
        wsServer.setPtyConnected(session.index, true);
      })
      .catch((err: Error) => {
        console.error(`PTY source failed to start (session ${session.index}):`, err.message);
        console.log(`Bridge running without PTY source for session ${session.index}`);
      })
  )
);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  for (const session of sessions) {
    session.pty.stop();
  }
  wsServer.close();
  process.exit(0);
});
