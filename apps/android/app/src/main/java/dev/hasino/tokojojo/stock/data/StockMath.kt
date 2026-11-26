package dev.hasino.tokojojo.stock.data

import java.util.Locale

fun totalStock(product: Product): Int = product.warehouseStock + product.storeStock

fun stockAt(
    product: Product,
    location: Location,
): Int =
    when (location) {
        Location.WAREHOUSE -> product.warehouseStock
        Location.STORE -> product.storeStock
    }

fun minimumAt(
    product: Product,
    location: Location,
): Int =
    when (location) {
        Location.WAREHOUSE -> product.minWarehouse
        Location.STORE -> product.minStore
    }

fun stockStatus(product: Product): StockStatus =
    when {
        totalStock(product) == 0 -> StockStatus.HABIS
        product.warehouseStock <= product.minWarehouse -> StockStatus.MENIPIS
        product.storeStock <= product.minStore -> StockStatus.MENIPIS
        else -> StockStatus.AMAN
    }

fun lowStockProducts(products: List<Product>): List<Product> = products.filter { stockStatus(it) != StockStatus.AMAN }

fun inventoryValue(products: List<Product>): Long = products.sumOf { totalStock(it).toLong() * it.cost }

fun retailValue(products: List<Product>): Long = products.sumOf { totalStock(it).toLong() * it.price }

fun unitFor(
    product: Product,
    unitId: String,
): ProductUnit = product.units.firstOrNull { it.id == unitId } ?: product.baseUnit

fun baseQuantity(
    product: Product,
    line: ReceiveLine,
): Int = line.quantity * unitFor(product, line.unitId).conversionQty

fun lineSubtotal(line: ReceiveLine): Long = line.quantity.toLong() * line.unitCost

fun receiptTotal(lines: List<ReceiveLine>): Long = lines.sumOf(::lineSubtotal)

fun transferBaseQuantity(
    product: Product,
    line: TransferLine,
): Int = line.quantity * unitFor(product, line.unitId).conversionQty

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
            product.barcode.contains(needle) ||
            product.units.any { it.barcode.contains(needle) }
    }
}

fun formatThousands(value: Long): String = String.format(Locale.US, "%,d", value).replace(',', '.')

fun formatRupiah(value: Long): String {
    val grouped = String.format(Locale.US, "%,d", kotlin.math.abs(value)).replace(',', '.')
    return if (value < 0) "-Rp $grouped" else "Rp $grouped"
}

fun formatCompactRupiah(value: Long): String {
    val absolute = kotlin.math.abs(value)
    val prefix = if (value < 0) "-" else ""
    return when {
        absolute >= 1_000_000_000 -> {
            "${prefix}Rp ${String.format(Locale("id", "ID"), "%.1f", absolute / 1_000_000_000.0)} M"
        }

        absolute >= 1_000_000 -> {
            "${prefix}Rp ${String.format(Locale("id", "ID"), "%.1f", absolute / 1_000_000.0)} jt"
        }

        else -> {
            formatRupiah(value)
        }
    }
}

fun formatPercent(value: Double): String = "${String.format(Locale("id", "ID"), "%.1f", value)}%"
