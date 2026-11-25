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
