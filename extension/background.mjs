import { Controller } from './controller.mjs';
const controller = new Controller(chrome);
let queue = Promise.resolve();
function serial(task) {
  const result = queue.then(task);
  queue = result.catch(() => {});
  return result;
}
async function badge(error = false) {
  const snap = await controller.snapshot();
  const warn = error || (snap.state.enabled && !snap.effective);
  await chrome.action.setBadgeText({ text: warn ? '!' : snap.effective ? 'ON' : '' });
  await chrome.action.setBadgeBackgroundColor({ color: warn ? '#b45309' : '#087f70' });
  await chrome.action.setTitle({
    title: warn
      ? '网站直连开关：需要检查设置'
      : snap.effective
        ? '网站直连开关：分流已启用'
        : '网站直连开关：跟随系统代理',
  });
}
function maintenance(task) {
  serial(task)
    .then(() => badge())
    .catch((error) => {
      console.error(error);
      badge(true).catch(() => {});
    });
}
// A new worker also reconciles expired rules left in a persisted PAC after restart.
maintenance(() => controller.reconcile());
chrome.runtime.onInstalled.addListener(() => maintenance(() => controller.reconcile()));
chrome.runtime.onStartup.addListener(() => maintenance(() => controller.reconcile()));
chrome.proxy.settings.onChange.addListener(() => {
  serial(() => badge()).catch(console.error);
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'expire-direct-rules')
    maintenance(() => controller.mutate({ type: 'expire' }));
});
chrome.tabs.onRemoved.addListener((tabId) =>
  maintenance(async () => {
    const state = await controller.load();
    if (state.temporary.some((r) => r.tabId === tabId))
      await controller.mutate({ type: 'tabClosed', tabId });
  }),
);
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;
  serial(async () => {
    if (message.type !== 'snapshot') await controller.mutate(message);
    const data = await controller.snapshot(message.host);
    await badge();
    return data;
  }).then(
    (data) => sendResponse({ ok: true, data }),
    (error) => {
      sendResponse({ ok: false, error: error.message });
      badge(true).catch(() => {});
    },
  );
  return true;
});
