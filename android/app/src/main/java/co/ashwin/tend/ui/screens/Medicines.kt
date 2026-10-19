package co.ashwin.tend.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import co.ashwin.tend.core.Medicine
import co.ashwin.tend.core.courseDay
import co.ashwin.tend.core.dayKey
import co.ashwin.tend.core.doseLine
import co.ashwin.tend.core.fmtNum
import co.ashwin.tend.core.shortSchedule
import co.ashwin.tend.core.stockInfo
import co.ashwin.tend.ui.Btn
import co.ashwin.tend.ui.H2
import co.ashwin.tend.ui.Ic
import co.ashwin.tend.ui.Icon
import co.ashwin.tend.ui.LocalLayout
import co.ashwin.tend.ui.LocalPalette
import co.ashwin.tend.ui.Mood
import co.ashwin.tend.ui.Nav
import co.ashwin.tend.ui.Over
import co.ashwin.tend.ui.PillChip
import co.ashwin.tend.ui.Pip
import co.ashwin.tend.ui.Route
import co.ashwin.tend.ui.Txt
import co.ashwin.tend.ui.body
import co.ashwin.tend.ui.display
import co.ashwin.tend.ui.rememberStored
import co.ashwin.tend.ui.softShadow
import co.ashwin.tend.ui.tap

@Composable
fun MedicinesScreen(top: Dp, selected: String? = null) {
    val p = LocalPalette.current
    val s = rememberStored()
    val l = LocalLayout.current
    var showArchived by remember { mutableStateOf(false) }
    val active = s.meds.filter { !it.isArchived }
    val archived = s.meds.filter { it.isArchived }
    Box(Modifier.fillMaxSize()) {
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState())
                .padding(horizontal = if (l.narrow) 12.dp else if (l.phone) 16.dp else 32.dp)
                .padding(top = top + 12.dp, bottom = if (l.phone) 104.dp else 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Column(Modifier.widthIn(max = 800.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                Row(Modifier.heightIn(min = 44.dp).padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Txt("Medicines", display(if (l.phone) 32 else 40, 800, 1.1f, p.ink), Modifier.weight(1f).semantics { heading() })
                    if (!l.phone && active.isNotEmpty()) Btn("Add medicine", kind = co.ashwin.tend.ui.Kind.Primary, small = true, icon = Ic.Plus) { Nav.open(Over.Editor(null)) }
                }
                if (active.isEmpty()) {
                    Column(
                        Modifier.fillMaxWidth().background(p.pipWash, RoundedCornerShape(28.dp)).padding(horizontal = 24.dp, vertical = 40.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Pip(Mood.Idle, size = 112.dp, poke = true)
                        Txt("No medicines yet", display(22, 800, 1.2f, p.ink), Modifier.semantics { heading() })
                        Txt("Add one and it shows up on Today at the right time.", body(16, 400, 1.4f, p.soft).copy(textAlign = TextAlign.Center))
                        Btn("Add a medicine", Modifier.padding(top = 4.dp)) { Nav.open(Over.Editor(null)) }
                    }
                } else Column(verticalArrangement = Arrangement.spacedBy(8.dp)) { active.forEach { MedCard(it, it.id == selected) } }
                if (archived.isNotEmpty()) {
                    val turn by animateFloatAsState(if (showArchived) 90f else 0f, tween(200), label = "turn")
                    Row(
                        Modifier.heightIn(min = 44.dp).tap(sink = 0.98f) { showArchived = !showArchived }
                            .semantics(mergeDescendants = true) { stateDescription = if (showArchived) "Expanded" else "Collapsed" },
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        H2("Archived · ${archived.size}")
                        Icon(Ic.Next, p.soft, Modifier.graphicsLayer { rotationZ = turn }, size = 18.dp)
                    }
                    AnimatedVisibility(showArchived) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) { archived.forEach { MedCard(it, it.id == selected) } }
                    }
                }
            }
        }
        // The add button sits in the thumb zone on phones.
        if (l.phone && active.isNotEmpty()) {
            Btn(
                "Add medicine",
                Modifier.align(Alignment.BottomEnd).padding(16.dp).softShadow(RoundedCornerShape(18.dp)),
                icon = Ic.Plus,
            ) { Nav.open(Over.Editor(null)) }
        }
    }
}

@Composable
private fun MedCard(med: Medicine, selected: Boolean) {
    val p = LocalPalette.current
    val s = rememberStored()
    val today = dayKey()
    val info = stockInfo(med, s.settings.routines, today)
    val c = courseDay(med, today)
    val l = LocalLayout.current
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 72.dp)
            .alpha(if (med.isArchived) 0.7f else 1f)
            .tap(sink = 0.98f) { if (l.panel && Nav.current is Route.Medicine) Nav.replace(Route.Medicine(med.id)) else Nav.push(Route.Medicine(med.id)) }
            .semantics { this.selected = selected }
            .softShadow(RoundedCornerShape(22.dp))
            .background(p.card, RoundedCornerShape(22.dp))
            .then(if (selected) Modifier.border(2.dp, p.pip, RoundedCornerShape(22.dp)) else Modifier)
            .padding(start = 12.dp, end = 16.dp, top = 12.dp, bottom = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        PillChip(med.look, med.form, size = 48.dp, pill = 28.dp)
        Column(Modifier.weight(1f)) {
            Txt(med.name, display(17, 700, 1.2f, p.ink))
            Txt(doseLine(med, false), body(14, 400, 1.35f, p.soft))
            Txt(shortSchedule(med.schedule) + (c?.total?.let { " · day ${c.n} of $it" } ?: ""), body(13, 400, 1.35f, p.soft), Modifier.padding(top = 2.dp))
        }
        if (info != null) {
            Column(horizontalAlignment = Alignment.End) {
                Txt("${fmtNum(info.count)} left", body(14, if (info.low) 700 else 400, 1.3f, if (info.low) p.ink else p.soft), lines = 1)
                if (info.low) Txt("refill soon", body(12, 600, 1.3f, p.soft), lines = 1)
            }
        }
        Icon(Ic.Next, p.soft, size = 20.dp)
    }
}

