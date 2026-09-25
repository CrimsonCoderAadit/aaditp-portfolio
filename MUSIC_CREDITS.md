# Music credits and sources

## Studio (ambient) soundtrack

`public/music/Midnight Architecture.wav` and `public/music/Late Night Discovery.wav`: the room's
existing ambient pair, unchanged.

## Game Mode soundtrack

Plays, in this order and then repeating, while the arcade or SYSTEM RUNNER is open:

1. NEFFEX — "Best of Me"
2. NEFFEX — "Grateful"

### Status: added 2026-09-24

The official MP3 downloads are in `media-sources/neffex/` (git-ignored) and copied unchanged into
`public/audio/game-mode/` for playback:

| Track | Source file | Production file | Size |
| --- | --- | --- | ---: |
| Best of Me | `Best of Me.mp3` | `neffex-best-of-me.mp3` | 9,092,749 bytes |
| Grateful | `Grateful.mp3` | `neffex-grateful.mp3` | 8,130,128 bytes |

Both source and production files are MP3. The originals were copied without re-encoding. The
manifest lists them in playlist order; Game Mode advances through both and loops back to the first.

### Official sources consulted (2026-09-24)

- NEFFEX creator page: https://www.neffexmusic.com/content-creators
  Usage language, quoted: "Crediting NEFFEX when using my music is not required, but always
  appreciated." The page directs creators to NEFFEX's SoundCloud "Copyright-Free" playlists for
  downloads. Questions: neffexmusicofficial@gmail.com. No licence identifier is given there.
- Best of Me: https://soundcloud.com/neffexmusic/best-of-me
  (NEFFEX's own account, titled "Best of Me🤘 [Copyright Free]"; downloads enabled.)
- Grateful: https://soundcloud.com/neffexmusic/grateful
  (NEFFEX's own account, titled "Grateful [Copyright Free]"; downloads enabled.)
- Both tracks' "Free Download" buy links point to tunebula.com, which currently redirects to a
  parked `/lander` page. That route is not usable.
- The SoundCloud track pages carry SoundCloud's default "all-rights-reserved" licence field. The
  creator permission comes from NEFFEX's own statements above, not from a SoundCloud licence.

`scripts/prepare-game-music.sh` remains available for future source formats that need a manifest
gain measurement. The current MP3s are served unchanged.
