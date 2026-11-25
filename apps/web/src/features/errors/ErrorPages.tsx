import { A } from "@solidjs/router";
import { Button, EmptyState, Panel } from "@tokojojo/ui";
import { ArrowLeft, FileQuestion, ShieldX } from "lucide-solid";

export function ForbiddenPage() {
  return (
    <Panel>
      <EmptyState
        icon={<ShieldX size={40} stroke-width={1.6} />}
        title="Akses ditolak"
        description="Peran Anda tidak memiliki akses ke halaman ini. Hubungi OWNER/ADMIN bila akses diperlukan."
        action={
          <A href="/">
            <Button size="sm">
              <ArrowLeft size={14} /> Kembali ke Ringkasan
            </Button>
          </A>
        }
      />
    </Panel>
  );
}

export function NotFoundPage() {
  return (
    <Panel>
      <EmptyState
        icon={<FileQuestion size={40} stroke-width={1.6} />}
        title="Halaman tidak ditemukan"
        description="Tautan mungkin sudah berubah atau data sudah dihapus."
        action={
          <A href="/">
            <Button size="sm">
              <ArrowLeft size={14} /> Kembali ke Ringkasan
            </Button>
          </A>
        }
      />
    </Panel>
  );
}
