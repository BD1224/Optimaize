import Link from "next/link";
import { TopBar } from "@/components/shell/TopBar";
import styles from "@/components/ui/page.module.css";

export default function WelcomePage() {
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
            <li>Choose whether Optimize starts on. Translating can lose meaning, so this is your call.</li>
            <li>Add your API key.</li>
          </ol>
          <p>
            <Link href="/settings">Set these up in Settings</Link>
          </p>
          <p className={styles.note}>A guided first-visit flow replaces this page in a later milestone.</p>
        </div>
      </div>
    </>
  );
}
