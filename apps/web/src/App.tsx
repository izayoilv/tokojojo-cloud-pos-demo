import { Navigate, Route, Router } from "@solidjs/router";
import type { JSX } from "solid-js";
import { Show } from "solid-js";

import { AppLayout } from "./app/AppLayout";
import { AuthProvider, useAuth } from "./app/auth";
import { ToastProvider } from "./app/toast";
import { LoginPage } from "./features/auth/LoginPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { ProductsPage } from "./features/products/ProductsPage";
import { ReportsPage } from "./features/reports/ReportsPage";
import { SoonPage } from "./features/soon/SoonPage";

function ProtectedLayout(props: { children?: JSX.Element }) {
  const auth = useAuth();

  return (
    <Show when={auth.user()} fallback={<Navigate href="/login" />}>
      <AppLayout>{props.children}</AppLayout>
    </Show>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <Route path="/login" component={LoginPage} />
          <Route path="/" component={ProtectedLayout}>
            <Route path="" component={DashboardPage} />
            <Route path="products" component={ProductsPage} />
            <Route path="reports" component={ReportsPage} />
            <Route path="soon/:module" component={SoonPage} />
          </Route>
          <Route path="*" component={() => <Navigate href="/" />} />
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}
