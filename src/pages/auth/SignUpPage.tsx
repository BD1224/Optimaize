import { useState } from "react";
import { api } from "../api/client";
import { MIN_PASSWORD_LENGTH } from "../api/types";
import page from "../components/page.module.css";
import { href } from "../lib/router";
import { AuthLayout, FormError, useAuthSubmit } from "./AuthLayout";
import styles from "./auth.module.css";

export function SignUpPage() {
  // AUTH: what the user types in the Name box. The backend saves it as the profile name (used in the greeting).
  const [name, setName] = useState("");
  // AUTH: what the user types in the Email box. Sent to the backend's signUp below.
  const [email, setEmail] = useState("");
  // PASSWORD: held only while this form is open. Handed to the backend once on submit, never stored by the UI.
  const [password, setPassword] = useState("");
  // BACKEND: creates the account and logs the user in. Returns the user, or why it failed. New users go to onboarding.
  // submit: runs when the form is sent. error: message to show. pending: true while waiting (auth/AuthLayout.tsx).
  const { submit, error, pending } = useAuthSubmit(() => api.signUp({ name, email, password }), "/onboarding");

  return (
    <AuthLayout
      title="Create your account"
      footer={
        <>
          Already have an account? <a href={href("/login")}>Log in</a>
        </>
      }
    >
      <form className={styles.form} onSubmit={submit}>
        <div className={page.field}>
          <label htmlFor="name">Name</label>
          <input
            id="name"
            autoComplete="name"
            required
            className={page.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
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
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            aria-describedby="password-hint"
            className={page.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p id="password-hint" className={styles.hint}>
            At least {MIN_PASSWORD_LENGTH} characters
          </p>
        </div>
        <FormError message={error} />
        <button type="submit" className={`${page.button} ${styles.submit}`} disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}
