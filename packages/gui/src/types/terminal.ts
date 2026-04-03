/** Connection status of the GUI to the bridge */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

/** Terminal dimensions */
export interface TerminalDimensions {
  cols: number;
  rows: number;
}
