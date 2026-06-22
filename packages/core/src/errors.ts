// Error type surfaced to apps so they can branch on a stable `code` instead of
// parsing error message strings.

export type FlockErrorCode =
  | "CONNECTION_FAILED"
  | "INVALID_API_KEY"
  | "ROOM_NOT_FOUND"
  | "MAX_RECONNECT_ATTEMPTS_EXCEEDED"
  | "UNEXPECTED_SERVER_MESSAGE";

export class FlockError extends Error {
  readonly code: FlockErrorCode;

  constructor(code: FlockErrorCode, message: string) {
    super(message);
    this.name = "FlockError";
    this.code = code;
  }
}
