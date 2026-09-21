import { customerStatusBadgeClass } from "../lib/ui";
import { DEFAULT_CUSTOMER_STATUS } from "../lib/customer";
import type { CustomerStatus } from "../types";

export function CustomerStatusBadge({
  status,
  always = false,
}: {
  status?: CustomerStatus | null;
  always?: boolean;
}) {
  const value = status ?? DEFAULT_CUSTOMER_STATUS;
  if (!always && value !== "Currently Not Working") return null;
  return (
    <span
      className={`inline-flex rounded-md px-1.5 py-0.5 text-xs font-medium ${customerStatusBadgeClass(value)}`}
    >
      {value}
    </span>
  );
}
