package dev.hasino.tokojojo.stock.data

import java.util.Locale

fun totalStock(product: Product): Int = product.warehouseStock + product.storeStock

fun stockStatus(product: Product): StockStatus =
    when {
        totalStock(product) == 0 -> StockStatus.HABIS
        totalStock(product) <= product.minStock -> StockStatus.MENIPIS
        product.storeStock <= product.minStoreStock -> StockStatus.MENIPIS
        else -> StockStatus.AMAN
    }

fun inventoryValue(products: List<Product>): Long = products.sumOf { totalStock(it).toLong() * it.cost }

fun retailValue(products: List<Product>): Long = products.sumOf { totalStock(it).toLong() * it.price }

fun receiptTotal(lines: List<ReceiptLine>): Long = lines.sumOf { it.quantity.toLong() * it.unitCost }

fun stockVariance(
    system: Int,
    physical: Int,
): Int = physical - system

fun adjustmentValue(
    variance: Int,
    unitCost: Long,
): Long = variance.toLong() * unitCost

fun searchProducts(
    products: List<Product>,
    query: String,
): List<Product> {
    val needle = query.trim().lowercase(Locale.ROOT)
    if (needle.isEmpty()) return products

    return products.filter { product ->
        product.name.lowercase(Locale.ROOT).contains(needle) ||
            product.sku.lowercase(Locale.ROOT).contains(needle) ||
            product.barcode.contains(needle)
    }
}

fun formatRupiah(value: Long): String {
    val grouped = String.format(Locale.US, "%,d", kotlin.math.abs(value)).replace(',', '.')
    return if (value < 0) "-Rp $grouped" else "Rp $grouped"
}
