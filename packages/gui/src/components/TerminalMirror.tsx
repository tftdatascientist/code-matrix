import { useTerminal } from '../hooks/useTerminal';
import type { WSMessage } from '../types/protocol';
import '@xterm/xterm/css/xterm.css';

interface TerminalMirrorProps {
  subscribe: (channel: string, handler: (msg: WSMessage) => void) => () => void;
  send: (channel: string, payload: unknown) => void;
  sessionIndex?: number;
}

export function TerminalMirror({ subscribe, send, sessionIndex = 0 }: TerminalMirrorProps) {
  const { containerRef } = useTerminal({ subscribe, send, sessionIndex });

  return (
    <div className="terminal-mirror">
      <div className="terminal-mirror__container" ref={containerRef} />
    </div>
  );
}
