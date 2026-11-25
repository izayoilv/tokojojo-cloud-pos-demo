package dev.hasino.tokojojo.stock.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowForward
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import dev.hasino.tokojojo.stock.data.Location
import dev.hasino.tokojojo.stock.data.Transfer
import dev.hasino.tokojojo.stock.data.TransferLine
import dev.hasino.tokojojo.stock.ui.StockUiState
import dev.hasino.tokojojo.stock.ui.components.EmptyState
import dev.hasino.tokojojo.stock.ui.components.FieldLabel
import dev.hasino.tokojojo.stock.ui.components.InfoBanner
import dev.hasino.tokojojo.stock.ui.components.PrimaryButton
import dev.hasino.tokojojo.stock.ui.components.QuantityStepper
import dev.hasino.tokojojo.stock.ui.components.SecondaryButton
import dev.hasino.tokojojo.stock.ui.components.SegmentedControl
import dev.hasino.tokojojo.stock.ui.components.TextBadge
import dev.hasino.tokojojo.stock.ui.components.TokoCard
import dev.hasino.tokojojo.stock.ui.theme.Dimens
import dev.hasino.tokojojo.stock.ui.theme.IbmPlexMono
import dev.hasino.tokojojo.stock.ui.theme.LocalTokoColors
import dev.hasino.tokojojo.stock.ui.theme.PlusJakarta

@Composable
fun TransferScreen(
    state: StockUiState,
    onCreate: (Location, Location, List<TransferLine>) -> Unit,
    onComplete: (String) -> Unit,
) {
    val colors = LocalTokoColors.current
    var showCreate by remember { mutableStateOf(false) }

    if (showCreate) {
        TransferCreateDialog(
            state = state,
            onDismiss = { showCreate = false },
            onCreate = { from, to, lines ->
                onCreate(from, to, lines)
                showCreate = false
            },
        )
    }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        InfoBanner(
            title = "Mutasi stok",
            body = "Pindahkan stok dari Gudang Belakang ke Area Toko. Stok berpindah saat mutasi diselesaikan.",
            tone = dev.hasino.tokojojo.stock.ui.components.BannerTone.INFO,
        )
        PrimaryButton(text = "Buat Mutasi", onClick = { showCreate = true })
        Text("Riwayat mutasi", color = colors.ink, fontFamily = PlusJakarta, fontSize = 15.sp, fontWeight = FontWeight.Bold)
        if (state.transfers.isEmpty()) {
            TokoCard { EmptyState(title = "Belum ada mutasi", body = "Buat mutasi pertama dari gudang ke area toko.") }
        } else {
            state.transfers.forEach { transfer ->
                TransferRow(transfer = transfer, onComplete = { onComplete(transfer.id) })
            }
        }
    }
}

@Composable
private fun TransferRow(
    transfer: Transfer,
    onComplete: () -> Unit,
) {
    val colors = LocalTokoColors.current
    TokoCard {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    transfer.number,
                    color = colors.ink,
                    fontFamily = IbmPlexMono,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.weight(1f),
                )
                TextBadge(
                    label = if (transfer.status == "COMPLETED") "SELESAI" else "PENDING",
                    foreground = if (transfer.status == "COMPLETED") colors.success else colors.warning,
                    background = if (transfer.status == "COMPLETED") colors.successSoft else colors.warningSoft,
                )
            }
            Text(
                "${transfer.from.label} → ${transfer.to.label}",
                color = colors.inkSecondary,
                fontFamily = PlusJakarta,
                fontSize = 12.sp,
                modifier = Modifier.padding(top = 4.dp),
            )
            Text(
                "${transfer.lines.size} baris · ${transfer.createdBy} · ${transfer.time}",
                color = colors.inkMuted,
                fontFamily = PlusJakarta,
                fontSize = 11.sp,
            )
            if (transfer.status != "COMPLETED") {
                Button(
                    onClick = onComplete,
                    modifier = Modifier.fillMaxWidth().height(Dimens.controlHeight).padding(top = 8.dp),
                    shape = RoundedCornerShape(Dimens.radiusSm),
                    colors = ButtonDefaults.buttonColors(containerColor = colors.primary, contentColor = colors.onPrimary),
                ) {
                    Text("Selesaikan mutasi", fontFamily = PlusJakarta, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
private fun TransferCreateDialog(
    state: StockUiState,
    onDismiss: () -> Unit,
    onCreate: (Location, Location, List<TransferLine>) -> Unit,
) {
    val colors = LocalTokoColors.current
    var from by remember { mutableStateOf(Location.WAREHOUSE) }
    var to by remember { mutableStateOf(Location.STORE) }
    var productId by remember {
        mutableStateOf(
            state.products
                .firstOrNull()
                ?.id
                .orEmpty(),
        )
    }
    var quantity by remember { mutableStateOf(1) }
    var productMenu by remember { mutableStateOf(false) }
    val product = state.products.firstOrNull { it.id == productId }

    Dialog(onDismissRequest = onDismiss) {
        TokoCard {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "Buat Mutasi",
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
                FieldLabel("Dari")
                SegmentedControl(options = listOf(Location.WAREHOUSE to "Gudang", Location.STORE to "Toko"), selected = from, onSelect = {
                    from =
                        it
                })
                FieldLabel("Ke")
                SegmentedControl(options = listOf(Location.STORE to "Toko", Location.WAREHOUSE to "Gudang"), selected = to, onSelect = {
                    to =
                        it
                })
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
                FieldLabel("Jumlah")
                QuantityStepper(value = quantity, onValueChange = { quantity = it })
                Row(modifier = Modifier.fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    SecondaryButton(text = "Batal", onClick = onDismiss, modifier = Modifier.weight(1f))
                    PrimaryButton(
                        text = "Buat",
                        onClick = {
                            if (product != null && quantity > 0) {
                                onCreate(from, to, listOf(TransferLine(product.id, product.baseUnit.id, quantity)))
                            }
                        },
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
    }
}
