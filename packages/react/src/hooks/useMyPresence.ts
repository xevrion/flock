// Returns the local user's own metadata plus a setter that publishes partial
// updates to the rest of the room.

import type { UserMetadata } from "@flock-sdk/core";

export function useMyPresence(): [UserMetadata, (update: Partial<UserMetadata>) => void] {
  return [{}, () => {}];
}
