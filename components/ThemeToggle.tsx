"use client";

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

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("forma_theme", next);
    applyTheme(next);
  };

  return { theme, isDark: theme === "dark", toggleTheme, mounted };
}

interface ThemeToggleProps {
  showLabel?: boolean;
  className?: string;
}

export function ThemeToggle({ showLabel = false, className = "" }: ThemeToggleProps) {
  const { isDark, toggleTheme, mounted } = useTheme();

  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Tema değiştir"
        className={"secondary " + className}
        style={{ minHeight: "36px", padding: showLabel ? "0 12px" : "0 10px", fontSize: "12px", gap: "6px", borderRadius: "8px" }}
        disabled
      >
        <Moon size={15} />
        {showLabel && <span>Koyu Mod</span>}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Açık Moda Geç" : "Koyu Moda Geç"}
      title={isDark ? "Açık Moda Geç" : "Koyu Moda Geç"}
      className={"secondary " + className}
      style={{
        minHeight: "36px",
        padding: showLabel ? "0 12px" : "0 10px",
        fontSize: "12px",
        gap: "6px",
        borderRadius: "8px",
        transition: "all 0.2s ease"
      }}
    >
      {isDark ? (
        <>
          <Sun size={15} className="text-amber-400" />
          {showLabel && <span>Açık Mod</span>}
        </>
      ) : (
        <>
          <Moon size={15} className="text-slate-600" />
          {showLabel && <span>Koyu Mod</span>}
        </>
      )}
    </button>
  );
}
