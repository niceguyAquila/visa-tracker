import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  ACTIVITY_STORAGE_KEY,
  IDLE_MS,
  WARNING_MS,
  markIdleSignOut,
  writeStoredActivity,
} from "../lib/session";

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart"] as const;

export function SessionIdleGuard() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [warning, setWarning] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const signingOutRef = useRef(false);

  const bump = useCallback(() => {
    if (signingOutRef.current) return;
    const now = Date.now();
    lastActivityRef.current = now;
    writeStoredActivity(now);
    setWarning(false);
  }, []);

  useEffect(() => {
    bump();

    const onActivity = () => bump();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible") bump();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onStorage = (event: StorageEvent) => {
      if (event.key !== ACTIVITY_STORAGE_KEY || !event.newValue) return;
      const ts = Number(event.newValue);
      if (!Number.isFinite(ts)) return;
      lastActivityRef.current = ts;
      setWarning(false);
    };
    window.addEventListener("storage", onStorage);

    const id = window.setInterval(() => {
      if (signingOutRef.current) return;
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= IDLE_MS) {
        signingOutRef.current = true;
        markIdleSignOut();
        void (async () => {
          const { error } = await signOut();
          if (error) {
            signingOutRef.current = false;
            return;
          }
          navigate("/login?reason=idle", { replace: true });
        })();
        return;
      }
      setWarning(elapsed >= IDLE_MS - WARNING_MS);
    }, 1000);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity);
      }
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(id);
    };
  }, [bump, navigate, signOut]);

  if (!warning) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/40 p-4"
      role="alertdialog"
      aria-labelledby="idle-title"
      aria-describedby="idle-desc"
    >
      <div className="panel w-full max-w-md p-6 shadow-lg">
        <h2 id="idle-title" className="page-title text-xl">
          Still there?
        </h2>
        <p id="idle-desc" className="page-sub mt-2 text-pretty">
          You will be signed out in 2 minutes due to inactivity.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={bump}>
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  );
}
