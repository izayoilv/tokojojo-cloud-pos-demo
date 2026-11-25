package dev.hasino.tokojojo.stock.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Visibility
import androidx.compose.material.icons.rounded.VisibilityOff
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.hasino.tokojojo.stock.data.ConnectionState
import dev.hasino.tokojojo.stock.ui.StockUiState
import dev.hasino.tokojojo.stock.ui.components.BannerTone
import dev.hasino.tokojojo.stock.ui.components.FieldLabel
import dev.hasino.tokojojo.stock.ui.components.InfoBanner
import dev.hasino.tokojojo.stock.ui.components.PrimaryButton
import dev.hasino.tokojojo.stock.ui.components.SecondaryButton
import dev.hasino.tokojojo.stock.ui.components.TokoCard
import dev.hasino.tokojojo.stock.ui.components.tokoFieldColors
import dev.hasino.tokojojo.stock.ui.theme.Dimens
import dev.hasino.tokojojo.stock.ui.theme.LocalTokoColors
import dev.hasino.tokojojo.stock.ui.theme.PlusJakarta

@Composable
fun LoginScreen(
    state: StockUiState,
    onLogin: (String, String) -> Unit,
    onRetryConnection: () -> Unit,
) {
    val colors = LocalTokoColors.current
    var username by remember { mutableStateOf("gudang") }
    var password by remember { mutableStateOf("tokojojo123") }
    var showPassword by remember { mutableStateOf(false) }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(colors.canvas)
                .imePadding(),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp, vertical = 28.dp),
            verticalArrangement = Arrangement.Center,
        ) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Box {
                    Box(
                        modifier =
                            Modifier
                                .size(64.dp)
                                .background(colors.primary, RoundedCornerShape(16.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            "TJ",
                            color = colors.onPrimary,
                            fontFamily = PlusJakarta,
                            fontSize = 24.sp,
                            fontWeight = FontWeight.ExtraBold,
                        )
                    }
                    Box(
                        modifier =
                            Modifier
                                .align(Alignment.TopEnd)
                                .size(16.dp)
                                .background(colors.accent, RoundedCornerShape(4.dp)),
                    )
                }
                Text(
                    text = "TokoJoJo",
                    color = colors.ink,
                    fontFamily = PlusJakarta,
                    fontSize = 26.sp,
                    fontWeight = FontWeight.ExtraBold,
                    modifier = Modifier.padding(top = 12.dp),
                )
                Text(
                    text = "Aplikasi Stok Gudang",
                    color = colors.inkMuted,
                    fontFamily = PlusJakarta,
                    fontSize = 13.sp,
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            if (state.connection != ConnectionState.ONLINE) {
                InfoBanner(
                    title = "Koneksi terputus",
                    body = "Login memerlukan koneksi. Periksa jaringan lalu coba lagi.",
                    tone = if (state.connection == ConnectionState.ERROR) BannerTone.DANGER else BannerTone.WARNING,
                    actionLabel = "Coba lagi",
                    onAction = onRetryConnection,
                    modifier = Modifier.padding(bottom = 12.dp),
                )
            }

            TokoCard {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Masuk ke TokoJoJo",
                        color = colors.ink,
                        fontFamily = PlusJakarta,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        text = "Gunakan akun karyawan toko.",
                        color = colors.inkMuted,
                        fontFamily = PlusJakarta,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(top = 2.dp, bottom = 16.dp),
                    )

                    FieldLabel("Username", required = true)
                    OutlinedTextField(
                        value = username,
                        onValueChange = { username = it },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        leadingIcon = { Icon(Icons.Rounded.Person, contentDescription = null) },
                        placeholder = { Text("cth: gudang", fontSize = 14.sp) },
                        shape = RoundedCornerShape(Dimens.radiusSm),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text, imeAction = ImeAction.Next),
                        colors = tokoFieldColors(),
                    )

                    Spacer(modifier = Modifier.height(12.dp))
                    FieldLabel("Password", required = true)
                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        leadingIcon = { Icon(Icons.Rounded.Lock, contentDescription = null) },
                        trailingIcon = {
                            IconButton(onClick = { showPassword = !showPassword }) {
                                Icon(
                                    if (showPassword) Icons.Rounded.VisibilityOff else Icons.Rounded.Visibility,
                                    contentDescription = if (showPassword) "Sembunyikan password" else "Tampilkan password",
                                )
                            }
                        },
                        visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                        shape = RoundedCornerShape(Dimens.radiusSm),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
                        colors = tokoFieldColors(),
                    )

                    if (state.loginError != null) {
                        Text(
                            text = state.loginError,
                            color = colors.danger,
                            fontFamily = PlusJakarta,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                            textAlign = TextAlign.Center,
                        )
                    }

                    PrimaryButton(
                        text = "Masuk",
                        onClick = { onLogin(username, password) },
                        loading = state.loginLoading,
                        modifier = Modifier.padding(top = 16.dp),
                    )

                    Text(
                        text = "Perangkat akan diverifikasi setelah login.",
                        color = colors.inkMuted,
                        fontFamily = PlusJakarta,
                        fontSize = 11.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            TokoCard {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text(
                        text = "Akun demo",
                        color = colors.ink,
                        fontFamily = PlusJakarta,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        text = "gudang / tokojojo123",
                        color = colors.inkMuted,
                        fontFamily = dev.hasino.tokojojo.stock.ui.theme.IbmPlexMono,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        SecondaryButton(
                            text = "Isi demo",
                            onClick = {
                                username = "gudang"
                                password = "tokojojo123"
                            },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
        }
    }
}
