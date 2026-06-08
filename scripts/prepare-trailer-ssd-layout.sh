#!/usr/bin/env bash
set -euo pipefail

ROOT="${TRAILER_ROOT:-/srv/trailer}"

DIRS=(
  "$ROOT/data/oiab/backups"
  "$ROOT/data/oiab/certs"
  "$ROOT/data/oiab/config"
  "$ROOT/data/oiab/db"
  "$ROOT/data/oiab/logs"
  "$ROOT/data/oiab/maps/packs"
  "$ROOT/data/oiab/maps/styles"
  "$ROOT/data/oiab/maps/sprites"
  "$ROOT/data/oiab/maps/tmp"
  "$ROOT/data/oiab/media/music-art"
  "$ROOT/data/oiab/media/uploads"
  "$ROOT/data/oiab/trivia/questions"
  "$ROOT/data/oiab/tracks"
  "$ROOT/data/oiab/waypoints"
  "$ROOT/media/music"
  "$ROOT/media/books/Ebooks"
  "$ROOT/media/books/Comics"
  "$ROOT/media/books/PDFs"
  "$ROOT/media/movies"
  "$ROOT/media/tv"
  "$ROOT/media/home-videos"
  "$ROOT/media/incoming"
  "$ROOT/roms"
  "$ROOT/wikis/zims"
  "$ROOT/wikis/static"
  "$ROOT/jellyfin/config"
  "$ROOT/jellyfin/cache"
  "$ROOT/minecraft/server"
  "$ROOT/minecraft/backups"
)

for dir in "${DIRS[@]}"; do
  install -d -m 0775 "$dir"
done

echo "Prepared OIAB trailer SSD layout under $ROOT"
