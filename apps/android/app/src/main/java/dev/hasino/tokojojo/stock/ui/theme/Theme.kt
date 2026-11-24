package dev.hasino.tokojojo.stock.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

private val TokoJojoColors =
    lightColorScheme(
        primary = Royal,
        onPrimary = White,
        primaryContainer = BlueSoft,
        onPrimaryContainer = Navy,
        secondary = Blue,
        onSecondary = White,
        background = Canvas,
        onBackground = Ink,
        surface = White,
        onSurface = Ink,
        surfaceVariant = Canvas,
        onSurfaceVariant = Muted,
        outline = Line,
        error = Danger,
        onError = White,
    )

private val TokoJojoTypography =
    Typography(
        headlineMedium = TextStyle(fontSize = 22.sp, fontWeight = FontWeight.ExtraBold),
        titleLarge = TextStyle(fontSize = 18.sp, fontWeight = FontWeight.ExtraBold),
        titleMedium = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.Bold),
        bodyLarge = TextStyle(fontSize = 14.sp),
        bodyMedium = TextStyle(fontSize = 13.sp),
        bodySmall = TextStyle(fontSize = 11.sp),
        labelLarge = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.Bold),
        labelMedium = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Bold),
        labelSmall = TextStyle(fontSize = 10.sp, fontWeight = FontWeight.Bold),
    )

@Composable
fun TokoJojoTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = TokoJojoColors,
        typography = TokoJojoTypography,
        content = content,
    )
}
