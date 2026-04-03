import { useTerminal } from '../hooks/useTerminal';
import type { WSMessage } from '../types/protocol';
import '@xterm/xterm/css/xterm.css';

interface TerminalMirrorProps {
  subscribe: (channel: string, handler: (msg: WSMessage) => void) => () => void;
  send: (channel: string, payload: unknown) => void;
}

export function TerminalMirror({ subscribe, send }: TerminalMirrorProps) {
  const { containerRef } = useTerminal({ subscribe, send });

  return (
    <div className="terminal-mirror">
      <div className="terminal-mirror__container" ref={containerRef} />
    </div>
  );
}
