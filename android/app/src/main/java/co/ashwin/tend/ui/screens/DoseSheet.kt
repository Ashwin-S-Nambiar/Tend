package co.ashwin.tend.ui.screens

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.toggleableState
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import co.ashwin.tend.core.FOOD_TEXT
import co.ashwin.tend.core.GroupState
import co.ashwin.tend.core.Slot
import co.ashwin.tend.core.clock
import co.ashwin.tend.core.courseDay
import co.ashwin.tend.core.doseState
import co.ashwin.tend.core.dueDate
import co.ashwin.tend.core.dueParts
import co.ashwin.tend.core.findSlot
import co.ashwin.tend.core.fmtTime
import co.ashwin.tend.core.logged
import co.ashwin.tend.core.medById
import co.ashwin.tend.core.nowKey
import co.ashwin.tend.core.pending
import co.ashwin.tend.core.relDay
import co.ashwin.tend.core.skip
import co.ashwin.tend.core.snooze
import co.ashwin.tend.core.take
import co.ashwin.tend.core.unlog
import co.ashwin.tend.data.Repo
import co.ashwin.tend.feel.Feels
import co.ashwin.tend.feel.Haptic
import co.ashwin.tend.ui.Btn
import co.ashwin.tend.ui.Ic
import co.ashwin.tend.ui.Icon
import co.ashwin.tend.ui.Kind
import co.ashwin.tend.ui.LocalPalette
import co.ashwin.tend.ui.MedRow
import co.ashwin.tend.ui.Mood
import co.ashwin.tend.ui.Pip
import co.ashwin.tend.ui.Sheet
import co.ashwin.tend.ui.TimeSheet
import co.ashwin.tend.ui.Txt
import co.ashwin.tend.ui.body
import co.ashwin.tend.ui.display
import co.ashwin.tend.ui.rememberNow
import co.ashwin.tend.ui.rememberStored
import co.ashwin.tend.ui.tap

/** The dose sheet: choose which medicines, then Taken, Snooze, Log time or Skip. */
@Composable
fun DoseSheet(due: String, onDone: () -> Unit) {
    val s = rememberStored()
    val now = rememberNow()
    // The sheet keeps the slot it opened with, so "next" doesn't jump to another group after logging.
    val key = remember(due) { mutableStateOf<String?>(null) }
    val slot = remember(s, now, due, key.value) {
        findSlot(s.meds, s.settings.routines, s.logs, key.value ?: due, now)
    }
    if (key.value == null && slot != null) key.value = slot.key
    var open by remember { mutableStateOf(true) }
    var off by remember { mutableStateOf(setOf<String>()) }
    var late by remember { mutableStateOf(false) }
    val close = { open = false }
    val p = LocalPalette.current
    Sheet(
        open = open,
        onClose = close,
        onClosed = onDone,
        label = slot?.let { "${it.label} dose" } ?: "Dose not found",
        header = { if (slot != null) Head(slot) },
        footer = {
            if (slot != null) {
                val nk = nowKey()
                val pending = slot.doses.filter { doseState(s.logs, it, nk).pending }
                val chosen = pending.filter { it.medId !in off }
                if (pending.isEmpty()) {
                    Btn("Done", Modifier.fillMaxWidth(), Kind.Soft) { close() }
                } else {
                    val n = pending.size
                    var label = if (chosen.size == n) when (n) {
                        1 -> "Taken"
                        2 -> "Taken, both"
                        else -> "Taken, all $n"
                    } else "Taken, ${chosen.size} of $n"
                    val upcoming = slot.state == GroupState.Upcoming
                    if (upcoming) label = label.replace("Taken", "Take early")
                    Btn(
                        label,
                        Modifier.fillMaxWidth(),
                        if (upcoming) Kind.Soft else Kind.Primary,
                        enabled = chosen.isNotEmpty(),
                        label = "$label. Long-press for taken at another time",
                        onLongClick = { late = true },
                    ) { act(take(Repo.now.data, chosen, slot.label)); close() }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        SmallAction("Snooze", "10 min", "Snooze for 10 minutes", Modifier.weight(1f)) {
                            act(snooze(Repo.now.data, slot.group, 10)); close()
                        }
                        SmallAction("Log time", null, "Log dose at another time", Modifier.weight(1f)) { late = true }
                        SmallAction("Skip", null, "Skip", Modifier.weight(1f), enabled = chosen.isNotEmpty()) {
                            act(skip(Repo.now.data, chosen, slot.label)); close()
                        }
                    }
                    TimeSheet(
                        open = late,
                        onClose = { late = false },
                        title = "When did you take them?",
                        defaultTime = dueParts(slot.key).time,
                        day = slot.day,
                        dueKey = slot.key,
                    ) { t -> act(take(Repo.now.data, chosen, slot.label, "${slot.day}T$t")); close() }
                }
            }
        },
    ) {
        if (slot == null) {
            Column(Modifier.fillMaxWidth().padding(vertical = 24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Pip(Mood.Lost, size = 112.dp)
                Txt("This dose moved", display(24, 800, 1.15f, p.ink).copy(textAlign = TextAlign.Center), Modifier.semantics { heading() })
                Txt("It isn't on your schedule any more. Today has the latest.", body(16, 400, 1.4f, p.soft).copy(textAlign = TextAlign.Center))
                Btn("Back to today", Modifier.padding(top = 12.dp)) { close() }
            }
        } else {
            val nk = nowKey()
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                slot.doses.forEachIndexed { i, d ->
                    val med = medById(s.meds, d.medId) ?: return@forEachIndexed
                    val st = doseState(s.logs, d, nk)
                    val log = s.logs.lastOrNull { it.medId == d.medId && it.due == d.due }
                    val c = courseDay(med, slot.day)
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        MedRow(
                            med,
                            Modifier.weight(1f),
                            amount = log?.amount ?: d.amount,
                            milk = true,
                            withFood = false,
                            index = i,
                            state = if (st.logged) st else null,
                            extra = if (st.logged && log?.at != null && st == co.ashwin.tend.core.DoseState.Taken) "taken ${fmtTime(log.at)}"
                            else listOfNotNull(med.food?.let { FOOD_TEXT[it] }, c?.total?.let { "day ${c.n} of $it" }).joinToString(" · ").ifEmpty { null },
                        )
                        if (st.logged) {
                            Btn("Clear", kind = Kind.Soft, small = true, label = "Clear ${med.name}") { act(unlog(Repo.now.data, d)) }
                        } else {
                            val on = d.medId !in off
                            val bg by animateColorAsState(if (on) p.pipDeep else p.milk, tween(150), label = "box")
                            Box(
                                Modifier
                                    .size(56.dp)
                                    .tap(role = Role.Checkbox) {
                                        Feels.haptic(Haptic.Tick)
                                        off = if (on) off + d.medId else off - d.medId
                                    }
                                    .semantics { toggleableState = ToggleableState(on); contentDescription = "Include ${med.name}" }
                                    .background(p.milk, RoundedCornerShape(16.dp)),
                                contentAlignment = Alignment.Center,
                            ) {
                                Box(
                                    Modifier.size(28.dp).background(bg, RoundedCornerShape(9.dp))
                                        .then(if (on) Modifier else Modifier.border(2.dp, p.lineStrong, RoundedCornerShape(9.dp))),
                                    contentAlignment = Alignment.Center,
                                ) { if (on) Icon(Ic.Check, p.onPip, size = 18.dp, stroke = 2.6f) }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Head(slot: Slot) {
    val p = LocalPalette.current
    val s = rememberStored()
    val n = slot.doses.size
    val first = medById(s.meds, slot.doses.first().medId)
    val overdue = slot.state == GroupState.Due && clock().toEpochMilli() - dueDate(slot.key).toEpochMilli() > 30 * 60_000
    val whenText = relDay(slot.day)
    Row(Modifier.padding(top = 4.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Pip(
            when {
                slot.state == GroupState.Done -> Mood.Taken
                overdue -> Mood.Nudge
                slot.state == GroupState.Due -> Mood.Due
                else -> Mood.Idle
            },
            size = 76.dp,
            poke = true,
        )
        Column(Modifier.weight(1f)) {
            Txt(
                "${slot.label} · ${if (slot.state == GroupState.Upcoming) "at" else "due"} ${fmtTime(slot.key)}${if (whenText == "today") "" else ", $whenText"}",
                display(14, 700, 1.25f, p.pipInk),
            )
            Txt(
                when {
                    slot.state == GroupState.Done -> "All logged"
                    n == 1 -> "Time for ${first?.name ?: "your medicine"}"
                    else -> "Time for $n medicines"
                },
                display(26, 800, 1.08f, p.ink),
                Modifier.semantics { heading() },
            )
        }
    }
}

@Composable
private fun SmallAction(title: String, sub: String?, label: String, modifier: Modifier, enabled: Boolean = true, onClick: () -> Unit) {
    val p = LocalPalette.current
    Column(
        modifier
            .heightIn(min = 56.dp)
            .tap(enabled, label = label, onClick = onClick)
            .semantics(mergeDescendants = true) { contentDescription = label }
            .background(p.milk, RoundedCornerShape(14.dp))
            .padding(horizontal = 6.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Txt(title, display(15, 700, 1.2f, p.ink.copy(alpha = if (enabled) 1f else 0.5f)).copy(textAlign = TextAlign.Center))
        sub?.let { Txt(it, body(12, 500, 1.2f, p.soft)) }
    }
}

