package co.ashwin.tend.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.snapping.rememberSnapFlingBehavior
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.setProgress
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import co.ashwin.tend.core.toMin
import co.ashwin.tend.core.use24h
import co.ashwin.tend.feel.Feels
import co.ashwin.tend.feel.Haptic
import co.ashwin.tend.feel.Sound
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import kotlin.math.abs

private val ROW = 44.dp
private const val VISIBLE = 5

/**
 * One wheel column. Looping columns repeat their values so the wheel never hits an end. TalkBack
 * sees an adjustable value with the plain text, and swipes up and down step it.
 */
@Composable
private fun WheelColumn(
    label: String,
    values: List<String>,
    index: Int,
    onIndex: (Int) -> Unit,
    loop: Boolean,
    width: Dp,
) {
    val p = LocalPalette.current
    val n = values.size
    val copies = if (loop) 400 else 1
    val startAt = if (loop) n * (copies / 2) + index else index
    val state = rememberLazyListState(startAt)
    val scope = rememberCoroutineScope()
    val density = LocalDensity.current
    val rowPx = with(density) { ROW.toPx() }
    val centre by remember {
        derivedStateOf {
            state.firstVisibleItemIndex + if (state.firstVisibleItemScrollOffset > rowPx / 2) 1 else 0
        }
    }
    val latest by rememberUpdatedState(index)
    val emit by rememberUpdatedState(onIndex)
    LaunchedEffect(Unit) {
        snapshotFlow { centre }.distinctUntilChanged().collect { i ->
            val v = i % n
            if (v != latest) {
                Feels.haptic(Haptic.Tick)
                Feels.sound(Sound.Tick)
                emit(v)
            }
        }
    }
    LaunchedEffect(index) {
        if (centre % n != index) state.scrollToItem(centre - centre % n + index)
    }
    fun step(by: Int) = scope.launch { state.animateScrollToItem((centre + by).coerceIn(0, n * copies - 1)) }
    LazyColumn(
        Modifier
            .width(width)
            .height(ROW * VISIBLE)
            .semantics {
                contentDescription = label
                stateDescription = values[index]
                progressBarRangeInfo = ProgressBarRangeInfo(index.toFloat(), 0f..(n - 1).toFloat(), n - 2)
                setProgress { target ->
                    val t = target.toInt().coerceIn(0, n - 1)
                    step(t - index)
                    true
                }
            },
        state = state,
        flingBehavior = rememberSnapFlingBehavior(state),
        contentPadding = PaddingValues(vertical = ROW * (VISIBLE / 2)),
    ) {
        items(n * copies) { i ->
            val text = values[i % n]
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(ROW)
                    .graphicsLayer {
                        val info = state.layoutInfo.visibleItemsInfo.find { it.index == i }
                        val mid = state.layoutInfo.viewportStartOffset + state.layoutInfo.viewportSize.height / 2f
                        val d = info?.let { abs(it.offset + it.size / 2f - mid) / rowPx } ?: 2f
                        alpha = (1f - d * 0.32f).coerceIn(0.2f, 1f)
                        val s = 1f - (d * 0.08f).coerceAtMost(0.2f)
                        scaleX = s; scaleY = s
                    }
                    .then(if (text.isNotEmpty()) Modifier.tap(role = null, sink = 1f) { step(i - centre) } else Modifier),
                contentAlignment = Alignment.Center,
            ) { BasicText(text, style = display(24, 700, 1.1f, p.ink).copy(textAlign = TextAlign.Center)) }
        }
    }
}

/** The time wheel: hour, minute and AM/PM, or hour and minute on a 24 hour phone. */
@Composable
fun TimeWheel(value: String, onChange: (String) -> Unit) {
    val p = LocalPalette.current
    val m = toMin(value)
    val h24 = m / 60
    val minute = m % 60
    fun emit(h: Int, mi: Int) = onChange("${h.toString().padStart(2, '0')}:${mi.toString().padStart(2, '0')}")
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        Box(
            Modifier
                .fillMaxWidth()
                .height(ROW)
                .background(p.milk, RoundedCornerShape(14.dp)),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
            if (use24h) {
                WheelColumn("Hour", (0..23).map { it.toString().padStart(2, '0') }, h24, { emit(it, minute) }, true, 72.dp)
            } else {
                val hours = (1..12).map { "$it" }
                val hourIndex = (h24 + 11) % 12
                WheelColumn("Hour", hours, hourIndex, { i -> emit((i + 1) % 12 + if (h24 >= 12) 12 else 0, minute) }, true, 72.dp)
            }
            BasicText(":", Modifier.padding(bottom = 4.dp), style = display(24, 700, 1.1f, p.ink))
            WheelColumn("Minute", (0..59).map { it.toString().padStart(2, '0') }, minute, { emit(h24, it) }, true, 72.dp)
            if (!use24h) {
                WheelColumn("AM or PM", listOf("AM", "PM"), if (h24 >= 12) 1 else 0, { i -> emit(h24 % 12 + i * 12, minute) }, false, 72.dp)
            }
        }
    }
}
