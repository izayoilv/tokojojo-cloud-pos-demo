import { For } from "solid-js";

const shortcuts: Array<[string, string]> = [
  ["F2", "Bayar"],
  ["F3", "Cari"],
  ["F8", "Tahan"],
  ["F9", "Riwayat"],
  ["F12", "Kunci"],
];

export function ShortcutFooter() {
  return (
    <footer
      aria-label="Pintasan keyboard"
      class="flex h-9 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-line bg-surface px-4 text-[0.6875rem] text-ink-muted"
    >
      <span class="font-bold text-ink-secondary">Pintasan</span>
      <For each={shortcuts}>
        {([key, label]) => (
          <span class="flex items-center gap-1">
            <kbd class="min-w-6 rounded-[3px] border border-line bg-subtle px-1 py-0.5 text-center font-mono text-[0.625rem] font-bold text-ink-secondary">
              {key}
            </kbd>
            {label}
          </span>
        )}
      </For>
      <span class="ml-auto flex items-center gap-1">
        <kbd class="min-w-6 rounded-[3px] border border-line bg-subtle px-1 py-0.5 text-center font-mono text-[0.625rem] font-bold text-ink-secondary">
          Esc
        </kbd>
        Kembali
      </span>
    </footer>
  );
}
