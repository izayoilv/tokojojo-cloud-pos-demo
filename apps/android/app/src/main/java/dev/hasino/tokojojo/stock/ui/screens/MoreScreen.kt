package dev.hasino.tokojojo.stock.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.hasino.tokojojo.stock.data.ConnectionState
import dev.hasino.tokojojo.stock.data.DeviceStatus
import dev.hasino.tokojojo.stock.data.Location
import dev.hasino.tokojojo.stock.data.TextSize
import dev.hasino.tokojojo.stock.data.ThemeMode
import dev.hasino.tokojojo.stock.ui.StockUiState
import dev.hasino.tokojojo.stock.ui.components.ConnectionChip
import dev.hasino.tokojojo.stock.ui.components.DividerLine
import dev.hasino.tokojojo.stock.ui.components.InfoBanner
import dev.hasino.tokojojo.stock.ui.components.SegmentedControl
import dev.hasino.tokojojo.stock.ui.components.SettingsRow
import dev.hasino.tokojojo.stock.ui.components.SoftDangerButton
import dev.hasino.tokojojo.stock.ui.components.TextBadge
import dev.hasino.tokojojo.stock.ui.components.ToggleRow
import dev.hasino.tokojojo.stock.ui.components.TokoCard
import dev.hasino.tokojojo.stock.ui.icons.TokoIcons
import dev.hasino.tokojojo.stock.ui.theme.Dimens
import dev.hasino.tokojojo.stock.ui.theme.LocalTokoColors
import dev.hasino.tokojojo.stock.ui.theme.PlusJakarta

@Composable
fun MoreScreen(
    state: StockUiState,
    onTheme: (ThemeMode) -> Unit,
    onTextSize: (TextSize) -> Unit,
    onScannerSound: (Boolean) -> Unit,
    onScannerVibrate: (Boolean) -> Unit,
    onDefaultLocation: (Location) -> Unit,
    onConnection: (ConnectionState) -> Unit,
    onDeviceStatus: (DeviceStatus) -> Unit,
    onRefresh: () -> Unit,
    onTransfers: () -> Unit,
    onOpname: () -> Unit,
    onLogout: () -> Unit,
) {
    val colors = LocalTokoColors.current
    var biometric by remember { mutableStateOf(true) }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        TokoCard {
            Row(
                modifier = Modifier.padding(14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Box(
                    modifier = Modifier.size(48.dp).background(colors.primarySoft, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(TokoIcons.Rounded.Person, contentDescription = null, tint = colors.primary, modifier = Modifier.size(26.dp))
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        state.session?.name ?: "Hendra Saputra",
                        color = colors.ink,
                        fontFamily = PlusJakarta,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        "${state.session?.role ?: "WAREHOUSE"} · ${state.defaultLocation.label}",
                        color = colors.inkMuted,
                        fontFamily = PlusJakarta,
                        fontSize = 12.sp,
                    )
                }
                ConnectionChip(connection = state.connection, onClick = onRefresh)
            }
        }

        SettingsSection("Tampilan") {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Tema", color = colors.ink, fontFamily = PlusJakarta, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                SegmentedControl(
                    options =
                        listOf(
                            ThemeMode.LIGHT to "Terang",
                            ThemeMode.DARK to "Gelap",
                            ThemeMode.SYSTEM to "Sistem",
                        ),
                    selected = state.themeMode,
                    onSelect = onTheme,
                )
                Text("Ukuran teks", color = colors.ink, fontFamily = PlusJakarta, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                SegmentedControl(
                    options = listOf(TextSize.NORMAL to "Normal", TextSize.LARGE to "Besar"),
                    selected = state.textSize,
                    onSelect = onTextSize,
                )
            }
        }

        SettingsSection("Perangkat") {
            ToggleRow(
                label = "Buka dengan biometrik",
                description = "Password tetap menjadi cadangan.",
                checked = biometric,
                onCheckedChange = { biometric = it },
            )
            DividerLine()
            ToggleRow(
                label = "Suara pemindai",
                description = "Bunyi saat barcode terbaca.",
                checked = state.scannerSound,
                onCheckedChange = onScannerSound,
            )
            DividerLine()
            ToggleRow(
                label = "Getar pemindai",
                description = "Getar singkat saat terbaca.",
                checked = state.scannerVibrate,
                onCheckedChange = onScannerVibrate,
            )
            DividerLine()
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Lokasi default", color = colors.ink, fontFamily = PlusJakarta, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                Text("Untuk penerimaan dan opname.", color = colors.inkMuted, fontFamily = PlusJakarta, fontSize = 12.sp)
                SegmentedControl(
                    options = listOf(Location.WAREHOUSE to "Gudang", Location.STORE to "Toko"),
                    selected = state.defaultLocation,
                    onSelect = onDefaultLocation,
                )
            }
        }

        SettingsSection("Operasional") {
            SettingsRow(
                label = "Mutasi stok",
                description = "Pindahkan stok antar lokasi.",
                onClick = onTransfers,
                control = { Icon(TokoIcons.Rounded.ChevronRight, contentDescription = null, tint = colors.inkMuted) },
            )
            DividerLine()
            SettingsRow(
                label = "Opname",
                description = "Hitung fisik dan kirim approval.",
                onClick = onOpname,
                control = { Icon(TokoIcons.Rounded.ChevronRight, contentDescription = null, tint = colors.inkMuted) },
            )
            DividerLine()
            SettingsRow(
                label = "Perangkat & sesi",
                description = "${state.device.name} · ${state.device.status.name}",
                onClick = { onDeviceStatus(DeviceStatus.PENDING) },
                control = { Icon(TokoIcons.Rounded.Devices, contentDescription = null, tint = colors.inkMuted) },
            )
        }

        TokoCard {
            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Koneksi", color = colors.ink, fontFamily = PlusJakarta, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                Text("Terakhir sinkron ${state.lastSync}.", color = colors.inkMuted, fontFamily = PlusJakarta, fontSize = 12.sp)
                ConnectionChip(connection = state.connection, onClick = onRefresh)
                Text("Versi 0.1.0 · TokoJoJo Stock", color = colors.inkMuted, fontFamily = PlusJakarta, fontSize = 11.sp)
            }
        }

        InfoBanner(
            title = "Mode demo",
            body = "Kontrol state untuk presentasi.",
            tone = dev.hasino.tokojojo.stock.ui.components.BannerTone.INFO,
        )
        SettingsSection("Mode demo") {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Koneksi", color = colors.ink, fontFamily = PlusJakarta, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                SegmentedControl(
                    options =
                        listOf(
                            ConnectionState.ONLINE to "Online",
                            ConnectionState.OFFLINE to "Offline",
                            ConnectionState.ERROR to "Error",
                        ),
                    selected = state.connection,
                    onSelect = onConnection,
                )
                Text("Status perangkat", color = colors.ink, fontFamily = PlusJakarta, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                SegmentedControl(
                    options =
                        listOf(
                            DeviceStatus.APPROVED to "Disetujui",
                            DeviceStatus.PENDING to "Pending",
                            DeviceStatus.REVOKED to "Dicabut",
                        ),
                    selected = state.device.status,
                    onSelect = onDeviceStatus,
                )
                Text(
                    "Pending/dicabut akan menampilkan layar Perangkat Pending.",
                    color = colors.inkMuted,
                    fontFamily = PlusJakarta,
                    fontSize = 11.sp,
                )
            }
        }

        SoftDangerButton(text = "Keluar", onClick = onLogout, icon = TokoIcons.Rounded.Logout)
        Text(
            text = "TokoJoJo Stock · UI mock v0.1.0",
            color = colors.inkMuted,
            fontFamily = PlusJakarta,
            fontSize = 11.sp,
            modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
    }
}

@Composable
private fun SettingsSection(
    title: String,
    content: @Composable () -> Unit,
) {
    val colors = LocalTokoColors.current
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            title,
            color = colors.inkMuted,
            fontFamily = PlusJakarta,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.7.sp,
            modifier = Modifier.padding(start = 4.dp),
        )
        TokoCard { content() }
    }
}
