"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Laptop } from "lucide-react";

export type Theme = "system" | "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = (localStorage.getItem("color-scheme") as Theme) || "system";
    setTheme(stored);
    applyTheme(stored);

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const current = localStorage.getItem("color-scheme") as Theme;
      if (!current || current === "system") {
        applyTheme("system");
      }
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  function applyTheme(target: Theme) {
    const root = document.documentElement;
    const meta = document.querySelector('meta[name="color-scheme"]');

    if (target === "system") {
      localStorage.removeItem("color-scheme");
      if (meta) meta.setAttribute("content", "light dark");
      const isSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (isSystemDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    } else if (target === "dark") {
      localStorage.setItem("color-scheme", "dark");
      if (meta) meta.setAttribute("content", "dark");
      root.classList.add("dark");
    } else {
      localStorage.setItem("color-scheme", "light");
      if (meta) meta.setAttribute("content", "light");
      root.classList.remove("dark");
    }
  }

  function cycleTheme() {
    let next: Theme = "dark";
    if (theme === "dark") next = "light";
    else if (theme === "light") next = "system";
    else next = "dark";

    setTheme(next);
    applyTheme(next);
  }

  if (!mounted) {
    return (
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
        aria-label="Toggle color theme"
      >
        <Sun className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={cycleTheme}
      title={`Theme: ${theme.toUpperCase()} (Click to change)`}
      className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
      aria-label={`Theme: ${theme}`}
    >
      {theme === "dark" && <Moon className="h-3.5 w-3.5 text-indigo-400" />}
      {theme === "light" && <Sun className="h-3.5 w-3.5 text-amber-500" />}
      {theme === "system" && <Laptop className="h-3.5 w-3.5 text-slate-400" />}
      <span className="capitalize">{theme}</span>
    </button>
  );
}
