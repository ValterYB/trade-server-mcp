import { AuthConfig, buildAuthHeaders } from "./auth.js";

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
      throw new Error(`GET ${path} failed: ${res.status} ${text}`);
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
          throw new Error(`POST ${path} failed: ${res.status} ${text}`);
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
      throw new Error(`DELETE ${path} failed: ${res.status} ${text}`);
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
