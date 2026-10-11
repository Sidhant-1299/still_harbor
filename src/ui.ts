import { duration, type Snapshot } from './core';
export async function request<T = null>(type: string, values: Record<string, unknown> = {}): Promise<T> {
  const response = await chrome.runtime.sendMessage({ type, ...values });
  if (!response?.ok) throw new Error(response?.error || 'The extension could not respond. Reload this page and try again.');
  return response.data as T;
}
export const snapshot = () => request<Snapshot>('snapshot');
export function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element: ${id}`);
  return node as T;
}
export function notify(text: string, error = false): void {
  const node = element('notice');
  node.textContent = text;
  node.classList.toggle('error', error);
  node.hidden = !text;
}
export function download(name: string, data: string, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const COLORS = ['#628c77', '#b8a178', '#809bb0', '#b78c80', '#918aae', '#90a99c'];
export function chart(target: HTMLElement, entries: [string, number][], compact = false): void {
  target.replaceChildren();
  const sum = entries.reduce((total, [, ms]) => total + ms, 0);
  if (!sum) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'A fresh start. Your browsing insights will appear here.';
    target.append(empty);
    return;
  }
  const shown = entries.slice(0, 5);
  if (entries.length > 5) shown.push(['Other domains', entries.slice(5).reduce((total, [, ms]) => total + ms, 0)]);
  const ring = document.createElement('div');
  ring.className = 'donut';
  ring.setAttribute('role', 'img');
  ring.setAttribute('aria-label', `Browsing time: ${shown.map(([domain, ms]) => `${domain} ${duration(ms)}`).join(', ')}`);
  let start = 0;
  ring.style.background = `conic-gradient(${shown.map(([, ms], index) => {
    const end = start + ms / sum * 100;
    const stop = `${COLORS[index]} ${start}% ${end}%`;
    start = end;
    return stop;
  }).join(', ')})`;
  const center = document.createElement('div');
  const time = document.createElement('strong');
  time.textContent = duration(sum);
  const label = document.createElement('span');
  label.textContent = 'active browsing';
  center.append(time, label);
  ring.append(center);
  const legend = document.createElement('ul');
  legend.className = 'legend';
  shown.forEach(([domain, ms], index) => {
    const li = document.createElement('li');
    const dot = document.createElement('i');
    dot.style.backgroundColor = COLORS[index];
    const title = document.createElement('span');
    title.textContent = domain;
    const value = document.createElement('strong');
    value.textContent = duration(ms);
    li.append(dot, title, value);
    legend.append(li);
  });
  target.className = compact ? 'chart compact' : 'chart';
  target.append(ring, legend);
}
