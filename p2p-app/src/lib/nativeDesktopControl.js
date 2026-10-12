const CHANNEL = 'P2P_NATIVE_CONTROL';
const pending = new Map();
let sequence = 0;
let initialized = false;

function initialize() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const message = event.data;
    if (!message || message.channel !== CHANNEL || message.direction !== 'response') return;
    const waiting = pending.get(message.requestId);
    if (!waiting) {
      // A user can approve the Windows dialog after the browser-side request timed out.
      // Immediately disarm so a late consent can never leave an orphaned control session.
      if (message.kind === 'authorized' && message.allowed) {
        window.postMessage({ channel: CHANNEL, direction: 'input', type: 'revoke' }, window.location.origin);
      }
      return;
    }
    pending.delete(message.requestId);
    clearTimeout(waiting.timeout);
    if (message.ok === false) waiting.reject(new Error(message.error || 'Windows desktop helper is unavailable.'));
    else waiting.resolve(message);
  });
}

export function requestNativeDesktopControl(type) {
  initialize();
  if (typeof window === 'undefined') return Promise.reject(new Error('Desktop control is available in the browser only.'));
  const requestId = `p2p-${Date.now()}-${++sequence}`;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(requestId);
      reject(new Error('The Windows control helper did not reply in time. Install and enable the helper; any late approval will be revoked.'));
    }, 8000);
    pending.set(requestId, { resolve, reject, timeout });
    window.postMessage({ channel: CHANNEL, direction: 'request', type, requestId }, window.location.origin);
  });
}

export function sendNativeDesktopInput(action) {
  if (typeof window === 'undefined') return;
  initialize();
  window.postMessage({ channel: CHANNEL, direction: 'input', ...action }, window.location.origin);
}
