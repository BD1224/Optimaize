import { LogInPage } from "./auth/LogInPage";
import { SignUpPage } from "./auth/SignUpPage";
import { ChatPage } from "./chat/ChatPage";
import { Sidebar } from "./components/Sidebar";
import styles from "./components/shell.module.css";
import { DashboardPage } from "./dashboard/DashboardPage";
import { LessonsPage } from "./lessons/LessonsPage";
import { AuthProvider, useAuth } from "./lib/auth";
import { usePath } from "./lib/router";
import { AppProvider } from "./lib/store";
import { OnboardingPage } from "./onboarding/OnboardingPage";
import { SettingsPage } from "./settings/SettingsPage";

export function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

/** Shows log in or sign up until someone is logged in, then the app. */
function Gate() {
  // AUTH: who is logged in, from lib/auth.tsx. undefined = still checking, null = nobody.
  const { user } = useAuth();
  // The page in the address after "#", e.g. "/signup". Picks Log in or Sign up while nobody is logged in.
  const path = usePath();

  // Still asking the backend whether someone is logged in.
  if (user === undefined) return null;
  if (user === null) return path === "/signup" ? <SignUpPage /> : <LogInPage />;

  // Keyed by user so logging out and in as someone else starts with fresh data.
  return (
    <AppProvider key={user.id}>
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
