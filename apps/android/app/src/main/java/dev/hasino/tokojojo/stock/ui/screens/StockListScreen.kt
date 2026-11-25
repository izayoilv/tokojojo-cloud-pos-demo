package dev.hasino.tokojojo.stock.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
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
import dev.hasino.tokojojo.stock.data.Location
import dev.hasino.tokojojo.stock.data.Product
import dev.hasino.tokojojo.stock.data.StockStatus
import dev.hasino.tokojojo.stock.data.searchProducts
import dev.hasino.tokojojo.stock.data.stockAt
import dev.hasino.tokojojo.stock.data.stockStatus
import dev.hasino.tokojojo.stock.ui.StockUiState
import dev.hasino.tokojojo.stock.ui.components.EmptyState
import dev.hasino.tokojojo.stock.ui.components.ErrorState
import dev.hasino.tokojojo.stock.ui.components.SegmentedControl
import dev.hasino.tokojojo.stock.ui.components.SkeletonBlock
import dev.hasino.tokojojo.stock.ui.components.StockRow
import dev.hasino.tokojojo.stock.ui.components.tokoFieldColors
import dev.hasino.tokojojo.stock.ui.icons.TokoIcons
import dev.hasino.tokojojo.stock.ui.theme.Dimens
import dev.hasino.tokojojo.stock.ui.theme.LocalTokoColors
import dev.hasino.tokojojo.stock.ui.theme.PlusJakarta

@Composable
fun StockListScreen(
    state: StockUiState,
    onProductClick: (String) -> Unit,
    onRetry: () -> Unit,
) {
    val colors = LocalTokoColors.current
    var query by rememberSaveable { mutableStateOf("") }
    var statusFilter by rememberSaveable { mutableStateOf("SEMUA") }
    var locationFilter by rememberSaveable { mutableStateOf(Location.WAREHOUSE) }

    val products =
        searchProducts(state.products, query).filter { product ->
            val status = stockStatus(product)
            val statusMatch =
                when (statusFilter) {
                    "MENIPIS" -> status == StockStatus.MENIPIS
                    "HABIS" -> status == StockStatus.HABIS
                    else -> true
                }
            val locationMatch = stockAt(product, locationFilter) > 0
            statusMatch && locationMatch
        }

    Column(modifier = Modifier.fillMaxSize()) {
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
            placeholder = { Text("Cari stok: nama, SKU, barcode...", fontSize = 14.sp) },
            leadingIcon = { Icon(TokoIcons.Rounded.Search, contentDescription = null, modifier = Modifier.size(20.dp)) },
            singleLine = true,
            shape = RoundedCornerShape(Dimens.radiusSm),
            colors = tokoFieldColors(),
        )

        SegmentedControl(
            options = listOf(Location.WAREHOUSE to "Gudang", Location.STORE to "Area Toko"),
            selected = locationFilter,
            onSelect = { locationFilter = it },
            modifier = Modifier.padding(horizontal = 16.dp),
        )

        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            listOf("SEMUA" to "Semua", "MENIPIS" to "Menipis", "HABIS" to "Habis").forEach { (value, label) ->
                FilterChip(
                    selected = statusFilter == value,
                    onClick = { statusFilter = value },
                    label = { Text(label, fontFamily = PlusJakarta, fontSize = 12.sp, fontWeight = FontWeight.SemiBold) },
                    shape = RoundedCornerShape(Dimens.radiusFull),
                    border = BorderStroke(1.dp, if (statusFilter == value) colors.primary else colors.lineControl),
                    colors =
                        FilterChipDefaults.filterChipColors(
                            selectedContainerColor = colors.primarySoft,
                            selectedLabelColor = colors.primary,
                            containerColor = colors.surface,
                            labelColor = colors.inkSecondary,
                        ),
                )
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 2.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "${products.size} produk",
                color = colors.inkMuted,
                fontFamily = PlusJakarta,
                fontSize = 12.sp,
            )
            Text(
                text = "Terakhir ${state.lastSync}",
                color = colors.inkMuted,
                fontFamily = PlusJakarta,
                fontSize = 10.sp,
            )
        }

        when {
            state.loading && state.products.isEmpty() -> {
                StockSkeleton()
            }

            state.error != null && state.products.isEmpty() -> {
                ErrorState(message = state.error, onRetry = onRetry)
            }

            products.isEmpty() -> {
                EmptyState(
                    title = "Tidak ada produk yang cocok",
                    body = "Ubah kata kunci atau filter stok.",
                    actionLabel = "Reset filter",
                    onAction = {
                        query = ""
                        statusFilter = "SEMUA"
                    },
                )
            }

            else -> {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 24.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(products, key = { it.id }) { product ->
                        dev.hasino.tokojojo.stock.ui.components.TokoCard(onClick = { onProductClick(product.id) }) {
                            StockRow(product = product, onClick = { onProductClick(product.id) })
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StockSkeleton() {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        repeat(6) {
            SkeletonBlock(height = 72.dp)
        }
    }
}
