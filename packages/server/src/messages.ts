// Wire message types, kept identical to the client's copy in @flock-sdk/core so
// both ends agree on the protocol without depending on each other at runtime.

export type UserMetadata = {
  name?: string;
  color?: string;
  avatar?: string;
  [key: string]: unknown;
};

export type ClientMessage = { type: string; roomId?: string } & Record<string, unknown>;
export type ServerMessage = { type: string } & Record<string, unknown>;
