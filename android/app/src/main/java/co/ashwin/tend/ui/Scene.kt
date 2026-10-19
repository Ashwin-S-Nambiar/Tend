package co.ashwin.tend.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathOperation
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import co.ashwin.tend.core.Scene

private val STARS = listOf(
    Triple(8f, 22f, 1.2f), Triple(22f, 58f, 0.9f), Triple(34f, 14f, 1f), Triple(47f, 40f, 0.8f), Triple(58f, 70f, 1.1f),
    Triple(66f, 18f, 0.9f), Triple(79f, 52f, 1.2f), Triple(91f, 30f, 0.8f), Triple(14f, 82f, 0.8f), Triple(72f, 86f, 0.9f),
)

fun Palette.wash(scene: Scene) = when (scene) {
    Scene.Morning -> sunWash
    Scene.Afternoon -> noonWash
    Scene.Evening -> duskWash
    Scene.Night -> night
}

fun Palette.orb(scene: Scene) = when (scene) {
    Scene.Morning -> sun
    Scene.Afternoon -> noon
    Scene.Evening -> dusk
    Scene.Night -> star
}

private fun Palette.hill(scene: Scene) = when (scene) {
    Scene.Morning -> sun.copy(alpha = 0.38f)
    Scene.Afternoon -> noon.copy(alpha = 0.26f)
    Scene.Evening -> dusk.copy(alpha = 0.34f)
    Scene.Night -> night2
}

/** Pip's day behind a card: a wash, the sun or moon, and the hills. Night adds drifting stars. */
@Composable
fun SceneArt(scene: Scene, modifier: Modifier = Modifier, palette: Palette = LocalPalette.current) {
    val reduced = LocalReducedMotion.current
    val drift = if (scene == Scene.Night && !reduced) {
        val t = rememberInfiniteTransition(label = "stars")
        val v by t.animateFloat(0f, 1f, infiniteRepeatable(tween(120_000, easing = LinearEasing), RepeatMode.Restart), label = "drift")
        v
    } else 0f
    Canvas(modifier) { drawScene(scene, palette, drift) }
}

fun DrawScope.drawScene(scene: Scene, palette: Palette, drift: Float = 0f) {
    val w = size.width
    val h = size.height
    val dp = density
    drawRect(palette.wash(scene))
    if (scene == Scene.Night) {
        val band = h * 0.42f
        clipRect(0f, 0f, w, band) {
            for (copy in 0..1) {
                val ox = (copy - drift) * w
                for ((x, y, r) in STARS) {
                    val c = Offset(ox + x / 100f * w, y / 100f * band)
                    drawOval(palette.star, Offset(c.x - r * 0.55f * dp, c.y - r * dp), Size(r * 1.1f * dp, r * 2 * dp))
                }
            }
        }
    }
    val min = minOf(w, h)
    when (scene) {
        Scene.Night -> {
            val d = (min * 0.16f).coerceIn(44 * dp, 110 * dp)
            val right = (w * 0.14f).coerceIn(24 * dp, 180 * dp)
            val top = (h * 0.08f).coerceIn(16 * dp, 90 * dp)
            val c = Offset(w - right - d / 2, top + d / 2)
            val moon = Path().apply { addOval(Rect(c, d / 2)) }
            val bite = Path().apply { addOval(Rect(c + Offset(-d * 0.3f, -d * 0.12f), d / 2 * 0.92f)) }
            drawPath(Path.combine(PathOperation.Difference, moon, bite), palette.star)
        }
        Scene.Evening -> {
            val d = (min * 0.3f).coerceIn(56 * dp, 190 * dp)
            val right = (w * 0.04f).coerceIn(-20 * dp, 120 * dp)
            val cy = h * 0.72f
            clipRect(0f, 0f, w, cy) {
                drawCircle(palette.orb(scene), d / 2, Offset(w - right - d / 2, cy))
            }
        }
        else -> {
            val d = (min * 0.3f).coerceIn(56 * dp, 190 * dp)
            val right = (w * 0.04f).coerceIn(-20 * dp, 120 * dp)
            val top = (-h * 0.04f).coerceIn(-24 * dp, 40 * dp)
            drawCircle(palette.orb(scene), d / 2, Offset(w - right - d / 2, top + d / 2))
        }
    }
    val hh = h * 0.34f
    val y0 = h - hh
    val sx = w / 300f
    val sy = hh / 80f
    val hills = Path().apply {
        moveTo(0f, y0 + 46 * sy)
        quadraticTo(80 * sx, y0 + 6 * sy, 160 * sx, y0 + 40 * sy)
        quadraticTo(240 * sx, y0 + 74 * sy, 300 * sx, y0 + 30 * sy)
        lineTo(w, h)
        lineTo(0f, h)
        close()
    }
    drawPath(hills, palette.hill(scene))
}

/** The small scene mark used in rows: sunrise, sun, setting sun, moon. */
@Composable
fun SceneIcon(scene: Scene, size: Dp = 26.dp, palette: Palette = LocalPalette.current) {
    Canvas(Modifier.size(size)) {
        val u = this.size.width / 26f
        when (scene) {
            Scene.Morning -> {
                drawCircle(palette.sun, 7 * u, Offset(13 * u, 15 * u))
                val p = Path().apply { moveTo(3 * u, 21 * u); quadraticTo(13 * u, 15 * u, 23 * u, 21 * u) }
                drawPath(p, palette.sun, style = Stroke(2.5f * u, cap = StrokeCap.Round))
            }
            Scene.Afternoon -> drawCircle(palette.noon, 9 * u, Offset(13 * u, 13 * u))
            Scene.Evening -> clipRect(0f, 0f, 26 * u, 18 * u) { drawCircle(palette.dusk, 10 * u, Offset(13 * u, 18 * u)) }
            Scene.Night -> {
                val moon = Path().apply { addOval(Rect(Offset(12 * u, 14 * u), 9 * u)) }
                val bite = Path().apply { addOval(Rect(Offset(18 * u, 9 * u), 8 * u)) }
                drawPath(Path.combine(PathOperation.Difference, moon, bite), palette.star)
            }
        }
    }
}

fun Palette.sceneTile(scene: Scene): Color = if (scene == Scene.Night) (if (dark) night2 else night) else wash(scene)
