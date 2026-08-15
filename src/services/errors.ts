const TECHNICAL_ERROR_PATTERNS = [
  /Error invoking remote method/i,
  /SQLITE_/i,
  /TypeError/i,
  /ReferenceError/i,
  /\bat\s+\S+\s*\(/i,
  /[A-Z]:\\/i,
];

function extractErrorMessage(error: unknown): string | null {
  if (error instanceof Error) {
    return error.message.trim() || null;
  }
  if (typeof error === 'string') {
    return error.trim() || null;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === 'string' ? message.trim() || null : null;
  }
  return null;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  const message = extractErrorMessage(error);
  if (!message || message.length > 160 || TECHNICAL_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
    return fallback;
  }
  return message;
}

export function logRendererError(operation: string, error: unknown): void {
  console.error(`[Renderer ${operation}]`, error);
}
