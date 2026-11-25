import type { JSX } from "solid-js";
import {
  createContext,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  useContext,
} from "solid-js";

export type ThemeMode = "light" | "dark" | "system";
export type TextSize = "normal" | "large";

type PreferencesContextValue = {
  theme: () => ThemeMode;
  resolvedTheme: () => "light" | "dark";
  setTheme: (theme: ThemeMode) => void;
  textSize: () => TextSize;
  setTextSize: (size: TextSize) => void;
};

const PreferencesContext = createContext<PreferencesContextValue>();
const STORAGE_KEY = "tokojojo.preferences";

type StoredPreferences = {
  theme?: ThemeMode;
  textSize?: TextSize;
};

function readPreferences(): StoredPreferences {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredPreferences) : {};
  } catch {
    return {};
  }
}

function writePreferences(value: StoredPreferences): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Preferences are non-critical; private mode can reject storage.
  }
}

export function PreferencesProvider(props: {
  children: JSX.Element;
  defaultTheme?: ThemeMode;
  defaultTextSize?: TextSize;
}) {
  const stored = readPreferences();
  const [theme, setTheme] = createSignal<ThemeMode>(
    stored.theme ?? props.defaultTheme ?? "system",
  );
  const [textSize, setTextSize] = createSignal<TextSize>(
    stored.textSize ?? props.defaultTextSize ?? "normal",
  );
  const [systemDark, setSystemDark] = createSignal(false);

  onMount(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(query.matches);
    update();
    query.addEventListener("change", update);
    onCleanup(() => query.removeEventListener("change", update));
  });

  const resolvedTheme = (): "light" | "dark" => {
    const current = theme();
    if (current === "system") return systemDark() ? "dark" : "light";
    return current;
  };

  createEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme();
    root.dataset.textSize = textSize();
    writePreferences({ theme: theme(), textSize: textSize() });
  });

  return (
    <PreferencesContext.Provider
      value={{ theme, resolvedTheme, setTheme, textSize, setTextSize }}
    >
      {props.children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);

  if (!context) {
    throw new Error("usePreferences must be used inside PreferencesProvider");
  }

  return context;
}
