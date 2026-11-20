import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";

export function ProductsPage() {
  return (
    <>
      <PageHeader title="Master Produk" subtitle="Katalog barang toko" />
      <Card class="p-8 text-sm text-muted">
        Katalog produk sedang disiapkan.
      </Card>
    </>
  );
}
