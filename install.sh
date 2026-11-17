#!/usr/bin/env bash

set -e

REPO="FDDQA/decky-power-profiles"
PLUGINS_DIR="/home/deck/homebrew/plugins"
PLUGIN_NAME="decky-power-profiles"

LATEST_RELEASE=$(curl -fs "https://api.github.com/repos/${REPO}/releases/latest" || true)
DOWNLOAD_URL=$(echo "$LATEST_RELEASE" | grep -oP '"browser_download_url":\s*"\K[^"]+\.zip' | head -n 1)

if [ -z "$DOWNLOAD_URL" ]; then
    echo "Error: no built release found at https://github.com/${REPO}/releases" >&2
    exit 1
fi

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

curl -fsSL "$DOWNLOAD_URL" -o "$TMP_DIR/plugin.zip"

mkdir -p "$PLUGINS_DIR"
rm -rf "${PLUGINS_DIR}/${PLUGIN_NAME}"

unzip -q "$TMP_DIR/plugin.zip" -d "$TMP_DIR/extracted"

EXTRACTED_FOLDER=$(find "$TMP_DIR/extracted" -mindepth 1 -maxdepth 1 -type d | head -n 1)

if [ -f "${EXTRACTED_FOLDER}/plugin.json" ]; then
    mv "$EXTRACTED_FOLDER" "${PLUGINS_DIR}/${PLUGIN_NAME}"
elif [ -f "$TMP_DIR/extracted/plugin.json" ]; then
    mv "$TMP_DIR/extracted" "${PLUGINS_DIR}/${PLUGIN_NAME}"
else
    echo "Error: plugin.json not found in archive"
    exit 1
fi

sudo systemctl restart plugin_loader.service