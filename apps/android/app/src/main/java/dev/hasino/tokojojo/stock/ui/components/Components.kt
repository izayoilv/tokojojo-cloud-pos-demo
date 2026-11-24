package dev.hasino.tokojojo.stock.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.AddCircle
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.graphics.toColorInt
import androidx.navigation3.runtime.NavKey
import dev.hasino.tokojojo.stock.data.DemoMode
import dev.hasino.tokojojo.stock.data.Product
import dev.hasino.tokojojo.stock.data.StockStatus
import dev.hasino.tokojojo.stock.ui.navigation.HomeKey
import dev.hasino.tokojojo.stock.ui.navigation.OpnameKey
import dev.hasino.tokojojo.stock.ui.navigation.ReceiveKey
import dev.hasino.tokojojo.stock.ui.navigation.StockKey
import dev.hasino.tokojojo.stock.ui.navigation.TransferKey
import dev.hasino.tokojojo.stock.ui.theme.Amber
import dev.hasino.tokojojo.stock.ui.theme.AmberSoft
import dev.hasino.tokojojo.stock.ui.theme.Blue
import dev.hasino.tokojojo.stock.ui.theme.BlueSoft
import dev.hasino.tokojojo.stock.ui.theme.Canvas
import dev.hasino.tokojojo.stock.ui.theme.Danger
import dev.hasino.tokojojo.stock.ui.theme.DangerSoft
import dev.hasino.tokojojo.stock.ui.theme.Faint
import dev.hasino.tokojojo.stock.ui.theme.Ink
import dev.hasino.tokojojo.stock.ui.theme.Line
import dev.hasino.tokojojo.stock.ui.theme.Muted
import dev.hasino.tokojojo.stock.ui.theme.Navy
import dev.hasino.tokojojo.stock.ui.theme.NavyMuted
import dev.hasino.tokojojo.stock.ui.theme.Royal
import dev.hasino.tokojojo.stock.ui.theme.Success
import dev.hasino.tokojojo.stock.ui.theme.SuccessSoft
import dev.hasino.tokojojo.stock.ui.theme.White

data class BottomDestination(
    val key: NavKey,
    val label: String,
    val icon: ImageVector,
)

val bottomDestinations =
    listOf(
        BottomDestination(HomeKey, "Beranda", Icons.Filled.Home),
        BottomDestination(StockKey, "Stok", Icons.AutoMirrored.Filled.List),
        BottomDestination(ReceiveKey, "Terima", Icons.Filled.AddCircle),
        BottomDestination(TransferKey, "Mutasi", Icons.AutoMirrored.Filled.ArrowForward),
        BottomDestination(OpnameKey, "Opname", Icons.Filled.CheckCircle),
    )

private fun DemoMode.label(): String =
    when (this) {
        DemoMode.NORMAL -> "Normal"
        DemoMode.OFFLINE -> "Offline"
        DemoMode.ERROR -> "Error"
    }

private fun DemoMode.badgeLabel(): String =
    when (this) {
        DemoMode.NORMAL -> "ONLINE"
        DemoMode.OFFLINE -> "OFFLINE"
        DemoMode.ERROR -> "ERROR"
    }

private fun DemoMode.badgeColor(): Color =
    when (this) {
        DemoMode.NORMAL -> Success.copy(alpha = 0.28f)
        DemoMode.OFFLINE -> White.copy(alpha = 0.12f)
        DemoMode.ERROR -> Danger.copy(alpha = 0.32f)
    }

@Composable
fun StockTopBar(
    title: String,
    subtitle: String,
    demoMode: DemoMode,
    onDemoModeChange: (DemoMode) -> Unit,
    onBack: (() -> Unit)? = null,
) {
    Surface(color = Navy) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .height(72.dp)
                    .padding(horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (onBack != null) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Kembali", tint = White)
                }
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    color = White,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.ExtraBold,
                )
                Text(
                    text = subtitle,
                    color = NavyMuted,
                    fontSize = 11.sp,
                )
            }
            Box(
                modifier =
                    Modifier
                        .clickable {
                            val next =
                                when (demoMode) {
                                    DemoMode.NORMAL -> DemoMode.OFFLINE
                                    DemoMode.OFFLINE -> DemoMode.ERROR
                                    DemoMode.ERROR -> DemoMode.NORMAL
                                }
                            onDemoModeChange(next)
                        }.background(demoMode.badgeColor(), CircleShape)
                        .padding(horizontal = 10.dp, vertical = 5.dp),
            ) {
                Text(
                    text = "● ${demoMode.badgeLabel()}",
                    color = White,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
            Box {
                var expanded by remember { mutableStateOf(false) }
                IconButton(onClick = { expanded = true }) {
                    Icon(Icons.Filled.MoreVert, contentDescription = "Menu demo", tint = White)
                }
                DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                    DemoMode.entries.forEach { mode ->
                        DropdownMenuItem(
                            text = { Text("Mode demo: ${mode.label()}") },
                            onClick = {
                                expanded = false
                                onDemoModeChange(mode)
                            },
                            trailingIcon = {
                                if (demoMode == mode) {
                                    Icon(Icons.Filled.Check, contentDescription = null)
                                }
                            },
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun StockBottomBar(
    selected: NavKey?,
    onSelect: (NavKey) -> Unit,
) {
    NavigationBar(
        containerColor = White,
        tonalElevation = 0.dp,
    ) {
        bottomDestinations.forEach { destination ->
            val isSelected = selected == destination.key
            NavigationBarItem(
                selected = isSelected,
                onClick = { onSelect(destination.key) },
                icon = {
                    Icon(
                        imageVector = destination.icon,
                        contentDescription = destination.label,
                        modifier = Modifier.size(21.dp),
                    )
                },
                label = {
                    Text(
                        text = destination.label,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                    )
                },
                colors =
                    NavigationBarItemDefaults.colors(
                        selectedIconColor = Royal,
                        selectedTextColor = Royal,
                        indicatorColor = BlueSoft,
                        unselectedIconColor = Faint,
                        unselectedTextColor = Faint,
                    ),
            )
        }
    }
}

@Composable
fun StatusPill(status: StockStatus) {
    val (background, foreground, label) =
        when (status) {
            StockStatus.AMAN -> Triple(SuccessSoft, Color(0xFF15803D), "AMAN")
            StockStatus.MENIPIS -> Triple(AmberSoft, Color(0xFFB45309), "MENIPIS")
            StockStatus.HABIS -> Triple(DangerSoft, Danger, "HABIS")
        }
    Box(
        modifier =
            Modifier
                .background(background, CircleShape)
                .padding(horizontal = 10.dp, vertical = 3.dp),
    ) {
        Text(
            text = label,
            color = foreground,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
fun InfoPill(
    text: String,
    background: Color,
    foreground: Color,
) {
    Box(
        modifier =
            Modifier
                .background(background, CircleShape)
                .padding(horizontal = 10.dp, vertical = 3.dp),
    ) {
        Text(
            text = text,
            color = foreground,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
fun StockBar(
    current: Int,
    minimum: Int,
    modifier: Modifier = Modifier,
) {
    val fraction = (current / (minimum.coerceAtLeast(1) * 2f)).coerceIn(0f, 1f)
    val color =
        when {
            current == 0 -> Danger
            current <= minimum -> Amber
            else -> Success
        }
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .height(7.dp)
                .background(Canvas, CircleShape),
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth(fraction)
                    .fillMaxHeight()
                    .background(color, CircleShape),
        )
    }
}

@Composable
fun MetricCard(
    label: String,
    value: String,
    supporting: String,
    accent: Color,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, Line),
        colors = CardDefaults.cardColors(containerColor = White),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(
                text = label.uppercase(),
                color = Muted,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.4.sp,
            )
            Text(
                text = value,
                color = accent,
                fontSize = 20.sp,
                fontWeight = FontWeight.ExtraBold,
                modifier = Modifier.padding(top = 4.dp),
            )
            Text(
                text = supporting,
                color = Faint,
                fontSize = 10.sp,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
    }
}

@Composable
fun SectionTitle(text: String) {
    Text(
        text = text.uppercase(),
        color = Muted,
        fontSize = 11.sp,
        fontWeight = FontWeight.ExtraBold,
        letterSpacing = 0.8.sp,
        modifier = Modifier.padding(top = 16.dp, bottom = 8.dp, start = 4.dp),
    )
}

@Composable
fun InfoBanner(
    text: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .background(AmberSoft, RoundedCornerShape(12.dp))
                .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(
            Icons.Filled.Warning,
            contentDescription = null,
            tint = Amber,
            modifier = Modifier.size(16.dp),
        )
        Text(
            text = text,
            color = Color(0xFF92400E),
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
fun EmptyState(
    title: String,
    description: String,
    modifier: Modifier = Modifier,
    icon: ImageVector = Icons.Filled.Info,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp, vertical = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = Faint,
            modifier = Modifier.size(36.dp),
        )
        Text(
            text = title,
            color = Muted,
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
        )
        Text(
            text = description,
            color = Faint,
            fontSize = 11.sp,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
fun ErrorState(
    message: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp, vertical = 36.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(
            imageVector = Icons.Filled.Warning,
            contentDescription = null,
            tint = Danger,
            modifier = Modifier.size(34.dp),
        )
        Text(
            text = "Gagal memuat data",
            color = Ink,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
        )
        Text(
            text = message,
            color = Muted,
            fontSize = 11.sp,
            textAlign = TextAlign.Center,
        )
        OutlinedButton(
            onClick = onRetry,
            shape = RoundedCornerShape(10.dp),
            border = BorderStroke(1.dp, Line),
        ) {
            Text("Coba lagi", color = Muted, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun LoadingState(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.fillMaxWidth().padding(vertical = 48.dp),
        contentAlignment = Alignment.Center,
    ) {
        CircularProgressIndicator(color = Royal, modifier = Modifier.size(28.dp))
    }
}

@Composable
fun PrimaryActionButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
) {
    Button(
        onClick = onClick,
        enabled = enabled && !loading,
        modifier = modifier.fillMaxWidth().height(50.dp),
        shape = RoundedCornerShape(13.dp),
        colors = ButtonDefaults.buttonColors(containerColor = Royal, contentColor = White),
    ) {
        if (loading) {
            CircularProgressIndicator(
                color = White,
                strokeWidth = 2.dp,
                modifier = Modifier.size(18.dp),
            )
        } else {
            Text(text = text, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold)
        }
    }
}

@Composable
fun SecondaryActionButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.fillMaxWidth().height(48.dp),
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.5.dp, Line),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = Muted),
    ) {
        Text(text = text, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
fun FieldLabel(text: String) {
    Text(
        text = text.uppercase(),
        color = Muted,
        fontSize = 10.5.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.5.sp,
        modifier = Modifier.padding(bottom = 5.dp),
    )
}

@Composable
fun ProductAvatar(product: Product) {
    val color =
        remember(product.colorHex) {
            runCatching { Color(product.colorHex.toColorInt()) }
                .getOrDefault(Blue)
        }
    Box(
        modifier =
            Modifier
                .size(40.dp)
                .background(color, RoundedCornerShape(11.dp)),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = productInitials(product.name),
            color = White,
            fontSize = 11.sp,
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
fun HorizontalSpacer(width: Int) {
    Spacer(modifier = Modifier.width(width.dp))
}
