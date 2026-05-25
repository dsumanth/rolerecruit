"use client";

import Link from "next/link";
import { RoleGate } from "@/components/auth/role-gate";
import { Button } from "@/components/ui/button";

export function Sidebar() {
  return (
    <aside className="w-60 bg-surface border-r border-surface-tertiary flex flex-col shrink-0">
      <div className="px-6 py-5 border-b border-surface-tertiary">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight text-ink">
          RoleRecruit
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <NavItem href="/dashboard" label="Dashboard" />
        <NavItem href="/dashboard/jobs" label="Jobs" />
        <NavItem href="/dashboard/pipeline" label="Pipeline" />
        <NavItem href="/dashboard/talent" label="Talent Bank" />
        <RoleGate requiredAction="settings" fallback={null}>
          <NavItem href="/dashboard/settings" label="Settings" />
        </RoleGate>
      </nav>

      <div className="px-3 py-4 border-t border-surface-tertiary">
        <form action="/sign-out">
          <Button
            type="submit"
            variant="ghost"
            size="md"
            className="w-full text-left"
          >
            Sign Out
          </Button>
        </form>
      </div>
    </aside>
  );
}

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block px-3 py-2 rounded-apple text-sm text-ink hover:bg-surface-secondary transition-colors"
    >
      {label}
    </Link>
  );
}
