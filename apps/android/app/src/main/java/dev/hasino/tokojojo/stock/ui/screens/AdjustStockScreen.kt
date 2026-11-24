package dev.hasino.tokojojo.stock.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.hasino.tokojojo.stock.data.Product
import dev.hasino.tokojojo.stock.data.StockLocation
import dev.hasino.tokojojo.stock.data.adjustmentValue
import dev.hasino.tokojojo.stock.data.formatRupiah
import dev.hasino.tokojojo.stock.data.stockAt
import dev.hasino.tokojojo.stock.data.stockVariance
import dev.hasino.tokojojo.stock.ui.StockUiState
import dev.hasino.tokojojo.stock.ui.components.EmptyState
import dev.hasino.tokojojo.stock.ui.components.FieldLabel
import dev.hasino.tokojojo.stock.ui.components.InfoPill
import dev.hasino.tokojojo.stock.ui.components.PrimaryActionButton
import dev.hasino.tokojojo.stock.ui.components.ProductAvatar
import dev.hasino.tokojojo.stock.ui.components.SecondaryActionButton
import dev.hasino.tokojojo.stock.ui.components.SectionTitle
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
fun AdjustStockScreen(
    state: StockUiState,
    initialProductId: String?,
    onSubmit: (productId: String, location: StockLocation, physicalQty: Int, reason: String) -> Unit,
) {
    var selectedId by remember { mutableStateOf(initialProductId) }
    var location by remember { mutableStateOf(StockLocation.STORE) }
    var physicalText by remember { mutableStateOf("") }
    var reason by remember { mutableStateOf("") }
    var scannerOpen by remember { mutableStateOf(false) }
    var productMenu by remember { mutableStateOf(false) }

    val product = state.products.firstOrNull { it.id == selectedId }
    val systemQty = product?.let { stockAt(it, location) } ?: 0
    val physicalQty = physicalText.toIntOrNull()
    val variance = physicalQty?.let { stockVariance(systemQty, it) }
    val valid = product != null && physicalQty != null && physicalQty >= 0 && variance != 0

    LaunchedEffect(selectedId, location) {
        if (product != null) {
            physicalText = stockAt(product, location).toString()
        }
    }

    if (scannerOpen) {
        ScannerDialog(
            products = state.products,
            onDismiss = { scannerOpen = false },
            onProductPicked = {
                selectedId = it.id
                scannerOpen = false
            },
        )
    }

    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(start = 14.dp, end = 14.dp, top = 14.dp, bottom = 96.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
            colors = CardDefaults.cardColors(containerColor = NavySoft),
        ) {
            Row(
                modifier = Modifier.padding(14.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Filled.Edit, contentDescription = null, tint = Royal)
                Text(
                    "Selisih dikirim sebagai pengajuan. Stok baru berubah setelah disetujui OWNER/ADMIN di Admin Web.",
                    color = Color(0xFF1E3A8A),
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }

        SectionTitle("Produk")
        if (product == null) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, Line),
                colors = CardDefaults.cardColors(containerColor = White),
            ) {
                EmptyState(
                    title = "Belum ada produk dipilih",
                    description = "Scan barcode atau pilih produk dari daftar.",
                    icon = Icons.Filled.Search,
                )
            }
        } else {
            ProductHeader(product)
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(9.dp),
        ) {
            Button(
                onClick = { scannerOpen = true },
                modifier = Modifier.weight(1f).height(46.dp),
                shape = RoundedCornerShape(11.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Royal),
            ) {
                Icon(Icons.Filled.Search, contentDescription = null, modifier = Modifier.width(15.dp))
                Text(" Scan", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
            Box(modifier = Modifier.weight(1f)) {
                OutlinedButton(
                    onClick = { productMenu = true },
                    modifier = Modifier.fillMaxWidth().height(46.dp),
                    shape = RoundedCornerShape(11.dp),
                    border = BorderStroke(1.5.dp, Line),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Muted),
                ) {
                    Text("Pilih Produk", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Icon(Icons.Filled.ArrowDropDown, contentDescription = null, modifier = Modifier.width(16.dp))
                }
                DropdownMenu(expanded = productMenu, onDismissRequest = { productMenu = false }) {
                    state.products.forEach { item ->
                        DropdownMenuItem(
                            text = { Text(item.name, fontSize = 12.sp) },
                            onClick = {
                                selectedId = item.id
                                productMenu = false
                            },
                        )
                    }
                }
            }
        }

        SectionTitle("Lokasi Hitung")
        Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
            StockLocation.entries.forEach { option ->
                val selected = location == option
                OutlinedButton(
                    onClick = { location = option },
                    modifier = Modifier.weight(1f).height(44.dp),
                    shape = RoundedCornerShape(11.dp),
                    border = BorderStroke(1.5.dp, if (selected) Royal else Line),
                    colors =
                        ButtonDefaults.outlinedButtonColors(
                            containerColor = if (selected) BlueSoft else White,
                            contentColor = if (selected) Royal else Muted,
                        ),
                ) {
                    Text(option.label, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        SectionTitle("Hitung Fisik")
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
            border = BorderStroke(1.dp, Line),
            colors = CardDefaults.cardColors(containerColor = White),
        ) {
            Column(modifier = Modifier.padding(14.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Column {
                        Text("Stok sistem", color = Muted, fontSize = 10.5.sp, fontWeight = FontWeight.Bold)
                        Text(
                            "$systemQty ${product?.unit.orEmpty()}",
                            color = Ink,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.ExtraBold,
                        )
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("Selisih", color = Muted, fontSize = 10.5.sp, fontWeight = FontWeight.Bold)
                        val varianceText =
                            when {
                                variance == null -> "-"
                                variance > 0 -> "+$variance"
                                else -> variance.toString()
                            }
                        Text(
                            varianceText,
                            color =
                                when {
                                    variance == null || variance == 0 -> Muted
                                    variance > 0 -> Success
                                    else -> Danger
                                },
                            fontSize = 20.sp,
                            fontWeight = FontWeight.ExtraBold,
                        )
                    }
                }

                FieldLabel("Jumlah fisik")
                OutlinedTextField(
                    value = physicalText,
                    onValueChange = { physicalText = it.filter(Char::isDigit) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    shape = RoundedCornerShape(11.dp),
                    enabled = product != null,
                    colors =
                        OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Royal,
                            unfocusedBorderColor = Line,
                        ),
                )

                if (variance != null && product != null) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        InfoPill(
                            text =
                                when {
                                    variance == 0 -> "SESUAI"
                                    variance > 0 -> "LEBIH $variance"
                                    else -> "KURANG ${-variance}"
                                },
                            background =
                                when {
                                    variance == 0 -> SuccessSoft
                                    variance > 0 -> BlueSoft
                                    else -> DangerSoft
                                },
                            foreground =
                                when {
                                    variance == 0 -> Success
                                    variance > 0 -> Royal
                                    else -> Danger
                                },
                        )
                        InfoPill(
                            text = "Nilai ${formatRupiah(adjustmentValue(variance, product.cost))}",
                            background = Canvas,
                            foreground = Muted,
                        )
                    }
                }
            }
        }

        SectionTitle("Alasan Penyesuaian")
        OutlinedTextField(
            value = reason,
            onValueChange = { reason = it },
            modifier = Modifier.fillMaxWidth(),
            minLines = 2,
            maxLines = 3,
            placeholder = { Text("cth: kemasan sobek, salah hitung, barang rusak...", fontSize = 12.sp) },
            shape = RoundedCornerShape(12.dp),
            colors =
                OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Royal,
                    unfocusedBorderColor = Line,
                    focusedContainerColor = White,
                    unfocusedContainerColor = White,
                ),
        )

        PrimaryActionButton(
            text = "Kirim untuk Approval",
            onClick = {
                if (product != null && physicalQty != null) {
                    onSubmit(product.id, location, physicalQty, reason)
                }
            },
            enabled = valid,
            loading = state.isSubmitting,
            modifier = Modifier.padding(top = 4.dp),
        )
        if (product != null && variance == 0) {
            Text(
                "Tidak ada selisih antara stok sistem dan fisik.",
                color = Amber,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }

        if (state.adjustments.isNotEmpty()) {
            SectionTitle("Pengajuan Terakhir")
            state.adjustments.take(4).forEach { adjustment ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, Line),
                    colors = CardDefaults.cardColors(containerColor = White),
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                adjustment.productName,
                                color = Ink,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                            )
                            Text(
                                "${adjustment.location.label} • ${adjustment.createdAt} • ${adjustment.reason}",
                                color = Faint,
                                fontSize = 10.sp,
                            )
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            val delta = adjustment.physicalQty - adjustment.systemQty
                            Text(
                                if (delta > 0) "+$delta" else delta.toString(),
                                color = if (delta < 0) Danger else Success,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.ExtraBold,
                            )
                            InfoPill("PENDING", AmberSoft, Amber)
                        }
                    }
                }
            }
        }

        SecondaryActionButton(
            text = "Reset Form",
            onClick = {
                selectedId = initialProductId
                physicalText = product?.let { stockAt(it, location).toString() } ?: ""
                reason = ""
            },
        )

        Text(
            text = "Aplikasi gudang tidak membuat penjualan dan tidak memiliki token offline.",
            color = Faint,
            fontSize = 10.5.sp,
            modifier = Modifier.padding(horizontal = 4.dp),
        )
    }
}

@Composable
private fun ProductHeader(product: Product) {
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
            ProductAvatar(product)
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    product.name,
                    color = Ink,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 2,
                )
                Text(
                    "${product.sku} • ${product.barcode}",
                    color = Faint,
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace,
                )
            }
            Text(
                product.unit,
                color = Muted,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

private val NavySoft = Color(0xFFEFF6FF)
