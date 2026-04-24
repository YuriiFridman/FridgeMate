import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeMode = "light" | "dark";

interface ThemePalette {
  bg: string;
  card: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  overlay: string;
}

interface AppThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  palette: ThemePalette;
  toggleTheme: () => void;
}

const STORAGE_KEY = "fridgemate.theme-mode";

const lightPalette: ThemePalette = {
  bg: "#F9FAFB",
  card: "#FFFFFF",
  text: "#111827",
  textMuted: "#6B7280",
  border: "#E5E7EB",
  accent: "#E11D48",
  overlay: "rgba(17, 24, 39, 0.28)",
};

const darkPalette: ThemePalette = {
  bg: "#0F172A",
  card: "#111827",
  text: "#F9FAFB",
  textMuted: "#94A3B8",
  border: "#334155",
  accent: "#F43F5E",
  overlay: "rgba(2, 6, 23, 0.74)",
};

const AppThemeContext = createContext<AppThemeContextValue | undefined>(undefined);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("light");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((storedMode) => {
        if (storedMode === "light" || storedMode === "dark") {
          setMode(storedMode);
        }
      })
      .catch(() => {});
  }, []);

  const toggleTheme = () => {
    setMode((prev) => {
      const next = prev === "light" ? "dark" : "light";
      void AsyncStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  };

  const value = useMemo<AppThemeContextValue>(
    () => ({
      mode,
      isDark: mode === "dark",
      palette: mode === "dark" ? darkPalette : lightPalette,
      toggleTheme,
    }),
    [mode],
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(AppThemeContext);
  if (!context) {
    throw new Error("useAppTheme must be used within AppThemeProvider");
  }
  return context;
}
