import { useEffect, useState } from 'react';
import type { WSMessage } from '../types/protocol';
import type { SessionInfo } from '../types/session';

const DEFAULT_INFO: SessionInfo = {
  cwd: '',
  filesRead: [],
  memoryItems: [],
  activeMcps: [],
};

interface UseSessionInfoOptions {
  subscribe: (channel: string, handler: (msg: WSMessage) => void) => () => void;
  sessionIndex?: number;
}

export function useSessionInfo({ subscribe, sessionIndex = 0 }: UseSessionInfoOptions): SessionInfo {
  const [info, setInfo] = useState<SessionInfo>(DEFAULT_INFO);

  useEffect(() => {
    return subscribe(`session:info:${sessionIndex}`, (msg) => {
      setInfo(msg.payload as SessionInfo);
    });
  }, [subscribe, sessionIndex]);

  return info;
}
