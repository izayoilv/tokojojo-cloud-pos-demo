package dev.hasino.tokojojo.stock.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat
import dev.hasino.tokojojo.stock.data.TextSize
import dev.hasino.tokojojo.stock.data.ThemeMode

val LocalTokoColors = staticCompositionLocalOf { LightTokoJojoColors }

private val LightScheme =
    lightColorScheme(
        primary = LightTokoJojoColors.primary,
        onPrimary = LightTokoJojoColors.onPrimary,
        primaryContainer = LightTokoJojoColors.primarySoft,
        onPrimaryContainer = LightTokoJojoColors.primaryActive,
        secondary = LightTokoJojoColors.accent,
        onSecondary = LightTokoJojoColors.inkInverse,
        background = LightTokoJojoColors.canvas,
        onBackground = LightTokoJojoColors.ink,
        surface = LightTokoJojoColors.surface,
        onSurface = LightTokoJojoColors.ink,
        surfaceVariant = LightTokoJojoColors.subtle,
        onSurfaceVariant = LightTokoJojoColors.inkSecondary,
        outline = LightTokoJojoColors.lineControl,
        error = LightTokoJojoColors.danger,
        onError = LightTokoJojoColors.inkInverse,
    )

private val DarkScheme =
    darkColorScheme(
        primary = DarkTokoJojoColors.primary,
        onPrimary = DarkTokoJojoColors.onPrimary,
        primaryContainer = DarkTokoJojoColors.primarySoft,
        onPrimaryContainer = DarkTokoJojoColors.primary,
        secondary = DarkTokoJojoColors.accent,
        onSecondary = DarkTokoJojoColors.inkInverse,
        background = DarkTokoJojoColors.canvas,
        onBackground = DarkTokoJojoColors.ink,
        surface = DarkTokoJojoColors.surface,
        onSurface = DarkTokoJojoColors.ink,
        surfaceVariant = DarkTokoJojoColors.subtle,
        onSurfaceVariant = DarkTokoJojoColors.inkSecondary,
        outline = DarkTokoJojoColors.lineControl,
        error = DarkTokoJojoColors.danger,
        onError = DarkTokoJojoColors.inkInverse,
    )

@Composable
fun TokoJojoTheme(
    mode: ThemeMode = ThemeMode.SYSTEM,
    textSize: TextSize = TextSize.NORMAL,
    content: @Composable () -> Unit,
) {
    val dark =
        when (mode) {
            ThemeMode.LIGHT -> false
            ThemeMode.DARK -> true
            ThemeMode.SYSTEM -> isSystemInDarkTheme()
        }
    val colors = if (dark) DarkTokoJojoColors else LightTokoJojoColors
    val density = LocalDensity.current
    val scale = if (textSize == TextSize.LARGE) 1.12f else 1f
    val view = LocalView.current

    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            WindowCompat.getInsetsController(window, view).apply {
                isAppearanceLightStatusBars = !dark
                isAppearanceLightNavigationBars = !dark
            }
        }
    }

    CompositionLocalProvider(
        LocalTokoColors provides colors,
        LocalDensity provides
            androidx.compose.ui.unit
                .Density(density.density, density.fontScale * scale),
    ) {
        MaterialTheme(
            colorScheme = if (dark) DarkScheme else LightScheme,
            typography = TokoJojoTypography,
            content = content,
        )
    }
}
