import { ChatPage } from "./chat/ChatPage";
import { Sidebar } from "./components/Sidebar";
import styles from "./components/shell.module.css";
import { DashboardPage } from "./dashboard/DashboardPage";
import { LessonsPage } from "./lessons/LessonsPage";
import { usePath } from "./lib/router";
import { AppProvider } from "./lib/store";
import { OnboardingPage } from "./onboarding/OnboardingPage";
import { SettingsPage } from "./settings/SettingsPage";

export function App() {
  return (
    <AppProvider>
      <div className={styles.shell}>
        <Sidebar />
        <main className={styles.main}>
          <CurrentPage />
        </main>
      </div>
    </AppProvider>
  );
}

function CurrentPage() {
  const path = usePath();
  const chatId = /^\/c\/([^/]+)$/.exec(path)?.[1];
  if (chatId) return <ChatPage key={chatId} chatId={chatId} />;

  switch (path) {
    case "/dashboard":
      return <DashboardPage />;
    case "/settings":
      return <SettingsPage />;
    case "/onboarding":
      return <OnboardingPage />;
    case "/lessons":
      return <LessonsPage />;
    default:
      return <ChatPage key="new" />;
  }
}
