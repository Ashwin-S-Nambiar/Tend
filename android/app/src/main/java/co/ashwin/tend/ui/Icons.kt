package co.ashwin.tend.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp


private fun circle(cx: Float, cy: Float, r: Float) = "M${cx - r} ${cy}a$r $r 0 1 0 ${2 * r} 0a$r $r 0 1 0 ${-2 * r} 0"

private fun rect(x: Float, y: Float, w: Float, h: Float, r: Float) =
    "M${x + r} ${y}h${w - 2 * r}a$r $r 0 0 1 $r ${r}v${h - 2 * r}a$r $r 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a$r $r 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a$r $r 0 0 1 $r ${-r}z"

enum class Ic(vararg val d: String) {
    Today(circle(12f, 12f, 8f), "M12 8v4l2.5 2"),
    Meds,
    History("M5 19v-7M10 19V6M15 19v-5M20 19V9"),
    Routines(circle(12f, 13f, 3.5f), "M12 4v2M4.5 13h2M17.5 13h2M6.7 7.7l1.4 1.4M17.3 7.7l-1.4 1.4M4 19h16"),
    You(circle(12f, 9f, 4f), "M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5"),
    Plus("M12 5v14M5 12h14"),
    Check("m5 12.5 4.5 4.5L19 7.5"),
    Close("M6 6l12 12M18 6 6 18"),
    More,
    Back("M15 5l-7 7 7 7"),
    Next("m9 5 7 7-7 7"),
    Snooze(circle(12f, 13f, 7.5f), "M12 9.5V13l2 1.5M5 4.5 3 6.5M19 4.5l2 2"),
    Skip("M6 12h12"),
    Bell("M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z", "M10 20.5a2.2 2.2 0 0 0 4 0"),
    Share("M12 15V4M8 8l4-4 4 4", "M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"),
    Download("M12 4v11M8 11l4 4 4-4", "M5 19h14"),
    Upload("M12 15V4M8 8l4-4 4 4", "M5 19h14"),
    Calendar(rect(4f, 5.5f, 16f, 14.5f, 3.5f), "M8 3.5v4M16 3.5v4M4 10.5h16"),
    Sound("M5 10v4h3l4 3.5v-11L8 10z", "M16 9.5a3.5 3.5 0 0 1 0 5M18.5 7a7 7 0 0 1 0 10"),
    Mute("M5 10v4h3l4 3.5v-11L8 10z", "m16 10 4 4M20 10l-4 4"),
    Edit("M5 19l1-4L15.5 5.5a2 2 0 0 1 3 3L9 18zM13.5 7.5l3 3"),
    Archive(rect(4f, 5f, 16f, 4f, 1.5f), "M5.5 9v8.5a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V9M10 13h4"),
    Trash("M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"),
    Lock(rect(5f, 10.5f, 14f, 9.5f, 3f), "M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"),
    Globe(circle(12f, 12f, 8f), "M4 12h16M12 4c2.5 2.5 3.5 5 3.5 8s-1 5.5-3.5 8c-2.5-2.5-3.5-5-3.5-8s1-5.5 3.5-8Z"),
    Copy(rect(8f, 8f, 11f, 11f, 3f), "M5 15V7a2 2 0 0 1 2-2h8"),
    Card(rect(3.5f, 5.5f, 17f, 13f, 3.5f), "M7.5 10h5M7.5 14h9"),
    Clock(circle(12f, 12f, 8f), "M12 8v4h3"),
    Camera(rect(3.5f, 7f, 17f, 12.5f, 3.5f), circle(12f, 13.2f, 3.4f), "M9 7l1.2-2.2h3.6L15 7"),
    Phone(rect(6f, 3f, 12f, 18f, 3f), "M10.5 17.5h3"),
    Alarm(circle(12f, 13f, 7.5f), "M12 9.5V13l2 1.5M5 4.5 3 6.5M19 4.5l2 2");

    val paths: List<Path> by lazy { d.map { PathParser().parsePathString(it).toPath() } }
}

@Composable
fun Icon(icon: Ic, color: Color, modifier: Modifier = Modifier, size: Dp = 24.dp, stroke: Float = 2f) {
    Canvas(modifier.size(size)) {
        val s = this.size.minDimension / 24f
        scale(s, pivot = Offset.Zero) {
            when (icon) {
                Ic.More -> listOf(6f, 12f, 18f).forEach { drawCircle(color, 1.4f, Offset(it, 12f)) }
                Ic.Meds -> rotate(-30f, Offset(12f, 12f)) {
                    drawPath(PathParser().parsePathString(rect(8f, 3f, 8f, 18f, 4f)).toPath(), color, style = Stroke(stroke, cap = StrokeCap.Round, join = StrokeJoin.Round))
                    drawLine(color, Offset(8f, 12f), Offset(16f, 12f), stroke)
                }
                else -> icon.paths.forEach {
                    drawPath(it, color, style = Stroke(stroke, cap = StrokeCap.Round, join = StrokeJoin.Round))
                }
            }
        }
    }
}
