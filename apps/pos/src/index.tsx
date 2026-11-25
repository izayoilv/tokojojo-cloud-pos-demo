/* @refresh reload */
import "./styles.css";

import { PreferencesProvider, ToastProvider } from "@tokojojo/ui";
import { render } from "solid-js/web";

import App from "./App";
import { PosProvider } from "./app/PosProvider";

render(
  () => (
    <PreferencesProvider>
      <ToastProvider>
        <PosProvider>
          <App />
        </PosProvider>
      </ToastProvider>
    </PreferencesProvider>
  ),
  document.getElementById("root") as HTMLElement,
);
