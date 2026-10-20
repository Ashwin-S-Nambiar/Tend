package co.ashwin.tend.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay

/**
 * Picks up exactly where Android's own splash leaves off: the same tile and icon at the same size,
 * so there is no frame between them. Pip rises out of the tile, hops once, and the tile lifts away
 * toward the top of Today. Under reduced motion it only fades.
 */
@Composable
fun Splash(night: Boolean, done: () -> Unit) {
    val reduced = LocalReducedMotion.current
    val bg = if (night) Dark.milk else Light.milk
    val tile = if (night) Dark.night2 else Light.sun
    val ink = if (night) Dark.ink else Light.ink
    // The same colours as the launcher icon the system splash just showed.
    val palette = Light
    val pipY = remember { Animatable(0f) }
    val squash = remember { Animatable(1f) }
    val orb = remember { Animatable(0f) }
    val brand = remember { Animatable(0f) }
    val lift = remember { Animatable(0f) }
    val fade = remember { Animatable(1f) }
    LaunchedEffect(Unit) {
        if (reduced) {
            delay(200)
            fade.animateTo(0f, tween(220))
            done()
            return@LaunchedEffect
        }
        coroutineScope {
            listOf(
                async { orb.animateTo(1f, tween(320, easing = EaseOut)) },
                async {
                    pipY.animateTo(40f, tween(160, easing = FastOutSlowInEasing))
                    pipY.animateTo(-12f, tween(260, easing = EaseOut))
                    pipY.animateTo(0f, tween(140))
                    squash.animateTo(0.92f, tween(110))
                    pipY.animateTo(-18f, tween(150, easing = EaseOut))
                    squash.animateTo(1f, tween(120))
                    pipY.animateTo(0f, tween(160, easing = FastOutSlowInEasing))
                },
                async { delay(260); brand.animateTo(1f, tween(260, easing = EaseOut)) },
            ).awaitAll()
        }
        delay(120)
        coroutineScope {
            listOf(
                async { lift.animateTo(1f, tween(320, easing = Drawer)) },
                async { delay(80); fade.animateTo(0f, tween(260, easing = EaseOut)) },
            ).awaitAll()
        }
        done()
    }
    Box(
        Modifier.fillMaxSize().graphicsLayer { alpha = fade.value }.background(bg).semantics { contentDescription = "Tend is opening" },
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                Modifier
                    .size(160.dp)
                    .graphicsLayer {
                        val l = lift.value
                        translationX = 60.dp.toPx() * l
                        translationY = -150.dp.toPx() * l
                        val sc = 1f - 0.1f * l
                        scaleX = sc; scaleY = sc
                    }
                    .clip(CircleShape)
                    .background(tile),
                contentAlignment = Alignment.Center,
            ) {
                Canvas(Modifier.size(160.dp).graphicsLayer { alpha = orb.value; translationY = (1 - orb.value) * 46.dp.toPx() }) {
                    val c = Offset(size.width * 0.72f, size.height * 0.26f)
                    if (night) drawCircle(Light.star, size.width * 0.12f, c)
                    else drawCircle(Color(0x8CFFE38A), size.width * 0.5f, Offset(size.width / 2, size.height * 1.05f))
                }
                Pip(
                    if (night) Mood.Idle else Mood.Hello,
                    Modifier.graphicsLayer {
                        translationY = pipY.value.dp.toPx()
                        scaleX = 2f - squash.value
                        scaleY = squash.value
                        transformOrigin = androidx.compose.ui.graphics.TransformOrigin(0.5f, 0.95f)
                    },
                    size = 114.dp,
                    palette = palette,
                    animate = false,
                )
            }
            BasicText(
                "Tend",
                Modifier.padding(top = 20.dp).graphicsLayer { alpha = brand.value * (1 - lift.value); translationY = (1 - brand.value) * 8.dp.toPx() },
                style = display(28, 800, 1.1f, ink),
            )
        }
    }
}
