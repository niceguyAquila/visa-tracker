import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { CustomerWithCompany } from "../../types";
import {
  FieldError,
  FieldLabel,
  inputClass,
  inputErrorClass,
  readOnlyClass,
} from "./formStyles";

type PersonPickerProps = {
  customers: CustomerWithCompany[];
  customerId: string;
  onCustomerIdChange: (id: string) => void;
  disabled?: boolean;
  emptyHintHref?: string;
  error?: string;
};

export function PersonPicker({
  customers,
  customerId,
  onCustomerIdChange,
  disabled = false,
  emptyHintHref = "/customers/new",
  error,
}: PersonPickerProps) {
  const selected = customers.find((c) => c.id === customerId) ?? null;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected) {
      setQuery(
        `${selected.full_name}${selected.companies?.name ? ` · ${selected.companies.name}` : ""}`
      );
    } else if (!customerId) {
      setQuery("");
    }
  }, [selected, customerId]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || (selected && query.startsWith(selected.full_name))) {
      // When showing selected label, still allow browsing all on open with empty filter intent
      if (selected && query.includes(selected.full_name) && open) {
        const typed = query.toLowerCase();
        const selectedLabel =
          `${selected.full_name}${selected.companies?.name ? ` · ${selected.companies.name}` : ""}`.toLowerCase();
        if (typed === selectedLabel) return customers;
      }
    }
    if (!q) return customers;
    return customers.filter((c) => {
      const hay = `${c.full_name} ${c.passport_number} ${c.companies?.name ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [customers, query, selected, open]);

  function pick(c: CustomerWithCompany) {
    onCustomerIdChange(c.id);
    setQuery(
      `${c.full_name}${c.companies?.name ? ` · ${c.companies.name}` : ""}`
    );
    setOpen(false);
  }

  function clear() {
    onCustomerIdChange("");
    setQuery("");
    setOpen(true);
  }

  return (
    <div className="space-y-4">
      <div ref={rootRef} className="relative block">
        <FieldLabel required={!disabled}>Customer</FieldLabel>
        {customers.length === 0 ? (
          <p className="mt-1 text-sm text-muted">
            No customers yet.{" "}
            <Link
              to={emptyHintHref}
              className="link-brand"
            >
              Create a customer
            </Link>{" "}
            first.
          </p>
        ) : disabled && selected ? (
          <p className={readOnlyClass}>
            {selected.full_name}
            {selected.companies?.name ? ` · ${selected.companies.name}` : ""}
          </p>
        ) : (
          <>
            <div className="relative mt-1">
              <input
                type="search"
                role="combobox"
                aria-expanded={open}
                aria-autocomplete="list"
                aria-controls="customer-combobox-list"
                aria-invalid={Boolean(error)}
                disabled={disabled}
                value={query}
                placeholder="Search by name or passport…"
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                  if (customerId) onCustomerIdChange("");
                }}
                onFocus={() => setOpen(true)}
                className={error ? inputErrorClass : inputClass}
                autoComplete="off"
              />
              {customerId ? (
                <button
                  type="button"
                  onClick={clear}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded px-2 py-1 text-xs font-medium text-muted hover:bg-paper hover:text-ink"
                >
                  Clear
                </button>
              ) : null}
            </div>
            {open && !disabled ? (
              <ul
                id="customer-combobox-list"
                role="listbox"
                className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-line bg-surface py-1 shadow-lg"
              >
                {filtered.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-muted">
                    No matches
                  </li>
                ) : (
                  filtered.map((c) => (
                    <li key={c.id} role="option" aria-selected={c.id === customerId}>
                      <button
                        type="button"
                        className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-paper ${
                          c.id === customerId ? "bg-brand-soft" : ""
                        }`}
                        onClick={() => pick(c)}
                      >
                        <span className="font-medium text-ink">
                          {c.full_name}
                        </span>
                        <span className="text-xs text-muted">
                          {c.passport_number}
                          {c.companies?.name ? ` · ${c.companies.name}` : ""}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </>
        )}
        <FieldError message={error} />
      </div>

      {selected && !disabled ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <span className="meta">
              Name
            </span>
            <p className={readOnlyClass}>{selected.full_name}</p>
          </div>
          <div>
            <span className="meta">
              Passport
            </span>
            <p className={readOnlyClass}>{selected.passport_number}</p>
          </div>
          <div>
            <span className="meta">
              Company
            </span>
            <p className={readOnlyClass}>{selected.companies?.name ?? "—"}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
