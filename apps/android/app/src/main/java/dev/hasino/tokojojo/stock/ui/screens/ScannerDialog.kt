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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import dev.hasino.tokojojo.stock.data.Product
import dev.hasino.tokojojo.stock.data.formatRupiah
import dev.hasino.tokojojo.stock.ui.components.EmptyState
import dev.hasino.tokojojo.stock.ui.components.PrimaryActionButton
import dev.hasino.tokojojo.stock.ui.components.ProductAvatar
import dev.hasino.tokojojo.stock.ui.theme.Danger
import dev.hasino.tokojojo.stock.ui.theme.Faint
import dev.hasino.tokojojo.stock.ui.theme.Ink
import dev.hasino.tokojojo.stock.ui.theme.Line
import dev.hasino.tokojojo.stock.ui.theme.Muted
import dev.hasino.tokojojo.stock.ui.theme.Navy
import dev.hasino.tokojojo.stock.ui.theme.Navy2
import dev.hasino.tokojojo.stock.ui.theme.Royal
import dev.hasino.tokojojo.stock.ui.theme.White

@Composable
fun ScannerDialog(
    products: List<Product>,
    onDismiss: () -> Unit,
    onProductPicked: (Product) -> Unit,
) {
    var code by remember { mutableStateOf("") }
    var result by remember { mutableStateOf<Product?>(null) }
    var notFound by remember { mutableStateOf(false) }

    fun lookup(value: String) {
        val product =
            products.firstOrNull {
                it.barcode.equals(value.trim(), ignoreCase = true) ||
                    it.sku.equals(value.trim(), ignoreCase = true)
            }
        result = product
        notFound = product == null
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(dev.hasino.tokojojo.stock.ui.theme.Canvas),
        ) {
            Column(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .statusBarsPadding()
                        .padding(14.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Scan Barcode", color = Ink, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold)
                        Text("Scanner mock — kamera belum aktif", color = Muted, fontSize = 11.sp)
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Filled.Close, contentDescription = "Tutup", tint = Muted)
                    }
                }

                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .height(210.dp)
                            .padding(top = 10.dp)
                            .background(
                                brush =
                                    androidx.compose.ui.graphics.Brush.linearGradient(
                                        listOf(Navy, Navy2),
                                    ),
                                shape = RoundedCornerShape(16.dp),
                            ),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Filled.Search,
                            contentDescription = null,
                            tint = Color(0xFF93C5FD),
                            modifier = Modifier.size(38.dp),
                        )
                        Text(
                            "Arahkan kamera ke barcode",
                            color = White,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(top = 8.dp),
                        )
                        Text(
                            "ML Kit aktif setelah integrasi #13",
                            color = Color(0xFFB6C4DE),
                            fontSize = 10.5.sp,
                        )
                    }
                }

                OutlinedTextField(
                    value = code,
                    onValueChange = {
                        code = it
                        notFound = false
                    },
                    modifier = Modifier.fillMaxWidth().padding(top = 14.dp),
                    label = { Text("Barcode / SKU", fontSize = 11.sp) },
                    placeholder = { Text("Ketik barcode atau SKU...", fontSize = 12.sp) },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    colors =
                        OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = Royal,
                            unfocusedBorderColor = Line,
                            focusedContainerColor = White,
                            unfocusedContainerColor = White,
                        ),
                )

                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Button(
                        onClick = { lookup(code) },
                        modifier = Modifier.weight(1f).height(48.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Royal),
                    ) {
                        Text("Cari Produk", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    }
                    Button(
                        onClick = {
                            val random = products.randomOrNull()
                            if (random != null) {
                                code = random.barcode
                                lookup(random.barcode)
                            }
                        },
                        modifier = Modifier.weight(1f).height(48.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors =
                            ButtonDefaults.buttonColors(
                                containerColor = White,
                                contentColor = Muted,
                            ),
                        border = BorderStroke(1.5.dp, Line),
                    ) {
                        Text("Simulasi Scan", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    }
                }

                if (notFound) {
                    Text(
                        text = "Produk tidak dikenal untuk kode tersebut.",
                        color = Danger,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(top = 12.dp),
                    )
                }

                val picked = result
                if (picked != null) {
                    Card(
                        modifier = Modifier.fillMaxWidth().padding(top = 14.dp),
                        shape = RoundedCornerShape(14.dp),
                        border = BorderStroke(1.dp, Line),
                        colors = CardDefaults.cardColors(containerColor = White),
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp),
                            ) {
                                ProductAvatar(picked)
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        picked.name,
                                        color = Ink,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold,
                                    )
                                    Text(
                                        "${picked.sku} • ${picked.barcode}",
                                        color = Faint,
                                        fontSize = 10.sp,
                                        fontFamily = FontFamily.Monospace,
                                    )
                                }
                                Text(
                                    "${picked.warehouseStock} ${picked.unit}",
                                    color = Muted,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                )
                            }
                            Text(
                                "HPP ${formatRupiah(picked.cost)} • Harga jual ${formatRupiah(picked.price)}",
                                color = Muted,
                                fontSize = 11.sp,
                                modifier = Modifier.padding(top = 8.dp),
                            )
                            PrimaryActionButton(
                                text = "Gunakan Produk",
                                onClick = { onProductPicked(picked) },
                                modifier = Modifier.padding(top = 12.dp),
                            )
                        }
                    }
                } else if (!notFound) {
                    EmptyState(
                        title = "Belum ada hasil",
                        description = "Ketik kode lalu tekan Cari Produk, atau gunakan Simulasi Scan.",
                        icon = Icons.Filled.Search,
                    )
                }
            }
        }
    }
}
