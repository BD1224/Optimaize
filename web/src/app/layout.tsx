import type { Metadata } from "next";
import { Sidebar } from "@/components/shell/Sidebar";
import styles from "@/components/shell/shell.module.css";
import { AppProvider } from "@/lib/store";
import "./globals.css";

export const metadata: Metadata = {
  title: "Optimaize",
  description: "Chat with Claude in your own language, and pay less for it.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <AppProvider>
          <div className={styles.shell}>
            <Sidebar />
            <main className={styles.main}>{children}</main>
          </div>
        </AppProvider>
      </body>
    </html>
  );
}
