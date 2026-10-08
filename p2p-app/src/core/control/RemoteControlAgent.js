/**
 * RemoteControlAgent implements an encrypted, consent-gated remote desktop/control agent.
 * Security rules:
 * - All control macros are strictly dropped unless explicit per-session consent has been granted.
 * - Actions are encrypted using AES-GCM across control plane data channels.
 */

export class RemoteControlAgent {
  constructor({ localUserId = 'local-user', cryptoInstance = globalThis.crypto } = {}) {
    this.localUserId = localUserId;
    this.crypto = cryptoInstance;

    this.consentGranted = false;
    this.authorizedPeerId = null;
    this.listeners = new Map();
  }

  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  emit(event, data) {
    this.listeners.get(event)?.forEach((fn) => {
      try { fn(data); } catch (_) {}
    });
  }

  grantConsent(peerId) {
    this.consentGranted = true;
    this.authorizedPeerId = peerId;
    this.emit('consentChanged', { granted: true, authorizedPeerId: peerId });
  }

  revokeConsent() {
    this.consentGranted = false;
    this.authorizedPeerId = null;
    this.emit('consentChanged', { granted: false, authorizedPeerId: null });
  }

  isConsentGranted(peerId) {
    return this.consentGranted && this.authorizedPeerId === peerId;
  }

  /**
   * Evaluates an incoming remote macro action against the consent security gate.
   */
  handleRemoteAction(senderPeerId, action) {
    if (!this.isConsentGranted(senderPeerId)) {
      this.emit('actionBlocked', { senderPeerId, action });
      return {
        executed: false,
        reason: 'Consent not granted for sender'
      };
    }

    this.emit('actionExecuted', { senderPeerId, action });
    return {
      executed: true,
      action
    };
  }

  /**
   * Encrypts a remote action payload using AES-GCM.
   */
  async encryptAction(action, mediaKey) {
    const enc = new TextEncoder();
    const dataBytes = enc.encode(JSON.stringify(action));

    const iv = new Uint8Array(12);
    this.crypto.getRandomValues(iv);

    const ciphertext = await this.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      mediaKey,
      dataBytes
    );

    return {
      ciphertextHex: this.bufferToHex(ciphertext),
      ivHex: this.bufferToHex(iv)
    };
  }

  /**
   * Decrypts an encrypted remote control packet and processes through consent gate.
   */
  async receiveEncryptedAction(senderPeerId, encryptedPayload, mediaKey) {
    const iv = this.hexToBuffer(encryptedPayload.ivHex);
    const ciphertext = this.hexToBuffer(encryptedPayload.ciphertextHex);

    const decrypted = await this.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      mediaKey,
      ciphertext
    );

    const dec = new TextDecoder();
    const action = JSON.parse(dec.decode(decrypted));

    return this.handleRemoteAction(senderPeerId, action);
  }

  bufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  hexToBuffer(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
  }
}
