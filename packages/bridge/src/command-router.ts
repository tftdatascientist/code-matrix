export interface CommandPayload {
  type: 'text' | 'interrupt' | 'confirm';
  text?: string;
}

export interface StdinWriter {
  writeStdin(data: string): void;
}

const MAX_LENGTH = 10000;
const RATE_LIMIT = 10; // per minute
const RATE_WINDOW = 60_000;

export class CommandRouter {
  private enabled: boolean;
  private writer: StdinWriter;
  private commandTimestamps: number[] = [];

  constructor(enabled: boolean, writer: StdinWriter) {
    this.enabled = enabled;
    this.writer = writer;
  }

  handle(payload: CommandPayload): { ok: boolean; error?: string } {
    if (!this.enabled) {
      console.warn('Command channel disabled. Set MATRIX_COMMAND_ENABLED=true or use MATRIX_PTY_SOURCE=node-pty to enable.');
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
        this.writer.writeStdin(text + '\n');
        console.log(`Command sent: ${text.substring(0, 80)}${text.length > 80 ? '...' : ''}`);
        return { ok: true };
      }
      case 'interrupt':
        this.writer.writeStdin('\x03');
        console.log('Command: interrupt (Ctrl+C)');
        return { ok: true };
      case 'confirm':
        this.writer.writeStdin('\n');
        console.log('Command: confirm (Enter)');
        return { ok: true };
      default:
        return { ok: false, error: `Unknown command type: ${(payload as CommandPayload).type}` };
    }
  }
}
