const DEFAULT_MAX_MESSAGES = 20;

type RoleMessage = {role?: string};

type MessageWithParts = {parts?: unknown[]};

function stripPartMetadata(part: unknown): unknown {
  if (part === null || typeof part !== 'object' || Array.isArray(part)) {
    return part;
  }

  const reasoningPart = part as {type?: unknown; providerMetadata?: unknown};
  if (reasoningPart.type !== 'reasoning') {
    return part;
  }

  const metadata = reasoningPart.providerMetadata;
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return part;
  }

  let changed = false;
  const nextMetadata: Record<string, unknown> = {};
  for (const [provider, options] of Object.entries(metadata)) {
    if (
      options !== null &&
      typeof options === 'object' &&
      !Array.isArray(options) &&
      'reasoningEncryptedContent' in options
    ) {
      const rest = {...options};
      delete rest.reasoningEncryptedContent;
      nextMetadata[provider] = rest;
      changed = true;
    } else {
      nextMetadata[provider] = options;
    }
  }

  if (!changed) {
    return part;
  }

  return {...reasoningPart, providerMetadata: nextMetadata};
}

export function stripReasoningMetadata<T>(messages: T[]): T[] {
  return messages.map(message => {
    if (message === null || typeof message !== 'object' || !('parts' in message)) {
      return message;
    }

    const parts = (message as MessageWithParts).parts;
    if (!Array.isArray(parts)) {
      return message;
    }

    let changed = false;
    const nextParts = parts.map(part => {
      const next = stripPartMetadata(part);
      if (next !== part) {
        changed = true;
      }
      return next;
    });

    if (!changed) {
      return message;
    }

    return {...message, parts: nextParts};
  });
}

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
