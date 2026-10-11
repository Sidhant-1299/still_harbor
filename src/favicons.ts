const MAX_BYTES = 32 * 1024;

export function canFetchIcon(domain: string): boolean {
  // Do not probe literal IPs, localhost, or common local-only names.
  return domain.includes('.') && !/^[\d.]+$/.test(domain) && !domain.includes(':') && !/(^|\.)(localhost|local|internal|test|invalid|example)$/.test(domain);
}

export function rasterMime(bytes: Uint8Array): string | null {
  const starts = (signature: number[]) => signature.every((byte, i) => bytes[i] === byte);
  if (starts([137, 80, 78, 71, 13, 10, 26, 10])) return 'image/png';
  if (starts([0, 0, 1, 0]) && bytes.length >= 6 && (bytes[4] !== 0 || bytes[5] !== 0)) return 'image/x-icon';
  if (starts([255, 216, 255])) return 'image/jpeg';
  if (starts([71, 73, 70, 56, 55, 97]) || starts([71, 73, 70, 56, 57, 97])) return 'image/gif';
  if (starts([82, 73, 70, 70]) && bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80) return 'image/webp';
  return null; // No SVG, HTML, scripts, or externally referenced image content.
}

export async function fetchIcon(domain: string, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<string | null> {
  if (!canFetchIcon(domain)) return null;
  const hosts = domain.startsWith('www.') ? [domain] : [domain, `www.${domain}`];
  for (const host of hosts) {
    if (signal.aborted) return null;
    try {
      const response = await fetcher(`https://${host}/favicon.ico`, {
        signal, credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', cache: 'no-store',
      });
      if (!response.ok || !response.body || Number(response.headers.get('content-length')) > MAX_BYTES) {
        await response.body?.cancel();
        continue;
      }
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.length;
          if (length > MAX_BYTES) { await reader.cancel(); break; }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      if (length > MAX_BYTES || !length) continue;
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      const mime = rasterMime(bytes);
      if (!mime) continue;
      return `data:${mime};base64,${btoa(String.fromCharCode(...bytes))}`;
    } catch { /* Missing icon, redirect, offline, or timeout: keep the quiet fallback. */ }
  }
  return null;
}

export class FaviconRequests {
  private pending = new Map<string, Promise<string | null>>();
  private controllers = new Set<AbortController>();
  private generation = 0;
  private running = 0;
  private waiters: (() => void)[] = [];
  constructor(private allowed: (domain: string) => boolean, private fetcher: typeof fetch = (...args) => fetch(...args)) {}
  private async acquire(): Promise<void> {
    if (this.running < 3) { this.running++; return; }
    await new Promise<void>(resolve => this.waiters.push(resolve));
  }
  private release(): void {
    const next = this.waiters.shift();
    if (next) next(); else this.running--;
  }

  clear(): void {
    this.generation++;
    for (const controller of this.controllers) controller.abort();
  }

  async get(domain: string): Promise<string | null> {
    if (!this.allowed(domain) || !canFetchIcon(domain)) return null;
    if (this.pending.has(domain)) return this.pending.get(domain)!;
    const generation = this.generation;
    const task = (async () => {
      await this.acquire();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      this.controllers.add(controller);
      try {
        if (!this.allowed(domain) || generation !== this.generation) return null;
        const data = await fetchIcon(domain, controller.signal, this.fetcher);
        if (!this.allowed(domain) || generation !== this.generation) return null;
        return data;
      } finally {
        clearTimeout(timeout);
        this.controllers.delete(controller);
        this.release();
        this.pending.delete(domain);
      }
    })();
    this.pending.set(domain, task);
    return task;
  }
}
