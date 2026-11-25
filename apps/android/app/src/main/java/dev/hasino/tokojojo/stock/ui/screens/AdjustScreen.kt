package dev.hasino.tokojojo.stock.ui.screens

import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.hasino.tokojojo.stock.data.Adjustment
import dev.hasino.tokojojo.stock.data.Location
import dev.hasino.tokojojo.stock.data.Product
import dev.hasino.tokojojo.stock.data.adjustmentValue
import dev.hasino.tokojojo.stock.data.formatRupiah
import dev.hasino.tokojojo.stock.data.stockAt
import dev.hasino.tokojojo.stock.data.stockVariance
import dev.hasino.tokojojo.stock.ui.StockUiState
import dev.hasino.tokojojo.stock.ui.components.BannerTone
import dev.hasino.tokojojo.stock.ui.components.EmptyState
import dev.hasino.tokojojo.stock.ui.components.FieldLabel
import dev.hasino.tokojojo.stock.ui.components.InfoBanner
import dev.hasino.tokojojo.stock.ui.components.PrimaryButton
import dev.hasino.tokojojo.stock.ui.components.ProductAvatar
import dev.hasino.tokojojo.stock.ui.components.SectionHeader
import dev.hasino.tokojojo.stock.ui.components.SegmentedControl
import dev.hasino.tokojojo.stock.ui.components.TokoCard
import dev.hasino.tokojojo.stock.ui.components.tokoFieldColors
import dev.hasino.tokojojo.stock.ui.icons.TokoIcons
import dev.hasino.tokojojo.stock.ui.theme.Dimens
import dev.hasino.tokojojo.stock.ui.theme.IbmPlexMono
import dev.hasino.tokojojo.stock.ui.theme.LocalTokoColors
import dev.hasino.tokojojo.stock.ui.theme.PlusJakarta

@Composable
fun AdjustScreen(
    state: StockUiState,
    initialProductId: String?,
    onSubmit: (productId: String, location: Location, physicalQty: Int, reason: String) -> Unit,
) {
    val colors = LocalTokoColors.current
    var productId by remember { mutableStateOf(initialProductId) }
    var location by remember { mutableStateOf(Location.STORE) }
    var physicalText by remember { mutableStateOf("") }
    var reason by remember { mutableStateOf("") }
    var scannerOpen by remember { mutableStateOf(false) }
    var productMenu by remember { mutableStateOf(false) }

    val product = state.products.firstOrNull { it.id == productId }
    val systemQty = product?.let { stockAt(it, location) } ?: 0
    val physicalQty = physicalText.toIntOrNull()
    val variance = physicalQty?.let { stockVariance(systemQty, it) }

    LaunchedEffect(productId, location) {
        if (product != null) physicalText = stockAt(product, location).toString()
    }

    if (scannerOpen) {
        ScannerDialog(
            products = state.products,
            onDismiss = { scannerOpen = false },
            onProductPicked = {
                productId = it.id
                scannerOpen = false
            },
        )
    }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        InfoBanner(
            title = "Sesuaikan stok",
            body = "Ajukan selisih untuk persetujuan OWNER/ADMIN. Stok tidak berubah sebelum disetujui.",
            tone = BannerTone.INFO,
        )

        FieldLabel("Lokasi")
        SegmentedControl(
            options = listOf(Location.WAREHOUSE to "Gudang", Location.STORE to "Area Toko"),
            selected = location,
            onSelect = { location = it },
        )

        SectionHeader(title = "Produk", actionLabel = "Scan", onAction = { scannerOpen = true })
        if (product == null) {
            TokoCard {
                EmptyState(
                    title = "Belum ada produk",
                    body = "Scan barcode atau pilih produk dari daftar.",
                )
            }
        } else {
            TokoCard {
                Row(
                    modifier = Modifier.padding(12.dp),
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
                            fontWeight = FontWeight.Bold,
                            maxLines = 2,
                        )
                        Text(
                            "${product.sku} · ${product.baseUnit.name}",
                            color = colors.inkMuted,
                            fontFamily = IbmPlexMono,
                            fontSize = 10.sp,
                        )
                    }
                }
            }
        }
        Box {
            OutlinedButton(
                onClick = { productMenu = true },
                modifier = Modifier.fillMaxWidth().height(Dimens.controlHeight),
                shape = RoundedCornerShape(Dimens.radiusSm),
                border = BorderStroke(1.dp, colors.lineControl),
                colors = ButtonDefaults.outlinedButtonColors(containerColor = colors.surface, contentColor = colors.inkSecondary),
            ) {
                Text("Pilih produk dari daftar", modifier = Modifier.weight(1f), fontFamily = PlusJakarta, fontSize = 13.sp)
                Icon(TokoIcons.Rounded.ArrowDropDown, contentDescription = null, tint = colors.inkMuted)
            }
            DropdownMenu(expanded = productMenu, onDismissRequest = { productMenu = false }) {
                state.products.forEach { item ->
                    DropdownMenuItem(
                        text = { Text(item.name, fontFamily = PlusJakarta, fontSize = 13.sp) },
                        onClick = {
                            productId = item.id
                            productMenu = false
                        },
                    )
                }
            }
        }

        SectionHeader("Hitung fisik")
        TokoCard {
            Column(modifier = Modifier.padding(14.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Column {
                        Text(
                            "Stok sistem",
                            color = colors.inkMuted,
                            fontFamily = PlusJakarta,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            text = "$systemQty ${product?.baseUnit?.name.orEmpty()}",
                            color = if (systemQty < 0) colors.danger else colors.ink,
                            fontFamily = PlusJakarta,
                            fontSize = 22.sp,
                            fontWeight = FontWeight.ExtraBold,
                        )
                        if (systemQty < 0) {
                            Text(
                                "Stok sistem negatif — jangan di-clamp.",
                                color = colors.danger,
                                fontFamily = PlusJakarta,
                                fontSize = 10.sp,
                            )
                        }
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("Selisih", color = colors.inkMuted, fontFamily = PlusJakarta, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        Text(
                            text = variance?.let { if (it > 0) "+$it" else it.toString() } ?: "—",
                            color =
                                when {
                                    variance == null || variance == 0 -> colors.inkMuted
                                    variance > 0 -> colors.success
                                    else -> colors.danger
                                },
                            fontFamily = PlusJakarta,
                            fontSize = 22.sp,
                            fontWeight = FontWeight.ExtraBold,
                        )
                    }
                }

                FieldLabel("Stok fisik")
                OutlinedTextField(
                    value = physicalText,
                    onValueChange = { physicalText = it.filter { char -> char.isDigit() || char == '-' } },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    enabled = product != null,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    shape = RoundedCornerShape(Dimens.radiusSm),
                    colors = tokoFieldColors(),
                )

                if (variance != null && product != null) {
                    Row(modifier = Modifier.fillMaxWidth().padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        dev.hasino.tokojojo.stock.ui.components.TextBadge(
                            label =
                                when {
                                    variance == 0 -> "SESUAI"
                                    variance > 0 -> "LEBIH $variance"
                                    else -> "KURANG ${-variance}"
                                },
                            foreground =
                                when {
                                    variance == 0 -> colors.success
                                    variance > 0 -> colors.info
                                    else -> colors.danger
                                },
                            background =
                                when {
                                    variance == 0 -> colors.successSoft
                                    variance > 0 -> colors.infoSoft
                                    else -> colors.dangerSoft
                                },
                        )
                        dev.hasino.tokojojo.stock.ui.components.TextBadge(
                            label = "Nilai ${formatRupiah(adjustmentValue(variance, product.cost))}",
                            foreground = colors.inkSecondary,
                            background = colors.subtle,
                        )
                    }
                }
            }
        }

        FieldLabel("Alasan penyesuaian", required = true)
        OutlinedTextField(
            value = reason,
            onValueChange = { reason = it },
            modifier = Modifier.fillMaxWidth(),
            minLines = 2,
            placeholder = { Text("cth: kemasan sobek, salah hitung, barang rusak...", fontSize = 13.sp) },
            shape = RoundedCornerShape(Dimens.radiusSm),
            colors = tokoFieldColors(),
        )

        PrimaryButton(
            text = "Kirim untuk persetujuan",
            onClick = { product?.let { onSubmit(it.id, location, physicalQty ?: 0, reason) } },
            enabled = product != null && physicalQty != null && physicalQty >= 0,
        )
        Text(
            text = "Android tidak mengubah stok langsung. Approval dilakukan di Admin Web → Gudang.",
            color = colors.inkMuted,
            fontFamily = PlusJakarta,
            fontSize = 11.sp,
            lineHeight = 16.sp,
        )

        if (state.adjustments.isNotEmpty()) {
            SectionHeader("Pengajuan terakhir")
            state.adjustments.take(3).forEach { adjustment ->
                AdjustmentRow(adjustment)
            }
        }
    }
}

@Composable
private fun AdjustmentRow(adjustment: Adjustment) {
    val colors = LocalTokoColors.current
    TokoCard {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Box(
                modifier = Modifier.size(34.dp).background(colors.warningSoft, RoundedCornerShape(Dimens.radiusSm)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(TokoIcons.Rounded.Edit, contentDescription = null, tint = colors.warning, modifier = Modifier.size(18.dp))
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    adjustment.productName,
                    color = colors.ink,
                    fontFamily = PlusJakarta,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                )
                Text(
                    "${adjustment.location.label} · ${adjustment.time}",
                    color = colors.inkMuted,
                    fontFamily = PlusJakarta,
                    fontSize = 10.sp,
                )
            }
            dev.hasino.tokojojo.stock.ui.components.TextBadge(
                label = "PENDING",
                foreground = colors.warning,
                background = colors.warningSoft,
            )
        }
    }
}
