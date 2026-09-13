import fs from 'node:fs';

const code = `"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("forma_theme");
    if (saved === "dark" || saved === "light") {
      setTheme(saved);
      applyTheme(saved);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const initial = prefersDark ? "dark" : "light";
      setTheme(initial);
      applyTheme(initial);
    }
  }, []);

  const applyTheme = (t: "light" | "dark") => {
    const root = document.documentElement;
    if (t === "dark") {
      root.classList.add("dark");
      root.setAttribute("data-theme", "dark");
    } else {
      root.classList.remove("dark");
      root.setAttribute("data-theme", "light");
    }
  };

  const changeTheme = (newTheme: "light" | "dark") => {
    setTheme(newTheme);
    localStorage.setItem("forma_theme", newTheme);
    applyTheme(newTheme);
  };

  const toggleTheme = () => {
    changeTheme(theme === "dark" ? "light" : "dark");
  };

  return { theme, isDark: theme === "dark", changeTheme, toggleTheme, mounted };
}

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { theme, changeTheme, mounted } = useTheme();

  return (
    <div
      className={"inline-flex items-center p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/90 shadow-sm " + className}
      style={{ minHeight: "34px" }}
      role="group"
      aria-label="Tema Seçimi"
    >
      <button
        type="button"
        onClick={() => changeTheme("light")}
        className={
          "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all " +
          ((!mounted || theme === "light")
            ? "bg-white text-slate-900 shadow-sm border border-slate-200/80"
            : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white")
        }
        title="Açık Mod"
      >
        <Sun size={14} className={(!mounted || theme === "light") ? "text-amber-500" : ""} />
        <span>Açık</span>
      </button>
      <button
        type="button"
        onClick={() => changeTheme("dark")}
        className={
          "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all " +
          ((mounted && theme === "dark")
            ? "bg-slate-900 text-white shadow-sm border border-slate-700"
            : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white")
        }
        title="Koyu Mod"
      >
        <Moon size={14} className={(mounted && theme === "dark") ? "text-indigo-400" : ""} />
        <span>Koyu</span>
      </button>
    </div>
  );
}
`;

fs.writeFileSync('components/ThemeToggle.tsx', code, 'utf8');
console.log('components/ThemeToggle.tsx updated successfully');
