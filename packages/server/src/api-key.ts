// Optional auth: when API keys are configured, validates the key on a join and
// rejects the connection if it doesn't match. Skipped entirely when unset.

// Returns true if the key is valid (or if no keys are configured), false if
// the key is missing or doesn't match any of the allowed keys.
export function validateApiKey(
  providedKey: string | undefined,
  allowedKeys: string[] | undefined,
): boolean {
  if (!allowedKeys || allowedKeys.length === 0) return true;
  if (!providedKey) return false;
  return allowedKeys.includes(providedKey);
}
