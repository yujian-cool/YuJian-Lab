# Yu Jian Lab - WebSocket Real-Time Dashboard Technical Specification

## Document Information
- **Project**: Yu Jian Presence Dashboard
- **Version**: 1.0.0
- **Date**: 2026-02-02
- **Status**: Draft

---

## Table of Contents
1. [Overview](#overview)
2. [WebSocket Architecture Design](#websocket-architecture-design)
3. [Frontend React Component Structure](#frontend-react-component-structure)
4. [Backend Elysia WebSocket Handler](#backend-elysia-websocket-handler)
5. [Event Types and Message Protocols](#event-types-and-message-protocols)
6. [Reconnection and Error Handling](#reconnection-and-error-handling)
7. [Security Considerations](#security-considerations)
8. [Performance Optimization](#performance-optimization)
9. [Deployment & Monitoring](#deployment--monitoring)

---

## Overview

### Purpose
This specification defines the technical architecture for implementing a WebSocket-based real-time dashboard for Yu Jian Lab, enabling live updates of lab presence data, system metrics, and collaborative features.

### Goals
- Sub-100ms latency for real-time updates
- Support 1000+ concurrent connections
- Automatic reconnection with state recovery
- Type-safe message protocols
- Horizontal scalability

### Technology Stack
- **Frontend**: React 18+ with TypeScript, Zustand for state management
- **Backend**: Elysia (Bun runtime) with WebSocket support
- **Protocol**: Native WebSocket (ws/wss)
- **Message Format**: JSON with strict typing

---

## WebSocket Architecture Design

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Dashboard  │  │  Admin Panel│  │ Mobile App  │              │
│  │   (React)   │  │   (React)   │  │  (React)    │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
└─────────┼────────────────┼────────────────┼─────────────────────┘
          │                │                │
          └────────────────┴────────────────┘
                           │
                    ┌──────▼──────┐
                    │   WSS Load  │
                    │   Balancer  │
                    │  (Nginx/HA) │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
   ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
   │  Elysia WS  │  │  Elysia WS  │  │  Elysia WS  │
   │  Server #1  │  │  Server #2  │  │  Server #N  │
   │   (Bun)     │  │   (Bun)     │  │   (Bun)     │
   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
          │                │                │
          └────────────────┼────────────────┘
                           │
                    ┌──────▼──────┐
                    │  Redis Pub  │
                    │    /Sub     │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
   ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
   │ PostgreSQL  │  │   Redis     │  │  External   │
   │  (Primary)  │  │  (Cache)    │  │   APIs      │
   └─────────────┘  └─────────────┘  └─────────────┘
```

### Connection Flow

```
┌─────────┐                    ┌─────────────┐
│ Client  │                    │ Elysia WS   │
└────┬────┘                    └──────┬──────┘
     │                                │
     │  1. HTTP Upgrade Request       │
     │ ─────────────────────────────>│
     │  (with JWT auth token)         │
     │                                │
     │  2. Validate & Authenticate    │
     │  3. Create WebSocket Context   │
     │                                │
     │  4. 101 Switching Protocols    │
     │ <─────────────────────────────│
     │                                │
     │  5. Send Connection Ack        │
     │ <─────────────────────────────│
     │  { type: 'CONNECTED',          │
     │    clientId, timestamp }       │
     │                                │
     │  6. Subscribe to Channels      │
     │ ─────────────────────────────>│
     │  { type: 'SUBSCRIBE',          │
     │    channels: [...] }           │
     │                                │
     │  7. Confirm Subscriptions      │
     │ <─────────────────────────────│
     │                                │
```

### Server Architecture Components

#### 1. Connection Manager
```typescript
// Connection state per client
interface WSConnection {
  id: string;                    // Unique connection ID
  userId: string;                // Authenticated user ID
  socket: WebSocket;             // WebSocket instance
  channels: Set<string>;         // Subscribed channels
  connectedAt: Date;             // Connection timestamp
  lastPingAt: Date;              // Last ping/pong time
  metadata: UserMetadata;        // User role, preferences
}

// Global connection registry
class ConnectionManager {
  private connections: Map<string, WSConnection>;
  private userConnections: Map<string, Set<string>>; // userId -> connectionIds
  
  // Methods for connection lifecycle
  addConnection(conn: WSConnection): void;
  removeConnection(id: string): void;
  getUserConnections(userId: string): WSConnection[];
  broadcastToChannel(channel: string, message: WSMessage): void;
}
```

#### 2. Channel System
```typescript
// Channel types for different data streams
enum ChannelType {
  PRESENCE = 'presence',         // Lab presence updates
  METRICS = 'metrics',           // System metrics
  ACTIVITY = 'activity',         // User activity feed
  ANNOUNCEMENTS = 'announcements', // Lab announcements
  COLLABORATION = 'collaboration', // Real-time collaboration
}

// Channel subscription management
interface ChannelSubscription {
  channel: string;
  filters?: MessageFilter[];
  rateLimit?: number;
}
```

#### 3. Message Router
```typescript
// Routes messages between publishers and subscribers
class MessageRouter {
  // Publish to specific channel
  publish(channel: string, message: WSMessage): void;
  
  // Publish to user (all their connections)
  publishToUser(userId: string, message: WSMessage): void;
  
  // Broadcast to all connected clients
  broadcast(message: WSMessage, exclude?: string[]): void;
  
  // Handle Redis pub/sub for multi-server setup
  handleRedisMessage(channel: string, message: string): void;
}
```

---

## Frontend React Component Structure

### Directory Structure

```
src/
├── websocket/
│   ├── WebSocketProvider.tsx      # Context provider for WS connection
│   ├── useWebSocket.ts            # Hook for WebSocket interactions
│   ├── useChannel.ts              # Hook for channel subscriptions
│   ├── WebSocketClient.ts         # Core WebSocket client class
│   ├── types.ts                   # TypeScript definitions
│   └── constants.ts               # WS constants & config
├── components/
│   ├── dashboard/
│   │   ├── LivePresence.tsx       # Real-time presence display
│   │   ├── MetricsPanel.tsx       # Live metrics visualization
│   │   ├── ActivityFeed.tsx       # Real-time activity stream
│   │   └── ConnectionStatus.tsx   # Connection state indicator
│   └── shared/
│       └── RealTimeBadge.tsx      # Live indicator component
└── store/
    ├── presenceStore.ts           # Zustand store for presence
    ├── metricsStore.ts            # Zustand store for metrics
    └── activityStore.ts           # Zustand store for activity
```

### Core WebSocket Client

```typescript
// src/websocket/WebSocketClient.ts

import { EventEmitter } from 'events';

export interface WSConfig {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  authToken: string;
}

export class WebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: Required<WSConfig>;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private messageQueue: WSMessage[] = [];
  private isConnecting = false;
  private clientId: string | null = null;
  private subscribedChannels: Set<string> = new Set();

  constructor(config: WSConfig) {
    super();
    this.config = {
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      ...config,
    };
  }

  connect(): void {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) return;
    
    this.isConnecting = true;
    
    try {
      this.ws = new WebSocket(this.config.url, [], {
        headers: { Authorization: `Bearer ${this.config.authToken}` },
      });

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
    } catch (error) {
      this.emit('error', error);
      this.scheduleReconnect();
    }
  }

  private handleOpen(): void {
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.emit('connected');
    this.startHeartbeat();
    this.flushMessageQueue();
    this.resubscribeChannels();
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: WSMessage = JSON.parse(event.data);
      this.emit('message', message);
      this.emit(message.type, message);
    } catch (error) {
      this.emit('error', new Error('Invalid message format'));
    }
  }

  private handleClose(event: CloseEvent): void {
    this.isConnecting = false;
    this.stopHeartbeat();
    this.emit('disconnected', event);
    
    if (!event.wasClean) {
      this.scheduleReconnect();
    }
  }

  private handleError(error: Event): void {
    this.emit('error', error);
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.emit('maxReconnectReached');
      return;
    }

    this.reconnectAttempts++;
    this.emit('reconnecting', this.reconnectAttempts);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.config.reconnectInterval * Math.min(this.reconnectAttempts, 5));
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'PING', timestamp: Date.now() });
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected()) {
      const message = this.messageQueue.shift();
      if (message) this.send(message);
    }
  }

  private resubscribeChannels(): void {
    if (this.subscribedChannels.size > 0) {
      this.send({
        type: 'SUBSCRIBE',
        channels: Array.from(this.subscribedChannels),
      });
    }
  }

  send(message: WSMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
    }
  }

  subscribe(channel: string): void {
    this.subscribedChannels.add(channel);
    this.send({ type: 'SUBSCRIBE', channels: [channel] });
  }

  unsubscribe(channel: string): void {
    this.subscribedChannels.delete(channel);
    this.send({ type: 'UNSUBSCRIBE', channels: [channel] });
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.ws?.close(1000, 'Client disconnect');
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
```

### React Context Provider

```typescript
// src/websocket/WebSocketProvider.tsx

import React, { createContext, useContext, useEffect, useRef } from 'react';
import { WebSocketClient, WSConfig } from './WebSocketClient';

interface WebSocketContextValue {
  client: WebSocketClient | null;
  isConnected: boolean;
  isReconnecting: boolean;
  reconnectAttempts: number;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export const WebSocketProvider: React.FC<{
  config: WSConfig;
  children: React.ReactNode;
}> = ({ config, children }) => {
  const clientRef = useRef<WebSocketClient | null>(null);
  const [state, setState] = React.useState({
    isConnected: false,
    isReconnecting: false,
    reconnectAttempts: 0,
  });

  useEffect(() => {
    const client = new WebSocketClient(config);
    clientRef.current = client;

    client.on('connected', () => {
      setState((s) => ({ ...s, isConnected: true, isReconnecting: false }));
    });

    client.on('disconnected', () => {
      setState((s) => ({ ...s, isConnected: false }));
    });

    client.on('reconnecting', (attempt) => {
      setState((s) => ({ ...s, isReconnecting: true, reconnectAttempts: attempt }));
    });

    client.connect();

    return () => {
      client.disconnect();
    };
  }, [config]);

  return (
    <WebSocketContext.Provider
      value={{
        client: clientRef.current,
        ...state,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) throw new Error('Must be used within WebSocketProvider');
  return context;
};
```

### Custom Hooks

```typescript
// src/websocket/useChannel.ts

import { useEffect, useCallback } from 'react';
import { useWebSocketContext } from './WebSocketProvider';

export function useChannel<T>(
  channel: string,
  onMessage: (data: T) => void,
  options?: {
    filter?: (message: T) => boolean;
    transform?: (message: T) => T;
  }
) {
  const { client, isConnected } = useWebSocketContext();

  useEffect(() => {
    if (!client || !isConnected) return;

    const handler = (message: WSMessage) => {
      if (message.channel === channel) {
        let data = message.payload as T;
        
        if (options?.filter && !options.filter(data)) return;
        if (options?.transform) data = options.transform(data);
        
        onMessage(data);
      }
    };

    client.on('DATA', handler);
    client.subscribe(channel);

    return () => {
      client.off('DATA', handler);
      client.unsubscribe(channel);
    };
  }, [channel, client, isConnected, onMessage]);

  const sendToChannel = useCallback(
    (type: string, payload: unknown) => {
      client?.send({
        type: 'PUBLISH',
        channel,
        payload: { type, data: payload },
      });
    },
    [client, channel]
  );

  return { sendToChannel, isSubscribed: isConnected };
}
```

### Dashboard Components

```typescript
// src/components/dashboard/LivePresence.tsx

import React from 'react';
import { useChannel } from '../../websocket/useChannel';
import { usePresenceStore } from '../../store/presenceStore';

interface PresenceUpdate {
  userId: string;
  status: 'online' | 'offline' | 'away';
  location?: string;
  lastSeen: string;
}

export const LivePresence: React.FC = () => {
  const { users, updateUser, removeUser } = usePresenceStore();

  useChannel<PresenceUpdate>('presence', (update) => {
    if (update.status === 'offline') {
      removeUser(update.userId);
    } else {
      updateUser(update);
    }
  });

  return (
    <div className="presence-panel">
      <h2>Lab Presence <span className="live-badge">LIVE</span></h2>
      <div className="user-grid">
        {users.map((user) => (
          <UserCard key={user.userId} user={user} />
        ))}
      </div>
    </div>
  );
};
```

```typescript
// src/components/dashboard/ConnectionStatus.tsx

import React from 'react';
import { useWebSocketContext } from '../../websocket/WebSocketProvider';

export const ConnectionStatus: React.FC = () => {
  const { isConnected, isReconnecting, reconnectAttempts } = useWebSocketContext();

  if (isConnected) {
    return <span className="status connected">● Connected</span>;
  }

  if (isReconnecting) {
    return (
      <span className="status reconnecting">
        ◌ Reconnecting... ({reconnectAttempts})
      </span>
    );
  }

  return <span className="status disconnected">○ Disconnected</span>;
};
```

---

## Backend Elysia WebSocket Handler

### Server Setup

```typescript
// src/server.ts

import { Elysia } from 'elysia';
import { websocketPlugin } from './websocket/plugin';
import { authMiddleware } from './middleware/auth';

const app = new Elysia()
  .use(authMiddleware)
  .use(websocketPlugin)
  .listen(3000);

console.log(`🚀 Server running at ${app.server?.hostname}:${app.server?.port}`);
```

### WebSocket Plugin

```typescript
// src/websocket/plugin.ts

import { Elysia } from 'elysia';
import { ConnectionManager } from './ConnectionManager';
import { MessageHandler } from './MessageHandler';
import { AuthService } from '../services/AuthService';

export const websocketPlugin = new Elysia()
  .derive(() => ({
    connectionManager: new ConnectionManager(),
    messageHandler: new MessageHandler(),
  }))
  .ws('/ws', {
    // Connection validation
    beforeHandle: async ({ request, set }) => {
      const token = request.headers.get('authorization')?.replace('Bearer ', '');
      
      if (!token) {
        set.status = 401;
        return 'Unauthorized';
      }

      const user = await AuthService.validateToken(token);
      if (!user) {
        set.status = 403;
        return 'Forbidden';
      }

      return { user };
    },

    // Connection opened
    open: (ws) => {
      const { user } = ws.data;
      const clientId = generateClientId();
      
      // Store connection
      ws.data.connectionManager.addConnection({
        id: clientId,
        userId: user.id,
        socket: ws,
        channels: new Set(),
        connectedAt: new Date(),
        lastPingAt: new Date(),
        metadata: {
          role: user.role,
          name: user.name,
        },
      });

      // Send connection acknowledgment
      ws.send(JSON.stringify({
        type: 'CONNECTED',
        clientId,
        timestamp: Date.now(),
        serverTime: new Date().toISOString(),
      }));

      console.log(`✅ Client ${clientId} connected (User: ${user.id})`);
    },

    // Message received
    message: (ws, message) => {
      try {
        const data = JSON.parse(message as string);
        ws.data.messageHandler.handle(ws, data);
      } catch (error) {
        ws.send(JSON.stringify({
          type: 'ERROR',
          code: 'INVALID_MESSAGE',
          message: 'Failed to parse message',
        }));
      }
    },

    // Connection closed
    close: (ws, code, reason) => {
      const { connectionManager } = ws.data;
      const conn = connectionManager.getConnectionBySocket(ws);
      
      if (conn) {
        connectionManager.removeConnection(conn.id);
        console.log(`❌ Client ${conn.id} disconnected (${code}: ${reason})`);
      }
    },
  });

function generateClientId(): string {
  return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
```

### Message Handler

```typescript
// src/websocket/MessageHandler.ts

import type { WebSocket } from 'elysia';
import { ConnectionManager } from './ConnectionManager';
import { MessageRouter } from './MessageRouter';
import { PresenceService } from '../services/PresenceService';
import { MetricsService } from '../services/MetricsService';

export class MessageHandler {
  constructor(
    private connectionManager: ConnectionManager,
    private messageRouter: MessageRouter,
    private presenceService: PresenceService,
    private metricsService: MetricsService,
  ) {}

  handle(ws: WebSocket, message: WSMessage): void {
    switch (message.type) {
      case 'PING':
        this.handlePing(ws, message);
        break;
      case 'PONG':
        this.handlePong(ws, message);
        break;
      case 'SUBSCRIBE':
        this.handleSubscribe(ws, message);
        break;
      case 'UNSUBSCRIBE':
        this.handleUnsubscribe(ws, message);
        break;
      case 'PUBLISH':
        this.handlePublish(ws, message);
        break;
      case 'REQUEST_SYNC':
        this.handleSyncRequest(ws, message);
        break;
      default:
        this.sendError(ws, 'UNKNOWN_TYPE', `Unknown message type: ${message.type}`);
    }
  }

  private handlePing(ws: WebSocket, message: WSMessage): void {
    ws.send(JSON.stringify({
      type: 'PONG',
      timestamp: Date.now(),
      clientTimestamp: message.timestamp,
    }));
    
    // Update last ping time
    const conn = this.connectionManager.getConnectionBySocket(ws);
    if (conn) {
      conn.lastPingAt = new Date();
    }
  }

  private handlePong(ws: WebSocket, message: WSMessage): void {
    const conn = this.connectionManager.getConnectionBySocket(ws);
    if (conn) {
      conn.lastPingAt = new Date();
    }
  }

  private handleSubscribe(ws: WebSocket, message: SubscribeMessage): void {
    const conn = this.connectionManager.getConnectionBySocket(ws);
    if (!conn) return;

    const { channels } = message;
    const subscribed: string[] = [];
    const failed: { channel: string; reason: string }[] = [];

    for (const channel of channels) {
      if (this.validateChannelAccess(conn, channel)) {
        conn.channels.add(channel);
        subscribed.push(channel);
        
        // Send initial data for the channel
        this.sendInitialData(ws, channel);
      } else {
        failed.push({ channel, reason: 'Access denied' });
      }
    }

    ws.send(JSON.stringify({
      type: 'SUBSCRIBED',
      channels: subscribed,
      failed,
      timestamp: Date.now(),
    }));
  }

  private handleUnsubscribe(ws: WebSocket, message: UnsubscribeMessage): void {
    const conn = this.connectionManager.getConnectionBySocket(ws);
    if (!conn) return;

    for (const channel of message.channels) {
      conn.channels.delete(channel);
    }

    ws.send(JSON.stringify({
      type: 'UNSUBSCRIBED',
      channels: message.channels,
      timestamp: Date.now(),
    }));
  }

  private handlePublish(ws: WebSocket, message: PublishMessage): void {
    const conn = this.connectionManager.getConnectionBySocket(ws);
    if (!conn) return;

    // Validate user can publish to this channel
    if (!this.canPublish(conn, message.channel)) {
      this.sendError(ws, 'PUBLISH_DENIED', 'Not authorized to publish to this channel');
      return;
    }

    // Route the message
    this.messageRouter.publish(message.channel, {
      type: 'DATA',
      channel: message.channel,
      payload: message.payload,
      sender: {
        userId: conn.userId,
        clientId: conn.id,
      },
      timestamp: Date.now(),
    });
  }

  private handleSyncRequest(ws: WebSocket, message: SyncRequestMessage): void {
    const { channel, lastSequence } = message;
    
    // Send missed messages since lastSequence
    const missedMessages = this.messageRouter.getMissedMessages(channel, lastSequence);
    
    ws.send(JSON.stringify({
      type: 'SYNC_RESPONSE',
      channel,
      messages: missedMessages,
      currentSequence: this.messageRouter.getCurrentSequence(channel),
    }));
  }

  private sendInitialData(ws: WebSocket, channel: string): void {
    switch (channel) {
      case 'presence':
        const presence = this.presenceService.getAll();
        ws.send(JSON.stringify({
          type: 'INITIAL_DATA',
          channel,
          payload: presence,
        }));
        break;
      case 'metrics':
        const metrics = this.metricsService.getCurrent();
        ws.send(JSON.stringify({
          type: 'INITIAL_DATA',
          channel,
          payload: metrics,
        }));
        break;
    }
  }

  private validateChannelAccess(conn: WSConnection, channel: string): boolean {
    // Admin can access all channels
    if (conn.metadata.role === 'admin') return true;
    
    // Regular users have restricted access
    const publicChannels = ['presence', 'metrics', 'announcements'];
    return publicChannels.includes(channel);
  }

  private canPublish(conn: WSConnection, channel: string): boolean {
    // Only admins and moderators can publish
    return ['admin', 'moderator'].includes(conn.metadata.role);
  }

  private sendError(ws: WebSocket, code: string, message: string): void {
    ws.send(JSON.stringify({
      type: 'ERROR',
      code,
      message,
      timestamp: Date.now(),
    }));
  }
}
```

### Connection Manager (Backend)

```typescript
// src/websocket/ConnectionManager.ts

import type { WebSocket } from 'elysia';
import { Redis } from 'ioredis';

export interface WSConnection {
  id: string;
  userId: string;
  socket: WebSocket;
  channels: Set<string>;
  connectedAt: Date;
  lastPingAt: Date;
  metadata: {
    role: string;
    name: string;
  };
}

export class ConnectionManager {
  private connections: Map<string, WSConnection> = new Map();
  private userConnections: Map<string, Set<string>> = new Map();
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.startCleanupInterval();
  }

  addConnection(conn: WSConnection): void {
    this.connections.set(conn.id, conn);
    
    // Track user's connections
    if (!this.userConnections.has(conn.userId)) {
      this.userConnections.set(conn.userId, new Set());
    }
    this.userConnections.get(conn.userId)!.add(conn.id);

    // Update presence in Redis
    this.redis.hset('presence', conn.userId, JSON.stringify({
      status: 'online',
      connections: this.userConnections.get(conn.userId)!.size,
      lastSeen: new Date().toISOString(),
    }));
  }

  removeConnection(id: string): void {
    const conn = this.connections.get(id);
    if (!conn) return;

    this.connections.delete(id);
    
    // Update user's connection tracking
    const userConns = this.userConnections.get(conn.userId);
    if (userConns) {
      userConns.delete(id);
      
      if (userConns.size === 0) {
        this.userConnections.delete(conn.userId);
        // Mark user as offline
        this.redis.hset('presence', conn.userId, JSON.stringify({
          status: 'offline',
          lastSeen: new Date().toISOString(),
        }));
      } else {
        // Update connection count
        this.redis.hset('presence', conn.userId, JSON.stringify({
          status: 'online',
          connections: userConns.size,
          lastSeen: new Date().toISOString(),
        }));
      }
    }
  }

  getConnection(id: string): WSConnection | undefined {
    return this.connections.get(id);
  }

  getConnectionBySocket(ws: WebSocket): WSConnection | undefined {
    return Array.from(this.connections.values()).find(c => c.socket === ws);
  }

  getUserConnections(userId: string): WSConnection[] {
    const ids = this.userConnections.get(userId);
    if (!ids) return [];
    return Array.from(ids).map(id => this.connections.get(id)).filter(Boolean) as WSConnection[];
  }

  getConnectionsInChannel(channel: string): WSConnection[] {
    return Array.from(this.connections.values())
      .filter(conn => conn.channels.has(channel));
  }

  broadcast(message: WSMessage, exclude?: string[]): void {
    const excludeSet = new Set(exclude);
    for (const conn of this.connections.values()) {
      if (!excludeSet.has(conn.id)) {
        conn.socket.send(JSON.stringify(message));
      }
    }
  }

  broadcastToChannel(channel: string, message: WSMessage, exclude?: string[]): void {
    const excludeSet = new Set(exclude);
    for (const conn of this.connections.values()) {
      if (conn.channels.has(channel) && !excludeSet.has(conn.id)) {
        conn.socket.send(JSON.stringify(message));
      }
    }
  }

  getStats(): { total: number; byChannel: Record<string, number> } {
    const byChannel: Record<string, number> = {};
    
    for (const conn of this.connections.values()) {
      for (const channel of conn.channels) {
        byChannel[channel] = (byChannel[channel] || 0) + 1;
      }
    }

    return {
      total: this.connections.size,
      byChannel,
    };
  }

  private startCleanupInterval(): void {
    // Clean up stale connections every 60 seconds
    setInterval(() => {
      const now = Date.now();
      const staleThreshold = 2 * 60 * 1000; // 2 minutes

      for (const [id, conn] of this.connections) {
        if (now - conn.lastPingAt.getTime() > staleThreshold) {
          console.log(`🧹 Cleaning up stale connection: ${id}`);
          conn.socket.close(1001, 'Connection timeout');
          this.removeConnection(id);
        }
      }
    }, 60000);
  }
}
```

---

## Event Types and Message Protocols

### Message Type Definitions

```typescript
// src/types/websocket.ts

// Base message interface
export interface WSMessage {
  type: MessageType;
  timestamp?: number;
  [key: string]: unknown;
}

export enum MessageType {
  // Connection
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  
  // Heartbeat
  PING = 'PING',
  PONG = 'PONG',
  
  // Subscription
  SUBSCRIBE = 'SUBSCRIBE',
  UNSUBSCRIBE = 'UNSUBSCRIBE',
  SUBSCRIBED = 'SUBSCRIBED',
  UNSUBSCRIBED = 'UNSUBSCRIBED',
  
  // Data
  DATA = 'DATA',
  INITIAL_DATA = 'INITIAL_DATA',
  PUBLISH = 'PUBLISH',
  
  // Sync
  REQUEST_SYNC = 'REQUEST_SYNC',
  SYNC_RESPONSE = 'SYNC_RESPONSE',
  
  // Error
  ERROR = 'ERROR',
}

// Client -> Server Messages

export interface PingMessage extends WSMessage {
  type: MessageType.PING;
  timestamp: number;
}

export interface SubscribeMessage extends WSMessage {
  type: MessageType.SUBSCRIBE;
  channels: string[];
}

export interface UnsubscribeMessage extends WSMessage {
  type: MessageType.UNSUBSCRIBE;
  channels: string[];
}

export interface PublishMessage extends WSMessage {
  type: MessageType.PUBLISH;
  channel: string;
  payload: unknown;
}

export interface SyncRequestMessage extends WSMessage {
  type: MessageType.REQUEST_SYNC;
  channel: string;
  lastSequence: number;
}

// Server -> Client Messages

export interface ConnectedMessage extends WSMessage {
  type: MessageType.CONNECTED;
  clientId: string;
  serverTime: string;
}

export interface PongMessage extends WSMessage {
  type: MessageType.PONG;
  timestamp: number;
  clientTimestamp: number;
}

export interface SubscribedMessage extends WSMessage {
  type: MessageType.SUBSCRIBED;
  channels: string[];
  failed: { channel: string; reason: string }[];
}

export interface DataMessage<T = unknown> extends WSMessage {
  type: MessageType.DATA;
  channel: string;
  payload: T;
  sender: {
    userId: string;
    clientId: string;
  };
  sequence: number;
}

export interface InitialDataMessage<T = unknown> extends WSMessage {
  type: MessageType.INITIAL_DATA;
  channel: string;
  payload: T;
}

export interface SyncResponseMessage<T = unknown> extends WSMessage {
  type: MessageType.SYNC_RESPONSE;
  channel: string;
  messages: DataMessage<T>[];
  currentSequence: number;
}

export interface ErrorMessage extends WSMessage {
  type: MessageType.ERROR;
  code: string;
  message: string;
  details?: unknown;
}
```

### Channel-Specific Payloads

```typescript
// Presence Channel
export interface PresencePayload {
  userId: string;
  status: 'online' | 'offline' | 'away';
  location?: string;
  activity?: string;
  lastSeen: string;
  metadata?: {
    name: string;
    avatar?: string;
    role: string;
  };
}

// Metrics Channel
export interface MetricsPayload {
  timestamp: string;
  metrics: {
    cpu: number;
    memory: number;
    disk: number;
    network: {
      in: number;
      out: number;
    };
  };
  services: {
    name: string;
    status: 'healthy' | 'warning' | 'critical';
    latency: number;
  }[];
}

// Activity Channel
export interface ActivityPayload {
  id: string;
  type: 'join' | 'leave' | 'action' | 'announcement';
  userId: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

// Announcements Channel
export interface AnnouncementPayload {
  id: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  title: string;
  content: string;
  author: {
    userId: string;
    name: string;
  };
  expiresAt?: string;
  timestamp: string;
}

// Collaboration Channel
export interface CollaborationPayload {
  type: 'cursor' | 'selection' | 'edit' | 'comment';
  documentId: string;
  userId: string;
  data: unknown;
  timestamp: string;
}
```

### Error Codes

```typescript
export enum WSErrorCode {
  // Connection errors
  CONNECTION_REFUSED = 'CONNECTION_REFUSED',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  RATE_LIMITED = 'RATE_LIMITED',
  
  // Message errors
  INVALID_MESSAGE = 'INVALID_MESSAGE',
  INVALID_TYPE = 'INVALID_TYPE',
  MISSING_FIELD = 'MISSING_FIELD',
  
  // Channel errors
  CHANNEL_NOT_FOUND = 'CHANNEL_NOT_FOUND',
  ACCESS_DENIED = 'ACCESS_DENIED',
  PUBLISH_DENIED = 'PUBLISH_DENIED',
  ALREADY_SUBSCRIBED = 'ALREADY_SUBSCRIBED',
  
  // Server errors
  SERVER_ERROR = 'SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
}
```

---

## Reconnection and Error Handling

### Reconnection Strategy

```typescript
// src/websocket/reconnection.ts

export interface ReconnectionConfig {
  // Initial delay in ms
  initialDelay: number;
  // Maximum delay in ms
  maxDelay: number;
  // Multiplier for exponential backoff
  backoffMultiplier: number;
  // Maximum number of reconnection attempts
  maxAttempts: number;
  // Jitter factor (0-1) to randomize delays
  jitter: number;
  // Timeout for each connection attempt
  connectionTimeout: number;
}

export const defaultReconnectionConfig: ReconnectionConfig = {
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 1.5,
  maxAttempts: 10,
  jitter: 0.1,
  connectionTimeout: 10000,
};

export class ReconnectionStrategy {
  private attempt = 0;
  private config: ReconnectionConfig;

  constructor(config: Partial<ReconnectionConfig> = {}) {
    this.config = { ...defaultReconnectionConfig, ...config };
  }

  reset(): void {
    this.attempt = 0;
  }

  getNextDelay(): number {
    if (this.attempt >= this.config.maxAttempts) {
      return -1; // Signal to stop trying
    }

    // Exponential backoff
    const exponentialDelay = this.config.initialDelay * 
      Math.pow(this.config.backoffMultiplier, this.attempt);
    
    // Cap at max delay
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelay);
    
    // Add jitter to prevent thundering herd
    const jitterAmount = cappedDelay * this.config.jitter;
    const delay = cappedDelay + (Math.random() * 2 - 1) * jitterAmount;
    
    this.attempt++;
    return Math.max(0, delay);
  }

  shouldRetry(closeCode: number): boolean {
    // Don't retry for certain close codes
    const doNotRetryCodes = [
      1000, // Normal closure
      1001, // Going away (server shutdown)
      1002, // Protocol error
      1003, // Unsupported data
      1007, // Invalid frame payload data
      1008, // Policy violation
      1009, // Message too big
      1010, // Mandatory extension
      1011, // Internal server error
      1015, // TLS handshake
    ];
    
    return !doNotRetryCodes.includes(closeCode);
  }
}
```

### State Recovery

```typescript
// src/websocket/stateRecovery.ts

export interface StateSnapshot {
  timestamp: number;
  sequence: number;
  channels: string[];
  data: Record<string, unknown>;
}

export class StateRecovery {
  private snapshots: Map<string, StateSnapshot> = new Map();
  private messageHistory: Map<string, WSMessage[]> = new Map();
  private maxHistorySize = 1000;
  private snapshotInterval = 30000; // 30 seconds

  constructor() {
    setInterval(() => this.createSnapshots(), this.snapshotInterval);
  }

  private createSnapshots(): void {
    // Implementation depends on your state management
    // This creates periodic snapshots for recovery
  }

  storeMessage(channel: string, message: WSMessage): void {
    if (!this.messageHistory.has(channel)) {
      this.messageHistory.set(channel, []);
    }
    
    const history = this.messageHistory.get(channel)!;
    history.push(message);
    
    // Trim old messages
    if (history.length > this.maxHistorySize) {
      history.splice(0, history.length - this.maxHistorySize);
    }
  }

  getMissedMessages(channel: string, lastSequence: number): WSMessage[] {
    const history = this.messageHistory.get(channel) || [];
    return history.filter(msg => (msg as any).sequence > lastSequence);
  }

  getSnapshot(channel: string): StateSnapshot | undefined {
    return this.snapshots.get(channel);
  }
}
```

### Frontend Error Handling

```typescript
// src/websocket/useWebSocketWithRecovery.ts

import { useState, useCallback, useRef, useEffect } from 'react';
import { WebSocketClient } from './WebSocketClient';
import { ReconnectionStrategy } from './reconnection';
import { StateRecovery } from './stateRecovery';

interface UseWebSocketWithRecoveryOptions {
  url: string;
  authToken: string;
  channels: string[];
  onMessage: (message: WSMessage) => void;
  onError?: (error: Error) => void;
}

export function useWebSocketWithRecovery(options: UseWebSocketWithRecoveryOptions) {
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('connecting');
  const [lastSequence, setLastSequence] = useState<Record<string, number>>({});
  
  const clientRef = useRef<WebSocketClient | null>(null);
  const reconnectionRef = useRef(new ReconnectionStrategy());
  const stateRecoveryRef = useRef(new StateRecovery());
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (clientRef.current?.isConnected()) return;

    setConnectionState('connecting');
    
    const client = new WebSocketClient({
      url: options.url,
      authToken: options.authToken,
    });

    client.on('connected', () => {
      setConnectionState('connected');
      reconnectionRef.current.reset();
      
      // Request sync for missed messages
      for (const channel of options.channels) {
        const seq = lastSequence[channel];
        if (seq !== undefined) {
          client.send({
            type: 'REQUEST_SYNC',
            channel,
            lastSequence: seq,
          });
        }
        client.subscribe(channel);
      }
    });

    client.on('disconnected', (event) => {
      setConnectionState('disconnected');
      
      if (reconnectionRef.current.shouldRetry(event.code)) {
        setConnectionState('reconnecting');
        scheduleReconnect();
      }
    });

    client.on('message', (message: WSMessage) => {
      // Track sequence numbers for recovery
      if ((message as any).sequence) {
        setLastSequence(prev => ({
          ...prev,
          [(message as any).channel]: (message as any).sequence,
        }));
      }
      
      options.onMessage(message);
    });

    client.on('error', (error) => {
      options.onError?.(error);
    });

    client.connect();
    clientRef.current = client;
  }, [options]);

  const scheduleReconnect = useCallback(() => {
    const delay = reconnectionRef.current.getNextDelay();
    
    if (delay < 0) {
      setConnectionState('disconnected');
      return;
    }

    reconnectTimerRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connect]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    clientRef.current?.disconnect();
  }, []);

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return {
    connectionState,
    send: clientRef.current?.send.bind(clientRef.current),
    lastSequence,
  };
}
```

### Backend Error Handling

```typescript
// src/websocket/errorHandler.ts

import type { WebSocket } from 'elysia';

export class WebSocketErrorHandler {
  static handleError(ws: WebSocket, error: Error, context?: string): void {
    console.error(`WebSocket Error (${context}):`, error);

    let code = 'SERVER_ERROR';
    let message = 'An unexpected error occurred';
    let closeCode = 1011;

    // Categorize errors
    if (error instanceof SyntaxError) {
      code = 'INVALID_MESSAGE';
      message = 'Invalid message format';
      closeCode = 1003;
    } else if (error instanceof TypeError) {
      code = 'INVALID_TYPE';
      message = 'Invalid message type or structure';
      closeCode = 1003;
    } else if ((error as any).code === 'RATE_LIMITED') {
      code = 'RATE_LIMITED';
      message = 'Too many messages, please slow down';
      closeCode = 1008;
    }

    // Send error to client
    ws.send(JSON.stringify({
      type: 'ERROR',
      code,
      message,
      timestamp: Date.now(),
    }));

    // Close connection for critical errors
    if (closeCode !== 1011) {
      ws.close(closeCode, message);
    }
  }

  static handleUncaughtError(error: Error): void {
    console.error('Uncaught WebSocket error:', error);
    // Log to monitoring service
    // Consider restarting the WebSocket server if needed
  }
}

// Global error handler
process.on('uncaughtException', (error) => {
  WebSocketErrorHandler.handleUncaughtError(error);
});

process.on('unhandledRejection', (reason) => {
  if (reason instanceof Error) {
    WebSocketErrorHandler.handleUncaughtError(reason);
  }
});
```

---

## Security Considerations

### Authentication

```typescript
// src/middleware/auth.ts

import { Elysia } from 'elysia';
import jwt from 'jsonwebtoken';

export const authMiddleware = new Elysia()
  .onBeforeHandle(async ({ request, set }) => {
    // Skip auth for health checks
    if (request.url.includes('/health')) return;

    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      set.status = 401;
      return 'Unauthorized';
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        userId: string;
        role: string;
      };
      
      // Attach user to context
      return { user: decoded };
    } catch {
      set.status = 403;
      return 'Invalid token';
    }
  });
```

### Rate Limiting

```typescript
// src/middleware/rateLimit.ts

import { Elysia } from 'elysia';
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export const rateLimitMiddleware = new Elysia()
  .onBeforeHandle(async ({ request, set }) => {
    const clientId = request.headers.get('x-client-id') || 
                     request.headers.get('x-forwarded-for') || 
                     'unknown';
    
    const key = `ratelimit:${clientId}`;
    const limit = 100; // messages per minute
    const window = 60; // seconds

    const current = await redis.incr(key);
    
    if (current === 1) {
      await redis.expire(key, window);
    }

    if (current > limit) {
      set.status = 429;
      return 'Rate limit exceeded';
    }

    // Add rate limit headers
    set.headers['X-RateLimit-Limit'] = limit.toString();
    set.headers['X-RateLimit-Remaining'] = Math.max(0, limit - current).toString();
  });
```

### Message Validation

```typescript
// src/validation/messageSchema.ts

import { z } from 'zod';

export const messageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('PING'),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal('SUBSCRIBE'),
    channels: z.array(z.string()).min(1).max(10),
  }),
  z.object({
    type: z.literal('UNSUBSCRIBE'),
    channels: z.array(z.string()).min(1),
  }),
  z.object({
    type: z.literal('PUBLISH'),
    channel: z.string(),
    payload: z.unknown(),
  }),
  z.object({
    type: z.literal('REQUEST_SYNC'),
    channel: z.string(),
    lastSequence: z.number().int().nonnegative(),
  }),
]);

export type ValidatedMessage = z.infer<typeof messageSchema>;

export function validateMessage(data: unknown): ValidatedMessage {
  return messageSchema.parse(data);
}
```

---

## Performance Optimization

### Connection Pooling

```typescript
// src/websocket/connectionPool.ts

export class ConnectionPool {
  private pools: Map<string, WebSocket[]> = new Map();
  private maxPoolSize = 100;

  addToPool(channel: string, ws: WebSocket): void {
    if (!this.pools.has(channel)) {
      this.pools.set(channel, []);
    }
    
    const pool = this.pools.get(channel)!;
    
    if (pool.length >= this.maxPoolSize) {
      // Remove oldest connection
      const oldest = pool.shift();
      oldest?.close(1000, 'Pool limit reached');
    }
    
    pool.push(ws);
  }

  broadcastToPool(channel: string, message: string): void {
    const pool = this.pools.get(channel);
    if (!pool) return;

    // Use setImmediate to avoid blocking
    setImmediate(() => {
      for (const ws of pool) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      }
    });
  }
}
```

### Message Batching

```typescript
// src/websocket/messageBatcher.ts

export class MessageBatcher {
  private batches: Map<string, WSMessage[]> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private batchInterval = 50; // ms
  private maxBatchSize = 100;

  add(channel: string, message: WSMessage, send: (msgs: WSMessage[]) => void): void {
    if (!this.batches.has(channel)) {
      this.batches.set(channel, []);
    }

    const batch = this.batches.get(channel)!;
    batch.push(message);

    // Flush immediately if batch is full
    if (batch.length >= this.maxBatchSize) {
      this.flush(channel, send);
      return;
    }

    // Schedule flush
    if (!this.timers.has(channel)) {
      const timer = setTimeout(() => {
        this.flush(channel, send);
      }, this.batchInterval);
      this.timers.set(channel, timer);
    }
  }

  private flush(channel: string, send: (msgs: WSMessage[]) => void): void {
    const batch = this.batches.get(channel);
    if (!batch || batch.length === 0) return;

    // Clear batch
    this.batches.set(channel, []);
    
    // Clear timer
    const timer = this.timers.get(channel);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(channel);
    }

    // Send batch
    send(batch);
  }
}
```

### Binary Protocol (Optional)

```typescript
// For high-frequency scenarios, consider binary protocol
// using MessagePack or Protocol Buffers

import * as msgpack from 'msgpack-lite';

export class BinaryProtocol {
  encode(message: WSMessage): Buffer {
    return msgpack.encode(message);
  }

  decode(data: Buffer): WSMessage {
    return msgpack.decode(data);
  }
}
```

---

## Deployment & Monitoring

### Docker Configuration

```dockerfile
# Dockerfile
FROM oven/bun:1.0

WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install

COPY . .
RUN bun run build

EXPOSE 3000

CMD ["bun", "run", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  websocket:
    build: .
    ports:
      - "3000:3000"
    environment:
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - redis
    deploy:
      replicas: 3

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - websocket

volumes:
  redis_data:
```

### Nginx Configuration

```nginx
# nginx.conf
upstream websocket_backend {
    least_conn;
    server websocket_1:3000;
    server websocket_2:3000;
    server websocket_3:3000;
}

map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

server {
    listen 80;
    server_name ws.yujian.lab;

    location /ws {
        proxy_pass http://websocket_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket specific timeouts
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

### Monitoring & Metrics

```typescript
// src/monitoring/metrics.ts

import { Counter, Histogram, register } from 'prom-client';

export const wsMetrics = {
  connectionsTotal: new Counter({
    name: 'websocket_connections_total',
    help: 'Total number of WebSocket connections',
    labelNames: ['status'],
  }),
  
  messagesTotal: new Counter({
    name: 'websocket_messages_total',
    help: 'Total number of messages',
    labelNames: ['type', 'channel'],
  }),
  
  messageSize: new Histogram({
    name: 'websocket_message_size_bytes',
    help: 'Size of messages in bytes',
    buckets: [100, 500, 1000, 5000, 10000],
  }),
  
  connectionDuration: new Histogram({
    name: 'websocket_connection_duration_seconds',
    help: 'Duration of WebSocket connections',
    buckets: [60, 300, 600, 1800, 3600],
  }),
  
  latency: new Histogram({
    name: 'websocket_latency_seconds',
    help: 'Round-trip latency',
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
  }),
};

// Export metrics endpoint
app.get('/metrics', async () => {
  return register.metrics();
});
```

### Health Checks

```typescript
// src/health/checks.ts

import { Elysia } from 'elysia';

export const healthPlugin = new Elysia()
  .get('/health', async ({ store }) => {
    const checks = {
      websocket: checkWebSocketServer(),
      redis: await checkRedis(),
      database: await checkDatabase(),
    };

    const healthy = Object.values(checks).every(c => c.status === 'ok');

    return {
      status: healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks,
    };
  })
  .get('/health/ready', async () => {
    // Kubernetes readiness probe
    return { ready: true };
  })
  .get('/health/live', async () => {
    // Kubernetes liveness probe
    return { alive: true };
  });
```

---

## Appendix

### A. Environment Variables

```bash
# Server
PORT=3000
NODE_ENV=production

# Security
JWT_SECRET=your-secret-key
ALLOWED_ORIGINS=https://yujian.lab,https://admin.yujian.lab

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=optional

# Rate Limiting
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=100

# Monitoring
METRICS_ENABLED=true
METRICS_PORT=9090
LOG_LEVEL=info
```

### B. WebSocket Close Codes

| Code | Name | Description |
|------|------|-------------|
| 1000 | Normal Closure | Regular close |
| 1001 | Going Away | Server shutdown |
| 1002 | Protocol Error | Invalid protocol |
| 1003 | Unsupported Data | Invalid data type |
| 1006 | Abnormal Closure | Connection lost |
| 1008 | Policy Violation | Rate limit, auth |
| 1009 | Message Too Big | Exceeds limit |
| 1011 | Server Error | Internal error |
| 1015 | TLS Handshake | SSL/TLS error |

### C. Testing Strategy

```typescript
// Example test setup
import { describe, it, expect } from 'bun:test';
import { WebSocketClient } from './WebSocketClient';

describe('WebSocket Client', () => {
  it('should connect and receive acknowledgment', async () => {
    const client = new WebSocketClient({
      url: 'ws://localhost:3000/ws',
      authToken: 'test-token',
    });

    const connected = await new Promise<boolean>((resolve) => {
      client.on('connected', () => resolve(true));
      client.connect();
      setTimeout(() => resolve(false), 5000);
    });

    expect(connected).toBe(true);
    client.disconnect();
  });

  it('should reconnect after disconnection', async () => {
    // Test reconnection logic
  });

  it('should handle message subscription', async () => {
    // Test channel subscription
  });
});
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-02 | Initial specification |

---

**Document Owner**: Yu Jian Lab Engineering Team  
**Review Cycle**: Quarterly  
**Next Review**: 2026-05-02
