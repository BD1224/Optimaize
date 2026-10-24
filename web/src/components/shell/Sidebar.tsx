"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { SavingsMeter } from "./SavingsMeter";
import { SidebarNav } from "./SidebarNav";
import styles from "./shell.module.css";

export function Sidebar() {
  const router = useRouter();
  const { profile } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");

  // Cmd+/ (Ctrl+/ on Windows) starts a new chat.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "/") {
        event.preventDefault();
        router.push("/");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return (
    <aside className={styles.sidebar} data-collapsed={collapsed}>
      <div className={styles.brandRow}>
        {!collapsed && (
          <Link href="/" className={styles.brand}>
            Optimaize
          </Link>
        )}
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>

      {!collapsed && (
        <>
          <Link href="/" className={styles.newChat}>
            <span>+ New chat</span>
            <kbd className={styles.kbd}>⌘/</kbd>
          </Link>
          <input
            type="search"
            className={styles.search}
            placeholder="Search chats"
            aria-label="Search chats"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {/* The current path is unknown while /c/[id] prerenders, so highlight active links only once it resolves. */}
          <Suspense fallback={<SidebarNav pathname={null} query={query} />}>
            <SidebarNavAtPath query={query} />
          </Suspense>

          <SavingsMeter />

          <Link href="/settings" className={styles.profile}>
            <span className={styles.avatar} aria-hidden>
              {profile?.name.charAt(0)}
            </span>
            <span className={styles.profileText}>
              <span>{profile?.name}</span>
              <span className={styles.profilePlan}>{profile?.plan}</span>
            </span>
            <span className={styles.gear} aria-label="Settings">
              ⚙
            </span>
          </Link>
        </>
      )}
    </aside>
  );
}

function SidebarNavAtPath({ query }: { query: string }) {
  const pathname = usePathname();
  return <SidebarNav pathname={pathname} query={query} />;
}
