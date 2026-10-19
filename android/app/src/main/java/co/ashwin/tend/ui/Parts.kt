package co.ashwin.tend.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.hideFromAccessibility
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import co.ashwin.tend.core.DoseState
import co.ashwin.tend.core.Medicine
import co.ashwin.tend.core.clock
import co.ashwin.tend.core.doseLine
import co.ashwin.tend.core.dueDate
import co.ashwin.tend.core.fmtTime
import co.ashwin.tend.core.minutesBetween
import co.ashwin.tend.core.refill
import co.ashwin.tend.data.Repo
import co.ashwin.tend.data.Stored
import co.ashwin.tend.feel.Feels
import co.ashwin.tend.feel.Haptic
import co.ashwin.tend.feel.Sound
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.Instant
import kotlin.math.abs

@Composable
fun rememberStored(): Stored = Repo.state.collectAsState().value

/** The current minute, ticking on the minute while the app is visible. */
@Composable
fun rememberNow(): Instant {
    var now by remember { mutableStateOf(clock()) }
    val owner = LocalLifecycleOwner.current
    LaunchedEffect(owner) {
        owner.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (true) {
                now = clock()
                delay(60_000L - now.toEpochMilli() % 60_000L + 50)
            }
        }
    }
    return now
}

enum class Mode { Phone, Land, Tab, Lap }

@Stable
data class Layout(val mode: Mode, val widthDp: Int, val heightDp: Int) {
    val phone get() = mode == Mode.Phone
    /** Room for side panels and a context pane. */
    val panel get() = mode == Mode.Lap
    /** Room for dialogs instead of bottom sheets. */
    val dialogs get() = (mode == Mode.Tab || mode == Mode.Lap)
    /** Compact phones (320 to 360dp wide) tighten type and padding. */
    val narrow get() = widthDp < 360
}

fun layoutFor(widthDp: Int, heightDp: Int): Layout {
    val mode = when {
        heightDp < 480 && widthDp > heightDp -> Mode.Land
        widthDp < 600 -> Mode.Phone
        widthDp < 1000 -> Mode.Tab
        else -> Mode.Lap
    }
    return Layout(mode, widthDp, heightDp)
}

val LocalLayout = compositionLocalOf { Layout(Mode.Phone, 400, 800) }

@Composable
fun Txt(
    text: String,
    style: androidx.compose.ui.text.TextStyle,
    modifier: Modifier = Modifier,
    lines: Int = Int.MAX_VALUE,
) = BasicText(text, modifier, style = style, maxLines = lines, overflow = if (lines == Int.MAX_VALUE) TextOverflow.Clip else TextOverflow.Ellipsis)

/** A medicine in a list: its pill, name, dose line and, once logged, a check or a dash. */
@Composable
fun MedRow(
    med: Medicine,
    modifier: Modifier = Modifier,
    amount: Double? = null,
    state: DoseState? = null,
    extra: String? = null,
    milk: Boolean = false,
    withFood: Boolean = true,
    index: Int = 0,
    trailing: (@Composable RowScope.() -> Unit)? = null,
    // Last, so MedRow(...) { } reads as a tap handler, never as content.
    onClick: (() -> Unit)? = null,
) {
    val p = LocalPalette.current
    val done = state == DoseState.Taken || state == DoseState.Skipped
    val row = Modifier
        .fillMaxWidth()
        .heightIn(min = 56.dp)
        .then(if (onClick != null) Modifier.tap(onClick = onClick, sink = 0.98f) else Modifier)
        .background(if (milk) p.milk else p.card, RoundedCornerShape(16.dp))
        .semantics(mergeDescendants = true) {
            if (state != null) stateDescription = when (state) {
                DoseState.Taken -> "taken"
                DoseState.Skipped -> "skipped"
                DoseState.Snoozed -> "snoozed"
                DoseState.Open -> "not yet"
            }
        }
        .padding(horizontal = 10.dp, vertical = 8.dp)
    Row(modifier.then(row), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        PillChip(med.look, med.form, tile = if (milk) p.card else p.milk)
        Column(Modifier.weight(1f)) {
            Txt(med.name, body(16, 700, 1.2f, if (done) p.soft else p.ink))
            Txt(doseLine(med, withFood, amount) + (extra?.let { " · $it" } ?: ""), body(14, 400, 1.35f, p.soft))
        }
        trailing?.invoke(this)
        if (state != null) DoseMark(state, index)
    }
}

/** The check that pops in when a dose is logged, staggered down a list. */
@Composable
fun DoseMark(state: DoseState, index: Int) {
    val p = LocalPalette.current
    val on = state == DoseState.Taken || state == DoseState.Skipped
    val reduced = LocalReducedMotion.current
    var shown by remember { mutableStateOf(on) }
    LaunchedEffect(on) {
        if (on && !shown && !reduced) delay(index * 60L)
        shown = on
    }
    val s by animateFloatAsState(if (shown) 1f else 0.6f, if (reduced) tween(0) else spring(0.6f, 600f), label = "mark")
    val a by animateFloatAsState(if (shown) 1f else 0f, tween(160, easing = EaseOut), label = "markAlpha")
    Box(
        Modifier
            .size(28.dp)
            .graphicsLayer { scaleX = s; scaleY = s; alpha = a }
            .background(if (state == DoseState.Skipped) p.line else p.pipWash, CircleShape)
            .semantics { hideFromAccessibility() },
        contentAlignment = Alignment.Center,
    ) {
        Icon(if (state == DoseState.Skipped) Ic.Skip else Ic.Check, if (state == DoseState.Skipped) p.soft else p.pipInk, size = 16.dp, stroke = 2.6f)
    }
}

/**
 * Swipe a row left to skip it. A tick marks 30% and 60%; past 60%, or a quick flick past 30%,
 * commits. The left 20dp of the screen belongs to the system back gesture. TalkBack gets the same
 * Skip as a custom action, and the dose sheet and the more menu have it as buttons.
 */
@Composable
fun SwipeRow(label: String, enabled: Boolean, onCommit: () -> Unit, content: @Composable () -> Unit) {
    val p = LocalPalette.current
    val density = LocalDensity.current
    val scope = rememberCoroutineScope()
    val x = remember { Animatable(0f) }
    var width by remember { mutableIntStateOf(1) }
    var windowX by remember { mutableFloatStateOf(0f) }
    var stage by remember { mutableIntStateOf(0) }
    var blocked by remember { mutableStateOf(false) }
    val edge = with(density) { 20.dp.toPx() }
    val drag = rememberDraggableState { d ->
        if (blocked) return@rememberDraggableState
        val w = width.toFloat()
        val raw = x.value + d
        val next = when {
            raw > 0 -> raw * 0.25f
            raw < -w * 0.8f -> -w * 0.8f + (raw + w * 0.8f) * 0.25f
            else -> raw
        }
        val s = if (-next > w * 0.6f) 2 else if (-next > w * 0.3f) 1 else 0
        if (s != stage) {
            stage = s
            Feels.haptic(Haptic.Tick)
            Feels.sound(Sound.Tick)
        }
        scope.launch { x.snapTo(next) }
    }
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .onSizeChanged { width = it.width }
            .onGloballyPositioned { windowX = it.positionInWindow().x }
            .semantics {
                if (enabled) customActions = listOf(CustomAccessibilityAction(label) { onCommit(); true })
            },
    ) {
        val reveal = (-x.value / (width * 0.3f)).coerceIn(0f, 1f)
        Box(
            Modifier.matchParentSize().background(p.ink).padding(horizontal = 20.dp).semantics { hideFromAccessibility() },
            contentAlignment = Alignment.CenterEnd,
        ) { BasicText(label, Modifier.graphicsLayer { alpha = reveal }, style = display(15, 700, 1.2f, p.milk)) }
        Box(
            Modifier
                .graphicsLayer { translationX = x.value }
                .draggable(
                    drag,
                    Orientation.Horizontal,
                    enabled = enabled,
                    onDragStarted = { start ->
                        stage = 0
                        blocked = windowX + start.x < edge
                    },
                    onDragStopped = { v ->
                        val w = width.toFloat()
                        val projected = x.value + v * 0.2f
                        if (!blocked && v <= 50 && -x.value > w * 0.3f && -projected > w * 0.6f) {
                            x.animateTo(-w, spring(1f, 700f), v)
                            onCommit()
                            x.snapTo(0f)
                        } else x.animateTo(0f, spring(0.8f, 500f), v)
                    },
                ),
        ) { content() }
    }
}

/** "When did you take them?" with the wheel, and a plain sentence saying what will be logged. */
@Composable
fun TimeSheet(open: Boolean, onClose: () -> Unit, title: String, defaultTime: String, day: String, dueKey: String?, onSave: (String) -> Unit) {
    val p = LocalPalette.current
    var time by remember(open, defaultTime) { mutableStateOf(defaultTime) }
    Sheet(
        open = open,
        onClose = onClose,
        label = title,
        header = { BasicText(title, Modifier.padding(top = 4.dp, bottom = 4.dp), style = display(22, 800, 1.15f, p.ink)) },
        footer = {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Btn("Cancel", Modifier.weight(1f), Kind.Soft) { onClose() }
                Btn("Save", Modifier.weight(1f)) { onSave(time); onClose() }
            }
        },
    ) {
        if (open) TimeWheel(time) { time = it }
        val at = "${day}T$time"
        val sentence = buildString {
            append("Logged as taken at ${fmtTime(time)}")
            append(if (day == co.ashwin.tend.core.dayKey()) " today" else " ${co.ashwin.tend.core.relDay(day)}")
            if (dueKey != null) {
                val m = minutesBetween(dueDate(dueKey), dueDate(at))
                when {
                    m == 0L -> append(", right when it was due")
                    abs(m) < 120 -> append(", ${abs(m)} minutes ${if (m < 0) "before" else "after"} it was due")
                    else -> append(", ${co.ashwin.tend.core.fmtOffset(abs(m).toInt())} ${if (m < 0) "before" else "after"} it was due")
                }
            }
            append(".")
        }
        BasicText(sentence, style = body(15, 400, 1.4f, p.soft))
    }
}

@Composable
fun RefillButton(med: Medicine) {
    Btn("Refilled", kind = Kind.Soft, small = true) {
        val o = refill(Repo.now.data, med)
        val undo = Repo.apply(o)
        Feels.haptic(Haptic.Tap)
        toast(o.message, undo)
    }
}
