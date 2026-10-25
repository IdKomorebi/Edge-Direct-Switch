export const $ = (id) => document.getElementById(id);
export async function request(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(response?.error || '扩展后台未响应，请在扩展管理页重新加载。');
  return response.data;
}
export function showMessage(text, error = false) {
  $('message').textContent = text;
  $('message').className = `message${error ? ' error' : ''}`;
  $('message').hidden = !text;
}
export async function busy(task) {
  const controls = [...document.querySelectorAll('button')].map((button) => [
    button,
    button.disabled,
  ]);
  controls.forEach(([button]) => {
    button.disabled = true;
  });
  try {
    await task();
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    controls.forEach(([button, disabled]) => {
      button.disabled = disabled;
    });
  }
}
export function controlWarning(snapshot) {
  if (snapshot.state.enabled && !snapshot.effective)
    return '分流尚未生效：请检查是否有其他代理扩展、组织策略或代理配置冲突。';
  return '';
}
