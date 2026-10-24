"use client";

import { useEffect, useState, type FormEvent } from "react";
import { TopBar } from "@/components/shell/TopBar";
import { api } from "@/lib/api/client";
import type { LanguageCode, Profile } from "@/lib/api/types";
import { LANGUAGES } from "@/lib/languages";
import { useApp } from "@/lib/store";
import styles from "@/components/ui/page.module.css";

export function SettingsScreen() {
  const { profile } = useApp();

  return (
    <>
      <TopBar />
      <div className={styles.page}>
        <div className={styles.content}>
          <h1 className={styles.title}>Settings</h1>
          {profile && <ProfileForm initial={profile} />}
          <ApiKeyForm />
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
        <legend>Optimizing</legend>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={draft.optimizeByDefault}
            onChange={(e) => setDraft({ ...draft, optimizeByDefault: e.target.checked })}
          />
          Optimize new messages by default (you can still turn it off per message)
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
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState<boolean | null>(null);

  useEffect(() => {
    api.hasApiKey().then(setSaved);
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    await api.saveApiKey(key);
    setKey("");
    setSaved(true);
  }

  return (
    <form className={styles.form} onSubmit={save}>
      <div className={styles.field}>
        <label htmlFor="api-key">API key</label>
        <input
          id="api-key"
          type="password"
          autoComplete="off"
          className={styles.input}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={saved ? "A key is saved. Paste a new one to replace it." : "Paste your key"}
        />
        <p className={styles.note}>The key goes straight to the backend. This page never stores it.</p>
      </div>
      <div className={styles.actions}>
        <button type="submit" className={styles.button} disabled={!key.trim()}>
          Save key
        </button>
      </div>
    </form>
  );
}
