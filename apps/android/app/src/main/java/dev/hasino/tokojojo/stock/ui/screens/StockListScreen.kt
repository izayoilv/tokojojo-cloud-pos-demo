package dev.hasino.tokojojo.stock.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.hasino.tokojojo.stock.data.Product
import dev.hasino.tokojojo.stock.data.StockStatus
import dev.hasino.tokojojo.stock.data.formatRupiah
import dev.hasino.tokojojo.stock.data.searchProducts
import dev.hasino.tokojojo.stock.data.stockStatus
import dev.hasino.tokojojo.stock.data.totalStock
import dev.hasino.tokojojo.stock.ui.StockUiState
import dev.hasino.tokojojo.stock.ui.components.EmptyState
import dev.hasino.tokojojo.stock.ui.components.ErrorState
import dev.hasino.tokojojo.stock.ui.components.LoadingState
import dev.hasino.tokojojo.stock.ui.components.ProductAvatar
import dev.hasino.tokojojo.stock.ui.components.StatusPill
import dev.hasino.tokojojo.stock.ui.components.StockBar
import dev.hasino.tokojojo.stock.ui.theme.Faint
import dev.hasino.tokojojo.stock.ui.theme.Ink
import dev.hasino.tokojojo.stock.ui.theme.Line
import dev.hasino.tokojojo.stock.ui.theme.Muted
import dev.hasino.tokojojo.stock.ui.theme.White

@Composable
fun StockListScreen(
    state: StockUiState,
    onProductClick: (String) -> Unit,
    onRetry: () -> Unit,
) {
    var query by rememberSaveable { mutableStateOf("") }
    val products = searchProducts(state.products, query)
    val lowCount = state.products.count { stockStatus(it) != StockStatus.AMAN }

    Column(modifier = Modifier.fillMaxWidth()) {
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
            placeholder = { Text("Cari nama / SKU / barcode...", fontSize = 13.sp, color = Faint) },
            leadingIcon = {
                Icon(Icons.Filled.Search, contentDescription = null, tint = Faint, modifier = Modifier.size(18.dp))
            },
            singleLine = true,
            shape = RoundedCornerShape(12.dp),
            colors =
                OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = dev.hasino.tokojojo.stock.ui.theme.Royal,
                    unfocusedBorderColor = Line,
                    focusedContainerColor = White,
                    unfocusedContainerColor = White,
                ),
        )

        if (state.isLoading && state.products.isEmpty()) {
            LoadingState()
            return
        }
        if (state.error != null && state.products.isEmpty()) {
            ErrorState(message = state.error, onRetry = onRetry)
            return
        }

        LazyColumn(
            contentPadding = PaddingValues(start = 14.dp, end = 14.dp, bottom = 96.dp),
            verticalArrangement = Arrangement.spacedBy(9.dp),
        ) {
            item {
                Text(
                    text = "${state.products.size} SKU aktif • $lowCount menipis",
                    color = Muted,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(start = 3.dp, bottom = 3.dp),
                )
            }
            if (products.isEmpty()) {
                item {
                    EmptyState(
                        title = "Tidak ada produk cocok",
                        description = "Ubah kata kunci nama, SKU, atau barcode.",
                        icon = Icons.Filled.Search,
                    )
                }
            } else {
                items(products, key = { it.id }) { product ->
                    ProductRow(product = product, onClick = { onProductClick(product.id) })
                }
            }
        }
    }
}

@Composable
private fun ProductRow(
    product: Product,
    onClick: () -> Unit,
) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, Line),
        colors = CardDefaults.cardColors(containerColor = White),
    ) {
        Row(
            modifier = Modifier.padding(13.dp),
            verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.spacedBy(11.dp),
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
                    "${product.sku} • HPP ${formatRupiah(product.cost)}",
                    color = Faint,
                    fontSize = 10.5.sp,
                    modifier = Modifier.padding(top = 1.dp),
                )
                Row(
                    modifier = Modifier.padding(top = 5.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text("WH ${product.warehouseStock}", color = Muted, fontSize = 10.5.sp)
                    Text("SF ${product.storeStock}", color = Muted, fontSize = 10.5.sp)
                    Text(
                        "Total ${totalStock(product)} ${product.unit}",
                        color = Muted,
                        fontSize = 10.5.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
                StockBar(
                    current = totalStock(product),
                    minimum = product.minStock,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
            StatusPill(stockStatus(product))
        }
    }
}
