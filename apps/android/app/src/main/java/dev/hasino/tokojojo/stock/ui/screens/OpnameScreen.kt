package dev.hasino.tokojojo.stock.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
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
import androidx.compose.ui.window.Dialog
import dev.hasino.tokojojo.stock.data.Location
import dev.hasino.tokojojo.stock.data.Opname
import dev.hasino.tokojojo.stock.data.OpnameItem
import dev.hasino.tokojojo.stock.data.stockAt
import dev.hasino.tokojojo.stock.ui.StockUiState
import dev.hasino.tokojojo.stock.ui.components.EmptyState
import dev.hasino.tokojojo.stock.ui.components.FieldLabel
import dev.hasino.tokojojo.stock.ui.components.InfoBanner
import dev.hasino.tokojojo.stock.ui.components.PrimaryButton
import dev.hasino.tokojojo.stock.ui.components.SecondaryButton
import dev.hasino.tokojojo.stock.ui.components.SegmentedControl
import dev.hasino.tokojojo.stock.ui.components.TextBadge
import dev.hasino.tokojojo.stock.ui.components.TokoCard
import dev.hasino.tokojojo.stock.ui.components.tokoFieldColors
import dev.hasino.tokojojo.stock.ui.theme.Dimens
import dev.hasino.tokojojo.stock.ui.theme.IbmPlexMono
import dev.hasino.tokojojo.stock.ui.theme.LocalTokoColors
import dev.hasino.tokojojo.stock.ui.theme.PlusJakarta

@Composable
fun OpnameScreen(
    state: StockUiState,
    onCreate: (Location, List<OpnameItem>) -> Unit,
) {
    val colors = LocalTokoColors.current
    var showCreate by remember { mutableStateOf(false) }

    if (showCreate) {
        OpnameCreateDialog(
            state = state,
            onDismiss = { showCreate = false },
            onCreate = { location, items ->
                onCreate(location, items)
                showCreate = false
            },
        )
    }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        InfoBanner(
            title = "Opname",
            body = "Hitung stok fisik lalu kirim untuk persetujuan OWNER/ADMIN di Admin Web.",
            tone = dev.hasino.tokojojo.stock.ui.components.BannerTone.INFO,
        )
        PrimaryButton(text = "Buat Opname", onClick = { showCreate = true })
        Text("Sesi opname", color = colors.ink, fontFamily = PlusJakarta, fontSize = 15.sp, fontWeight = FontWeight.Bold)
        if (state.opnames.isEmpty()) {
            TokoCard { EmptyState(title = "Belum ada opname", body = "Buat sesi hitung fisik pertama.") }
        } else {
            state.opnames.forEach { OpnameRow(it) }
        }
    }
}

@Composable
private fun OpnameRow(opname: Opname) {
    val colors = LocalTokoColors.current
    TokoCard {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    opname.number,
                    color = colors.ink,
                    fontFamily = IbmPlexMono,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.weight(1f),
                )
                TextBadge(
                    label =
                        when (opname.status) {
                            "PENDING_REVIEW" -> "PENDING"
                            "APPROVED" -> "DISETUJUI"
                            "REJECTED" -> "DITOLAK"
                            else -> opname.status
                        },
                    foreground =
                        when (opname.status) {
                            "APPROVED" -> colors.success
                            "REJECTED" -> colors.danger
                            else -> colors.warning
                        },
                    background =
                        when (opname.status) {
                            "APPROVED" -> colors.successSoft
                            "REJECTED" -> colors.dangerSoft
                            else -> colors.warningSoft
                        },
                )
            }
            Text(
                "${opname.location.label} · ${opname.items.size} produk · ${opname.createdBy}",
                color = colors.inkSecondary,
                fontFamily = PlusJakarta,
                fontSize = 12.sp,
                modifier = Modifier.padding(top = 4.dp),
            )
            Text(opname.time, color = colors.inkMuted, fontFamily = PlusJakarta, fontSize = 11.sp)
        }
    }
}

@Composable
private fun OpnameCreateDialog(
    state: StockUiState,
    onDismiss: () -> Unit,
    onCreate: (Location, List<OpnameItem>) -> Unit,
) {
    val colors = LocalTokoColors.current
    var location by remember { mutableStateOf(Location.STORE) }
    var productId by remember {
        mutableStateOf(
            state.products
                .firstOrNull()
                ?.id
                .orEmpty(),
        )
    }
    var productMenu by remember { mutableStateOf(false) }
    var physicalText by remember { mutableStateOf("") }
    val product = state.products.firstOrNull { it.id == productId }
    val systemQty = product?.let { stockAt(it, location) } ?: 0

    Dialog(onDismissRequest = onDismiss) {
        TokoCard {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "Buat Opname",
                        color = colors.ink,
                        fontFamily = PlusJakarta,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f),
                    )
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Rounded.Close, contentDescription = "Tutup", tint = colors.inkMuted)
                    }
                }
                FieldLabel("Lokasi")
                SegmentedControl(
                    options =
                        listOf(
                            Location.STORE to "Toko",
                            Location.WAREHOUSE to "Gudang",
                        ),
                    selected = location,
                    onSelect = {
                        location =
                            it
                    },
                )
                FieldLabel("Produk")
                OutlinedButton(
                    onClick = { productMenu = true },
                    modifier = Modifier.fillMaxWidth().height(Dimens.controlHeight),
                    shape = RoundedCornerShape(Dimens.radiusSm),
                    border = BorderStroke(1.dp, colors.lineControl),
                    colors = ButtonDefaults.outlinedButtonColors(containerColor = colors.surface, contentColor = colors.ink),
                ) {
                    Text(
                        product?.name ?: "Pilih produk",
                        modifier = Modifier.weight(1f),
                        fontFamily = PlusJakarta,
                        fontSize = 13.sp,
                        maxLines = 1,
                    )
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
                Text(
                    "Stok sistem: $systemQty ${product?.baseUnit?.name.orEmpty()}",
                    color = colors.inkMuted,
                    fontFamily = PlusJakarta,
                    fontSize = 12.sp,
                    modifier = Modifier.padding(top = 8.dp),
                )
                FieldLabel("Stok fisik")
                OutlinedTextField(
                    value = physicalText,
                    onValueChange = { physicalText = it.filter(Char::isDigit) },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    shape = RoundedCornerShape(Dimens.radiusSm),
                    colors = tokoFieldColors(),
                )
                Row(modifier = Modifier.fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    SecondaryButton(text = "Batal", onClick = onDismiss, modifier = Modifier.weight(1f))
                    PrimaryButton(
                        text = "Kirim",
                        onClick = {
                            val physical = physicalText.toIntOrNull()
                            if (product != null && physical != null) {
                                onCreate(location, listOf(OpnameItem(product.id, systemQty, physical)))
                            }
                        },
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
    }
}
