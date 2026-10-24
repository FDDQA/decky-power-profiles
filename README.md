# Decky Power Profiles

Custom Decky Loader plugin for managing per-game TDP profiles with automatic AC and battery switching on Steam Deck.

## Features

- **Per-Game TDP**: Configure and save individual TDP limits for each game.
- **Power Source Detection**: Automatically switch profiles depending on whether you are plugged into AC power or running on battery.
- **Native Integration**: Seamless UI built with React, integrated directly into the Decky Loader menu.

## Installation

1. Download the latest release `.zip` from the [Releases](https://github.com/FDDQA/decky-power-profiles/releases) page.
2. Unpack the archive into your Steam Deck's plugin directory (`~/homebrew/plugins/`):
   ```bash
   unzip decky-power-profiles.zip -d ~/.homebrew/plugins/
   ```