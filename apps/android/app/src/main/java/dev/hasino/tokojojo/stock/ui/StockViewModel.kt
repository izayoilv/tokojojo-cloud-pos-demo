package dev.hasino.tokojojo.stock.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.hasino.tokojojo.stock.data.Adjustment
import dev.hasino.tokojojo.stock.data.ConnectionState
import dev.hasino.tokojojo.stock.data.DeviceInfo
import dev.hasino.tokojojo.stock.data.DeviceStatus
import dev.hasino.tokojojo.stock.data.Location
import dev.hasino.tokojojo.stock.data.MockData
import dev.hasino.tokojojo.stock.data.Opname
import dev.hasino.tokojojo.stock.data.Product
import dev.hasino.tokojojo.stock.data.Receipt
import dev.hasino.tokojojo.stock.data.ReceiveLine
import dev.hasino.tokojojo.stock.data.StockMovement
import dev.hasino.tokojojo.stock.data.Supplier
import dev.hasino.tokojojo.stock.data.TextSize
import dev.hasino.tokojojo.stock.data.ThemeMode
import dev.hasino.tokojojo.stock.data.Transfer
import dev.hasino.tokojojo.stock.data.TransferLine
import dev.hasino.tokojojo.stock.data.UserSession
import dev.hasino.tokojojo.stock.data.baseQuantity
import dev.hasino.tokojojo.stock.data.receiptTotal
import dev.hasino.tokojojo.stock.data.transferBaseQuantity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class StockUiState(
    val session: UserSession? = null,
    val device: DeviceInfo = DeviceInfo("Pixel 8 · Android 16", DeviceStatus.APPROVED, "24 Nov 2026, 14:30 WIB"),
    val connection: ConnectionState = ConnectionState.ONLINE,
    val loginLoading: Boolean = false,
    val loginError: String? = null,
    val products: List<Product> = emptyList(),
    val movements: Map<String, List<StockMovement>> = emptyMap(),
    val suppliers: List<Supplier> = emptyList(),
    val receipts: List<Receipt> = emptyList(),
    val adjustments: List<Adjustment> = emptyList(),
    val transfers: List<Transfer> = emptyList(),
    val opnames: List<Opname> = emptyList(),
    val themeMode: ThemeMode = ThemeMode.SYSTEM,
    val textSize: TextSize = TextSize.NORMAL,
    val scannerSound: Boolean = true,
    val scannerVibrate: Boolean = true,
    val defaultLocation: Location = Location.WAREHOUSE,
    val loading: Boolean = false,
    val error: String? = null,
    val lastSync: String = "24 Nov 2026, 14:30 WIB",
    val message: String? = null,
    val todaySales: Long = 3_200_000,
    val todayTransactions: Int = 38,
)

class StockViewModel(
    private val scope: CoroutineScope? = null,
    private val delayMillis: Long = 300,
) : ViewModel() {
    private val workScope: CoroutineScope
        get() = scope ?: viewModelScope

    private val _uiState = MutableStateFlow(StockUiState())
    val uiState: StateFlow<StockUiState> = _uiState.asStateFlow()

    fun login(
        username: String,
        password: String,
    ) {
        if (_uiState.value.connection != ConnectionState.ONLINE) {
            _uiState.update {
                it.copy(
                    loginError = "Koneksi terputus. Coba lagi.",
                    loginLoading = false,
                )
            }
            return
        }

        _uiState.update { it.copy(loginLoading = true, loginError = null) }
        workScope.launch {
            delay(delayMillis)
            val user = demoUser(username)
            if (user == null || password != DEMO_PASSWORD) {
                _uiState.update {
                    it.copy(
                        loginLoading = false,
                        loginError = "Username atau password salah.",
                    )
                }
                return@launch
            }

            _uiState.update {
                it.copy(
                    session = user,
                    loginLoading = false,
                    loginError = null,
                    products = MockData.products,
                    movements = MockData.movements,
                    suppliers = MockData.suppliers,
                    receipts = MockData.receipts,
                    adjustments = MockData.adjustments,
                    transfers = MockData.transfers,
                    opnames = MockData.opnames,
                    defaultLocation = user.location,
                )
            }
        }
    }

    fun logout() {
        _uiState.update {
            it.copy(
                session = null,
                products = emptyList(),
                movements = emptyMap(),
                suppliers = emptyList(),
                receipts = emptyList(),
                adjustments = emptyList(),
                transfers = emptyList(),
                opnames = emptyList(),
                loginError = null,
                loginLoading = false,
                message = null,
            )
        }
    }

    fun refresh() {
        _uiState.update { it.copy(loading = true, error = null) }
        workScope.launch {
            delay(delayMillis)
            when (_uiState.value.connection) {
                ConnectionState.ERROR -> {
                    _uiState.update {
                        it.copy(
                            loading = false,
                            error = "Koneksi terputus. Data mungkin tertinggal.",
                        )
                    }
                }

                ConnectionState.OFFLINE -> {
                    _uiState.update {
                        it.copy(
                            loading = false,
                            message = "Masih offline. Data terakhir tetap ditampilkan.",
                        )
                    }
                }

                ConnectionState.ONLINE -> {
                    _uiState.update {
                        it.copy(
                            loading = false,
                            error = null,
                            lastSync = "25 Nov 2026, 08:30 WIB",
                            message = "Data diperbarui.",
                        )
                    }
                }
            }
        }
    }

    fun setConnection(state: ConnectionState) {
        _uiState.update {
            it.copy(
                connection = state,
                error =
                    if (state == ConnectionState.ERROR) {
                        "Koneksi terputus. Data mungkin tertinggal."
                    } else {
                        null
                    },
                message =
                    when (state) {
                        ConnectionState.ONLINE -> "Koneksi pulih."
                        ConnectionState.OFFLINE -> "Mode offline — draft disimpan di perangkat."
                        ConnectionState.ERROR -> "Mode error — coba lagi untuk memulihkan."
                    },
            )
        }
    }

    fun setTheme(mode: ThemeMode) {
        _uiState.update { it.copy(themeMode = mode) }
    }

    fun setTextSize(size: TextSize) {
        _uiState.update { it.copy(textSize = size) }
    }

    fun setScannerSound(enabled: Boolean) {
        _uiState.update { it.copy(scannerSound = enabled) }
    }

    fun setScannerVibrate(enabled: Boolean) {
        _uiState.update { it.copy(scannerVibrate = enabled) }
    }

    fun setDefaultLocation(location: Location) {
        _uiState.update { it.copy(defaultLocation = location) }
    }

    fun setDeviceStatus(status: DeviceStatus) {
        _uiState.update {
            it.copy(
                device = it.device.copy(status = status),
                message =
                    when (status) {
                        DeviceStatus.APPROVED -> "Perangkat disetujui (demo)."
                        DeviceStatus.PENDING -> "Perangkat menunggu persetujuan admin."
                        DeviceStatus.REVOKED -> "Perangkat dicabut. Hubungi admin."
                    },
            )
        }
    }

    fun submitReceipt(
        supplierId: String,
        reference: String,
        notes: String,
        lines: List<ReceiveLine>,
    ) {
        val supplier = MockData.suppliers.firstOrNull { it.id == supplierId }
        if (supplier == null) {
            _uiState.update { it.copy(message = "Supplier wajib dipilih.") }
            return
        }
        if (lines.isEmpty()) {
            _uiState.update { it.copy(message = "Tambahkan minimal satu baris barang.") }
            return
        }
        if (lines.any { it.quantity <= 0 }) {
            _uiState.update { it.copy(message = "Jumlah setiap baris harus lebih dari nol.") }
            return
        }

        workScope.launch {
            delay(delayMillis)
            val total = receiptTotal(lines)
            val receipt =
                Receipt(
                    id = "RCV-${_uiState.value.receipts.size + 1}",
                    number = "PB/2026/11/${String.format("%03d", _uiState.value.receipts.size + 17)}",
                    supplierName = supplier.name,
                    time = "25 Nov 2026, 08:42 WIB",
                    total = total,
                    status = if (_uiState.value.connection == ConnectionState.OFFLINE) "Draft lokal" else "Tersinkron",
                    queued = _uiState.value.connection != ConnectionState.ONLINE,
                )

            val updatedProducts =
                _uiState.value.products.map { product ->
                    val received =
                        lines
                            .filter { it.productId == product.id }
                            .sumOf { baseQuantity(product, it) }
                    if (received == 0) {
                        product
                    } else {
                        product.copy(warehouseStock = product.warehouseStock + received)
                    }
                }

            _uiState.update {
                it.copy(
                    products = updatedProducts,
                    receipts = listOf(receipt) + it.receipts,
                    loading = false,
                    error = null,
                    message =
                        if (receipt.queued) {
                            "Draft penerimaan tersimpan. Akan dikirim saat online."
                        } else {
                            "Penerimaan ${receipt.number} tersimpan."
                        },
                )
            }
        }
    }

    fun submitAdjustment(
        productId: String,
        location: Location,
        physicalQty: Int,
        reason: String,
    ) {
        val product = _uiState.value.products.firstOrNull { it.id == productId }
        if (product == null) {
            _uiState.update { it.copy(message = "Produk wajib dipilih.") }
            return
        }
        if (physicalQty < 0) {
            _uiState.update { it.copy(message = "Stok fisik tidak boleh negatif.") }
            return
        }

        val systemQty =
            if (location == Location.WAREHOUSE) product.warehouseStock else product.storeStock
        val adjustment =
            Adjustment(
                id = "ADJ-${_uiState.value.adjustments.size + 1}",
                productId = product.id,
                productName = product.name,
                location = location,
                systemQty = systemQty,
                physicalQty = physicalQty,
                reason = reason.ifBlank { "Penyesuaian manual" },
                time = "25 Nov 2026, 08:45 WIB",
            )

        _uiState.update {
            it.copy(
                adjustments = listOf(adjustment) + it.adjustments,
                message = "Menunggu persetujuan OWNER/ADMIN.",
            )
        }
    }

    fun createTransfer(
        from: Location,
        to: Location,
        lines: List<TransferLine>,
    ) {
        if (from == to) {
            _uiState.update { it.copy(message = "Lokasi asal dan tujuan harus berbeda.") }
            return
        }
        if (lines.isEmpty()) {
            _uiState.update { it.copy(message = "Tambahkan minimal satu barang.") }
            return
        }

        val transfer =
            Transfer(
                id = "TRF-${_uiState.value.transfers.size + 1}",
                number = "MUT/2026/11/${String.format("%03d", _uiState.value.transfers.size + 14)}",
                from = from,
                to = to,
                status = "PENDING",
                createdBy = _uiState.value.session?.name ?: "Hendra Saputra",
                time = "25 Nov 2026, 08:47 WIB",
                lines = lines,
            )

        _uiState.update {
            it.copy(
                transfers = listOf(transfer) + it.transfers,
                message = "Mutasi dibuat — menunggu serah terima.",
            )
        }
    }

    fun completeTransfer(id: String) {
        val transfer = _uiState.value.transfers.firstOrNull { it.id == id } ?: return
        if (transfer.status == "COMPLETED") return

        val updatedProducts =
            _uiState.value.products.map { product ->
                val moved =
                    transfer.lines
                        .filter { it.productId == product.id }
                        .sumOf { transferBaseQuantity(product, it) }
                if (moved == 0) {
                    product
                } else {
                    val fromWarehouse = transfer.from == Location.WAREHOUSE
                    product.copy(
                        warehouseStock =
                            if (fromWarehouse) product.warehouseStock - moved else product.warehouseStock + moved,
                        storeStock =
                            if (fromWarehouse) product.storeStock + moved else product.storeStock - moved,
                    )
                }
            }

        _uiState.update {
            it.copy(
                products = updatedProducts,
                transfers =
                    it.transfers.map { item ->
                        if (item.id == id) item.copy(status = "COMPLETED") else item
                    },
                message = "Mutasi selesai. Stok sudah dipindahkan.",
            )
        }
    }

    fun createOpname(
        location: Location,
        items: List<dev.hasino.tokojojo.stock.data.OpnameItem>,
    ) {
        if (items.isEmpty()) {
            _uiState.update { it.copy(message = "Tambahkan minimal satu produk.") }
            return
        }

        val opname =
            Opname(
                id = "OPN-${_uiState.value.opnames.size + 1}",
                number = "OPN/2026/11/${String.format("%03d", _uiState.value.opnames.size + 2)}",
                location = location,
                status = "PENDING_REVIEW",
                createdBy = _uiState.value.session?.name ?: "Hendra Saputra",
                time = "25 Nov 2026, 08:50 WIB",
                items = items,
            )

        _uiState.update {
            it.copy(
                opnames = listOf(opname) + it.opnames,
                message = "Opname terkirim — menunggu persetujuan OWNER/ADMIN.",
            )
        }
    }

    fun submitOpname(id: String) {
        _uiState.update {
            it.copy(
                opnames =
                    it.opnames.map { opname ->
                        if (opname.id == id) opname.copy(status = "PENDING_REVIEW") else opname
                    },
                message = "Opname terkirim untuk persetujuan.",
            )
        }
    }

    fun clearMessage() {
        _uiState.update { it.copy(message = null) }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    private fun demoUser(username: String): UserSession? =
        when (username.trim().lowercase()) {
            "gudang" -> UserSession("Hendra Saputra", "gudang", "WAREHOUSE", Location.WAREHOUSE)
            "admin" -> UserSession("Budi Admin", "admin", "ADMIN", Location.WAREHOUSE)
            "owner" -> UserSession("Sari Owner", "owner", "OWNER", Location.WAREHOUSE)
            else -> null
        }

    companion object {
        const val DEMO_PASSWORD = "tokojojo123"
    }
}
