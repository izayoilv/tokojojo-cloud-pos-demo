package dev.hasino.tokojojo.stock.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.ui.NavDisplay
import dev.hasino.tokojojo.stock.data.DemoMode
import dev.hasino.tokojojo.stock.ui.components.StockBottomBar
import dev.hasino.tokojojo.stock.ui.components.StockTopBar
import dev.hasino.tokojojo.stock.ui.navigation.AdjustKey
import dev.hasino.tokojojo.stock.ui.navigation.HomeKey
import dev.hasino.tokojojo.stock.ui.navigation.OpnameKey
import dev.hasino.tokojojo.stock.ui.navigation.ReceiveKey
import dev.hasino.tokojojo.stock.ui.navigation.StockDetailKey
import dev.hasino.tokojojo.stock.ui.navigation.StockKey
import dev.hasino.tokojojo.stock.ui.navigation.TransferKey
import dev.hasino.tokojojo.stock.ui.navigation.navTitle
import dev.hasino.tokojojo.stock.ui.navigation.topLevelKeys
import dev.hasino.tokojojo.stock.ui.screens.AdjustStockScreen
import dev.hasino.tokojojo.stock.ui.screens.DashboardScreen
import dev.hasino.tokojojo.stock.ui.screens.LoginScreen
import dev.hasino.tokojojo.stock.ui.screens.ReceiveScreen
import dev.hasino.tokojojo.stock.ui.screens.SoonScreen
import dev.hasino.tokojojo.stock.ui.screens.StockDetailScreen
import dev.hasino.tokojojo.stock.ui.screens.StockListScreen
import dev.hasino.tokojojo.stock.ui.theme.Amber
import dev.hasino.tokojojo.stock.ui.theme.Canvas
import dev.hasino.tokojojo.stock.ui.theme.Danger
import dev.hasino.tokojojo.stock.ui.theme.DangerSoft
import dev.hasino.tokojojo.stock.ui.theme.Royal
import dev.hasino.tokojojo.stock.ui.theme.TokoJojoTheme

@Composable
fun TokoJojoApp(viewModel: StockViewModel = viewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    TokoJojoTheme {
        if (state.session == null) {
            LoginScreen(state = state, onLogin = viewModel::login)
        } else {
            MainShell(
                state = state,
                viewModel = viewModel,
            )
        }
    }
}

@Composable
private fun MainShell(
    state: StockUiState,
    viewModel: StockViewModel,
) {
    val backStack = rememberNavBackStack(HomeKey)
    val current = backStack.lastOrNull()
    val titleSubtitle = navTitle(current)
    val snackbarHostState = remember { SnackbarHostState() }
    val topLevel = current == null || current in topLevelKeys

    LaunchedEffect(state.message) {
        val message = state.message
        if (message != null) {
            snackbarHostState.showSnackbar(message)
            viewModel.clearMessage()
        }
    }

    fun goTopLevel(key: NavKey) {
        backStack.clear()
        backStack.add(key)
    }

    Scaffold(
        containerColor = Canvas,
        topBar = {
            StockTopBar(
                title = titleSubtitle.first,
                subtitle = titleSubtitle.second,
                demoMode = state.demoMode,
                onDemoModeChange = { mode ->
                    viewModel.setDemoMode(mode)
                    when (mode) {
                        DemoMode.ERROR -> {
                            viewModel.refresh()
                        }

                        DemoMode.NORMAL -> {
                            viewModel.clearError()
                            viewModel.refresh()
                        }

                        DemoMode.OFFLINE -> {
                            Unit
                        }
                    }
                },
                onBack =
                    if (topLevel) {
                        null
                    } else {
                        {
                            if (backStack.size > 1) {
                                backStack.removeLastOrNull()
                            } else {
                                goTopLevel(HomeKey)
                            }
                        }
                    },
            )
        },
        bottomBar = {
            if (topLevel) {
                StockBottomBar(
                    selected = current,
                    onSelect = ::goTopLevel,
                )
            }
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(padding),
        ) {
            if (state.error != null && state.products.isNotEmpty()) {
                InlineErrorBanner(
                    message = state.error,
                    onRetry = {
                        viewModel.clearError()
                        viewModel.refresh()
                    },
                )
            }

            NavDisplay(
                modifier = Modifier.weight(1f),
                backStack = backStack,
                onBack = {
                    if (backStack.size > 1) {
                        backStack.removeLastOrNull()
                    }
                },
                entryProvider =
                    entryProvider {
                        entry<HomeKey> {
                            DashboardScreen(
                                state = state,
                                onRetry = viewModel::refresh,
                                onReceive = { goTopLevel(ReceiveKey) },
                                onAdjust = { productId -> backStack.add(AdjustKey(productId)) },
                                onOpenStock = { goTopLevel(StockKey) },
                            )
                        }
                        entry<StockKey> {
                            StockListScreen(
                                state = state,
                                onProductClick = { productId -> backStack.add(StockDetailKey(productId)) },
                                onRetry = viewModel::refresh,
                            )
                        }
                        entry<ReceiveKey> {
                            ReceiveScreen(
                                state = state,
                                onSubmit = viewModel::submitReceipt,
                            )
                        }
                        entry<TransferKey> {
                            SoonScreen(
                                title = "Mutasi Stok",
                                description = "Mutasi WH-BACK ↔ STORE-FRONT akan hadir dengan alur serah terima dan approval.",
                                accent = Royal,
                            )
                        }
                        entry<OpnameKey> {
                            SoonScreen(
                                title = "Stock Opname",
                                description =
                                    "Sesi hitung fisik akan hadir di rilis berikutnya. " +
                                        "Untuk sekarang gunakan tombol Sesuaikan Stok.",
                                accent = Amber,
                            )
                        }
                        entry<StockDetailKey> { key ->
                            val product = state.products.firstOrNull { it.id == key.productId }
                            StockDetailScreen(
                                product = product,
                                onReceive = { goTopLevel(ReceiveKey) },
                                onAdjust = { productId -> backStack.add(AdjustKey(productId)) },
                            )
                        }
                        entry<AdjustKey> { key ->
                            AdjustStockScreen(
                                state = state,
                                initialProductId = key.productId,
                                onSubmit = viewModel::submitAdjustment,
                            )
                        }
                    },
            )
        }
    }
}

@Composable
private fun InlineErrorBanner(
    message: String,
    onRetry: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(DangerSoft)
                .padding(horizontal = 14.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(Icons.Filled.Warning, contentDescription = null, tint = Danger)
        Text(
            text = message,
            color = Danger,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.weight(1f),
        )
        Button(
            onClick = onRetry,
            shape = RoundedCornerShape(8.dp),
            contentPadding =
                androidx.compose.foundation.layout
                    .PaddingValues(horizontal = 10.dp, vertical = 4.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Danger, contentColor = dev.hasino.tokojojo.stock.ui.theme.White),
        ) {
            Text("Coba lagi", fontSize = 10.sp, fontWeight = FontWeight.Bold)
        }
    }
}
