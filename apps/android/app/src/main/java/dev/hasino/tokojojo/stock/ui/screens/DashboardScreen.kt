package dev.hasino.tokojojo.stock.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.AddCircle
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.hasino.tokojojo.stock.data.Product
import dev.hasino.tokojojo.stock.data.StockStatus
import dev.hasino.tokojojo.stock.data.stockStatus
import dev.hasino.tokojojo.stock.ui.StockUiState
import dev.hasino.tokojojo.stock.ui.components.EmptyState
import dev.hasino.tokojojo.stock.ui.components.ErrorState
import dev.hasino.tokojojo.stock.ui.components.InfoBanner
import dev.hasino.tokojojo.stock.ui.components.InfoPill
import dev.hasino.tokojojo.stock.ui.components.LoadingState
import dev.hasino.tokojojo.stock.ui.components.MetricCard
import dev.hasino.tokojojo.stock.ui.components.ProductAvatar
import dev.hasino.tokojojo.stock.ui.components.SectionTitle
import dev.hasino.tokojojo.stock.ui.components.StatusPill
import dev.hasino.tokojojo.stock.ui.theme.Amber
import dev.hasino.tokojojo.stock.ui.theme.AmberSoft
import dev.hasino.tokojojo.stock.ui.theme.BlueSoft
import dev.hasino.tokojojo.stock.ui.theme.Canvas
import dev.hasino.tokojojo.stock.ui.theme.Danger
import dev.hasino.tokojojo.stock.ui.theme.DangerSoft
import dev.hasino.tokojojo.stock.ui.theme.Faint
import dev.hasino.tokojojo.stock.ui.theme.Ink
import dev.hasino.tokojojo.stock.ui.theme.Line
import dev.hasino.tokojojo.stock.ui.theme.Muted
import dev.hasino.tokojojo.stock.ui.theme.Royal
import dev.hasino.tokojojo.stock.ui.theme.Success
import dev.hasino.tokojojo.stock.ui.theme.SuccessSoft
import dev.hasino.tokojojo.stock.ui.theme.White

@Composable
fun DashboardScreen(
    state: StockUiState,
    onRetry: () -> Unit,
    onReceive: () -> Unit,
    onAdjust: (String?) -> Unit,
    onOpenStock: () -> Unit,
) {
    if (state.isLoading && state.products.isEmpty()) {
        LoadingState()
        return
    }
    if (state.error != null && state.products.isEmpty()) {
        ErrorState(message = state.error, onRetry = onRetry)
        return
    }

    val lowStock = state.products.filter { stockStatus(it) != StockStatus.AMAN }
    val priority =
        lowStock
            .filter { it.warehouseStock > 0 && it.storeStock <= it.minStoreStock }
            .take(4)

    LazyColumn(
        modifier = Modifier.fillMaxWidth(),
        contentPadding = PaddingValues(start = 14.dp, end = 14.dp, top = 14.dp, bottom = 96.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        if (lowStock.isNotEmpty()) {
            item {
                InfoBanner(
                    text = "${lowStock.size} produk stok menipis — prioritas mutasi ke rak depan (STORE-FRONT).",
                )
            }
        }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                MetricCard(
                    label = "Stok Menipis",
                    value = lowStock.size.toString(),
                    supporting = "dari ${state.products.size} SKU aktif",
                    accent = Amber,
                    modifier = Modifier.weight(1f),
                )
                MetricCard(
                    label = "Mutasi Pending",
                    value = "0",
                    supporting = "menunggu serah terima",
                    accent = Royal,
                    modifier = Modifier.weight(1f),
                )
            }
        }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                MetricCard(
                    label = "Diterima Hari Ini",
                    value = state.receipts.size.toString(),
                    supporting = "dokumen penerimaan",
                    accent = Success,
                    modifier = Modifier.weight(1f),
                )
                MetricCard(
                    label = "Pengajuan Stok",
                    value = state.adjustments.size.toString(),
                    supporting = "${state.adjustments.count { it.status == "PENDING_REVIEW" }} menunggu review",
                    accent = Ink,
                    modifier = Modifier.weight(1f),
                )
            }
        }

        item { SectionTitle("Aksi Cepat") }
        item {
            QuickAction(
                icon = Icons.Filled.AddCircle,
                iconColor = Success,
                iconBackground = SuccessSoft,
                title = "Terima Barang Supplier",
                subtitle = "Scan barcode → qty → simpan ke WH-BACK",
                onClick = onReceive,
            )
        }
        item {
            QuickAction(
                icon = Icons.Filled.Edit,
                iconColor = Royal,
                iconBackground = BlueSoft,
                title = "Sesuaikan Stok",
                subtitle = "Catat selisih fisik untuk approval OWNER/ADMIN",
                onClick = { onAdjust(null) },
            )
        }
        item {
            QuickAction(
                icon = Icons.Filled.Search,
                iconColor = Amber,
                iconBackground = AmberSoft,
                title = "Cari Produk",
                subtitle = "Cek stok gudang dan rak toko",
                onClick = onOpenStock,
            )
        }

        item { SectionTitle("Prioritas Mutasi (rak depan menipis)") }
        if (priority.isEmpty()) {
            item {
                EmptyState(
                    title = "Tidak ada prioritas mutasi",
                    description = "Stok rak depan masih di atas ambang minimum.",
                )
            }
        } else {
            items(priority, key = { it.id }) { product ->
                PriorityRow(product = product, onAdjust = { onAdjust(product.id) })
            }
        }

        if (state.receipts.isNotEmpty()) {
            item { SectionTitle("Penerimaan Terakhir") }
            items(state.receipts.take(3), key = { it.number }) { receipt ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    border = BorderStroke(1.dp, Line),
                    colors = CardDefaults.cardColors(containerColor = White),
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Box(
                            modifier =
                                Modifier
                                    .size(40.dp)
                                    .background(if (receipt.queued) AmberSoft else SuccessSoft, RoundedCornerShape(11.dp)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                Icons.Filled.AddCircle,
                                contentDescription = null,
                                tint = if (receipt.queued) Amber else Success,
                                modifier = Modifier.size(20.dp),
                            )
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                receipt.number,
                                color = Ink,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                            )
                            Text(
                                "${receipt.supplierName} • ${receipt.createdAt}",
                                color = Faint,
                                fontSize = 10.5.sp,
                            )
                        }
                        InfoPill(
                            text = if (receipt.queued) "ANTRE" else "TERKIRIM",
                            background = if (receipt.queued) AmberSoft else SuccessSoft,
                            foreground = if (receipt.queued) Amber else Success,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun QuickAction(
    icon: ImageVector,
    iconColor: Color,
    iconBackground: Color,
    title: String,
    subtitle: String,
    onClick: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, Line),
        colors = CardDefaults.cardColors(containerColor = White),
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(42.dp)
                        .background(iconBackground, RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(icon, contentDescription = null, tint = iconColor, modifier = Modifier.size(20.dp))
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(title, color = Ink, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                Text(subtitle, color = Muted, fontSize = 11.sp)
            }
            Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null, tint = Faint, modifier = Modifier.size(18.dp))
        }
    }
}

@Composable
private fun PriorityRow(
    product: Product,
    onAdjust: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, Line),
        colors = CardDefaults.cardColors(containerColor = White),
    ) {
        Row(
            modifier = Modifier.padding(13.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            ProductAvatar(product)
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    product.name,
                    color = Ink,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                )
                Text(
                    "WH-BACK ${product.warehouseStock} • SF ${product.storeStock} ${product.unit}",
                    color = Faint,
                    fontSize = 10.5.sp,
                )
            }
            Button(
                onClick = onAdjust,
                shape = RoundedCornerShape(9.dp),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                colors = ButtonDefaults.buttonColors(containerColor = BlueSoft, contentColor = Royal),
                elevation = null,
            ) {
                Text("Sesuaikan", fontSize = 10.5.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}
