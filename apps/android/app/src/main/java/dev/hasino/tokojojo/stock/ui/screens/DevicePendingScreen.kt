package dev.hasino.tokojojo.stock.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.hasino.tokojojo.stock.data.DeviceStatus
import dev.hasino.tokojojo.stock.ui.StockUiState
import dev.hasino.tokojojo.stock.ui.components.InfoBanner
import dev.hasino.tokojojo.stock.ui.components.PrimaryButton
import dev.hasino.tokojojo.stock.ui.components.SecondaryButton
import dev.hasino.tokojojo.stock.ui.components.SoftDangerButton
import dev.hasino.tokojojo.stock.ui.components.TokoCard
import dev.hasino.tokojojo.stock.ui.icons.TokoIcons
import dev.hasino.tokojojo.stock.ui.theme.IbmPlexMono
import dev.hasino.tokojojo.stock.ui.theme.LocalTokoColors
import dev.hasino.tokojojo.stock.ui.theme.PlusJakarta

@Composable
fun DevicePendingScreen(
    state: StockUiState,
    onRetry: () -> Unit,
    onDemoApprove: () -> Unit,
    onLogout: () -> Unit,
) {
    val colors = LocalTokoColors.current
    val pending = state.device.status == DeviceStatus.PENDING

    Column(
        modifier = Modifier.fillMaxSize().background(colors.canvas).padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier = Modifier.size(72.dp).background(colors.warningSoft, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(TokoIcons.Rounded.Devices, contentDescription = null, tint = colors.warning, modifier = Modifier.size(34.dp))
        }
        Text(
            text = if (pending) "Perangkat menunggu persetujuan" else "Perangkat dicabut",
            color = colors.ink,
            fontFamily = PlusJakarta,
            fontSize = 22.sp,
            fontWeight = FontWeight.ExtraBold,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            text =
                if (pending) {
                    "Minta OWNER/ADMIN menyetujui perangkat ini di Pengaturan → Perangkat & Sesi."
                } else {
                    "Perangkat ini tidak lagi diizinkan. Hubungi admin untuk mendaftarkan ulang."
                },
            color = colors.inkMuted,
            fontFamily = PlusJakarta,
            fontSize = 14.sp,
            lineHeight = 20.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp),
        )

        TokoCard(modifier = Modifier.padding(top = 20.dp)) {
            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                    Text("Perangkat", color = colors.inkMuted, fontFamily = PlusJakarta, fontSize = 12.sp)
                    Text(state.device.name, color = colors.ink, fontFamily = IbmPlexMono, fontSize = 12.sp)
                }
                Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                    Text("Platform", color = colors.inkMuted, fontFamily = PlusJakarta, fontSize = 12.sp)
                    Text("ANDROID", color = colors.ink, fontFamily = PlusJakarta, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
                Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                    Text("Status", color = colors.inkMuted, fontFamily = PlusJakarta, fontSize = 12.sp)
                    Text(
                        state.device.status.name,
                        color = colors.warning,
                        fontFamily = PlusJakarta,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
                Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                    Text("Terakhir diperiksa", color = colors.inkMuted, fontFamily = PlusJakarta, fontSize = 12.sp)
                    Text(state.device.lastChecked, color = colors.ink, fontFamily = PlusJakarta, fontSize = 12.sp)
                }
            }
        }

        InfoBanner(
            title = "Tidak dapat menulis stok",
            body = "Penerimaan dan penyesuaian diblokir sampai perangkat disetujui.",
            tone = dev.hasino.tokojojo.stock.ui.components.BannerTone.WARNING,
            modifier = Modifier.padding(top = 12.dp),
        )

        PrimaryButton(
            text = "Coba lagi",
            onClick = onRetry,
            modifier = Modifier.padding(top = 16.dp),
        )
        SecondaryButton(
            text = "Setujui perangkat (demo)",
            onClick = onDemoApprove,
            modifier = Modifier.padding(top = 8.dp),
        )
        SoftDangerButton(
            text = "Keluar",
            onClick = onLogout,
            icon = TokoIcons.Rounded.Logout,
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}
