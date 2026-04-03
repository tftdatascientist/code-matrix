import type { PtyReader } from './pty-reader.js';

export interface CommandPayload {
  type: 'text' | 'interrupt' | 'confirm';
  text?: string;
}

const MAX_LENGTH = 10000;
const RATE_LIMIT = 10; // per minute
const RATE_WINDOW = 60_000;

export class CommandRouter {
  private enabled: boolean;
  private ptyReader: PtyReader;
  private commandTimestamps: number[] = [];

  constructor(enabled: boolean, ptyReader: PtyReader) {
    this.enabled = enabled;
    this.ptyReader = ptyReader;
  }

  handle(payload: CommandPayload): { ok: boolean; error?: string } {
    if (!this.enabled) {
      console.warn('Command channel disabled. Set MATRIX_COMMAND_ENABLED=true to enable.');
      return { ok: false, error: 'Command channel disabled' };
    }

    // Rate limiting
    const now = Date.now();
    this.commandTimestamps = this.commandTimestamps.filter(t => now - t < RATE_WINDOW);
    if (this.commandTimestamps.length >= RATE_LIMIT) {
      console.warn('Command rate limit exceeded');
      return { ok: false, error: 'Rate limit exceeded' };
    }
    this.commandTimestamps.push(now);

    switch (payload.type) {
      case 'text': {
        const text = payload.text ?? '';
        if (text.length > MAX_LENGTH) {
          return { ok: false, error: `Text exceeds max length (${MAX_LENGTH})` };
        }
        // Write to PTY stdin (text + newline)
        this.ptyReader.writeStdin(text + '\n');
        console.log(`Command sent: ${text.substring(0, 80)}${text.length > 80 ? '...' : ''}`);
        return { ok: true };
      }
      case 'interrupt':
        // Send Ctrl+C (ETX character)
        this.ptyReader.writeStdin('\x03');
        console.log('Command: interrupt (Ctrl+C)');
        return { ok: true };
      case 'confirm':
        // Send Enter
        this.ptyReader.writeStdin('\n');
        console.log('Command: confirm (Enter)');
        return { ok: true };
      default:
        return { ok: false, error: `Unknown command type: ${payload.type}` };
    }
  }
}
