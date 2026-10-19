package co.ashwin.tend.ui

import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.hideFromAccessibility
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import co.ashwin.tend.feel.Feels
import co.ashwin.tend.feel.Haptic
import kotlinx.coroutines.delay
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sign
import kotlin.random.Random

// Ported from src/components/Pip.tsx: the eye rig runs on hand-written springs (response and
// damping, as Apple specifies them), and the body moves on the same keyframes as the web.

enum class Mood { Hello, Idle, Due, Nudge, Taken, Skipped, Done, Low, Adding, Sleep, Lost }

private const val TAU = PI * 2
private const val AX = 100f
private const val AY = 70f
private const val SEP = 15f

private class Sp(var x: Float, var v: Float = 0f) {
    fun step(target: Float, dt: Float, response: Float, damping: Float) {
        val k = (TAU / response).let { it * it }.toFloat()
        val c = (4 * PI * damping / response).toFloat()
        v += (k * (target - x) - c * v) * dt
        x += v * dt
    }

    fun settled(target: Float) = abs(v) < 0.02f && abs(target - x) < 0.02f
}

private data class Target(
    val w: FloatArray, val h: FloatArray, val k: Float, val span: Float, val sw: Float,
    val gx: Float, val gy: Float, val fast: Boolean, val blink: Boolean,
)

private class Rig(mood: Mood) {
    var mood = mood
    var glanceX = 0f
    var glanceY = 0f
    var glanceUntil = 0L
    var nextBlink = Random.nextLong(3000)
    var blink0 = -1_000_000L
    var pokeUntil = 0L
    val gx = Sp(0f)
    val gy = Sp(0f)
    val k = Sp(0f)
    val span = Sp(24f)
    val sw = Sp(7.5f)
    val w = arrayOf(Sp(12f), Sp(12f))
    val h = arrayOf(Sp(26f), Sp(26f))

    fun target(t: Long): Target {
        var w = floatArrayOf(12f, 12f)
        var h = floatArrayOf(26f, 26f)
        var k = 0f
        var span = 24f
        var sw = 7.5f
        var gx = glanceX
        var gy = glanceY
        var fast = false
        var blink = true
        when (mood) {
            Mood.Due -> { w = floatArrayOf(14f, 14f); h = floatArrayOf(30f, 30f); gx = -5f; gy = 7f }
            Mood.Nudge -> { w = floatArrayOf(15f, 15f); h = floatArrayOf(29f, 29f); gx = 0f; gy = 1f }
            Mood.Hello, Mood.Taken -> { k = 1f; span = 26f; sw = 8f; gx = 0f; gy = -2f; blink = false }
            Mood.Done -> { k = 0.8f; span = 23f; sw = 7f; gx = 0f; gy = -1f; blink = false }
            Mood.Skipped -> { w = floatArrayOf(12f, 12f); h = floatArrayOf(17f, 17f); gx = 6f; gy = 9f }
            Mood.Low -> {
                w = floatArrayOf(13f, 13f); h = floatArrayOf(15f, 15f)
                gx = floatArrayOf(-1f, 0f, 1f, 0f)[((t / 520) % 4).toInt()] * 7f; gy = 10f; fast = true
            }
            Mood.Adding -> { w = floatArrayOf(14f, 14f); h = floatArrayOf(30f, 30f); gx = 6f; gy = -4f }
            Mood.Sleep -> { k = -1f; span = 22f; sw = 5.5f; gx = 0f; gy = 9f; blink = false }
            Mood.Lost -> {
                w = floatArrayOf(16f, 11f); h = floatArrayOf(32f, 18f)
                gx = floatArrayOf(-1f, 1f, -0.4f, 0.8f)[((t / 900) % 4).toInt()] * 10f; gy = -3f; fast = true
            }
            Mood.Idle -> Unit
        }
        if (t < pokeUntil) {
            w = floatArrayOf(22f, 22f); h = floatArrayOf(24f, 24f); k = 0f
        }
        return Target(w, h, k, span, sw, gx, gy, fast, blink)
    }

    fun reset(t: Long) {
        val tg = target(t)
        gx.x = tg.gx; gx.v = 0f; gy.x = tg.gy; gy.v = 0f
        k.x = tg.k; k.v = 0f; span.x = tg.span; sw.x = tg.sw
        for (i in 0..1) { w[i].x = tg.w[i]; w[i].v = 0f; h[i].x = tg.h[i]; h[i].v = 0f }
    }

    fun blinkAmt(t: Long): Float {
        val d = t - blink0
        if (d < 0 || d > 190) return 0f
        val q = if (d < 70) d / 70f else 1 - (d - 70) / 120f
        return q * q * (3 - 2 * q)
    }

    /** Advances the springs; returns true while anything is still moving. */
    fun step(t: Long, dt: Float): Boolean {
        if (t > nextBlink) {
            blink0 = t
            nextBlink = t + 2400 + Random.nextLong(3600)
        }
        if (t > glanceUntil) {
            val g = listOf(0f to 0f, 8f to -5f, -9f to -3f, 6f to 5f, -4f to -7f, 10f to 0f).random()
            glanceX = g.first; glanceY = g.second
            glanceUntil = t + 1600 + Random.nextLong(2600)
        }
        val tg = target(t)
        if (!tg.blink) blink0 = -1_000_000L
        val n = ceil(dt / (1f / 120f)).toInt().coerceAtLeast(1)
        val hdt = dt / n
        repeat(n) {
            gx.step(tg.gx, hdt, if (tg.fast) 0.16f else 0.32f, if (tg.fast) 1f else 0.82f)
            gy.step(tg.gy, hdt, if (tg.fast) 0.16f else 0.32f, if (tg.fast) 1f else 0.82f)
            k.step(tg.k, hdt, 0.3f, 0.8f)
            span.step(tg.span, hdt, 0.3f, 0.9f)
            sw.step(tg.sw, hdt, 0.3f, 0.9f)
            for (i in 0..1) {
                w[i].step(tg.w[i], hdt, 0.3f, 0.7f)
                h[i].step(tg.h[i], hdt, 0.3f, 0.7f)
            }
        }
        val moving = !(gx.settled(tg.gx) && gy.settled(tg.gy) && k.settled(tg.k) && span.settled(tg.span) &&
            sw.settled(tg.sw) && (0..1).all { w[it].settled(tg.w[it]) && h[it].settled(tg.h[it]) })
        return moving || blinkAmt(t) > 0f || tg.fast
    }

    fun drawEyes(scope: DrawScope, t: Long, eye: Color) = with(scope) {
        val nx = (gx.x / 13f).coerceIn(-1f, 1f)
        val bl = blinkAmt(t)
        val kk = k.x.coerceIn(-1f, 1f)
        val m = abs(kk)
        val s = if (kk < 0) -1f else 1f
        val a2 = span.x
        for (i in 0..1) {
            val side = if (i == 1) 1f else -1f
            val far = sign(nx) == side
            val a = abs(nx) * (1 - m)
            val wi = w[i].x
            val l = max(0.01f, h[i].x - wi)
            val pts = listOf(0f to -l / 2, 0f to 0f, 0f to l / 2)
            val arc = listOf(-a2 / 2 to s * a2 * 0.2f, 0f to -s * a2 * 0.6f, a2 / 2 to s * a2 * 0.2f)
            val q = pts.mapIndexed { j, (x, y) ->
                val (ax, ay) = arc[j]
                Offset(x + (ax - x) * m, y + (ay - y) * m)
            }
            val cx = AX + side * SEP * (1 - 0.14f * a) * (1 + 0.12f * m) + gx.x
            val cy = AY + (if (i == 1) 2f else 0f) * (1 - m) + gy.x
            val sx = if (far) 1 - 0.2f * a else 1 + 0.06f * a
            val sy = (1 - 0.9f * bl) * (if (far) 1 - 0.08f * a else 1f)
            val r = nx * 18 * (1 - m)
            val path = Path().apply {
                moveTo(q[0].x, q[0].y)
                quadraticTo(q[1].x, q[1].y, q[2].x, q[2].y)
            }
            translate(cx, cy) {
                rotate(r, Offset.Zero) {
                    scale(sx, max(0.001f, sy), Offset.Zero) {
                        drawPath(path, eye, style = Stroke(wi + (sw.x - wi) * m, cap = StrokeCap.Round))
                    }
                }
            }
        }
    }
}

private class Key(val at: Float, val ty: Float = 0f, val sx: Float = 1f, val sy: Float = 1f, val rot: Float = 0f)

private class Body(val ms: Int, val ease: Easing, val keys: List<Key>, val once: Boolean = false)

private val easeInOut = FastOutSlowInEasing

private fun bodyFor(mood: Mood): Body? = when (mood) {
    Mood.Idle, Mood.Done, Mood.Adding -> Body(3600, easeInOut, listOf(Key(0f), Key(0.5f, sx = 1.02f, sy = 0.98f), Key(1f)))
    Mood.Due -> Body(1300, EaseOut, listOf(Key(0f), Key(0.3f, -6f, 0.98f, 1.03f), Key(0.55f, sx = 1.03f, sy = 0.97f), Key(1f)))
    Mood.Nudge -> Body(
        2400, EaseOut,
        listOf(Key(0f), Key(0.08f, -8f, 0.97f, 1.04f), Key(0.16f, sx = 1.04f, sy = 0.96f), Key(0.24f, -5f), Key(0.32f, sx = 1.02f, sy = 0.98f), Key(0.6f), Key(1f)),
    )
    Mood.Hello, Mood.Taken -> Body(
        1300, EaseOut,
        listOf(Key(0f), Key(0.12f, sx = 1.1f, sy = 0.88f), Key(0.3f, -22f, 0.92f, 1.08f), Key(0.48f, sx = 1.08f, sy = 0.92f), Key(0.6f, sx = 0.98f, sy = 1.02f), Key(0.7f), Key(1f)),
        once = mood == Mood.Taken,
    )
    Mood.Skipped -> Body(2800, easeInOut, listOf(Key(0f), Key(0.4f, 4f, 1.02f, 0.97f), Key(1f)))
    Mood.Sleep -> Body(5000, easeInOut, listOf(Key(0f, sx = 1.03f, sy = 0.94f), Key(0.5f, sx = 1.045f, sy = 0.925f), Key(1f, sx = 1.03f, sy = 0.94f)))
    Mood.Lost -> Body(1800, easeInOut, listOf(Key(0f), Key(0.25f, rot = -4f), Key(0.75f, rot = 4f), Key(1f)))
    Mood.Low -> null
}

private fun sample(b: Body, elapsed: Long): Key {
    val p = if (b.once && elapsed >= b.ms) 1f else (elapsed % b.ms) / b.ms.toFloat()
    val i = b.keys.indexOfLast { it.at <= p }.coerceAtMost(b.keys.size - 2)
    val a = b.keys[i]
    val z = b.keys[i + 1]
    val f = b.ease.transform(((p - a.at) / (z.at - a.at)).coerceIn(0f, 1f))
    fun lerp(x: Float, y: Float) = x + (y - x) * f
    return Key(p, lerp(a.ty, z.ty), lerp(a.sx, z.sx), lerp(a.sy, z.sy), lerp(a.rot, z.rot))
}

/**
 * Pip, a small teal capsule. Decorative unless given a label. Tapping a pokeable Pip makes it
 * blink wide with a tap haptic.
 */
@Composable
fun Pip(
    mood: Mood,
    modifier: Modifier = Modifier,
    size: Dp = 88.dp,
    label: String? = null,
    poke: Boolean = false,
    palette: Palette = LocalPalette.current,
    animate: Boolean = true,
) {
    val reduced = LocalReducedMotion.current || !animate
    val rig = remember { Rig(mood) }
    val frame = remember { mutableLongStateOf(0L) }
    val start = remember { mutableLongStateOf(0L) }
    val moodNow by rememberUpdatedState(mood)
    val measurer = rememberTextMeasurer()

    LaunchedEffect(mood, reduced) {
        rig.mood = mood
        start.longValue = frame.longValue
        if (reduced) {
            rig.reset(frame.longValue)
            frame.longValue += 1
            return@LaunchedEffect
        }
        var last = -1L
        var origin = -1L
        while (true) {
            val moving = withFrameNanos { nanos ->
                val ms = nanos / 1_000_000
                if (origin < 0) origin = ms - frame.longValue
                val t = ms - origin
                val dt = if (last < 0) 1 / 60f else min((t - last) / 1000f, 0.05f)
                last = t
                frame.longValue = t
                rig.step(t, dt)
            }
            // The body keeps moving, but once the eyes settle the springs can rest until the next blink or glance.
            if (!moving && bodyFor(moodNow) == null) {
                val wait = min(rig.nextBlink, rig.glanceUntil) - frame.longValue
                if (wait > 32) {
                    delay(wait)
                    last = -1
                }
            }
        }
    }

    val semantics = if (label != null) Modifier.semantics { contentDescription = label }
    else Modifier.semantics { hideFromAccessibility() }
    val touch = if (poke) Modifier.pointerInput(Unit) {
        detectTapGestures(onPress = {
            rig.pokeUntil = frame.longValue + 600
            Feels.haptic(Haptic.Tap)
            if (reduced) {
                rig.reset(rig.pokeUntil - 1)
                frame.longValue += 1
                delay(600)
                rig.reset(rig.pokeUntil + 1)
                frame.longValue += 1
            }
        })
    } else Modifier

    Canvas(modifier.size(size).then(semantics).then(touch)) {
        val t = frame.longValue
        val u = this.size.minDimension / 200f
        val body = bodyFor(rig.mood)
        val key = if (body == null || reduced) Key(0f) else sample(body, t - start.longValue)
        scale(u, Offset.Zero) {
            // The body moves about its feet, like transform-origin: 50% 100%.
            val pivot = Offset(100f, 186f)
            translate(0f, key.ty) {
                rotate(key.rot, pivot) {
                    scale(key.sx, key.sy, pivot) {
                        rotate(-14f, Offset(100f, 104f)) {
                            drawRoundRect(palette.pip, Offset(64f, 22f), Size(72f, 164f), CornerRadius(36f))
                            val belly = Path().apply {
                                moveTo(64f, 116f)
                                lineTo(136f, 116f)
                                lineTo(136f, 150f)
                                arcTo(androidx.compose.ui.geometry.Rect(64f, 114f, 136f, 186f), 0f, 180f, false)
                                close()
                            }
                            drawPath(belly, palette.pipDeep, alpha = 0.9f)
                            rig.drawEyes(this, t, palette.eye)
                        }
                    }
                }
            }
            if (rig.mood == Mood.Adding) {
                val pulse = if (reduced) 0.5f else 0.25f + 0.5f * (0.5f - 0.5f * kotlin.math.cos((t % 1200) / 1200f * TAU.toFloat()))
                drawCircle(palette.pip, 8f, Offset(164f, 56f), alpha = pulse)
                val pulse2 = if (reduced) 0.5f else 0.25f + 0.5f * (0.5f - 0.5f * kotlin.math.cos(((t + 1000) % 1200) / 1200f * TAU.toFloat()))
                drawCircle(palette.pip, 5.5f, Offset(182f, 40f), alpha = pulse2)
            }
            if (rig.mood == Mood.Sleep) {
                for ((i, spec) in listOf(Triple(150f, 44f, 22f), Triple(166f, 28f, 15f)).withIndex()) {
                    val p = if (reduced) 0.4f else (((t + i * 1400) % 3000) / 3000f)
                    val alpha = if (p < 0.4f) p / 0.4f * 0.9f else 0.9f * (1 - (p - 0.4f) / 0.6f)
                    val layout = measurer.measure("z", display(spec.third.toInt(), 800, color = palette.star))
                    drawText(layout, topLeft = Offset(spec.first + 10 * p, spec.second - spec.third + 6 - 20 * p), alpha = alpha.coerceIn(0f, 1f))
                }
            }
        }
    }
}
