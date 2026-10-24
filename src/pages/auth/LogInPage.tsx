import { useState } from "react";
import { api } from "../api/client";
import page from "../components/page.module.css";
import { href } from "../lib/router";
import { AuthLayout, FormError, useAuthSubmit } from "./AuthLayout";
import styles from "./auth.module.css";

export function LogInPage() {
  // AUTH: what the user types in the Email box. Sent to the backend's logIn below.
  const [email, setEmail] = useState("");
  // PASSWORD: held only while this form is open. Handed to the backend once on submit, never stored by the UI.
  const [password, setPassword] = useState("");
  // BACKEND: checks the email and password. Returns the user, or why it failed.
  // submit: runs when the form is sent. error: message to show. pending: true while waiting (auth/AuthLayout.tsx).
  const { submit, error, pending } = useAuthSubmit(() => api.logIn({ email, password }), "/");

  return (
    <AuthLayout
      title="Log in"
      footer={
        <>
          New here? <a href={href("/signup")}>Create an account</a>
        </>
      }
    >
      <form className={styles.form} onSubmit={submit}>
        <div className={page.field}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            className={page.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className={page.field}>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            className={page.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <FormError message={error} />
        <button type="submit" className={`${page.button} ${styles.submit}`} disabled={pending}>
          {pending ? "Logging in…" : "Log in"}
        </button>
      </form>
    </AuthLayout>
  );
}
