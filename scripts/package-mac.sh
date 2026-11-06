#!/bin/zsh
# Gera dist/My Spoti Player-darwin-<arch>/My Spoti Player.app a partir de assets/icon.png.
set -e
cd "$(dirname "$0")/.."
iconset=dist/icon.iconset
rm -rf "$iconset" && mkdir -p "$iconset"
for size in 16 32 128 256; do
  sips -z $size $size assets/icon.png --out "$iconset/icon_${size}x${size}.png" >/dev/null
  sips -z $((size * 2)) $((size * 2)) assets/icon.png --out "$iconset/icon_${size}x${size}@2x.png" >/dev/null
done
cp assets/icon.png "$iconset/icon_512x512.png"
iconutil -c icns "$iconset" -o dist/icon.icns
npx electron-packager . "My Spoti Player" --platform=darwin --out=dist --overwrite \
  --icon=dist/icon.icns --ignore='^/(dist|docs|tests|scripts)($|/)'
