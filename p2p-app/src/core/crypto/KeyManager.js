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
