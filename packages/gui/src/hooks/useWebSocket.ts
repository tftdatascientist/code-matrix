import { useEffect, useRef, useCallback, useState } from 'react';
import type { WSMessage } from '../types/protocol';
import type { ConnectionStatus } from '../types/terminal';

type MessageHandler = (msg: WSMessage) => void;

interface UseWebSocketReturn {
  status: ConnectionStatus;
  subscribe: (channel: string, handler: MessageHandler) => () => void;
  send: (channel: string, payload: unknown) => void;
}

const WS_URL = 'ws://localhost:7999';
const RECONNECT_BASE = 2000;
const RECONNECT_MAX = 30000;

export function useWebSocket(): UseWebSocketReturn {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Map<string, Set<MessageHandler>>>(new Map());
  const reconnectDelay = useRef(RECONNECT_BASE);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const mountedRef = useRef(true);

  const dispatch = useCallback((msg: WSMessage) => {
    const handlers = listenersRef.current.get(msg.channel);
    if (handlers) {
      for (const h of handlers) h(msg);
    }
    // Also dispatch to wildcard listeners
    const wildcards = listenersRef.current.get('*');
    if (wildcards) {
      for (const h of wildcards) h(msg);
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    setStatus('connecting');

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return; }
      setStatus('connected');
      reconnectDelay.current = RECONNECT_BASE;
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data as string);
        dispatch(msg);
      } catch { /* ignore malformed messages */ }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setStatus('disconnected');
      // Exponential backoff reconnect
      reconnectTimer.current = setTimeout(() => {
        reconnectDelay.current = Math.min(reconnectDelay.current * 1.5, RECONNECT_MAX);
        connect();
      }, reconnectDelay.current);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [dispatch]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const subscribe = useCallback((channel: string, handler: MessageHandler) => {
    if (!listenersRef.current.has(channel)) {
      listenersRef.current.set(channel, new Set());
    }
    listenersRef.current.get(channel)!.add(handler);

    return () => {
      listenersRef.current.get(channel)?.delete(handler);
    };
  }, []);

  const send = useCallback((channel: string, payload: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        channel,
        timestamp: Date.now(),
        payload,
      }));
    }
  }, []);

  return { status, subscribe, send };
}
