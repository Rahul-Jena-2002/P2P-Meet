const HOST = 'com.p2pmeet.remote_control';
let port = null;
const pending = new Map();

function connectNative() {
  if (port) return port;
  try {
    port = chrome.runtime.connectNative(HOST);
    port.onMessage.addListener((payload) => {
      const tabId = pending.get(payload.requestId);
      if (tabId !== undefined) pending.delete(payload.requestId);
      if (tabId !== undefined) chrome.tabs.sendMessage(tabId, { type: 'native-message', payload });
    });
    port.onDisconnect.addListener(() => {
      port = null;
      for (const [requestId, tabId] of pending) {
        chrome.tabs.sendMessage(tabId, { type: 'native-message', payload: { channel: 'P2P_NATIVE_CONTROL', direction: 'response', requestId, ok: false, error: chrome.runtime.lastError?.message || 'Native helper disconnected' } });
      }
      pending.clear();
    });
  } catch (_) { port = null; }
  return port;
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== 'page-message' || !sender.tab?.id) return;
  const payload = message.payload;
  if (!payload || payload.channel !== 'P2P_NATIVE_CONTROL') return;
  const native = connectNative();
  if (!native) {
    if (payload.requestId) chrome.tabs.sendMessage(sender.tab.id, { type: 'native-message', payload: { channel: 'P2P_NATIVE_CONTROL', direction: 'response', requestId: payload.requestId, ok: false, error: 'Install the P2PMeet Windows control helper.' } });
    return;
  }
  if (payload.direction === 'request' && payload.requestId) pending.set(payload.requestId, sender.tab.id);
  try {
    native.postMessage(payload);
  } catch (error) {
    if (payload.requestId) pending.delete(payload.requestId);
    if (payload.requestId) chrome.tabs.sendMessage(sender.tab.id, { type: 'native-message', payload: { channel: 'P2P_NATIVE_CONTROL', direction: 'response', requestId: payload.requestId, ok: false, error: error.message || 'Windows helper disconnected.' } });
  }
});
