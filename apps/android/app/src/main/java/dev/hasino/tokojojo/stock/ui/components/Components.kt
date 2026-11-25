package dev.hasino.tokojojo.stock.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.LocalShipping
import androidx.compose.material.icons.outlined.MoreHoriz
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.ErrorOutline
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material.icons.rounded.Inventory2
import androidx.compose.material.icons.rounded.LocalShipping
import androidx.compose.material.icons.rounded.MoreHoriz
import androidx.compose.material.icons.rounded.QrCodeScanner
import androidx.compose.material.icons.rounded.Remove
import androidx.compose.material.icons.rounded.WifiOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldColors
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation3.runtime.NavKey
import dev.hasino.tokojojo.stock.data.ConnectionState
import dev.hasino.tokojojo.stock.data.Location
import dev.hasino.tokojojo.stock.data.Product
import dev.hasino.tokojojo.stock.data.StockStatus
import dev.hasino.tokojojo.stock.data.formatRupiah
import dev.hasino.tokojojo.stock.data.stockAt
import dev.hasino.tokojojo.stock.ui.navigation.HomeKey
import dev.hasino.tokojojo.stock.ui.navigation.MoreKey
import dev.hasino.tokojojo.stock.ui.navigation.ReceiveKey
import dev.hasino.tokojojo.stock.ui.navigation.StockKey
import dev.hasino.tokojojo.stock.ui.theme.Dimens
import dev.hasino.tokojojo.stock.ui.theme.IbmPlexMono
import dev.hasino.tokojojo.stock.ui.theme.LocalTokoColors
import dev.hasino.tokojojo.stock.ui.theme.PlusJakarta

data class BottomDestination(
    val key: NavKey,
    val label: String,
    val activeIcon: ImageVector,
    val inactiveIcon: ImageVector,
)

val bottomDestinations =
    listOf(
        BottomDestination(HomeKey, "Beranda", Icons.Rounded.Home, Icons.Outlined.Home),
        BottomDestination(StockKey, "Stok", Icons.Rounded.Inventory2, Icons.Outlined.Inventory2),
        BottomDestination(ReceiveKey, "Terima", Icons.Rounded.LocalShipping, Icons.Outlined.LocalShipping),
        BottomDestination(MoreKey, "Lainnya", Icons.Rounded.MoreHoriz, Icons.Outlined.MoreHoriz),
    )

@Composable
fun TokoTopBar(
    title: String,
    subtitle: String,
    connection: ConnectionState,
    onScan: () -> Unit,
    onConnectionClick: () -> Unit,
    onBack: (() -> Unit)? = null,
) {
    val colors = LocalTokoColors.current
    Surface(color = colors.surface) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .height(68.dp)
                    .padding(horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (onBack != null) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Kembali", tint = colors.ink)
                }
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    color = colors.ink,
                    fontFamily = PlusJakarta,
                    fontSize = 23.sp,
                    lineHeight = 27.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = (-0.3).sp,
                )
                Text(
                    text = subtitle,
                    color = colors.inkMuted,
                    fontFamily = PlusJakarta,
                    fontSize = 12.sp,
                )
            }
            ConnectionChip(connection = connection, onClick = onConnectionClick)
            IconButton(onClick = onScan) {
                Icon(Icons.Rounded.QrCodeScanner, contentDescription = "Pindai barcode", tint = colors.ink)
            }
        }
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(colors.line))
    }
}

@Composable
fun ConnectionChip(
    connection: ConnectionState,
    onClick: () -> Unit,
) {
    val colors = LocalTokoColors.current
    val (label, foreground, background) =
        when (connection) {
            ConnectionState.ONLINE -> Triple("Online", colors.success, colors.successSoft)
            ConnectionState.OFFLINE -> Triple("Offline", colors.warning, colors.warningSoft)
            ConnectionState.ERROR -> Triple("Error", colors.danger, colors.dangerSoft)
        }
    Row(
        modifier =
            Modifier
                .clickable(onClick = onClick)
                .background(background, CircleShape)
                .padding(horizontal = 8.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(modifier = Modifier.size(6.dp).background(foreground, CircleShape))
        Text(
            text = label,
            color = foreground,
            fontFamily = PlusJakarta,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
fun TokoBottomBar(
    selected: NavKey?,
    onSelect: (NavKey) -> Unit,
) {
    val colors = LocalTokoColors.current
    NavigationBar(
        containerColor = colors.surface,
        tonalElevation = 0.dp,
    ) {
        bottomDestinations.forEach { destination ->
            val active = selected == destination.key
            NavigationBarItem(
                selected = active,
                onClick = { onSelect(destination.key) },
                icon = {
                    Icon(
                        imageVector = if (active) destination.activeIcon else destination.inactiveIcon,
                        contentDescription = destination.label,
                        modifier = Modifier.size(24.dp),
                    )
                },
                label = {
                    Text(
                        text = destination.label,
                        fontFamily = PlusJakarta,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                    )
                },
                colors =
                    NavigationBarItemDefaults.colors(
                        selectedIconColor = colors.primary,
                        selectedTextColor = colors.primary,
                        indicatorColor = colors.primarySoft,
                        unselectedIconColor = colors.inkMuted,
                        unselectedTextColor = colors.inkMuted,
                    ),
            )
        }
    }
}

@Composable
fun TokoCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    content: @Composable () -> Unit,
) {
    val colors = LocalTokoColors.current
    val shape = RoundedCornerShape(Dimens.radiusMd)
    if (onClick == null) {
        Card(
            modifier = modifier.fillMaxWidth(),
            shape = shape,
            border = BorderStroke(1.dp, colors.line),
            colors = CardDefaults.cardColors(containerColor = colors.surface),
        ) {
            content()
        }
    } else {
        Card(
            onClick = onClick,
            modifier = modifier.fillMaxWidth(),
            shape = shape,
            border = BorderStroke(1.dp, colors.line),
            colors = CardDefaults.cardColors(containerColor = colors.surface),
        ) {
            content()
        }
    }
}

@Composable
fun SectionHeader(
    title: String,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    val colors = LocalTokoColors.current
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            text = title,
            color = colors.ink,
            fontFamily = PlusJakarta,
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
        )
        if (actionLabel != null && onAction != null) {
            Text(
                text = actionLabel,
                color = colors.primary,
                fontFamily = PlusJakarta,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.clickable(onClick = onAction).padding(4.dp),
            )
        }
    }
}

@Composable
fun InfoBanner(
    title: String,
    body: String,
    tone: BannerTone = BannerTone.INFO,
    modifier: Modifier = Modifier,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    val colors = LocalTokoColors.current
    val (foreground, background, icon) =
        when (tone) {
            BannerTone.INFO -> Triple(colors.info, colors.infoSoft, Icons.Rounded.Info)
            BannerTone.WARNING -> Triple(colors.warning, colors.warningSoft, Icons.Rounded.WifiOff)
            BannerTone.DANGER -> Triple(colors.danger, colors.dangerSoft, Icons.Rounded.ErrorOutline)
            BannerTone.SUCCESS -> Triple(colors.success, colors.successSoft, Icons.Rounded.CheckCircle)
        }
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .background(background, RoundedCornerShape(Dimens.radiusMd))
                .padding(horizontal = 12.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Icon(icon, contentDescription = null, tint = foreground, modifier = Modifier.size(20.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                color = foreground,
                fontFamily = PlusJakarta,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = body,
                color = colors.inkSecondary,
                fontFamily = PlusJakarta,
                fontSize = 12.sp,
                lineHeight = 17.sp,
            )
            if (actionLabel != null && onAction != null) {
                Text(
                    text = actionLabel,
                    color = foreground,
                    fontFamily = PlusJakarta,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.clickable(onClick = onAction).padding(top = 4.dp),
                )
            }
        }
    }
}

enum class BannerTone { INFO, WARNING, DANGER, SUCCESS }

@Composable
fun StatCard(
    label: String,
    value: String,
    hint: String,
    accent: Color,
    modifier: Modifier = Modifier,
) {
    val colors = LocalTokoColors.current
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(Dimens.radiusMd),
        border = BorderStroke(1.dp, colors.line),
        colors = CardDefaults.cardColors(containerColor = colors.surface),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                text = label.uppercase(),
                color = colors.inkMuted,
                fontFamily = PlusJakarta,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.6.sp,
                lineHeight = 16.sp,
            )
            Text(
                text = value,
                color = accent,
                fontFamily = PlusJakarta,
                fontSize = 22.sp,
                lineHeight = 27.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = (-0.2).sp,
                modifier = Modifier.padding(top = 2.dp),
            )
            Text(
                text = hint,
                color = colors.inkMuted,
                fontFamily = PlusJakarta,
                fontSize = 12.sp,
                lineHeight = 16.sp,
            )
        }
    }
}

@Composable
fun StatusBadge(status: StockStatus) {
    val colors = LocalTokoColors.current
    val (label, foreground, background) =
        when (status) {
            StockStatus.AMAN -> Triple("Aman", colors.success, colors.successSoft)
            StockStatus.MENIPIS -> Triple("Menipis", colors.warning, colors.warningSoft)
            StockStatus.HABIS -> Triple("Habis", colors.danger, colors.dangerSoft)
        }
    TextBadge(label = label, foreground = foreground, background = background)
}

@Composable
fun TextBadge(
    label: String,
    foreground: Color,
    background: Color,
) {
    Text(
        text = label,
        color = foreground,
        fontFamily = PlusJakarta,
        fontSize = 12.sp,
        lineHeight = 16.sp,
        fontWeight = FontWeight.Bold,
        modifier =
            Modifier
                .background(background, CircleShape)
                .padding(horizontal = 8.dp, vertical = 3.dp),
    )
}

@Composable
fun PrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
) {
    val colors = LocalTokoColors.current
    Button(
        onClick = onClick,
        enabled = enabled && !loading,
        modifier = modifier.fillMaxWidth().height(Dimens.primaryButtonHeight),
        shape = RoundedCornerShape(Dimens.radiusSm),
        colors = ButtonDefaults.buttonColors(containerColor = colors.primary, contentColor = colors.onPrimary),
    ) {
        if (loading) {
            CircularProgressIndicator(color = colors.onPrimary, strokeWidth = 2.dp, modifier = Modifier.size(18.dp))
        } else {
            Text(text, fontFamily = PlusJakarta, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun SecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    val colors = LocalTokoColors.current
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.fillMaxWidth().height(Dimens.controlHeight),
        shape = RoundedCornerShape(Dimens.radiusSm),
        border = BorderStroke(1.dp, colors.lineControl),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = colors.ink),
    ) {
        Text(text, fontFamily = PlusJakarta, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
fun SoftDangerButton(
    text: String,
    onClick: () -> Unit,
    icon: ImageVector? = null,
    modifier: Modifier = Modifier,
) {
    val colors = LocalTokoColors.current
    Button(
        onClick = onClick,
        modifier = modifier.fillMaxWidth().height(Dimens.controlHeight),
        shape = RoundedCornerShape(Dimens.radiusSm),
        colors = ButtonDefaults.buttonColors(containerColor = colors.dangerSoft, contentColor = colors.danger),
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(6.dp))
        }
        Text(text, fontFamily = PlusJakarta, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
fun FieldLabel(
    text: String,
    required: Boolean = false,
) {
    val colors = LocalTokoColors.current
    Row(modifier = Modifier.padding(bottom = 5.dp)) {
        Text(
            text = text,
            color = colors.inkSecondary,
            fontFamily = PlusJakarta,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
        )
        if (required) {
            Text(" *", color = colors.danger, fontFamily = PlusJakarta, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun tokoFieldColors(): TextFieldColors {
    val colors = LocalTokoColors.current
    return OutlinedTextFieldDefaults.colors(
        focusedBorderColor = colors.primary,
        unfocusedBorderColor = colors.lineControl,
        focusedContainerColor = colors.surface,
        unfocusedContainerColor = colors.surface,
        disabledContainerColor = colors.subtle,
        focusedLabelColor = colors.primary,
        unfocusedLabelColor = colors.inkMuted,
        cursorColor = colors.primary,
    )
}

@Composable
fun EmptyState(
    title: String,
    body: String,
    modifier: Modifier = Modifier,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    val colors = LocalTokoColors.current
    Column(
        modifier = modifier.fillMaxWidth().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(
            modifier = Modifier.size(40.dp).background(colors.subtle, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Rounded.Inventory2, contentDescription = null, tint = colors.inkMuted)
        }
        Text(
            text = title,
            color = colors.ink,
            fontFamily = PlusJakarta,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
        )
        Text(
            text = body,
            color = colors.inkMuted,
            fontFamily = PlusJakarta,
            fontSize = 13.sp,
            textAlign = TextAlign.Center,
        )
        if (actionLabel != null && onAction != null) {
            SecondaryButton(
                text = actionLabel,
                onClick = onAction,
                modifier = Modifier.padding(top = 6.dp).width(200.dp),
            )
        }
    }
}

@Composable
fun ErrorState(
    message: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = LocalTokoColors.current
    Column(
        modifier = modifier.fillMaxWidth().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(Icons.Rounded.ErrorOutline, contentDescription = null, tint = colors.danger, modifier = Modifier.size(40.dp))
        Text(
            text = "Gagal memuat data",
            color = colors.ink,
            fontFamily = PlusJakarta,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
        )
        Text(
            text = message,
            color = colors.inkMuted,
            fontFamily = PlusJakarta,
            fontSize = 13.sp,
            textAlign = TextAlign.Center,
        )
        SecondaryButton(text = "Coba lagi", onClick = onRetry, modifier = Modifier.width(180.dp))
    }
}

@Composable
fun SkeletonBlock(
    height: Dp,
    modifier: Modifier = Modifier,
    width: Dp? = null,
) {
    val colors = LocalTokoColors.current
    Box(
        modifier =
            modifier
                .then(if (width != null) Modifier.width(width) else Modifier.fillMaxWidth())
                .height(height)
                .background(colors.subtle, RoundedCornerShape(Dimens.radiusXs)),
    )
}

@Composable
fun ProductAvatar(name: String) {
    val colors = LocalTokoColors.current
    Box(
        modifier =
            Modifier
                .size(40.dp)
                .background(colors.primarySoft, RoundedCornerShape(Dimens.radiusSm)),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = productInitials(name),
            color = colors.primary,
            fontFamily = PlusJakarta,
            fontSize = 12.sp,
            fontWeight = FontWeight.ExtraBold,
        )
    }
}

fun productInitials(name: String): String =
    name
        .split(" ")
        .mapNotNull { it.firstOrNull()?.toString() }
        .take(2)
        .joinToString("")
        .uppercase()

@Composable
fun StockRow(
    product: Product,
    onClick: () -> Unit,
) {
    val colors = LocalTokoColors.current
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        ProductAvatar(product.name)
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = product.name,
                color = colors.ink,
                fontFamily = PlusJakarta,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 2,
            )
            Text(
                text = "${product.sku} · ${product.baseUnit.name}",
                color = colors.inkMuted,
                fontFamily = IbmPlexMono,
                fontSize = 11.sp,
                modifier = Modifier.padding(top = 1.dp),
            )
            Row(
                modifier = Modifier.padding(top = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text(
                    "Gudang ${stockAt(product, Location.WAREHOUSE)}",
                    color = colors.inkSecondary,
                    fontFamily = PlusJakarta,
                    fontSize = 12.sp,
                )
                Text(
                    "Toko ${stockAt(product, Location.STORE)}",
                    color = colors.inkSecondary,
                    fontFamily = PlusJakarta,
                    fontSize = 12.sp,
                )
            }
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            StatusBadge(
                dev.hasino.tokojojo.stock.data
                    .stockStatus(product),
            )
            Icon(Icons.Rounded.ChevronRight, contentDescription = null, tint = colors.inkMuted, modifier = Modifier.size(20.dp))
        }
    }
}

@Composable
fun MovementRow(
    time: String,
    type: String,
    location: Location,
    quantity: Int,
    reference: String,
) {
    val colors = LocalTokoColors.current
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .size(34.dp)
                    .background(if (quantity >= 0) colors.successSoft else colors.dangerSoft, RoundedCornerShape(Dimens.radiusSm)),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = if (quantity >= 0) "+" else "−",
                color = if (quantity >= 0) colors.success else colors.danger,
                fontFamily = PlusJakarta,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = type,
                color = colors.ink,
                fontFamily = PlusJakarta,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = "$time · ${location.label}",
                color = colors.inkMuted,
                fontFamily = PlusJakarta,
                fontSize = 11.sp,
            )
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(
                text = if (quantity >= 0) "+$quantity" else quantity.toString(),
                color = if (quantity >= 0) colors.success else colors.danger,
                fontFamily = PlusJakarta,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = reference,
                color = colors.inkMuted,
                fontFamily = IbmPlexMono,
                fontSize = 10.sp,
            )
        }
    }
}

@Composable
fun <T> SegmentedControl(
    options: List<Pair<T, String>>,
    selected: T,
    onSelect: (T) -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = LocalTokoColors.current
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .background(colors.subtle, RoundedCornerShape(Dimens.radiusSm))
                .border(1.dp, colors.line, RoundedCornerShape(Dimens.radiusSm))
                .padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        options.forEach { (value, label) ->
            val active = selected == value
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .height(38.dp)
                        .background(if (active) colors.surface else Color.Transparent, RoundedCornerShape(Dimens.radiusXs))
                        .clickable { onSelect(value) },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = label,
                    color = if (active) colors.primary else colors.inkMuted,
                    fontFamily = PlusJakarta,
                    fontSize = 12.sp,
                    fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold,
                )
            }
        }
    }
}

@Composable
fun QuantityStepper(
    value: Int,
    onValueChange: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = LocalTokoColors.current
    Row(
        modifier =
            modifier
                .height(Dimens.controlHeight)
                .border(1.dp, colors.lineControl, RoundedCornerShape(Dimens.radiusSm))
                .background(colors.surface, RoundedCornerShape(Dimens.radiusSm)),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(onClick = { onValueChange((value - 1).coerceAtLeast(0)) }) {
            Icon(Icons.Rounded.Remove, contentDescription = "Kurangi", tint = colors.inkSecondary)
        }
        Text(
            text = value.toString(),
            color = colors.ink,
            fontFamily = PlusJakarta,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
            modifier = Modifier.width(40.dp),
        )
        IconButton(onClick = { onValueChange(value + 1) }) {
            Icon(Icons.Rounded.Add, contentDescription = "Tambah", tint = colors.primary)
        }
    }
}

@Composable
fun SettingsRow(
    label: String,
    description: String,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    control: @Composable () -> Unit = {},
) {
    val colors = LocalTokoColors.current
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
                .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = label,
                color = colors.ink,
                fontFamily = PlusJakarta,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = description,
                color = colors.inkMuted,
                fontFamily = PlusJakarta,
                fontSize = 12.sp,
                lineHeight = 16.sp,
            )
        }
        control()
    }
}

@Composable
fun ToggleRow(
    label: String,
    description: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    val colors = LocalTokoColors.current
    SettingsRow(label = label, description = description) {
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors =
                SwitchDefaults.colors(
                    checkedThumbColor = colors.onPrimary,
                    checkedTrackColor = colors.primary,
                    uncheckedThumbColor = colors.inkMuted,
                    uncheckedTrackColor = colors.subtle,
                    uncheckedBorderColor = colors.lineControl,
                ),
        )
    }
}

@Composable
fun ApprovalBanner(count: Int) {
    if (count > 0) {
        InfoBanner(
            title = "Menunggu persetujuan",
            body = "$count penyesuaian stok menunggu OWNER/ADMIN di web.",
            tone = BannerTone.INFO,
        )
    }
}

@Composable
fun NumericText(
    text: String,
    modifier: Modifier = Modifier,
    color: Color = LocalTokoColors.current.ink,
    size: Int = 14,
    weight: FontWeight = FontWeight.SemiBold,
    style: TextStyle = TextStyle.Default,
) {
    Text(
        text = text,
        color = color,
        fontFamily = PlusJakarta,
        fontSize = size.sp,
        fontWeight = weight,
        style = style.copy(fontFeatureSettings = "tnum"),
        modifier = modifier,
    )
}

fun receiptTotalLabel(value: Long): String = formatRupiah(value)

@Composable
fun DividerLine() {
    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(LocalTokoColors.current.line))
}

@Composable
fun ContentPadding(): PaddingValues = PaddingValues(horizontal = 16.dp, vertical = 12.dp)
