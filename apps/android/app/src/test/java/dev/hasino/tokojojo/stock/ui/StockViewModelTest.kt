package dev.hasino.tokojojo.stock.ui

import dev.hasino.tokojojo.stock.data.ConnectionState
import dev.hasino.tokojojo.stock.data.DeviceStatus
import dev.hasino.tokojojo.stock.data.Location
import dev.hasino.tokojojo.stock.data.ReceiveLine
import dev.hasino.tokojojo.stock.data.TransferLine
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class StockViewModelTest {
    private fun viewModel(scope: kotlinx.coroutines.CoroutineScope) = StockViewModel(scope = scope, delayMillis = 0)

    @Test
    fun `login loads warehouse data`() =
        runTest {
            val vm = viewModel(this)
            vm.login("gudang", "tokojojo123")
            advanceUntilIdle()

            assertEquals(
                "Hendra Saputra",
                vm.uiState.value.session
                    ?.name,
            )
            assertEquals(12, vm.uiState.value.products.size)
            assertNull(vm.uiState.value.loginError)
            assertEquals(DeviceStatus.APPROVED, vm.uiState.value.device.status)
        }

    @Test
    fun `login rejects bad credentials`() =
        runTest {
            val vm = viewModel(this)
            vm.login("gudang", "salah")
            advanceUntilIdle()

            assertNull(vm.uiState.value.session)
            assertEquals("Username atau password salah.", vm.uiState.value.loginError)
        }

    @Test
    fun `receipt converts selected unit and increments warehouse`() =
        runTest {
            val vm = viewModel(this)
            vm.login("gudang", "tokojojo123")
            advanceUntilIdle()

            vm.submitReceipt(
                supplierId = "SUP-01",
                reference = "INV-001",
                notes = "",
                lines = listOf(ReceiveLine("PRD-003", "U-013", quantity = 2, unitCost = 110_000)),
            )
            advanceUntilIdle()

            val product =
                vm.uiState.value.products
                    .first { it.id == "PRD-003" }
            assertEquals(400, product.warehouseStock)
            assertEquals(3, vm.uiState.value.receipts.size)
            assertEquals(
                220_000L,
                vm.uiState.value.receipts
                    .first()
                    .total,
            )
        }

    @Test
    fun `offline receipt is queued`() =
        runTest {
            val vm = viewModel(this)
            vm.login("gudang", "tokojojo123")
            advanceUntilIdle()
            vm.setConnection(ConnectionState.OFFLINE)

            vm.submitReceipt(
                supplierId = "SUP-01",
                reference = "INV-002",
                notes = "",
                lines = listOf(ReceiveLine("PRD-001", "U-001", quantity = 1, unitCost = 64_200)),
            )
            advanceUntilIdle()

            assertTrue(
                vm.uiState.value.receipts
                    .first()
                    .queued,
            )
        }

    @Test
    fun `adjustment waits for approval without changing stock`() =
        runTest {
            val vm = viewModel(this)
            vm.login("gudang", "tokojojo123")
            advanceUntilIdle()

            vm.submitAdjustment("PRD-003", Location.STORE, physicalQty = 83, reason = "Kemasan sobek")
            advanceUntilIdle()

            val adjustment =
                vm.uiState.value.adjustments
                    .first()
            assertEquals(-2, adjustment.physicalQty - adjustment.systemQty)
            assertEquals(
                85,
                vm.uiState.value.products
                    .first { it.id == "PRD-003" }
                    .storeStock,
            )
        }

    @Test
    fun `completing a transfer moves stock between locations`() =
        runTest {
            val vm = viewModel(this)
            vm.login("gudang", "tokojojo123")
            advanceUntilIdle()
            vm.createTransfer(
                from = Location.WAREHOUSE,
                to = Location.STORE,
                lines = listOf(TransferLine("PRD-001", "U-001", quantity = 5)),
            )
            advanceUntilIdle()
            val created =
                vm.uiState.value.transfers
                    .first()
            vm.completeTransfer(created.id)
            advanceUntilIdle()

            val product =
                vm.uiState.value.products
                    .first { it.id == "PRD-001" }
            assertEquals(40, product.warehouseStock)
            assertEquals(17, product.storeStock)
        }

    @Test
    fun `pending device status is exposed to the app`() =
        runTest {
            val vm = viewModel(this)
            vm.login("gudang", "tokojojo123")
            advanceUntilIdle()
            vm.setDeviceStatus(DeviceStatus.PENDING)

            assertEquals(DeviceStatus.PENDING, vm.uiState.value.device.status)
            assertNotNull(vm.uiState.value.message)
        }
}
