(() => {
  const channel = 'P2P_NATIVE_CONTROL';
  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const message = event.data;
    if (!message || message.channel !== channel || !['request', 'input'].includes(message.direction)) return;
    chrome.runtime.sendMessage({ type: 'page-message', payload: message });
  });
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== 'native-message' || !message.payload) return;
    window.postMessage(message.payload, location.origin);
  });
})();
