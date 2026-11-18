import { Route, Router } from "@solidjs/router";

function Dashboard() {
  return (
    <main class="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <header>
        <p class="text-sm font-medium uppercase tracking-wide text-slate-500">
          TokoJojo
        </p>
        <h1 class="text-3xl font-semibold text-slate-900">Admin dashboard</h1>
      </header>
      <section class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p class="text-slate-600">
          The API and dashboard data will be connected after the server contract
          is finalized.
        </p>
      </section>
    </main>
  );
}

export default function App() {
  return (
    <Router>
      <Route path="/" component={Dashboard} />
    </Router>
  );
}
