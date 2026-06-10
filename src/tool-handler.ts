import { ApiError } from "./rest-client.js";

// Helper to wrap tool handlers with error handling per MCP best practices
export function toolHandler<T>(
  fn: (params: T) => Promise<unknown>,
): (params: T) => Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }> {
  return async (params: T) => {
    try {
      const result = await fn(params);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      let message: string;
      let errorCode = "UNKNOWN";

      if (err instanceof ApiError) {
        message = err.message;
        errorCode = err.errorCode;
      } else if (err instanceof Error) {
        message = err.message;
        if (err.cause) {
          const cause = err.cause instanceof Error ? err.cause.message : String(err.cause);
          message = `${message} (cause: ${cause})`;
        }
      } else {
        message = String(err);
      }

      console.error(`Tool error [${errorCode}]: ${message}`);
      const errorResponse = { error: errorCode, message };
      return {
        content: [{ type: "text" as const, text: JSON.stringify(errorResponse) }],
        isError: true,
      };
    }
  };
}
