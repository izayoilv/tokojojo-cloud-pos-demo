package dev.hasino.tokojojo.stock.data

import org.junit.Assert.assertEquals
import org.junit.Test

class StockMathTest {
    private val bungkus = ProductUnit("U-1", "Bungkus", 1, 3_200, "899000000001")
    private val dus = ProductUnit("U-2", "Dus", 40, 128_000, "899000000002")
    private val indomie =
        Product(
            id = "PRD-003",
            sku = "MIE-IND-003",
            barcode = "089686010947",
            name = "Indomie Mi Instan Goreng Spesial 85g",
            category = "Makanan Instan",
            units = listOf(bungkus, dus),
            cost = 2_720,
            price = 3_200,
            warehouseStock = 320,
            storeStock = 85,
            minWarehouse = 120,
            minStore = 40,
        )

    @Test
    fun `base unit is the conversion one unit`() {
        assertEquals(bungkus, indomie.baseUnit)
    }

    @Test
    fun `receive line converts selected unit to base quantity`() {
        val line = ReceiveLine(indomie.id, dus.id, quantity = 2, unitCost = 110_000)
        assertEquals(80, baseQuantity(indomie, line))
        assertEquals(220_000L, lineSubtotal(line))
    }

    @Test
    fun `stock status uses per-location thresholds`() {
        assertEquals(StockStatus.AMAN, stockStatus(indomie))
        assertEquals(
            StockStatus.MENIPIS,
            stockStatus(indomie.copy(storeStock = 40)),
        )
        assertEquals(
            StockStatus.HABIS,
            stockStatus(indomie.copy(warehouseStock = 0, storeStock = 0)),
        )
    }

    @Test
    fun `inventory and retail value use base stock`() {
        assertEquals(1_101_600L, inventoryValue(listOf(indomie)))
        assertEquals(1_296_000L, retailValue(listOf(indomie)))
    }

    @Test
    fun `search matches name sku and barcode`() {
        val beras =
            indomie.copy(
                id = "PRD-001",
                sku = "SMB-BRS-001",
                barcode = "8992761110012",
                name = "Beras Setra Ramos 5kg",
            )
        val products = listOf(indomie, beras)

        assertEquals(listOf(beras), searchProducts(products, "beras"))
        assertEquals(listOf(beras), searchProducts(products, "smb-brs"))
        assertEquals(listOf(beras), searchProducts(products, "8992761"))
        assertEquals(products, searchProducts(products, ""))
    }

    @Test
    fun `variance and adjustment value handle negative system stock`() {
        assertEquals(-3, stockVariance(system = -1, physical = -4))
        assertEquals(-96_000L, adjustmentValue(stockVariance(4, 0), unitCost = 24_000))
    }

    @Test
    fun `rupiah formatting is Indonesian and negative is prefixed`() {
        assertEquals("Rp 73.500", formatRupiah(73_500))
        assertEquals("-Rp 31.500", formatRupiah(-31_500))
        assertEquals("Rp 3,2 jt", formatCompactRupiah(3_200_000))
        assertEquals("Rp 1,2 M", formatCompactRupiah(1_200_000_000))
        assertEquals("33.000", formatThousands(33_000))
    }
}
