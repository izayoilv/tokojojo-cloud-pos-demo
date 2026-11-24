package dev.hasino.tokojojo.stock.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.hasino.tokojojo.stock.data.DemoMode
import dev.hasino.tokojojo.stock.data.InvalidPinException
import dev.hasino.tokojojo.stock.data.MockStockRepository
import dev.hasino.tokojojo.stock.data.Product
import dev.hasino.tokojojo.stock.data.Receipt
import dev.hasino.tokojojo.stock.data.ReceiptLine
import dev.hasino.tokojojo.stock.data.StockAdjustment
import dev.hasino.tokojojo.stock.data.StockConnectionException
import dev.hasino.tokojojo.stock.data.StockLocation
import dev.hasino.tokojojo.stock.data.StockRepository
import dev.hasino.tokojojo.stock.data.StockSnapshot
import dev.hasino.tokojojo.stock.data.Supplier
import dev.hasino.tokojojo.stock.data.UserSession
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class StockUiState(
    val session: UserSession? = null,
    val suppliers: List<Supplier> = emptyList(),
    val products: List<Product> = emptyList(),
    val receipts: List<Receipt> = emptyList(),
    val adjustments: List<StockAdjustment> = emptyList(),
    val loginLoading: Boolean = false,
    val loginError: String? = null,
    val isLoading: Boolean = false,
    val isSubmitting: Boolean = false,
    val error: String? = null,
    val demoMode: DemoMode = DemoMode.NORMAL,
    val message: String? = null,
)

class StockViewModel(
    private val repository: StockRepository = MockStockRepository(),
    private val scope: CoroutineScope? = null,
) : ViewModel() {
    private val workScope: CoroutineScope
        get() = scope ?: viewModelScope

    private val _uiState =
        MutableStateFlow(
            StockUiState(
                suppliers = repository.suppliers,
                demoMode = repository.demoMode,
            ),
        )
    val uiState: StateFlow<StockUiState> = _uiState.asStateFlow()

    fun login(pin: String) {
        _uiState.update { it.copy(loginLoading = true, loginError = null) }
        workScope.launch {
            try {
                val session = repository.login(pin)
                _uiState.update { it.copy(session = session, loginLoading = false) }
                loadSnapshot()
            } catch (_: InvalidPinException) {
                _uiState.update {
                    it.copy(loginLoading = false, loginError = "PIN salah")
                }
            } catch (_: Exception) {
                _uiState.update {
                    it.copy(
                        loginLoading = false,
                        loginError = "Tidak dapat masuk. Periksa koneksi.",
                    )
                }
            }
        }
    }

    fun logout() {
        _uiState.update {
            StockUiState(
                suppliers = repository.suppliers,
                demoMode = repository.demoMode,
            )
        }
    }

    fun refresh() {
        workScope.launch { loadSnapshot() }
    }

    fun setDemoMode(mode: DemoMode) {
        repository.setDemoMode(mode)
        val message =
            when (mode) {
                DemoMode.NORMAL -> "Mode demo: Normal"
                DemoMode.OFFLINE -> "Mode demo: Offline — perubahan masuk antrean lokal"
                DemoMode.ERROR -> "Mode demo: Error — muat ulang untuk melihat state gagal"
            }
        _uiState.update {
            it.copy(
                demoMode = mode,
                message = message,
                error = if (mode == DemoMode.ERROR) it.error else null,
            )
        }
    }

    fun submitReceipt(
        supplierId: String,
        lines: List<ReceiptLine>,
    ) {
        if (lines.isEmpty()) {
            _uiState.update { it.copy(message = "Tambahkan minimal satu baris penerimaan") }
            return
        }

        _uiState.update { it.copy(isSubmitting = true, error = null) }
        workScope.launch {
            try {
                val snapshot = repository.submitReceipt(supplierId, lines)
                applySnapshot(snapshot)
                val receipt = snapshot.receipts.first()
                val message =
                    if (receipt.queued) {
                        "Penerimaan tersimpan lokal — menunggu koneksi"
                    } else {
                        "Penerimaan ${receipt.number} tersimpan"
                    }
                _uiState.update { it.copy(isSubmitting = false, message = message) }
            } catch (error: Exception) {
                _uiState.update {
                    it.copy(
                        isSubmitting = false,
                        message = error.message ?: "Penerimaan gagal disimpan",
                    )
                }
            }
        }
    }

    fun submitAdjustment(
        productId: String,
        location: StockLocation,
        physicalQty: Int,
        reason: String,
    ) {
        if (physicalQty < 0) {
            _uiState.update { it.copy(message = "Jumlah fisik tidak valid") }
            return
        }

        _uiState.update { it.copy(isSubmitting = true, error = null) }
        workScope.launch {
            try {
                val snapshot = repository.submitAdjustment(productId, location, physicalQty, reason)
                applySnapshot(snapshot)
                _uiState.update {
                    it.copy(
                        isSubmitting = false,
                        message = "Penyesuaian dikirim — menunggu persetujuan OWNER/ADMIN",
                    )
                }
            } catch (error: Exception) {
                _uiState.update {
                    it.copy(
                        isSubmitting = false,
                        message = error.message ?: "Penyesuaian gagal dikirim",
                    )
                }
            }
        }
    }

    fun clearMessage() {
        _uiState.update { it.copy(message = null) }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    private suspend fun loadSnapshot() {
        _uiState.update { it.copy(isLoading = true) }
        try {
            applySnapshot(repository.loadSnapshot())
            _uiState.update { it.copy(isLoading = false, error = null) }
        } catch (error: StockConnectionException) {
            _uiState.update {
                it.copy(
                    isLoading = false,
                    error = "Tidak dapat memuat data stok. Periksa koneksi lalu coba lagi.",
                )
            }
        } catch (error: Exception) {
            _uiState.update {
                it.copy(
                    isLoading = false,
                    error = error.message ?: "Terjadi kesalahan saat memuat data",
                )
            }
        }
    }

    private fun applySnapshot(snapshot: StockSnapshot) {
        _uiState.update {
            it.copy(
                products = snapshot.products,
                receipts = snapshot.receipts,
                adjustments = snapshot.adjustments,
            )
        }
    }
}
