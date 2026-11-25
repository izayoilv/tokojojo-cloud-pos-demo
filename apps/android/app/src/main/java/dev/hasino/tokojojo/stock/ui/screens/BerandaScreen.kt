package dev.hasino.tokojojo.stock.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.hasino.tokojojo.stock.data.ConnectionState
import dev.hasino.tokojojo.stock.data.Location
import dev.hasino.tokojojo.stock.data.Product
import dev.hasino.tokojojo.stock.data.StockStatus
import dev.hasino.tokojojo.stock.data.formatRupiah
import dev.hasino.tokojojo.stock.data.inventoryValue
import dev.hasino.tokojojo.stock.data.lowStockProducts
import dev.hasino.tokojojo.stock.data.stockAt
import dev.hasino.tokojojo.stock.data.stockStatus
import dev.hasino.tokojojo.stock.ui.StockUiState
import dev.hasino.tokojojo.stock.ui.components.ApprovalBanner
import dev.hasino.tokojojo.stock.ui.components.BannerTone
import dev.hasino.tokojojo.stock.ui.components.EmptyState
import dev.hasino.tokojojo.stock.ui.components.ErrorState
import dev.hasino.tokojojo.stock.ui.components.InfoBanner
import dev.hasino.tokojojo.stock.ui.components.ProductAvatar
import dev.hasino.tokojojo.stock.ui.components.SectionHeader
import dev.hasino.tokojojo.stock.ui.components.SkeletonBlock
import dev.hasino.tokojojo.stock.ui.components.StatCard
import dev.hasino.tokojojo.stock.ui.components.StatusBadge
import dev.hasino.tokojojo.stock.ui.components.TokoCard
import dev.hasino.tokojojo.stock.ui.icons.TokoIcons
import dev.hasino.tokojojo.stock.ui.theme.Dimens
import dev.hasino.tokojojo.stock.ui.theme.LocalTokoColors
import dev.hasino.tokojojo.stock.ui.theme.PlusJakarta

@Composable
fun BerandaScreen(
    state: StockUiState,
    onReceive: () -> Unit,
    onAdjust: (String?) -> Unit,
    onOpenStock: () -> Unit,
    onProduct: (String) -> Unit,
    onRefresh: () -> Unit,
) {
    val colors = LocalTokoColors.current
    val lowStock = lowStockProducts(state.products)
    val priority = lowStock.take(3)
    val stockValue = inventoryValue(state.products)

    if (state.loading && state.products.isEmpty()) {
        BerandaSkeleton()
        return
    }
    if (state.error != null && state.products.isEmpty()) {
        ErrorState(message = state.error, onRetry = onRefresh)
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        if (state.connection != ConnectionState.ONLINE) {
            item {
                InfoBanner(
                    title = "Koneksi terputus",
                    body = "Data mungkin tertinggal. Tarik ke bawah untuk mencoba lagi.",
                    tone = if (state.connection == ConnectionState.ERROR) BannerTone.DANGER else BannerTone.WARNING,
                    actionLabel = "Coba lagi",
                    onAction = onRefresh,
                )
            }
        }

        item {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        text = "Ringkasan hari ini",
                        color = colors.ink,
                        fontFamily = PlusJakarta,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "Diperbarui ${state.lastSync}",
                            color = colors.inkMuted,
                            fontFamily = PlusJakarta,
                            fontSize = 10.sp,
                        )
                        IconButton(onClick = onRefresh, modifier = Modifier.size(32.dp)) {
                            Icon(
                                TokoIcons.Rounded.Refresh,
                                contentDescription = "Muat ulang",
                                tint = colors.inkMuted,
                                modifier = Modifier.size(18.dp),
                            )
                        }
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatCard(
                        label = "Penjualan hari ini",
                        value =
                            dev.hasino.tokojojo.stock.data
                                .formatCompactRupiah(state.todaySales),
                        hint = "${state.todayTransactions} transaksi",
                        accent = colors.ink,
                        modifier = Modifier.weight(1f).padding(top = 8.dp),
                    )
                    StatCard(
                        label = "Stok menipis",
                        value = "${lowStock.size} SKU",
                        hint = "${lowStock.count { it.warehouseStock <= it.minWarehouse }} di gudang",
                        accent = colors.warning,
                        modifier = Modifier.weight(1f).padding(top = 8.dp),
                    )
                }
                StatCard(
                    label = "Nilai stok",
                    value =
                        dev.hasino.tokojojo.stock.data
                            .formatCompactRupiah(stockValue),
                    hint = "Gudang + area toko",
                    accent = colors.primary,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        }

        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SectionHeader("Aksi cepat")
                QuickAction(
                    icon = TokoIcons.Rounded.LocalShipping,
                    title = "Terima",
                    subtitle = "Barang masuk",
                    onClick = onReceive,
                )
                QuickAction(
                    icon = TokoIcons.Rounded.Edit,
                    title = "Sesuaikan",
                    subtitle = "Opname / koreksi",
                    onClick = { onAdjust(null) },
                )
                QuickAction(
                    icon = TokoIcons.Rounded.Search,
                    title = "Cari stok",
                    subtitle = "Nama, SKU, barcode",
                    onClick = onOpenStock,
                )
            }
        }

        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SectionHeader(title = "Stok prioritas", actionLabel = "Lihat semua", onAction = onOpenStock)
                if (priority.isEmpty()) {
                    TokoCard { EmptyState(title = "Stok aman", body = "Tidak ada produk di bawah threshold.") }
                } else {
                    TokoCard {
                        Column {
                            priority.forEachIndexed { index, product ->
                                PriorityRow(product = product, onClick = { onProduct(product.id) })
                                if (index != priority.lastIndex) {
                                    Box(
                                        modifier =
                                            Modifier
                                                .fillMaxWidth()
                                                .padding(horizontal = 12.dp)
                                                .size(1.dp)
                                                .background(colors.line),
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        item { ApprovalBanner(count = state.adjustments.count { it.status == "PENDING_REVIEW" }) }

        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SectionHeader("Penerimaan terbaru")
                TokoCard {
                    Column {
                        state.receipts.take(2).forEachIndexed { index, receipt ->
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp),
                            ) {
                                Box(
                                    modifier = Modifier.size(34.dp).background(colors.primarySoft, RoundedCornerShape(Dimens.radiusSm)),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Icon(
                                        TokoIcons.Rounded.LocalShipping,
                                        contentDescription = null,
                                        tint = colors.primary,
                                        modifier = Modifier.size(18.dp),
                                    )
                                }
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = receipt.number,
                                        color = colors.ink,
                                        fontFamily = dev.hasino.tokojojo.stock.ui.theme.IbmPlexMono,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Medium,
                                    )
                                    Text(
                                        text = "${receipt.supplierName} · ${receipt.time}",
                                        color = colors.inkMuted,
                                        fontFamily = PlusJakarta,
                                        fontSize = 11.sp,
                                    )
                                }
                                Text(
                                    text = formatRupiah(receipt.total),
                                    color = colors.ink,
                                    fontFamily = PlusJakarta,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                )
                            }
                            if (index != state.receipts.take(2).lastIndex) {
                                Box(
                                    modifier =
                                        Modifier
                                            .fillMaxWidth()
                                            .padding(horizontal = 12.dp)
                                            .size(1.dp)
                                            .background(colors.line),
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun QuickAction(
    icon: ImageVector,
    title: String,
    subtitle: String,
    onClick: () -> Unit,
) {
    val colors = LocalTokoColors.current
    TokoCard(onClick = onClick) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Box(
                modifier = Modifier.size(36.dp).background(colors.primarySoft, RoundedCornerShape(Dimens.radiusSm)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(icon, contentDescription = null, tint = colors.primary, modifier = Modifier.size(20.dp))
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(title, color = colors.ink, fontFamily = PlusJakarta, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                Text(subtitle, color = colors.inkMuted, fontFamily = PlusJakarta, fontSize = 12.sp)
            }
            Icon(TokoIcons.Rounded.ChevronRight, contentDescription = null, tint = colors.inkMuted, modifier = Modifier.size(20.dp))
        }
    }
}

@Composable
private fun PriorityRow(
    product: Product,
    onClick: () -> Unit,
) {
    val colors = LocalTokoColors.current
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        ProductAvatar(product.name)
        Column(modifier = Modifier.weight(1f)) {
            Text(
                product.name,
                color = colors.ink,
                fontFamily = PlusJakarta,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
            )
            Text(
                "Gudang ${stockAt(product, Location.WAREHOUSE)} · Toko ${stockAt(product, Location.STORE)}",
                color = colors.inkMuted,
                fontFamily = PlusJakarta,
                fontSize = 11.sp,
            )
        }
        StatusBadge(stockStatus(product))
    }
}

@Composable
private fun BerandaSkeleton() {
    val colors = LocalTokoColors.current
    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SkeletonBlock(height = 70.dp)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            SkeletonBlock(height = 92.dp, modifier = Modifier.weight(1f))
            SkeletonBlock(height = 92.dp, modifier = Modifier.weight(1f))
        }
        SkeletonBlock(height = 92.dp)
        repeat(3) { SkeletonBlock(height = 56.dp) }
    }
}
