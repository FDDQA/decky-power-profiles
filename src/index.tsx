import {
  PanelSection,
  PanelSectionRow,  
  SliderField,
  staticClasses
} from "@decky/ui";
import {
  addEventListener,
  removeEventListener,
  callable,
  definePlugin,
  toaster,
} from "@decky/api"
import { useEffect, useState } from "react";
import { FaShip } from "react-icons/fa";

type RunningGame = {
  app_id: string;
  pid: string;
  process: string;
};
type GameProfile = {
  tdp_ac: number;
  tdp_battery: number;
};
type GameProfiles = Record<string, GameProfile>;


const getPowerStatus = callable<[], string>("get_power_status");
const getTdpLimit = callable<[], number>("get_tdp_limit");
const setTdpLimit = callable<[number], boolean>("set_tdp_limit");
const getRunningGames = callable<[], RunningGame[]>("get_running_games");
const getGameProfiles = callable<[], GameProfiles>("get_game_profiles");
const saveGameProfile = callable<
  [string, number, number],
  boolean
>("save_game_profile");


function Content() {
  const [powerStatus, setPowerStatus] = useState("UNKNOWN");
  const [runningGames, setRunningGames] = useState<RunningGame[]>([]);
  const [gamesError, setGamesError] = useState("");
  const [tdpLimit, setTdpLimitState] = useState(15);
  const [tdpError, setTdpError] = useState("");
  const [gameProfiles, setGameProfiles] = useState<GameProfiles>({});
  const [selectedGameId, setSelectedGameId] = useState("");
  const [tdpAc, setTdpAc] = useState(15);
  const [tdpBattery, setTdpBattery] = useState(8);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");

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

    void updatePowerStatus();
    void updateTdpLimit();
    void updateRunningGames();

    const timer = window.setInterval(() => {
      void updatePowerStatus();
      
      void updateRunningGames();
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

  setProfileMessage("");
  setProfileError("");
}, [selectedGameId, gameProfiles]);

  const handleSaveProfile = async () => {
  if (!selectedGameId) return;

  try {
    await saveGameProfile(selectedGameId, tdpAc, tdpBattery);

    setGameProfiles((previous) => ({
      ...previous,
      [selectedGameId]: {
        tdp_ac: tdpAc,
        tdp_battery: tdpBattery,
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

  return (
    <PanelSection title="Power Profiles">
      <PanelSectionRow>
        <div style={{ padding: "8px 0" }}>
          Power Source: <b>{statusText}</b>
        </div>
      </PanelSectionRow>
      <PanelSectionRow>
        <div style={{ padding: "8px 0", width: "100%" }}>
          <b>Running Games</b>

          {gamesError ? (
            <div style={{ marginTop: "6px", whiteSpace: "normal" }}>
              Error: {gamesError}
            </div>
          ) : runningGames.length === 0 ? (
            <div style={{ marginTop: "6px" }}>
              Games not found
            </div>
          ) : (
            runningGames.map((game) => (
              <div
                key={`${game.app_id}-${game.pid}`}
                style={{
                  marginTop: "8px",
                  whiteSpace: "normal",
                  overflowWrap: "anywhere",
                }}
              >
                App ID: <b>{game.app_id}</b>
                <br />
                Process: {game.process}
                <br />
                PID: {game.pid}
              </div>
            ))
          )}
        </div>
      </PanelSectionRow>

      <PanelSectionRow>
        <div style={{ padding: "8px 0", width: "100%" }}>
          <b>Game Profile</b>

          {runningGames.length === 0 ? (
            <div style={{ marginTop: "6px" }}>
              Start a game to configure its profile.
            </div>
          ) : (
            <>
              {runningGames.map((game) => (
                <div
                  key={game.app_id}
                  style={{ marginTop: "8px", whiteSpace: "normal" }}
                >
                  <button
                    onClick={() => setSelectedGameId(game.app_id)}
                  >
                    {selectedGameId === game.app_id ? "✓ " : ""}
                    {game.process} (ID: {game.app_id})
                  </button>

                  {gameProfiles[game.app_id] && (
                    <div>
                      AC: {gameProfiles[game.app_id].tdp_ac} Вт ·
                      Battery: {gameProfiles[game.app_id].tdp_battery} Вт
                    </div>
                  )}
                </div>
              ))}

              {selectedGameId && (
                <>
                  <div style={{ marginTop: "12px" }}>
                    <SliderField
                      label={`AC: ${tdpAc} Вт`}
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
                      label={`Battery: ${tdpBattery} Вт`}
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

                  <button
                    style={{ marginTop: "12px" }}
                    onClick={() => void handleSaveProfile()}
                  >
                    Save
                  </button>

                  {profileMessage && (
                    <div>{profileMessage}</div>
                  )}

                  {profileError && (
                    <div style={{ whiteSpace: "normal", overflowWrap: "anywhere" }}>
                      Error profile: {profileError}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </PanelSectionRow>
      <PanelSectionRow>
        <div style={{ padding: "8px 0", width: "100%" }}>
          <b>Limit TDP: {tdpLimit} Вт</b>

          {tdpError && (
            <div style={{ whiteSpace: "normal" }}>
              Error: {tdpError}
            </div>
          )}

      <PanelSectionRow>
        <SliderField
          label={`TDP: ${tdpLimit} Вт`}
          value={tdpLimit}
          min={3}
          max={15}
          step={1}
          showValue={true}
          onChange={async (value) => {
            const next = Math.round(value);

            setTdpLimitState(next);

            try {
              await setTdpLimit(next);
              setTdpError("");
            } catch (error) {
              setTdpError(String(error));
              setTdpLimitState(await getTdpLimit());
            }
          }}
        />
      </PanelSectionRow>
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
