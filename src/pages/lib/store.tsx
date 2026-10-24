import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api/client";
import { AUTO_MODEL, type ChatSummary, type Model, type Profile, type Stats } from "../api/types";

const WEEK = 7 * 24 * 60 * 60 * 1000;

interface AppState {
  profile: Profile | null;
  setProfile: (profile: Profile) => void;
  models: Model[];
  /** Model chosen in the top bar for new messages, or AUTO_MODEL. */
  model: string;
  setModel: (id: string) => void;
  chats: ChatSummary[];
  weekStats: Stats | null;
  /** When chats were last loaded (epoch ms, 0 before the first load). Used for date grouping. */
  loadedAt: number;
  /** Reloads chats and this week's stats after anything changes them. */
  refresh: () => Promise<void>;
}

interface ChatData {
  chats: ChatSummary[];
  weekStats: Stats | null;
  loadedAt: number;
}

async function fetchChatData(): Promise<ChatData> {
  const loadedAt = Date.now();
  // BACKEND: the chat list for the sidebar, and this week's savings (team name: getWeeklyStats).
  const [chats, weekStats] = await Promise.all([api.listChats(), api.getStats(loadedAt - WEEK)]);
  return { chats, weekStats, loadedAt };
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  // BACKEND: the model picked in the top bar ("auto" = let the router choose). Sent with every message.
  const [model, setModel] = useState(AUTO_MODEL);
  const [data, setData] = useState<ChatData>({ chats: [], weekStats: null, loadedAt: 0 });

  const refresh = useCallback(async () => setData(await fetchChatData()), []);

  useEffect(() => {
    // BACKEND: loads the user's settings (name, languages, translate default) when the app opens.
    api.getProfile().then(setProfile);
    // BACKEND: the Claude models and their prices, for the model picker and Upgrade button.
    api.listModels().then(setModels);
    fetchChatData().then(setData);
  }, []);

  const value = useMemo(
    () => ({ profile, setProfile, models, model, setModel, ...data, refresh }),
    [profile, models, model, data, refresh],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside <AppProvider>");
  return context;
}
