import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { build } from 'esbuild';
import { DEFAULTS, type Snapshot } from '../src/core';

const bundle = build({ entryPoints: ['src/background.ts'], bundle: true, write: false, format: 'iife', platform: 'browser' });
type Reply = { ok: boolean; data?: Snapshot; error?: string };

async function startWorker(missingWindow = false) {
  const state = { missingWindow, missingTab: false, idleFailure: false, focused: true };
  const local: Record<string, unknown> = { settings: structuredClone(DEFAULTS) };
  const session: Record<string, unknown> = {};
  const errors: unknown[][] = [];
  let listener!: (message: unknown, sender: unknown, respond: (reply: Reply) => void) => void;
  const event = { addListener() {} };
  const store = (data: Record<string, unknown>) => ({
    get: async () => structuredClone(data),
    set: async (value: Record<string, unknown>) => { Object.assign(data, structuredClone(value)); },
    remove: async (key: string) => { delete data[key]; },
    setAccessLevel: async () => {},
  });
  const chrome = {
    extension: { inIncognitoContext: false },
    runtime: {
      id: 'test', getURL: (path: string) => `chrome-extension://test/${path}`, onStartup: event,
      onMessage: { addListener(fn: typeof listener) { listener = fn; } },
    },
    storage: { local: store(local), session: store(session), onChanged: event },
    windows: {
      getLastFocused: async () => {
        if (state.missingWindow) throw new Error('No last-focused window');
        return { id: 1, focused: state.focused };
      },
      onFocusChanged: event,
    },
    idle: {
      queryState: async () => {
        if (state.idleFailure) throw new Error('Idle state unavailable');
        return 'active';
      },
      setDetectionInterval() {}, onStateChanged: event,
    },
    tabs: {
      query: async (query: { active?: boolean }) => {
        if (!query.active) return [];
        if (state.missingTab) throw new Error('No window with id: 1.');
        return [{ id: 2, url: 'https://reading.test/article', incognito: false }];
      },
      onActivated: event, onUpdated: event, onRemoved: event,
    },
    alarms: { create: async () => {}, onAlarm: event },
    webNavigation: { onCommitted: event, onHistoryStateUpdated: event },
    declarativeNetRequest: {
      RuleActionType: { REDIRECT: 'redirect' }, ResourceType: { MAIN_FRAME: 'main_frame' },
      getDynamicRules: async () => [], updateDynamicRules: async () => {},
      isRegexSupported: async () => ({ isSupported: true }),
    },
  };
  vm.runInNewContext((await bundle).outputFiles![0].text, {
    chrome, Error, URL, TextEncoder, TextDecoder, structuredClone, crypto: webcrypto,
    console: { error: (...args: unknown[]) => errors.push(args) },
  });
  const send = (message: Record<string, unknown>) => new Promise<Reply>(resolve => {
    listener(message, { id: 'test', url: 'chrome-extension://test/dashboard.html' }, resolve);
  });
  const activityDomain = () => (session.activity as { domain: string } | null)?.domain;
  return { state, local, session, errors, send, activityDomain };
}

test('worker starting without a window still accepts settings requests and recovers', async () => {
  const worker = await startWorker(true);
  assert.equal((await worker.send({ type: 'snapshot' })).ok, true);
  assert.equal(worker.session.activity, null);
  assert.equal((await worker.send({ type: 'set-enabled', enabled: false })).ok, true);
  worker.state.missingWindow = false;
  const snapshot = await worker.send({ type: 'snapshot' });
  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.data!.settings.enabled, false);
  assert.equal(worker.activityDomain(), 'reading.test');
  assert.equal(worker.errors.length, 0);
});

test('window loss does not prevent adding, editing or deleting boundaries', async () => {
  const worker = await startWorker();
  assert.equal((await worker.send({ type: 'snapshot' })).ok, true);
  worker.state.missingWindow = true;
  const rule = { kind: 'domain', value: 'noise.test', redirect: '', enabled: true };
  assert.equal((await worker.send({ type: 'add-rule', rule })).ok, true);
  let snapshot = await worker.send({ type: 'snapshot' });
  const id = snapshot.data!.settings.rules[0].id;
  assert.equal((await worker.send({ type: 'update-rule', id, rule: { ...rule, value: 'other.test' } })).ok, true);
  snapshot = await worker.send({ type: 'snapshot' });
  assert.equal(snapshot.data!.settings.rules[0].value, 'other.test');
  assert.equal(worker.session.activity, null);
  assert.equal((await worker.send({ type: 'delete-rule', id })).ok, true);
  assert.equal((await worker.send({ type: 'snapshot' })).data!.settings.rules.length, 0);
  worker.state.missingWindow = false;
  assert.equal((await worker.send({ type: 'snapshot' })).ok, true);
  assert.equal(worker.activityDomain(), 'reading.test');
});

test('window disappearing during active-tab lookup clears activity and allows recovery', async () => {
  const worker = await startWorker();
  assert.equal((await worker.send({ type: 'snapshot' })).ok, true);
  worker.state.missingTab = true;
  assert.equal((await worker.send({ type: 'snapshot' })).ok, true);
  assert.equal(worker.session.activity, null);
  assert.equal((await worker.send({ type: 'set-enabled', enabled: false })).ok, true);
  worker.state.missingTab = false;
  assert.equal((await worker.send({ type: 'snapshot' })).ok, true);
  assert.equal(worker.activityDomain(), 'reading.test');
});

test('unavailable idle state and unfocused windows do not track browsing or block settings', async () => {
  const worker = await startWorker();
  assert.equal((await worker.send({ type: 'snapshot' })).ok, true);
  worker.state.idleFailure = true;
  assert.equal((await worker.send({ type: 'snapshot' })).ok, true);
  assert.equal(worker.session.activity, null);
  worker.state.idleFailure = false;
  worker.state.focused = false;
  assert.equal((await worker.send({ type: 'snapshot' })).ok, true);
  assert.equal(worker.session.activity, null);
});
