/**
 * Helper retry các thao tác database khi gặp lỗi mạng tạm thời hoặc pooler đóng kết nối ngầm.
 */
export async function withDbRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 2,
  baseDelayMs = 300
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (err: unknown) {
      attempt++;
      const errorObj = err as Record<string, unknown>;
      const msg = err instanceof Error ? err.message : String(err);
      const code = typeof errorObj?.code === 'string' ? errorObj.code : undefined;

      const isTransient =
        msg.includes("Can't reach database server") ||
        msg.includes('Connection closed') ||
        msg.includes('server closed the connection unexpectedly') ||
        code === 'P1001' || // Can't reach database server
        code === 'P1002' || // Database server timed out
        code === 'P1008' || // Operations timed out
        code === 'P1017' || // Server has closed the connection
        code === 'P2024';   // Timed out fetching a connection from the pool

      if (isTransient && attempt <= maxRetries) {
        const delay = baseDelayMs * attempt;
        console.warn(`[DB Retry] Transient connection error (${code ?? 'P1001'}). Retrying attempt ${attempt}/${maxRetries} after ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
}
