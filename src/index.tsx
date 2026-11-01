import {
  PanelSection,
  PanelSectionRow,  
  SliderField,
  staticClasses,
  ButtonItem
} from "@decky/ui";
import {
  addEventListener,
  removeEventListener,
  callable,
  definePlugin,
  toaster,
} from "@decky/api"
import { useEffect, useState} from "react";
import { FaShip } from "react-icons/fa";



// Extend Window interface to recognize Decky's backend bridge
declare global {
    interface Window {
        callServerMethod<T = any>(method: string, args?: Record<string, any>): Promise<T>;
    }
}

type RunningGame = {
  app_id: string;
  pid: string;
  process: string;
  name: string | null;
};

type GameProfile = {
  tdp_ac: number;
  tdp_battery: number;
  fps_ac: number;
  fps_battery: number;
};

type GameProfiles = Record<string, GameProfile>;


const getPowerStatus = callable<[], string>("get_power_status");
const getTdpLimit = callable<[], number>("get_tdp_limit");
// const setTdpLimit = callable<[number], boolean>("set_tdp_limit");
const getRunningGames = callable<[], RunningGame[]>("get_running_games");
const getGameProfiles = callable<[], GameProfiles>("get_game_profiles");
const getAvailableFps = callable<[], number[]>("get_available_fps");
const saveGameProfile = callable<
  [string, number, number, number, number],
  boolean
>("save_game_profile");


function Content() {
  const [powerStatus, setPowerStatus] = useState("UNKNOWN");
  const [runningGames, setRunningGames] = useState<RunningGame[]>([]);
  const [,setGamesError] = useState("");
  const [tdpLimit, setTdpLimitState] = useState(15);
  const [tdpError, setTdpError] = useState("");
  const [gameProfiles, setGameProfiles] = useState<GameProfiles>({});
  const [selectedGameId, setSelectedGameId] = useState("");
  const [tdpAc, setTdpAc] = useState(15);
  const [tdpBattery, setTdpBattery] = useState(8);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [fpsAc, setFpsAc] = useState(0);
  const [fpsBattery, setFpsBattery] = useState(0);
  const [availableFps, setAvailableFps] = useState<number[]>([0]);

  useEffect(() => {
    let active = true;

    const updatePowerStatus = async () => {
      try {
        const status = await getPowerStatus();
        if (active) {
          setPowerStatus(status);
        }
      } catch (error) {
        console.error("Failed to get power status:", error);
      }
    };

    const updateTdpLimit = async () => {
    try {
      const limit = await getTdpLimit();
      if (active) {
        setTdpLimitState(limit);
        setTdpError("");
      }
    } catch (error) {
      console.error("Failed to get TDP limit:", error);
      if (active) {
        setTdpError(String(error));
      }
    }
  };

    const updateRunningGames = async () => {
      try {
        const games = await getRunningGames();
        if (active) {
          setRunningGames(games);
          setGamesError("");
        }
      } catch (error) {
        console.error("Failed to get running games:", error);
        if (active) {
          setGamesError(String(error));
        }
      }
    };

      const loadAvailableFps = async () => {
    try {
      const values = await getAvailableFps();
      if (active) {
        setAvailableFps(values);
      }
    } catch (error) {
      if (active) {
        setProfileError(`Failed to load FPS options: ${String(error)}`);
      }
    }
  };

void loadAvailableFps();

    void updatePowerStatus();
    void updateTdpLimit();
    void updateRunningGames();

    const timer = window.setInterval(() => {
      void updatePowerStatus();
      void updateRunningGames();
      void loadAvailableFps();

    }, 2000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
  let active = true;

  const loadProfiles = async () => {
    try {
      const profiles = await getGameProfiles();
      if (active) {
        setGameProfiles(profiles);
      }
    } catch (error) {
      if (active) {
        setProfileError(String(error));
      }
    }
  };

  void loadProfiles();


  

  return () => {
    active = false;
  };
  }, []);

  

  useEffect(() => {
  if (!selectedGameId) return;

  const profile = gameProfiles[selectedGameId];

  setTdpAc(profile?.tdp_ac ?? 15);
  setTdpBattery(profile?.tdp_battery ?? 8);

  setFpsAc(profile?.fps_ac ?? 0);
  setFpsBattery(profile?.fps_battery ?? 0);

  setProfileMessage("");
  setProfileError("");
}, [selectedGameId, gameProfiles]);

  const handleSaveProfile = async () => {
  if (!selectedGameId) return;

  try {
    await saveGameProfile(
      selectedGameId,
      tdpAc,
      tdpBattery,
      fpsAc,
      fpsBattery
    );
    setGameProfiles((previous) => ({
      ...previous,
      [selectedGameId]: {
        tdp_ac: tdpAc,
        tdp_battery: tdpBattery,
        fps_ac: fpsAc,
        fps_battery: fpsBattery,
      },
    }));

    setProfileMessage("Profile saved successfully.");
    setProfileError("");
  } catch (error) {
    setProfileError(String(error));
    setProfileMessage("");
  }
};

  const statusText = {
    AC: "Connected to power adapter",
    BATTERY: "Running on battery",
    UNKNOWN: "Failed to determine power source",
  }[powerStatus] ?? "Unknown state";

  const maxAvailableFps = availableFps[availableFps.length - 1] ?? 0;

  const displayedFpsAc = availableFps.includes(fpsAc)
    ? fpsAc
    : maxAvailableFps;

  const displayedFpsBattery = availableFps.includes(fpsBattery)
    ? fpsBattery
    : maxAvailableFps;

  const hasUnsupportedFps =
    !availableFps.includes(fpsAc) ||
    !availableFps.includes(fpsBattery);

 

return (
  <PanelSection title="Power Profiles">
    {/* Power Source Status */}
    <PanelSectionRow>
      <div style={{ padding: "8px 0" }}>
        Power Source: <b>{statusText}</b>
      </div>
    </PanelSectionRow>

    {/* Game Profile Configuration */}
    <PanelSectionRow>
      <div style={{ padding: "8px 0", width: "100%" }}>
        <b>Game Profile</b>

        {runningGames.length === 0 ? (
          <div style={{ marginTop: "6px" }}>
            Start a game to configure its profile.
          </div>
        ) : (
          <>
            {/* Running Games */}
            {runningGames.map((game) => {
              const isSelected = selectedGameId === game.app_id;
              return (
                <div 
                  key={game.app_id} 
                  style={{ 
                    marginTop: "6px",
                    borderRadius: "4px",
                    border: isSelected ? "1px solid #66c0f4" : "1px solid rgba(255,255,255,0.15)",
                    background: isSelected ? "rgba(102,192,244,0.2)" : "rgba(255,255,255,0.05)",
                  }}
                >
                <ButtonItem
                  layout="below"
                  onClick={() => setSelectedGameId(game.app_id)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                    <span>
                      {game.name ? `🎮 ${game.name}` : `⚙️ Global / Unlisted Game (${game.app_id})`}
                    </span>
                    <span style={{ fontSize: "12px", color: "#8b929a" }}>
                      {isSelected ? "[Selected ⚙️]" : "Configure ›"}
                    </span>
                  </div>
                </ButtonItem>
                </div>
              );
            })}

            {/* Selected Game Profile Settings */}
            {selectedGameId && (
              <>
                {/* TDP Sliders */}
                <div style={{ marginTop: "12px" }}>
                  <SliderField
                    label={`AC: ${tdpAc} watts`}
                    value={tdpAc}
                    min={3}
                    max={15}
                    step={1}
                    showValue
                    onChange={(value) => {
                      setTdpAc(Math.round(value));
                      setProfileMessage("");
                    }}
                  />
                </div>

                <div style={{ marginTop: "12px" }}>
                  <SliderField
                    label={`Battery: ${tdpBattery} watts`}
                    value={tdpBattery}
                    min={3}
                    max={15}
                    step={1}
                    showValue
                    onChange={(value) => {
                      setTdpBattery(Math.round(value));
                      setProfileMessage("");
                    }}
                  />
                </div>

                {/* FPS Sliders */}
                <div style={{ marginTop: "12px" }}>
                  <SliderField
                    label={`AC FPS: ${displayedFpsAc}`}
                    value={Math.max(
                      0,
                      availableFps.indexOf(displayedFpsAc)
                    )}
                    min={0}
                    max={Math.max(0, availableFps.length - 1)}
                    step={1}
                    showValue={false}
                    onChange={(index) => {
                      const next =
                        availableFps[Math.round(index)] ?? 0;
                      setFpsAc(next);
                      setProfileMessage("");
                    }}
                  />
                </div>

                <div style={{ marginTop: "12px" }}>
                  <SliderField
                    label={`Battery FPS: ${displayedFpsBattery}`}
                    value={Math.max(
                      0,
                      availableFps.indexOf(displayedFpsBattery)
                    )}
                    min={0}
                    max={Math.max(0, availableFps.length - 1)}
                    step={1}
                    showValue={false}
                    onChange={(index) => {
                      const next =
                        availableFps[Math.round(index)] ?? 0;
                      setFpsBattery(next);
                      setProfileMessage("");
                    }}
                  />
                </div>

                {/* FPS Availability Warning */}
                {hasUnsupportedFps && (
                  <div
                    style={{
                      marginTop: "8px",
                      color: "#f0ad4e",
                      whiteSpace: "normal",
                    }}
                  >
                    Configured FPS is unavailable on this display.
                    The maximum available FPS is selected.
                  </div>
                )}

                {/* Save Profile */}
                <div 
                  style={{ 
                    marginTop: "12px",
                    borderRadius: "4px",
                    background: "#66c0f4",
                  }}
                >
                <ButtonItem
                  layout="below"
                  onClick={() => void handleSaveProfile()}
                >
                  <span style={{ color: "#171a21", fontWeight: 600 }}>
                    💾 Apply Profile Settings
                  </span>
                </ButtonItem>
                </div>

                {profileMessage && (
                  <div style={{ marginTop: "8px" }}>
                    {profileMessage}
                  </div>
                )}

                {profileError && (
                  <div
                    style={{
                      marginTop: "8px",
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                    }}
                  >
                    Error profile: {profileError}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </PanelSectionRow>

    {/* Global TDP Limit */}
    <PanelSectionRow>
      <div style={{ padding: "8px 0", width: "100%" }}>
        <b>Limit TDP: {tdpLimit} watts</b>

        {tdpError && (
          <div style={{ whiteSpace: "normal" }}>
            Error: {tdpError}
          </div>
        )}
      </div>
    </PanelSectionRow>
  </PanelSection>
);
}

export default definePlugin(() => {
  console.log("Template plugin initializing, this is called once on frontend startup")
  const listener = addEventListener<[
    test1: string,
    test2: boolean,
    test3: number
  ]>("timer_event", (test1, test2, test3) => {
    console.log("Template got timer_event with:", test1, test2, test3)
    toaster.toast({
      title: "template got timer_event",
      body: `${test1}, ${test2}, ${test3}`
    });
  });

  return {
    name: "Decky Power Profiles",
    titleView: <div className={staticClasses.Title}>Decky Example Plugin</div>,    
    content: <Content />,
    icon: <FaShip />,
    onDismount() {
      console.log("Unloading")
      removeEventListener("timer_event", listener);
    },
  };
});
