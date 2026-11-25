import { invoke } from "@tauri-apps/api/core";
import { createResource } from "solid-js";

type AppInfo = {
  name: string;
  version: string;
};

function App() {
  const [info] = createResource(() => invoke<AppInfo>("app_info"));

  return (
    <main class="app">
      <header>
        <p class="eyebrow">TokoJojo</p>
        <h1>POS terminal</h1>
        <p class="muted">
          Offline-capable checkout shell. Rust core is wired through Tauri
          commands.
        </p>
      </header>

      <section class="panel">
        <h2>Runtime</h2>
        <p>
          {info()?.name ?? "TokoJojo POS"} {info()?.version ?? ""}
        </p>
      </section>
    </main>
  );
}

export default App;
