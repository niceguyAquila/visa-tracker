import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { PortSettings } from "../components/settings/PortSettings";
import { CompanySettings } from "./CompaniesPage";

type SettingsSection = "companies" | "ports";

function sectionFromHash(hash: string): SettingsSection {
  return hash === "#ports" ? "ports" : "companies";
}

export function SettingsPage() {
  const location = useLocation();
  const [section, setSection] = useState<SettingsSection>(() =>
    sectionFromHash(location.hash)
  );

  useEffect(() => {
    setSection(sectionFromHash(location.hash));
  }, [location.hash]);

  function show(next: SettingsSection) {
    setSection(next);
    const hash = next === "ports" ? "#ports" : "#companies";
    if (window.location.hash !== hash) {
      window.history.replaceState(null, "", `${location.pathname}${hash}`);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">
          Companies and entry ports used on customer and visa forms.
        </p>
      </div>

      <div
        className="flex gap-1 rounded-lg border border-line bg-paper p-1"
        role="tablist"
        aria-label="Settings sections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={section === "companies"}
          onClick={() => show("companies")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
            section === "companies"
              ? "bg-surface text-ink shadow-sm"
              : "text-muted hover:text-ink"
          }`}
        >
          Companies
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={section === "ports"}
          onClick={() => show("ports")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
            section === "ports"
              ? "bg-surface text-ink shadow-sm"
              : "text-muted hover:text-ink"
          }`}
        >
          Ports
        </button>
      </div>

      {section === "companies" ? <CompanySettings /> : <PortSettings />}
    </div>
  );
}
