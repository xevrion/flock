// Shared types used across the client, room, and wire protocol.

export type UserId = string;

export interface UserMetadata {
  name?: string;
  color?: string;
  avatar?: string;
  [key: string]: unknown;
}

export interface CursorPosition {
  x: number;
  y: number;
}

export interface UserCursor {
  userId: UserId;
  position: CursorPosition;
  metadata: UserMetadata;
  lastUpdatedAt: number;
}

export interface PresenceUser {
  userId: UserId;
  metadata: UserMetadata;
  joinedAt: number;
}

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "error";

export interface FlockClientOptions {
  serverUrl: string;
  apiKey?: string;
  reconnect?: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  };
}

export interface RoomOptions {
  userId: UserId;
  metadata?: UserMetadata;
  cursor?: {
    throttleMs?: number;
    normalize?: boolean;
  };
}

export interface FlockRoom {
  readonly roomId: string;
  getCursors(): Map<UserId, UserCursor>;
  getPresence(): Map<UserId, PresenceUser>;
  getMyPresence(): UserMetadata;

  updateCursor(position: CursorPosition): void;
  updatePresence(metadata: Partial<UserMetadata>): void;
  leave(): void;

  on(event: "cursor:update", handler: (userId: UserId, cursor: UserCursor) => void): () => void;
  on(event: "cursor:remove", handler: (userId: UserId) => void): () => void;
  on(event: "presence:join", handler: (userId: UserId, user: PresenceUser) => void): () => void;
  on(event: "presence:leave", handler: (userId: UserId) => void): () => void;
  on(event: "presence:update", handler: (userId: UserId, metadata: UserMetadata) => void): () => void;
  off(event: string, handler: (...args: unknown[]) => void): void;
}
