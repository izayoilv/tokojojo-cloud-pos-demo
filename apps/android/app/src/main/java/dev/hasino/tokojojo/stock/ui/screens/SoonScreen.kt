package dev.hasino.tokojojo.stock.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.hasino.tokojojo.stock.ui.components.InfoPill
import dev.hasino.tokojojo.stock.ui.theme.Amber
import dev.hasino.tokojojo.stock.ui.theme.AmberSoft
import dev.hasino.tokojojo.stock.ui.theme.Faint
import dev.hasino.tokojojo.stock.ui.theme.Ink
import dev.hasino.tokojojo.stock.ui.theme.Line
import dev.hasino.tokojojo.stock.ui.theme.Muted
import dev.hasino.tokojojo.stock.ui.theme.White

@Composable
fun SoonScreen(
    title: String,
    description: String,
    accent: Color,
) {
    Box(
        modifier = Modifier.fillMaxSize().padding(20.dp),
        contentAlignment = Alignment.Center,
    ) {
        Card(
            modifier = Modifier.fillMaxSize(),
            shape = RoundedCornerShape(16.dp),
            border = BorderStroke(1.dp, Line),
            colors = CardDefaults.cardColors(containerColor = White),
        ) {
            Column(
                modifier = Modifier.fillMaxSize().padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(68.dp)
                            .background(accent.copy(alpha = 0.12f), RoundedCornerShape(18.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        Icons.Filled.Info,
                        contentDescription = null,
                        tint = accent,
                        modifier = Modifier.size(30.dp),
                    )
                }
                InfoPill("SEGERA HADIR", AmberSoft, Amber)
                Text(
                    text = title,
                    color = Ink,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.ExtraBold,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 12.dp),
                )
                Text(
                    text = description,
                    color = Muted,
                    fontSize = 12.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 8.dp),
                )
                Text(
                    text =
                        "Flow ini disiapkan pada rilis berikutnya. Gunakan tab Terima atau " +
                            "tombol Sesuaikan Stok untuk alur yang sudah aktif.",
                    color = Faint,
                    fontSize = 10.5.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 16.dp),
                )
            }
        }
    }
}
