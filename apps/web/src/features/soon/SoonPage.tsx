import { A, useParams } from "@solidjs/router";
import { ArrowLeft, Construction } from "lucide-solid";
import { Show } from "solid-js";

import { useAuth } from "../../app/auth";
import { canAccess, moduleByKey } from "../../app/rbac";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Pill } from "../../components/ui/Pill";

export function SoonPage() {
  const params = useParams<{ module: string }>();
  const auth = useAuth();
  const module = () => moduleByKey(params.module);

  return (
    <Show
      when={module()}
      fallback={
        <Card>
          <EmptyState
            title="Modul tidak ditemukan"
            description="Menu yang Anda tuju tidak tersedia."
            action={
              <A href="/">
                <Button size="sm">Kembali ke Dashboard</Button>
              </A>
            }
          />
        </Card>
      }
    >
      {(item) => (
        <Show
          when={auth.user() && canAccess(auth.user()!.role, item().key)}
          fallback={
            <Card>
              <EmptyState
                title="Akses ditolak"
                description="Peran Anda tidak memiliki izin membuka modul ini. Hubungi pemilik toko bila akses diperlukan."
                icon={<Construction size={36} stroke-width={1.6} />}
                action={
                  <A href="/">
                    <Button size="sm">Kembali ke Dashboard</Button>
                  </A>
                }
              />
            </Card>
          }
        >
          <Card class="overflow-hidden">
            <div class="flex flex-col items-center gap-4 px-6 py-16 text-center">
              <span
                class="flex size-16 items-center justify-center rounded-2xl text-lg font-extrabold"
                style={{
                  background: `${item().color}18`,
                  color: item().color,
                }}
              >
                {item().short}
              </span>
              <div>
                <div class="mb-2 flex justify-center">
                  <Pill tone="amber">SEGERA HADIR</Pill>
                </div>
                <h2 class="text-lg font-extrabold text-ink">{item().label}</h2>
                <p class="mx-auto mt-1 max-w-md text-[13px] text-muted">
                  {item().description}
                </p>
                <p class="mx-auto mt-3 max-w-lg text-xs text-faint">
                  Modul ini sedang disiapkan. Pada rilis pertama, dashboard,
                  katalog produk, dan laporan sudah dapat dipakai dengan data
                  contoh.
                </p>
              </div>
              <div class="mt-2 flex flex-wrap justify-center gap-2">
                <A href="/">
                  <Button size="sm">
                    <ArrowLeft size={14} /> Dashboard
                  </Button>
                </A>
                <A href="/products">
                  <Button size="sm" variant="secondary">
                    Lihat Produk
                  </Button>
                </A>
              </div>
            </div>
          </Card>
        </Show>
      )}
    </Show>
  );
}
