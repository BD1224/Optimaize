"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { SavingsBadge } from "@/components/ui/SavingsBadge";
import { api } from "@/lib/api/client";
import type { ChatSummary } from "@/lib/api/types";
import { useApp } from "@/lib/store";
import styles from "./shell.module.css";

const DAY = 24 * 60 * 60 * 1000;

interface SidebarNavProps {
  /** Current path, or null while it isn't known yet. */
  pathname: string | null;
  query: string;
}

export function SidebarNav({ pathname, query }: SidebarNavProps) {
  const { chats, loadedAt } = useApp();
  const q = query.trim().toLowerCase();
  const visible = q ? chats.filter((c) => c.title.toLowerCase().includes(q)) : chats;
  const pinned = visible.filter((c) => c.pinned);
  const recents = visible.filter((c) => !c.pinned);
  const isActive = (chat: ChatSummary) => pathname === `/c/${chat.id}`;

  return (
    <nav className={styles.scroll} aria-label="Chats">
      <NavLink href="/savings" pathname={pathname}>
        Savings
      </NavLink>
      <NavLink href="/learn" pathname={pathname}>
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
  );
}

function NavLink({ href, pathname, children }: { href: string; pathname: string | null; children: ReactNode }) {
  return (
    <Link href={href} className={styles.navItem} aria-current={pathname === href ? "page" : undefined}>
      {children}
    </Link>
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
  const router = useRouter();
  const { refresh } = useApp();

  async function togglePin() {
    await api.updateChat(chat.id, { pinned: !chat.pinned });
    await refresh();
  }

  async function rename() {
    const title = window.prompt("Rename chat", chat.title)?.trim();
    if (!title) return;
    await api.updateChat(chat.id, { title });
    await refresh();
  }

  async function remove() {
    if (!window.confirm(`Delete "${chat.title}"?`)) return;
    await api.deleteChat(chat.id);
    if (active) router.push("/");
    await refresh();
  }

  return (
    <div className={styles.chatItem} data-active={active}>
      <Link href={`/c/${chat.id}`} className={styles.chatLink} aria-current={active ? "page" : undefined}>
        <span className={styles.chatTitle}>{chat.title}</span>
        <SavingsBadge fraction={chat.savedFraction} />
      </Link>
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
