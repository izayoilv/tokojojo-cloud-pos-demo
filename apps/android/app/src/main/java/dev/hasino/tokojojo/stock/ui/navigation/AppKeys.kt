package dev.hasino.tokojojo.stock.ui.navigation

import androidx.navigation3.runtime.NavKey
import kotlinx.serialization.Serializable

@Serializable
data object HomeKey : NavKey

@Serializable
data object StockKey : NavKey

@Serializable
data object ReceiveKey : NavKey

@Serializable
data object TransferKey : NavKey

@Serializable
data object OpnameKey : NavKey

@Serializable
data class StockDetailKey(
    val productId: String,
) : NavKey

@Serializable
data class AdjustKey(
    val productId: String? = null,
) : NavKey

val topLevelKeys =
    setOf<NavKey>(
        HomeKey,
        StockKey,
        ReceiveKey,
        TransferKey,
        OpnameKey,
    )

fun navTitle(key: NavKey?): Pair<String, String> =
    when (key) {
        HomeKey -> "Beranda" to "Selamat pagi, Hendra"
        StockKey -> "Cek Stok" to "Semua lokasi"
        ReceiveKey -> "Terima Barang" to "Penerimaan supplier"
        TransferKey -> "Mutasi Stok" to "WH-BACK ↔ STORE-FRONT"
        OpnameKey -> "Stock Opname" to "Hitung fisik vs sistem"
        is StockDetailKey -> "Detail Produk" to "Informasi stok & harga"
        is AdjustKey -> "Sesuaikan Stok" to "Ajukan selisih untuk approval"
        else -> "Beranda" to "Selamat pagi, Hendra"
    }
