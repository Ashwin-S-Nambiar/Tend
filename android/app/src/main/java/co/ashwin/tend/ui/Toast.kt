package co.ashwin.tend.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.abs

data class ToastMsg(val text: String, val undo: (() -> Unit)?, val id: Long = System.nanoTime())

/** One toast at a time, announced politely, with Undo where the action allows it. */
object Toasts {
    val current = mutableStateOf<ToastMsg?>(null)
    fun show(text: String, undo: (() -> Unit)? = null) {
        current.value = ToastMsg(text, undo)
    }
    fun dismiss() {
        current.value = null
    }
}

fun toast(text: String, undo: (() -> Unit)? = null) = Toasts.show(text, undo)

@Composable
fun ToastHost(modifier: Modifier = Modifier) {
    val msg = Toasts.current.value
    val reduced = LocalReducedMotion.current
    AnimatedContent(
        msg,
        modifier,
        transitionSpec = {
            if (reduced) fadeIn(tween(160)) togetherWith fadeOut(tween(160))
            else (slideInVertically(tween(260, easing = EaseOut)) { it / 2 } + fadeIn(tween(200))) togetherWith
                (slideOutVertically(tween(180, easing = EaseOut)) { it / 2 } + fadeOut(tween(160)))
        },
        contentAlignment = Alignment.BottomCenter,
        label = "toast",
    ) { m ->
        if (m == null) Box(Modifier) else ToastCard(m)
    }
}

@Composable
private fun ToastCard(m: ToastMsg) {
    val p = LocalPalette.current
    val x = remember(m.id) { Animatable(0f) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(m.id) {
        delay(if (m.undo != null) 6000 else 3500)
        if (Toasts.current.value?.id == m.id) Toasts.dismiss()
    }
    val drag = rememberDraggableState { d -> scope.launch { x.snapTo(x.value + d) } }
    // The toast is ink on milk in light and milk on ink in dark, so it reads over anything.
    val bg = p.ink
    val fg = p.milk
    Row(
        Modifier
            .padding(horizontal = 16.dp)
            .widthIn(max = 520.dp)
            .fillMaxWidth()
            .graphicsLayer { translationX = x.value; alpha = 1f - (abs(x.value) / 400f).coerceIn(0f, 0.9f) }
            .draggable(drag, Orientation.Horizontal, onDragStopped = { v ->
                if (abs(x.value) > 96 || abs(v) > 800) {
                    x.animateTo(if (x.value + v * 0.1f > 0) 900f else -900f, tween(160))
                    Toasts.dismiss()
                } else x.animateTo(0f, spring(1f, 500f))
            })
            .heightIn(min = 52.dp)
            .background(bg, RoundedCornerShape(18.dp))
            .semantics { liveRegion = LiveRegionMode.Polite }
            .padding(start = 18.dp, end = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        BasicText(m.text, Modifier.weight(1f).padding(vertical = 14.dp), style = body(15, 600, 1.3f, fg))
        m.undo?.let { undo ->
            Box(
                Modifier
                    .heightIn(min = 44.dp)
                    .tap(label = "Undo") { undo(); Toasts.dismiss() }
                    .padding(horizontal = 12.dp),
                contentAlignment = Alignment.Center,
            ) { BasicText("Undo", style = display(16, 700, 1.2f, if (p.dark) Color(0xFF0B7568) else Color(0xFF2CC1AA))) }
        }
    }
}
