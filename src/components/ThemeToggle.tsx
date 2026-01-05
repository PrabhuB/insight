import { useEffect, useState } from "react";
import { Moon, Sparkles, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

type ThemeMode = "light" | "dark" | "amoled";

const applyTheme = (theme: ThemeMode) => {
  const root = document.documentElement;
  root.classList.remove("dark", "amoled");

  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "amoled") {
    root.classList.add("amoled");
  }
};

export const ThemeToggle = () => {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "amoled";
    const stored = window.localStorage.getItem("salary-theme");
    if (stored === "light" || stored === "dark" || stored === "amoled") {
      return stored as ThemeMode;
    }
    window.localStorage.setItem("salary-theme", "amoled");
    return "amoled";
  });

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem("salary-theme", theme);
  }, [theme]);

  const isActive = (mode: ThemeMode) => theme === mode;

  return (
    <div className="inline-flex items-center rounded-full border border-border/60 bg-muted/60 px-0.5 py-0.5 backdrop-blur">
      <Button
        type="button"
        variant={isActive("light") ? "default" : "ghost"}
        size="sm"
        className="h-7 px-2 text-xs gap-1 rounded-full"
        onClick={() => setTheme("light")}
        aria-label="Switch to light mode"
      >
        <Sun className="h-3 w-3" />
        <span className="hidden sm:inline">Light</span>
      </Button>
      <Button
        type="button"
        variant={isActive("dark") ? "default" : "ghost"}
        size="sm"
        className="h-7 px-2 text-xs gap-1 rounded-full"
        onClick={() => setTheme("dark")}
        aria-label="Switch to dark mode"
      >
        <Moon className="h-3 w-3" />
        <span className="hidden sm:inline">Dark</span>
      </Button>
      <Button
        type="button"
        variant={isActive("amoled") ? "default" : "ghost"}
        size="sm"
        className="h-7 px-2 text-xs gap-1 rounded-full"
        onClick={() => setTheme("amoled")}
        aria-label="Switch to AMOLED mode"
      >
        <Sparkles className="h-3 w-3" />
        <span className="hidden sm:inline">AMOLED</span>
      </Button>
    </div>
  );
};
