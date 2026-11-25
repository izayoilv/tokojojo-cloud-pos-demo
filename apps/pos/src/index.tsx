/* @refresh reload */
import "./styles.css";

import { PreferencesProvider, ToastProvider } from "@tokojojo/ui";
import { render } from "solid-js/web";

import App from "./App";

render(
  () => (
    <PreferencesProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </PreferencesProvider>
  ),
  document.getElementById("root") as HTMLElement,
);
