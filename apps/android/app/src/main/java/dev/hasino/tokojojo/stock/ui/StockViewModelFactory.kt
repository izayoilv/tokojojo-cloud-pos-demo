package dev.hasino.tokojojo.stock.ui

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import dev.hasino.tokojojo.stock.data.SharedPreferencesStockPreferences

class StockViewModelFactory(
    private val context: Context,
) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (!modelClass.isAssignableFrom(StockViewModel::class.java)) {
            throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
        }

        @Suppress("UNCHECKED_CAST")
        return StockViewModel(
            preferences = SharedPreferencesStockPreferences(context),
        ) as T
    }
}
