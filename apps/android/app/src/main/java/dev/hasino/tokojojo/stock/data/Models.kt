package dev.hasino.tokojojo.stock.data

enum class StockLocation(
    val label: String,
) {
    WAREHOUSE("WH-BACK"),
    STORE("STORE-FRONT"),
}

enum class StockStatus {
    AMAN,
    MENIPIS,
    HABIS,
}

enum class DemoMode {
    NORMAL,
    OFFLINE,
    ERROR,
}

data class Product(
    val id: String,
    val sku: String,
    val barcode: String,
    val name: String,
    val category: String,
    val brand: String,
    val unit: String,
    val cost: Long,
    val price: Long,
    val warehouseStock: Int,
    val storeStock: Int,
    val minStock: Int,
    val minStoreStock: Int,
    val colorHex: String,
)

data class Supplier(
    val id: String,
    val name: String,
)

data class ReceiptLine(
    val productId: String,
    val quantity: Int,
    val unitCost: Long,
)

data class Receipt(
    val number: String,
    val supplierName: String,
    val lines: List<ReceiptLine>,
    val createdAt: String,
    val queued: Boolean = false,
)

data class StockAdjustment(
    val id: String,
    val productId: String,
    val productName: String,
    val location: StockLocation,
    val systemQty: Int,
    val physicalQty: Int,
    val reason: String,
    val createdAt: String,
    val status: String = "PENDING_REVIEW",
)

data class UserSession(
    val name: String,
    val role: String,
)
