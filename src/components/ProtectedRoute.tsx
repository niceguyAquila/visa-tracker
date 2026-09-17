import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { safeRedirectPath } from "../lib/session";

export function AuthLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper text-muted">
      Loading…
    </div>
  );
}

export function ProtectedRoute() {
  const { session, loading, isRecovery } = useAuth();
  const location = useLocation();

  if (loading) return <AuthLoading />;
  if (isRecovery) return <Navigate to="/reset-password" replace />;
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export function GuestRoute() {
  const { session, loading, isRecovery } = useAuth();
  const location = useLocation();

  if (loading) return <AuthLoading />;
  if (isRecovery) return <Navigate to="/reset-password" replace />;
  if (session) {
    const from = (location.state as { from?: unknown } | null)?.from;
    return <Navigate to={safeRedirectPath(from)} replace />;
  }

  return <Outlet />;
}
