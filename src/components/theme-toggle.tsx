import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  applyThemePreference,
  getThemePreference,
  THEME_CHANGE_EVENT,
  type ThemePreference,
} from "@/lib/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemePreference>("light");

  useEffect(() => {
    const current = getThemePreference();
    setTheme(current);
    applyThemePreference(current);

    const syncTheme = (event: Event) => {
      const custom = event as CustomEvent<{ theme?: ThemePreference }>;
      setTheme(custom.detail?.theme ?? getThemePreference());
    };

    window.addEventListener(THEME_CHANGE_EVENT, syncTheme);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, syncTheme);
  }, []);

  const toggle = () => {
    applyThemePreference(theme === "dark" ? "light" : "dark");
  };

  return (
    <Button variant="ghost" size="icon" onClick={toggle} className="size-9" aria-label="切换主题">
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
