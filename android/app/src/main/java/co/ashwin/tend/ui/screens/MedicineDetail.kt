package co.ashwin.tend.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import co.ashwin.tend.core.DoseStatus
import co.ashwin.tend.core.Medicine
import co.ashwin.tend.core.addDays
import co.ashwin.tend.core.anchorText
import co.ashwin.tend.core.courseDay
import co.ashwin.tend.core.dayKey
import co.ashwin.tend.core.deleteMed
import co.ashwin.tend.core.doseLine
import co.ashwin.tend.core.dosesOn
import co.ashwin.tend.core.fmtNum
import co.ashwin.tend.core.fmtTime
import co.ashwin.tend.core.latestLog
import co.ashwin.tend.core.medicineDose
import co.ashwin.tend.core.nowKey
import co.ashwin.tend.core.putMed
import co.ashwin.tend.core.relDay
import co.ashwin.tend.core.scheduleText
import co.ashwin.tend.core.stockInfo
import co.ashwin.tend.data.Repo
import co.ashwin.tend.ui.ActionSheet
import co.ashwin.tend.ui.Btn
import co.ashwin.tend.ui.CardBox
import co.ashwin.tend.ui.Ic
import co.ashwin.tend.ui.IconBtn
import co.ashwin.tend.ui.Kind
import co.ashwin.tend.ui.LocalLayout
import co.ashwin.tend.ui.LocalPalette
import co.ashwin.tend.ui.Mood
import co.ashwin.tend.ui.Nav
import co.ashwin.tend.ui.Over
import co.ashwin.tend.ui.Pill
import co.ashwin.tend.ui.Pip
import co.ashwin.tend.ui.RefillButton
import co.ashwin.tend.ui.SheetAction
import co.ashwin.tend.ui.Txt
import co.ashwin.tend.ui.body
import co.ashwin.tend.ui.display
import co.ashwin.tend.ui.rememberNow
import co.ashwin.tend.ui.rememberStored
import co.ashwin.tend.ui.toast
import kotlin.math.roundToInt

/** A medicine's page. In a side panel on tablets, it has no back button and no page padding. */
@Composable
fun MedicineDetail(id: String?, top: Dp, inPanel: Boolean = false) {
    val p = LocalPalette.current
    val s = rememberStored()
    val med = id?.let { i -> s.meds.find { it.id == i } }
    if (med == null) {
        if (inPanel) {
            if (s.meds.isNotEmpty()) Column(Modifier.fillMaxWidth().padding(top = 80.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Pip(Mood.Idle, size = 96.dp)
                Txt("Pick a medicine to see its schedule, stock and history.", body(16, 400, 1.4f, p.soft).copy(textAlign = TextAlign.Center), Modifier.widthIn(max = 240.dp))
            }
            return
        }
        Column(Modifier.fillMaxSize().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically)) {
            Pip(Mood.Lost, size = 128.dp)
            Txt("That medicine isn't here", display(26, 800, 1.15f, p.ink).copy(textAlign = TextAlign.Center), Modifier.semantics { heading() })
            Btn("All medicines") { Nav.pop() }
        }
        return
    }
    Detail(med, top, inPanel)
}

@Composable
private fun Detail(med: Medicine, top: Dp, inPanel: Boolean) {
    val p = LocalPalette.current
    val s = rememberStored()
    val now = rememberNow()
    val l = LocalLayout.current
    var menu by remember { mutableStateOf(false) }
    val today = dayKey(now)
    val info = stockInfo(med, s.settings.routines, today)
    val c = courseDay(med, today)
    val strip = remember(med, s.logs, s.settings.routines, now) {
        val nk = nowKey(now)
        (0 until 14).map { i ->
            val day = addDays(today, i - 13)
            val doses = dosesOn(listOf(med), s.settings.routines, day).filter { it.due <= nk }
            day to (doses.size to doses.count { latestLog(s.logs, med.id, it.due)?.status == DoseStatus.Taken })
        }
    }
    val total = strip.sumOf { it.second.first }
    val taken = strip.sumOf { it.second.second }
    val recent = s.logs.filter { it.medId == med.id && it.status != DoseStatus.Snoozed }
        .sortedByDescending { it.at ?: it.due }.take(6)

    fun archive() {
        val (d, undo) = putMed(Repo.now.data, med.copy(archived = if (med.isArchived) null else true))
        Repo.update { it.copy(meds = d.meds) }
        toast(if (med.isArchived) "${med.name} is back" else "${med.name} archived") { Repo.edit(undo) }
    }

    fun remove() {
        val (d, undo) = deleteMed(Repo.now.data, med.id)
        Nav.pop()
        Repo.update { it.copy(meds = d.meds, logs = d.logs) }
        toast("${med.name} deleted") { Repo.edit(undo) }
    }

    val body: @Composable () -> Unit = {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            if (!inPanel) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    IconBtn(Ic.Back, "Back to medicines", tone = null) { Nav.pop() }
                    IconBtn(Ic.More, "More options", tone = null) { menu = true }
                }
            }
            CardBox(padding = 20.dp) {
                Row(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.Top) {
                    Box(Modifier.size(80.dp).background(p.milk, RoundedCornerShape(24.dp)), contentAlignment = Alignment.Center) { Pill(med.look, med.form, 50.dp) }
                    Column(Modifier.weight(1f).padding(top = 4.dp)) {
                        Txt(med.name, display(28, 800, 1.15f, p.ink), Modifier.semantics { heading() })
                        Txt(doseLine(med), body(16, 400, 1.4f, p.soft))
                    }
                    if (inPanel) IconBtn(Ic.More, "More options", tone = null) { menu = true }
                }
                Txt(scheduleText(med.schedule), body(16, 600, 1.4f, p.ink))
                val at = med.schedule.anchors
                if (at != null && at.any { it.amount != null }) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        at.forEach { a ->
                            Row(Modifier.fillMaxWidth().background(p.milk, RoundedCornerShape(14.dp)).padding(horizontal = 12.dp, vertical = 8.dp)) {
                                Txt(anchorText(a), body(14, 400, 1.35f, p.ink), Modifier.weight(1f))
                                Txt(medicineDose(med, a.amount ?: med.amount), body(14, 700, 1.35f, p.ink), lines = 1)
                            }
                        }
                    }
                }
                c?.total?.let { tot ->
                    Txt("Course: day ${c.n.coerceIn(1, tot)} of $tot${c.end?.let { ", ends ${relDay(it, today)}" } ?: ""}", body(16, 400, 1.4f, p.soft))
                }
                if (med.isArchived) Txt("Archived. It won't remind you.", body(16, 600, 1.4f, p.soft))
                Btn("Edit", Modifier.padding(top = 4.dp), Kind.Soft, icon = Ic.Edit) { Nav.open(Over.Editor(med.id)) }
            }
            if (info != null) CardBox {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    if (info.low) Pip(Mood.Low, size = 48.dp)
                    Column(Modifier.weight(1f)) {
                        Txt("${fmtNum(info.count)} left", body(17, 700, 1.3f, p.ink))
                        Txt((info.days?.let { "About $it days at this pace" } ?: "Only when needed") + if (info.low) ". Time to refill." else "", body(15, 400, 1.4f, p.soft))
                    }
                    RefillButton(med)
                }
            }
            CardBox {
                Row(verticalAlignment = Alignment.Bottom) {
                    Txt("Last two weeks", body(17, 700, 1.3f, p.ink), Modifier.weight(1f).semantics { heading() })
                    if (total > 0) Txt("${(taken * 100f / total).roundToInt()}% taken", body(15, 400, 1.3f, p.soft))
                }
                Row(
                    Modifier.fillMaxWidth().semantics(mergeDescendants = true) {
                        contentDescription = if (total > 0) "$taken of $total doses taken in the last two weeks" else "No doses due in the last two weeks"
                    },
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    strip.forEach { (_, d) ->
                        val (n, t) = d
                        val shape = RoundedCornerShape(6.dp)
                        Box(
                            Modifier.weight(1f).height(32.dp).then(
                                if (n > 0) Modifier.background(lerp(p.line, p.pip, t.toFloat() / n), shape)
                                else Modifier.border(1.5.dp, p.line, shape),
                            ),
                        )
                    }
                }
                if (recent.isNotEmpty()) Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    recent.forEach { lg ->
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Txt("${relDay(lg.due.take(10), today).replaceFirstChar { it.uppercase() }}, ${fmtTime(lg.due)}", body(15, 400, 1.4f, p.soft), Modifier.weight(1f))
                            Txt(
                                if (lg.status == DoseStatus.Taken) "${medicineDose(med, lg.amount ?: med.amount)} · Taken ${lg.at?.let { fmtTime(it) } ?: ""}".trim() else "Skipped",
                                body(15, 400, 1.4f, p.ink),
                            )
                        }
                    }
                }
            }
            med.notes?.let { notes ->
                CardBox {
                    Txt("Notes", body(17, 700, 1.3f, p.ink))
                    Txt(notes, body(16, 400, 1.45f, p.soft))
                }
            }
        }
    }
    if (inPanel) body() else Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = if (l.narrow) 12.dp else 16.dp).padding(top = top + 8.dp, bottom = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) { Box(Modifier.widthIn(max = 640.dp).fillMaxWidth()) { body() } }

    ActionSheet(
        open = menu,
        onClose = { menu = false },
        title = med.name,
        actions = listOf(
            SheetAction("Edit", Ic.Edit) { Nav.open(Over.Editor(med.id)) },
            SheetAction(if (med.isArchived) "Bring back" else "Archive", Ic.Archive) { archive() },
            SheetAction("Delete", Ic.Trash, danger = true) { remove() },
        ),
    )
}

