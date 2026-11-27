import { For } from "solid-js";

const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

const keyClass =
  "flex h-12 cursor-pointer items-center justify-center rounded-[6px] border border-line bg-surface text-xl font-bold text-ink transition-colors hover:bg-hover active:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-45";

export function PinPad(props: {
  onDigit: (digit: string) => void;
  onClear: () => void;
  onBackspace: () => void;
  disabled?: boolean;
}) {
  return (
    <div class="grid w-full grid-cols-3 gap-1.5">
      <For each={digits}>
        {(digit) => (
          <button
            type="button"
            data-pin-digit={digit}
            disabled={props.disabled}
            onClick={() => props.onDigit(digit)}
            class={keyClass}
          >
            {digit}
          </button>
        )}
      </For>
      <button
        type="button"
        aria-label="Hapus PIN"
        disabled={props.disabled}
        onClick={() => props.onClear()}
        class={`${keyClass} text-sm text-ink-muted`}
      >
        C
      </button>
      <button
        type="button"
        data-pin-digit="0"
        disabled={props.disabled}
        onClick={() => props.onDigit("0")}
        class={keyClass}
      >
        0
      </button>
      <button
        type="button"
        aria-label="Hapus digit terakhir"
        disabled={props.disabled}
        onClick={() => props.onBackspace()}
        class={`${keyClass} text-base text-ink-muted`}
      >
        ←
      </button>
    </div>
  );
}
