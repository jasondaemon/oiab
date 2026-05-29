#!/usr/bin/env bash
set -euo pipefail

OIAB_DATA_DIR="${OIAB_DATA_DIR:-/data/oiab}"
MODE="${OIAB_CONTENT_MIGRATION_MODE:-link}" # link or copy

books_root="${OIAB_BOOKS_TARGET:-$OIAB_DATA_DIR/media/books}"
wikis_root="${OIAB_WIKIS_TARGET:-$OIAB_DATA_DIR/content/wikis}"

log() {
  printf '%s\n' "$*"
}

find_first_existing() {
  for path in "$@"; do
    if [ -n "$path" ] && [ -e "$path" ]; then
      printf '%s\n' "$path"
      return 0
    fi
  done
  return 1
}

install_content() {
  local label="$1"
  local source="$2"
  local target="$3"
  if [ -z "$source" ] || [ ! -e "$source" ]; then
    log "skip: $label source not found"
    return 0
  fi
  mkdir -p "$(dirname "$target")"
  if [ -e "$target" ] || [ -L "$target" ]; then
    log "exists: $target"
    return 0
  fi
  if [ "$MODE" = "copy" ]; then
    log "copy: $label -> $target"
    mkdir -p "$target"
    rsync -a "$source"/ "$target"/
  else
    log "link: $label -> $target"
    ln -s "$source" "$target"
  fi
}

survivor_source="${OIAB_SURVIVOR_LIBRARY_SOURCE:-}"
medical_source="${OIAB_MEDICAL_LIBRARY_SOURCE:-}"
minecraft_wiki_source="${OIAB_MINECRAFT_WIKI_SOURCE:-}"
pokemon_wiki_source="${OIAB_POKEMON_WIKI_SOURCE:-}"

if [ -z "$survivor_source" ]; then
  survivor_source="$(find_first_existing \
    /library/www/html/modules/survivor* \
    /library/www/html/modules/en-survivor* \
    /srv/trailer/content/survivor* \
    /srv/trailer/media/books/Survivor* || true)"
fi

if [ -z "$medical_source" ]; then
  medical_source="$(find_first_existing \
    /library/www/html/modules/medical* \
    /library/www/html/modules/en-medical* \
    /srv/trailer/content/medical* \
    /srv/trailer/media/books/Medical* || true)"
fi

if [ -z "$minecraft_wiki_source" ]; then
  minecraft_wiki_source="$(find_first_existing \
    /library/www/html/modules/*minecraft*wiki* \
    /srv/trailer/content/wikis/minecraft \
    /srv/trailer/wikis/minecraft || true)"
fi

if [ -z "$pokemon_wiki_source" ]; then
  pokemon_wiki_source="$(find_first_existing \
    /library/www/html/modules/*pokemon*wiki* \
    /srv/trailer/content/wikis/pokemon \
    /srv/trailer/wikis/pokemon || true)"
fi

install_content "Survivor Library" "$survivor_source" "$books_root/Survivor Library"
install_content "Medical Library" "$medical_source" "$books_root/Medical Library"
install_content "Minecraft Wiki" "$minecraft_wiki_source" "$wikis_root/minecraft"
install_content "Pokemon Wiki" "$pokemon_wiki_source" "$wikis_root/pokemon"

log "done. Set OIAB_CONTENT_MIGRATION_MODE=copy if you want copies instead of symlinks."
