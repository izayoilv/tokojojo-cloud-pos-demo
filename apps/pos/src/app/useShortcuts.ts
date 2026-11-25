import { onCleanup, onMount } from "solid-js";

export type ShortcutKey = "F2" | "F3" | "F8" | "F9" | "F12" | "Escape";

export type ShortcutHandlers = Partial<
  Record<ShortcutKey, (event: KeyboardEvent) => void>
>;

export function useShortcuts(handlers: ShortcutHandlers) {
  onMount(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key as ShortcutKey;
      const handler = handlers[key];
      if (!handler) return;

      if (document.querySelector('[role="dialog"]')) return;

      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        Boolean(
          target.closest("input, textarea, select, [contenteditable='true']"),
        );

      if (typing && key !== "Escape") return;

      event.preventDefault();
      handler(event);
    };

    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => window.removeEventListener("keydown", onKeyDown));
  });
}
