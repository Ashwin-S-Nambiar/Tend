package co.ashwin.tend.ui

import androidx.activity.compose.PredictiveBackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.focusable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.hideFromAccessibility
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.traversalIndex
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import co.ashwin.tend.data.Repo
import co.ashwin.tend.data.Theme
import co.ashwin.tend.feel.Feels
import co.ashwin.tend.feel.Haptic
import co.ashwin.tend.ui.screens.DayView
import co.ashwin.tend.ui.screens.DoseSheet
import co.ashwin.tend.ui.screens.HistoryScreen
import co.ashwin.tend.ui.screens.MealTimesScreen
import co.ashwin.tend.ui.screens.MedicineDetail
import co.ashwin.tend.ui.screens.MedicineEdit
import co.ashwin.tend.ui.screens.MedicinesScreen
import co.ashwin.tend.ui.screens.TodayPanel
import co.ashwin.tend.ui.screens.TodayScreen
import co.ashwin.tend.ui.screens.WelcomeScreen
import co.ashwin.tend.ui.screens.YouScreen
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

/** Set by full-bleed screens (the night scene) that draw their own sky under the status bar. */
object Chrome {
    var bleed by mutableStateOf(false)
}

/** Cross-fades every token, so theme and system changes ease rather than flash. */
@Composable
private fun animatePalette(target: Palette): Palette {
    @Composable
    fun c(v: Color) = animateColorAsState(v, tween(320, easing = EaseOut), label = "palette").value
    return Palette(
        c(target.milk), c(target.card), c(target.ink), c(target.soft), c(target.line), c(target.lineStrong),
        c(target.pip), c(target.pipDeep), c(target.pipInk), c(target.onPip), c(target.pipWash),
        c(target.sun), c(target.sunWash), c(target.noon), c(target.noonWash), c(target.dusk), c(target.duskWash),
        c(target.night), c(target.night2), c(target.star), c(target.eye), c(target.scrim), c(target.danger), target.dark,
    )
}

@Composable
fun isDark(): Boolean {
    val theme = rememberStored().settings.theme
    val system = isSystemInDarkTheme()
    return theme == Theme.Dark || (theme == Theme.System && system)
}

@Composable
fun TendRoot(reduced: Boolean, splash: Boolean, onSplashDone: () -> Unit, setBars: (light: Boolean) -> Unit) {
    val s = rememberStored()
    val dark = isDark()
    val overlays = remember { Overlays() }
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val layout = layoutFor(maxWidth.value.toInt(), maxHeight.value.toInt())
        // Onboarding stays until it is finished or dismissed, even after its first medicine is added.
        val welcome = !s.settings.onboarded
        val palette = animatePalette(if (dark) Dark else Light)
        setBars(welcome || (!dark && !Chrome.bleed))
        TendTheme(palette, reduced) {
            CompositionLocalProvider(
                LocalLayout provides layout,
                LocalOverlays provides overlays,
                LocalWide provides layout.dialogs,
            ) {
                val keys = remember { FocusRequester() }
                LaunchedEffect(Unit) { runCatching { keys.requestFocus() } }
                Box(Modifier.fillMaxSize().background(palette.milk).focusRequester(keys).focusable().onKeyEvent(::shortcut)) {
                    Box(Modifier.fillMaxSize().semantics { if (overlays.any) hideFromAccessibility() }) {
                        if (welcome) WelcomeScreen { Repo.settings { it.copy(onboarded = true) } }
                        else Shell(layout)
                    }
                    Box(Modifier.fillMaxSize().imePadding().semantics { traversalIndex = -1f }) { OverlayHost(overlays) }
                    // Over a sheet the toast moves to the top, so it never covers the sheet's buttons.
                    Box(
                        if (overlays.any || welcome) Modifier.align(Alignment.TopCenter).windowInsetsPadding(WindowInsets.statusBars).padding(top = 8.dp)
                        else Modifier.align(Alignment.BottomCenter)
                            .windowInsetsPadding(WindowInsets.navigationBars)
                            .padding(bottom = if (layout.phone && !welcome) 76.dp else 16.dp),
                    ) { ToastHost() }
                    if (splash) Splash(dark, onSplashDone)
                }
            }
        }
    }
}

@Composable
private fun Shell(layout: Layout) {
    val p = LocalPalette.current
    val top = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
    val bottomInset = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    val scope = rememberCoroutineScope()
    val back = remember { Animatable(0f) }
    val density = LocalDensity.current
    // The system back gesture previews the pop: the screen eases right and shrinks a little.
    PredictiveBackHandler(enabled = Nav.canPop && Nav.over == null) { progress ->
        try {
            progress.collect { back.snapTo(it.progress) }
            Nav.pop()
            back.snapTo(0f)
        } catch (e: CancellationException) {
            scope.launch { back.animateTo(0f, tween(200, easing = EaseOut)) }
            throw e
        }
    }
    Row(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Horizontal))) {
        if (!layout.phone) Rail(slim = layout.mode == Mode.Land, top = top)
        Column(Modifier.weight(1f).fillMaxHeight()) {
            Box(
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .then(if (!layout.phone) Modifier.padding(bottom = bottomInset) else Modifier)
                    .graphicsLayer {
                        translationX = back.value * with(density) { 48.dp.toPx() }
                        val sc = 1f - 0.04f * back.value
                        scaleX = sc; scaleY = sc
                    },
            ) {
                Screens(layout, top)
                // Content scrolls under the status bar; this keeps the clock legible over it.
                if (!Chrome.bleed) Box(
                    Modifier.fillMaxWidth().height(top + 6.dp).background(
                        androidx.compose.ui.graphics.Brush.verticalGradient(
                            0f to p.milk, top.value / (top.value + 6f) to p.milk, 1f to p.milk.copy(alpha = 0f),
                        ),
                    ),
                )
            }
            if (layout.phone) TabBar(bottomInset)
        }
        if (layout.panel) ContextPane(top)
    }
    when (val o = Nav.over) {
        is Over.Dose -> androidx.compose.runtime.key(o.due) { DoseSheet(o.due) { Nav.closeOver() } }
        is Over.Editor -> androidx.compose.runtime.key(o.id) { MedicineEdit(o.id) { Nav.closeOver() } }
        null -> Unit
    }
}

@Composable
private fun Screens(layout: Layout, top: Dp) {
    val reduced = LocalReducedMotion.current
    val route = Nav.current
    // On wide screens the Medicines and History lists stay put while their detail changes beside them.
    val key: Any = if (layout.panel) when (route) {
        is Route.Medicine -> Route.Medicines
        is Route.Day -> Route.History
        else -> route
    } else route
    AnimatedContent(
        key to route,
        transitionSpec = {
            val dir = Nav.direction
            when {
                reduced || dir == 0 -> fadeIn(tween(180)) togetherWith fadeOut(tween(120))
                else -> (slideInHorizontally(tween(320, easing = Drawer)) { it * dir / 3 } + fadeIn(tween(220))) togetherWith
                    (slideOutHorizontally(tween(260, easing = Drawer)) { -it * dir / 6 } + fadeOut(tween(160)))
            }
        },
        contentKey = { it.first },
        label = "screens",
    ) { (_, r) ->
        when (r) {
            Route.Today -> TodayScreen(top)
            Route.Medicines -> if (layout.panel) MedicinesSplit(null, top) else MedicinesScreen(top)
            is Route.Medicine -> if (layout.panel) MedicinesSplit(r.id, top) else MedicineDetail(r.id, top)
            Route.History -> if (layout.panel) HistorySplit(null, top) else HistoryScreen(top)
            is Route.Day -> if (layout.panel) HistorySplit(r.date, top) else DayView(r.date, top, page = true)
            Route.You -> YouScreen(top)
            Route.MealTimes -> MealTimesScreen(top)
        }
    }
}

@Composable
private fun MedicinesSplit(selected: String?, top: Dp) {
    val route = Nav.current
    val id = (route as? Route.Medicine)?.id ?: selected
    Row(Modifier.fillMaxSize()) {
        Box(Modifier.weight(1f)) { MedicinesScreen(top, id) }
        Box(Modifier.width(420.dp).fillMaxHeight().verticalScroll(rememberScrollState()).padding(top = top + 24.dp, end = 24.dp, bottom = 24.dp)) {
            MedicineDetail(id, top, inPanel = true)
        }
    }
}

@Composable
private fun HistorySplit(selected: String?, top: Dp) {
    val route = Nav.current
    val day = (route as? Route.Day)?.date ?: selected
    Row(Modifier.fillMaxSize()) {
        Box(Modifier.weight(1f)) { HistoryScreen(top, day) }
        Box(Modifier.width(400.dp).fillMaxHeight().verticalScroll(rememberScrollState()).padding(top = top + 24.dp, end = 24.dp, bottom = 24.dp)) {
            DayView(day, top, page = false)
        }
    }
}

@Composable
private fun ContextPane(top: Dp) {
    if (Nav.current != Route.Today) return
    Box(Modifier.width(360.dp).fillMaxHeight().verticalScroll(rememberScrollState()).padding(top = top + 24.dp, end = 24.dp, bottom = 24.dp).semantics { contentDescription = "Details" }) {
        TodayPanel()
    }
}

@Composable
private fun TabBar(bottomInset: Dp) {
    val p = LocalPalette.current
    Column(Modifier.fillMaxWidth().background(p.card)) {
        Box(Modifier.fillMaxWidth().height(1.dp).background(p.line))
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 8.dp).padding(top = 6.dp, bottom = 6.dp + bottomInset),
            horizontalArrangement = Arrangement.SpaceEvenly,
        ) {
            Tab.entries.forEach { t -> TabItem(t, Modifier.weight(1f), vertical = true) }
        }
    }
}

@Composable
private fun TabItem(t: Tab, modifier: Modifier, vertical: Boolean, slim: Boolean = false) {
    val p = LocalPalette.current
    val on = Nav.tab == t
    val fg by animateColorAsState(if (on) p.pipInk else p.soft, tween(150), label = "tabfg")
    val pill by animateColorAsState(if (on) p.pipWash else Color.Transparent, tween(150), label = "tabbg")
    Column(
        modifier
            .heightIn(min = 56.dp)
            .tap(role = Role.Tab, sink = 0.94f) { if (!on) Feels.haptic(Haptic.Tick); Nav.go(t) }
            .semantics(mergeDescendants = true) { selected = on },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp, Alignment.CenterVertically),
    ) {
        Box(Modifier.size(width = 56.dp, height = 32.dp).background(pill, RoundedCornerShape(16.dp)), contentAlignment = Alignment.Center) {
            Icon(t.icon, fg, size = 24.dp)
        }
        if (!slim) Txt(t.label, body(12, if (on) 700 else 600, 1.2f, fg).copy(textAlign = TextAlign.Center), lines = 1)
    }
}

@Composable
private fun Rail(slim: Boolean, top: Dp) {
    val p = LocalPalette.current
    Column(
        Modifier.width(if (slim) 72.dp else 96.dp).fillMaxHeight().background(p.card)
            .padding(top = top + 12.dp, bottom = 12.dp)
            .windowInsetsPadding(WindowInsets.navigationBars.only(WindowInsetsSides.Bottom)),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(if (slim) 4.dp else 12.dp),
    ) {
        if (!slim) Pip(Mood.Idle, size = 48.dp, poke = true)
        Spacer(Modifier.height(if (slim) 0.dp else 8.dp))
        Tab.entries.forEach { t -> TabItem(t, Modifier.width(80.dp), vertical = true, slim = slim) }
        Spacer(Modifier.weight(1f))
        IconBtn(Ic.Plus, "Add medicine", tone = p.pipDeep, tint = p.onPip, size = 52.dp) { Nav.open(Over.Editor(null)) }
    }
}
