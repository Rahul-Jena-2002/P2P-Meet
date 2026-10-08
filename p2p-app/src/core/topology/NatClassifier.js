/**
 * NatClassifier determines whether the local client is behind a Cone NAT (reachable)
 * or Symmetric NAT (restricted) by comparing reflexive IP/ports across two distinct STUN servers.
 * Honest limit: If all peers in a room are restricted (symmetric), P2P direct connectivity cannot succeed.
 */

export class NatClassifier {
  constructor({
    stunServers = ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'],
    stunQuerier = null
  } = {}) {
    this.stunServers = stunServers;
    this.stunQuerier = stunQuerier || this.defaultStunQuerier.bind(this);
    this.cachedClassification = null;
  }

  /**
   * Probes two independent STUN servers to observe port mapping behavior.
   */
  async classify() {
    if (this.cachedClassification) return this.cachedClassification;

    try {
      const [res1, res2] = await Promise.all([
        this.stunQuerier(this.stunServers[0]),
        this.stunQuerier(this.stunServers[1])
      ]);

      if (!res1 || !res2) {
        this.cachedClassification = {
          natType: 'unknown',
          isSymmetric: false,
          reason: 'STUN responses incomplete'
        };
        return this.cachedClassification;
      }

      const isSymmetric = res1.port !== res2.port || res1.ip !== res2.ip;
      this.cachedClassification = {
        natType: isSymmetric ? 'restricted' : 'reachable',
        isSymmetric,
        mappedIp: res1.ip,
        mappedPort: res1.port,
        altMappedPort: res2.port
      };

      return this.cachedClassification;
    } catch (err) {
      this.cachedClassification = {
        natType: 'unknown',
        isSymmetric: false,
        error: err.message
      };
      return this.cachedClassification;
    }
  }

  /**
   * Browser implementation of single-server STUN reflexive candidate gathering.
   */
  async defaultStunQuerier(stunUrl) {
    if (typeof RTCPeerConnection === 'undefined' && typeof window?.RTCPeerConnection === 'undefined') {
      return null;
    }

    const PC = typeof RTCPeerConnection !== 'undefined' ? RTCPeerConnection : window.RTCPeerConnection;
    const pc = new PC({ iceServers: [{ urls: stunUrl }] });

    return new Promise((resolve) => {
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try { pc.close(); } catch (_) {}
          resolve(null);
        }
      }, 5000);

      pc.onicecandidate = (event) => {
        if (event.candidate && event.candidate.type === 'srflx') {
          const cand = event.candidate;
          const ip = cand.address || cand.ip;
          const port = cand.port;
          if (ip && port && !resolved) {
            resolved = true;
            clearTimeout(timeout);
            try { pc.close(); } catch (_) {}
            resolve({ ip, port });
          }
        } else if (!event.candidate && !resolved) {
          // Gathering complete
          resolved = true;
          clearTimeout(timeout);
          try { pc.close(); } catch (_) {}
          resolve(null);
        }
      };

      try {
        pc.createDataChannel('stun-test');
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .catch(() => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              try { pc.close(); } catch (_) {}
              resolve(null);
            }
          });
      } catch (_) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          try { pc.close(); } catch (_) {}
          resolve(null);
        }
      }
    });
  }

  /**
   * Evaluates if a set of peers can connect to each other.
   * If all peers are behind symmetric NAT (restricted), connection will fail without a relay.
   */
  evaluateRoomConnectivity(peers = []) {
    if (!peers || peers.length === 0) {
      return { canConnect: true };
    }

    const reachablePeer = peers.find((p) => p.natType === 'reachable');
    if (reachablePeer) {
      return {
        canConnect: true,
        bridgePeerId: reachablePeer.peerId
      };
    }

    const allRestricted = peers.length >= 2 && peers.every((p) => p.natType === 'restricted');
    if (allRestricted) {
      return {
        canConnect: false,
        reason: 'All peers behind symmetric NAT (restricted mapping). Direct P2P connection cannot be established.'
      };
    }

    return { canConnect: true };
  }
}
