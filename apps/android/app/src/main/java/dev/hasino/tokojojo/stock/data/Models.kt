package dev.hasino.tokojojo.stock.data

enum class Location(
    val label: String,
) {
    WAREHOUSE("Gudang Belakang"),
    STORE("Area Toko"),
}

enum class StockStatus {
    AMAN,
    MENIPIS,
    HABIS,
}

enum class ConnectionState {
    ONLINE,
    OFFLINE,
    ERROR,
}

enum class ThemeMode {
    LIGHT,
    DARK,
    SYSTEM,
}

enum class TextSize {
    NORMAL,
    LARGE,
}

enum class DeviceStatus {
    APPROVED,
    PENDING,
    REVOKED,
}

data class ProductUnit(
    val id: String,
    val name: String,
    val conversionQty: Int,
    val sellingPrice: Long,
    val barcode: String,
)

data class Product(
    val id: String,
    val sku: String,
    val barcode: String,
    val name: String,
    val category: String,
    val units: List<ProductUnit>,
    val cost: Long,
    val price: Long,
    val warehouseStock: Int,
    val storeStock: Int,
    val minWarehouse: Int,
    val minStore: Int,
) {
    val baseUnit: ProductUnit
        get() = units.first { it.conversionQty == 1 }
}

data class StockMovement(
    val time: String,
    val type: String,
    val location: Location,
    val quantity: Int,
    val reference: String,
)

data class Supplier(
    val id: String,
    val name: String,
    val phone: String,
)

data class ReceiveLine(
    val productId: String,
    val unitId: String,
    val quantity: Int,
    val unitCost: Long,
)

data class Receipt(
    val id: String,
    val number: String,
    val supplierName: String,
    val time: String,
    val total: Long,
    val status: String,
    val queued: Boolean = false,
)

data class Adjustment(
    val id: String,
    val productId: String,
    val productName: String,
    val location: Location,
    val systemQty: Int,
    val physicalQty: Int,
    val reason: String,
    val time: String,
    val status: String = "PENDING_REVIEW",
)

data class TransferLine(
    val productId: String,
    val unitId: String,
    val quantity: Int,
)

data class Transfer(
    val id: String,
    val number: String,
    val from: Location,
    val to: Location,
    val status: String,
    val createdBy: String,
    val time: String,
    val lines: List<TransferLine>,
)

data class OpnameItem(
    val productId: String,
    val systemQty: Int,
    val physicalQty: Int,
)

data class Opname(
    val id: String,
    val number: String,
    val location: Location,
    val status: String,
    val createdBy: String,
    val time: String,
    val items: List<OpnameItem>,
)

data class UserSession(
    val name: String,
    val username: String,
    val role: String,
    val location: Location,
)

data class DeviceInfo(
    val name: String,
    val status: DeviceStatus,
    val lastChecked: String,
)
