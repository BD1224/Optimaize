import { useEffect, useState, type ReactNode } from "react";
import { api } from "../api/client";
import type { ChatSummary } from "../api/types";
import { href, navigate, usePath } from "../lib/router";
import { useApp } from "../lib/store";
import { SavingsBadge } from "./SavingsBadge";
import { SavingsMeter } from "./SavingsMeter";
import styles from "./shell.module.css";

const DAY = 24 * 60 * 60 * 1000;

export function Sidebar() {
  const { profile, chats, loadedAt } = useApp();
  const path = usePath();
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");

  // Cmd+/ (Ctrl+/ on Windows) starts a new chat.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "/") {
        event.preventDefault();
        navigate("/");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const q = query.trim().toLowerCase();
  const visible = q ? chats.filter((c) => c.title.toLowerCase().includes(q)) : chats;
  const pinned = visible.filter((c) => c.pinned);
  const recents = visible.filter((c) => !c.pinned);
  const isActive = (chat: ChatSummary) => path === `/c/${chat.id}`;

  return (
    <aside className={styles.sidebar} data-collapsed={collapsed}>
      <div className={styles.brandRow}>
        {!collapsed && (
          <a href={href("/")} className={styles.brand}>
            Optimaize
          </a>
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
          <a href={href("/")} className={styles.newChat}>
            <span>+ New chat</span>
            <kbd className={styles.kbd}>⌘/</kbd>
          </a>
          <input
            type="search"
            className={styles.search}
            placeholder="Search chats"
            aria-label="Search chats"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <nav className={styles.scroll} aria-label="Chats">
            <NavLink to="/dashboard" path={path}>
              Dashboard
            </NavLink>
            <NavLink to="/lessons" path={path}>
              Learn tokens
            </NavLink>

            {pinned.length > 0 && (
              <Section title="Pinned">
                {pinned.map((chat) => (
                  <ChatListItem key={chat.id} chat={chat} active={isActive(chat)} />
                ))}
              </Section>
            )}

            <Section title="Recents">
              {groupByDate(recents, loadedAt).map((group) => (
                <div key={group.label}>
                  <div className={styles.groupLabel}>{group.label}</div>
                  {group.chats.map((chat) => (
                    <ChatListItem key={chat.id} chat={chat} active={isActive(chat)} />
                  ))}
                </div>
              ))}
              {loadedAt > 0 && recents.length === 0 && (
                <p className={styles.empty}>{q ? "No matching chats" : "No chats yet"}</p>
              )}
            </Section>
          </nav>

          <SavingsMeter />

          <a href={href("/settings")} className={styles.profile}>
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
          </a>
        </>
      )}
    </aside>
  );
}

function NavLink({ to, path, children }: { to: string; path: string; children: ReactNode }) {
  return (
    <a href={href(to)} className={styles.navItem} aria-current={path === to ? "page" : undefined}>
      {children}
    </a>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section>
      <button type="button" className={styles.sectionHeader} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {title} <span aria-hidden>{open ? "▾" : "▸"}</span>
      </button>
      {open && children}
    </section>
  );
}

function ChatListItem({ chat, active }: { chat: ChatSummary; active: boolean }) {
  const { refresh } = useApp();

  async function togglePin() {
    // BACKEND: pin or unpin a chat.
    await api.updateChat(chat.id, { pinned: !chat.pinned });
    await refresh();
  }

  async function rename() {
    const title = window.prompt("Rename chat", chat.title)?.trim();
    if (!title) return;
    // BACKEND: rename a chat.
    await api.updateChat(chat.id, { title });
    await refresh();
  }

  async function remove() {
    if (!window.confirm(`Delete "${chat.title}"?`)) return;
    // BACKEND: delete a chat.
    await api.deleteChat(chat.id);
    if (active) navigate("/");
    await refresh();
  }

  return (
    <div className={styles.chatItem} data-active={active}>
      <a href={href(`/c/${chat.id}`)} className={styles.chatLink} aria-current={active ? "page" : undefined}>
        <span className={styles.chatTitle}>{chat.title}</span>
        <SavingsBadge fraction={chat.savedFraction} />
      </a>
      <div className={styles.chatActions}>
        <button type="button" className={styles.miniButton} onClick={togglePin}>
          {chat.pinned ? "Unpin" : "Pin"}
        </button>
        <button type="button" className={styles.miniButton} onClick={rename}>
          Rename
        </button>
        <button type="button" className={styles.miniButton} onClick={remove}>
          Delete
        </button>
      </div>
    </div>
  );
}

function groupByDate(chats: ChatSummary[], now: number) {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const today = midnight.getTime();
  const groups = [
    { label: "Today", from: today },
    { label: "Yesterday", from: today - DAY },
    { label: "Last 7 days", from: today - 7 * DAY },
    { label: "Older", from: -Infinity },
  ].map((g) => ({ ...g, chats: [] as ChatSummary[] }));

  for (const chat of chats) {
    groups.find((g) => chat.updatedAt >= g.from)?.chats.push(chat);
  }
  return groups.filter((g) => g.chats.length > 0);
}
