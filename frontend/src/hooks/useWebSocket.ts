import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseWebSocketOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useWebSocket(options?: UseWebSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = io({
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      options?.onConnect?.();
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      options?.onDisconnect?.();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const subscribe = useCallback((event: string, callback: (data: unknown) => void) => {
    socketRef.current?.on(event, callback);
    return () => {
      socketRef.current?.off(event, callback);
    };
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    subscribe,
    emit,
  };
}

export function useLogStream() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const { subscribe, emit, isConnected } = useWebSocket();

  useEffect(() => {
    if (!isConnected) return;

    emit('subscribe:logs');
    setIsStreaming(true);

    const unsubInitial = subscribe('logs:initial', (data) => {
      const { lines } = data as { lines: string[] };
      setLogs(lines);
    });

    const unsubNew = subscribe('logs:new', (data) => {
      const { lines } = data as { lines: string[] };
      setLogs((prev) => [...prev, ...lines]);
    });

    const unsubRotated = subscribe('logs:rotated', () => {
      setLogs([]);
    });

    return () => {
      emit('unsubscribe:logs');
      setIsStreaming(false);
      unsubInitial();
      unsubNew();
      unsubRotated();
    };
  }, [isConnected, subscribe, emit]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return {
    logs,
    isStreaming,
    isConnected,
    clearLogs,
  };
}
