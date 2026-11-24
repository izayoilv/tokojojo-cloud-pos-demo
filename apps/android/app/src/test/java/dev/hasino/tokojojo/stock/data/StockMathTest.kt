package dev.hasino.tokojojo.stock.data

import org.junit.Assert.assertEquals
import org.junit.Test

class StockMathTest {
    private val beras =
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
        )

    @Test
    fun `total stock adds both locations`() {
        assertEquals(57, totalStock(beras))
    }

    @Test
    fun `stock status is safe above both minimums`() {
        assertEquals(StockStatus.AMAN, stockStatus(beras))
    }

    @Test
    fun `stock status is low when store stock reaches its minimum`() {
        assertEquals(StockStatus.MENIPIS, stockStatus(beras.copy(storeStock = 10)))
    }

    @Test
    fun `stock status is empty when both locations are zero`() {
        assertEquals(
            StockStatus.HABIS,
            stockStatus(beras.copy(warehouseStock = 0, storeStock = 0)),
        )
    }

    @Test
    fun `inventory value uses total stock at cost`() {
        assertEquals(3_659_400L, inventoryValue(listOf(beras)))
        assertEquals(0L, inventoryValue(emptyList()))
    }

    @Test
    fun `retail value uses total stock at selling price`() {
        assertEquals(4_189_500L, retailValue(listOf(beras)))
    }

    @Test
    fun `receipt total multiplies quantity by unit cost`() {
        val lines =
            listOf(
                ReceiptLine(productId = "PRD-001", quantity = 2, unitCost = 64_200),
                ReceiptLine(productId = "PRD-002", quantity = 3, unitCost = 33_000),
            )

        assertEquals(227_400L, receiptTotal(lines))
    }

    @Test
    fun `search matches name sku and barcode case insensitively`() {
        val minyak =
            beras.copy(
                id = "PRD-002",
                sku = "SMB-MNY-002",
                barcode = "8992775201027",
                name = "Minyak Goreng Bimoli Pouch 2L",
            )
        val products = listOf(beras, minyak)

        assertEquals(listOf(beras), searchProducts(products, "beras"))
        assertEquals(listOf(minyak), searchProducts(products, "smb-mny"))
        assertEquals(listOf(minyak), searchProducts(products, "8992775"))
        assertEquals(products, searchProducts(products, "  "))
    }

    @Test
    fun `variance and adjustment value follow physical minus system`() {
        assertEquals(-2, stockVariance(system = 85, physical = 83))
        assertEquals(0L, adjustmentValue(stockVariance(4, 4), unitCost = 15_750))
        assertEquals(-31_500L, adjustmentValue(stockVariance(4, 2), unitCost = 15_750))
        assertEquals(31_500L, adjustmentValue(stockVariance(4, 6), unitCost = 15_750))
    }

    @Test
    fun `rupiah formatting uses Indonesian separators`() {
        assertEquals("Rp 73.500", formatRupiah(73_500))
        assertEquals("Rp 0", formatRupiah(0))
        assertEquals("Rp 1.234.567", formatRupiah(1_234_567))
        assertEquals("-Rp 31.500", formatRupiah(-31_500))
    }
}
