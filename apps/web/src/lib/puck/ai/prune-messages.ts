const DEFAULT_MAX_MESSAGES = 20;

type RoleMessage = {role?: string};

export function pruneMessages<T extends RoleMessage>(messages: T[], max = DEFAULT_MAX_MESSAGES): T[] {
  if (messages.length <= max) {
    return messages;
  }

  let start = messages.length - max;
  while (start < messages.length && messages[start]?.role !== 'user') {
    start += 1;
  }

  if (start >= messages.length) {
    const lastUser = [...messages].reverse().findIndex(message => message.role === 'user');
    if (lastUser === -1) {
      return messages.slice(-max);
    }
    return messages.slice(messages.length - 1 - lastUser);
  }

  return messages.slice(start);
}

export function isUserTurn(messages: unknown[]): boolean {
  const last = messages[messages.length - 1];
  return Boolean(last && typeof last === 'object' && 'role' in last && (last as {role?: unknown}).role === 'user');
}
