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
data object MoreKey : NavKey

@Serializable
data class StockDetailKey(
    val productId: String,
) : NavKey

@Serializable
data class AdjustKey(
    val productId: String? = null,
) : NavKey

@Serializable
data object TransferKey : NavKey

@Serializable
data object OpnameKey : NavKey

val topLevelKeys =
    setOf<NavKey>(
        HomeKey,
        StockKey,
        ReceiveKey,
        MoreKey,
    )

fun navTitle(key: NavKey?): Pair<String, String> =
    when (key) {
        HomeKey -> "Beranda" to "Selamat pagi, Hendra"
        StockKey -> "Stok" to "Cari dan periksa stok"
        ReceiveKey -> "Terima Stok" to "Penerimaan barang"
        MoreKey -> "Lainnya" to "Akun dan pengaturan"
        is StockDetailKey -> "Detail Stok" to "Stok per lokasi"
        is AdjustKey -> "Sesuaikan Stok" to "Ajukan selisih"
        TransferKey -> "Mutasi Stok" to "Gudang dan area toko"
        OpnameKey -> "Opname" to "Hitung stok fisik"
        else -> "Beranda" to "Selamat pagi, Hendra"
    }
