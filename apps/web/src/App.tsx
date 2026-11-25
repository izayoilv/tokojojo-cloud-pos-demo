import { Navigate, Route, Router, useLocation } from "@solidjs/router";
import { PreferencesProvider, ToastProvider } from "@tokojojo/ui";
import type { JSX } from "solid-js";
import { Show } from "solid-js";

import { AppLayout } from "./app/AppLayout";
import { AuthProvider, useAuth } from "./app/auth";
import { canAccess, type ModuleKey } from "./app/rbac";
import { LoginPage } from "./features/auth/LoginPage";
import { CustomersPage } from "./features/customers/CustomersPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { ForbiddenPage, NotFoundPage } from "./features/errors/ErrorPages";
import { FinancePage } from "./features/finance/FinancePage";
import { InventoryPage } from "./features/inventory/InventoryPage";
import { ProductsPage } from "./features/products/ProductsPage";
import { PurchasingPage } from "./features/purchasing/PurchasingPage";
import { ReportsPage } from "./features/reports/ReportsPage";
import { SalesPage } from "./features/sales/SalesPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { UsersPage } from "./features/users/UsersPage";
import { WarehousePage } from "./features/warehouse/WarehousePage";

function RequireModule(props: { module: ModuleKey; children: JSX.Element }) {
  const auth = useAuth();
  return (
    <Show
      when={auth.user() && canAccess(auth.user()!.role, props.module)}
      fallback={<Navigate href="/403" />}
    >
      {props.children}
    </Show>
  );
}

function RootLayout(props: { children?: JSX.Element }) {
  const auth = useAuth();
  const location = useLocation();
  const onLogin = () => location.pathname === "/login";

  return (
    <Show when={onLogin() || auth.user()} fallback={<Navigate href="/login" />}>
      <Show when={onLogin()} fallback={<AppLayout>{props.children}</AppLayout>}>
        {props.children}
      </Show>
    </Show>
  );
}

export default function App() {
  return (
    <PreferencesProvider>
      <AuthProvider>
        <ToastProvider>
          <Router root={RootLayout}>
            <Route path="/login" component={LoginPage} />
            <Route
              path="/"
              component={() => (
                <RequireModule module="RINGKASAN">
                  <DashboardPage />
                </RequireModule>
              )}
            />
            <Route
              path="/produk"
              component={() => (
                <RequireModule module="PRODUK">
                  <ProductsPage />
                </RequireModule>
              )}
            />
            <Route
              path="/pelanggan"
              component={() => (
                <RequireModule module="PELANGGAN">
                  <CustomersPage />
                </RequireModule>
              )}
            />
            <Route
              path="/persediaan"
              component={() => (
                <RequireModule module="PERSEDIAAN">
                  <InventoryPage />
                </RequireModule>
              )}
            />
            <Route
              path="/pembelian"
              component={() => (
                <RequireModule module="PEMBELIAN">
                  <PurchasingPage />
                </RequireModule>
              )}
            />
            <Route
              path="/penjualan"
              component={() => (
                <RequireModule module="PENJUALAN">
                  <SalesPage />
                </RequireModule>
              )}
            />
            <Route
              path="/gudang"
              component={() => (
                <RequireModule module="GUDANG">
                  <WarehousePage />
                </RequireModule>
              )}
            />
            <Route
              path="/keuangan"
              component={() => (
                <RequireModule module="KEUANGAN">
                  <FinancePage />
                </RequireModule>
              )}
            />
            <Route
              path="/laporan"
              component={() => (
                <RequireModule module="LAPORAN">
                  <ReportsPage />
                </RequireModule>
              )}
            />
            <Route
              path="/pengguna"
              component={() => (
                <RequireModule module="PENGGUNA">
                  <UsersPage />
                </RequireModule>
              )}
            />
            <Route path="/pengaturan" component={SettingsPage} />
            <Route path="/403" component={ForbiddenPage} />
            <Route path="/404" component={NotFoundPage} />
            <Route
              path="/products"
              component={() => <Navigate href="/produk" />}
            />
            <Route
              path="/reports"
              component={() => <Navigate href="/laporan" />}
            />
            <Route path="*" component={NotFoundPage} />
          </Router>
        </ToastProvider>
      </AuthProvider>
    </PreferencesProvider>
  );
}
