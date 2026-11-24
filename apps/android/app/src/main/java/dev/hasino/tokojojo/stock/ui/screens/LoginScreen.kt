package dev.hasino.tokojojo.stock.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.hasino.tokojojo.stock.ui.StockUiState
import dev.hasino.tokojojo.stock.ui.theme.Canvas
import dev.hasino.tokojojo.stock.ui.theme.Danger
import dev.hasino.tokojojo.stock.ui.theme.Ink
import dev.hasino.tokojojo.stock.ui.theme.Line
import dev.hasino.tokojojo.stock.ui.theme.Muted
import dev.hasino.tokojojo.stock.ui.theme.Navy
import dev.hasino.tokojojo.stock.ui.theme.Navy2
import dev.hasino.tokojojo.stock.ui.theme.Royal
import dev.hasino.tokojojo.stock.ui.theme.White

@Composable
fun LoginScreen(
    state: StockUiState,
    onLogin: (String) -> Unit,
) {
    var pin by remember { mutableStateOf("") }

    LaunchedEffect(state.loginError) {
        if (state.loginError != null) pin = ""
    }

    LaunchedEffect(pin) {
        if (pin.length == 4 && !state.loginLoading) {
            onLogin(pin)
        }
    }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(Brush.linearGradient(listOf(Navy, Navy2, Royal))),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .imePadding()
                    .padding(horizontal = 26.dp, vertical = 28.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(66.dp)
                        .background(White, RoundedCornerShape(18.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Text("TJ", color = Navy, fontSize = 25.sp, fontWeight = FontWeight.ExtraBold)
            }
            Spacer(modifier = Modifier.height(14.dp))
            Text(
                text = "TOKO JOJO",
                color = White,
                fontSize = 22.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = 0.5.sp,
            )
            Text(
                text = "Aplikasi Gudang • WH-BACK / STORE-FRONT",
                color = Color(0xFFB6C4DE),
                fontSize = 12.sp,
                modifier = Modifier.padding(top = 3.dp),
            )

            Card(
                modifier = Modifier.fillMaxWidth().padding(top = 22.dp),
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = White),
                elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Row(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .background(Canvas, RoundedCornerShape(13.dp))
                                .border(1.dp, Line, RoundedCornerShape(13.dp))
                                .padding(horizontal = 13.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(11.dp),
                    ) {
                        Box(
                            modifier =
                                Modifier
                                    .size(40.dp)
                                    .background(Royal, CircleShape),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text("HS", color = White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        }
                        Column {
                            Text(
                                "Hendra Saputra",
                                color = Ink,
                                fontSize = 13.5.sp,
                                fontWeight = FontWeight.Bold,
                            )
                            Text(
                                "Staf Gudang (WAREHOUSE)",
                                color = Muted,
                                fontSize = 11.sp,
                            )
                        }
                    }

                    Text(
                        text = state.loginError.orEmpty(),
                        color = Danger,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .padding(top = 12.dp)
                                .height(16.dp),
                    )

                    Row(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .padding(vertical = 6.dp),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        repeat(4) { index ->
                            Box(
                                modifier =
                                    Modifier
                                        .padding(horizontal = 6.dp)
                                        .size(15.dp)
                                        .background(
                                            if (index < pin.length) Royal else Color.Transparent,
                                            CircleShape,
                                        ).border(2.dp, if (index < pin.length) Royal else Color(0xFFCBD5E1), CircleShape),
                            )
                        }
                    }

                    if (state.loginLoading) {
                        Row(
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 6.dp),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                color = Royal,
                                strokeWidth = 2.dp,
                            )
                            Text(
                                "  Memeriksa PIN...",
                                color = Muted,
                                fontSize = 11.sp,
                            )
                        }
                    }

                    Column(
                        modifier = Modifier.padding(top = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        listOf(
                            listOf("1", "2", "3"),
                            listOf("4", "5", "6"),
                            listOf("7", "8", "9"),
                            listOf("C", "0", "←"),
                        ).forEach { row ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(10.dp),
                            ) {
                                row.forEach { key ->
                                    Box(
                                        modifier =
                                            Modifier
                                                .weight(1f)
                                                .height(56.dp)
                                                .clip(RoundedCornerShape(14.dp))
                                                .background(Canvas)
                                                .border(1.dp, Line, RoundedCornerShape(14.dp))
                                                .clickable {
                                                    if (state.loginLoading) return@clickable
                                                    when (key) {
                                                        "C" -> pin = ""
                                                        "←" -> if (pin.isNotEmpty()) pin = pin.dropLast(1)
                                                        else -> if (pin.length < 4) pin += key
                                                    }
                                                },
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        Text(
                                            text = key,
                                            color = Ink,
                                            fontSize = if (key == "←") 18.sp else 21.sp,
                                            fontWeight = FontWeight.Bold,
                                        )
                                    }
                                }
                            }
                        }
                    }

                    Text(
                        text = "PIN demo: 4321 • fingerprint tersedia",
                        color = Muted,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth().padding(top = 14.dp),
                    )
                }
            }
        }
    }
}
