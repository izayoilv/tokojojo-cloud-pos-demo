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
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.hasino.tokojojo.stock.data.Product
import dev.hasino.tokojojo.stock.data.ReceiptLine
import dev.hasino.tokojojo.stock.data.Supplier
import dev.hasino.tokojojo.stock.data.formatRupiah
import dev.hasino.tokojojo.stock.data.receiptTotal
import dev.hasino.tokojojo.stock.ui.StockUiState
import dev.hasino.tokojojo.stock.ui.components.EmptyState
import dev.hasino.tokojojo.stock.ui.components.FieldLabel
import dev.hasino.tokojojo.stock.ui.components.PrimaryActionButton
import dev.hasino.tokojojo.stock.ui.components.ProductAvatar
import dev.hasino.tokojojo.stock.ui.components.SecondaryActionButton
import dev.hasino.tokojojo.stock.ui.components.SectionTitle
import dev.hasino.tokojojo.stock.ui.theme.Amber
import dev.hasino.tokojojo.stock.ui.theme.Canvas
import dev.hasino.tokojojo.stock.ui.theme.Danger
import dev.hasino.tokojojo.stock.ui.theme.Faint
import dev.hasino.tokojojo.stock.ui.theme.Ink
import dev.hasino.tokojojo.stock.ui.theme.Line
import dev.hasino.tokojojo.stock.ui.theme.Muted
import dev.hasino.tokojojo.stock.ui.theme.Navy
import dev.hasino.tokojojo.stock.ui.theme.NavyMuted
import dev.hasino.tokojojo.stock.ui.theme.Royal
import dev.hasino.tokojojo.stock.ui.theme.Success
import dev.hasino.tokojojo.stock.ui.theme.White

@Composable
fun ReceiveScreen(
    state: StockUiState,
    onSubmit: (supplierId: String, lines: List<ReceiptLine>) -> Unit,
) {
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
    var lines by remember { mutableStateOf(emptyList<ReceiptLine>()) }
    var validationError by remember { mutableStateOf<String?>(null) }
    var baselineReceipts by remember { mutableStateOf(state.receipts.size) }

    LaunchedEffect(state.receipts.size) {
        if (state.receipts.size > baselineReceipts) {
            lines = emptyList()
            baselineReceipts = state.receipts.size
        }
    }

    fun addProduct(product: Product) {
        val existing = lines.indexOfFirst { it.productId == product.id }
        lines =
            if (existing >= 0) {
                lines.toMutableList().also {
                    it[existing] = it[existing].copy(quantity = it[existing].quantity + 1)
                }
            } else {
                lines + ReceiptLine(product.id, quantity = 1, unitCost = product.cost)
            }
        validationError = null
    }

    fun updateLine(
        index: Int,
        line: ReceiptLine,
    ) {
        lines = lines.toMutableList().also { it[index] = line }
    }

    val supplier = state.suppliers.firstOrNull { it.id == supplierId }

    if (scannerOpen) {
        ScannerDialog(
            products = state.products,
            onDismiss = { scannerOpen = false },
            onProductPicked = { product ->
                addProduct(product)
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
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Navy),
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    "SCAN / KETIK BARCODE",
                    color = NavyMuted,
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 1.sp,
                )
                Text(
                    "Penerimaan masuk ke WH-BACK",
                    color = Color(0xFFB6C4DE),
                    fontSize = 11.sp,
                    modifier = Modifier.padding(top = 2.dp),
                )
                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                    horizontalArrangement = Arrangement.spacedBy(9.dp),
                ) {
                    Button(
                        onClick = { scannerOpen = true },
                        modifier = Modifier.weight(1f).height(48.dp),
                        shape = RoundedCornerShape(11.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Royal),
                    ) {
                        Icon(Icons.Filled.Search, contentDescription = null, modifier = Modifier.width(16.dp))
                        Text(" Scan Barcode", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    }
                    Button(
                        onClick = {
                            state.products.randomOrNull()?.let { addProduct(it) }
                        },
                        modifier = Modifier.weight(1f).height(48.dp),
                        shape = RoundedCornerShape(11.dp),
                        colors =
                            ButtonDefaults.buttonColors(
                                containerColor = White.copy(alpha = 0.12f),
                                contentColor = White,
                            ),
                    ) {
                        Text("Simulasi Scan", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        FieldLabel("Supplier")
        Box {
            OutlinedButton(
                onClick = { supplierMenu = true },
                modifier = Modifier.fillMaxWidth().height(50.dp),
                shape = RoundedCornerShape(12.dp),
                border = BorderStroke(1.5.dp, Line),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = Ink),
            ) {
                Text(
                    text = supplier?.name ?: "Pilih supplier",
                    modifier = Modifier.weight(1f),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Icon(Icons.Filled.ArrowDropDown, contentDescription = null, tint = Muted)
            }
            DropdownMenu(expanded = supplierMenu, onDismissRequest = { supplierMenu = false }) {
                state.suppliers.forEach { item: Supplier ->
                    DropdownMenuItem(
                        text = { Text(item.name, fontSize = 12.sp) },
                        onClick = {
                            supplierId = item.id
                            supplierMenu = false
                        },
                    )
                }
            }
        }

        if (lines.isEmpty()) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, Line),
                colors = CardDefaults.cardColors(containerColor = White),
            ) {
                EmptyState(
                    title = "Belum ada baris penerimaan",
                    description = "Scan produk atau gunakan Simulasi Scan untuk memulai.",
                    icon = Icons.Filled.Add,
                )
            }
        } else {
            SectionTitle("Baris Penerimaan (${lines.size})")
            lines.forEachIndexed { index, line ->
                val product = state.products.firstOrNull { it.id == line.productId }
                if (product != null) {
                    ReceiptLineCard(
                        product = product,
                        line = line,
                        onChange = { updateLine(index, it) },
                        onRemove = {
                            lines = lines.toMutableList().also { it.removeAt(index) }
                        },
                    )
                }
            }

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, Line),
                colors = CardDefaults.cardColors(containerColor = White),
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text("Total Faktur", color = Ink, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold)
                        Text(
                            formatRupiah(receiptTotal(lines)),
                            color = Success,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.ExtraBold,
                        )
                    }
                    PrimaryActionButton(
                        text = "Simpan → Stok WH-BACK",
                        onClick = {
                            if (lines.isEmpty() || lines.any { it.quantity <= 0 }) {
                                validationError = "Jumlah setiap baris harus lebih dari nol."
                            } else {
                                validationError = null
                                onSubmit(supplierId, lines)
                            }
                        },
                        loading = state.isSubmitting,
                        modifier = Modifier.padding(top = 12.dp),
                    )
                }
            }
        }

        validationError?.let {
            Text(it, color = Danger, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        }

        SecondaryActionButton(
            text = "Kosongkan Draft",
            onClick = { lines = emptyList() },
            enabled = lines.isNotEmpty(),
        )

        Text(
            text = "Simpan penerimaan menambah stok WH-BACK. Saat mode offline, dokumen masuk antrean lokal.",
            color = Faint,
            fontSize = 10.5.sp,
            modifier = Modifier.padding(horizontal = 4.dp),
        )
    }
}

@Composable
private fun ReceiptLineCard(
    product: Product,
    line: ReceiptLine,
    onChange: (ReceiptLine) -> Unit,
    onRemove: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, Line),
        colors = CardDefaults.cardColors(containerColor = White),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(9.dp),
            ) {
                ProductAvatar(product)
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        product.name,
                        color = Ink,
                        fontSize = 12.5.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                    )
                    Text(
                        "${product.sku} • ${product.unit}",
                        color = Faint,
                        fontSize = 10.sp,
                    )
                }
                IconButton(onClick = onRemove) {
                    Icon(Icons.Filled.Delete, contentDescription = "Hapus", tint = Danger)
                }
            }
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                OutlinedTextField(
                    value = line.quantity.toString(),
                    onValueChange = { raw ->
                        val quantity = raw.filter(Char::isDigit).toIntOrNull() ?: 0
                        onChange(line.copy(quantity = quantity))
                    },
                    modifier = Modifier.width(82.dp),
                    label = { Text("Qty", fontSize = 10.sp) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    shape = RoundedCornerShape(10.dp),
                    colors =
                        OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Royal,
                            unfocusedBorderColor = Line,
                        ),
                )
                OutlinedTextField(
                    value = line.unitCost.toString(),
                    onValueChange = { raw ->
                        val cost = raw.filter(Char::isDigit).toLongOrNull() ?: 0
                        onChange(line.copy(unitCost = cost))
                    },
                    modifier = Modifier.weight(1f),
                    label = { Text("HPP / unit", fontSize = 10.sp) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    shape = RoundedCornerShape(10.dp),
                    colors =
                        OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Royal,
                            unfocusedBorderColor = Line,
                        ),
                )
            }
            Text(
                "Subtotal ${formatRupiah(line.quantity.toLong() * line.unitCost)}",
                color = Muted,
                fontSize = 10.5.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(top = 6.dp),
            )
        }
    }
}
