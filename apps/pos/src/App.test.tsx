// @vitest-environment happy-dom
import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";

import App from "./App";
import { PosProvider } from "./app/PosProvider";
import { createPosStore } from "./app/store";

const click = (element: Element) => {
  element.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
  );
};

const findButton = (root: HTMLElement, label: string) =>
  [...root.querySelectorAll("button")].find((button) =>
    button.textContent?.includes(label),
  );

const pressPin = (root: HTMLElement, pin: string) => {
  for (const digit of pin) {
    const button = root.querySelector<HTMLButtonElement>(
      `[data-pin-digit="${digit}"]`,
    );
    expect(button).not.toBeNull();
    click(button!);
  }
};

let dispose: (() => void) | undefined;

function mount() {
  const root = document.createElement("div");
  document.body.append(root);
  const store = createPosStore();

  dispose = render(
    () => (
      <PosProvider store={store}>
        <App />
      </PosProvider>
    ),
    root,
  );

  return { root, store };
}

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.innerHTML = "";
});

describe("app shell", () => {
  it("activates a pending device and reaches the PIN screen", () => {
    const { root, store } = mount();

    expect(root.textContent).toContain("Aktifkan perangkat");
    expect(root.textContent).toContain("Perangkat menunggu persetujuan admin.");
    expect(store.state.deviceStatus()).toBe("PENDING");

    const approve = findButton(root, "Setujui perangkat");
    expect(approve).toBeDefined();
    click(approve!);

    expect(store.state.deviceStatus()).toBe("ACTIVE");
    expect(root.textContent).toContain("Masukkan PIN");
  });

  it("rejects a wrong PIN then opens a shift with opening cash", () => {
    const { root, store } = mount();

    click(findButton(root, "Setujui perangkat")!);
    pressPin(root, "1111");

    expect(root.textContent).toContain("PIN salah");
    expect(store.state.screen()).toBe("LOCK");

    pressPin(root, "4321");

    expect(root.textContent).toContain("Buka Shift");
    expect(store.state.screen()).toBe("OPEN_SHIFT");

    const input = root.querySelector<HTMLInputElement>(
      'input[inputmode="numeric"]',
    );
    expect(input).not.toBeNull();
    input!.value = "500000";
    input!.dispatchEvent(new Event("input", { bubbles: true }));

    click(findButton(root, "Buka shift")!);

    expect(store.state.screen()).toBe("SELL");
    expect(store.state.shift()?.openingCash).toBe(500000);
    expect(store.state.cart()).toHaveLength(3);
  });

  it("shows revoked copy and retries back to pending", () => {
    const { root, store } = mount();

    const revoke = findButton(root, "Cabut");
    expect(revoke).toBeDefined();
    click(revoke!);

    expect(store.state.deviceStatus()).toBe("REVOKED");
    expect(root.textContent).toContain("Perangkat dicabut. Hubungi admin.");

    const retry = findButton(root, "Coba lagi");
    expect(retry).toBeDefined();
    click(retry!);

    expect(store.state.deviceStatus()).toBe("PENDING");
    expect(root.textContent).toContain("Perangkat menunggu persetujuan admin.");
  });
});
