package dev.hasino.tokojojo.stock.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.hasino.tokojojo.stock.data.Product
import dev.hasino.tokojojo.stock.data.formatRupiah
import dev.hasino.tokojojo.stock.data.stockStatus
import dev.hasino.tokojojo.stock.data.totalStock
import dev.hasino.tokojojo.stock.ui.components.EmptyState
import dev.hasino.tokojojo.stock.ui.components.InfoPill
import dev.hasino.tokojojo.stock.ui.components.PrimaryActionButton
import dev.hasino.tokojojo.stock.ui.components.ProductAvatar
import dev.hasino.tokojojo.stock.ui.components.SecondaryActionButton
import dev.hasino.tokojojo.stock.ui.components.SectionTitle
import dev.hasino.tokojojo.stock.ui.components.StatusPill
import dev.hasino.tokojojo.stock.ui.theme.BlueSoft
import dev.hasino.tokojojo.stock.ui.theme.Canvas
import dev.hasino.tokojojo.stock.ui.theme.Faint
import dev.hasino.tokojojo.stock.ui.theme.Ink
import dev.hasino.tokojojo.stock.ui.theme.Line
import dev.hasino.tokojojo.stock.ui.theme.Muted
import dev.hasino.tokojojo.stock.ui.theme.Royal
import dev.hasino.tokojojo.stock.ui.theme.White

@Composable
fun StockDetailScreen(
    product: Product?,
    onReceive: () -> Unit,
    onAdjust: (String) -> Unit,
) {
    if (product == null) {
        EmptyState(
            title = "Produk tidak ditemukan",
            description = "Produk mungkin sudah berubah. Kembali ke daftar stok.",
        )
        return
    }

    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
            border = BorderStroke(1.dp, Line),
            colors = CardDefaults.cardColors(containerColor = White),
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    ProductAvatar(product)
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            product.name,
                            color = Ink,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.ExtraBold,
                        )
                        Text(
                            "${product.brand} • per ${product.unit}",
                            color = Muted,
                            fontSize = 11.sp,
                        )
                    }
                    StatusPill(stockStatus(product))
                }
                Text(
                    text = product.sku,
                    color = Muted,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    modifier = Modifier.padding(top = 12.dp),
                )
                Text(
                    text = product.barcode,
                    color = Faint,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.5.sp,
                )
                Row(
                    modifier = Modifier.padding(top = 10.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    InfoPill(product.category, BlueSoft, Royal)
                    InfoPill(product.unit, Canvas, Muted)
                }
            }
        }

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
            border = BorderStroke(1.dp, Line),
            colors = CardDefaults.cardColors(containerColor = White),
        ) {
            Row(modifier = Modifier.padding(16.dp)) {
                DetailMetric(
                    label = "HPP",
                    value = formatRupiah(product.cost),
                    modifier = Modifier.weight(1f),
                )
                DetailMetric(
                    label = "Harga Jual",
                    value = formatRupiah(product.price),
                    modifier = Modifier.weight(1f),
                    highlight = true,
                )
                DetailMetric(
                    label = "Margin",
                    value = formatRupiah(product.price - product.cost),
                    modifier = Modifier.weight(1f),
                )
            }
        }

        SectionTitle("Stok per Lokasi")
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            LocationCard(
                label = "WH-BACK",
                value = product.warehouseStock,
                supporting = "min. total ${product.minStock}",
                modifier = Modifier.weight(1f),
            )
            LocationCard(
                label = "STORE-FRONT",
                value = product.storeStock,
                supporting = "min. rak ${product.minStoreStock}",
                modifier = Modifier.weight(1f),
            )
        }

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
            border = BorderStroke(1.dp, Line),
            colors = CardDefaults.cardColors(containerColor = White),
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                DetailMetric(
                    label = "Total Fisik",
                    value = "${totalStock(product)} ${product.unit}",
                    modifier = Modifier.weight(1f),
                )
                DetailMetric(
                    label = "Nilai Persediaan",
                    value = formatRupiah(totalStock(product).toLong() * product.cost),
                    modifier = Modifier.weight(1f),
                    highlight = true,
                )
            }
        }

        Text(
            text =
                "Perubahan stok hanya melalui penerimaan, mutasi, opname, atau penjualan. " +
                    "Penyesuaian dari aplikasi ini menunggu approval OWNER/ADMIN di Admin Web.",
            color = Faint,
            fontSize = 10.5.sp,
            modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp),
        )

        PrimaryActionButton(
            text = "Sesuaikan Stok",
            onClick = { onAdjust(product.id) },
            modifier = Modifier.padding(top = 4.dp),
        )
        SecondaryActionButton(
            text = "Terima Barang",
            onClick = onReceive,
        )
    }
}

@Composable
private fun DetailMetric(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    highlight: Boolean = false,
) {
    Column(modifier = modifier) {
        Text(label.uppercase(), color = Muted, fontSize = 9.5.sp, fontWeight = FontWeight.Bold)
        Text(
            text = value,
            color = if (highlight) Royal else Ink,
            fontSize = 13.sp,
            fontWeight = FontWeight.ExtraBold,
            modifier = Modifier.padding(top = 3.dp),
        )
    }
}

@Composable
private fun LocationCard(
    label: String,
    value: Int,
    supporting: String,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, Line),
        colors = CardDefaults.cardColors(containerColor = White),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(label, color = Muted, fontSize = 10.sp, fontWeight = FontWeight.Bold)
            Text(
                value.toString(),
                color = Ink,
                fontSize = 24.sp,
                fontWeight = FontWeight.ExtraBold,
                modifier = Modifier.padding(top = 4.dp),
            )
            Text(supporting, color = Faint, fontSize = 10.sp)
        }
    }
}
