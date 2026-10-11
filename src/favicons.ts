const MAX_BYTES = 32 * 1024;
const MAX_ENTRIES = 48;
const SUCCESS_TTL = 7 * 86400000;
const FAILURE_TTL = 86400000;
export type IconEntry = { data: string | null; fetchedAt: number };
export type IconEntries = Record<string, IconEntry>;

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

export class FaviconCache {
  private entries: IconEntries = {};
  private pending = new Map<string, Promise<string | null>>();
  private controllers = new Set<AbortController>();
  private generation = 0;
  private running = 0;
  private waiters: (() => void)[] = [];
  private writes: Promise<void> = Promise.resolve();

  constructor(private allowed: (domain: string) => boolean, private save: (entries: IconEntries) => Promise<void>, private fetcher: typeof fetch = (...args) => fetch(...args), private now: () => number = Date.now) {}

  restore(stored: IconEntries): void {
    this.entries = Object.fromEntries(Object.entries(stored).filter(([domain, entry]) =>
      canFetchIcon(domain) && entry && typeof entry.fetchedAt === 'number' && entry.fetchedAt <= this.now() &&
      this.now() - entry.fetchedAt < (entry.data ? SUCCESS_TTL : FAILURE_TTL) &&
      (entry.data === null || (typeof entry.data === 'string' && entry.data.length <= 44000 && /^data:image\/(png|x-icon|jpeg|gif|webp);base64,[a-zA-Z0-9+/=]+$/.test(entry.data))),
    ).sort((a, b) => b[1].fetchedAt - a[1].fetchedAt).slice(0, MAX_ENTRIES));
  }

  private persist(): Promise<void> {
    this.writes = this.writes.catch(() => {}).then(() => this.save({ ...this.entries }));
    return this.writes;
  }
  private async acquire(): Promise<void> {
    if (this.running < 3) { this.running++; return; }
    await new Promise<void>(resolve => this.waiters.push(resolve));
  }
  private release(): void {
    const next = this.waiters.shift();
    if (next) next(); else this.running--;
  }

  async clear(): Promise<void> {
    this.generation++;
    for (const controller of this.controllers) controller.abort();
    this.entries = {};
    await this.persist();
  }
  async prune(domains: Set<string>): Promise<void> {
    this.entries = Object.fromEntries(Object.entries(this.entries).filter(([domain, entry]) => domains.has(domain) && this.now() - entry.fetchedAt < (entry.data ? SUCCESS_TTL : FAILURE_TTL)));
    await this.persist();
  }

  async get(domain: string): Promise<string | null> {
    if (!this.allowed(domain) || !canFetchIcon(domain)) return null;
    const entry = Object.hasOwn(this.entries, domain) ? this.entries[domain] : undefined;
    if (entry && this.now() - entry.fetchedAt < (entry.data ? SUCCESS_TTL : FAILURE_TTL)) return entry.data;
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
        this.entries[domain] = { data, fetchedAt: this.now() };
        this.entries = Object.fromEntries(Object.entries(this.entries).sort((a, b) => b[1].fetchedAt - a[1].fetchedAt).slice(0, MAX_ENTRIES));
        await this.persist();
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
