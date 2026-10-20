package co.ashwin.tend.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import co.ashwin.tend.core.Form
import co.ashwin.tend.core.Look
import co.ashwin.tend.core.Shape


val PILL_COLORS = listOf(
    "#ffffff", "#f6d57a", "#e9a23b", "#f2c230", "#f08a6c", "#b3263a",
    "#f4b6c2", "#8fc6e8", "#3c6fb6", "#9bd3a6", "#6b4a3a", "#2a2f3a",
)

val COLOR_NAME = mapOf(
    "#ffffff" to "White", "#f6d57a" to "Cream yellow", "#e9a23b" to "Amber", "#f2c230" to "Yellow",
    "#f08a6c" to "Coral", "#b3263a" to "Red", "#f4b6c2" to "Pink", "#8fc6e8" to "Light blue",
    "#3c6fb6" to "Blue", "#9bd3a6" to "Green", "#6b4a3a" to "Brown", "#2a2f3a" to "Black",
)

fun hex(c: String): Color = runCatching {
    val s = c.removePrefix("#")
    val full = if (s.length == 3) s.map { "$it$it" }.joinToString("") else s
    Color(0xFF000000 or full.toLong(16))
}.getOrDefault(Color.White)

private val PART = Color(0xFFCFC8BD)
private val EDGE = Color(0x2E1D2430)
private fun p(d: String) = PathParser().parsePathString(d).toPath()

private fun DrawScope.body(d: String, color: Color, white: Boolean) {
    val path = p(d)
    drawPath(path, color)
    if (white) drawPath(path, EDGE, style = Stroke(1.2f))
}

private fun DrawScope.formArt(form: Form, color: Color) {
    val white = color == Color.White
    when (form) {
        Form.Liquid -> {
            drawRoundRect(PART, Offset(12f, 2.5f), Size(8f, 5f), CornerRadius(1.5f))
            drawRect(PART, Offset(13f, 7f), Size(6f, 3.5f), alpha = 0.7f)
            body("M12 10h8a4 4 0 0 1 4 4v11.5a4 4 0 0 1-4 4h-8a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4z", color, white)
            drawRect(Color.White, Offset(8.6f, 16f), Size(14.8f, 7f), alpha = 0.8f)
        }
        Form.Drops -> {
            drawPath(p("M14.2 2.5h3.6l1.2 6.5h-6z"), PART)
            drawRoundRect(PART, Offset(11f, 9f), Size(10f, 4f), CornerRadius(1.2f))
            body("M13 13h6a4 4 0 0 1 4 4v8.5a4 4 0 0 1-4 4h-6a4 4 0 0 1-4-4V17a4 4 0 0 1 4-4z", color, white)
            drawRect(Color.White, Offset(9.6f, 18f), Size(12.8f, 5.5f), alpha = 0.8f)
        }
        Form.Puff -> {
            drawRoundRect(PART, Offset(11f, 2.5f), Size(8f, 10.5f), CornerRadius(2.5f))
            drawRoundRect(color, Offset(8.5f, 11f), Size(13f, 18.5f), CornerRadius(3.5f))
            drawRoundRect(color, Offset(17f, 22f), Size(10.5f, 7.5f), CornerRadius(2.5f))
        }
        Form.Injection -> rotate(32f, Offset(16f, 16f)) {
            drawRoundRect(color, Offset(12.5f, 2f), Size(7f, 21f), CornerRadius(3.2f))
            drawRoundRect(Color.White, Offset(14.2f, 7.5f), Size(3.6f, 7f), CornerRadius(1.2f), alpha = 0.85f)
            drawRoundRect(PART, Offset(13.5f, 23f), Size(5f, 3.5f), CornerRadius(1f))
            drawLine(Color(0xFF9AA0A8), Offset(16f, 26.5f), Offset(16f, 30.5f), 1.4f)
        }
        Form.Patch -> rotate(-12f, Offset(16f, 16f)) {
            drawRoundRect(color, Offset(4.5f, 4.5f), Size(23f, 23f), CornerRadius(6.5f))
            drawRoundRect(Color.White, Offset(10f, 10f), Size(12f, 12f), CornerRadius(3.2f), alpha = 0.65f)
        }
        Form.Cream -> rotate(-24f, Offset(16f, 16f)) {
            drawRoundRect(PART, Offset(9f, 2.5f), Size(14f, 3.5f), CornerRadius(1f))
            body("M9.5 6h13l-2.6 17.5h-7.8z", color, white)
            drawRoundRect(PART, Offset(12f, 23.5f), Size(8f, 6f), CornerRadius(1.8f))
        }
        Form.Tablet, Form.Capsule -> Unit
    }
}

/** A medicine's look: tablets and capsules by shape and colour, everything else as its container. */
@Composable
fun Pill(look: Look, form: Form, size: Dp = 24.dp) {
    if (form != Form.Tablet && form != Form.Capsule) {
        val s = size * 1.15f
        Canvas(Modifier.size(s)) {
            scale(this.size.width / 32f, Offset.Zero) { formArt(form, hex(look.colors.firstOrNull() ?: "#8fc6e8")) }
        }
        return
    }
    val a = hex(look.colors.getOrNull(0) ?: "#ffffff")
    val b = look.colors.getOrNull(1)?.let(::hex)
    val shape = if (form == Form.Capsule) Shape.Cap else look.shape
    Canvas(Modifier.size(size)) {
        val w = this.size.width
        rotate(-32f) {
            val (pw, ph) = when (shape) {
                Shape.Round -> w * 0.75f to w * 0.75f
                Shape.Cap -> w to w * 0.46f
                Shape.Oval -> w to w * 0.56f
            }
            val tl = Offset((w - pw) / 2, (w - ph) / 2)
            val r = CornerRadius(ph / 2)
            if (b == null) {
                if (shape == Shape.Oval) drawOval(a, tl, Size(pw, ph)) else drawRoundRect(a, tl, Size(pw, ph), r)
            } else {
                clipRect(tl.x, tl.y, tl.x + pw / 2, tl.y + ph) { drawRoundRect(a, tl, Size(pw, ph), r) }
                clipRect(tl.x + pw / 2, tl.y, tl.x + pw, tl.y + ph) { drawRoundRect(b, tl, Size(pw, ph), r) }
            }
            if (a == Color.White || b == Color.White) {
                if (shape == Shape.Oval) drawOval(EDGE, tl, Size(pw, ph), style = Stroke(1.5f.dp.toPx()))
                else drawRoundRect(EDGE, tl, Size(pw, ph), r, style = Stroke(1.5f.dp.toPx()))
            }
        }
    }
}

/** The pill on a small tile, as in rows. */
@Composable
fun PillChip(look: Look, form: Form, tile: Color = LocalPalette.current.milk, size: Dp = 40.dp, pill: Dp = 24.dp) {
    Box(Modifier.size(size).background(tile, RoundedCornerShape(size * 0.325f)), contentAlignment = Alignment.Center) {
        Pill(look, form, pill)
    }
}
