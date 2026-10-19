package co.ashwin.tend.ui.screens

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import co.ashwin.tend.core.DoseStatus
import co.ashwin.tend.core.GroupState
import co.ashwin.tend.core.Schedule
import co.ashwin.tend.core.WeekDay
import co.ashwin.tend.core.addDays
import co.ashwin.tend.core.dayKey
import co.ashwin.tend.core.dosesOn
import co.ashwin.tend.core.dueDate
import co.ashwin.tend.core.fmtDay
import co.ashwin.tend.core.fmtTime
import co.ashwin.tend.core.lastDays
import co.ashwin.tend.core.latestLog
import co.ashwin.tend.core.medById
import co.ashwin.tend.core.medicineDose
import co.ashwin.tend.core.nowKey
import co.ashwin.tend.core.progress
import co.ashwin.tend.core.slotsOn
import co.ashwin.tend.core.weekday
import co.ashwin.tend.ui.Btn
import co.ashwin.tend.ui.CardBox
import co.ashwin.tend.ui.H2
import co.ashwin.tend.ui.Ic
import co.ashwin.tend.ui.IconBtn
import co.ashwin.tend.ui.Kind
import co.ashwin.tend.ui.LocalLayout
import co.ashwin.tend.ui.LocalPalette
import co.ashwin.tend.ui.LocalReducedMotion
import co.ashwin.tend.ui.Mood
import co.ashwin.tend.ui.Nav
import co.ashwin.tend.ui.Pill
import co.ashwin.tend.ui.PillChip
import co.ashwin.tend.ui.Pip
import co.ashwin.tend.ui.Route
import co.ashwin.tend.ui.SceneIcon
import co.ashwin.tend.ui.Txt
import co.ashwin.tend.ui.body
import co.ashwin.tend.ui.display
import co.ashwin.tend.ui.rememberNow
import co.ashwin.tend.ui.rememberStored
import co.ashwin.tend.ui.tap
import kotlin.math.roundToInt

@Composable
fun Ring(done: Int, total: Int, today: Boolean, future: Boolean, size: Dp, stroke: Dp = 4.5.dp) {
    val p = LocalPalette.current
    val f = if (total == 0) 0f else done.toFloat() / total
    val anim by animateFloatAsState(f, if (LocalReducedMotion.current) tween(0) else tween(600, easing = co.ashwin.tend.ui.EaseOut), label = "ring")
    Canvas(Modifier.widthIn(max = size).fillMaxWidth().aspectRatio(1f)) {
        val sw = stroke.toPx() * this.size.width / size.toPx()
        val inset = sw / 2
        val box = Size(this.size.width - sw, this.size.height - sw)
        drawArc(
            if (today) p.ink.copy(alpha = if (f < 1) 0.35f else 1f) else p.line,
            0f, 360f, false, Offset(inset, inset), box,
            style = Stroke(sw, pathEffect = if (future) PathEffect.dashPathEffect(floatArrayOf(2.dp.toPx(), 4.dp.toPx())) else null),
        )
        if (anim > 0f) drawArc(p.pip, -90f, 360f * anim, false, Offset(inset, inset), box, style = Stroke(sw, cap = StrokeCap.Round))
    }
}

@Composable
private fun DayButton(d: WeekDay, selected: Boolean, size: Dp, short: Boolean, onClick: () -> Unit) {
    val p = LocalPalette.current
    val name = fmtDay(d.day, "EEEE, d MMMM")
    Column(
        Modifier
            .heightIn(min = 44.dp)
            .alpha(if (d.future) 0.6f else 1f)
            .tap(enabled = !d.future, onClick = onClick)
            .semantics(mergeDescendants = true) {
                contentDescription = when {
                    d.future -> "$name, ahead"
                    d.total == 0 -> "$name, nothing scheduled"
                    else -> "$name, ${d.done} of ${d.total} logged"
                }
                this.selected = selected
            }
            .background(if (selected) p.pipWash else androidx.compose.ui.graphics.Color.Transparent, RoundedCornerShape(16.dp))
            .padding(horizontal = 2.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Txt(fmtDay(d.day, if (short) "EEEEE" else "EEE"), body(13, if (d.today) 700 else 600, 1.2f, if (d.today) p.ink else p.soft), lines = 1)
        Ring(d.done, d.total, d.today, d.future, size)
        if (!short) Txt(fmtDay(d.day, "d"), body(13, 400, 1.2f, p.soft), lines = 1)
    }
}

/** The calendar week's rings, for the tablet panel. */
@Composable
fun WeekRings(size: Dp) {
    val s = rememberStored()
    val now = rememberNow()
    val today = dayKey(now)
    val monday = addDays(today, -((weekday(today) + 6) % 7))
    val days = remember(s, now) {
        (0 until 7).map { i ->
            val day = addDays(monday, i)
            val future = day > today
            val slots = if (future) emptyList() else slotsOn(s.meds, s.settings.routines, s.logs, day, if (day == today) now else dueDate("${day}T23:59"))
            val pr = progress(slots, s.logs, now)
            WeekDay(day, future, day == today, pr.total, pr.done)
        }
    }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        days.forEach { d -> Box(Modifier.weight(1f)) { DayButton(d, false, size, short = true) { Nav.push(Route.Day(d.day)) } } }
    }
}

@Composable
fun HistoryScreen(top: Dp, selected: String? = null) {
    val p = LocalPalette.current
    val s = rememberStored()
    val now = rememberNow()
    val l = LocalLayout.current
    var weeks by remember { mutableIntStateOf(0) }
    val days = remember(s, now, weeks) { lastDays(s.meds, s.settings.routines, s.logs, now, weeks) }
    val range = "${fmtDay(days.first().day, "d MMM")} to ${fmtDay(days.last().day, "d MMM")}"
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = if (l.narrow) 12.dp else if (l.phone) 16.dp else 32.dp).padding(top = top + 12.dp, bottom = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Column(Modifier.widthIn(max = 800.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            Txt("History", display(if (l.phone) 32 else 40, 800, 1.1f, p.ink), Modifier.padding(horizontal = 4.dp).semantics { heading() })
            CardBox {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconBtn(Ic.Back, "Earlier week", tone = null) { weeks -= 1 }
                    Txt(
                        if (weeks == 0) "Last 7 days" else range,
                        body(17, 700, 1.3f, p.ink).copy(textAlign = TextAlign.Center),
                        Modifier.weight(1f).semantics { liveRegion = LiveRegionMode.Polite },
                    )
                    Box(Modifier.alpha(if (weeks == 0) 0f else 1f)) {
                        if (weeks < 0) IconBtn(Ic.Next, "Later week", tone = null) { weeks = minOf(0, weeks + 1) }
                        else Box(Modifier.size(44.dp))
                    }
                }
                val ring = if (l.narrow) 34.dp else 44.dp
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(if (l.narrow) 2.dp else 6.dp)) {
                    days.forEach { d ->
                        Box(Modifier.weight(1f)) {
                            DayButton(d, d.day == selected, ring, short = false) {
                                if (selected != null) Nav.replace(Route.Day(d.day)) else Nav.push(Route.Day(d.day))
                            }
                        }
                    }
                }
                Txt("Rings fill as doses are logged. Tap a day for times.", body(14, 400, 1.4f, p.soft).copy(textAlign = TextAlign.Center), Modifier.fillMaxWidth())
            }
            if (s.meds.any { !it.isArchived && it.schedule !is Schedule.Prn }) PerMedicine()
        }
    }
}

@Composable
private fun PerMedicine() {
    val p = LocalPalette.current
    val s = rememberStored()
    val now = rememberNow()
    val rows = remember(s, now) {
        val today = dayKey(now)
        val nk = nowKey(now)
        s.meds.filter { !it.isArchived && it.schedule !is Schedule.Prn }.map { m ->
            var total = 0
            var taken = 0
            for (i in 0 until 30) for (d in dosesOn(listOf(m), s.settings.routines, addDays(today, -i))) {
                if (d.due > nk) continue
                total += 1
                if (latestLog(s.logs, m.id, d.due)?.status == DoseStatus.Taken) taken += 1
            }
            Triple(m, total, if (total > 0) (taken * 100f / total).roundToInt() else null)
        }
    }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        H2("Last 30 days")
        CardBox {
            rows.forEach { (m, total, pct) ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    PillChip(m.look, m.form)
                    Column(Modifier.weight(1f)) {
                        Txt(m.name, body(16, 600, 1.3f, p.ink))
                        Box(Modifier.padding(top = 4.dp).fillMaxWidth().height(6.dp).background(p.line, CircleShape)) {
                            Box(Modifier.fillMaxWidth((pct ?: 0) / 100f).height(6.dp).background(p.pip, CircleShape))
                        }
                    }
                    Txt(if (pct == null) "Nothing yet" else "$pct% of $total", body(14, 400, 1.3f, p.soft).copy(textAlign = TextAlign.End), Modifier.width(88.dp), lines = 1)
                }
            }
        }
    }
}

/** One day's times and what happened at each. As a page on phones, a panel beside History on tablets. */
@Composable
fun DayView(date: String?, top: Dp, page: Boolean) {
    val p = LocalPalette.current
    val s = rememberStored()
    val now = rememberNow()
    val day = date ?: dayKey(now)
    val slots = remember(s, now, day) {
        slotsOn(s.meds, s.settings.routines, s.logs, day, if (day == dayKey(now)) now else dueDate("${day}T23:59"))
    }
    val prn = s.logs.filter { it.due.startsWith(day) && medById(s.meds, it.medId)?.schedule is Schedule.Prn }
    val title = fmtDay(day, "EEEE, d MMMM")
    val l = LocalLayout.current
    val content: @Composable () -> Unit = {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (slots.isEmpty() && prn.isEmpty()) {
                Column(Modifier.fillMaxWidth().padding(vertical = 32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Pip(Mood.Idle, size = 80.dp)
                    Txt("Nothing was scheduled.", body(16, 400, 1.4f, p.soft))
                }
            }
            slots.forEach { sl ->
                CardBox(padding = 16.dp) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        SceneIcon(sl.scene, 22.dp)
                        Txt(sl.label, body(16, 700, 1.3f, p.ink), Modifier.weight(1f))
                        Txt(fmtTime(sl.key), body(14, 400, 1.3f, p.soft), lines = 1)
                    }
                    sl.doses.forEach { d ->
                        val med = medById(s.meds, d.medId)
                        val lg = latestLog(s.logs, d.medId, d.due)
                        val status = when {
                            lg?.status == DoseStatus.Taken -> "Taken ${lg.at?.let { fmtTime(it) } ?: ""}".trim()
                            lg?.status == DoseStatus.Skipped -> "Skipped"
                            sl.state == GroupState.Upcoming || sl.state == GroupState.Due -> "Not yet"
                            else -> "Not logged"
                        }
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            med?.let { Pill(it.look, it.form, 20.dp) }
                            Column(Modifier.weight(1f)) {
                                Txt(med?.name ?: "Removed medicine", body(15, 500, 1.3f, p.ink))
                                med?.let { Txt(medicineDose(it, lg?.amount ?: d.amount ?: it.amount), body(13, 400, 1.3f, p.soft)) }
                            }
                            Txt(status, body(15, if (lg?.status == DoseStatus.Taken) 600 else 400, 1.3f, if (lg?.status == DoseStatus.Taken) p.pipInk else p.soft), lines = 1)
                        }
                    }
                }
            }
            if (prn.isNotEmpty()) CardBox(padding = 16.dp) {
                Txt("When needed", body(16, 700, 1.3f, p.ink))
                prn.forEach { lg ->
                    Row {
                        Txt(medById(s.meds, lg.medId)?.name ?: "", body(15, 400, 1.3f, p.ink), Modifier.weight(1f))
                        Txt(fmtTime(lg.due), body(15, 400, 1.3f, p.soft))
                    }
                }
            }
        }
    }
    if (!page) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Txt(title, body(18, 700, 1.3f, p.ink), Modifier.padding(horizontal = 4.dp).semantics { heading() })
            content()
        }
        return
    }
    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = if (l.narrow) 12.dp else 16.dp).padding(top = top + 8.dp, bottom = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Column(Modifier.widthIn(max = 640.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                IconBtn(Ic.Back, "Back to history", tone = null) { Nav.pop() }
                Txt(title, display(24, 800, 1.15f, p.ink), Modifier.weight(1f).semantics { heading() })
            }
            content()
            val prev = addDays(day, -1)
            Btn(fmtDay(prev, "EEEE"), Modifier.fillMaxWidth(), Kind.Ghost, icon = Ic.Back) { Nav.replace(Route.Day(prev)) }
        }
    }
}

