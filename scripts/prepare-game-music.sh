#!/usr/bin/env bash
# Prepares the Game Mode songs from the official NEFFEX downloads.
#
#   scripts/prepare-game-music.sh "<Best of Me download>" "<Grateful download>"
#
# Lossless sources (WAV, AIFF, FLAC) become 224 kbps MP3. An MP3 source is
# copied as it is, never re-encoded; any other lossy source keeps its own
# format and extension. Keep the original downloads in media-sources/neffex/,
# outside the site. The manifest gets a per-track gain from each file's
# integrated loudness (EBU R128), so the louder song is turned down to match
# the quieter one; the files themselves are never altered. Needs ffmpeg and
# ffprobe (brew install ffmpeg).
set -euo pipefail

out="$(cd "$(dirname "$0")/.." && pwd)/public/audio/game-mode"
[ $# -eq 2 ] || { echo "usage: $0 <best-of-me file> <grateful file>" >&2; exit 1; }
command -v ffmpeg >/dev/null && command -v ffprobe >/dev/null || { echo "ffmpeg and ffprobe are required (brew install ffmpeg)" >&2; exit 1; }
mkdir -p "$out"

prepare() {
  local source="$1" id="$2" codec extension target
  codec=$(ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of csv=p=0 "$source")
  case "$codec" in
    pcm_*|flac|alac) extension=mp3; target="$out/neffex-$id.mp3"; ffmpeg -v error -y -i "$source" -map 0:a:0 -c:a libmp3lame -b:a 224k "$target" ;;
    mp3) extension=mp3; target="$out/neffex-$id.mp3"; cp "$source" "$target" ;;
    aac) extension=m4a; target="$out/neffex-$id.m4a"; ffmpeg -v error -y -i "$source" -map 0:a:0 -c copy "$target" ;;
    opus|vorbis) extension=ogg; target="$out/neffex-$id.ogg"; ffmpeg -v error -y -i "$source" -map 0:a:0 -c copy "$target" ;;
    *) echo "unsupported source codec: $codec" >&2; exit 1 ;;
  esac
  local lufs
  lufs=$(ffmpeg -hide_banner -nostats -i "$target" -af ebur128 -f null - 2>&1 | awk '/Integrated loudness:/ {found=1} found && /I:/ {print $2; exit}')
  echo "$id|/audio/game-mode/neffex-$id.$extension|$lufs|$codec|$(wc -c < "$source" | tr -d ' ')|$(wc -c < "$target" | tr -d ' ')"
}

a=$(prepare "$1" best-of-me)
b=$(prepare "$2" grateful)
quiet=$(printf '%s\n%s\n' "$a" "$b" | awk -F'|' 'NR==1 || $3 < q {q=$3} END {print q}')
{
  echo '{'
  echo '  "tracks": ['
  printf '%s\n%s\n' "$a" "$b" | awk -F'|' -v q="$quiet" '{ gain = exp(log(10) * (q - $3) / 20); printf "    { \"id\": \"%s\", \"src\": \"%s\", \"gain\": %.3f, \"lufs\": %s }%s\n", $1, $2, gain, $3, (NR == 1 ? "," : "") }'
  echo '  ]'
  echo '}'
} > "$out/manifest.json"

printf '%s\n%s\n' "$a" "$b" | awk -F'|' '{ printf "%-11s source %-10s %9d bytes -> %9d bytes, %s LUFS\n", $1, $4, $5, $6, $3 }'
cat "$out/manifest.json"
