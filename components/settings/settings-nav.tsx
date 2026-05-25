"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RoleGate } from "@/components/auth/role-gate";

const SETTINGS_TABS = [
  { key: "general", label: "General", href: "/dashboard/settings" },
  { key: "roles", label: "Roles & Permissions", href: "/dashboard/settings/roles", permission: "settings:manage" },
  { key: "team", label: "Team", href: "/dashboard/settings/team", permission: "team" },
  { key: "pipeline", label: "Pipeline", href: "/dashboard/settings/pipeline" },
  { key: "messaging", label: "Messaging", href: "/dashboard/settings/messaging" },
  { key: "calendar", label: "Calendar", href: "/dashboard/settings/calendar" },
] as const;

export function SettingsNav() {
  const pathname = usePathname();

  // Determine active tab: exact match for /dashboard/settings (general),
  // otherwise check if the pathname starts with the tab's href
  const activeTab = pathname === "/dashboard/settings" ? "general" : pathname?.split("/").pop();

  return (
    <nav className="w-48 shrink-0 border-r border-surface-tertiary py-6 px-3">
      <p className="px-3 mb-1 text-xs font-medium uppercase tracking-wider text-ink-tertiary">
        Settings
      </p>
      <div className="space-y-0.5 mt-2">
        {SETTINGS_TABS.map((tab) => {
          const isActive = tab.key === activeTab;

          const link = (
            <Link
              href={tab.href}
              className={`block px-3 py-2 rounded-apple text-sm transition-colors ${
                isActive
                  ? "bg-surface-secondary text-accent font-medium"
                  : "text-ink hover:bg-surface-secondary"
              }`}
            >
              {tab.label}
            </Link>
          );

          if ("permission" in tab && tab.permission) {
            return (
              <RoleGate key={tab.key} requiredAction={tab.permission} fallback={null}>
                {link}
              </RoleGate>
            );
          }

          return <div key={tab.key}>{link}</div>;
        })}
      </div>
    </nav>
  );
}
