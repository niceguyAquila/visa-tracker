export const IDLE_MS = 60 * 60 * 1000;
export const WARNING_MS = 2 * 60 * 1000;
export const ACTIVITY_STORAGE_KEY = "ma.session.lastActivity";
export const RECOVERY_STORAGE_KEY = "ma.session.recovery";
export const IDLE_REASON_KEY = "ma.session.idle";

const AUTH_PATHS = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
]);

type LocationLike = {
  pathname?: unknown;
  search?: unknown;
};

export function safeRedirectPath(from: unknown): string {
  if (!from || typeof from !== "object") return "/";
  const loc = from as LocationLike;
  const pathname = loc.pathname;
  if (typeof pathname !== "string" || !pathname.startsWith("/")) return "/";
  if (pathname.startsWith("//")) return "/";
  if (AUTH_PATHS.has(pathname)) return "/";
  const search = typeof loc.search === "string" ? loc.search : "";
  return `${pathname}${search}`;
}

export function readStoredActivity(): number | null {
  try {
    const raw = localStorage.getItem(ACTIVITY_STORAGE_KEY);
    if (!raw) return null;
    const ts = Number(raw);
    return Number.isFinite(ts) ? ts : null;
  } catch {
    return null;
  }
}

export function writeStoredActivity(ts: number): void {
  try {
    localStorage.setItem(ACTIVITY_STORAGE_KEY, String(ts));
  } catch {
    /* private mode / storage blocked */
  }
}

export function clearStoredActivity(): void {
  try {
    localStorage.removeItem(ACTIVITY_STORAGE_KEY);
  } catch {
    /* private mode / storage blocked */
  }
}

export function readRecoveryFlag(): boolean {
  try {
    return sessionStorage.getItem(RECOVERY_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeRecoveryFlag(on: boolean): void {
  try {
    if (on) sessionStorage.setItem(RECOVERY_STORAGE_KEY, "1");
    else sessionStorage.removeItem(RECOVERY_STORAGE_KEY);
  } catch {
    /* private mode / storage blocked */
  }
}

export function markIdleSignOut(): void {
  try {
    sessionStorage.setItem(IDLE_REASON_KEY, "1");
  } catch {
    /* private mode / storage blocked */
  }
}

export function consumeIdleSignOut(): boolean {
  try {
    const flagged = sessionStorage.getItem(IDLE_REASON_KEY) === "1";
    sessionStorage.removeItem(IDLE_REASON_KEY);
    return flagged;
  } catch {
    return false;
  }
}

export function urlLooksLikeRecovery(): boolean {
  if (typeof window === "undefined") return false;
  if (window.location.pathname !== "/reset-password") return false;
  const hash = window.location.hash;
  const search = window.location.search;
  return (
    hash.includes("type=recovery") ||
    hash.includes("access_token") ||
    search.includes("code=")
  );
}
