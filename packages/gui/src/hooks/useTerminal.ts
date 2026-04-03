import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import type { WSMessage, TerminalDataPayload, TerminalReplayPayload } from '../types/protocol';

const MATRIX_THEME = {
  background: '#050505',
  foreground: '#00FF41',
  cursor: '#00FF41',
  cursorAccent: '#000000',
  selectionBackground: 'rgba(0, 255, 65, 0.3)',
  selectionForeground: '#ffffff',
  black: '#000000',
  red: '#FF3333',
  green: '#00FF41',
  yellow: '#FFB800',
  blue: '#00D4FF',
  magenta: '#cc00ff',
  cyan: '#00D4FF',
  white: '#E0E0E0',
  brightBlack: '#666666',
  brightRed: '#FF3333',
  brightGreen: '#00FF41',
  brightYellow: '#FFB800',
  brightBlue: '#00D4FF',
  brightMagenta: '#cc00ff',
  brightCyan: '#00D4FF',
  brightWhite: '#ffffff',
};

interface UseTerminalOptions {
  subscribe: (channel: string, handler: (msg: WSMessage) => void) => () => void;
  send: (channel: string, payload: unknown) => void;
  sessionIndex?: number;
}

interface UseTerminalReturn {
  containerRef: React.RefCallback<HTMLDivElement>;
}

export function useTerminal({ subscribe, send, sessionIndex = 0 }: UseTerminalOptions): UseTerminalReturn {
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const containerElRef = useRef<HTMLDivElement | null>(null);

  // Create terminal on mount
  useEffect(() => {
    const term = new Terminal({
      theme: MATRIX_THEME,
      fontFamily: '"Fira Code", "Cascadia Code", "Consolas", monospace',
      fontSize: 13,
      scrollback: 10000,
      cursorBlink: true,
      cursorStyle: 'block',
      allowTransparency: true,
      convertEol: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);

    termRef.current = term;
    fitRef.current = fit;

    // Open into container if already set
    if (containerElRef.current) {
      term.open(containerElRef.current);
      // Try WebGL addon for performance
      try {
        const webgl = new WebglAddon();
        webgl.onContextLoss(() => webgl.dispose());
        term.loadAddon(webgl);
      } catch {
        // WebGL not supported, software renderer is fine
      }
      fit.fit();
    }

    return () => {
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, []);

  // Subscribe to per-session terminal data channels
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    unsubs.push(subscribe(`terminal:data:${sessionIndex}`, (msg) => {
      const payload = msg.payload as TerminalDataPayload;
      const bytes = Uint8Array.from(atob(payload.data), c => c.charCodeAt(0));
      termRef.current?.write(bytes);
    }));

    unsubs.push(subscribe(`terminal:replay:${sessionIndex}`, (msg) => {
      const payload = msg.payload as TerminalReplayPayload;
      const bytes = Uint8Array.from(atob(payload.data), c => c.charCodeAt(0));
      termRef.current?.write(bytes);
    }));

    return () => { unsubs.forEach(u => u()); };
  }, [subscribe, sessionIndex]);

  // Forward user keystrokes to per-session PTY stdin
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;

    const disposable = term.onData((data) => {
      send(`terminal:input:${sessionIndex}`, { data });
    });

    return () => disposable.dispose();
  }, [send, sessionIndex]);

  // Handle resize — send per-session resize
  useEffect(() => {
    const handleResize = () => {
      if (fitRef.current && containerElRef.current) {
        fitRef.current.fit();
        const term = termRef.current;
        if (term) {
          send(`terminal:resize:${sessionIndex}`, { cols: term.cols, rows: term.rows });
        }
      }
    };

    window.addEventListener('resize', handleResize);

    // ResizeObserver for container size changes
    let observer: ResizeObserver | null = null;
    if (containerElRef.current) {
      observer = new ResizeObserver(handleResize);
      observer.observe(containerElRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      observer?.disconnect();
    };
  }, [send, sessionIndex]);

  // Ref callback — opens terminal when container DOM element appears
  const containerRef = useCallback((el: HTMLDivElement | null) => {
    containerElRef.current = el;
    if (el && termRef.current && !termRef.current.element) {
      termRef.current.open(el);
      try {
        const webgl = new WebglAddon();
        webgl.onContextLoss(() => webgl.dispose());
        termRef.current.loadAddon(webgl);
      } catch { /* fallback to canvas */ }
      fitRef.current?.fit();
    }
  }, []);

  return { containerRef };
}
