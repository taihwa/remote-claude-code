import { useEffect, useRef, useCallback } from 'react';
import type { ClientMessage, ServerMessage } from '@remote-claude/shared';
import { useChatStore } from '../stores/chatStore';

const MAX_RECONNECT_DELAY = 30000;
const INITIAL_RECONNECT_DELAY = 1000;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY);
  const mountedRef = useRef(false);

  const token = useChatStore((s) => s.token);
  const setConnected = useChatStore((s) => s.setConnected);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const setSession = useChatStore((s) => s.setSession);
  const addMessage = useChatStore((s) => s.addMessage);
  const setCost = useChatStore((s) => s.setCost);
  const setProjects = useChatStore((s) => s.setProjects);
  const saveCurrentSession = useChatStore((s) => s.saveCurrentSession);
  const setPendingPermission = useChatStore((s) => s.setPendingPermission);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data) as ServerMessage;
      } catch {
        console.error('Failed to parse server message:', event.data);
        return;
      }

      switch (msg.type) {
        case 'session_created': {
          setSession(msg.sessionId);
          break;
        }

        case 'stream_event': {
          const data = msg.data;

          if (data.type === 'system' && data.subtype === 'init') {
            setSession(data.session_id);
            setStreaming(true);
          } else if (data.type === 'assistant') {
            const assistantMsg = data.message;
            const chatMessage = {
              id: crypto.randomUUID(),
              role: 'assistant' as const,
              content: assistantMsg.content,
              timestamp: Date.now(),
              model: assistantMsg.model,
            };
            addMessage(chatMessage);
          } else if (data.type === 'result') {
            setCost(data.total_cost_usd, data.duration_ms);
            setStreaming(false);

            if (data.subtype === 'error') {
              addMessage({
                id: crypto.randomUUID(),
                role: 'assistant',
                content: [
                  {
                    type: 'text',
                    text: `Error: ${data.error}`,
                  },
                ],
                timestamp: Date.now(),
              });
            }
            saveCurrentSession();
          }
          break;
        }

        case 'turn_complete': {
          setStreaming(false);
          saveCurrentSession();
          break;
        }

        case 'error': {
          console.error('Server error:', msg.message);
          setStreaming(false);
          addMessage({
            id: crypto.randomUUID(),
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: `Server error: ${msg.message}`,
              },
            ],
            timestamp: Date.now(),
          });
          break;
        }

        case 'projects': {
          setProjects(msg.projects);
          break;
        }

        case 'permission_request': {
          setPendingPermission({
            id: msg.id,
            toolName: msg.toolName,
            toolInput: msg.toolInput,
          });
          break;
        }
      }
    },
    [setConnected, setStreaming, setSession, addMessage, setCost, setProjects, saveCurrentSession, setPendingPermission],
  );

  const connect = useCallback(() => {
    if (!token) return;

    // Clean up existing connection
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Only update state if this is still the current WebSocket
      if (wsRef.current !== ws) return;
      console.log('[WS] Connected');
      setConnected(true);
      reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
    };

    ws.onmessage = (event) => {
      if (wsRef.current !== ws) return;
      handleMessage(event);
    };

    ws.onclose = (event) => {
      // Only handle if this is still the current WebSocket
      if (wsRef.current !== ws) return;

      console.log(`[WS] Closed (code: ${event.code}, reason: ${event.reason || 'none'})`);
      setConnected(false);
      wsRef.current = null;

      // Auto-reconnect with exponential backoff (only if still mounted)
      if (mountedRef.current && token) {
        const delay = reconnectDelayRef.current;
        console.log(`[WS] Reconnecting in ${delay}ms...`);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectDelayRef.current = Math.min(
            delay * 2,
            MAX_RECONNECT_DELAY,
          );
          connect();
        }, delay);
      }
    };

    ws.onerror = () => {
      if (wsRef.current !== ws) return;
      console.error('[WS] Connection error (server may not be running on port 3456)');
    };
  }, [token, handleMessage, setConnected]);

  const send = useCallback(
    (message: ClientMessage) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(message));
      } else {
        console.warn('WebSocket is not connected');
      }
    },
    [],
  );

  useEffect(() => {
    mountedRef.current = true;

    if (token) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
    };
  }, [token, connect, setConnected]);

  const isConnected = useChatStore((s) => s.isConnected);

  return { send, isConnected };
}
