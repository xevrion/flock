// Public entry point for the SDK. Everything an app can import lives here.
// Keep this an explicit list of named exports so the published surface is stable.

export type {
  UserId,
  UserMetadata,
  CursorPosition,
  UserCursor,
  PresenceUser,
  ConnectionStatus,
  FlockClientOptions,
  RoomOptions,
  FlockRoom,
} from "./types.js";

export type {
  ClientMessage,
  ServerMessage,
} from "./messages.js";

export { FlockClient } from "./client.js";
export { FlockError } from "./errors.js";
export type { FlockErrorCode } from "./errors.js";
export { interpolateCursor, createInterpolator } from "./interpolate.js";
export type { Interpolator } from "./interpolate.js";
export { normalizeCursorPosition } from "./throttle.js";
