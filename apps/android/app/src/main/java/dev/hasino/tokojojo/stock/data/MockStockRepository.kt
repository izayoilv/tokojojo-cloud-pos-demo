package dev.hasino.tokojojo.stock.data

import kotlinx.coroutines.delay
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Locale

data class StockSnapshot(
    val products: List<Product>,
    val receipts: List<Receipt>,
    val adjustments: List<StockAdjustment>,
)

class InvalidPinException : Exception("PIN salah")

class StockConnectionException : Exception("Tidak dapat terhubung ke server")

interface StockRepository {
    val suppliers: List<Supplier>
    val demoMode: DemoMode

    suspend fun login(pin: String): UserSession

    suspend fun loadSnapshot(): StockSnapshot

    suspend fun submitReceipt(
        supplierId: String,
        lines: List<ReceiptLine>,
    ): StockSnapshot

    suspend fun submitAdjustment(
        productId: String,
        location: StockLocation,
        physicalQty: Int,
        reason: String,
    ): StockSnapshot

    fun setDemoMode(mode: DemoMode)
}

class MockStockRepository(
    private val delayMillis: Long = 280,
) : StockRepository {
    override val suppliers =
        listOf(
            Supplier("SUP-01", "PT Indomarco Adi Prima (Cabang Batam)"),
            Supplier("SUP-02", "CV Sumber Pangan Sembako"),
            Supplier("SUP-03", "PT Distribusi Nusantara Raya"),
        )

    override var demoMode: DemoMode = DemoMode.NORMAL
        private set

    private val products = seedProducts().toMutableList()
    private val receipts = mutableListOf<Receipt>()
    private val adjustments = mutableListOf<StockAdjustment>()

    override suspend fun login(pin: String): UserSession {
        delay(delayMillis)
        if (pin != DEMO_PIN) throw InvalidPinException()
        return UserSession(name = "Hendra Saputra", role = "WAREHOUSE")
    }

    override suspend fun loadSnapshot(): StockSnapshot {
        gate()
        return snapshot()
    }

    override suspend fun submitReceipt(
        supplierId: String,
        lines: List<ReceiptLine>,
    ): StockSnapshot {
        gate()
        val supplier =
            suppliers.firstOrNull { it.id == supplierId }
                ?: throw IllegalArgumentException("Supplier tidak ditemukan")
        if (lines.isEmpty()) throw IllegalArgumentException("Baris penerimaan kosong")
        if (lines.any { it.quantity <= 0 }) {
            throw IllegalArgumentException("Jumlah harus lebih dari nol")
        }

        for (line in lines) {
            val index = products.indexOfFirst { it.id == line.productId }
            if (index < 0) throw IllegalArgumentException("Produk tidak ditemukan")
            val product = products[index]
            products[index] = product.copy(warehouseStock = product.warehouseStock + line.quantity)
        }

        receipts.add(
            0,
            Receipt(
                number = "GRN/${LocalDate.now()}/${String.format(Locale.US, "%03d", receipts.size + 1)}",
                supplierName = supplier.name,
                lines = lines,
                createdAt = LocalTime.now().format(TIME_FORMAT),
                queued = demoMode == DemoMode.OFFLINE,
            ),
        )

        return snapshot()
    }

    override suspend fun submitAdjustment(
        productId: String,
        location: StockLocation,
        physicalQty: Int,
        reason: String,
    ): StockSnapshot {
        gate()
        val product =
            products.firstOrNull { it.id == productId }
                ?: throw IllegalArgumentException("Produk tidak ditemukan")
        if (physicalQty < 0) throw IllegalArgumentException("Jumlah fisik tidak valid")

        adjustments.add(
            0,
            StockAdjustment(
                id = "ADJ/${LocalDate.now()}/${String.format(Locale.US, "%03d", adjustments.size + 1)}",
                productId = product.id,
                productName = product.name,
                location = location,
                systemQty = stockAt(product, location),
                physicalQty = physicalQty,
                reason = reason.ifBlank { "Penyesuaian manual" },
                createdAt = LocalTime.now().format(TIME_FORMAT),
            ),
        )

        return snapshot()
    }

    override fun setDemoMode(mode: DemoMode) {
        demoMode = mode
    }

    private fun snapshot() =
        StockSnapshot(
            products = products.toList(),
            receipts = receipts.toList(),
            adjustments = adjustments.toList(),
        )

    private suspend fun gate() {
        delay(delayMillis)
        if (demoMode == DemoMode.ERROR) throw StockConnectionException()
    }

    companion object {
        const val DEMO_PIN = "4321"
        private val TIME_FORMAT = DateTimeFormatter.ofPattern("HH:mm")
    }
}

fun stockAt(
    product: Product,
    location: StockLocation,
): Int =
    when (location) {
        StockLocation.WAREHOUSE -> product.warehouseStock
        StockLocation.STORE -> product.storeStock
    }

private fun seedProducts(): List<Product> =
    listOf(
        Product(
            id = "PRD-001",
            sku = "SMB-BRS-001",
            barcode = "8992761110012",
            name = "Beras Setra Ramos Cap Topi Koki 5kg",
            category = "Sembako Utama",
            brand = "Topi Koki",
            unit = "Karung",
            cost = 64_200,
            price = 73_500,
            warehouseStock = 45,
            storeStock = 12,
            minStock = 25,
            minStoreStock = 10,
            colorHex = "#2563EB",
        ),
        Product(
            id = "PRD-002",
            sku = "SMB-MNY-002",
            barcode = "8992775201027",
            name = "Minyak Goreng Bimoli Klasik Pouch 2L",
            category = "Sembako Utama",
            brand = "Bimoli",
            unit = "Pouch",
            cost = 33_000,
            price = 37_500,
            warehouseStock = 60,
            storeStock = 6,
            minStock = 30,
            minStoreStock = 12,
            colorHex = "#D97706",
        ),
        Product(
            id = "PRD-003",
            sku = "MIE-IND-003",
            barcode = "089686010947",
            name = "Indomie Mi Instan Goreng Spesial 85g",
            category = "Mi & Makanan Instan",
            brand = "Indomie",
            unit = "Bungkus",
            cost = 2_720,
            price = 3_200,
            warehouseStock = 320,
            storeStock = 85,
            minStock = 120,
            minStoreStock = 40,
            colorHex = "#DC2626",
        ),
        Product(
            id = "PRD-004",
            sku = "SMB-GLA-004",
            barcode = "8995177101018",
            name = "Gulaku Gula Pasir Tebu Premium 1kg",
            category = "Sembako Utama",
            brand = "Gulaku",
            unit = "Bungkus",
            cost = 15_750,
            price = 18_000,
            warehouseStock = 14,
            storeStock = 4,
            minStock = 30,
            minStoreStock = 10,
            colorHex = "#16A34A",
        ),
        Product(
            id = "PRD-005",
            sku = "MNM-KPI-005",
            barcode = "8991002101234",
            name = "Kopi Kapal Api Special Mix Renceng",
            category = "Minuman & Kopi",
            brand = "Kapal Api",
            unit = "Renceng",
            cost = 13_100,
            price = 15_500,
            warehouseStock = 50,
            storeStock = 18,
            minStock = 25,
            minStoreStock = 10,
            colorHex = "#7C2D12",
        ),
        Product(
            id = "PRD-006",
            sku = "SUS-FFG-006",
            barcode = "8992753102211",
            name = "SKM Frisian Flag Putih Pouch 545g",
            category = "Susu & Olahan",
            brand = "Frisian Flag",
            unit = "Pouch",
            cost = 14_850,
            price = 17_500,
            warehouseStock = 38,
            storeStock = 15,
            minStock = 20,
            minStoreStock = 8,
            colorHex = "#0284C7",
        ),
        Product(
            id = "PRD-007",
            sku = "BMB-KCP-007",
            barcode = "8999999001124",
            name = "Kecap Manis Bango Refill 520ml",
            category = "Bumbu Dapur",
            brand = "Bango",
            unit = "Pouch",
            cost = 21_400,
            price = 25_000,
            warehouseStock = 8,
            storeStock = 3,
            minStock = 20,
            minStoreStock = 8,
            colorHex = "#4D7C0F",
        ),
        Product(
            id = "PRD-008",
            sku = "RTG-SLG-008",
            barcode = "8998866200349",
            name = "Sunlight Jeruk Nipis 650ml",
            category = "RT & Kebersihan",
            brand = "Sunlight",
            unit = "Pouch",
            cost = 12_300,
            price = 15_000,
            warehouseStock = 0,
            storeStock = 0,
            minStock = 24,
            minStoreStock = 8,
            colorHex = "#15803D",
        ),
        Product(
            id = "PRD-009",
            sku = "MNM-AQU-009",
            barcode = "8886008101053",
            name = "Aqua Botol 600ml (Dus 24)",
            category = "Minuman & Kopi",
            brand = "Aqua",
            unit = "Dus",
            cost = 43_800,
            price = 51_000,
            warehouseStock = 32,
            storeStock = 10,
            minStock = 15,
            minStoreStock = 5,
            colorHex = "#0369A1",
        ),
        Product(
            id = "PRD-010",
            sku = "SMB-TLR-010",
            barcode = "2001000000105",
            name = "Telur Ayam Negeri (Tray 30 butir)",
            category = "Sembako Utama",
            brand = "Lokal",
            unit = "Tray",
            cost = 48_800,
            price = 55_000,
            warehouseStock = 15,
            storeStock = 9,
            minStock = 12,
            minStoreStock = 6,
            colorHex = "#B45309",
        ),
        Product(
            id = "PRD-011",
            sku = "MNM-TEH-011",
            barcode = "8991002502016",
            name = "Teh Celup Sariwangi isi 100",
            category = "Minuman & Kopi",
            brand = "Sariwangi",
            unit = "Kotak",
            cost = 8_200,
            price = 9_800,
            warehouseStock = 26,
            storeStock = 11,
            minStock = 15,
            minStoreStock = 6,
            colorHex = "#166534",
        ),
        Product(
            id = "PRD-012",
            sku = "RTG-LIF-012",
            barcode = "8999999056230",
            name = "Sabun Mandi Lifebuoy Total 10",
            category = "RT & Kebersihan",
            brand = "Lifebuoy",
            unit = "Pcs",
            cost = 4_100,
            price = 5_200,
            warehouseStock = 40,
            storeStock = 14,
            minStock = 20,
            minStoreStock = 8,
            colorHex = "#0E7490",
        ),
    )
