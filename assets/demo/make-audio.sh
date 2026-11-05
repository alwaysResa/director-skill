#!/usr/bin/env bash
# Generate the demo's 5-second bed + two clicks, deterministically.
set -euo pipefail
cd "$(dirname "$0")"

ffmpeg -y -v error \
  -f lavfi -i "sine=frequency=110:duration=5:sample_rate=44100" \
  -f lavfi -i "anoisesrc=color=pink:duration=5:sample_rate=44100" \
  -f lavfi -i "sine=frequency=880:duration=0.06:sample_rate=44100" \
  -f lavfi -i "sine=frequency=1320:duration=0.06:sample_rate=44100" \
  -filter_complex "\
[0:a]volume=0.10,lowpass=f=260[bed];\
[1:a]volume=0.022,lowpass=f=900[air];\
[2:a]volume=0.42,adelay=600,apad=whole_dur=5[c1];\
[3:a]volume=0.32,adelay=2200,apad=whole_dur=5[c2];\
[bed][air][c1][c2]amix=inputs=4:duration=longest:normalize=0,alimiter=limit=0.8,loudnorm=I=-16:TP=-1.5:LRA=11[out]" \
  -map "[out]" -ac 2 -ar 44100 -c:a aac -b:a 96k tone.m4a

ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 tone.m4a
