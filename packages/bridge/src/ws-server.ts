import { WebSocketServer, WebSocket } from 'ws';

export interface WSMessageEnvelope {
  channel: string;
  timestamp: number;
  payload: unknown;
}

interface ReplayBuffer {
  chunks: string[]; // base64-encoded terminal data chunks
  maxSize: number;
}

export class BridgeWSServer {
  private wss: WebSocketServer;
  private buffer: ReplayBuffer;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private startTime = Date.now();
  private _ptyConnected = false;
  private connectHandlers: Array<(ws: WebSocket) => void> = [];
  private messageHandlers: Array<(msg: WSMessageEnvelope) => void> = [];

  constructor(port: number, bufferSize: number) {
    this.wss = new WebSocketServer({ port });
    this.buffer = { chunks: [], maxSize: bufferSize };

    this.wss.on('connection', (ws) => {
      console.log(`GUI client connected (total: ${this.wss.clients.size})`);

      // Send current health immediately
      this.sendTo(ws, 'system:health', this.getHealth());

      // Replay buffer to new client
      if (this.buffer.chunks.length > 0) {
        const combined = this.buffer.chunks.join('');
        this.sendTo(ws, 'terminal:replay', {
          data: Buffer.from(combined, 'binary').toString('base64'),
          lines: this.buffer.chunks.length,
        });
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

  /** Broadcast terminal data to all connected clients */
  sendTerminalData(data: Buffer): void {
    const base64 = data.toString('base64');

    // Add to replay buffer
    this.buffer.chunks.push(data.toString('binary'));
    if (this.buffer.chunks.length > this.buffer.maxSize) {
      this.buffer.chunks.shift();
    }

    this.broadcast('terminal:data', {
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

  set ptyConnected(value: boolean) {
    this._ptyConnected = value;
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
      ptyConnected: this._ptyConnected,
      wsClients: this.wss.clients.size,
      bufferSize: this.buffer.chunks.length,
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
