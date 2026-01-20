/**
 * WebSocket Hub Service
 * Manages WebSocket connections, subscriptions, and broadcasts.
 * Integrates with Express server and file watcher for real-time updates.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { getFileWatcher, type FileChangeEvent } from './fileWatcher.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Message types that clients can send
 */
export interface SubscribeMessage {
  type: 'subscribe';
  projectIds: string[];
}

export interface UnsubscribeMessage {
  type: 'unsubscribe';
  projectIds: string[];
}

export interface PingMessage {
  type: 'ping';
}

export type ClientMessage = SubscribeMessage | UnsubscribeMessage | PingMessage;

/**
 * Message types that the server sends to clients
 */
export interface FileChangeMessage {
  type: 'file:change';
  projectId: string;
  fileType: string;
  path: string;
  event: 'add' | 'change' | 'unlink';
}

export interface PongMessage {
  type: 'pong';
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export interface SubscribedMessage {
  type: 'subscribed';
  projectIds: string[];
}

export interface UnsubscribedMessage {
  type: 'unsubscribed';
  projectIds: string[];
}

export type ServerMessage =
  | FileChangeMessage
  | PongMessage
  | ErrorMessage
  | SubscribedMessage
  | UnsubscribedMessage;

/**
 * Internal connection state
 */
interface ConnectionState {
  id: string;
  ws: WebSocket;
  subscribedProjects: Set<string>;
  lastPing: number;
  isAlive: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Heartbeat interval in milliseconds (30 seconds) */
const HEARTBEAT_INTERVAL = 30000;

/** Connection timeout - if no pong received within this time, connection is closed */
const CONNECTION_TIMEOUT = 35000;

// ============================================================================
// WebSocketHub Class
// ============================================================================

/**
 * WebSocket hub that manages connections and broadcasts file changes
 * to subscribed clients.
 */
export class WebSocketHub {
  private wss: WebSocketServer | null = null;
  private connections: Map<string, ConnectionState> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private fileWatcherHandler: ((event: FileChangeEvent) => void) | null = null;

  /**
   * Attach the WebSocket server to an existing HTTP server.
   * This enables the WebSocket server to share the same port as Express.
   * @param httpServer - The HTTP server instance (from Express)
   */
  attach(httpServer: Server): void {
    if (this.wss) {
      throw new Error('WebSocketHub is already attached to a server');
    }

    // Create WebSocket server attached to the HTTP server
    this.wss = new WebSocketServer({ server: httpServer });

    // Handle new connections
    this.wss.on('connection', (ws) => this.handleConnection(ws));

    // Start heartbeat checking
    this.startHeartbeat();

    // Connect to file watcher
    this.connectToFileWatcher();
  }

  /**
   * Close the WebSocket server and cleanup all connections
   */
  close(): void {
    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Disconnect from file watcher
    if (this.fileWatcherHandler) {
      const fileWatcher = getFileWatcher();
      fileWatcher.off('change', this.fileWatcherHandler);
      this.fileWatcherHandler = null;
    }

    // Close all connections
    for (const connection of this.connections.values()) {
      connection.ws.close(1000, 'Server shutting down');
    }
    this.connections.clear();

    // Close the WebSocket server
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }

  /**
   * Broadcast a message to all clients subscribed to a specific project
   * @param projectId - The project ID to broadcast to
   * @param message - The message to send
   */
  broadcastToProject(projectId: string, message: ServerMessage): void {
    const messageStr = JSON.stringify(message);

    for (const connection of this.connections.values()) {
      if (
        connection.subscribedProjects.has(projectId) &&
        connection.ws.readyState === WebSocket.OPEN
      ) {
        connection.ws.send(messageStr);
      }
    }
  }

  /**
   * Broadcast a message to all connected clients
   * @param message - The message to send
   */
  broadcastAll(message: ServerMessage): void {
    const messageStr = JSON.stringify(message);

    for (const connection of this.connections.values()) {
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(messageStr);
      }
    }
  }

  /**
   * Get the number of active connections
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get the number of connections subscribed to a specific project
   */
  getProjectSubscriberCount(projectId: string): number {
    let count = 0;
    for (const connection of this.connections.values()) {
      if (connection.subscribedProjects.has(projectId)) {
        count++;
      }
    }
    return count;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Handle a new WebSocket connection
   */
  private handleConnection(ws: WebSocket): void {
    const connectionId = uuidv4();

    // Create connection state
    const connection: ConnectionState = {
      id: connectionId,
      ws,
      subscribedProjects: new Set(),
      lastPing: Date.now(),
      isAlive: true,
    };

    this.connections.set(connectionId, connection);

    // Handle incoming messages
    ws.on('message', (data) => {
      this.handleMessage(connection, data);
    });

    // Handle pong responses for heartbeat
    ws.on('pong', () => {
      connection.isAlive = true;
      connection.lastPing = Date.now();
    });

    // Handle connection close
    ws.on('close', () => {
      this.handleDisconnect(connection);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`WebSocket error for connection ${connectionId}:`, error.message);
      this.handleDisconnect(connection);
    });
  }

  /**
   * Handle an incoming message from a client
   */
  private handleMessage(connection: ConnectionState, data: unknown): void {
    try {
      const messageStr = data instanceof Buffer ? data.toString('utf-8') : String(data);
      const message = JSON.parse(messageStr) as ClientMessage;

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(connection, message);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(connection, message);
          break;
        case 'ping':
          this.handlePing(connection);
          break;
        default:
          this.sendError(connection, `Unknown message type: ${(message as { type: string }).type}`);
      }
    } catch (error) {
      this.sendError(connection, 'Invalid message format');
    }
  }

  /**
   * Handle a subscribe message
   */
  private handleSubscribe(connection: ConnectionState, message: SubscribeMessage): void {
    const { projectIds } = message;

    if (!Array.isArray(projectIds)) {
      this.sendError(connection, 'projectIds must be an array');
      return;
    }

    for (const projectId of projectIds) {
      if (typeof projectId === 'string') {
        connection.subscribedProjects.add(projectId);
      }
    }

    // Send confirmation
    const response: SubscribedMessage = {
      type: 'subscribed',
      projectIds: Array.from(connection.subscribedProjects),
    };

    connection.ws.send(JSON.stringify(response));
  }

  /**
   * Handle an unsubscribe message
   */
  private handleUnsubscribe(connection: ConnectionState, message: UnsubscribeMessage): void {
    const { projectIds } = message;

    if (!Array.isArray(projectIds)) {
      this.sendError(connection, 'projectIds must be an array');
      return;
    }

    for (const projectId of projectIds) {
      connection.subscribedProjects.delete(projectId);
    }

    // Send confirmation
    const response: UnsubscribedMessage = {
      type: 'unsubscribed',
      projectIds,
    };

    connection.ws.send(JSON.stringify(response));
  }

  /**
   * Handle a ping message
   */
  private handlePing(connection: ConnectionState): void {
    connection.lastPing = Date.now();
    connection.isAlive = true;

    const response: PongMessage = { type: 'pong' };
    connection.ws.send(JSON.stringify(response));
  }

  /**
   * Send an error message to a client
   */
  private sendError(connection: ConnectionState, message: string): void {
    if (connection.ws.readyState === WebSocket.OPEN) {
      const errorMsg: ErrorMessage = { type: 'error', message };
      connection.ws.send(JSON.stringify(errorMsg));
    }
  }

  /**
   * Handle connection disconnect - cleanup subscriptions and state
   */
  private handleDisconnect(connection: ConnectionState): void {
    connection.subscribedProjects.clear();
    this.connections.delete(connection.id);
  }

  /**
   * Start the heartbeat interval to detect stale connections
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();

      for (const connection of this.connections.values()) {
        // Check if connection has timed out
        if (!connection.isAlive && now - connection.lastPing > CONNECTION_TIMEOUT) {
          // Connection is stale - terminate it
          connection.ws.terminate();
          this.handleDisconnect(connection);
          continue;
        }

        // Mark as not alive and send ping
        connection.isAlive = false;
        if (connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.ping();
        }
      }
    }, HEARTBEAT_INTERVAL);
  }

  /**
   * Connect to the file watcher to receive change events
   */
  private connectToFileWatcher(): void {
    const fileWatcher = getFileWatcher();

    this.fileWatcherHandler = (event: FileChangeEvent) => {
      const message: FileChangeMessage = {
        type: 'file:change',
        projectId: event.projectId,
        fileType: event.fileType,
        path: event.path,
        event: event.event,
      };

      // Broadcast only to clients subscribed to this project
      this.broadcastToProject(event.projectId, message);
    };

    fileWatcher.on('change', this.fileWatcherHandler);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Default WebSocket hub instance for the dashboard
 */
let defaultInstance: WebSocketHub | null = null;

/**
 * Get or create the default WebSocket hub instance
 */
export function getWebSocketHub(): WebSocketHub {
  if (!defaultInstance) {
    defaultInstance = new WebSocketHub();
  }
  return defaultInstance;
}

/**
 * Create a new WebSocket hub instance (useful for testing)
 */
export function createWebSocketHub(): WebSocketHub {
  return new WebSocketHub();
}
