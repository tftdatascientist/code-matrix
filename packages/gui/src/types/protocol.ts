/** WebSocket message envelope */
export interface WSMessage<T = unknown> {
  channel: string;
  timestamp: number;
  payload: T;
}

/** terminal:data — raw PTY output */
export interface TerminalDataPayload {
  data: string;       // base64 encoded
  encoding: 'base64';
}

/** terminal:resize — terminal dimensions sync */
export interface TerminalResizePayload {
  cols: number;
  rows: number;
}

/** terminal:replay — reconnection buffer replay */
export interface TerminalReplayPayload {
  data: string;       // base64 encoded
  lines: number;
}

/** command:input — GUI → Bridge (future, disabled by default) */
export interface CommandInputPayload {
  type: 'text' | 'interrupt' | 'confirm';
  text?: string;
}
