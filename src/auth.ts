import { createHmac } from "crypto";

export interface AuthConfig {
  apiKey: string;
  secretKey: string;
  baseUrl: string;
}

/**
 * Generate HMAC-SHA256 signature for POST/PUT/DELETE requests.
 * Uses timestamp method: Content=<body>\nTimestamp=<ts>
 */
export function generateSignature(
  secretKey: string,
  body: string,
  timestamp: number
): string {
  const message = `Content=${body}\nTimestamp=${timestamp}`;
  const b64 = createHmac("sha256", secretKey).update(message).digest("base64");
  // Convert to base64url: replace + with -, / with _, strip trailing =
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/**
 * Build auth headers for a request.
 * GET requests only need X-YB-API-Key.
 * POST/PUT/DELETE also need X-YB-Timestamp + X-YB-Sign.
 */
export function buildAuthHeaders(
  config: AuthConfig,
  method: string,
  body?: string
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-YB-API-Key": config.apiKey,
  };

  if (method !== "GET") {
    const timestamp = Date.now() * 1000; // microseconds
    const content = body || "";
    const signature = generateSignature(config.secretKey, content, timestamp);
    headers["X-YB-Timestamp"] = timestamp.toString();
    headers["X-YB-Sign"] = signature;
  }

  return headers;
}
