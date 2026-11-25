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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.ArrowDropDown
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.QrCodeScanner
import androidx.compose.material.icons.rounded.Save
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import dev.hasino.tokojojo.stock.data.Product
import dev.hasino.tokojojo.stock.data.ProductUnit
import dev.hasino.tokojojo.stock.data.ReceiveLine
import dev.hasino.tokojojo.stock.data.baseQuantity
import dev.hasino.tokojojo.stock.data.formatRupiah
import dev.hasino.tokojojo.stock.data.formatThousands
import dev.hasino.tokojojo.stock.data.lineSubtotal
import dev.hasino.tokojojo.stock.data.receiptTotal
import dev.hasino.tokojojo.stock.data.unitFor
import dev.hasino.tokojojo.stock.ui.StockUiState
import dev.hasino.tokojojo.stock.ui.components.BannerTone
import dev.hasino.tokojojo.stock.ui.components.EmptyState
import dev.hasino.tokojojo.stock.ui.components.FieldLabel
import dev.hasino.tokojojo.stock.ui.components.InfoBanner
import dev.hasino.tokojojo.stock.ui.components.PrimaryButton
import dev.hasino.tokojojo.stock.ui.components.ProductAvatar
import dev.hasino.tokojojo.stock.ui.components.SecondaryButton
import dev.hasino.tokojojo.stock.ui.components.SectionHeader
import dev.hasino.tokojojo.stock.ui.components.TokoCard
import dev.hasino.tokojojo.stock.ui.components.tokoFieldColors
import dev.hasino.tokojojo.stock.ui.theme.Dimens
import dev.hasino.tokojojo.stock.ui.theme.LocalTokoColors
import dev.hasino.tokojojo.stock.ui.theme.PlusJakarta

@Composable
fun ReceiveScreen(
    state: StockUiState,
    onSubmit: (supplierId: String, reference: String, notes: String, lines: List<ReceiveLine>) -> Unit,
) {
    val colors = LocalTokoColors.current
    var supplierId by remember {
        mutableStateOf(
            state.suppliers
                .firstOrNull()
                ?.id
                .orEmpty(),
        )
    }
    var supplierMenu by remember { mutableStateOf(false) }
    var scannerOpen by remember { mutableStateOf(false) }
    var lines by remember { mutableStateOf(emptyList<ReceiveLine>()) }
    var reference by remember { mutableStateOf("INV-SR-2026-1124") }
    var notes by remember { mutableStateOf("") }
    var unitMenuLine by remember { mutableStateOf<Int?>(null) }
    var draftSaved by remember { mutableStateOf(false) }
    var validation by remember { mutableStateOf<String?>(null) }
    var baselineReceipts by remember { mutableStateOf(state.receipts.size) }

    LaunchedEffect(state.receipts.size) {
        if (state.receipts.size > baselineReceipts) {
            lines = emptyList()
            reference = ""
            notes = ""
            draftSaved = false
            baselineReceipts = state.receipts.size
        }
    }

    fun addProduct(product: Product) {
        val existing = lines.indexOfFirst { it.productId == product.id }
        lines =
            if (existing >= 0) {
                lines.toMutableList().also { it[existing] = it[existing].copy(quantity = it[existing].quantity + 1) }
            } else {
                lines + ReceiveLine(product.id, product.baseUnit.id, 1, product.cost)
            }
        validation = null
    }

    if (scannerOpen) {
        ScannerDialog(
            products = state.products,
            onDismiss = { scannerOpen = false },
            onProductPicked = {
                addProduct(it)
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
            title = "Penerimaan barang",
            body = "Pastikan supplier, satuan, dan jumlah sesuai faktur supplier.",
            tone = BannerTone.INFO,
        )

        FieldLabel("Supplier", required = true)
        Box {
            OutlinedButton(
                onClick = { supplierMenu = true },
                modifier = Modifier.fillMaxWidth().height(Dimens.controlHeight),
                shape = RoundedCornerShape(Dimens.radiusSm),
                border = BorderStroke(1.dp, colors.lineControl),
                colors = ButtonDefaults.outlinedButtonColors(containerColor = colors.surface, contentColor = colors.ink),
            ) {
                Text(
                    text = state.suppliers.firstOrNull { it.id == supplierId }?.name ?: "Pilih supplier…",
                    modifier = Modifier.weight(1f),
                    fontFamily = PlusJakarta,
                    fontSize = 14.sp,
                )
                Icon(Icons.Rounded.ArrowDropDown, contentDescription = null, tint = colors.inkMuted)
            }
            DropdownMenu(expanded = supplierMenu, onDismissRequest = { supplierMenu = false }) {
                state.suppliers.forEach { supplier ->
                    DropdownMenuItem(
                        text = { Text(supplier.name, fontFamily = PlusJakarta, fontSize = 14.sp) },
                        onClick = {
                            supplierId = supplier.id
                            supplierMenu = false
                        },
                    )
                }
            }
        }

        SectionHeader(
            title = "Baris barang",
            actionLabel = "Tambah",
            onAction = { scannerOpen = true },
        )

        if (lines.isEmpty()) {
            TokoCard {
                EmptyState(
                    title = "Belum ada baris barang",
                    body = "Scan atau tambah produk untuk memulai penerimaan.",
                    actionLabel = "Scan produk",
                    onAction = { scannerOpen = true },
                )
            }
        } else {
            lines.forEachIndexed { index, line ->
                val product = state.products.firstOrNull { it.id == line.productId }
                if (product != null) {
                    ReceiveLineCard(
                        product = product,
                        line = line,
                        unitMenuOpen = unitMenuLine == index,
                        onUnitMenuChange = { unitMenuLine = if (it) index else null },
                        onChange = { updated ->
                            lines = lines.toMutableList().also { it[index] = updated }
                        },
                        onRemove = { lines = lines.toMutableList().also { it.removeAt(index) } },
                    )
                }
            }
        }

        TokoCard {
            Row(
                modifier = Modifier.fillMaxWidth().padding(14.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Total faktur", color = colors.inkSecondary, fontFamily = PlusJakarta, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                Text(
                    formatRupiah(receiptTotal(lines)),
                    color = colors.primary,
                    fontFamily = PlusJakarta,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.ExtraBold,
                )
            }
        }

        FieldLabel("No. faktur supplier")
        OutlinedTextField(
            value = reference,
            onValueChange = { reference = it },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            placeholder = { Text("cth: INV-SR-2026-1124", fontSize = 13.sp) },
            shape = RoundedCornerShape(Dimens.radiusSm),
            colors = tokoFieldColors(),
        )

        FieldLabel("Catatan")
        OutlinedTextField(
            value = notes,
            onValueChange = { notes = it },
            modifier = Modifier.fillMaxWidth(),
            minLines = 2,
            placeholder = { Text("Opsional", fontSize = 13.sp) },
            shape = RoundedCornerShape(Dimens.radiusSm),
            colors = tokoFieldColors(),
        )

        validation?.let {
            Text(it, color = colors.danger, fontFamily = PlusJakarta, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
        if (draftSaved) {
            InfoBanner(title = "Draft tersimpan", body = "Draft penerimaan disimpan di perangkat.", tone = BannerTone.SUCCESS)
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            SecondaryButton(
                text = "Simpan draft",
                onClick = { draftSaved = true },
                modifier = Modifier.weight(1f),
            )
            Button(
                onClick = {
                    when {
                        supplierId.isBlank() -> {
                            validation = "Supplier wajib dipilih."
                        }

                        lines.isEmpty() -> {
                            validation = "Tambahkan minimal satu baris barang."
                        }

                        lines.any { it.quantity <= 0 } -> {
                            validation = "Jumlah harus lebih dari nol."
                        }

                        else -> {
                            validation = null
                            onSubmit(supplierId, reference, notes, lines)
                        }
                    }
                },
                modifier = Modifier.weight(1f).height(Dimens.primaryButtonHeight),
                shape = RoundedCornerShape(Dimens.radiusSm),
                colors = ButtonDefaults.buttonColors(containerColor = colors.primary, contentColor = colors.onPrimary),
            ) {
                Icon(Icons.Rounded.Save, contentDescription = null, modifier = Modifier.size(18.dp))
                Text(" Simpan", fontFamily = PlusJakarta, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
        }
        Text(
            text = "Penerimaan membuat purchase + pergerakan PURCHASE di ledger. Offline hanya menyimpan draft lokal.",
            color = colors.inkMuted,
            fontFamily = PlusJakarta,
            fontSize = 11.sp,
            lineHeight = 16.sp,
        )
    }
}

@Composable
private fun ReceiveLineCard(
    product: Product,
    line: ReceiveLine,
    unitMenuOpen: Boolean,
    onUnitMenuChange: (Boolean) -> Unit,
    onChange: (ReceiveLine) -> Unit,
    onRemove: () -> Unit,
) {
    val colors = LocalTokoColors.current
    val unit = unitFor(product, line.unitId)
    TokoCard {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
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
                        product.sku,
                        color = colors.inkMuted,
                        fontFamily = dev.hasino.tokojojo.stock.ui.theme.IbmPlexMono,
                        fontSize = 10.sp,
                    )
                }
                IconButton(onClick = onRemove) {
                    Icon(Icons.Rounded.Delete, contentDescription = "Hapus baris", tint = colors.danger, modifier = Modifier.size(20.dp))
                }
            }

            Row(modifier = Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(modifier = Modifier.weight(1f)) {
                    OutlinedButton(
                        onClick = { onUnitMenuChange(true) },
                        modifier = Modifier.fillMaxWidth().height(Dimens.controlHeight),
                        shape = RoundedCornerShape(Dimens.radiusSm),
                        border = BorderStroke(1.dp, colors.lineControl),
                        colors = ButtonDefaults.outlinedButtonColors(containerColor = colors.surface, contentColor = colors.ink),
                    ) {
                        Text(unit.name, modifier = Modifier.weight(1f), fontFamily = PlusJakarta, fontSize = 13.sp)
                        Icon(Icons.Rounded.ArrowDropDown, contentDescription = null, tint = colors.inkMuted)
                    }
                    DropdownMenu(expanded = unitMenuOpen, onDismissRequest = { onUnitMenuChange(false) }) {
                        product.units.forEach { option ->
                            DropdownMenuItem(
                                text = {
                                    Text(
                                        "${option.name} (${option.conversionQty}x)",
                                        fontFamily = PlusJakarta,
                                        fontSize = 13.sp,
                                    )
                                },
                                onClick = {
                                    onChange(
                                        line.copy(
                                            unitId = option.id,
                                            unitCost = product.cost * option.conversionQty,
                                        ),
                                    )
                                    onUnitMenuChange(false)
                                },
                            )
                        }
                    }
                }
                OutlinedTextField(
                    value = line.quantity.toString(),
                    onValueChange = { raw ->
                        val qty = raw.filter(Char::isDigit).toIntOrNull() ?: 0
                        onChange(line.copy(quantity = qty))
                    },
                    modifier = Modifier.width(84.dp),
                    label = { Text("Qty", fontSize = 11.sp) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    shape = RoundedCornerShape(Dimens.radiusSm),
                    colors = tokoFieldColors(),
                )
            }

            OutlinedTextField(
                value = formatThousands(line.unitCost),
                onValueChange = { raw ->
                    val cost = raw.filter(Char::isDigit).toLongOrNull() ?: 0
                    onChange(line.copy(unitCost = cost))
                },
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                label = { Text("Harga satuan (${unit.name})", fontSize = 11.sp) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                shape = RoundedCornerShape(Dimens.radiusSm),
                colors = tokoFieldColors(),
            )

            Row(modifier = Modifier.fillMaxWidth().padding(top = 6.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(
                    "Subtotal ${formatRupiah(lineSubtotal(line))}",
                    color = colors.inkSecondary,
                    fontFamily = PlusJakarta,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    "= ${baseQuantity(product, line)} ${product.baseUnit.name}",
                    color = colors.inkMuted,
                    fontFamily = PlusJakarta,
                    fontSize = 11.sp,
                )
            }
        }
    }
}
