# Decky Power Profiles

Custom Decky Loader plugin for managing per-game TDP and FPS profiles with automatic AC and battery switching on Steam Deck.

## Features

- **Per-Game Profiles**: Configure and save individual TDP and FPS limits for each game or set global defaults.
- **Power Source Detection**: Automatically switch profiles depending on whether you are plugged into AC power or running on battery.
- **Native Integration**: Seamless UI built with React, integrated directly into the Decky Loader Quick Access menu.

## Quick Installation (One-Line Command)

Open Terminal in Desktop Mode (or connect via SSH) and run:

curl -sL https://raw.githubusercontent.com/FDDQA/decky-power-profiles/main/install.sh | sh

This script will automatically download the latest version, install it to your plugins folder, and restart Decky Loader.

---

## Manual Installation

If you prefer to install it manually:

1. Download the latest release `.zip` from the [Releases](https://github.com/FDDQA/decky-power-profiles/releases) page.
2. Unpack the archive into your Steam Deck's plugin directory:
   unzip decky-power-profiles.zip -d ~/homebrew/plugins/
3. Restart `plugin_loader.service` or reboot your Steam Deck.