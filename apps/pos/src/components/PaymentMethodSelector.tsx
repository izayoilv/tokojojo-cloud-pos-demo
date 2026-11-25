import {
  ArrowLeftRight,
  Banknote,
  CreditCard,
  QrCode,
  Split,
  Users,
} from "lucide-solid";
import { type Component, For } from "solid-js";

import type { PaymentMethod } from "../data/types";
import { paymentMethodHints, paymentMethodLabels } from "../lib/payment";

const methods: PaymentMethod[] = [
  "TUNAI",
  "QRIS",
  "DEBIT",
  "TRANSFER",
  "CAMPURAN",
  "HUTANG",
];

const icons: Record<
  PaymentMethod,
  Component<{ size?: number | string; class?: string }>
> = {
  TUNAI: Banknote,
  QRIS: QrCode,
  DEBIT: CreditCard,
  TRANSFER: ArrowLeftRight,
  CAMPURAN: Split,
  HUTANG: Users,
};

export function PaymentMethodSelector(props: {
  value: PaymentMethod | null;
  allowed: PaymentMethod[];
  onChange: (method: PaymentMethod) => void;
}) {
  return (
    <div
      class="grid grid-cols-3 gap-2 sm:grid-cols-6"
      aria-label="Metode pembayaran"
    >
      <For each={methods}>
        {(method) => {
          const Icon = icons[method];
          const enabled = () => props.allowed.includes(method);
          const active = () => props.value === method;

          return (
            <button
              type="button"
              disabled={!enabled()}
              aria-pressed={active()}
              title={
                enabled()
                  ? paymentMethodHints[method]
                  : "Tidak tersedia pada status koneksi ini"
              }
              onClick={() => props.onChange(method)}
              class={`flex min-h-[76px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[8px] border px-2 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50 ${
                active()
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-line bg-surface text-ink hover:border-line-control hover:bg-hover"
              }`}
            >
              <Icon size={20} />
              <strong class="text-xs font-bold">
                {paymentMethodLabels[method]}
              </strong>
              <span class="text-center text-[9px] leading-tight font-semibold text-ink-muted">
                {enabled() ? paymentMethodHints[method] : "Tidak tersedia"}
              </span>
            </button>
          );
        }}
      </For>
    </div>
  );
}
