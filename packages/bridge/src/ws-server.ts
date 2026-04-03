import { WebSocketServer, WebSocket } from 'ws';

export interface WSMessageEnvelope {
  channel: string;
  timestamp: number;
  payload: unknown;
}

interface ReplayBuffer {
  chunks: string[]; // binary-encoded terminal data chunks
  maxSize: number;
}

export class BridgeWSServer {
  private wss: WebSocketServer;
  private buffers: ReplayBuffer[] = [];
  private bufferMaxSize: number;
  private sessionCount: number;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private startTime = Date.now();
  private _ptyConnected: boolean[] = [];
  private connectHandlers: Array<(ws: WebSocket) => void> = [];
  private messageHandlers: Array<(msg: WSMessageEnvelope) => void> = [];

  constructor(port: number, bufferSize: number, sessionCount = 1) {
    this.wss = new WebSocketServer({ port });
    this.bufferMaxSize = bufferSize;
    this.sessionCount = sessionCount;

    // Initialize per-session replay buffers and PTY status
    for (let i = 0; i < sessionCount; i++) {
      this.buffers.push({ chunks: [], maxSize: bufferSize });
      this._ptyConnected.push(false);
    }

    this.wss.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\n[ERROR] Port ${port} is already in use.`);
        console.error(`  Another bridge instance may be running.`);
        console.error(`  Kill it with: taskkill /F /PID $(netstat -ano | findstr :${port} | head -1 | awk '{print $NF}')`);
        console.error(`  Or restart with the "m" command which auto-cleans old processes.\n`);
        process.exit(1);
      }
      throw err;
    });

    this.wss.on('connection', (ws) => {
      console.log(`GUI client connected (total: ${this.wss.clients.size})`);

      // Send config (session count) so GUI knows how many terminals to render
      this.sendTo(ws, 'system:config', { sessionCount: this.sessionCount });

      // Send current health immediately
      this.sendTo(ws, 'system:health', this.getHealth());

      // Replay per-session buffers to new client
      for (let i = 0; i < this.sessionCount; i++) {
        const buf = this.buffers[i];
        if (buf.chunks.length > 0) {
          const combined = buf.chunks.join('');
          this.sendTo(ws, `terminal:replay:${i}`, {
            data: Buffer.from(combined, 'binary').toString('base64'),
            lines: buf.chunks.length,
          });
        }
      }

      // Let external handlers send initial state to new client
      for (const handler of this.connectHandlers) {
        handler(ws);
      }

      ws.on('message', (raw) => {
        try {
          const msg: WSMessageEnvelope = JSON.parse(raw.toString());
          for (const handler of this.messageHandlers) {
            handler(msg);
          }
        } catch { /* ignore malformed */ }
      });

      ws.on('close', () => {
        console.log(`GUI client disconnected (total: ${this.wss.clients.size})`);
      });
    });
  }

  /** Register a handler called when a new client connects */
  onConnect(handler: (ws: WebSocket) => void): void {
    this.connectHandlers.push(handler);
  }

  /** Register a handler called when a client sends a message */
  onMessage(handler: (msg: WSMessageEnvelope) => void): void {
    this.messageHandlers.push(handler);
  }

  /** Send a message to a specific client */
  sendToClient(ws: WebSocket, channel: string, payload: unknown): void {
    this.sendTo(ws, channel, payload);
  }

  onListening(callback: () => void): void {
    this.wss.on('listening', callback);
  }

  /** Start heartbeat broadcast every 1s */
  startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.broadcast('system:health', this.getHealth());
    }, 1000);
  }

  /** Broadcast terminal data for a specific session to all connected clients */
  sendTerminalData(sessionIndex: number, data: Buffer): void {
    const base64 = data.toString('base64');

    // Add to per-session replay buffer
    const buf = this.buffers[sessionIndex];
    if (buf) {
      buf.chunks.push(data.toString('binary'));
      if (buf.chunks.length > buf.maxSize) {
        buf.chunks.shift();
      }
    }

    this.broadcast(`terminal:data:${sessionIndex}`, {
      data: base64,
      encoding: 'base64',
    });
  }

  /** Broadcast a message to all connected clients */
  broadcast(channel: string, payload: unknown): void {
    const msg = JSON.stringify({
      channel,
      timestamp: Date.now(),
      payload,
    } satisfies WSMessageEnvelope);

    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  setPtyConnected(sessionIndex: number, value: boolean): void {
    this._ptyConnected[sessionIndex] = value;
  }

  private sendTo(ws: WebSocket, channel: string, payload: unknown): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        channel,
        timestamp: Date.now(),
        payload,
      } satisfies WSMessageEnvelope));
    }
  }

  private getHealth() {
    return {
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      ptyConnected: this._ptyConnected.every(Boolean),
      ptySessions: this._ptyConnected,
      wsClients: this.wss.clients.size,
      bufferSize: this.buffers.reduce((sum, b) => sum + b.chunks.length, 0),
      latency: 0,
    };
  }

  close(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    this.wss.close();
  }
}
