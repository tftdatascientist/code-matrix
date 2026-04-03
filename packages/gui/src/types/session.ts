/** session:metrics — CC session metrics extracted from terminal output */
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

/** session:state — CC activity state */
export interface SessionState {
  status: 'idle' | 'thinking' | 'writing' | 'executing' | 'error' | 'disconnected';
  detail?: string;
}

/** system:health — bridge health check */
export interface SystemHealth {
  uptime: number;
  ptyConnected: boolean;
  wsClients: number;
  bufferSize: number;
  latency: number;
}
