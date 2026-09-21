import type { SVGProps } from "react";
import { Link, Outlet } from "react-router-dom";
import {
  PageHeaderProvider,
  useCurrentPageHeader,
} from "../context/PageHeaderContext";
import { AppNav } from "./AppNav";
import { SessionIdleGuard } from "./SessionIdleGuard";

function IconBack(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      aria-hidden="true"
      {...props}
    >
      <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AppHeader() {
  const { title, backTo, backLabel } = useCurrentPageHeader();
  const back = backLabel ?? "Back";

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2.5 sm:gap-3">
        {backTo ? (
          <Link
            to={backTo}
            aria-label={back}
            title={back}
            className="-ml-1.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-paper hover:text-ink"
          >
            <IconBack className="size-5" />
          </Link>
        ) : null}
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight text-ink">
          {title}
        </h1>
        <div className="hidden shrink-0 md:block">
          <AppNav variant="desktop" />
        </div>
      </div>
    </header>
  );
}

export function Layout() {
  return (
    <PageHeaderProvider>
      <div className="flex h-dvh flex-col overflow-hidden bg-paper">
        <SessionIdleGuard />
        <AppHeader />

        <main className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col overflow-auto px-4 py-6 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-8">
          <Outlet />
        </main>

        <AppNav variant="mobile" />
      </div>
    </PageHeaderProvider>
  );
}
