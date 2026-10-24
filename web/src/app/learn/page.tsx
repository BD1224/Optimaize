import { TopBar } from "@/components/shell/TopBar";
import styles from "@/components/ui/page.module.css";

const SAMPLES = [
  { lang: "en", language: "English", text: "Why is the sky blue?" },
  { lang: "es", language: "Español", text: "¿Por qué el cielo es azul?" },
  { lang: "hi", language: "हिन्दी", text: "आसमान नीला क्यों है?" },
  { lang: "ml", language: "മലയാളം", text: "ആകാശം നീലയായിരിക്കുന്നത് എന്തുകൊണ്ട്?" },
];

export default function LearnPage() {
  return (
    <>
      <TopBar />
      <div className={styles.page}>
        <div className={styles.content}>
          <div>
            <h1 className={styles.title}>Why your language costs more</h1>
            <p className={styles.lede}>
              AI models read text in small pieces called tokens, and you pay per token. Tokenizers were built mostly on
              English, so the same question in another language gets split into more pieces. Same meaning, bigger bill.
            </p>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Language</th>
                  <th>Same question</th>
                  <th className={styles.num}>Tokens</th>
                </tr>
              </thead>
              <tbody>
                {SAMPLES.map((s) => (
                  <tr key={s.lang}>
                    <td lang={s.lang}>{s.language}</td>
                    <td lang={s.lang}>{s.text}</td>
                    <td className={styles.num}>–</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.note}>
            Token counts and highlighted token boundaries arrive once the backend&apos;s tokenize call is ready.
          </p>
        </div>
      </div>
    </>
  );
}
