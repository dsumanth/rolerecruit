"use client";

import { cn } from "@/lib/utils";
import { Dropdown, DropdownItem } from "./dropdown";
import { Icon } from "./icon";

interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
}

export function Select({ value, onChange, options, placeholder = "Choose", className }: SelectProps) {
  const current = options.find((o) => o.value === value);
  return (
    <Dropdown
      align="end"
      trigger={
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-2 rounded-sm border border-hairline-strong bg-surface px-3 py-[7px] text-body-s text-ink hover:border-accent transition-colors duration-fast",
            className,
          )}
        >
          <span>{current?.label ?? placeholder}</span>
          <Icon name="ChevronDown" size={13} color="var(--ink-3)" />
        </button>
      }
    >
      {options.map((o) => (
        <DropdownItem key={o.value} onSelect={() => onChange(o.value)}>
          {o.label}
        </DropdownItem>
      ))}
    </Dropdown>
  );
}
