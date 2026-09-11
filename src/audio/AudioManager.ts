export interface MusicRequest {
  name: string;
  url: string;
  volume: number;
}

/**
 * Sparse procedural audio using the Web Audio API. Dry wind, a low stone drone,
 * and short interaction sounds. No asset files are required; the context is
 * created on the first user gesture.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientNodes: AudioScheduledSourceNode[] = [];
  private music = new Map<
    string,
    { el: HTMLAudioElement; gain: GainNode; source: MediaElementAudioSourceNode }
  >();
  private currentRequest: MusicRequest | null = null;
  private musicVolume = 1;
  muted = false;

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      this.ensureMusic();
      return;
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.6;
    this.master.connect(this.ctx.destination);
    this.startAmbient();
    this.applyMusic(this.currentRequest, 1.4);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.6, this.ctx.currentTime, 0.05);
    }
  }

  playMusic(request: MusicRequest, fade = 2.5): void {
    this.currentRequest = request;
    this.applyMusic(request, fade);
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = volume;
    if (this.currentRequest) this.applyMusic(this.currentRequest, 0.6);
  }

  private ensureMusic(): void {
    if (!this.currentRequest) return;
    const entry = this.music.get(this.currentRequest.name);
    if (entry && entry.el.paused) void entry.el.play().catch(() => undefined);
  }

  private applyMusic(request: MusicRequest | null, fade: number): void {
    if (!this.ctx || !this.master || !request) return;
    const now = this.ctx.currentTime;

    for (const [name, entry] of this.music) {
      if (name === request.name) continue;
      if (entry.el.paused && entry.gain.gain.value < 0.001) continue;
      entry.gain.gain.cancelScheduledValues(now);
      entry.gain.gain.setValueAtTime(Math.max(entry.gain.gain.value, 0.0001), now);
      entry.gain.gain.linearRampToValueAtTime(0.0001, now + fade);
      const el = entry.el;
      window.setTimeout(() => {
        if (this.currentRequest?.name !== name) el.pause();
      }, fade * 1000 + 150);
    }

    let entry = this.music.get(request.name);
    if (!entry) {
      const el = new Audio();
      el.src = request.url;
      el.loop = true;
      el.preload = "auto";
      const source = this.ctx.createMediaElementSource(el);
      const gain = this.ctx.createGain();
      gain.gain.value = 0.0001;
      source.connect(gain);
      gain.connect(this.master);
      entry = { el, gain, source };
      this.music.set(request.name, entry);
    }

    const target = Math.max(0.0001, request.volume * this.musicVolume);
    entry.gain.gain.cancelScheduledValues(now);
    entry.gain.gain.setValueAtTime(Math.max(entry.gain.gain.value, 0.0001), now);
    entry.gain.gain.linearRampToValueAtTime(target, now + fade);
    const play = entry.el.play();
    if (play && typeof play.catch === "function") play.catch(() => undefined);
  }

  private noiseBuffer(seconds: number): AudioBuffer | null {
    if (!this.ctx) return null;
    const samples = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, samples, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < samples; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    return buffer;
  }

  private startAmbient(): void {
    if (!this.ctx || !this.master) return;
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.05;
    this.ambientGain.connect(this.master);

    // Dry wind: looping brown noise through a resonant lowpass with slow gusts.
    const buffer = this.noiseBuffer(4);
    if (buffer) {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 420;
      filter.Q.value = 0.7;
      const windGain = this.ctx.createGain();
      windGain.gain.value = 0.5;
      source.connect(filter);
      filter.connect(windGain);
      windGain.connect(this.ambientGain);
      source.start();
      this.ambientNodes.push(source);

      const gust = this.ctx.createOscillator();
      gust.frequency.value = 0.06;
      const gustGain = this.ctx.createGain();
      gustGain.gain.value = 0.32;
      gust.connect(gustGain);
      gustGain.connect(windGain.gain);
      gust.start();
      this.ambientNodes.push(gust);
    }

    // A low stone drone, almost inaudible.
    for (const [freq, detune] of [
      [55, -5],
      [82.5, 4],
    ] as const) {
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.detune.value = detune;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.18;
      osc.connect(gain);
      gain.connect(this.ambientGain);
      osc.start();
      this.ambientNodes.push(osc);
    }
  }

  private tone(options: {
    freq: number;
    duration: number;
    type?: OscillatorType;
    gain?: number;
    delay?: number;
    slideTo?: number;
  }): void {
    if (!this.ctx || !this.master || this.muted) return;
    const { freq, duration, type = "sine", gain = 0.2, delay = 0, slideTo } = options;
    const start = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), start + duration);
    }
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain, start + 0.014);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(env);
    env.connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  private noise(duration: number, gain: number, filterType: BiquadFilterType, freq: number, delay = 0): void {
    if (!this.ctx || !this.master || this.muted) return;
    const start = this.ctx.currentTime + delay;
    const samples = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, samples, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < samples; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / samples);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    filter.Q.value = 0.8;
    const env = this.ctx.createGain();
    env.gain.value = gain;
    source.connect(filter);
    filter.connect(env);
    env.connect(this.master);
    source.start(start);
  }

  /** The sun sweeping: a low stone resonance and a wash of air. */
  sunSweep(): void {
    this.tone({ freq: 96, duration: 0.52, type: "triangle", gain: 0.16, slideTo: 168 });
    this.tone({ freq: 210, duration: 0.42, type: "sine", gain: 0.05, slideTo: 150 });
    this.noise(0.5, 0.035, "bandpass", 620);
  }

  /** Shades moving: soft cloth and dragged sand. */
  shadeMove(): void {
    this.noise(0.16, 0.045, "lowpass", 900);
    this.tone({ freq: 150, duration: 0.12, type: "sine", gain: 0.05, slideTo: 120 });
  }

  /** Burial: a single deep resonant tone. */
  burial(): void {
    this.tone({ freq: 88, duration: 1.4, type: "sine", gain: 0.2, slideTo: 62 });
    this.tone({ freq: 132, duration: 1.1, type: "sine", gain: 0.08, delay: 0.05 });
    this.noise(0.5, 0.02, "lowpass", 300);
  }

  undo(): void {
    this.tone({ freq: 168, duration: 0.28, type: "sine", gain: 0.12, slideTo: 320 });
    this.noise(0.2, 0.02, "bandpass", 500);
  }

  blocked(): void {
    this.tone({ freq: 120, duration: 0.14, type: "square", gain: 0.05, slideTo: 80 });
  }

  sunset(): void {
    this.tone({ freq: 196, duration: 2.2, type: "sine", gain: 0.16, slideTo: 60 });
    this.tone({ freq: 147, duration: 2.4, type: "triangle", gain: 0.1, slideTo: 48 });
  }

  solve(): void {
    for (const [freq, delay] of [
      [131, 0],
      [196, 0.14],
      [262, 0.3],
      [392, 0.5],
    ] as const) {
      this.tone({ freq, duration: 1.6, type: "sine", gain: 0.12, delay });
    }
  }

  levelStart(): void {
    this.tone({ freq: 147, duration: 0.9, type: "sine", gain: 0.08 });
    this.tone({ freq: 220, duration: 0.9, type: "sine", gain: 0.045, delay: 0.1 });
  }

  dispose(): void {
    for (const node of this.ambientNodes) {
      try {
        node.stop();
      } catch {
        // already stopped
      }
    }
    this.ambientNodes = [];
    for (const entry of this.music.values()) entry.el.pause();
    this.music.clear();
    void this.ctx?.close();
    this.ctx = null;
  }
}
