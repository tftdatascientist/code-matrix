import { EventEmitter } from 'node:events';
import * as pty from 'node-pty';
import { platform } from 'node:os';

export interface PtySpawnerEvents {
  data: [Buffer];
  error: [Error];
  close: [number | undefined];
}

export interface PtySpawnerOptions {
  command?: string;
  args?: string[];
  cols?: number;
  rows?: number;
  cwd?: string;
}

/**
 * Spawns a process in a real PTY using node-pty.
 * Provides bidirectional stdin/stdout access.
 * Same EventEmitter interface as PtyReader for drop-in compatibility.
 */
export class PtySpawner extends EventEmitter<PtySpawnerEvents> {
  private ptyProcess: pty.IPty | null = null;
  private _connected = false;

  constructor(private options: PtySpawnerOptions = {}) {
    super();
  }

  async start(): Promise<void> {
    const command = this.options.command ?? 'claude';
    const args = this.options.args ?? [];
    const cols = this.options.cols ?? 120;
    const rows = this.options.rows ?? 40;
    const cwd = this.options.cwd ?? process.cwd();

    try {
      this.ptyProcess = pty.spawn(command, args, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env: process.env as Record<string, string>,
      });

      this._connected = true;

      this.ptyProcess.onData((data: string) => {
        this.emit('data', Buffer.from(data, 'utf-8'));
      });

      this.ptyProcess.onExit(({ exitCode }) => {
        this._connected = false;
        this.emit('close', exitCode);
      });

      console.log(`PTY spawned: ${command} ${args.join(' ')} (PID: ${this.ptyProcess.pid})`);
    } catch (err) {
      this._connected = false;
      const error = err instanceof Error ? err : new Error(String(err));
      this.emit('error', error);
      throw error;
    }
  }

  writeStdin(data: string): void {
    if (!this.ptyProcess || !this._connected) {
      console.warn('writeStdin: PTY not connected');
      return;
    }
    this.ptyProcess.write(data);
  }

  resize(cols: number, rows: number): void {
    if (!this.ptyProcess || !this._connected) return;
    this.ptyProcess.resize(cols, rows);
  }

  async stop(): Promise<void> {
    if (this.ptyProcess) {
      this._connected = false;
      this.ptyProcess.kill();
      this.ptyProcess = null;
    }
    this.emit('close', undefined);
  }

  get connected(): boolean {
    return this._connected;
  }

  get pid(): number | undefined {
    return this.ptyProcess?.pid;
  }
}
