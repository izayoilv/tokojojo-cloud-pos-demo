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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import dev.hasino.tokojojo.stock.data.Product
import dev.hasino.tokojojo.stock.data.formatRupiah
import dev.hasino.tokojojo.stock.ui.components.EmptyState
import dev.hasino.tokojojo.stock.ui.components.PrimaryButton
import dev.hasino.tokojojo.stock.ui.components.ProductAvatar
import dev.hasino.tokojojo.stock.ui.components.SecondaryButton
import dev.hasino.tokojojo.stock.ui.components.tokoFieldColors
import dev.hasino.tokojojo.stock.ui.icons.TokoIcons
import dev.hasino.tokojojo.stock.ui.theme.Dimens
import dev.hasino.tokojojo.stock.ui.theme.IbmPlexMono
import dev.hasino.tokojojo.stock.ui.theme.LocalTokoColors
import dev.hasino.tokojojo.stock.ui.theme.PlusJakarta

@Composable
fun ScannerDialog(
    products: List<Product>,
    onDismiss: () -> Unit,
    onProductPicked: (Product) -> Unit,
) {
    val colors = LocalTokoColors.current
    var code by remember { mutableStateOf("") }
    var result by remember { mutableStateOf<Product?>(null) }
    var notFound by remember { mutableStateOf(false) }
    var torch by remember { mutableStateOf(false) }
    val focusRequester = remember { FocusRequester() }

    fun lookup(value: String) {
        val product =
            products.firstOrNull {
                it.barcode.equals(value.trim(), ignoreCase = true) ||
                    it.sku.equals(value.trim(), ignoreCase = true) ||
                    it.units.any { unit -> unit.barcode.equals(value.trim(), ignoreCase = true) }
            }
        result = product
        notFound = product == null
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = true),
    ) {
        Box(modifier = Modifier.fillMaxSize().background(colors.canvas)) {
            Column(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .statusBarsPadding()
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
            ) {
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            "Pindai barcode",
                            color = colors.ink,
                            fontFamily = PlusJakarta,
                            fontSize = 22.sp,
                            fontWeight = FontWeight.ExtraBold,
                        )
                        Text(
                            "Kamera belum aktif · gunakan input manual",
                            color = colors.inkMuted,
                            fontFamily = PlusJakarta,
                            fontSize = 12.sp,
                        )
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(TokoIcons.Rounded.Close, contentDescription = "Tutup", tint = colors.inkMuted)
                    }
                }

                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .height(250.dp)
                            .padding(top = 14.dp)
                            .background(colors.cameraBackdrop, RoundedCornerShape(Dimens.radiusMd)),
                    contentAlignment = Alignment.Center,
                ) {
                    Box(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 28.dp)
                                .height(150.dp)
                                .background(colors.cameraFrame, RoundedCornerShape(Dimens.radiusSm)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Box(modifier = Modifier.fillMaxWidth(0.72f).height(2.dp).background(colors.accent))
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                TokoIcons.Rounded.CameraAlt,
                                contentDescription = null,
                                tint = colors.inkMuted,
                                modifier = Modifier.size(40.dp),
                            )
                            Text(
                                "Arahkan kamera ke barcode",
                                color = colors.onCamera,
                                fontFamily = PlusJakarta,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier.padding(top = 8.dp),
                            )
                        }
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    SecondaryButton(
                        text = if (torch) "Matikan senter" else "Senter",
                        onClick = { torch = !torch },
                        modifier = Modifier.weight(1f),
                    )
                    SecondaryButton(
                        text = "Input manual",
                        onClick = { focusRequester.requestFocus() },
                        modifier = Modifier.weight(1f),
                    )
                }

                OutlinedTextField(
                    value = code,
                    onValueChange = {
                        code = it
                        notFound = false
                    },
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(top = 12.dp)
                            .focusRequester(focusRequester),
                    label = { Text("Barcode / SKU", fontSize = 12.sp) },
                    placeholder = { Text("Ketik barcode atau SKU...", fontSize = 13.sp) },
                    singleLine = true,
                    leadingIcon = { Icon(TokoIcons.Rounded.Keyboard, contentDescription = null) },
                    shape = RoundedCornerShape(Dimens.radiusSm),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
                    colors = tokoFieldColors(),
                )

                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    PrimaryButton(
                        text = "Cari produk",
                        onClick = { lookup(code) },
                        modifier = Modifier.weight(1f),
                    )
                    SecondaryButton(
                        text = "Simulasi",
                        onClick = {
                            val random = products.randomOrNull()
                            if (random != null) {
                                code = random.barcode
                                lookup(random.barcode)
                            }
                        },
                        modifier = Modifier.weight(1f),
                    )
                }

                if (notFound) {
                    Text(
                        text = "Barcode tidak ditemukan. Coba kode lain atau pilih produk manual.",
                        color = colors.danger,
                        fontFamily = PlusJakarta,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(top = 12.dp),
                    )
                }

                val picked = result
                if (picked != null) {
                    dev.hasino.tokojojo.stock.ui.components.TokoCard(modifier = Modifier.padding(top = 14.dp)) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                ProductAvatar(picked.name)
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        picked.name,
                                        color = colors.ink,
                                        fontFamily = PlusJakarta,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Bold,
                                    )
                                    Text(
                                        "${picked.sku} · ${picked.barcode}",
                                        color = colors.inkMuted,
                                        fontFamily = IbmPlexMono,
                                        fontSize = 10.sp,
                                    )
                                }
                            }
                            Text(
                                "Stok gudang ${picked.warehouseStock} ${picked.baseUnit.name} · ${formatRupiah(picked.cost)}",
                                color = colors.inkSecondary,
                                fontFamily = PlusJakarta,
                                fontSize = 12.sp,
                                modifier = Modifier.padding(top = 8.dp),
                            )
                            PrimaryButton(
                                text = "Gunakan produk",
                                onClick = { onProductPicked(picked) },
                                modifier = Modifier.padding(top = 12.dp),
                            )
                        }
                    }
                } else if (!notFound) {
                    EmptyState(
                        title = "Belum ada hasil",
                        body = "Arahkan kamera, masukkan kode, atau gunakan Simulasi.",
                    )
                }
            }
        }
    }
}
