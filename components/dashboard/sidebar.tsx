"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RoleGate } from "@/components/auth/role-gate";
import { Avatar } from "@/components/ui/avatar";
import { BrandMark } from "@/components/ui/brand-mark";
import { Icon, type IconName } from "@/components/ui/icon";
import { Dropdown, DropdownDivider, DropdownItem, DropdownLabel } from "@/components/ui/dropdown";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

interface NavLinkItem {
  href: string;
  label: string;
  icon: IconName;
}

const PRIMARY_NAV: NavLinkItem[] = [
  { href: "/dashboard",            label: "Dashboard",   icon: "Home" },
  { href: "/dashboard/jobs",       label: "Jobs",        icon: "Briefcase" },
  { href: "/dashboard/pipeline",   label: "Pipeline",    icon: "Kanban" },
  { href: "/dashboard/triage",     label: "Triage",      icon: "ClipboardList" },
  { href: "/dashboard/talent",     label: "Talent Bank", icon: "Users" },
  { href: "/dashboard/sourcing",   label: "Sourcing",    icon: "Network" },
];

interface SidebarProps {
  userName: string;
  userRole?: string;
}

export function Sidebar({ userName, userRole }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-[232px] shrink-0 bg-surface-chrome backdrop-blur-24 border-r border-chrome flex flex-col">
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-5">
        <BrandMark className="shadow-[0_2px_6px_rgba(0,113,227,0.3)]" />
        <span className="text-title-m text-ink">RoleRecruit</span>
      </div>

      <nav className="flex-1 px-3.5 flex flex-col gap-px">
        {PRIMARY_NAV.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}

        <RoleGate requiredAction="settings" fallback={null}>
          <div className="text-micro text-ink-tertiary px-3 pt-4 pb-1.5">Manage</div>
          <NavLink
            item={{ href: "/dashboard/settings", label: "Settings", icon: "Settings" }}
            active={pathname.startsWith("/dashboard/settings")}
          />
        </RoleGate>
      </nav>

      <div className="px-3.5 pb-4 pt-3">
        <Dropdown
          side="top"
          align="start"
          trigger={
            <button
              type="button"
              className="w-full flex items-center gap-2.5 rounded-md bg-surface-floating border border-chrome px-2.5 py-2 text-left hover:bg-accent-soft transition-colors duration-fast"
            >
              <Avatar name={userName} size={28} />
              <div className="min-w-0 flex-1">
                <div className="text-body-s font-semibold text-ink leading-tight truncate">{userName}</div>
                {userRole && <div className="text-caption text-ink-secondary leading-tight truncate">{userRole}</div>}
              </div>
              <Icon name="ChevronUp" size={14} color="var(--ink-3)" />
            </button>
          }
        >
          <DropdownLabel>Theme</DropdownLabel>
          <div className="px-2.5 py-1.5">
            <ThemeToggle />
          </div>
          <DropdownDivider />
          <DropdownItem
            onSelect={() => {
              window.location.href = "/sign-out";
            }}
          >
            Sign out
          </DropdownItem>
        </Dropdown>
      </div>
    </aside>
  );
}

function NavLink({ item, active }: { item: NavLinkItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-[11px] rounded-sm px-3 py-2 text-body-s font-medium transition-colors duration-fast ease-apple-out",
        active
          ? "bg-surface-floating shadow-elev-1 text-ink"
          : "text-ink hover:bg-accent-soft",
      )}
    >
      <Icon name={item.icon} size={16} color={active ? "var(--accent)" : "var(--ink-2)"} />
      {item.label}
      {active && (
        <span
          aria-hidden
          className="absolute left-[-14px] top-2 bottom-2 w-[3px] rounded-r-sm bg-accent-grad"
        />
      )}
    </Link>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}
