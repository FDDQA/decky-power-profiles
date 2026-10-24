import os
import decky
import asyncio
import json

class Plugin:
    async def add(self, left: int, right: int) -> int:
        return left + right

    async def long_running(self):
        await asyncio.sleep(15)
        await decky.emit("timer_event", "Hello from the backend!", True, 2)

    async def _main(self):
        self.loop = asyncio.get_running_loop()
        self._profile_task = asyncio.create_task(
            self._profile_monitor()
        )
        decky.logger.info("Power Profiles started")

    async def _unload(self):
        task = getattr(self, "_profile_task", None)

        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        await self._restore_original_tdp()
        decky.logger.info("Power Profiles stopped")

    async def _uninstall(self):
        decky.logger.info("Goodbye World!")
        pass

    async def start_timer(self):
        self.loop.create_task(self.long_running())

    async def _migration(self):
        decky.logger.info("Migrating")
        decky.migrate_logs(os.path.join(decky.DECKY_USER_HOME,
                                               ".config", "decky-template", "template.log"))
        decky.migrate_settings(
            os.path.join(decky.DECKY_HOME, "settings", "template.json"),
            os.path.join(decky.DECKY_USER_HOME, ".config", "decky-template"))
        decky.migrate_runtime(
            os.path.join(decky.DECKY_HOME, "template"),
            os.path.join(decky.DECKY_USER_HOME, ".local", "share", "decky-template"))

    async def get_power_status(self) -> str:
        path = "/sys/class/power_supply/ACAD/online"

        try:
            with open(path, "r") as f:
                online = f.read().strip()
            return "AC" if online == "1" else "BATTERY"
        except OSError as e:
            decky.logger.error(f"Failed to read power status: {e}")
            return "UNKNOWN"

    async def get_tdp_limit(self) -> int:
        process = await asyncio.create_subprocess_exec(
            "steamosctl",
            "get-tdp-limit",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()

        if process.returncode != 0:
            raise RuntimeError(stderr.decode().strip())

        return int(stdout.decode().strip().split(":")[-1].strip())

    async def set_tdp_limit(self, limit: int) -> bool:
        if not 3 <= limit <= 15:
            raise ValueError("TDP limit must be between 3 and 15 W")

        process = await asyncio.create_subprocess_exec(
            "steamosctl",
            "set-tdp-limit",
            str(limit),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()

        if process.returncode != 0:
            raise RuntimeError(stderr.decode().strip())

        return True

    async def get_running_games(self) -> list[dict[str, str]]:
        games = {}

        ignored_processes = (
            "steam", "steamwebhelper", "pressure-vessel",
            "reaper", "gamescope", "wineserver", "winedevice",
            "explorer.exe", "services.exe", "svchost.exe",
        )

        for pid in os.listdir("/proc"):
            if not pid.isdigit():
                continue

            try:
                with open(f"/proc/{pid}/environ", "rb") as f:
                    entries = f.read().split(b"\0")

                env = {}
                for entry in entries:
                    if b"=" in entry:
                        key, value = entry.split(b"=", 1)
                        env[key.decode(errors="ignore")] = (
                            value.decode(errors="ignore")
                        )

                app_id = env.get("SteamGameId") or env.get("SteamAppId")

                if not app_id or not app_id.isdigit() or app_id == "0":
                    continue

                with open(f"/proc/{pid}/cmdline", "rb") as f:
                    argv = f.read().split(b"\0")

                process = next(
                    (arg.decode(errors="ignore") for arg in argv if arg),
                    "unknown",
                )
                process_name = os.path.basename(process)

                if process_name.lower() in ignored_processes:
                    continue

                if app_id not in games:
                    games[app_id] = {
                        "app_id": app_id,
                        "pid": pid,
                        "process": process_name,
                    }

            except (OSError, ValueError):
                continue

        return list(games.values())

    def _get_profiles_path(self):
        return os.path.join(
            decky.DECKY_PLUGIN_SETTINGS_DIR,
            "power_profiles.json",
        )

    async def get_game_profiles(self) -> dict:
        path = self._get_profiles_path()

        try:
            with open(path, "r", encoding="utf-8") as f:
                profiles = json.load(f)
            return profiles if isinstance(profiles, dict) else {}
        except FileNotFoundError:
            return {}
        except (OSError, json.JSONDecodeError) as e:
            decky.logger.error(f"Failed to load game profiles: {e}")
            return {}

    async def save_game_profile(
        self,
        app_id: str,
        tdp_ac: int,
        tdp_battery: int,
    ) -> bool:
        if not app_id.isdigit() or app_id == "0":
            raise ValueError("Invalid App ID")

        if not 3 <= tdp_ac <= 15 or not 3 <= tdp_battery <= 15:
            raise ValueError("TDP must be between 3 and 15 W")

        profiles = await self.get_game_profiles()
        profiles[app_id] = {
            "tdp_ac": tdp_ac,
            "tdp_battery": tdp_battery,
        }

        path = self._get_profiles_path()
        os.makedirs(os.path.dirname(path), exist_ok=True)

        with open(path, "w", encoding="utf-8") as f:
            json.dump(profiles, f, indent=2)

        return True

    async def _restore_original_tdp(self):
        original_tdp = getattr(self, "_original_tdp", None)

        if original_tdp is not None:
            await self.set_tdp_limit(original_tdp)
            self._original_tdp = None

        self._active_profile_key = None

    async def _apply_profile_logic(self):
        try:
            games = await self.get_running_games()
            power_status = await self.get_power_status()
            
            decky.logger.info(f"[TDP DEBUG] games={games}, power={power_status}")

            if not games or power_status not in ("AC", "BATTERY"):
                if self._active_profile_key is not None:
                    await self._restore_original_tdp()
            else:
                game = games[0]
                profiles = await self.get_game_profiles()
                profile = profiles.get(game["app_id"])
                decky.logger.info(f"[TDP DEBUG] app_id={game['app_id']}, profile={profile}")

                if profile is None:
                    if self._active_profile_key is not None:
                        await self._restore_original_tdp()
                else:
                    tdp_key = "tdp_ac" if power_status == "AC" else "tdp_battery"
                    target_tdp = profile.get(tdp_key)

                    if isinstance(target_tdp, int) and 3 <= target_tdp <= 15:
                        profile_key = (game["app_id"], power_status, target_tdp)
                        actual_tdp = await self.get_tdp_limit()

                        if profile_key != self._active_profile_key or actual_tdp != target_tdp:
                            if self._original_tdp is None:
                                self._original_tdp = actual_tdp

                            decky.logger.info(f"[TDP Apply] Setting TDP={target_tdp}, power={power_status}, game={game['app_id']}")
                            await self.set_tdp_limit(target_tdp)
                            
                            await asyncio.sleep(0.5)
                            final_check_tdp = await self.get_tdp_limit()
                            if final_check_tdp != target_tdp:
                                decky.logger.info(f"[TDP Override] System reset to {final_check_tdp}, enforcing {target_tdp} again")
                                await self.set_tdp_limit(target_tdp)

                            self._active_profile_key = profile_key
                    else:
                        if self._active_profile_key is not None:
                            await self._restore_original_tdp()
        except Exception as e:
            decky.logger.error(f"Apply profile logic error: {e}")
    async def _profile_monitor(self):
        self._original_tdp = None
        self._active_profile_key = None
        
        last_power_status = None
        last_game_id = None

        while True:
            try:
                games = await self.get_running_games()
                power_status = await self.get_power_status()
                
                current_game_id = games[0]["app_id"] if games else None

                state_changed = (power_status != last_power_status) or (current_game_id != last_game_id)
                last_power_status = power_status
                last_game_id = current_game_id

                if state_changed:
                    decky.logger.info(f"[TDP Event] State changed! Power: {power_status}, Game: {current_game_id}")
                    await asyncio.sleep(1.0)
                    games = await self.get_running_games()
                    power_status = await self.get_power_status()

                if not games or power_status not in ("AC", "BATTERY"):
                    if self._active_profile_key is not None:
                        await self._restore_original_tdp()
                else:
                    game = games[0]
                    profiles = await self.get_game_profiles()
                    profile = profiles.get(game["app_id"])

                    if profile is None:
                        if self._active_profile_key is not None:
                            await self._restore_original_tdp()
                    else:
                        tdp_key = "tdp_ac" if power_status == "AC" else "tdp_battery"
                        target_tdp = profile.get(tdp_key)

                        if isinstance(target_tdp, int) and 3 <= target_tdp <= 15:
                            profile_key = (game["app_id"], power_status, target_tdp)
                            actual_tdp = await self.get_tdp_limit()

                            if profile_key != self._active_profile_key or actual_tdp != target_tdp:
                                if self._original_tdp is None:
                                    self._original_tdp = actual_tdp

                                decky.logger.info(f"[TDP Apply] Setting TDP={target_tdp} for game {game['app_id']}")
                                await self.set_tdp_limit(target_tdp)
                                
                                await asyncio.sleep(0.4)
                                if await self.get_tdp_limit() != target_tdp:
                                    await self.set_tdp_limit(target_tdp)

                                self._active_profile_key = profile_key
                        else:
                            if self._active_profile_key is not None:
                                await self._restore_original_tdp()

            except asyncio.CancelledError:
                raise
            except Exception as e:
                decky.logger.error(f"Profile monitor error: {e}")

            await asyncio.sleep(2.0)