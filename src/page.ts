import { element } from './ui';
const reflections = [
  'A quiet mind is not an empty mind. It is a mind with room to notice.',
  'You are allowed to leave a little space unfilled.',
  'Attention is a place you live. Make it somewhere kind.',
  'There is no finish line for being here. Only this breath, and the next.',
  'Rest is not a reward for doing enough. It is part of being alive.',
];
element('reflection').textContent = `“${reflections[Math.floor(Math.random() * reflections.length)]}”`;
element('close-tab').addEventListener('click', async () => {
  try {
    const tab = await chrome.tabs.getCurrent();
    if (tab?.id !== undefined) { await chrome.tabs.remove(tab.id); return; }
  } catch { /* An externally opened preview may not be an extension tab. */ }
  element('close-note').hidden = false;
});
