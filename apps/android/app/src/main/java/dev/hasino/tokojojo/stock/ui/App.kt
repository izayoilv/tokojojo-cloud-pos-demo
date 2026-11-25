package dev.hasino.tokojojo.stock.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
import dev.hasino.tokojojo.stock.data.ConnectionState
import dev.hasino.tokojojo.stock.data.DeviceStatus
import dev.hasino.tokojojo.stock.ui.components.TokoBottomBar
import dev.hasino.tokojojo.stock.ui.components.TokoTopBar
import dev.hasino.tokojojo.stock.ui.navigation.AdjustKey
import dev.hasino.tokojojo.stock.ui.navigation.HomeKey
import dev.hasino.tokojojo.stock.ui.navigation.MoreKey
import dev.hasino.tokojojo.stock.ui.navigation.OpnameKey
import dev.hasino.tokojojo.stock.ui.navigation.ReceiveKey
import dev.hasino.tokojojo.stock.ui.navigation.StockDetailKey
import dev.hasino.tokojojo.stock.ui.navigation.StockKey
import dev.hasino.tokojojo.stock.ui.navigation.TransferKey
import dev.hasino.tokojojo.stock.ui.navigation.navTitle
import dev.hasino.tokojojo.stock.ui.navigation.topLevelKeys
import dev.hasino.tokojojo.stock.ui.screens.AdjustScreen
import dev.hasino.tokojojo.stock.ui.screens.BerandaScreen
import dev.hasino.tokojojo.stock.ui.screens.DevicePendingScreen
import dev.hasino.tokojojo.stock.ui.screens.LoginScreen
import dev.hasino.tokojojo.stock.ui.screens.MoreScreen
import dev.hasino.tokojojo.stock.ui.screens.OpnameScreen
import dev.hasino.tokojojo.stock.ui.screens.ReceiveScreen
import dev.hasino.tokojojo.stock.ui.screens.ScannerDialog
import dev.hasino.tokojojo.stock.ui.screens.StockDetailScreen
import dev.hasino.tokojojo.stock.ui.screens.StockListScreen
import dev.hasino.tokojojo.stock.ui.screens.TransferScreen
import dev.hasino.tokojojo.stock.ui.theme.LocalTokoColors
import dev.hasino.tokojojo.stock.ui.theme.TokoJojoTheme

@Composable
fun TokoJojoApp(viewModel: StockViewModel = viewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    TokoJojoTheme(mode = state.themeMode, textSize = state.textSize) {
        when {
            state.session == null -> {
                LoginScreen(
                    state = state,
                    onLogin = viewModel::login,
                    onRetryConnection = { viewModel.setConnection(ConnectionState.ONLINE) },
                )
            }

            state.device.status != DeviceStatus.APPROVED -> {
                DevicePendingScreen(
                    state = state,
                    onRetry = viewModel::refresh,
                    onDemoApprove = { viewModel.setDeviceStatus(DeviceStatus.APPROVED) },
                    onLogout = viewModel::logout,
                )
            }

            else -> {
                MainShell(state = state, viewModel = viewModel)
            }
        }
    }
}

@Composable
private fun MainShell(
    state: StockUiState,
    viewModel: StockViewModel,
) {
    val colors = LocalTokoColors.current
    val backStack = rememberNavBackStack(HomeKey)
    val current = backStack.lastOrNull()
    val titleSubtitle = navTitle(current)
    val topLevel = current == null || current in topLevelKeys
    val snackbarHostState = remember { SnackbarHostState() }
    var scannerOpen by remember { mutableStateOf(false) }

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

    fun cycleConnection() {
        val next =
            when (state.connection) {
                ConnectionState.ONLINE -> ConnectionState.OFFLINE
                ConnectionState.OFFLINE -> ConnectionState.ERROR
                ConnectionState.ERROR -> ConnectionState.ONLINE
            }
        viewModel.setConnection(next)
    }

    if (scannerOpen) {
        ScannerDialog(
            products = state.products,
            onDismiss = { scannerOpen = false },
            onProductPicked = { product ->
                scannerOpen = false
                backStack.add(StockDetailKey(product.id))
            },
        )
    }

    Scaffold(
        containerColor = colors.canvas,
        topBar = {
            TokoTopBar(
                title = titleSubtitle.first,
                subtitle = titleSubtitle.second,
                connection = state.connection,
                onScan = { scannerOpen = true },
                onConnectionClick = ::cycleConnection,
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
                TokoBottomBar(selected = current, onSelect = ::goTopLevel)
            }
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            if (state.error != null && state.products.isNotEmpty()) {
                InlineConnectionError(
                    message = state.error,
                    onRetry = {
                        viewModel.clearError()
                        viewModel.refresh()
                    },
                )
            }
            NavDisplay(
                modifier = Modifier.fillMaxSize(),
                backStack = backStack,
                onBack = {
                    if (backStack.size > 1) {
                        backStack.removeLastOrNull()
                    }
                },
                entryProvider =
                    entryProvider {
                        entry<HomeKey> {
                            BerandaScreen(
                                state = state,
                                onReceive = { goTopLevel(ReceiveKey) },
                                onAdjust = { productId -> backStack.add(AdjustKey(productId)) },
                                onOpenStock = { goTopLevel(StockKey) },
                                onProduct = { productId -> backStack.add(StockDetailKey(productId)) },
                                onRefresh = viewModel::refresh,
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
                        entry<MoreKey> {
                            MoreScreen(
                                state = state,
                                onTheme = viewModel::setTheme,
                                onTextSize = viewModel::setTextSize,
                                onScannerSound = viewModel::setScannerSound,
                                onScannerVibrate = viewModel::setScannerVibrate,
                                onDefaultLocation = viewModel::setDefaultLocation,
                                onConnection = viewModel::setConnection,
                                onDeviceStatus = viewModel::setDeviceStatus,
                                onRefresh = viewModel::refresh,
                                onTransfers = { backStack.add(TransferKey) },
                                onOpname = { backStack.add(OpnameKey) },
                                onLogout = viewModel::logout,
                            )
                        }
                        entry<StockDetailKey> { key ->
                            val product = state.products.firstOrNull { it.id == key.productId }
                            StockDetailScreen(
                                product = product,
                                movements = state.movements[key.productId].orEmpty(),
                                onReceive = { goTopLevel(ReceiveKey) },
                                onAdjust = { productId -> backStack.add(AdjustKey(productId)) },
                            )
                        }
                        entry<AdjustKey> { key ->
                            AdjustScreen(
                                state = state,
                                initialProductId = key.productId,
                                onSubmit = viewModel::submitAdjustment,
                            )
                        }
                        entry<TransferKey> {
                            TransferScreen(
                                state = state,
                                onCreate = viewModel::createTransfer,
                                onComplete = viewModel::completeTransfer,
                            )
                        }
                        entry<OpnameKey> {
                            OpnameScreen(
                                state = state,
                                onCreate = viewModel::createOpname,
                            )
                        }
                    },
            )
        }
    }
}

@Composable
private fun InlineConnectionError(
    message: String,
    onRetry: () -> Unit,
) {
    val colors = LocalTokoColors.current
    Row(
        modifier = Modifier.background(colors.dangerSoft).padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(Icons.Rounded.Warning, contentDescription = null, tint = colors.danger, modifier = Modifier.padding(2.dp))
        Text(
            text = message,
            color = colors.danger,
            fontFamily = dev.hasino.tokojojo.stock.ui.theme.PlusJakarta,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = "Coba lagi",
            color = colors.danger,
            fontFamily = dev.hasino.tokojojo.stock.ui.theme.PlusJakarta,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            modifier =
                Modifier
                    .clickable(onClick = onRetry)
                    .padding(4.dp)
                    .background(
                        colors.dangerSoft,
                        androidx.compose.foundation.shape
                            .RoundedCornerShape(6.dp),
                    ).padding(6.dp),
        )
    }
}
