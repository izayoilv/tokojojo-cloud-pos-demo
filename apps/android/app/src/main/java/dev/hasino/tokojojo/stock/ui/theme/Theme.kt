package dev.hasino.tokojojo.stock.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors =
    lightColorScheme(
        primary = Color(0xFF0F172A),
        secondary = Color(0xFF475569),
        background = Color(0xFFF8FAFC),
        surface = Color(0xFFFFFFFF),
    )

private val DarkColors =
    darkColorScheme(
        primary = Color(0xFFE2E8F0),
        secondary = Color(0xFF94A3B8),
        background = Color(0xFF0F172A),
        surface = Color(0xFF1E293B),
    )

@Composable
fun TokoJojoTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        content = content,
    )
}
