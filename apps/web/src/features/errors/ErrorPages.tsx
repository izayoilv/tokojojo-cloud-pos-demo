import { A } from "@solidjs/router";
import { EmptyState, Panel } from "@tokojojo/ui";
import { ArrowLeft, FileQuestion, ShieldX } from "lucide-solid";

const backLinkClass =
  "inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-[6px] border border-line-control bg-surface px-3 text-xs font-semibold text-ink transition-colors hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export function ForbiddenPage() {
  return (
    <Panel>
      <EmptyState
        icon={<ShieldX size={40} stroke-width={1.6} />}
        title="Akses ditolak"
        description="Peran Anda tidak memiliki akses ke halaman ini. Hubungi OWNER/ADMIN bila akses diperlukan."
        action={
          <A href="/" class={backLinkClass}>
            <ArrowLeft size={14} /> Kembali ke Ringkasan
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
          <A href="/" class={backLinkClass}>
            <ArrowLeft size={14} /> Kembali ke Ringkasan
          </A>
        }
      />
    </Panel>
  );
}
