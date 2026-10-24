import { useState, type FormEvent, type ReactNode } from "react";
import { api } from "../api/client";
import { MIN_PASSWORD_LENGTH, type AuthError, type AuthResult } from "../api/types";
import { useAuth } from "../lib/auth";
import { navigate } from "../lib/router";
import styles from "./auth.module.css";

// AUTH: the message shown for each error code the backend can send back (AuthError in api/types.ts).
const ERRORS: Record<AuthError, string> = {
  invalid_email: "That doesn't look like an email address.",
  weak_password: `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`,
  email_taken: "An account with this email already exists. Log in instead.",
  wrong_credentials: "Email or password is incorrect.",
};

/** The centered card both auth screens sit in. */
// title: the heading ("Log in" or "Create your account"). footer: the link under the form. children: the form.
export function AuthLayout({ title, footer, children }: { title: string; footer: ReactNode; children: ReactNode }) {
  return (
    <main className={styles.screen}>
      <div className={styles.card}>
        <p className={styles.brand}>Optimaize</p>
        <h1 className={styles.title}>{title}</h1>
        {!api.authConnected && (
          <p className={styles.notice}>
            Log in isn&apos;t connected yet. Use any email (like test@test.com) and any password of {MIN_PASSWORD_LENGTH}+
            characters.
          </p>
        )}
        {children}
        <p className={styles.footer}>{footer}</p>
      </div>
    </main>
  );
}

// message: the `error` text from useAuthSubmit below. Nothing shows when it's empty.
export function FormError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p className={styles.error} role="alert">
      <span aria-hidden>⚠</span> {message}
    </p>
  );
}

/** Submits an auth form, shows why it failed, and opens `nextPath` once the backend says yes. */
// request: the backend call to make (api.logIn or api.signUp), given by LogInPage.tsx or SignUpPage.tsx.
// nextPath: the page to open after it works ("/" after log in, "/onboarding" after sign up).
export function useAuthSubmit(request: () => Promise<AuthResult>, nextPath: string) {
  // AUTH: saves the logged-in user for the whole app (lib/auth.tsx).
  const { setUser } = useAuth();
  // AUTH: the error message shown above the button. Empty means no error.
  const [error, setError] = useState("");
  // AUTH: true while waiting for the backend. Disables the button so it can't be sent twice.
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      // AUTH: the backend's answer: { ok: true, user } or { ok: false, error } (AuthResult in api/types.ts).
      const result = await request();
      if (result.ok) {
        navigate(nextPath);
        setUser(result.user);
      } else {
        setError(ERRORS[result.error]);
      }
    } catch {
      setError("Couldn't reach the app's backend. Try again.");
    } finally {
      setPending(false);
    }
  }

  return { submit, error, pending };
}
