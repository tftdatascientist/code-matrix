import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import { open, stat } from 'node:fs/promises';

export interface PtyReaderEvents {
  data: [Buffer];
  error: [Error];
  close: [];
}

/**
 * Reads raw PTY output from a file/pipe source.
 *
 * Supports two modes:
 * - 'pipe': Watches a file path and tails new data as it's appended (works cross-platform)
 * - 'stdin': Reads from process.stdin (pipe CC output directly to bridge)
 */
export class PtyReader extends EventEmitter<PtyReaderEvents> {
  private source: string;
  private pipePath: string;
  private watcher: fs.FSWatcher | null = null;
  private fileHandle: fs.promises.FileHandle | null = null;
  private readOffset = 0;
  private reading = false;
  private closed = false;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  constructor(source: string, pipePath: string) {
    super();
    this.source = source;
    this.pipePath = pipePath;
  }

  async start(): Promise<void> {
    if (this.source === 'stdin') {
      this.startStdin();
    } else {
      await this.startPipe();
    }
  }

  private startStdin(): void {
    process.stdin.on('data', (chunk: Buffer) => {
      this.emit('data', chunk);
    });

    process.stdin.on('end', () => {
      this.emit('close');
    });

    process.stdin.on('error', (err: Error) => {
      this.emit('error', err);
    });

    // Keep stdin in raw mode if possible
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
  }

  private async startPipe(): Promise<void> {
    // Wait for the pipe/file to exist
    await this.waitForFile();

    this.fileHandle = await open(this.pipePath, 'r');

    // Get initial file size to start reading from current position
    const stats = await stat(this.pipePath);
    this.readOffset = stats.size;

    // Use both fs.watch (for instant notification) and polling (as fallback)
    try {
      this.watcher = fs.watch(this.pipePath, () => {
        this.readNewData();
      });

      this.watcher.on('error', () => {
        // Watcher failed, rely on polling only
        this.watcher = null;
      });
    } catch {
      // fs.watch not supported, polling only
    }

    // Poll every 100ms as fallback (fs.watch is unreliable on some platforms)
    this.pollInterval = setInterval(() => {
      this.readNewData();
    }, 100);
  }

  private async waitForFile(): Promise<void> {
    const maxWait = 60_000;
    const interval = 500;
    let waited = 0;

    while (waited < maxWait) {
      try {
        await stat(this.pipePath);
        return;
      } catch {
        waited += interval;
        await new Promise((r) => setTimeout(r, interval));
      }
    }

    throw new Error(`Timeout waiting for PTY source file: ${this.pipePath}`);
  }

  private async readNewData(): Promise<void> {
    if (this.reading || this.closed || !this.fileHandle) return;
    this.reading = true;

    try {
      const stats = await stat(this.pipePath);
      const fileSize = stats.size;

      if (fileSize > this.readOffset) {
        const bytesToRead = fileSize - this.readOffset;
        const buffer = Buffer.alloc(bytesToRead);
        const { bytesRead } = await this.fileHandle.read(buffer, 0, bytesToRead, this.readOffset);

        if (bytesRead > 0) {
          this.readOffset += bytesRead;
          this.emit('data', buffer.subarray(0, bytesRead));
        }
      }
    } catch (err) {
      this.emit('error', err instanceof Error ? err : new Error(String(err)));
    } finally {
      this.reading = false;
    }
  }

  async stop(): Promise<void> {
    this.closed = true;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    if (this.fileHandle) {
      await this.fileHandle.close();
      this.fileHandle = null;
    }

    this.emit('close');
  }

  get connected(): boolean {
    return !this.closed && (this.source === 'stdin' || this.fileHandle !== null);
  }

  /**
   * Write data to PTY stdin (for future command input).
   * Only works in stdin mode — pipe mode is read-only.
   * In a future node-pty or VS Code Extension setup, this would write to the PTY's stdin.
   */
  writeStdin(data: string): void {
    if (this.source === 'stdin') {
      // In stdin mode, we can't write back — stdin is one-directional
      console.warn('writeStdin: stdin mode is read-only in current setup');
      return;
    }
    // Placeholder for future PTY write implementations:
    // - node-pty: pty.write(data)
    // - VS Code Extension: Terminal.sendText(data)
    // - tmux: exec(`tmux send-keys -t session "${data}"`)
    console.warn('writeStdin: PTY write not yet implemented for source:', this.source);
  }
}
