const STORAGE_KEY = "debug";

/**
 * Debug mode for on-device troubleshooting (e.g. iPad, where there is no
 * console without a Mac). Turn on by opening any page with `?debug` or
 * `?debug=1`; it stays on for the tab session while navigating. `?debug=0`
 * turns it off.
 */
export function isDebugMode(): boolean {
  try {
    const param = new URLSearchParams(window.location.search).get("debug");
    if (param !== null) {
      if (param === "0" || param === "false") {
        sessionStorage.removeItem(STORAGE_KEY);
        return false;
      }
      sessionStorage.setItem(STORAGE_KEY, "1");
      return true;
    }
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function describeError(err: unknown): string {
  if (err instanceof Error) {
    return err.name && err.name !== "Error"
      ? `${err.name}: ${err.message}`
      : err.message;
  }
  return String(err);
}
