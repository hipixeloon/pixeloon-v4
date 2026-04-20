export async function getEdgeFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as { context?: { json?: () => Promise<unknown>; text?: () => Promise<string> } }).context;
    if (context?.json) {
      try {
        const payload = await context.json() as { error?: string; message?: string };
        if (payload?.error) return payload.error;
        if (payload?.message) return payload.message;
      } catch {
        // ignore JSON parsing failures and use fallback
      }
    }
    if (context?.text) {
      try {
        const raw = (await context.text())?.trim();
        if (raw) {
          try {
            const payload = JSON.parse(raw) as { error?: string; message?: string };
            if (payload?.error) return payload.error;
            if (payload?.message) return payload.message;
          } catch {
            return raw;
          }
        }
      } catch {
        // ignore text parsing failures and use fallback
      }
    }
  }

  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object') {
    const maybeError = error as { error?: string; message?: string };
    if (maybeError.error) return maybeError.error;
    if (maybeError.message) return maybeError.message;
  }
  return fallback;
}
