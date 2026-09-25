/** A short original phrase in a soft, breathy flute voice: sine tones with a
 * gentle vibrato and a little filtered breath noise. Quiet, and silent when
 * the room's music is muted. */
const PHRASE: [number, number][] = [[587.33, .28], [739.99, .28], [880, .42], [783.99, .22], [739.99, .22], [659.25, .5]];

let playing: AudioContext | null = null;

export function playFlutePhrase() {
  try { if (window.sessionStorage.getItem("aadit-portfolio-music-muted") === "1") return; } catch { /* Session storage is optional. */ }
  if (playing) return;
  try {
    const context = new AudioContext();
    playing = context;
    const master = context.createGain();
    master.gain.value = .07;
    master.connect(context.destination);
    let at = context.currentTime + .05;
    for (const [frequency, length] of PHRASE) {
      const tone = context.createOscillator(), vibrato = context.createOscillator(), depth = context.createGain(), gain = context.createGain();
      tone.type = "sine"; tone.frequency.value = frequency;
      vibrato.frequency.value = 5.2; depth.gain.value = frequency * .006;
      vibrato.connect(depth).connect(tone.frequency);
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(.9, at + .06);
      gain.gain.setValueAtTime(.8, at + length - .06);
      gain.gain.linearRampToValueAtTime(0, at + length + .04);
      tone.connect(gain).connect(master);
      tone.start(at); vibrato.start(at); tone.stop(at + length + .08); vibrato.stop(at + length + .08);
      at += length;
    }
    const noise = context.createBuffer(1, Math.ceil(context.sampleRate * (at - context.currentTime)), context.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * .5;
    const breath = context.createBufferSource(), filter = context.createBiquadFilter(), breathGain = context.createGain();
    breath.buffer = noise; filter.type = "bandpass"; filter.frequency.value = 1800; filter.Q.value = .8; breathGain.gain.value = .05;
    breath.connect(filter).connect(breathGain).connect(master);
    breath.start();
    window.setTimeout(() => { void context.close(); playing = null; }, (at - context.currentTime + .4) * 1000);
  } catch { playing = null; }
}
