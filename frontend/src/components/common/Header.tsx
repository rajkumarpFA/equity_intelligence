"use client";

import { HealthIndicator } from "@/components/common/HealthIndicator";
import { ThemeToggle } from "@/components/common/ThemeToggle";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-8 transition-colors dark:border-slate-800 dark:bg-slate-900/80">
      <div>
        <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <HealthIndicator />
      </div>
    </header>
  );
}
