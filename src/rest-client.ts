import { AuthConfig, buildAuthHeaders } from "./auth.js";

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly detail: string;

  constructor(method: string, path: string, statusCode: number, body: string) {
    let errorCode = "UNKNOWN";
    let detail = body;

    try {
      const parsed = JSON.parse(body);
      if (parsed.e) errorCode = parsed.e;
      if (parsed.message) detail = parsed.message;
      else if (parsed.error) detail = parsed.error;
    } catch {
      // body is not JSON — use as-is
    }

    // Map common HTTP status codes to semantic codes
    if (errorCode === "UNKNOWN") {
      if (statusCode === 400) errorCode = "BAD_REQUEST";
      else if (statusCode === 401) errorCode = "UNAUTHORIZED";
      else if (statusCode === 403) errorCode = "FORBIDDEN";
      else if (statusCode === 404) errorCode = "NOT_FOUND";
      else if (statusCode === 409) errorCode = "CONFLICT";
      else if (statusCode === 412) errorCode = "PRECONDITION_FAILED";
      else if (statusCode === 429) errorCode = "RATE_LIMITED";
      else if (statusCode >= 500) errorCode = "SERVER_ERROR";
    }

    super(`${method} ${path} failed [${errorCode}]: ${detail}`);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.detail = detail;
  }
}

export class RestClient {
  private config: AuthConfig;
  private etags: Map<string, string> = new Map();

  constructor(config: AuthConfig) {
    this.config = config;
  }

  async get<T = unknown>(path: string): Promise<T> {
    const url = `${this.config.baseUrl}/api/v1${path}`;
    const headers = buildAuthHeaders(this.config, "GET");
    headers["Content-Type"] = "application/json";

    const etag = this.etags.get(path);
    if (etag) {
      headers["If-None-Match"] = etag;
    }

    const res = await fetch(url, { method: "GET", headers });

    if (res.status === 304) {
      throw new Error("Not modified (304)");
    }

    if (!res.ok) {
      const text = await res.text();
      throw new ApiError("GET", path, res.status, text);
    }

    const newEtag = res.headers.get("ETag");
    if (newEtag) {
      this.etags.set(path, newEtag);
    }

    return res.json() as Promise<T>;
  }

  async post<T = unknown>(path: string, body: unknown): Promise<T> {
    const url = `${this.config.baseUrl}/api/v1${path}`;
    const bodyStr = JSON.stringify(body);

    // Retry once on connection-level failures (undici connection reuse issues)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const headers = buildAuthHeaders(this.config, "POST", bodyStr);
        headers["Content-Type"] = "application/json";

        const etag = this.etags.get(path);
        if (etag) {
          headers["If-Match"] = etag;
        }

        const res = await fetch(url, { method: "POST", headers, body: bodyStr });

        if (!res.ok) {
          const text = await res.text();
          throw new ApiError("POST", path, res.status, text);
        }

        const newEtag = res.headers.get("ETag");
        if (newEtag) {
          this.etags.set(path, newEtag);
        }

        const text = await res.text();
        if (!text) return {} as T;
        return JSON.parse(text) as T;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        // Only retry on connection-level failures, not HTTP errors
        if (attempt === 0 && (msg === "fetch failed" || msg.includes("ECONNRESET") || msg.includes("socket hang up"))) {
          console.error(`POST ${path}: connection failed, retrying...`);
          continue;
        }
        throw err;
      }
    }
    throw new Error(`POST ${path}: unreachable`);
  }

  async delete<T = unknown>(path: string, body?: unknown): Promise<T> {
    const url = `${this.config.baseUrl}/api/v1${path}`;
    const bodyStr = body ? JSON.stringify(body) : "";
    const headers = buildAuthHeaders(this.config, "DELETE", bodyStr);
    headers["Content-Type"] = "application/json";

    const etag = this.etags.get(path);
    if (etag) {
      headers["If-Match"] = etag;
    }

    const res = await fetch(url, {
      method: "DELETE",
      headers,
      body: bodyStr || undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new ApiError("DELETE", path, res.status, text);
    }

    const text = await res.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  }

  /** Store an etag for a specific path (useful after queries) */
  setEtag(path: string, etag: string) {
    this.etags.set(path, etag);
  }

  /** Get stored etag */
  getEtag(path: string): string | undefined {
    return this.etags.get(path);
  }
}
