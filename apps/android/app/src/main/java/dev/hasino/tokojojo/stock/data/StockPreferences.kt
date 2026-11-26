package dev.hasino.tokojojo.stock.data

import android.content.Context

interface StockPreferences {
    fun themeMode(): ThemeMode?

    fun textSize(): TextSize?

    fun setThemeMode(mode: ThemeMode)

    fun setTextSize(size: TextSize)
}

object NoOpStockPreferences : StockPreferences {
    override fun themeMode(): ThemeMode? = null

    override fun textSize(): TextSize? = null

    override fun setThemeMode(mode: ThemeMode) = Unit

    override fun setTextSize(size: TextSize) = Unit
}

class SharedPreferencesStockPreferences(
    context: Context,
) : StockPreferences {
    private val preferences =
        context.applicationContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    override fun themeMode(): ThemeMode? =
        preferences.getString(KEY_THEME, null)?.let { saved ->
            ThemeMode.entries.firstOrNull { it.name == saved }
        }

    override fun textSize(): TextSize? =
        preferences.getString(KEY_TEXT_SIZE, null)?.let { saved ->
            TextSize.entries.firstOrNull { it.name == saved }
        }

    override fun setThemeMode(mode: ThemeMode) {
        preferences.edit().putString(KEY_THEME, mode.name).commit()
    }

    override fun setTextSize(size: TextSize) {
        preferences.edit().putString(KEY_TEXT_SIZE, size.name).commit()
    }

    private companion object {
        const val PREFERENCES_NAME = "tokojojo_stock_preferences"
        const val KEY_THEME = "theme_mode"
        const val KEY_TEXT_SIZE = "text_size"
    }
}
