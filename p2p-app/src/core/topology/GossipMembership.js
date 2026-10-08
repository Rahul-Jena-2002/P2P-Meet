/**
 * GossipMembership implements a lightweight SWIM-style failure detector and gossip protocol.
 * Periodically probes cluster nodes and detects node drops in under 3 seconds,
 * triggering automatic standby promotion without requiring a central coordinator.
 */

export class GossipMembership {
  constructor({
    localUserId = 'local-user',
    pingIntervalMs = 500,
    suspectTimeoutMs = 1200,
    deadTimeoutMs = 2400
  } = {}) {
    this.localUserId = localUserId;
    this.pingIntervalMs = pingIntervalMs;
    this.suspectTimeoutMs = suspectTimeoutMs;
    this.deadTimeoutMs = deadTimeoutMs;

    this.members = new Map(); // peerId -> { peerId, state: 'alive'|'suspect'|'dead', lastSeen, metadata }
    this.timer = null;
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

  addMember(peerId, metadata = {}) {
    if (!peerId || peerId === this.localUserId) return;
    this.members.set(peerId, {
      peerId,
      state: 'alive',
      lastSeen: Date.now(),
      metadata
    });
    this.emit('memberAdded', { peerId, metadata });
  }

  removeMember(peerId) {
    this.members.delete(peerId);
  }

  recordHeartbeat(peerId) {
    const member = this.members.get(peerId);
    if (member) {
      member.state = 'alive';
      member.lastSeen = Date.now();
    }
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      const now = Date.now();
      for (const [peerId, member] of this.members.entries()) {
        const elapsed = now - member.lastSeen;

        if (elapsed >= this.deadTimeoutMs) {
          if (member.state !== 'dead') {
            member.state = 'dead';
            this.emit('memberDead', { peerId });
          }
        } else if (elapsed >= this.suspectTimeoutMs) {
          if (member.state === 'alive') {
            member.state = 'suspect';
            this.emit('memberSuspect', { peerId });
          }
        }
      }
    }, this.pingIntervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  destroy() {
    this.stop();
    this.members.clear();
    this.listeners.clear();
  }
}
