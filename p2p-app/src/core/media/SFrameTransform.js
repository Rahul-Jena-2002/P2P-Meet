/**
 * SFrameTransform implements WebRTC Insertable Streams encryption and decryption
 * using AES-GCM and SFrame wire format headers.
 * Relays can route raw RTCEncodedVideoFrame / RTCEncodedAudioFrame ciphertexts
 * without knowing the encryption key.
 */

export class SFrameTransform {
  constructor(cryptoInstance = globalThis.crypto) {
    this.crypto = cryptoInstance;
    if (!this.crypto?.subtle) {
      throw new Error('WebCrypto subtle is required for SFrameTransform');
    }
    this.frameCounter = 0;
  }

  /**
   * Generates a random AES-GCM 128-bit media key.
   */
  async generateMediaKey() {
    return await this.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 128 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Imports raw key bytes into an AES-GCM CryptoKey.
   */
  async importMediaKey(rawBytes) {
    return await this.crypto.subtle.importKey(
      'raw',
      rawBytes,
      { name: 'AES-GCM', length: 128 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Exports an AES-GCM key as raw bytes.
   */
  async exportMediaKey(cryptoKey) {
    return await this.crypto.subtle.exportKey('raw', cryptoKey);
  }

  /**
   * Encrypts a raw frame payload using AES-GCM with SFrame header.
   * Frame Wire Format:
   * [Header (1 byte)] [Counter (4 bytes)] [IV Salt (8 bytes)] [Ciphertext + 16B Tag]
   */
  async encryptPayload(rawPayload, mediaKey, keyId = 1) {
    const rawBytes = rawPayload instanceof Uint8Array ? rawPayload : new Uint8Array(rawPayload);

    this.frameCounter = (this.frameCounter + 1) >>> 0;
    const counter = this.frameCounter;

    // 1-byte header: marker (0x80) | (keyId & 0x07)
    const headerByte = 0x80 | (keyId & 0x07);

    // 12-byte IV: 8 bytes random salt + 4 bytes counter
    const iv = new Uint8Array(12);
    this.crypto.getRandomValues(iv.subarray(0, 8));
    const view = new DataView(iv.buffer, iv.byteOffset, 12);
    view.setUint32(8, counter, false);

    // AAD: 1-byte header + 4-byte counter
    const aad = new Uint8Array(5);
    aad[0] = headerByte;
    new DataView(aad.buffer, aad.byteOffset, 5).setUint32(1, counter, false);

    const ciphertextWithTag = await this.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: aad
      },
      mediaKey,
      rawBytes
    );

    // Combined packet: AAD (5 bytes) + IV Salt (8 bytes) + Ciphertext + Tag
    const totalLength = 5 + 8 + ciphertextWithTag.byteLength;
    const packet = new Uint8Array(totalLength);
    packet.set(aad, 0);
    packet.set(iv.subarray(0, 8), 5);
    packet.set(new Uint8Array(ciphertextWithTag), 13);

    return packet;
  }

  /**
   * Decrypts an SFrame packet using the provided AES-GCM mediaKey.
   */
  async decryptPayload(encryptedPacket, mediaKey) {
    const bytes = encryptedPacket instanceof Uint8Array ? encryptedPacket : new Uint8Array(encryptedPacket);
    if (bytes.byteLength < 13 + 16) {
      throw new Error('SFrame packet too short to contain valid header, IV, and tag');
    }

    const aad = bytes.subarray(0, 5);
    const counterView = new DataView(bytes.buffer, bytes.byteOffset, 5);
    const counter = counterView.getUint32(1, false);

    // Reconstruct 12-byte IV: 8 bytes salt + 4 bytes counter
    const iv = new Uint8Array(12);
    iv.set(bytes.subarray(5, 13), 0);
    const ivView = new DataView(iv.buffer, iv.byteOffset, 12);
    ivView.setUint32(8, counter, false);

    const ciphertext = bytes.subarray(13);

    try {
      const decryptedBuffer = await this.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv,
          additionalData: aad
        },
        mediaKey,
        ciphertext
      );

      return new Uint8Array(decryptedBuffer);
    } catch (e) {
      throw new Error(`SFrame decryption failed: invalid key or tampered ciphertext (${e.message || e})`);
    }
  }

  /**
   * Sender TransformStream: encrypts frame data before transmission.
   */
  createSenderTransform(mediaKey, keyId = 1) {
    return new TransformStream({
      transform: async (frame, controller) => {
        try {
          const rawBytes = new Uint8Array(frame.data);
          const encrypted = await this.encryptPayload(rawBytes, mediaKey, keyId);
          frame.data = encrypted.buffer.slice(
            encrypted.byteOffset,
            encrypted.byteOffset + encrypted.byteLength
          );
          controller.enqueue(frame);
        } catch (err) {
          console.error('[SFrameTransform] Sender transform error:', err);
          controller.enqueue(frame); // fail-open fallback if supported
        }
      }
    });
  }

  /**
   * Receiver TransformStream: decrypts incoming frame data.
   */
  createReceiverTransform(keyFinder) {
    return new TransformStream({
      transform: async (frame, controller) => {
        try {
          const encryptedBytes = new Uint8Array(frame.data);
          const headerByte = encryptedBytes[0];
          const keyId = headerByte & 0x07;
          const mediaKey = await keyFinder(keyId, frame);

          if (!mediaKey) {
            throw new Error(`Media key not found for keyId ${keyId}`);
          }

          const decrypted = await this.decryptPayload(encryptedBytes, mediaKey);
          frame.data = decrypted.buffer.slice(
            decrypted.byteOffset,
            decrypted.byteOffset + decrypted.byteLength
          );
          controller.enqueue(frame);
        } catch (err) {
          console.error('[SFrameTransform] Receiver transform error:', err);
        }
      }
    });
  }

  /**
   * Relay Pass-Through TransformStream: forwards raw ciphertext without decrypting.
   */
  createRelayPassthroughTransform() {
    return new TransformStream({
      transform(frame, controller) {
        controller.enqueue(frame);
      }
    });
  }
}
