package co.ashwin.tend.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import co.ashwin.tend.core.GroupState
import co.ashwin.tend.core.Medicine
import co.ashwin.tend.core.Outcome
import co.ashwin.tend.core.Scene
import co.ashwin.tend.core.Slot
import co.ashwin.tend.core.TodayModel
import co.ashwin.tend.core.activeZone
import co.ashwin.tend.core.clock
import co.ashwin.tend.core.courseDay
import co.ashwin.tend.core.deviceZone
import co.ashwin.tend.core.doseState
import co.ashwin.tend.core.dueDate
import co.ashwin.tend.core.dueParts
import co.ashwin.tend.core.fmtDay
import co.ashwin.tend.core.fmtHere
import co.ashwin.tend.core.fmtNum
import co.ashwin.tend.core.fmtTime
import co.ashwin.tend.core.medById
import co.ashwin.tend.core.nowKey
import co.ashwin.tend.core.pending
import co.ashwin.tend.core.plural
import co.ashwin.tend.core.relDay
import co.ashwin.tend.core.relDayAfterTime
import co.ashwin.tend.core.shortSchedule
import co.ashwin.tend.core.skip
import co.ashwin.tend.core.snooze
import co.ashwin.tend.core.take
import co.ashwin.tend.core.takePrn
import co.ashwin.tend.core.today
import co.ashwin.tend.core.zoneName
import co.ashwin.tend.data.Repo
import co.ashwin.tend.feel.Feels
import co.ashwin.tend.ui.ActionSheet
import co.ashwin.tend.ui.Btn
import co.ashwin.tend.ui.CardBox
import co.ashwin.tend.ui.Dark
import co.ashwin.tend.ui.H2
import co.ashwin.tend.ui.Ic
import co.ashwin.tend.ui.Icon
import co.ashwin.tend.ui.IconBtn
import co.ashwin.tend.ui.Kind
import co.ashwin.tend.ui.LocalLayout
import co.ashwin.tend.ui.LocalPalette
import co.ashwin.tend.ui.MedRow
import co.ashwin.tend.ui.Mode
import co.ashwin.tend.ui.Mood
import co.ashwin.tend.ui.Nav
import co.ashwin.tend.ui.Over
import co.ashwin.tend.ui.Pip
import co.ashwin.tend.ui.PillChip
import co.ashwin.tend.ui.RefillButton
import co.ashwin.tend.ui.Route
import co.ashwin.tend.ui.SceneArt
import co.ashwin.tend.ui.SceneIcon
import co.ashwin.tend.ui.SheetAction
import co.ashwin.tend.ui.SwipeRow
import co.ashwin.tend.ui.TimeSheet
import co.ashwin.tend.ui.Txt
import co.ashwin.tend.ui.body
import co.ashwin.tend.ui.display
import co.ashwin.tend.ui.rememberNow
import co.ashwin.tend.ui.rememberStored
import co.ashwin.tend.ui.sceneTile
import co.ashwin.tend.ui.softShadow
import co.ashwin.tend.ui.tap
import co.ashwin.tend.ui.toast
import co.ashwin.tend.widget.takeLabel
import java.time.ZoneId

/** Applies an action with its sound and haptic, and offers Undo. */
fun act(outcome: Outcome?) {
    outcome ?: return
    val undo = Repo.apply(outcome)
    Feels.feel(outcome.feel)
    toast(outcome.message, undo)
}

fun greeting(hour: Int) = when {
    hour < 5 -> "Good night"
    hour < 12 -> "Good morning"
    hour < 17 -> "Good afternoon"
    else -> "Good evening"
}

@Composable
fun rememberToday(): TodayModel {
    val s = rememberStored()
    val now = rememberNow()
    return remember(s, now) { today(s.meds, s.settings.routines, s.logs, now) }
}

@Composable
fun TodayScreen(top: androidx.compose.ui.unit.Dp) {
    val t = rememberToday()
    val l = LocalLayout.current
    // Briefly holds the card that was just taken, so its checks can land before it moves on.
    var hold by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(hold) { if (hold != null) { kotlinx.coroutines.delay(450); hold = null } }
    val focus = hold?.let { k -> t.slots.find { it.key == k } } ?: t.focus
    if (t.empty) return Empty(top)
    if (t.night && hold == null) return Night(t, top)

    val scroll = rememberScrollState()
    var takeOffscreen by remember { mutableStateOf(false) }
    val onTake: (Slot, String?) -> Unit = { slot, at ->
        hold = slot.key
        val open = slot.doses.filter { doseState(Repo.now.logs, it, nowKey()).pending }
        act(take(Repo.now.data, open, slot.label, at ?: nowKey()))
    }

    if (l.mode == Mode.Land) {
        Row(Modifier.fillMaxSize().padding(start = 12.dp, end = 12.dp, top = top + 8.dp, bottom = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(Modifier.weight(0.46f).fillMaxHeight()) {
                if (focus != null) DueCard(focus, t.meds, onTake, compact = true, modifier = Modifier.fillMaxSize())
                else AllDoneCard(t, Modifier.fillMaxSize())
            }
            Column(Modifier.weight(0.54f).fillMaxHeight().verticalScroll(scroll), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                focus?.let { f ->
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        f.doses.forEachIndexed { i, d ->
                            medById(t.meds, d.medId)?.let { med ->
                                MedRow(med, amount = d.amount, state = doseState(Repo.now.logs, d, nowKey()), index = i) { Nav.open(Over.Dose(f.key)) }
                            }
                        }
                    }
                }
                Lists(t, focus)
            }
        }
        return
    }

    // Room for the sticky Take bar, so it never hides the last row.
    val stickyRoom = l.phone && focus != null && (focus.state == GroupState.Due || focus.state == GroupState.Snoozed)
    Box(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(scroll)
                .padding(horizontal = if (l.mode == Mode.Phone) if (l.narrow) 12.dp else 16.dp else 32.dp)
                .padding(top = top + if (l.phone) 8.dp else 24.dp, bottom = if (stickyRoom) 104.dp else 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Column(Modifier.widthIn(max = if (l.panel) 960.dp else 800.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                Header(t)
                TravelCard()
                if (focus != null) {
                    DueCard(
                        focus, t.meds, onTake,
                        big = l.mode == Mode.Tab || l.mode == Mode.Lap,
                        onTakeVisible = { takeOffscreen = !it },
                    )
                } else AllDoneCard(t)
                Lists(t, focus)
                if (l.mode == Mode.Tab || l.mode == Mode.Lap) YourMedicines(t)
            }
        }
        // While the due card's Take scrolls away, a copy stays reachable above the tab bar.
        val f = focus
        val due = f != null && (f.state == GroupState.Due || f.state == GroupState.Snoozed)
        val open = f?.doses?.count { doseState(Repo.now.logs, it, nowKey()).pending } ?: 0
        AnimatedVisibility(
            due && open > 0 && takeOffscreen && l.phone,
            Modifier.align(Alignment.BottomCenter),
            enter = slideInVertically(tween(260)) { it } + fadeIn(),
            exit = slideOutVertically(tween(180)) { it } + fadeOut(),
        ) {
            if (f != null) {
                val p = LocalPalette.current
                Row(
                    Modifier
                        .padding(12.dp)
                        .fillMaxWidth()
                        .softShadow(RoundedCornerShape(22.dp))
                        .background(p.card, RoundedCornerShape(22.dp))
                        .padding(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Column(Modifier.weight(1f).padding(start = 8.dp)) {
                        Txt(f.label, display(15, 700, 1.2f, p.ink), lines = 1)
                        Txt("due ${fmtTime(f.key)}", body(13, 400, 1.3f, p.soft), lines = 1)
                    }
                    Btn(takeLabel(open)) { onTake(f, null) }
                }
            }
        }
    }
}

@Composable
private fun Header(t: TodayModel) {
    val p = LocalPalette.current
    val l = LocalLayout.current
    Row(Modifier.padding(horizontal = 4.dp).padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(Modifier.weight(1f)) {
            Txt(fmtDay(t.today, "EEEE, d MMM"), body(14, 600, 1.3f, p.soft))
            Txt(
                greeting(t.now.atZone(deviceZone()).hour),
                display(if (l.narrow) 28 else if (l.phone) 32 else 40, 800, 1.05f, p.ink),
                Modifier.padding(top = 2.dp).semantics { heading() },
            )
            TravelChip()
        }
        if (l.phone) IconBtn(Ic.Plus, "Add medicine", shadow = true) { Nav.open(Over.Editor(null)) }
    }
}

@Composable
private fun TravelChip() {
    val s = rememberStored()
    val now = rememberNow()
    val t = s.settings.travel
    val here = deviceZone()
    if (!t.keepHome || t.home == here.id) return
    val p = LocalPalette.current
    Row(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(Ic.Globe, p.pipInk, size = 16.dp)
        Txt("${zoneName(t.home)} time · ${co.ashwin.tend.core.clockText(now.atZone(here).toLocalTime())} here", body(14, 600, 1.3f, p.pipInk))
    }
}

/** Shown once after the phone arrives in a new zone, until a choice is made. */
@Composable
fun TravelCard() {
    val s = rememberStored()
    val t = s.settings.travel
    val here = deviceZone().id
    if (t.home == here || t.keepHome || t.seen == here) return
    val p = LocalPalette.current
    val home = zoneName(t.home)
    val h = zoneName(here)
    val breakfast = s.settings.routines.find { it.id == co.ashwin.tend.core.RoutineId.Breakfast }?.weekday ?: "08:00"
    val gap = co.ashwin.tend.core.zoneGap(ZoneId.of(t.home), deviceZone())
    CardBox {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(Modifier.size(44.dp).background(p.duskWash, RoundedCornerShape(14.dp)), contentAlignment = Alignment.Center) { Icon(Ic.Globe, p.ink, size = 22.dp) }
            Column(Modifier.weight(1f)) {
                Txt("You're on $h time", body(17, 700, 1.3f, p.ink), Modifier.semantics { heading() })
                Txt(
                    "$home is ${co.ashwin.tend.core.gapText(gap)} $h. Doses now follow the clock here, so breakfast is ${fmtTime(breakfast)} local. If a medicine needs a steady gap, like insulin or the pill, keep $home time.",
                    body(15, 400, 1.4f, p.soft),
                )
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Btn("Use local time", Modifier.weight(1f), Kind.Soft, small = true, label = "Follow $h time") {
                Repo.settings { it.copy(travel = it.travel.copy(seen = here)) }
            }
            Btn("Keep home time", Modifier.weight(1f), small = true, label = "Keep $home time") {
                Repo.settings { it.copy(travel = it.travel.copy(mode = "home", seen = here)) }
            }
        }
    }
}

private fun hereSuffix(key: String): String {
    val keeping = activeZone() != deviceZone()
    return if (keeping) ", ${fmtHere(key)} here" else ""
}

@Composable
private fun DueCard(
    slot: Slot,
    meds: List<Medicine>,
    onTake: (Slot, String?) -> Unit,
    modifier: Modifier = Modifier,
    compact: Boolean = false,
    big: Boolean = false,
    onTakeVisible: (Boolean) -> Unit = {},
) {
    val s = rememberStored()
    val now = rememberNow()
    val nk = nowKey(now)
    var more by remember { mutableStateOf(false) }
    var late by remember { mutableStateOf(false) }
    val open = slot.doses.filter { doseState(s.logs, it, nk).pending }
    val due = slot.state == GroupState.Due
    val overdue = due && clock().toEpochMilli() - dueDate(slot.key).toEpochMilli() > 30 * 60_000
    val n = slot.doses.size
    val first = medById(meds, slot.doses.first().medId)
    val title = if (due || slot.state == GroupState.Snoozed) {
        if (n == 1) "Time for ${first?.name ?: "your medicine"}" else "Time for ${plural(n, "medicine")}"
    } else if (n == 1) first?.name ?: "1 medicine" else plural(n, "medicine")
    val meta = if (slot.state == GroupState.Snoozed && slot.until != null) "${slot.label} · snoozed to ${fmtTime(slot.until)}"
    else "${slot.label} · ${if (due) "due" else "at"} ${fmtTime(slot.key)}${hereSuffix(slot.key)}"
    val allTaken = open.isEmpty()
    val mood = when {
        allTaken -> Mood.Taken
        overdue -> Mood.Nudge
        due -> Mood.Due
        else -> Mood.Idle
    }
    val night = slot.scene == Scene.Night
    val palette = if (night) Dark else LocalPalette.current
    val windowH = with(LocalDensity.current) { androidx.compose.ui.platform.LocalWindowInfo.current.containerSize.height.toFloat() }

    CompositionLocalProvider(LocalPalette provides palette) {
        val p = palette
        Box(modifier.fillMaxWidth().clip(RoundedCornerShape(28.dp)).heightIn(min = if (compact) 0.dp else if (big) 300.dp else 240.dp)) {
            SceneArt(slot.scene, Modifier.matchParentSize(), palette = p)
            Column(Modifier.padding(if (big) 24.dp else 16.dp).then(if (compact) Modifier.fillMaxHeight() else Modifier), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Row(verticalAlignment = Alignment.Top) {
                    Column(Modifier.weight(1f).padding(top = 4.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Txt(meta, display(14, 700, 1.25f, p.ink.copy(alpha = 0.8f)))
                        Txt(title, display(if (big) 30 else 24, 800, 1.08f, p.ink), Modifier.semantics { heading() })
                    }
                    Pip(mood, size = if (big) 128.dp else if (compact) 80.dp else 88.dp, poke = true, palette = p)
                }
                if (compact) Spacer(Modifier.weight(1f))
                if (!compact) {
                    val rows: @Composable (Int, co.ashwin.tend.core.Dose) -> Unit = { i, d ->
                        medById(meds, d.medId)?.let { med ->
                            val c = courseDay(med, slot.day)
                            val st = doseState(s.logs, d, nk)
                            SwipeRow("Skip ${med.name}", enabled = st.pending, onCommit = { act(skip(Repo.now.data, listOf(d), slot.label)) }) {
                                MedRow(
                                    med, amount = d.amount, state = st, index = i,
                                    extra = c?.total?.let { "day ${c.n} of $it" },
                                ) { Nav.open(Over.Dose(slot.key)) }
                            }
                        }
                    }
                    if (big) {
                        @OptIn(ExperimentalLayoutApi::class)
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp), maxItemsInEachRow = 2) {
                            slot.doses.forEachIndexed { i, d -> Box(Modifier.weight(1f)) { rows(i, d) } }
                        }
                    } else Column(verticalArrangement = Arrangement.spacedBy(6.dp)) { slot.doses.forEachIndexed { i, d -> rows(i, d) } }
                }
                @OptIn(ExperimentalLayoutApi::class)
                FlowRow(
                    Modifier.onGloballyPositioned { c ->
                        val b = c.boundsInWindow()
                        onTakeVisible(b.bottom > 0 && b.top < windowH - 120)
                    },
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    val takeText = when {
                        allTaken -> "Taken at ${fmtTime(nk)}"
                        due || slot.state == GroupState.Snoozed -> takeLabel(open.size)
                        else -> "Take early"
                    }
                    Btn(
                        takeText,
                        Modifier.weight(1f).widthIn(min = 140.dp),
                        if (due) Kind.Primary else Kind.Ghost,
                        enabled = !allTaken,
                        label = if (!allTaken) "$takeText. Long-press for taken at another time" else null,
                        onLongClick = { late = true },
                    ) { onTake(slot, null) }
                    if (big) {
                        Btn("Snooze", kind = Kind.Ghost, icon = Ic.Snooze, enabled = !allTaken) { act(snooze(Repo.now.data, slot.group, 10)) }
                        Btn("Skip", kind = Kind.Ghost, enabled = !allTaken) { act(skip(Repo.now.data, open, slot.label)) }
                    }
                    IconBtn(Ic.More, "More options", size = 52.dp, tone = p.card) { more = true }
                }
            }
        }
    }
    ActionSheet(
        open = more,
        onClose = { more = false },
        title = "${slot.label} · ${fmtTime(slot.key)}",
        actions = listOf(
            SheetAction("Snooze 10 min", Ic.Snooze) { act(snooze(Repo.now.data, slot.group, 10)) },
            SheetAction("Snooze 30 min", Ic.Snooze) { act(snooze(Repo.now.data, slot.group, 30)) },
            SheetAction("Taken at another time", Ic.Clock) { late = true },
            SheetAction("Choose medicines", Ic.Check) { Nav.open(Over.Dose(slot.key)) },
            SheetAction(if (open.size > 1) "Skip all" else "Skip", Ic.Skip, danger = true) { act(skip(Repo.now.data, open, slot.label)) },
        ),
    )
    TimeSheet(
        open = late,
        onClose = { late = false },
        title = "When did you take ${if (n == 1) "it" else "them"}?",
        defaultTime = dueParts(slot.key).time,
        day = slot.day,
        dueKey = slot.key,
    ) { time -> onTake(slot, "${slot.day}T$time") }
}

@Composable
private fun AllDoneCard(t: TodayModel, modifier: Modifier = Modifier) {
    val p = LocalPalette.current
    val next = t.next
    val first = next?.let { medById(t.meds, it.doses.first().medId) }
    Box(modifier.fillMaxWidth().clip(RoundedCornerShape(28.dp)).heightIn(min = 200.dp)) {
        SceneArt(Scene.Evening, Modifier.matchParentSize())
        Pip(Mood.Done, Modifier.align(Alignment.TopEnd).padding(16.dp), size = 104.dp, poke = true)
        Column(Modifier.align(Alignment.BottomStart).padding(20.dp).padding(end = 96.dp)) {
            Txt("All done for now", display(24, 800, 1.15f, p.ink), Modifier.semantics { heading() })
            if (next != null && first != null) {
                Txt(
                    "Next up: ${first.name}${if (next.doses.size > 1) " and ${next.doses.size - 1} more" else ""} at ${fmtTime(next.key)}${relDayAfterTime(next.day, t.today)}.",
                    body(16, 400, 1.4f, p.soft),
                    Modifier.padding(top = 4.dp),
                )
            }
        }
    }
}

@Composable
private fun Lists(t: TodayModel, focus: Slot?) {
    val l = LocalLayout.current
    val s = rememberStored()
    val later = t.later.filter { it != focus }
    val past = t.past.filter { it != focus }
    val cols = if (l.mode == Mode.Phone || l.mode == Mode.Land) 1 else 2
    if (later.isNotEmpty()) Section("Later today") { Grid(cols, later) { SlotRow(it, t.meds) } }
    if (t.prn.isNotEmpty()) Section("When needed") {
        Grid(cols, t.prn) { row ->
            val st = row.state
            MedRow(
                row.med,
                withFood = false,
                extra = when {
                    st?.full == true -> "${st.todayCount} today, that's the most"
                    st?.nextAt != null -> "next from ${fmtTime(st.nextAt)}"
                    (st?.todayCount ?: 0) > 0 -> "${st!!.todayCount} today"
                    else -> null
                },
                trailing = {
                    Btn("Take", kind = Kind.Soft, small = true, enabled = st?.canTake == true, label = "Take ${row.med.name} now") {
                        act(takePrn(Repo.now.data, row.med))
                    }
                },
            )
        }
    }
    if (!l.panel && (t.low.isNotEmpty() || t.courses.isNotEmpty())) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (s.settings.refillAlerts) t.low.forEach { LowRow(it.med, it.info.days ?: 0, it.info.count) }
            t.courses.forEach { c -> CourseRow(c.med, c.day.n, c.day.total ?: 0) }
        }
    }
    if (past.isNotEmpty()) Section("Earlier today") { Grid(cols, past) { SlotRow(it, t.meds) } }
}

@Composable
private fun Section(title: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        H2(title)
        content()
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun <T> Grid(cols: Int, items: List<T>, item: @Composable (T) -> Unit) {
    FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp), maxItemsInEachRow = cols) {
        items.forEach { Box(Modifier.weight(1f)) { item(it) } }
        // Keeps the last item half width in an odd two-column row.
        if (cols > 1 && items.size % cols != 0) Spacer(Modifier.weight(1f))
    }
}

@Composable
fun SlotRow(slot: Slot, meds: List<Medicine>) {
    val p = LocalPalette.current
    val names = slot.doses.mapNotNull { medById(meds, it.medId)?.name }
    val status = when {
        slot.state == GroupState.Done -> "Logged"
        slot.state == GroupState.Unlogged -> "Not logged"
        slot.state == GroupState.Snoozed && slot.until != null -> "Snoozed to ${fmtTime(slot.until)}"
        else -> null
    }
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 68.dp)
            .tap(sink = 0.98f) { Nav.open(Over.Dose(slot.key)) }
            .softShadow(RoundedCornerShape(20.dp))
            .background(p.card, RoundedCornerShape(20.dp))
            .padding(start = 10.dp, end = 16.dp, top = 10.dp, bottom = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(Modifier.size(48.dp).background(p.sceneTile(slot.scene), RoundedCornerShape(15.dp)), contentAlignment = Alignment.Center) { SceneIcon(slot.scene) }
        Column(Modifier.weight(1f)) {
            Txt(slot.label, display(16, 700, 1.2f, p.ink))
            Txt(status ?: names.joinToString(", "), body(14, 400, 1.35f, p.soft))
        }
        if (slot.state == GroupState.Done) {
            Box(Modifier.size(28.dp).background(p.pipWash, CircleShape), contentAlignment = Alignment.Center) { Icon(Ic.Check, p.pipInk, size = 16.dp, stroke = 2.6f) }
        } else Txt(fmtTime(slot.key), display(15, 700, 1.2f, p.ink), lines = 1)
    }
}

@Composable
private fun LowRow(med: Medicine, days: Int, count: Double) {
    val p = LocalPalette.current
    Row(
        Modifier.fillMaxWidth().heightIn(min = 64.dp).softShadow(RoundedCornerShape(20.dp)).background(p.card, RoundedCornerShape(20.dp)).padding(start = 10.dp, end = 12.dp, top = 10.dp, bottom = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(Modifier.size(48.dp).background(p.noonWash, RoundedCornerShape(15.dp)), contentAlignment = Alignment.Center) { Pip(Mood.Low, size = 40.dp) }
        Column(Modifier.weight(1f)) {
            Txt("${med.name} running low", display(16, 700, 1.2f, p.ink))
            Txt("${fmtNum(count)} left, about ${plural(days, "day")}", body(14, 400, 1.35f, p.soft))
        }
        RefillButton(med)
    }
}

@Composable
private fun CourseRow(med: Medicine, n: Int, total: Int) {
    val p = LocalPalette.current
    Row(
        Modifier.fillMaxWidth().heightIn(min = 64.dp).tap(sink = 0.98f) { Nav.push(Route.Medicine(med.id)) }
            .softShadow(RoundedCornerShape(20.dp)).background(p.card, RoundedCornerShape(20.dp)).padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        PillChip(med.look, med.form, tile = p.sunWash, size = 44.dp)
        Column(Modifier.weight(1f)) {
            Txt(med.name, display(16, 700, 1.2f, p.ink))
            Txt("Day $n of $total", body(14, 400, 1.35f, p.soft))
        }
        Icon(Ic.Next, p.soft, size = 20.dp)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun YourMedicines(t: TodayModel) {
    val p = LocalPalette.current
    Section("Your medicines") {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp), maxItemsInEachRow = if (LocalLayout.current.panel) 3 else 2) {
            t.meds.forEach { m ->
                val info = t.stock.find { it.med.id == m.id }?.info
                val c = courseDay(m, t.today)
                Column(
                    Modifier.weight(1f).tap(sink = 0.98f) { Nav.push(Route.Medicine(m.id)) }
                        .softShadow(RoundedCornerShape(20.dp)).background(p.card, RoundedCornerShape(20.dp)).padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    PillChip(m.look, m.form)
                    Txt(m.name, display(16, 700, 1.2f, p.ink), Modifier.padding(top = 6.dp))
                    Txt(c?.total?.let { "Day ${c.n} of $it" } ?: shortSchedule(m.schedule), body(14, 400, 1.35f, p.soft))
                    if (info != null && m.stock != null) {
                        val fill = (info.count / maxOf(m.stock.pack * 3, info.count, 1.0)).toFloat().coerceIn(0f, 1f)
                        Box(Modifier.padding(top = 8.dp).fillMaxWidth().height(6.dp).background(p.line, CircleShape)) {
                            Box(Modifier.fillMaxWidth(fill).height(6.dp).background(if (info.low) p.noon else p.pip, CircleShape))
                        }
                        Txt("${fmtNum(info.count)} left${if (info.low) " · refill soon" else ""}", body(13, 400, 1.3f, p.soft))
                    }
                }
            }
            if (t.meds.size % 2 != 0) Spacer(Modifier.weight(1f))
        }
    }
}

@Composable
private fun Empty(top: androidx.compose.ui.unit.Dp) {
    val p = LocalPalette.current
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp).padding(top = top, bottom = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
    ) {
        Spacer(Modifier.height(24.dp))
        Pip(Mood.Hello, size = 160.dp, poke = true)
        Txt("Nothing to tend yet", display(28, 800, 1.1f, p.ink).copy(textAlign = TextAlign.Center), Modifier.semantics { heading() })
        Txt("Add what you take and when, and Pip will keep the day in order.", body(17, 400, 1.45f, p.soft).copy(textAlign = TextAlign.Center), Modifier.widthIn(max = 320.dp))
        Btn("Add a medicine", Modifier.padding(top = 8.dp), icon = Ic.Plus) { Nav.open(Over.Editor(null)) }
    }
}

@Composable
private fun Night(t: TodayModel, top: androidx.compose.ui.unit.Dp) {
    CompositionLocalProvider(LocalPalette provides Dark) {
        val p = Dark
        val next = t.next
        val first = next?.let { medById(t.meds, it.doses.first().medId) }
        val l = LocalLayout.current
        LaunchedEffect(Unit) { Feels.sound(co.ashwin.tend.feel.Sound.Night) }
        androidx.compose.runtime.DisposableEffect(Unit) {
            co.ashwin.tend.ui.Chrome.bleed = true
            onDispose { co.ashwin.tend.ui.Chrome.bleed = false }
        }
        Box(Modifier.fillMaxSize()) {
            SceneArt(Scene.Night, Modifier.matchParentSize(), palette = p)
            Column(
                Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp).padding(top = top, bottom = 40.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
            ) {
                Spacer(Modifier.weight(1f))
                Pip(Mood.Sleep, size = if (l.mode == Mode.Land) 120.dp else 176.dp, label = "Pip asleep", poke = true, palette = p)
                Txt("All done for today", display(32, 800, 1.15f, p.ink).copy(textAlign = TextAlign.Center), Modifier.semantics { heading() })
                Txt(
                    "${t.progress.done} of ${t.progress.total} logged." +
                        (if (next != null && first != null) " Next up: ${first.name}${if (next.doses.size > 1) " and ${next.doses.size - 1} more" else ""} at ${fmtTime(next.key)} ${relDay(next.day, t.today)}." else "") +
                        " Sleep well.",
                    body(17, 400, 1.45f, p.soft).copy(textAlign = TextAlign.Center),
                    Modifier.widthIn(max = 340.dp),
                )
                Btn("See tomorrow", Modifier.padding(top = 8.dp), Kind.Ghost, background = p.night2) { Nav.open(Over.Dose("next")) }
                Spacer(Modifier.weight(1f))
            }
        }
    }
}

/** The tablet's right-hand pane: the week, refills, courses and when-needed history. */
@Composable
fun TodayPanel() {
    val t = rememberToday()
    val s = rememberStored()
    val p = LocalPalette.current
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        CardBox {
            Txt("This week", body(17, 700, 1.3f, p.ink), Modifier.semantics { heading() })
            WeekRings(34.dp)
        }
        if (t.low.isNotEmpty() && s.settings.refillAlerts) CardBox {
            Txt("Running low", body(17, 700, 1.3f, p.ink), Modifier.semantics { heading() })
            t.low.forEach { row ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Pip(Mood.Low, size = 48.dp)
                    Column(Modifier.weight(1f)) {
                        Txt(row.med.name, body(16, 600, 1.3f, p.ink))
                        Txt("${fmtNum(row.info.count)} left, about ${plural(row.info.days ?: 0, "day")}", body(14, 400, 1.35f, p.soft))
                    }
                    RefillButton(row.med)
                }
            }
        }
        t.courses.forEach { c ->
            CardBox(padding = 16.dp) {
                Txt("Course", body(17, 700, 1.3f, p.ink))
                Txt("${c.med.name}, day ${c.day.n} of ${c.day.total}.${c.day.end?.let { " Ends ${relDay(it, t.today)}." } ?: ""}", body(16, 400, 1.4f, p.soft))
            }
        }
        if (t.prn.isNotEmpty()) CardBox {
            Txt("When needed", body(17, 700, 1.3f, p.ink))
            t.prn.forEach { r ->
                Txt(
                    "${r.med.name}: ${r.state?.last?.let { "last at ${fmtTime(it.take(16))} ${relDay(it.take(10), t.today)}" } ?: "not taken yet"}",
                    body(16, 400, 1.4f, p.soft),
                )
            }
        }
    }
}
