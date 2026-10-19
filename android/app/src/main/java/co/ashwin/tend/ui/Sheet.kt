package co.ashwin.tend.ui

import androidx.activity.compose.PredictiveBackHandler
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.AnimationSpec
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import kotlinx.coroutines.flow.first
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.foundation.focusable
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.dismiss
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.traversalIndex
import androidx.compose.ui.unit.Velocity
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlin.math.sqrt

/**
 * Sheets draw above everything, so they live in one overlay host at the root rather than inside
 * the screen that opened them. Anything shown here makes the page behind it inert.
 */
class Overlays {
    internal val items = mutableStateListOf<Pair<Long, @Composable () -> Unit>>()
    private var next = 0L
    fun add(content: @Composable () -> Unit): Long = next++.also { items += it to content }
    fun update(id: Long, content: @Composable () -> Unit) {
        val i = items.indexOfFirst { it.first == id }
        if (i >= 0) items[i] = id to content
    }
    fun remove(id: Long) {
        items.removeAll { it.first == id }
    }
    val any get() = items.isNotEmpty()
}

val LocalOverlays = compositionLocalOf { Overlays() }

/** Whether the window is wide enough for dialogs and side panels instead of bottom sheets. */
val LocalWide = compositionLocalOf { false }

@Composable
fun OverlayHost(overlays: Overlays) {
    overlays.items.forEach { (id, content) -> androidx.compose.runtime.key(id) { content() } }
}

@Composable
private fun Portal(content: @Composable () -> Unit) {
    val host = LocalOverlays.current
    // A sheet keeps the palette of the screen that opened it, though it draws in the root host.
    val palette = LocalPalette.current
    val latest by rememberUpdatedState(content)
    val latestPalette by rememberUpdatedState(palette)
    val id = remember { host.add { CompositionLocalProvider(LocalPalette provides latestPalette) { latest() } } }
    DisposableEffect(Unit) { onDispose { host.remove(id) } }
}

private fun rubber(dy: Float) = -sqrt(-dy) * 2

/**
 * The one sheet. On phones it rises from the bottom on the drawer curve, follows the finger 1:1
 * downward and rubber-bands upward, closes past 30% or on a flick, and the back gesture previews
 * the close. From tablets up it is a centred dialog that rises 12dp from 0.97 scale. Reduced
 * motion turns all of it into fades.
 */
@Composable
fun Sheet(
    open: Boolean,
    onClose: () -> Unit,
    label: String,
    onClosed: () -> Unit = {},
    detents: Boolean = false,
    /** A new value scrolls the body back to the top, as when the editor moves to its next step. */
    page: Any? = null,
    header: (@Composable ColumnScope.() -> Unit)? = null,
    footer: (@Composable ColumnScope.() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    var shown by remember { mutableStateOf(open) }
    LaunchedEffect(open) { if (open) shown = true }
    if (!shown) return
    val close by rememberUpdatedState(onClose)
    val closed by rememberUpdatedState(onClosed)
    Portal {
        SheetFrame(open, label, detents, page, { close() }, { shown = false; closed() }, header, footer, content)
    }
}

@Composable
private fun SheetFrame(
    open: Boolean,
    label: String,
    detents: Boolean,
    page: Any?,
    requestClose: () -> Unit,
    finished: () -> Unit,
    header: (@Composable ColumnScope.() -> Unit)?,
    footer: (@Composable ColumnScope.() -> Unit)?,
    content: @Composable ColumnScope.() -> Unit,
) {
    val p = LocalPalette.current
    val wide = LocalWide.current
    val reduced = LocalReducedMotion.current
    val density = LocalDensity.current
    val scope = rememberCoroutineScope()
    val focus = remember { FocusRequester() }
    val focusManager = LocalFocusManager.current
    // offset is the sheet's distance below its resting place; fade drives dialogs and reduced motion.
    val offset = remember { Animatable(Float.MAX_VALUE) }
    val fade = remember { Animatable(0f) }
    var height by remember { mutableIntStateOf(0) }
    var maxH by remember { mutableFloatStateOf(0f) }
    // With detents, the sheet can rest at half height; rest is that resting offset.
    var rest by remember { mutableFloatStateOf(0f) }

    val openSpec: AnimationSpec<Float> = tween(380, easing = Drawer)
    val closeSpec: AnimationSpec<Float> = tween(200, easing = EaseOut)

    suspend fun settle(velocity: Float) {
        val h = height.toFloat()
        val d = offset.value
        val pxPerMs = velocity / 1000f
        val flickDown = pxPerMs > 0.5f && d - rest > with(density) { 24.dp.toPx() }
        val flickUp = pxPerMs < -0.5f
        if (detents) {
            val half = h * 0.45f
            val projected = d + velocity * 0.2f
            val target = when {
                flickDown && rest == 0f && d < half -> half
                flickDown -> h
                flickUp -> 0f
                projected > h * 0.72f -> h
                projected > h * 0.22f -> half
                else -> 0f
            }
            if (target >= h) {
                requestClose()
            } else {
                rest = target
                offset.animateTo(target, spring(0.86f, 400f), velocity)
            }
            return
        }
        if (flickDown || d > h * 0.3f) requestClose()
        else offset.animateTo(0f, spring(1f, 500f), velocity)
    }

    // Runs once per open and once per close; a height change (the keyboard opening) must not refocus.
    LaunchedEffect(open) {
        snapshotFlow { height }.first { it > 0 }
        if (open) {
            if (wide || reduced) {
                offset.snapTo(0f)
                fade.animateTo(1f, tween(if (reduced) 160 else 220, easing = EaseOut))
            } else {
                fade.snapTo(1f)
                if (offset.value == Float.MAX_VALUE) offset.snapTo(height.toFloat())
                offset.animateTo(rest, openSpec)
            }
            runCatching { focus.requestFocus() }
        } else {
            focusManager.clearFocus(force = true)
            if (wide || reduced) fade.animateTo(0f, tween(160, easing = EaseOut))
            else offset.animateTo(height.toFloat(), closeSpec)
            finished()
        }
    }

    PredictiveBackHandler(enabled = open) { progress ->
        try {
            progress.collect { e ->
                if (!wide && !reduced) offset.snapTo(rest + e.progress * height * 0.25f)
                else fade.snapTo(1f - e.progress * 0.3f)
            }
            requestClose()
        } catch (c: CancellationException) {
            scope.launch {
                if (!wide && !reduced) offset.animateTo(rest, spring(1f, 500f)) else fade.animateTo(1f)
            }
            throw c
        }
    }

    val dragState = rememberDraggableState { delta ->
        scope.launch {
            val raw = offset.value + delta
            offset.snapTo(if (raw < 0f) rubber(raw) else raw)
        }
    }
    val drag = Modifier.draggable(
        dragState,
        Orientation.Vertical,
        enabled = !wide && open,
        onDragStopped = { v -> settle(v) },
    )

    // The body drags the sheet only when it is scrolled to the top and the finger moves down.
    val nested = remember(height, detents) {
        object : NestedScrollConnection {
            override fun onPreScroll(available: Offset, source: NestedScrollSource): Offset {
                if (wide || available.y >= 0 || offset.value <= 0f) return Offset.Zero
                val take = maxOf(available.y, -offset.value)
                scope.launch { offset.snapTo(offset.value + take) }
                return Offset(0f, take)
            }

            override fun onPostScroll(consumed: Offset, available: Offset, source: NestedScrollSource): Offset {
                if (wide || available.y <= 0 || source != NestedScrollSource.UserInput) return Offset.Zero
                scope.launch { offset.snapTo(offset.value + available.y) }
                return Offset(0f, available.y)
            }

            override suspend fun onPreFling(available: Velocity): Velocity {
                if (wide || offset.value <= 0.5f || offset.value == rest) return Velocity.Zero
                settle(available.y)
                return available
            }
        }
    }

    BoxWithConstraints(Modifier.fillMaxSize()) {
        maxH = constraints.maxHeight.toFloat()
        val progress = if (wide || reduced || height == 0) fade.value
        else (1f - (offset.value / height).coerceIn(0f, 1f)) * fade.value
        Box(
            Modifier
                .fillMaxSize()
                .graphicsLayer { alpha = progress.coerceIn(0f, 1f) }
                .background(p.scrim)
                .pointerInput(Unit) { detectTapGestures { requestClose() } }
                .semantics { contentDescription = "Close"; traversalIndex = 1f },
        )
        val shape = if (wide) RoundedCornerShape(28.dp) else RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp)
        // While the keyboard is up it covers the navigation bar, so the bar's inset no longer applies.
        val keyboardUp = WindowInsets.ime.getBottom(density) > 0
        val nav = if (keyboardUp) 0.dp else WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
        Column(
            Modifier
                .align(if (wide) Alignment.Center else Alignment.BottomCenter)
                .then(if (wide) Modifier.widthIn(max = 520.dp).padding(24.dp) else Modifier.fillMaxWidth())
                .heightIn(max = with(density) { (maxH * if (wide) 0.9f else 0.92f).toDp() })
                .onSizeChanged { height = it.height }
                .graphicsLayer {
                    if (wide) {
                        val f = fade.value
                        alpha = f
                        if (!reduced) {
                            val s = 0.97f + 0.03f * f
                            scaleX = s; scaleY = s
                            translationY = (1 - f) * 12.dp.toPx()
                        }
                    } else if (reduced) {
                        alpha = fade.value
                    } else {
                        translationY = if (offset.value == Float.MAX_VALUE) maxH else offset.value
                    }
                }
                .background(p.card, shape)
                .pointerInput(Unit) { detectTapGestures { } }
                .semantics {
                    paneTitle = label
                    dismiss { requestClose(); true }
                }
                .nestedScroll(nested),
        ) {
            Column(drag.padding(horizontal = 16.dp).padding(top = 8.dp).focusRequester(focus).focusable()) {
                if (!wide) {
                    Box(Modifier.fillMaxWidth().padding(bottom = 4.dp), contentAlignment = Alignment.Center) {
                        Box(Modifier.size(40.dp, 5.dp).background(p.lineStrong, RoundedCornerShape(3.dp)))
                    }
                } else Gap(8.dp)
                header?.let { Column(Modifier.fillMaxWidth(), content = it) }
            }
            Column(
                Modifier
                    .weight(1f, fill = false)
                    .verticalScroll(remember(page) { ScrollState(0) })
                    .padding(horizontal = 16.dp)
                    .padding(top = 4.dp, bottom = if (footer == null) 16.dp + nav else 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                content = content,
            )
            footer?.let {
                Column(
                    Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(top = 8.dp, bottom = 16.dp + if (wide) 0.dp else nav),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    content = it,
                )
            }
        }
    }
}

data class SheetAction(val label: String, val icon: Ic, val danger: Boolean = false, val onSelect: () -> Unit)

/** A short sheet of large rows, the destructive one in red, and Cancel apart at the bottom. */
@Composable
fun ActionSheet(open: Boolean, onClose: () -> Unit, title: String, actions: List<SheetAction>) {
    val p = LocalPalette.current
    Sheet(
        open = open,
        onClose = onClose,
        label = title,
        header = { androidx.compose.foundation.text.BasicText(title, Modifier.padding(top = 4.dp, bottom = 8.dp), style = display(22, 800, 1.15f, p.ink)) },
        footer = { Btn("Cancel", Modifier.fillMaxWidth(), Kind.Soft) { onClose() } },
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            actions.forEach { a ->
                val color = if (a.danger) p.danger else p.ink
                Row(
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 56.dp)
                        .tap(sink = 0.98f) { onClose(); a.onSelect() }
                        .background(p.milk, RoundedCornerShape(16.dp))
                        .padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Icon(a.icon, color, size = 22.dp)
                    androidx.compose.foundation.text.BasicText(a.label, Modifier.weight(1f), style = body(17, 600, 1.3f, color))
                }
            }
        }
    }
}

@Composable
fun ProvideWide(wide: Boolean, content: @Composable () -> Unit) = CompositionLocalProvider(LocalWide provides wide, content = content)
