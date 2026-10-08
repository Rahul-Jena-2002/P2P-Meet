/**
 * SignalingMailbox handles untrusted public broker signaling (Nostr / MQTT / Webhook).
 * Ensures zero-trust security:
 * - Room secret never leaves browser; topic is derived using HKDF.
 * - All SDP offers/answers have their DTLS fingerprints signed via ephemeral ECDSA.
 * - Any MITM tampering of SDP or ICE by the public broker is detected and rejected.
 */

import { KeyManager } from '../crypto/KeyManager.js';

export class SignalingMailbox {
  constructor({ roomId, roomSecret, peerId, keyManager = new KeyManager() }) {
    if (!roomId) throw new Error('roomId is required');
    if (!roomSecret) throw new Error('roomSecret is required');
    if (!peerId) throw new Error('peerId is required');

    this.roomId = roomId;
    this.roomSecret = roomSecret;
    this.peerId = peerId;
    this.keyManager = keyManager;

    this.topic = null;
    this.roomAuthKey = null;
    this.initialMediaKey = null;
    this.signingKeys = null;
    this.initialized = false;
  }

  async init() {
    const rootKeys = await this.keyManager.deriveRootKeys(this.roomId, this.roomSecret);
    this.topic = rootKeys.mailboxTopic;
    this.roomAuthKey = rootKeys.roomAuthKey;
    this.initialMediaKey = rootKeys.initialMediaKey;
    this.signingKeys = await this.keyManager.generateSigningKeyPair();
    this.initialized = true;
    return this;
  }

  /**
   * Extracts the DTLS SHA-256 fingerprint from SDP.
   */
  extractFingerprint(sdp) {
    if (!sdp || typeof sdp !== 'string') return null;
    const match = sdp.match(/a=fingerprint:(?:sha-256|sha-512)\s+([A-Fa-f0-9:]+)/i);
    return match ? match[1] : null;
  }

  /**
   * Builds the exact canonical string payload that is signed.
   */
  getSigningString(type, peerId, fingerprintOrCandidate) {
    return `${type}:${peerId}:${fingerprintOrCandidate}`;
  }

  /**
   * Creates a tamper-evident signaling envelope.
   */
  async createEnvelope({ type, sdp, candidate, extra = {} }) {
    if (!this.initialized) {
      await this.init();
    }

    let fingerprint = null;
    let signTarget = '';

    if (sdp) {
      fingerprint = this.extractFingerprint(sdp);
      signTarget = this.getSigningString(type, this.peerId, fingerprint || sdp);
    } else if (candidate) {
      const candStr = typeof candidate === 'string' ? candidate : JSON.stringify(candidate);
      signTarget = this.getSigningString(type, this.peerId, candStr);
    } else {
      signTarget = this.getSigningString(type, this.peerId, JSON.stringify(extra));
    }

    const timestamp = Date.now();
    const signature = await this.keyManager.signPayload(this.signingKeys.privateKey, signTarget);

    let roomAuthToken = null;
    if (this.roomAuthKey) {
      roomAuthToken = await this.keyManager.createRoomAuthToken(this.roomAuthKey, {
        peerId: this.peerId,
        timestamp,
        publicKeyJwk: this.signingKeys.publicKeyJwk
      });
    }

    return {
      roomId: this.roomId,
      mailboxTopic: this.topic,
      peerId: this.peerId,
      type,
      sdp: sdp || null,
      candidate: candidate || null,
      fingerprint,
      signature,
      publicKeyJwk: this.signingKeys.publicKeyJwk,
      roomAuthToken,
      timestamp,
      ...extra
    };
  }

  /**
   * Verifies signature and DTLS fingerprint consistency of an incoming envelope.
   */
  async verifyAndUnwrapEnvelope(envelope) {
    if (!envelope || !envelope.peerId || !envelope.publicKeyJwk || !envelope.signature) {
      return { valid: false, error: 'Malformed signaling envelope' };
    }

    // 0. Verify room authorization token (ensures peer knows the URL secret)
    if (this.roomAuthKey) {
      if (!envelope.roomAuthToken) {
        return {
          valid: false,
          error: 'Unauthorized peer: missing room authentication token'
        };
      }

      const isAuthValid = await this.keyManager.verifyRoomAuthToken(
        this.roomAuthKey,
        envelope.roomAuthToken,
        {
          peerId: envelope.peerId,
          timestamp: envelope.timestamp,
          publicKeyJwk: envelope.publicKeyJwk
        }
      );

      if (!isAuthValid) {
        return {
          valid: false,
          error: 'Unauthorized peer: invalid room authentication token (wrong room secret)'
        };
      }
    }

    // 1. If SDP is present, ensure embedded fingerprint matches envelope fingerprint
    if (envelope.sdp) {
      const extractedFingerprint = this.extractFingerprint(envelope.sdp);
      if (extractedFingerprint && envelope.fingerprint && extractedFingerprint !== envelope.fingerprint) {
        return {
          valid: false,
          error: 'SDP fingerprint mismatch: possible MITM tampering on DTLS fingerprint'
        };
      }

      const signTarget = this.getSigningString(
        envelope.type,
        envelope.peerId,
        envelope.fingerprint || extractedFingerprint || envelope.sdp
      );

      const isSigValid = await this.keyManager.verifyPayload(
        envelope.publicKeyJwk,
        envelope.signature,
        signTarget
      );

      if (!isSigValid) {
        return {
          valid: false,
          error: 'Signature verification failed: envelope was tampered with in transit'
        };
      }
    } else if (envelope.candidate) {
      const candStr = typeof envelope.candidate === 'string'
        ? envelope.candidate
        : JSON.stringify(envelope.candidate);
      const signTarget = this.getSigningString(envelope.type, envelope.peerId, candStr);

      const isSigValid = await this.keyManager.verifyPayload(
        envelope.publicKeyJwk,
        envelope.signature,
        signTarget
      );

      if (!isSigValid) {
        return {
          valid: false,
          error: 'Candidate signature verification failed: candidate tampered'
        };
      }
    }

    return {
      valid: true,
      peerId: envelope.peerId,
      type: envelope.type,
      sdp: envelope.sdp,
      candidate: envelope.candidate,
      timestamp: envelope.timestamp
    };
  }
}
