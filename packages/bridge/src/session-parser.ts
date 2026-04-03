import { EventEmitter } from 'node:events';
import stripAnsi from 'strip-ansi';

export interface SessionMetrics {
  model: string | null;
  contextPercent: number | null;
  sessionPercent: number | null;
  sessionTime: string | null;
  thinkingMode: string | null;
  cost: number | null;
  weeklyPercent: number | null;
  totalTokens: number | null;
  bypassPermissions: boolean;
}

export type CCStatus = 'idle' | 'thinking' | 'writing' | 'executing' | 'error' | 'disconnected';

export interface SessionState {
  status: CCStatus;
  detail?: string;
}

export interface SessionParserEvents {
  metrics: [SessionMetrics];
  state: [SessionState];
}

const PATTERNS = {
  // "Model: Opus 4.6 | Ctx: 24.3% | Session: 5.0% | Session: <1m"
  statusBar: /Model:\s*(.+?)\s*\|\s*Ctx:\s*([\d.]+)%\s*\|\s*Session:\s*([\d.]+)%\s*\|\s*Session:\s*(.+?)(?:\s*\||$)/m,

  // "Thinking: medium | Cost: $1.23 | Weekly: 17.0% | Total: 1234"
  metricsBar: /Thinking:\s*(\w+)\s*\|\s*Cost:\s*\$([\d.]+)\s*\|\s*Weekly:\s*([\d.]+)%\s*\|\s*Total:\s*(\d+)/m,

  // "▸▸ bypass permissions on"
  bypassMode: /▸▸\s*bypass permissions\s*(on|off)/i,

  // State heuristics
  prompt: /[❯>$]\s*$/m,
  thinking: /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]|thinking/i,
  toolUse: /(?:⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏)?\s*\b(Bash|Read|Write|Edit|Glob|Grep|Agent|WebSearch|WebFetch)\b/,
  error: /\bError\b|\berror:/i,
};

// Max chunks to buffer for multi-chunk matching
const BUFFER_SIZE = 5;

export class SessionParser extends EventEmitter<SessionParserEvents> {
  private metrics: SessionMetrics = {
    model: null,
    contextPercent: null,
    sessionPercent: null,
    sessionTime: null,
    thinkingMode: null,
    cost: null,
    weeklyPercent: null,
    totalTokens: null,
    bypassPermissions: false,
  };

  private state: SessionState = { status: 'idle' };
  private chunkBuffer: string[] = [];

  /** Feed raw terminal data (before ANSI stripping — we strip internally) */
  feed(rawData: Buffer | string): void {
    const text = typeof rawData === 'string' ? rawData : rawData.toString('utf-8');
    const stripped = stripAnsi(text);

    // Add to rolling buffer
    this.chunkBuffer.push(stripped);
    if (this.chunkBuffer.length > BUFFER_SIZE) {
      this.chunkBuffer.shift();
    }

    const combined = this.chunkBuffer.join('');

    this.parseMetrics(combined);
    this.parseState(stripped);
  }

  private parseMetrics(text: string): void {
    let changed = false;

    const statusMatch = text.match(PATTERNS.statusBar);
    if (statusMatch) {
      const [, model, ctx, session, time] = statusMatch;
      if (this.metrics.model !== model) { this.metrics.model = model; changed = true; }
      const ctxNum = parseFloat(ctx);
      if (this.metrics.contextPercent !== ctxNum) { this.metrics.contextPercent = ctxNum; changed = true; }
      const sesNum = parseFloat(session);
      if (this.metrics.sessionPercent !== sesNum) { this.metrics.sessionPercent = sesNum; changed = true; }
      const trimTime = time.trim();
      if (this.metrics.sessionTime !== trimTime) { this.metrics.sessionTime = trimTime; changed = true; }
    }

    const metricsMatch = text.match(PATTERNS.metricsBar);
    if (metricsMatch) {
      const [, thinking, cost, weekly, total] = metricsMatch;
      if (this.metrics.thinkingMode !== thinking) { this.metrics.thinkingMode = thinking; changed = true; }
      const costNum = parseFloat(cost);
      if (this.metrics.cost !== costNum) { this.metrics.cost = costNum; changed = true; }
      const weeklyNum = parseFloat(weekly);
      if (this.metrics.weeklyPercent !== weeklyNum) { this.metrics.weeklyPercent = weeklyNum; changed = true; }
      const totalNum = parseInt(total, 10);
      if (this.metrics.totalTokens !== totalNum) { this.metrics.totalTokens = totalNum; changed = true; }
    }

    const bypassMatch = text.match(PATTERNS.bypassMode);
    if (bypassMatch) {
      const bypass = bypassMatch[1].toLowerCase() === 'on';
      if (this.metrics.bypassPermissions !== bypass) { this.metrics.bypassPermissions = bypass; changed = true; }
    }

    if (changed) {
      this.emit('metrics', { ...this.metrics });
    }
  }

  private parseState(text: string): void {
    let newState: SessionState;

    if (PATTERNS.error.test(text)) {
      newState = { status: 'error' };
    } else if (PATTERNS.toolUse.test(text)) {
      const match = text.match(PATTERNS.toolUse);
      newState = { status: 'executing', detail: match?.[1] };
    } else if (PATTERNS.thinking.test(text)) {
      newState = { status: 'thinking' };
    } else if (PATTERNS.prompt.test(text)) {
      newState = { status: 'idle' };
    } else {
      // Default: if we're getting output, CC is writing
      newState = { status: 'writing' };
    }

    if (newState.status !== this.state.status || newState.detail !== this.state.detail) {
      this.state = newState;
      this.emit('state', { ...this.state });
    }
  }

  getMetrics(): SessionMetrics {
    return { ...this.metrics };
  }

  getState(): SessionState {
    return { ...this.state };
  }
}
