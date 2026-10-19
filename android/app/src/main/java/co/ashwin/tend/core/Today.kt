package co.ashwin.tend.core

import java.time.Instant

// Ported from src/lib/today.ts, without the React hook.

data class Slot(val group: Group, val state: GroupState, val until: String?) {
    val key get() = group.key
    val day get() = group.day
    val label get() = group.label
    val scene get() = group.scene
    val doses get() = group.doses
}

fun slotsOn(meds: List<Medicine>, routines: List<Routine>, logs: List<DoseLog>, day: String, now: Instant): List<Slot> {
    val groups = groupsOn(meds, routines, day)
    val nk = nowKey(now)
    return groups.mapIndexed { i, g ->
        Slot(g, groupState(g, logs, now, groups.getOrNull(i + 1)), snoozedUntil(g, logs, nk))
    }
}

data class Progress(val total: Int, val done: Int)

fun progress(slots: List<Slot>, logs: List<DoseLog>, now: Instant): Progress {
    val nk = nowKey(now)
    var total = 0
    var done = 0
    for (s in slots) for (d in s.doses) {
        total += 1
        if (doseState(logs, d, nk).logged) done += 1
    }
    return Progress(total, done)
}

data class PrnRow(val med: Medicine, val state: PrnState?)
data class StockRow(val med: Medicine, val info: StockInfo)
data class CourseRow(val med: Medicine, val day: CourseDay)

data class TodayModel(
    val now: Instant,
    val today: String,
    val meds: List<Medicine>,
    val slots: List<Slot>,
    val focus: Slot?,
    val later: List<Slot>,
    val past: List<Slot>,
    val prn: List<PrnRow>,
    val stock: List<StockRow>,
    val low: List<StockRow>,
    val courses: List<CourseRow>,
    val progress: Progress,
    val night: Boolean,
    val allDone: Boolean,
    val next: Group?,
) {
    val empty get() = meds.isEmpty()
}

fun today(allMeds: List<Medicine>, routines: List<Routine>, logs: List<DoseLog>, now: Instant): TodayModel {
    val today = dayKey(now)
    val active = allMeds.filter { !it.isArchived }
    val slots = slotsOn(active, routines, logs, today, now)
    val focus = slots.find { it.state == GroupState.Due }
        ?: slots.find { it.state == GroupState.Snoozed }
        ?: slots.find { it.state == GroupState.Upcoming }
    val later = slots.filter { it != focus && (it.state == GroupState.Upcoming || it.state == GroupState.Snoozed) }
    val past = slots.filter { it != focus && (it.state == GroupState.Done || it.state == GroupState.Unlogged) }
    val prn = active.filter { it.schedule is Schedule.Prn }.map { PrnRow(it, prnState(it, logs, now)) }
    val stock = active.mapNotNull { m -> stockInfo(m, routines, today)?.let { StockRow(m, it) } }
    val courses = active.mapNotNull { m -> courseDay(m, today)?.takeIf { it.total != null }?.let { CourseRow(m, it) } }
    val bedSlot = slots.lastOrNull { it.scene == Scene.Night }
    val allDone = slots.isNotEmpty() && slots.all { it.state == GroupState.Done || it.state == GroupState.Unlogged }
    val night = allDone && (bedSlot?.let { it.state == GroupState.Done } ?: (nowKey(now).drop(11) >= "21:00"))
    return TodayModel(
        now = now,
        today = today,
        meds = active,
        slots = slots,
        focus = focus,
        later = later,
        past = past,
        prn = prn,
        stock = stock,
        low = stock.filter { it.info.low },
        courses = courses,
        progress = progress(slots, logs, now),
        night = night,
        allDone = allDone,
        next = nextGroup(active, routines, logs, now),
    )
}

fun medById(meds: List<Medicine>, id: String) = meds.find { it.id == id }

/** The slot a dose route points at: a group key, a dose due key, or "next". */
fun findSlot(meds: List<Medicine>, routines: List<Routine>, logs: List<DoseLog>, due: String, now: Instant): Slot? {
    val active = meds.filter { !it.isArchived }
    if (due == "next") {
        val todays = slotsOn(active, routines, logs, nowKey(now).take(10), now)
        todays.find { it.state == GroupState.Due }?.let { return it }
        todays.find { it.state == GroupState.Snoozed }?.let { return it }
        val g = nextGroup(active, routines, logs, now) ?: return null
        return slotsOn(active, routines, logs, g.day, now).find { it.key == g.key }
    }
    val slots = slotsOn(active, routines, logs, dueParts(due).day, now)
    return slots.find { it.key == due } ?: slots.find { s -> s.doses.any { it.due == due } }
}

/** Seven days ending today, newest last, with logging progress for each. */
data class WeekDay(val day: String, val future: Boolean, val today: Boolean, val total: Int, val done: Int)

fun lastDays(meds: List<Medicine>, routines: List<Routine>, logs: List<DoseLog>, now: Instant, endOffsetWeeks: Int = 0): List<WeekDay> {
    val today = dayKey(now)
    val end = addDays(today, endOffsetWeeks * 7)
    return (6 downTo 0).map { back ->
        val day = addDays(end, -back)
        val future = day > today
        val slots = if (future) emptyList() else slotsOn(meds, routines, logs, day, if (day == today) now else dueDate("${day}T23:59"))
        val p = progress(slots, logs, now)
        WeekDay(day, future, day == today, p.total, p.done)
    }
}

fun joinNames(xs: List<String>): String =
    if (xs.size < 2) xs.joinToString("") else xs.dropLast(1).joinToString(", ") + " and " + xs.last()
