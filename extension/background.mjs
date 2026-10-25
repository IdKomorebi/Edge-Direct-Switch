import { Controller } from './controller.mjs';

// The service worker is event-driven: Edge starts it for a popup message, a tab close or a
// browser start, and unloads it again after ~30 s idle. The PAC script itself is kept by
// Edge, so routing keeps working while this worker is asleep.
const controller = new Controller(chrome);
let queue = Promise.resolve();
function serial(task) {
  const result = queue.then(task);
  queue = result.catch(() => {});
  return result;
}

async function badge() {
  const { conflict } = await controller.snapshot();
  await chrome.action.setBadgeText({ text: conflict ? '!' : '' });
  if (conflict) await chrome.action.setBadgeBackgroundColor({ color: '#d97706' });
}

function run(task) {
  serial(task)
    .then(badge)
    .catch((error) => console.error(error));
}

chrome.runtime.onInstalled.addListener(() => run(() => controller.reconcile()));
chrome.runtime.onStartup.addListener(() => run(() => controller.reconcile()));
chrome.proxy.settings.onChange.addListener(() => run(() => {}));
chrome.tabs.onRemoved.addListener((tabId) =>
  run(async () => {
    // Cheap check first: most tab closes have nothing to do with this extension.
    const { temps } = await chrome.storage.session.get('temps');
    if (temps?.some((r) => r.tabId === tabId))
      await controller.mutate({ type: 'tabClosed', tabId });
  }),
);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;
  serial(async () => {
    if (message.type !== 'snapshot') await controller.mutate(message);
    return controller.snapshot(message.host);
  })
    .then(
      (data) => sendResponse({ ok: true, data }),
      (error) => sendResponse({ ok: false, error: error.message }),
    )
    .finally(() => badge().catch(() => {}));
  return true;
});
