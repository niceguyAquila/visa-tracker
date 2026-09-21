import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { usePageHeader } from "../context/PageHeaderContext";
import { AccountSettings } from "../components/settings/AccountSettings";
import { PortSettings } from "../components/settings/PortSettings";
import { CompanySettings } from "./CompaniesPage";

type SettingsSection = "companies" | "ports" | "account";

function sectionFromHash(hash: string): SettingsSection {
  if (hash === "#ports") return "ports";
  if (hash === "#account") return "account";
  return "companies";
}

function hashForSection(section: SettingsSection): string {
  if (section === "ports") return "#ports";
  if (section === "account") return "#account";
  return "#companies";
}

const SECTION_TABS: { id: SettingsSection; label: string }[] = [
  { id: "companies", label: "Companies" },
  { id: "ports", label: "Ports" },
  { id: "account", label: "Account" },
];

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
    const hash = hashForSection(next);
    if (window.location.hash !== hash) {
      window.history.replaceState(null, "", `${location.pathname}${hash}`);
    }
  }

  usePageHeader({ title: "Settings" });

  return (
    <div className="space-y-6">
      <div
        className="flex gap-1 rounded-lg border border-line bg-paper p-1"
        role="tablist"
        aria-label="Settings sections"
      >
        {SECTION_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={section === tab.id}
            onClick={() => show(tab.id)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
              section === tab.id
                ? "bg-surface text-ink shadow-sm"
                : "text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {section === "companies" ? (
        <CompanySettings />
      ) : section === "ports" ? (
        <PortSettings />
      ) : (
        <AccountSettings />
      )}
    </div>
  );
}
