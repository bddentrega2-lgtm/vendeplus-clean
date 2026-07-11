type DisengagementConnection = {
  disengagement_requested_at?: string | null;
  disengagement_confirmed_at?: string | null;
  disengagement_effective_at?: string | null;
};

export function getTransportDisengagementEffectiveAt(now = new Date()) {
  return now.toISOString();
}

export function isTransportConnectionEnded(
  connection: DisengagementConnection | null | undefined,
  now = new Date()
) {
  if (!connection?.disengagement_confirmed_at || !connection.disengagement_effective_at) {
    return false;
  }

  return new Date(connection.disengagement_effective_at).getTime() <= now.getTime();
}

export function isTransportDisengagementPending(
  connection: DisengagementConnection | null | undefined,
  now = new Date()
) {
  if (!connection?.disengagement_requested_at) return false;
  return !isTransportConnectionEnded(connection, now);
}
