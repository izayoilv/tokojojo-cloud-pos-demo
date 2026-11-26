package dev.hasino.tokojojo.stock.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.hasino.tokojojo.stock.data.Location
import dev.hasino.tokojojo.stock.data.Product
import dev.hasino.tokojojo.stock.data.StockMovement
import dev.hasino.tokojojo.stock.data.StockStatus
import dev.hasino.tokojojo.stock.data.formatRupiah
import dev.hasino.tokojojo.stock.data.stockAt
import dev.hasino.tokojojo.stock.data.stockStatus
import dev.hasino.tokojojo.stock.data.totalStock
import dev.hasino.tokojojo.stock.ui.components.EmptyState
import dev.hasino.tokojojo.stock.ui.components.InfoBanner
import dev.hasino.tokojojo.stock.ui.components.MovementRow
import dev.hasino.tokojojo.stock.ui.components.PrimaryButton
import dev.hasino.tokojojo.stock.ui.components.ProductAvatar
import dev.hasino.tokojojo.stock.ui.components.SecondaryButton
import dev.hasino.tokojojo.stock.ui.components.StatusBadge
import dev.hasino.tokojojo.stock.ui.components.TokoCard
import dev.hasino.tokojojo.stock.ui.icons.TokoIcons
import dev.hasino.tokojojo.stock.ui.theme.IbmPlexMono
import dev.hasino.tokojojo.stock.ui.theme.LocalTokoColors
import dev.hasino.tokojojo.stock.ui.theme.PlusJakarta

@Composable
fun StockDetailScreen(
    product: Product?,
    movements: List<StockMovement>,
    onReceive: () -> Unit,
    onAdjust: (String) -> Unit,
) {
    val colors = LocalTokoColors.current
    if (product == null) {
        EmptyState(
            title = "Produk tidak ditemukan",
            body = "Produk mungkin sudah berubah. Kembali ke daftar stok.",
        )
        return
    }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (stockStatus(product) != StockStatus.AMAN) {
            InfoBanner(
                title = if (stockStatus(product) == StockStatus.HABIS) "Stok habis" else "Stok di bawah minimum",
                body = "Dasar: ${product.baseUnit.name}. Periksa area toko dan gudang sebelum melakukan penerimaan.",
                tone =
                    if (stockStatus(product) ==
                        StockStatus.HABIS
                    ) {
                        dev.hasino.tokojojo.stock.ui.components.BannerTone.DANGER
                    } else {
                        dev.hasino.tokojojo.stock.ui.components.BannerTone.WARNING
                    },
            )
        }

        TokoCard {
            Column(modifier = Modifier.padding(14.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    ProductAvatar(product.name)
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            product.name,
                            color = colors.ink,
                            fontFamily = PlusJakarta,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            "${product.category} · ${product.units.size} satuan",
                            color = colors.inkMuted,
                            fontFamily = PlusJakarta,
                            fontSize = 12.sp,
                        )
                    }
                    StatusBadge(stockStatus(product))
                }
                Text(
                    text = product.sku,
                    color = colors.inkSecondary,
                    fontFamily = IbmPlexMono,
                    fontSize = 11.sp,
                    modifier = Modifier.padding(top = 12.dp),
                )
                Text(
                    text = product.barcode,
                    color = colors.inkMuted,
                    fontFamily = IbmPlexMono,
                    fontSize = 10.sp,
                )
                Row(modifier = Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("HPP ${formatRupiah(product.cost)}", color = colors.inkMuted, fontFamily = PlusJakarta, fontSize = 11.sp)
                    Text("Jual ${formatRupiah(product.price)}", color = colors.inkMuted, fontFamily = PlusJakarta, fontSize = 11.sp)
                }
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            LocationCard(
                label = "Gudang Belakang",
                quantity = stockAt(product, Location.WAREHOUSE),
                unit = product.baseUnit.name,
                minimum = product.minWarehouse,
                modifier = Modifier.weight(1f),
            )
            LocationCard(
                label = "Area Toko",
                quantity = stockAt(product, Location.STORE),
                unit = product.baseUnit.name,
                minimum = product.minStore,
                modifier = Modifier.weight(1f),
            )
        }

        TokoCard {
            Row(modifier = Modifier.padding(14.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Total fisik", color = colors.inkMuted, fontFamily = PlusJakarta, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    Text(
                        "${totalStock(product)} ${product.baseUnit.name}",
                        color = colors.ink,
                        fontFamily = PlusJakarta,
                        fontSize = 19.sp,
                        fontWeight = FontWeight.ExtraBold,
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        "Nilai persediaan",
                        color = colors.inkMuted,
                        fontFamily = PlusJakarta,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        formatRupiah(totalStock(product).toLong() * product.cost),
                        color = colors.primary,
                        fontFamily = PlusJakarta,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.ExtraBold,
                    )
                }
            }
        }

        Text("Pergerakan terbaru", color = colors.ink, fontFamily = PlusJakarta, fontSize = 15.sp, fontWeight = FontWeight.Bold)
        TokoCard {
            if (movements.isEmpty()) {
                EmptyState(
                    title = "Belum ada pergerakan stok",
                    body = "Pergerakan akan muncul setelah ada penerimaan atau mutasi.",
                    modifier = Modifier.padding(vertical = 10.dp),
                )
            } else {
                Column {
                    movements.take(3).forEachIndexed { index, movement ->
                        MovementRow(
                            time = movement.time,
                            type = movement.type,
                            location = movement.location,
                            quantity = movement.quantity,
                            reference = movement.reference,
                        )
                        if (index != movements.take(3).lastIndex) {
                            Box(
                                modifier =
                                    Modifier
                                        .fillMaxWidth()
                                        .padding(horizontal = 12.dp)
                                        .height(1.dp)
                                        .background(colors.line),
                            )
                        }
                    }
                }
            }
        }

        Text(
            "Android tidak mengubah stok langsung. Penerimaan masuk ke ledger; penyesuaian menunggu approval OWNER/ADMIN.",
            color = colors.inkMuted,
            fontFamily = PlusJakarta,
            fontSize = 11.sp,
            lineHeight = 16.sp,
        )

        PrimaryButton(text = "Sesuaikan Stok", onClick = { onAdjust(product.id) })
        SecondaryButton(text = "Terima Barang", onClick = onReceive)
    }
}

@Composable
private fun LocationCard(
    label: String,
    quantity: Int,
    unit: String,
    minimum: Int,
    modifier: Modifier = Modifier,
) {
    val colors = LocalTokoColors.current
    TokoCard(modifier = modifier) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                label.uppercase(),
                color = colors.inkMuted,
                fontFamily = PlusJakarta,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp,
            )
            Text(
                "$quantity",
                color = colors.ink,
                fontFamily = PlusJakarta,
                fontSize = 26.sp,
                fontWeight = FontWeight.ExtraBold,
            )
            Text("$unit · min $minimum", color = colors.inkMuted, fontFamily = PlusJakarta, fontSize = 10.sp)
        }
    }
}
