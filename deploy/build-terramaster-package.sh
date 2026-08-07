#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$ROOT/deploy/dist"
OUTPUT="${1:-$DIST_DIR/piccolo-terramaster-deploy.tar.gz}"
STAGING="$DIST_DIR/staging"
MANIFEST="$ROOT/deploy/PACKAGE_MANIFEST.txt"

rm -rf "$STAGING"
mkdir -p "$DIST_DIR" "$STAGING"

copy_path() {
  local relative_path="$1"
  local source="$ROOT/$relative_path"
  local destination="$STAGING/$relative_path"

  if [[ ! -e "$source" ]]; then
    echo "Falta un archivo requerido del manifiesto: $relative_path" >&2
    exit 1
  fi

  mkdir -p "$(dirname "$destination")"
  if [[ -d "$source" ]]; then
    cp -a "$source" "$destination"
  else
    cp "$source" "$destination"
  fi
}

while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%%#*}"
  line="$(echo "$line" | xargs)"
  [[ -z "$line" ]] && continue
  [[ "$line" == -* ]] && continue
  copy_path "$line"
done < "$MANIFEST"

(
  cd "$STAGING"
  tar -czf "$OUTPUT" .
)

echo "Paquete creado: $OUTPUT"
tar -tzf "$OUTPUT" | sort
