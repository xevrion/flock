// Wire message types, kept identical to the client's copy in @flock-sdk/core so
// both ends agree on the protocol. Defined independently (no import from core)
// to keep the two packages free of any runtime dependency on each other.

export interface UserMetadata {
  name?: string;
  color?: string;
  avatar?: string;
  [key: string]: unknown;
}

// Messages the client sends to the server.

// First message after the socket opens. Identifies the user and room, and
// carries the API key when the server requires one.
export interface JoinMessage {
  type: "join";
  roomId: string;
  userId: string;
  metadata: UserMetadata;
  apiKey?: string;
}

// Periodic keep-alive that refreshes the user's presence TTL on the server.
export interface HeartbeatMessage {
  type: "heartbeat";
  roomId: string;
}

// Sent on mouse movement (throttled by the SDK). Position is normalized 0 to 1.
export interface CursorMoveMessage {
  type: "cursor:move";
  roomId: string;
  position: { x: number; y: number };
}

// Sent when the pointer leaves the window so others can hide this cursor.
export interface CursorLeaveMessage {
  type: "cursor:leave";
  roomId: string;
}

// Sent when the app changes its own presence metadata.
export interface PresenceUpdateMessage {
  type: "presence:update";
  roomId: string;
  metadata: Partial<UserMetadata>;
}

// Sent on a clean disconnect or when leaving a room.
export interface LeaveMessage {
  type: "leave";
  roomId: string;
}

// Every message a client can send.
export type ClientMessage =
  | JoinMessage
  | HeartbeatMessage
  | CursorMoveMessage
  | CursorLeaveMessage
  | PresenceUpdateMessage
  | LeaveMessage;

// Messages the server sends back to the client.

// Sent right after a join is processed. Full snapshot of who is already in the
// room, including their last cursor position when one is known.
export interface JoinAckMessage {
  type: "join:ack";
  roomId: string;
  users: Array<{
    userId: string;
    metadata: UserMetadata;
    cursor?: { x: number; y: number };
  }>;
}

// Broadcast to existing members when a new user joins.
export interface UserJoinedMessage {
  type: "user:joined";
  roomId: string;
  userId: string;
  metadata: UserMetadata;
}

// Broadcast when a user leaves, whether cleanly or by TTL eviction.
export interface UserLeftMessage {
  type: "user:left";
  roomId: string;
  userId: string;
}

// Broadcast to other members when someone's cursor moves. The timestamp lets
// the receiving client interpolate smoothly between updates.
export interface CursorUpdatedMessage {
  type: "cursor:updated";
  roomId: string;
  userId: string;
  position: { x: number; y: number };
  timestamp: number;
}

// Broadcast when someone's cursor leaves the viewport.
export interface CursorRemovedMessage {
  type: "cursor:removed";
  roomId: string;
  userId: string;
}

// Broadcast when someone updates their presence metadata.
export interface PresenceUpdatedMessage {
  type: "presence:updated";
  roomId: string;
  userId: string;
  metadata: Partial<UserMetadata>;
}

// Sent when the server rejects a request (bad API key, full room, etc.).
export interface ErrorMessage {
  type: "error";
  code: "INVALID_API_KEY" | "ROOM_FULL" | "INTERNAL_ERROR" | "RATE_LIMITED";
  message: string;
}

// Reply to a heartbeat, used by the client to detect a stale connection.
export interface HeartbeatAckMessage {
  type: "heartbeat:ack";
}

// Every message the server can send.
export type ServerMessage =
  | JoinAckMessage
  | UserJoinedMessage
  | UserLeftMessage
  | CursorUpdatedMessage
  | CursorRemovedMessage
  | PresenceUpdatedMessage
  | ErrorMessage
  | HeartbeatAckMessage;
