"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui";
import { RoleGate } from "@/components/auth/role-gate";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  permission?: string;
}

const ITEMS: NavItem[] = [
  { href: "/dashboard/settings", label: "General", icon: "Settings" },
  { href: "/dashboard/settings/calendar", label: "Calendar", icon: "Calendar" },
  { href: "/dashboard/settings/messaging", label: "Messaging", icon: "MessageSquare" },
  { href: "/dashboard/settings/pipeline", label: "Pipeline stages", icon: "Kanban" },
  { href: "/dashboard/settings/facets", label: "Facets", icon: "Tags" },
  { href: "/dashboard/settings/roles", label: "Roles", icon: "Shield", permission: "settings:manage" },
  { href: "/dashboard/settings/team", label: "Team", icon: "Users", permission: "team" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-px">
      {ITEMS.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/dashboard/settings" && pathname?.startsWith(item.href));
        const link = (
          <Link
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-[11px] rounded-sm px-3 py-2 text-body-s font-medium transition-colors duration-fast",
              active
                ? "bg-surface-floating shadow-elev-1 text-ink"
                : "text-ink hover:bg-accent-soft",
            )}
          >
            <Icon name={item.icon} size={16} color={active ? "var(--accent)" : "var(--ink-2)"} />
            {item.label}
          </Link>
        );

        if (item.permission) {
          return (
            <RoleGate key={item.href} requiredAction={item.permission} fallback={null}>
              {link}
            </RoleGate>
          );
        }
        return <div key={item.href}>{link}</div>;
      })}
    </nav>
  );
}
