import { TopBar } from "../components/TopBar";
import styles from "../components/page.module.css";
import { href } from "../lib/router";

export function OnboardingPage() {
  return (
    <>
      <TopBar />
      <div className={styles.page}>
        <div className={styles.content}>
          <div>
            <h1 className={styles.title}>Welcome to Optimaize</h1>
            <p className={styles.lede}>
              Write in your own language. Optimaize turns your message into the cheapest clear prompt for Claude and
              shows you what you saved.
            </p>
          </div>
          <ol className={styles.steps}>
            <li>Pick the languages you write in.</li>
            <li>
              Choose whether to translate your messages through English. It stays off unless you turn it on, because
              translating can change meaning.
            </li>
            <li>Add your Anthropic API key.</li>
          </ol>
          <p>
            <a href={href("/settings")}>Set these up in Settings</a>
          </p>
          <p className={styles.note}>A guided first-run flow replaces this page in a later milestone.</p>
        </div>
      </div>
    </>
  );
}
