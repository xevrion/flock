// Stores presence in Redis with a TTL that heartbeats keep alive. When the TTL
// lapses (an ungraceful disconnect), expiry notifications drive user eviction.

export {};
