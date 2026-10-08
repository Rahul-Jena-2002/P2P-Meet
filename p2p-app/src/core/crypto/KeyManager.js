/**
 * KeyManager handles WebCrypto operations:
 * - Deterministic mailbox topic derivation using HKDF-SHA256
 * - Ephemeral P-256 ECDSA signing key generation and payload verification
 * - Ephemeral P-256 ECDH key generation for pairwise E2EE media ratcheting
 */

export class KeyManager {
  constructor(cryptoInstance = globalThis.crypto) {
    this.crypto = cryptoInstance;
    if (!this.crypto?.subtle) {
      throw new Error('WebCrypto subtle is not supported in this runtime');
    }
  }

  /**
   * Derives a 256-bit opaque mailbox topic from room secret and roomId using HKDF-SHA256.
   * Relays only see this hash, never the secret or raw room name.
   */
  async deriveTopic(roomId, secret) {
    const enc = new TextEncoder();
    const secretBytes = enc.encode(secret);
    const saltBytes = enc.encode(`p2pmeet-salt-${roomId.toLowerCase()}`);
    const infoBytes = enc.encode('p2pmeet-mailbox-topic');

    const baseKey = await this.crypto.subtle.importKey(
      'raw',
      secretBytes,
      'HKDF',
      false,
      ['deriveBits']
    );

    const derivedBits = await this.crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: saltBytes,
        info: infoBytes
      },
      baseKey,
      256
    );

    return this.bufferToHex(derivedBits);
  }

  /**
   * Derives hierarchical root keys from room secret using HKDF-SHA256:
   * 1. mailboxTopic (public broker opaque routing channel)
   * 2. roomAuthKey (HMAC-SHA256 key for authenticating peers)
   * 3. initialMediaKey (16-byte raw AES-GCM media key for epoch 0)
   */
  async deriveRootKeys(roomId, secret) {
    const enc = new TextEncoder();
    const secretBytes = enc.encode(secret);
    const saltBytes = enc.encode(`p2pmeet-root-salt-${roomId.toLowerCase()}`);

    const baseKey = await this.crypto.subtle.importKey(
      'raw',
      secretBytes,
      'HKDF',
      false,
      ['deriveBits', 'deriveKey']
    );

    // 1. Topic (256 bits)
    const topicBits = await this.crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: saltBytes,
        info: enc.encode('p2pmeet-mailbox-topic')
      },
      baseKey,
      256
    );
    const mailboxTopic = this.bufferToHex(topicBits);

    // 2. Room Auth Key (HMAC-SHA256)
    const roomAuthKey = await this.crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: saltBytes,
        info: enc.encode('p2pmeet-room-auth-key')
      },
      baseKey,
      {
        name: 'HMAC',
        hash: 'SHA-256',
        length: 256
      },
      false,
      ['sign', 'verify']
    );

    // 3. Initial Epoch Media Key (128 bits AES-GCM)
    const mediaKeyBits = await this.crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: saltBytes,
        info: enc.encode('p2pmeet-initial-epoch-key')
      },
      baseKey,
      128
    );
    const initialMediaKey = new Uint8Array(mediaKeyBits);

    return {
      mailboxTopic,
      roomAuthKey,
      initialMediaKey
    };
  }

  /**
   * Creates an HMAC-SHA256 authentication token proving possession of the room secret.
   */
  async createRoomAuthToken(roomAuthKey, { peerId, timestamp, publicKeyJwk = null }) {
    const enc = new TextEncoder();
    const pubKeyStr = publicKeyJwk ? (typeof publicKeyJwk === 'string' ? publicKeyJwk : JSON.stringify(publicKeyJwk)) : '';
    const authPayload = `${peerId}:${pubKeyStr}:${timestamp}`;

    const signature = await this.crypto.subtle.sign(
      'HMAC',
      roomAuthKey,
      enc.encode(authPayload)
    );

    return this.bufferToHex(signature);
  }

  /**
   * Verifies an HMAC-SHA256 authentication token against the derived roomAuthKey.
   */
  async verifyRoomAuthToken(roomAuthKey, tokenHex, { peerId, timestamp, publicKeyJwk = null }) {
    try {
      const enc = new TextEncoder();
      const pubKeyStr = publicKeyJwk ? (typeof publicKeyJwk === 'string' ? publicKeyJwk : JSON.stringify(publicKeyJwk)) : '';
      const authPayload = `${peerId}:${pubKeyStr}:${timestamp}`;
      const tokenBytes = this.hexToBuffer(tokenHex);

      return await this.crypto.subtle.verify(
        'HMAC',
        roomAuthKey,
        tokenBytes,
        enc.encode(authPayload)
      );
    } catch {
      return false;
    }
  }

  /**
   * Generates an ephemeral P-256 ECDSA keypair for signing DTLS fingerprints.
   */
  async generateSigningKeyPair() {
    const keyPair = await this.crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      true,
      ['sign', 'verify']
    );

    const publicKeyJwk = await this.crypto.subtle.exportKey('jwk', keyPair.publicKey);

    return {
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
      publicKeyJwk
    };
  }

  /**
   * Generates an ephemeral P-256 ECDH keypair for pairwise session key agreement.
   */
  async generateEcdhKeyPair() {
    const keyPair = await this.crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      true,
      ['deriveKey', 'deriveBits']
    );

    const publicKeyJwk = await this.crypto.subtle.exportKey('jwk', keyPair.publicKey);

    return {
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
      publicKeyJwk
    };
  }

  /**
   * Signs a string payload using ECDSA with SHA-256.
   * Returns a hex-encoded signature.
   */
  async signPayload(privateKey, dataString) {
    const enc = new TextEncoder();
    const dataBytes = enc.encode(dataString);

    const signature = await this.crypto.subtle.sign(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' }
      },
      privateKey,
      dataBytes
    );

    return this.bufferToHex(signature);
  }

  /**
   * Verifies an ECDSA signature against a JWK public key or CryptoKey.
   */
  async verifyPayload(publicKeyOrJwk, signatureHex, dataString) {
    try {
      let publicKey = publicKeyOrJwk;
      if (!publicKey?.type) {
        publicKey = await this.crypto.subtle.importKey(
          'jwk',
          publicKeyOrJwk,
          {
            name: 'ECDSA',
            namedCurve: 'P-256'
          },
          false,
          ['verify']
        );
      }

      const enc = new TextEncoder();
      const dataBytes = enc.encode(dataString);
      const signatureBytes = this.hexToBuffer(signatureHex);

      return await this.crypto.subtle.verify(
        {
          name: 'ECDSA',
          hash: { name: 'SHA-256' }
        },
        publicKey,
        signatureBytes,
        dataBytes
      );
    } catch {
      return false;
    }
  }

  /**
   * Initializes session for peer and generates initial epoch media key.
   */
  async initSession({ peerId }) {
    this.peerId = peerId;
    this.epoch = 1;
    this.peerKeys = new Map();
    this.currentMediaKey = new Uint8Array(16);
    this.crypto.getRandomValues(this.currentMediaKey);
    return this;
  }

  async getCurrentMediaKey() {
    if (!this.currentMediaKey) {
      this.currentMediaKey = new Uint8Array(16);
      this.crypto.getRandomValues(this.currentMediaKey);
    }
    return new Uint8Array(this.currentMediaKey);
  }

  /**
   * Derives an AES-GCM wrapping key using pairwise ECDH and HKDF.
   */
  async derivePairwiseWrappingKey(myPrivateKey, peerPublicKeyJwk) {
    let peerKey = peerPublicKeyJwk;
    if (!peerKey.type) {
      peerKey = await this.crypto.subtle.importKey(
        'jwk',
        peerPublicKeyJwk,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        []
      );
    }

    const sharedBits = await this.crypto.subtle.deriveBits(
      {
        name: 'ECDH',
        public: peerKey
      },
      myPrivateKey,
      256
    );

    const baseKey = await this.crypto.subtle.importKey('raw', sharedBits, 'HKDF', false, ['deriveKey']);
    return await this.crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new TextEncoder().encode('p2pmeet-ecdh-wrap-salt'),
        info: new TextEncoder().encode('p2pmeet-pairwise-key-wrap')
      },
      baseKey,
      { name: 'AES-GCM', length: 128 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Wraps (encrypts) raw media key for a target peer over pairwise ECDH.
   */
  async wrapKeyForPeer({ targetPeerId, myPrivateKey, targetPublicKeyJwk, rawKeyBytes, epoch = this.epoch || 1 }) {
    const wrapKey = await this.derivePairwiseWrappingKey(myPrivateKey, targetPublicKeyJwk);
    const iv = new Uint8Array(12);
    this.crypto.getRandomValues(iv);

    const ciphertext = await this.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      wrapKey,
      rawKeyBytes
    );

    const payload = {
      targetPeerId,
      epoch,
      ciphertextHex: this.bufferToHex(ciphertext),
      ivHex: this.bufferToHex(iv)
    };

    if (this.peerKeys) {
      this.peerKeys.set(targetPeerId, {
        targetPublicKeyJwk,
        wrappedPayload: payload
      });
    }

    return payload;
  }

  /**
   * Unwraps (decrypts) incoming media key from sender peer.
   */
  async unwrapKeyFromPeer({ senderPeerId, myPrivateKey, senderPublicKeyJwk, wrapped }) {
    const wrapKey = await this.derivePairwiseWrappingKey(myPrivateKey, senderPublicKeyJwk);
    const iv = this.hexToBuffer(wrapped.ivHex);
    const ciphertext = this.hexToBuffer(wrapped.ciphertextHex);

    const decrypted = await this.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      wrapKey,
      ciphertext
    );

    return new Uint8Array(decrypted);
  }

  /**
   * Advances the epoch, rotates media key, and invalidates departed peer's session state.
   */
  async handlePeerLeave(peerId) {
    if (this.peerKeys) {
      this.peerKeys.delete(peerId);
    }
    this.epoch = (this.epoch || 1) + 1;
    this.currentMediaKey = new Uint8Array(16);
    this.crypto.getRandomValues(this.currentMediaKey);
    return this.epoch;
  }

  hasPeerState(peerId) {
    return this.peerKeys ? this.peerKeys.has(peerId) : false;
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
