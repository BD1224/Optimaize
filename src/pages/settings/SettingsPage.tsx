import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api/client";
import type { LanguageCode, Profile } from "../api/types";
import { TopBar } from "../components/TopBar";
import styles from "../components/page.module.css";
import { useAuth } from "../lib/auth";
import { LANGUAGES } from "../lib/languages";
import { navigate } from "../lib/router";
import { useApp } from "../lib/store";

export function SettingsPage() {
  const { profile } = useApp();

  return (
    <>
      <TopBar />
      <div className={styles.page}>
        <div className={styles.content}>
          <h1 className={styles.title}>Settings</h1>
          {profile && <ProfileForm initial={profile} />}
          <ApiKeyForm />
          <AccountSection />
        </div>
      </div>
    </>
  );
}

function ProfileForm({ initial }: { initial: Profile }) {
  const { setProfile } = useApp();
  const [draft, setDraft] = useState(initial);
  const [status, setStatus] = useState("");

  function toggleLanguage(code: LanguageCode) {
    setDraft((d) => ({
      ...d,
      languages: d.languages.includes(code) ? d.languages.filter((l) => l !== code) : [...d.languages, code],
    }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    // BACKEND: saves the settings form (name, languages, translate default, show "Sent as").
    setProfile(await api.updateProfile(draft));
    setStatus("Saved");
  }

  return (
    <form className={styles.form} onSubmit={save} onChange={() => setStatus("")}>
      <div className={styles.field}>
        <label htmlFor="name">Name</label>
        <input
          id="name"
          className={styles.input}
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
      </div>

      <fieldset className={styles.field}>
        <legend>Languages you write in (the first one you pick is used for greetings)</legend>
        {(Object.keys(LANGUAGES) as LanguageCode[]).map((code) => (
          <label key={code} className={styles.check}>
            <input type="checkbox" checked={draft.languages.includes(code)} onChange={() => toggleLanguage(code)} />
            <span lang={code}>{LANGUAGES[code].native}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className={styles.field}>
        <legend>Translation</legend>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={draft.translateByDefault}
            onChange={(e) => setDraft({ ...draft, translateByDefault: e.target.checked })}
          />
          Translate my messages through English before sending. Saves the most tokens, but can change what you
          meant. You can still switch it per message.
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={draft.showSentAs}
            onChange={(e) => setDraft({ ...draft, showSentAs: e.target.checked })}
          />
          Always show the prompt that was actually sent
        </label>
        <label className={styles.check} data-disabled="true">
          <input type="checkbox" disabled />
          Medical mode (coming later)
        </label>
      </fieldset>

      <div className={styles.actions}>
        <button type="submit" className={styles.button} disabled={draft.languages.length === 0}>
          Save
        </button>
        <span className={styles.status} role="status">
          {draft.languages.length === 0 ? "Pick at least one language" : status}
        </span>
      </div>
    </form>
  );
}

function ApiKeyForm() {
  // API KEY: the Anthropic key the user pastes in. Held only until Save, then cleared.
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState<boolean | null>(null);

  useEffect(() => {
    // API KEY: asks whether a key is already saved (team name: checkApiKey). Never returns the key itself.
    api.hasApiKey().then(setSaved);
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    // API KEY: handed to the backend here, which keeps it in the OS keychain.
    await api.saveApiKey(key);
    setKey("");
    setSaved(true);
  }

  return (
    <form className={styles.form} onSubmit={save}>
      <div className={styles.field}>
        <label htmlFor="api-key">Anthropic API key</label>
        <input
          id="api-key"
          type="password"
          autoComplete="off"
          className={styles.input}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={saved ? "A key is saved. Paste a new one to replace it." : "Paste your key"}
        />
        <p className={styles.note}>
          The key is handed to the app&apos;s backend, which keeps it in your computer&apos;s keychain. This screen
          never stores it.
        </p>
      </div>
      <div className={styles.actions}>
        <button type="submit" className={styles.button} disabled={!key.trim()}>
          Save key
        </button>
      </div>
    </form>
  );
}

function AccountSection() {
  // AUTH: user = who is logged in (shows their email). setUser(null) logs them out of the app (lib/auth.tsx).
  const { user, setUser } = useAuth();

  async function logOut() {
    // BACKEND: ends the session on this computer.
    await api.logOut();
    navigate("/login");
    setUser(null);
  }

  return (
    <section>
      <h2 className={styles.heading}>Account</h2>
      <div className={styles.actions}>
        <span className={styles.status}>Logged in as {user?.email}</span>
        <button type="button" className={styles.buttonQuiet} onClick={() => void logOut()}>
          Log out
        </button>
      </div>
    </section>
  );
}
