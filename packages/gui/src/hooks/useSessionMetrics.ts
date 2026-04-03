import { useEffect, useState } from 'react';
import type { WSMessage } from '../types/protocol';
import type { SessionMetrics, SessionState } from '../types/session';

const DEFAULT_METRICS: SessionMetrics = {
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

const DEFAULT_STATE: SessionState = {
  status: 'disconnected',
};

interface UseSessionMetricsOptions {
  subscribe: (channel: string, handler: (msg: WSMessage) => void) => () => void;
}

interface UseSessionMetricsReturn {
  metrics: SessionMetrics;
  state: SessionState;
}

export function useSessionMetrics({ subscribe }: UseSessionMetricsOptions): UseSessionMetricsReturn {
  const [metrics, setMetrics] = useState<SessionMetrics>(DEFAULT_METRICS);
  const [state, setState] = useState<SessionState>(DEFAULT_STATE);

  useEffect(() => {
    const unsubs = [
      subscribe('session:metrics', (msg) => {
        setMetrics(msg.payload as SessionMetrics);
      }),
      subscribe('session:state', (msg) => {
        setState(msg.payload as SessionState);
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, [subscribe]);

  return { metrics, state };
}
