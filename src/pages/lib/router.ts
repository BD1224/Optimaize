import { useSyncExternalStore } from "react";

// Hash-based routes (#/c/123) work the same in the dev server and in a packaged app loaded from file://.

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function currentPath() {
  return window.location.hash.slice(1) || "/";
}

export function usePath() {
  return useSyncExternalStore(subscribe, currentPath);
}

export function navigate(path: string) {
  window.location.hash = path;
}

/** Value for an `<a href>` that opens `path`. */
export function href(path: string) {
  return `#${path}`;
}
