/**
 * WebSocket hook for real-time updates from the Ralph dashboard server.
 * Handles connection, subscription management, and automatic reconnection.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useProjectStore } from '@/stores/projectStore';

// ============================================================================
// Types (matching server types from websocketHub.ts)
// ============================================================================

/**
 * Message types that clients can send
 */
interface SubscribeMessage {
  type: 'subscribe';
  projectIds: string[];
}

interface UnsubscribeMessage {
  type: 'unsubscribe';
  projectIds: string[];
}

interface PingMessage {
  type: 'ping';
}

type ClientMessage = SubscribeMessage | UnsubscribeMessage | PingMessage;

/**
 * Message types that the server sends
 */
interface FileChangeMessage {
  type: 'file:change';
  projectId: string;
  fileType: string;
  path: string;
  event: 'add' | 'change' | 'unlink';
}

interface PongMessage {
  type: 'pong';
}

interface ErrorMessage {
  type: 'error';
  message: string;
}

interface SubscribedMessage {
  type: 'subscribed';
  projectIds: string[];
}

interface UnsubscribedMessage {
  type: 'unsubscribed';
  projectIds: string[];
}

type ServerMessage =
  | FileChangeMessage
  | PongMessage
  | ErrorMessage
  | SubscribedMessage
  | UnsubscribedMessage;

// ============================================================================
// Constants
// ============================================================================

/** Base reconnection delay in milliseconds */
const BASE_RECONNECT_DELAY = 1000;

/** Maximum reconnection delay (cap for exponential backoff) */
const MAX_RECONNECT_DELAY = 30000;

/** Ping interval to keep connection alive */
const PING_INTERVAL = 25000;

// ============================================================================
// Hook
// ============================================================================

export interface UseWebSocketOptions {
  /** WebSocket server URL. Defaults to ws://localhost:4242 */
  url?: string;
  /** Whether to enable the connection. Defaults to true */
  enabled?: boolean;
  /** Callback when a file change is received */
  onFileChange?: (message: FileChangeMessage) => void;
}

export interface UseWebSocketReturn {
  /** Send a subscribe message for project IDs */
  subscribe: (projectIds: string[]) => void;
  /** Send an unsubscribe message for project IDs */
  unsubscribe: (projectIds: string[]) => void;
  /** Current connection status */
  isConnected: boolean;
}

/**
 * Hook to manage WebSocket connection to the Ralph dashboard server.
 *
 * Features:
 * - Automatic connection on mount
 * - Auto-subscribe to selected project
 * - Reconnection with exponential backoff
 * - Ping/pong heartbeat to detect stale connections
 *
 * Usage:
 * ```tsx
 * const { subscribe, unsubscribe, isConnected } = useWebSocket({
 *   onFileChange: (msg) => console.log('File changed:', msg),
 * });
 * ```
 */
export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    url = getWebSocketUrl(),
    enabled = true,
    onFileChange,
  } = options;

  // Store actions
  const setConnectionStatus = useProjectStore((state) => state.setConnectionStatus);
  const connectionStatus = useProjectStore((state) => state.connectionStatus);
  const selectedProjectId = useProjectStore((state) => state.selectedProjectId);

  // Refs for WebSocket and reconnection state
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const subscribedProjectsRef = useRef<Set<string>>(new Set());
  const isConnectingRef = useRef(false);

  /**
   * Send a message through the WebSocket
   */
  const sendMessage = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  /**
   * Subscribe to project IDs
   */
  const subscribe = useCallback((projectIds: string[]) => {
    if (projectIds.length === 0) return;

    // Track subscribed projects
    for (const id of projectIds) {
      subscribedProjectsRef.current.add(id);
    }

    sendMessage({ type: 'subscribe', projectIds });
  }, [sendMessage]);

  /**
   * Unsubscribe from project IDs
   */
  const unsubscribe = useCallback((projectIds: string[]) => {
    if (projectIds.length === 0) return;

    // Remove from tracked subscriptions
    for (const id of projectIds) {
      subscribedProjectsRef.current.delete(id);
    }

    sendMessage({ type: 'unsubscribe', projectIds });
  }, [sendMessage]);

  /**
   * Handle incoming WebSocket messages
   */
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data) as ServerMessage;

      switch (message.type) {
        case 'file:change':
          onFileChange?.(message);
          break;
        case 'pong':
          // Heartbeat acknowledged - connection is alive
          break;
        case 'subscribed':
          // Subscription confirmed
          break;
        case 'unsubscribed':
          // Unsubscription confirmed
          break;
        case 'error':
          console.error('[WebSocket] Server error:', message.message);
          break;
      }
    } catch (error) {
      console.error('[WebSocket] Failed to parse message:', error);
    }
  }, [onFileChange]);

  /**
   * Calculate reconnection delay with exponential backoff
   */
  const getReconnectDelay = useCallback(() => {
    const delay = BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptRef.current);
    return Math.min(delay, MAX_RECONNECT_DELAY);
  }, []);

  /**
   * Schedule a reconnection attempt
   */
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const delay = getReconnectDelay();
    reconnectAttemptRef.current += 1;

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [getReconnectDelay]);

  /**
   * Clean up connection resources
   */
  const cleanup = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  /**
   * Connect to the WebSocket server
   */
  const connect = useCallback(() => {
    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    isConnectingRef.current = true;
    setConnectionStatus('connecting');

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        isConnectingRef.current = false;
        reconnectAttemptRef.current = 0;
        setConnectionStatus('connected');

        // Re-subscribe to any previously subscribed projects
        if (subscribedProjectsRef.current.size > 0) {
          subscribe(Array.from(subscribedProjectsRef.current));
        }

        // Start ping interval
        pingIntervalRef.current = setInterval(() => {
          sendMessage({ type: 'ping' });
        }, PING_INTERVAL);
      };

      ws.onmessage = handleMessage;

      ws.onclose = () => {
        isConnectingRef.current = false;
        setConnectionStatus('disconnected');

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Schedule reconnection if still enabled
        if (enabled) {
          scheduleReconnect();
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Connection error:', error);
        isConnectingRef.current = false;
        // onclose will be called after onerror, which will handle reconnection
      };
    } catch (error) {
      console.error('[WebSocket] Failed to create connection:', error);
      isConnectingRef.current = false;
      setConnectionStatus('disconnected');

      if (enabled) {
        scheduleReconnect();
      }
    }
  }, [url, enabled, setConnectionStatus, handleMessage, subscribe, sendMessage, scheduleReconnect]);

  // Connect on mount and cleanup on unmount
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      cleanup();
    };
  }, [enabled, connect, cleanup]);

  // Auto-subscribe to selected project when it changes
  useEffect(() => {
    if (connectionStatus !== 'connected') return;

    // Get currently subscribed projects
    const currentSubs = subscribedProjectsRef.current;

    // If we have a selected project and it's not subscribed, subscribe to it
    if (selectedProjectId && !currentSubs.has(selectedProjectId)) {
      subscribe([selectedProjectId]);
    }

    // Note: We don't auto-unsubscribe from previous selections here.
    // The caller can explicitly unsubscribe if needed, or subscriptions
    // can accumulate for projects the user has viewed.
  }, [selectedProjectId, connectionStatus, subscribe]);

  return {
    subscribe,
    unsubscribe,
    isConnected: connectionStatus === 'connected',
  };
}

/**
 * Determine the WebSocket URL based on the current environment.
 * In development with Vite proxy, we connect to the same host.
 * In production, we connect to the API server directly.
 */
function getWebSocketUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;

  // In development with Vite, we use the proxy configured in vite.config.ts
  // The frontend runs on port 5173 and proxies WebSocket to 4242
  // But we can also connect directly to the backend
  if (import.meta.env.DEV) {
    // Connect directly to the backend WebSocket server in development
    return 'ws://localhost:4242';
  }

  // In production, WebSocket runs on the same server as the API
  return `${protocol}//${host}`;
}
