package dev.hasino.tokojojo.stock.ui

import dev.hasino.tokojojo.stock.data.DemoMode
import dev.hasino.tokojojo.stock.data.MockStockRepository
import dev.hasino.tokojojo.stock.data.ReceiptLine
import dev.hasino.tokojojo.stock.data.StockLocation
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class StockViewModelTest {
    @Test
    fun `login accepts the demo pin and loads products`() =
        runTest {
            val viewModel = StockViewModel(MockStockRepository(delayMillis = 0), this)

            viewModel.login("4321")
            advanceUntilIdle()

            assertEquals(
                "Hendra Saputra",
                viewModel.uiState.value.session
                    ?.name,
            )
            assertEquals(
                "WAREHOUSE",
                viewModel.uiState.value.session
                    ?.role,
            )
            assertEquals(12, viewModel.uiState.value.products.size)
            assertNull(viewModel.uiState.value.loginError)
        }

    @Test
    fun `login rejects a wrong pin`() =
        runTest {
            val viewModel = StockViewModel(MockStockRepository(delayMillis = 0), this)

            viewModel.login("1111")
            advanceUntilIdle()

            assertNull(viewModel.uiState.value.session)
            assertEquals("PIN salah", viewModel.uiState.value.loginError)
        }

    @Test
    fun `receipt increments warehouse stock and records a receipt`() =
        runTest {
            val viewModel = StockViewModel(MockStockRepository(delayMillis = 0), this)
            viewModel.login("4321")
            advanceUntilIdle()

            viewModel.submitReceipt(
                supplierId = "SUP-01",
                lines = listOf(ReceiptLine("PRD-001", quantity = 2, unitCost = 64_200)),
            )
            advanceUntilIdle()

            val product =
                viewModel.uiState.value.products
                    .first { it.id == "PRD-001" }
            assertEquals(47, product.warehouseStock)
            assertEquals(1, viewModel.uiState.value.receipts.size)
            assertFalse(
                viewModel.uiState.value.receipts
                    .single()
                    .queued,
            )
        }

    @Test
    fun `receipt is queued when offline`() =
        runTest {
            val viewModel = StockViewModel(MockStockRepository(delayMillis = 0), this)
            viewModel.login("4321")
            advanceUntilIdle()
            viewModel.setDemoMode(DemoMode.OFFLINE)

            viewModel.submitReceipt(
                supplierId = "SUP-01",
                lines = listOf(ReceiptLine("PRD-001", quantity = 1, unitCost = 64_200)),
            )
            advanceUntilIdle()

            assertTrue(
                viewModel.uiState.value.receipts
                    .single()
                    .queued,
            )
        }

    @Test
    fun `adjustment is pending and leaves stock unchanged`() =
        runTest {
            val viewModel = StockViewModel(MockStockRepository(delayMillis = 0), this)
            viewModel.login("4321")
            advanceUntilIdle()

            viewModel.submitAdjustment(
                productId = "PRD-003",
                location = StockLocation.STORE,
                physicalQty = 83,
                reason = "2 bungkus kemasan sobek",
            )
            advanceUntilIdle()

            val adjustment =
                viewModel.uiState.value.adjustments
                    .single()
            assertEquals(-2, adjustment.physicalQty - adjustment.systemQty)
            assertEquals("PENDING_REVIEW", adjustment.status)
            val product =
                viewModel.uiState.value.products
                    .first { it.id == "PRD-003" }
            assertEquals(85, product.storeStock)
        }

    @Test
    fun `refresh surfaces a connection error`() =
        runTest {
            val viewModel = StockViewModel(MockStockRepository(delayMillis = 0), this)
            viewModel.login("4321")
            advanceUntilIdle()
            viewModel.setDemoMode(DemoMode.ERROR)

            viewModel.refresh()
            advanceUntilIdle()

            assertNotNull(viewModel.uiState.value.error)
        }

    @Test
    fun `demo mode updates and messages can be cleared`() =
        runTest {
            val viewModel = StockViewModel(MockStockRepository(delayMillis = 0), this)
            viewModel.login("4321")
            advanceUntilIdle()

            viewModel.setDemoMode(DemoMode.OFFLINE)
            assertEquals(DemoMode.OFFLINE, viewModel.uiState.value.demoMode)
            assertNotNull(viewModel.uiState.value.message)

            viewModel.clearMessage()
            assertNull(viewModel.uiState.value.message)
        }
}
