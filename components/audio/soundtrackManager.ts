/** One audio system for the entire portfolio. Audio is created only after a
 * user gesture; no music file participates in the initial scene load.
 *
 *   destination
 *   ├── music master (mute, hidden tab)
 *   │   ├── studio bus: the ambient pair, alternating
 *   │   └── game bus: the Game Mode playlist, in order
 *   └── sfx bus (arcade sound effects; silent while music is muted)
 *
 * Game Mode pauses the ambient pair where it is and plays the game playlist
 * from its first track; leaving it resumes the ambient track from the same
 * position. */

const TRACKS = [
  "/music/Midnight%20Architecture.wav",
  "/music/Late%20Night%20Discovery.wav",
] as const;
const STUDIO_LEVEL = .15;
const FADE_IN = 2.8;
const CROSSFADE = 2.6;
const PREFETCH_AHEAD = 12;

/** Game Mode: the playlist order is fixed; the manifest lists available files
 * and may include a per-track gain. */
export const GAME_PLAYLIST = [
  { id: "best-of-me", title: "Best of Me", artist: "NEFFEX" },
  { id: "grateful", title: "Grateful", artist: "NEFFEX" },
] as const;
const GAME_MANIFEST = "/audio/game-mode/manifest.json";
const GAME_LEVEL = .18;
const STUDIO_OUT = .9;
const GAME_IN_DELAY = .45, GAME_IN = .8, GAME_OUT = .8, STUDIO_BACK = 1.2;
const GAME_NEXT_IN = .5, GAME_PREFETCH = 20;

type GameManifest = { tracks: { id: string; src: string; gain?: number }[] };
type GameTrack = { id: string; player: HTMLAudioElement; gain: GainNode; level: number; failed: boolean };
export type NowPlaying = { title: string; artist: string } | null;

function report(message: string, error?: unknown) {
  if (process.env.NODE_ENV !== "production") console.warn(`[music] ${message}`, error ?? "");
}

function ramp(node: GainNode, value: number, seconds: number, context: AudioContext, delay = 0) {
  const now = context.currentTime;
  const gain = node.gain;
  if (typeof gain.cancelAndHoldAtTime === "function") gain.cancelAndHoldAtTime(now);
  else { const current = gain.value; gain.cancelScheduledValues(now); gain.setValueAtTime(current, now); }
  if (delay > 0) gain.setValueAtTime(gain.value, now + delay);
  gain.linearRampToValueAtTime(value, now + delay + Math.max(.01, seconds));
}

export class BackgroundMusicManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private studioBus: GainNode | null = null;
  private gameBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private gains: GainNode[] = [];
  private players: HTMLAudioElement[] = [];
  private active = 0;
  private started = false;
  private starting: Promise<boolean> | null = null;
  private crossing = false;
  private failed = [false, false];
  private muted: boolean;
  private hidden = false;
  private resumePlayers = [false, false];
  private hideTimer: number | null = null;
  private crossTimer: number | null = null;
  private retryTimer: number | null = null;
  private disposed = false;
  private unavailable: () => void;

  private mode: "studio" | "game" = "studio";
  /** Studio tracks that were playing when Game Mode paused them. */
  private studioHeld = [false, false];
  private studioTimer: number | null = null;
  private gameTimer: number | null = null;
  private manifest: GameManifest | null = null;
  private manifestLoad: Promise<GameManifest> | null = null;
  private game: GameTrack[] = [];
  private gameActive = -1;
  private gameResume = false;
  private nowPlaying: NowPlaying = null;
  private listeners = new Set<() => void>();

  constructor(muted: boolean, unavailable: () => void) {
    this.muted = muted;
    this.unavailable = unavailable;
    this.hidden = document.hidden;
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  /** Exposes timing for the development browser checks; never controls play. */
  status() {
    return {
      started: this.started, active: this.active, crossing: this.crossing, mode: this.mode,
      muted: this.muted, hidden: this.hidden,
      context: this.context?.state ?? "uninitialized",
      master: this.master?.gain.value ?? 0,
      tracks: this.players.map((player, index) => ({
        src: player.currentSrc || player.src, time: player.currentTime,
        duration: player.duration, paused: player.paused, gain: this.gains[index].gain.value,
        readyState: player.readyState, error: player.error?.code ?? null,
      })),
      game: this.game.map((track, index) => ({
        id: track.id, active: index === this.gameActive, time: track.player.currentTime, duration: track.player.duration,
        paused: track.player.paused, failed: track.failed,
      })),
    };
  }

  private initialize() {
    if (this.context) return;
    const context = new AudioContext();
    const master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);
    const studioBus = context.createGain();
    studioBus.gain.value = STUDIO_LEVEL;
    studioBus.connect(master);
    const gameBus = context.createGain();
    gameBus.gain.value = 0;
    gameBus.connect(master);
    const sfxBus = context.createGain();
    sfxBus.gain.value = this.muted ? 0 : 1;
    sfxBus.connect(context.destination);
    this.context = context;
    this.master = master;
    this.studioBus = studioBus;
    this.gameBus = gameBus;
    this.sfxBus = sfxBus;
    TRACKS.forEach((source, index) => {
      const player = new Audio();
      player.preload = "none";
      player.src = source;
      player.loop = false;
      const gain = context.createGain();
      gain.gain.value = 0;
      context.createMediaElementSource(player).connect(gain).connect(studioBus);
      player.addEventListener("timeupdate", () => this.onTime(index));
      player.addEventListener("ended", () => this.onEnded(index));
      player.addEventListener("error", () => this.onError(index, player.error));
      this.players.push(player);
      this.gains.push(gain);
    });
  }

  /** Called directly from the first genuine pointer or keyboard gesture. */
  start(): Promise<boolean> {
    if (this.disposed || this.muted || this.hidden) return Promise.resolve(false);
    if (this.started) return Promise.resolve(true);
    if (this.starting) return this.starting;
    try {
      this.initialize();
      const context = this.context!;
      void context.resume().catch((error) => report("Could not resume audio context", error));
      // In Game Mode the ambient pair waits; the master still has to open.
      if (this.mode === "game") { ramp(this.master!, this.targetGain(), GAME_IN, context); return Promise.resolve(false); }
      const index = this.active;
      const player = this.players[index];
      player.currentTime = 0;
      // play() is invoked in the gesture's call stack, before any await.
      const attempt = player.play();
      this.starting = attempt.then(() => {
        if (this.disposed || this.failed[index] || this.active !== index) return false;
        this.started = true;
        if (this.mode === "game") { player.pause(); this.studioHeld = [index === 0, index === 1]; }
        ramp(this.gains[index], 1, FADE_IN, context);
        ramp(this.master!, this.targetGain(), FADE_IN, context);
        return true;
      }).catch((error: unknown) => {
        if (this.disposed) return false;
        if (error instanceof DOMException && error.name === "NotAllowedError") return false;
        if (!this.failed[index]) report(`Could not start Track ${index === 0 ? "A" : "B"}`, error);
        this.markFailed(index);
        return false;
      }).finally(() => { this.starting = null; });
      return this.starting;
    } catch (error) {
      report("Audio system unavailable", error);
      this.unavailable();
      return Promise.resolve(false);
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.context) ramp(this.master, this.targetGain(), .45, this.context);
    if (this.sfxBus && this.context) ramp(this.sfxBus, muted ? 0 : 1, .2, this.context);
    if (!muted && !this.started && this.mode === "studio") void this.start();
    if (!muted && this.mode === "game" && this.gameActive < 0) this.playGame(this.firstGameTrack(0));
  }

  private targetGain() { return this.muted || this.hidden ? 0 : 1; }

  // ---------------------------------------------------------------- Game Mode

  /** Fetches the small manifest early, so a later click can start a track
   * inside its own gesture. */
  prepareGame() {
    if (this.manifest || this.manifestLoad) return;
    this.manifestLoad = fetch(GAME_MANIFEST, { cache: "no-cache" })
      .then((response) => (response.ok ? response.json() as Promise<GameManifest> : { tracks: [] }))
      .catch(() => ({ tracks: [] }))
      .then((manifest) => { this.manifest = manifest; return manifest; });
  }

  /** Enters or leaves Game Mode. Entering again while in it changes nothing,
   * so moving between games never restarts the playlist. */
  setGameMode(on: boolean) {
    if (this.disposed || on === (this.mode === "game")) return;
    if (on) this.enterGame(); else this.leaveGame();
  }

  private enterGame() {
    this.mode = "game";
    try { this.initialize(); } catch (error) { report("Audio system unavailable", error); return; }
    const context = this.context!;
    void context.resume().catch(() => {});
    if (this.studioTimer !== null) { clearTimeout(this.studioTimer); this.studioTimer = null; }
    if (this.crossTimer !== null) { clearTimeout(this.crossTimer); this.crossTimer = null; this.crossing = false; }
    // The ambient pair fades out and pauses where it is.
    ramp(this.studioBus!, 0, STUDIO_OUT, context);
    this.studioHeld = this.players.map((player) => !player.paused);
    this.studioTimer = window.setTimeout(() => {
      this.studioTimer = null;
      if (this.mode === "game") this.players.forEach((player) => player.pause());
    }, (STUDIO_OUT + .05) * 1000);
    ramp(this.master!, this.targetGain(), .4, context);
    // Every new session begins with the first track of the playlist.
    this.gameBus!.gain.cancelScheduledValues(context.currentTime);
    this.gameBus!.gain.setValueAtTime(0, context.currentTime);
    ramp(this.gameBus!, GAME_LEVEL, GAME_IN, context, GAME_IN_DELAY);
    if (this.manifest) this.beginGame();
    else { this.prepareGame(); void this.manifestLoad!.then(() => { if (this.mode === "game" && this.gameActive < 0) this.beginGame(); }); }
  }

  private beginGame() {
    this.buildGameTracks();
    const first = this.firstGameTrack(0);
    if (first < 0) { this.setNowPlaying(null); return; }
    this.game.forEach((track) => { track.player.pause(); track.player.currentTime = 0; });
    this.playGame(first);
  }

  private buildGameTracks() {
    if (this.game.length || !this.manifest || !this.context) return;
    for (const entry of GAME_PLAYLIST) {
      const listed = this.manifest.tracks.find((track) => track.id === entry.id);
      if (!listed) continue;
      const player = new Audio();
      player.preload = "auto";
      player.src = listed.src;
      const gain = this.context.createGain();
      const level = Math.max(.2, Math.min(2, listed.gain ?? 1));
      gain.gain.value = level;
      this.context.createMediaElementSource(player).connect(gain).connect(this.gameBus!);
      const track: GameTrack = { id: entry.id, player, gain, level, failed: false };
      const index = this.game.length;
      player.addEventListener("ended", () => this.onGameEnded(index));
      player.addEventListener("timeupdate", () => this.onGameTime(index));
      player.addEventListener("error", () => this.onGameError(index));
      this.game.push(track);
    }
  }

  /** The playlist's next playable track at or after `from`, or -1. */
  private firstGameTrack(from: number) {
    for (let k = 0; k < this.game.length; k++) {
      const index = (from + k) % this.game.length;
      if (!this.game[index].failed) return index;
    }
    return -1;
  }

  private playGame(index: number) {
    if (index < 0 || this.disposed || this.mode !== "game") return;
    const track = this.game[index];
    this.gameActive = index;
    const entry = GAME_PLAYLIST.find((item) => item.id === track.id)!;
    this.setNowPlaying({ title: entry.title, artist: entry.artist });
    if (this.hidden) { this.gameResume = true; return; }
    void track.player.play().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "NotAllowedError") { this.gameActive = -1; return; }
      this.onGameError(index);
    });
  }

  private onGameTime(index: number) {
    if (index !== this.gameActive) return;
    const player = this.game[index].player;
    const remaining = player.duration - player.currentTime;
    const next = this.game[(index + 1) % this.game.length];
    if (Number.isFinite(remaining) && remaining < GAME_PREFETCH && next && next !== this.game[index] && next.player.readyState < 2) next.player.load();
  }

  /** Songs end naturally; the next begins after a short breath with a quick fade-in. */
  private onGameEnded(index: number) {
    if (index !== this.gameActive || this.mode !== "game") return;
    const next = this.firstGameTrack((index + 1) % this.game.length);
    if (next < 0) return;
    const track = this.game[next];
    track.player.currentTime = 0;
    if (this.context) { track.gain.gain.setValueAtTime(0, this.context.currentTime); ramp(track.gain, track.level, GAME_NEXT_IN, this.context, .35); }
    this.playGame(next);
  }

  private onGameError(index: number) {
    const track = this.game[index];
    if (!track || track.failed) return;
    track.failed = true;
    report(`Game Mode track "${track.id}" could not play`);
    if (index === this.gameActive) {
      this.gameActive = -1;
      const next = this.firstGameTrack(index + 1);
      if (next >= 0) this.playGame(next); else this.setNowPlaying(null);
    }
  }

  private leaveGame() {
    this.mode = "studio";
    if (!this.context) return;
    const context = this.context;
    if (this.studioTimer !== null) { clearTimeout(this.studioTimer); this.studioTimer = null; }
    ramp(this.gameBus!, 0, GAME_OUT, context);
    const playing = this.game.filter((track) => !track.player.paused);
    if (this.gameTimer !== null) clearTimeout(this.gameTimer);
    this.gameTimer = window.setTimeout(() => {
      this.gameTimer = null;
      if (this.mode === "studio") playing.forEach((track) => track.player.pause());
    }, (GAME_OUT + .05) * 1000);
    this.gameActive = -1;
    this.gameResume = false;
    this.setNowPlaying(null);
    // The ambient track picks up where it paused.
    if (!this.started) { if (!this.muted) void this.start(); return; }
    this.players.forEach((player, index) => {
      if (this.studioHeld[index] && !this.hidden) void player.play().catch((error) => report("Could not resume the ambient track", error));
    });
    ramp(this.studioBus!, STUDIO_LEVEL, STUDIO_BACK, context, .2);
  }

  /** Sound-effect output for the arcade, on its own bus beside the music. */
  sfxOutput() {
    try { this.initialize(); } catch { return null; }
    void this.context!.resume().catch(() => {});
    return { context: this.context!, destination: this.sfxBus! };
  }

  getNowPlaying() { return this.nowPlaying; }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private setNowPlaying(value: NowPlaying) {
    if (value?.title === this.nowPlaying?.title && !!value === !!this.nowPlaying) return;
    this.nowPlaying = value;
    this.listeners.forEach((listener) => listener());
  }

  // ------------------------------------------------------------ Studio playlist

  private onTime(index: number) {
    if (!this.started || this.hidden || this.mode === "game" || index !== this.active || this.crossing) return;
    const player = this.players[index];
    const remaining = player.duration - player.currentTime;
    if (!Number.isFinite(remaining)) return;
    const other = 1 - index;
    if (remaining <= PREFETCH_AHEAD && !this.failed[other] && this.players[other].preload === "none") {
      this.players[other].preload = "auto";
      this.players[other].load();
    }
    if (remaining <= CROSSFADE + .18) void this.transition();
  }

  private async transition() {
    if (this.crossing || this.hidden || !this.started || !this.context) return;
    this.crossing = true;
    const from = this.active, to = 1 - from;
    if (this.failed[to]) { this.crossing = false; return; }
    const next = this.players[to];
    try {
      next.currentTime = 0;
      this.gains[to].gain.setValueAtTime(0, this.context.currentTime);
      await next.play();
      if (this.disposed || this.hidden || this.mode === "game") {
        next.pause();
        this.crossing = false;
        return;
      }
      ramp(this.gains[from], 0, CROSSFADE, this.context);
      ramp(this.gains[to], 1, CROSSFADE, this.context);
      this.active = to;
      this.crossTimer = window.setTimeout(() => {
        this.players[from].pause();
        this.players[from].currentTime = 0;
        this.crossing = false;
        this.crossTimer = null;
      }, (CROSSFADE + .2) * 1000);
    } catch (error) {
      report("Could not crossfade to the next track", error);
      this.markFailed(to);
      this.crossing = false;
    }
  }

  private onEnded(index: number) {
    if (this.disposed || !this.started || this.mode === "game") return;
    if (index !== this.active) {
      this.players[index].pause();
      this.players[index].currentTime = 0;
      return;
    }
    // Metadata or buffering can prevent an overlapping transition. Keep the
    // sequence moving with a short fade-in instead of leaving silence.
    if (this.crossing) return;
    const nextIndex = this.failed[1 - index] ? index : 1 - index;
    const next = this.players[nextIndex];
    next.currentTime = 0;
    if (this.context) this.gains[nextIndex].gain.setValueAtTime(0, this.context.currentTime);
    const play = next.play();
    void play.then(() => {
      if (this.disposed || !this.context) return;
      this.active = nextIndex;
      ramp(this.gains[nextIndex], 1, CROSSFADE, this.context);
    }).catch((error: unknown) => { report("Could not continue the playlist", error); this.markFailed(nextIndex); });
  }

  private onError(index: number, error: unknown) {
    if (this.disposed || this.failed[index]) return;
    report(`Track ${index === 0 ? "A" : "B"} failed`, error);
    this.markFailed(index);
  }

  private markFailed(index: number) {
    if (this.failed[index]) return;
    this.failed[index] = true;
    this.players[index]?.pause();
    if (this.failed[0] && this.failed[1]) { this.unavailable(); return; }
    if (this.started && index === this.active) {
      if (this.crossTimer !== null) { clearTimeout(this.crossTimer); this.crossTimer = null; }
      this.crossing = false;
      this.active = 1 - index;
      this.started = false;
      void this.start();
    } else if (!this.started && index === this.active) {
      this.active = 1 - index;
      // Let the rejected play promise settle before retrying with the other
      // file. The audio context was already unlocked by the user's gesture.
      if (this.retryTimer === null) this.retryTimer = window.setTimeout(() => {
        this.retryTimer = null;
        if (!this.disposed) void this.start();
      }, 0);
    }
  }

  private onVisibility = () => {
    this.hidden = document.hidden;
    if (!this.context || !this.master) return;
    if (this.hideTimer !== null) { clearTimeout(this.hideTimer); this.hideTimer = null; }
    if (this.hidden) {
      ramp(this.master, 0, .35, this.context);
      this.resumePlayers = this.players.map((player) => !player.paused);
      const game = this.game[this.gameActive];
      if (game && !game.player.paused) this.gameResume = true;
      this.hideTimer = window.setTimeout(() => {
        this.players.forEach((player) => player.pause());
        this.game.forEach((track) => track.player.pause());
        this.hideTimer = null;
      }, 380);
    } else {
      void this.context.resume().then(() => {
        if (this.disposed || this.hidden) return;
        if (this.mode === "studio") {
          this.players.forEach((player, index) => {
            if (this.resumePlayers[index] && (index === this.active || this.crossing))
              void player.play().catch((error) => report("Could not resume a track", error));
          });
        } else if (this.gameResume && this.gameActive >= 0) {
          this.gameResume = false;
          void this.game[this.gameActive].player.play().catch(() => this.onGameError(this.gameActive));
        }
        ramp(this.master!, this.targetGain(), .65, this.context!);
      }).catch((error) => report("Could not resume audio context", error));
    }
  };

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    document.removeEventListener("visibilitychange", this.onVisibility);
    for (const timer of [this.hideTimer, this.crossTimer, this.retryTimer, this.studioTimer, this.gameTimer]) if (timer !== null) clearTimeout(timer);
    [...this.players, ...this.game.map((track) => track.player)].forEach((player) => { player.pause(); player.removeAttribute("src"); player.load(); });
    this.gains.forEach((gain) => gain.disconnect());
    this.game.forEach((track) => track.gain.disconnect());
    this.master?.disconnect();
    this.sfxBus?.disconnect();
    this.listeners.clear();
    void this.context?.close().catch(() => {});
  }
}
