import { sfxOutput } from "../../audio/gameMode";

/** Small synthesised sound effects for the arcade: short oscillator blips
 * with fast envelopes, nothing sampled, played on the audio manager's sound
 * effect bus. Quiet by design, and silent whenever the room's music is muted. */

export type Sound = "tick" | "start" | "checkpoint" | "jump" | "hit" | "bump" | "pickup" | "fire" | "burst" | "wave" | "over";

type Tone = { at: number; from: number; to?: number; length: number; wave: OscillatorType; level: number };
const TONES: Record<Sound, Tone[]> = {
  tick: [{ at: 0, from: 1320, length: .03, wave: "square", level: .25 }],
  start: [{ at: 0, from: 440, to: 660, length: .09, wave: "triangle", level: .5 }, { at: .09, from: 660, to: 990, length: .12, wave: "triangle", level: .5 }],
  checkpoint: [{ at: 0, from: 784, length: .07, wave: "triangle", level: .55 }, { at: .07, from: 1175, length: .12, wave: "triangle", level: .5 }],
  jump: [{ at: 0, from: 300, to: 620, length: .11, wave: "square", level: .22 }],
  hit: [{ at: 0, from: 220, to: 70, length: .22, wave: "sawtooth", level: .4 }],
  bump: [{ at: 0, from: 120, to: 60, length: .08, wave: "square", level: .3 }],
  pickup: [{ at: 0, from: 988, to: 1480, length: .09, wave: "sine", level: .5 }],
  fire: [{ at: 0, from: 880, to: 330, length: .07, wave: "square", level: .18 }],
  burst: [{ at: 0, from: 520, to: 120, length: .13, wave: "triangle", level: .4 }],
  wave: [{ at: 0, from: 523, length: .08, wave: "triangle", level: .45 }, { at: .1, from: 659, length: .08, wave: "triangle", level: .45 }, { at: .2, from: 784, length: .16, wave: "triangle", level: .45 }],
  over: [{ at: 0, from: 392, to: 370, length: .18, wave: "triangle", level: .45 }, { at: .2, from: 330, to: 311, length: .18, wave: "triangle", level: .45 }, { at: .4, from: 262, to: 196, length: .4, wave: "triangle", level: .45 }],
};

const MASTER = .09;
const musicMuted = () => { try { return window.sessionStorage.getItem("aadit-portfolio-music-muted") === "1"; } catch { return false; } };

export type Sfx = { play: (sound: Sound) => void; close: () => void };

export function createSfx(): Sfx {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let owned = false;
  const last = new Map<Sound, number>();
  return {
    play(sound) {
      if (musicMuted()) return;
      try {
        if (!context) {
          const bus = sfxOutput();
          owned = !bus;
          context = bus?.context ?? new AudioContext();
          master = context.createGain();
          master.gain.value = MASTER;
          master.connect(bus?.destination ?? context.destination);
        }
        const now = context.currentTime;
        // One voice per sound at a time: rapid repeats would only buzz.
        if (now - (last.get(sound) ?? -1) < .045) return;
        last.set(sound, now);
        for (const tone of TONES[sound]) {
          const start = now + tone.at, end = start + tone.length;
          const oscillator = context.createOscillator(), gain = context.createGain();
          oscillator.type = tone.wave;
          oscillator.frequency.setValueAtTime(tone.from, start);
          if (tone.to) oscillator.frequency.exponentialRampToValueAtTime(tone.to, end);
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(tone.level, start + .008);
          gain.gain.exponentialRampToValueAtTime(.0001, end);
          oscillator.connect(gain).connect(master!);
          oscillator.start(start);
          oscillator.stop(end + .02);
        }
      } catch { /* Audio is optional. */ }
    },
    close() { master?.disconnect(); if (owned) void context?.close(); context = null; master = null; },
  };
}
