import { useEffect, useState, useRef, useCallback } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useSessionMetrics } from './hooks/useSessionMetrics';
import { useSessionInfo } from './hooks/useSessionInfo';
import { TerminalMirror } from './components/TerminalMirror';
import { SessionInfoPanel } from './components/SessionInfoPanel';
import { MatrixRain } from './components/MatrixRain';
import { CRTOverlay } from './components/CRTOverlay';
import type { WSMessage } from './types/protocol';
import type { SystemHealth } from './types/session';

function useRainParams(ccStatus: string, wsStatus: string) {
  if (wsStatus !== 'connected') {
    return { speed: 0.3, density: 0.4, opacity: 0.1 };
  }
  switch (ccStatus) {
    case 'thinking':
      return { speed: 1.3, density: 0.8, opacity: 0.22 };
    case 'executing':
      return { speed: 1.1, density: 0.7, opacity: 0.2 };
    default:
      return { speed: 1.0, density: 0.7, opacity: 0.18 };
  }
}

export default function App() {
  const { status, subscribe, send } = useWebSocket();
  const [sessionCount, setSessionCount] = useState(1);
  const { state } = useSessionMetrics({ subscribe, sessionIndex: 0 });
  const infoLeft = useSessionInfo({ subscribe, sessionIndex: 0 });
  const infoRight = useSessionInfo({ subscribe, sessionIndex: 1 });
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const prevStateRef = useRef(state.status);

  // Read session count from bridge config
  useEffect(() => {
    return subscribe('system:config', (msg: WSMessage) => {
      const config = msg.payload as { sessionCount: number };
      if (config.sessionCount > 0) {
        setSessionCount(config.sessionCount);
      }
    });
  }, [subscribe]);

  useEffect(() => {
    return subscribe('system:health', (msg: WSMessage) => {
      setHealth(msg.payload as SystemHealth);
    });
  }, [subscribe]);

  // Flash effect on executing state change
  const triggerFlash = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    el.classList.add('flash-effect');
    const timer = setTimeout(() => el.classList.remove('flash-effect'), 250);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (state.status === 'executing' && prevStateRef.current !== 'executing') {
      triggerFlash();
    }
    prevStateRef.current = state.status;
  }, [state.status, triggerFlash]);

  const rain = useRainParams(state.status, status);
  const isMulti = sessionCount >= 2;

  return (
    <>
      {/* Background rain layer */}
      <MatrixRain
        speedMultiplier={rain.speed}
        density={rain.density}
        opacity={rain.opacity}
      />

      <div className="matrix-root" ref={rootRef}>
        {/* Frameless window drag handle */}
        <div className="title-bar">
          <span className="title-bar__title">MATRIX GUI</span>
        </div>

        {/* Main content area */}
        <div className="matrix-main">
          {isMulti ? (
            <>
              <SessionInfoPanel info={infoLeft} side="left" />
              <TerminalMirror subscribe={subscribe} send={send} sessionIndex={0} />
              <TerminalMirror subscribe={subscribe} send={send} sessionIndex={1} />
              <SessionInfoPanel info={infoRight} side="right" />
            </>
          ) : (
            <>
              <SessionInfoPanel info={infoLeft} side="left" />
              <TerminalMirror subscribe={subscribe} send={send} sessionIndex={0} />
            </>
          )}
        </div>

        {/* Status bar */}
        <div className="status-bar">
          <span className={`status-bar__dot status-bar__dot--${status}`} />
          <span className="status-bar__label">
            {status === 'connecting' && 'CONNECTING...'}
            {status === 'connected' && 'CONNECTED'}
            {status === 'disconnected' && 'DISCONNECTED'}
          </span>
          <span className="status-bar__sep">|</span>
          <span className="status-bar__info">ws://localhost:7999</span>
          {health && (
            <>
              <span className="status-bar__sep">|</span>
              <span className="status-bar__info">
                PTY: {health.ptyConnected ? 'ON' : 'OFF'}
              </span>
              <span className="status-bar__sep">|</span>
              <span className="status-bar__info">
                sessions: {sessionCount}
              </span>
              <span className="status-bar__sep">|</span>
              <span className="status-bar__info">
                clients: {health.wsClients}
              </span>
            </>
          )}
        </div>

        {/* Disconnect overlay */}
        {status !== 'connected' && (
          <div className="disconnect-overlay">
            <div className="disconnect-overlay__content">
              <p className="disconnect-overlay__text">
                {status === 'connecting' ? 'Connecting...' : 'Reconnecting...'}
              </p>
              <div className="disconnect-overlay__bar">
                <div className="disconnect-overlay__bar-fill" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CRT post-processing on top of everything */}
      <CRTOverlay />
    </>
  );
}
