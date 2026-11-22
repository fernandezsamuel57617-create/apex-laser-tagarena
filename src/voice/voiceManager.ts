import type { VoiceSignalData } from '../shared/types';

export interface VoiceCallbacks {
  onSendSignal: (targetId: string, signal: VoiceSignalData) => void;
  onSpeakingChange: (speaking: boolean) => void;
  onStatusChange: (status: VoiceStatus) => void;
}

export interface VoiceStatus {
  connected: boolean;
  room: string | null;
  micMuted: boolean;
  deafened: boolean;
  hasMic: boolean;
  speaking: boolean;
  error: string | null;
}

interface PeerEntry {
  pc: RTCPeerConnection;
  audioEl: HTMLAudioElement;
  pendingCandidates: RTCIceCandidateInit[];
  remoteDescSet: boolean;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export class VoiceManager {
  private callbacks: VoiceCallbacks;
  private myId: string | null = null;
  private currentRoom: string | null = null;
  private localStream: MediaStream | null = null;
  private micMuted = false;
  private deafened = false;
  private hasMic = false;
  private speaking = false;
  private lastError: string | null = null;

  private peers = new Map<string, PeerEntry>();
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private vadTimer = 0;
  private vadBins: Uint8Array<ArrayBuffer> | null = null;

  constructor(callbacks: VoiceCallbacks) {
    this.callbacks = callbacks;
  }

  public setMyId(id: string | null) {
    this.myId = id;
  }

  public getStatus(): VoiceStatus {
    return {
      connected: this.currentRoom !== null,
      room: this.currentRoom,
      micMuted: this.micMuted,
      deafened: this.deafened,
      hasMic: this.hasMic,
      speaking: this.speaking,
      error: this.lastError,
    };
  }

  private emitStatus() {
    this.callbacks.onStatusChange(this.getStatus());
  }

  public async joinRoom(room: string): Promise<boolean> {
    const cleanRoom = room.trim().toLowerCase().slice(0, 24) || 'amigos';
    if (this.currentRoom === cleanRoom) return true;

    this.leaveRoom(false);
    this.currentRoom = cleanRoom;
    this.lastError = null;

    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
        this.hasMic = true;
        this.micMuted = false;
        this.startVoiceActivityDetector(this.localStream);
      } catch {
        this.hasMic = false;
        this.micMuted = true;
        this.lastError = 'Micrófono no permitido: modo solo escucha activo.';
      }
    } else {
      this.hasMic = false;
      this.micMuted = true;
      this.lastError = 'Audio de micrófono no disponible en este navegador.';
    }

    this.emitStatus();
    return true;
  }

  private startVoiceActivityDetector(stream: MediaStream) {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.audioCtx = new AudioCtx();
      const source = this.audioCtx.createMediaStreamSource(stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);
      this.vadBins = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));

      window.clearInterval(this.vadTimer);
      this.vadTimer = window.setInterval(() => {
        if (!this.analyser || !this.vadBins || this.micMuted || !this.currentRoom) {
          if (this.speaking) {
            this.speaking = false;
            this.callbacks.onSpeakingChange(false);
            this.emitStatus();
          }
          return;
        }
        this.analyser.getByteFrequencyData(this.vadBins);
        let sum = 0;
        for (let i = 0; i < this.vadBins.length; i++) {
          sum += this.vadBins[i];
        }
        const avg = sum / this.vadBins.length;
        const nextSpeaking = avg > 14;
        if (nextSpeaking !== this.speaking) {
          this.speaking = nextSpeaking;
          this.callbacks.onSpeakingChange(nextSpeaking);
          this.emitStatus();
        }
      }, 120);
    } catch {
      // VAD optional
    }
  }

  public toggleMicMute(): boolean {
    if (!this.hasMic || !this.localStream) return this.micMuted;
    this.micMuted = !this.micMuted;
    for (const track of this.localStream.getAudioTracks()) {
      track.enabled = !this.micMuted;
    }
    if (this.micMuted && this.speaking) {
      this.speaking = false;
      this.callbacks.onSpeakingChange(false);
    }
    this.emitStatus();
    return this.micMuted;
  }

  public toggleDeafen(): boolean {
    this.deafened = !this.deafened;
    for (const entry of this.peers.values()) {
      entry.audioEl.muted = this.deafened;
    }
    this.emitStatus();
    return this.deafened;
  }

  public syncPeers(peerIdsInRoom: string[]) {
    if (!this.currentRoom || !this.myId) return;
    const wanted = new Set(peerIdsInRoom.filter((id) => id !== this.myId));

    // Remove peers no longer in room
    for (const existingId of Array.from(this.peers.keys())) {
      if (!wanted.has(existingId)) {
        this.removePeer(existingId);
      }
    }

    // Create connections for new peers
    for (const peerId of wanted) {
      if (!this.peers.has(peerId)) {
        const shouldInitiate = this.myId < peerId;
        this.createPeer(peerId, shouldInitiate);
      }
    }
  }

  private createPeer(peerId: string, initiateOffer: boolean): PeerEntry {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    const audioEl = document.createElement('audio');
    audioEl.autoplay = true;
    audioEl.muted = this.deafened;
    audioEl.style.display = 'none';
    document.body.appendChild(audioEl);

    const entry: PeerEntry = {
      pc,
      audioEl,
      pendingCandidates: [],
      remoteDescSet: false,
    };
    this.peers.set(peerId, entry);

    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        pc.addTrack(track, this.localStream);
      }
    } else {
      // Listen-only transceiver so remote peer still sends audio
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }

    pc.ontrack = (event) => {
      if (event.streams[0]) {
        audioEl.srcObject = event.streams[0];
        audioEl.play().catch(() => {});
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.callbacks.onSendSignal(peerId, { candidate: event.candidate.toJSON() });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.removePeer(peerId);
      }
    };

    if (initiateOffer) {
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          if (pc.localDescription) {
            this.callbacks.onSendSignal(peerId, { sdp: pc.localDescription.toJSON() });
          }
        })
        .catch(() => {});
    }

    return entry;
  }

  public async handleSignal(fromId: string, signal: VoiceSignalData) {
    if (!this.currentRoom) return;
    let entry = this.peers.get(fromId);
    if (!entry) {
      entry = this.createPeer(fromId, false);
    }
    const { pc } = entry;

    try {
      if (signal.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        entry.remoteDescSet = true;
        for (const cand of entry.pendingCandidates) {
          await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        }
        entry.pendingCandidates = [];

        if (signal.sdp.type === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          if (pc.localDescription) {
            this.callbacks.onSendSignal(fromId, { sdp: pc.localDescription.toJSON() });
          }
        }
      } else if (signal.candidate) {
        if (entry.remoteDescSet) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
        } else {
          entry.pendingCandidates.push(signal.candidate);
        }
      }
    } catch {
      // Ignore transient signaling race
    }
  }

  public removePeer(peerId: string) {
    const entry = this.peers.get(peerId);
    if (!entry) return;
    entry.pc.close();
    entry.audioEl.srcObject = null;
    entry.audioEl.remove();
    this.peers.delete(peerId);
  }

  public leaveRoom(emit = true) {
    window.clearInterval(this.vadTimer);
    this.vadTimer = 0;

    for (const peerId of Array.from(this.peers.keys())) {
      this.removePeer(peerId);
    }

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }

    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
      this.analyser = null;
    }

    this.currentRoom = null;
    this.hasMic = false;
    this.speaking = false;
    this.lastError = null;
    if (emit) {
      this.callbacks.onSpeakingChange(false);
      this.emitStatus();
    }
  }

  public dispose() {
    this.leaveRoom(false);
  }
}
