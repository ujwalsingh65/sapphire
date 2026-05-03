import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Monitor } from "lucide-react";

const Settings = () => {
  const { theme, setTheme } = useTheme();
  return (
    <section className="container py-8">
      <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        App preferences. Theme is stored locally in this browser.
      </p>

      <div className="mt-6 max-w-md rounded-xl border border-border bg-card p-5 shadow-card">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Appearance
        </h3>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Button
            variant={theme === "light" ? "default" : "outline"}
            onClick={() => setTheme("light")}
            className="gap-2"
          >
            <Sun className="h-4 w-4" /> Light
          </Button>
          <Button
            variant={theme === "dark" ? "default" : "outline"}
            onClick={() => setTheme("dark")}
            className="gap-2"
          >
            <Moon className="h-4 w-4" /> Dark
          </Button>
          <Button
            variant={theme === "system" ? "default" : "outline"}
            onClick={() => setTheme("system")}
            className="gap-2"
          >
            <Monitor className="h-4 w-4" /> System
          </Button>
        </div>
      </div>
    </section>
  );
};

export default Settings;