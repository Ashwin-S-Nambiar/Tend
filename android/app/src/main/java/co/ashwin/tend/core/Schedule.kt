package co.ashwin.tend.core

import java.time.Instant
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

// Ported from src/lib/schedule.ts.

val ROUTINE_ORDER = listOf(RoutineId.Wake, RoutineId.Breakfast, RoutineId.Lunch, RoutineId.Dinner, RoutineId.Bed)

val DEFAULT_ROUTINES = listOf(
    Routine(RoutineId.Wake, "07:00"),
    Routine(RoutineId.Breakfast, "08:00"),
    Routine(RoutineId.Lunch, "13:30"),
    Routine(RoutineId.Dinner, "20:30"),
    Routine(RoutineId.Bed, "22:30"),
)

val ROUTINE_NAME = mapOf(
    RoutineId.Wake to "Wake up",
    RoutineId.Breakfast to "Breakfast",
    RoutineId.Lunch to "Lunch",
    RoutineId.Dinner to "Dinner",
    RoutineId.Bed to "Bedtime",
)

val ROUTINE_SCENE = mapOf(
    RoutineId.Wake to Scene.Morning,
    RoutineId.Breakfast to Scene.Morning,
    RoutineId.Lunch to Scene.Afternoon,
    RoutineId.Dinner to Scene.Evening,
    RoutineId.Bed to Scene.Night,
)

val SCENE_NAME = mapOf(
    Scene.Morning to "Morning",
    Scene.Afternoon to "Afternoon",
    Scene.Evening to "Evening",
    Scene.Night to "Bedtime",
)

fun sceneAt(min: Int): Scene = when {
    min < 12 * 60 -> Scene.Morning
    min < 17 * 60 -> Scene.Afternoon
    min < 21 * 60 -> Scene.Evening
    else -> Scene.Night
}

fun routineTime(routines: List<Routine>, id: RoutineId, day: String): String {
    val r = routines.find { it.id == id } ?: DEFAULT_ROUTINES.find { it.id == id } ?: return "08:00"
    return if (isWeekend(day) && r.weekend != null) r.weekend else r.weekday
}

fun anchorMin(anchor: Anchor, routines: List<Routine>, day: String): Int = when (anchor) {
    is Anchor.AtTime -> toMin(anchor.time)
    is Anchor.AtRoutine -> toMin(routineTime(routines, anchor.routine, day)) + anchor.offsetMin
}

fun courseEnd(course: Course): String? = course.end ?: course.days?.let { addDays(course.start, it - 1) }

data class CourseDay(val n: Int, val total: Int?, val end: String?)

fun courseDay(med: Medicine, day: String): CourseDay? {
    val c = med.course ?: return null
    val end = courseEnd(c)
    return CourseDay(dayDiff(c.start, day) + 1, end?.let { dayDiff(c.start, it) + 1 }, end)
}

fun activeOn(med: Medicine, day: String): Boolean {
    if (med.isArchived) return false
    if (dayDiff(med.created.take(10), day) < 0) return false
    med.course?.let { c ->
        if (dayDiff(c.start, day) < 0) return false
        val end = courseEnd(c)
        if (end != null && dayDiff(day, end) < 0) return false
    }
    return true
}

fun scheduledOn(schedule: Schedule, day: String): Boolean = when (schedule) {
    is Schedule.Daily -> true
    is Schedule.Weekdays -> weekday(day) in schedule.days
    is Schedule.Interval -> {
        val d = dayDiff(schedule.start, day)
        d >= 0 && d % max(1, schedule.everyDays) == 0
    }
    is Schedule.Cycle -> {
        val d = dayDiff(schedule.start, day)
        d >= 0 && d % max(1, schedule.on + schedule.off) < schedule.on
    }
    is Schedule.Once -> dueParts(schedule.`when`).day == day
    is Schedule.Prn -> false
}

data class Dose(val medId: String, val due: String, val routine: RoutineId? = null, val amount: Double? = null)

private fun Int.floorMod(n: Int) = ((this % n) + n) % n

fun dosesOn(meds: List<Medicine>, routines: List<Routine>, day: String): List<Dose> {
    val out = mutableListOf<Dose>()
    for (med in meds) {
        val s = med.schedule
        if (med.isArchived || s is Schedule.Prn) continue
        if (s is Schedule.Once) {
            if (activeOn(med, day) && scheduledOn(s, day)) out += Dose(med.id, s.`when`, amount = med.amount)
            continue
        }
        val seen = mutableSetOf<String>()
        val since = nowKey(dueDate(med.created.take(16)).minusSeconds(2 * 3600))
        for (shift in listOf(-1, 0, 1)) {
            val source = addDays(day, shift)
            if (!activeOn(med, source) || !scheduledOn(s, source)) continue
            for (anchor in s.anchors.orEmpty()) {
                val m = anchorMin(anchor, routines, source)
                val date = addDays(source, floor(m / 1440.0).toInt())
                if (date != day) continue
                val due = dueKey(date, fromMin(m.floorMod(1440)))
                if (due in seen || due < since) continue
                seen += due
                out += Dose(
                    med.id,
                    due,
                    (anchor as? Anchor.AtRoutine)?.routine,
                    anchor.amount ?: med.amount,
                )
            }
        }
    }
    return out.sortedBy { it.due }
}

data class Group(
    val key: String,
    val day: String,
    val routine: RoutineId?,
    val scene: Scene,
    val label: String,
    val doses: List<Dose>,
)

fun groupsOn(meds: List<Medicine>, routines: List<Routine>, day: String): List<Group> {
    val by = LinkedHashMap<String, Group>()
    for (dose in dosesOn(meds, routines, day)) {
        val time = dueParts(dose.due).time
        val g = by[time]
        if (g != null) {
            by[time] = g.copy(doses = g.doses + dose, key = minOf(g.key, dose.due))
            continue
        }
        val scene = dose.routine?.let { ROUTINE_SCENE.getValue(it) } ?: sceneAt(toMin(time))
        by[time] = Group(dose.due, day, dose.routine, scene, SCENE_NAME.getValue(scene), listOf(dose))
    }
    val merged = LinkedHashMap<String, Group>()
    for (g in by.values.sortedBy { it.key }) {
        val same = merged[g.key]
        merged[g.key] = same?.copy(doses = same.doses + g.doses, routine = same.routine ?: g.routine) ?: g
    }
    val groups = merged.values.toList()
    val counts = groups.groupingBy { it.label }.eachCount()
    return groups.map { g ->
        if ((counts[g.label] ?: 0) > 1 && g.routine != null) g.copy(label = ROUTINE_NAME.getValue(g.routine)) else g
    }
}

fun latestLog(logs: List<DoseLog>, medId: String, due: String): DoseLog? =
    logs.lastOrNull { it.medId == medId && it.due == due }

enum class DoseState { Taken, Skipped, Snoozed, Open }

fun doseState(logs: List<DoseLog>, dose: Dose, now: String): DoseState {
    val l = latestLog(logs, dose.medId, dose.due) ?: return DoseState.Open
    return when (l.status) {
        DoseStatus.Snoozed -> if (l.snoozeUntil != null && l.snoozeUntil > now) DoseState.Snoozed else DoseState.Open
        DoseStatus.Taken -> DoseState.Taken
        DoseStatus.Skipped -> DoseState.Skipped
    }
}

val DoseState.logged get() = this == DoseState.Taken || this == DoseState.Skipped
val DoseState.pending get() = this == DoseState.Open || this == DoseState.Snoozed

enum class GroupState { Upcoming, Due, Done, Unlogged, Snoozed }

fun windowEnd(group: Group, next: Group?): Instant {
    val start = dueDate(group.key)
    val twoH = start.plusSeconds(2 * 3600)
    val nextAt = next?.let { dueDate(it.key) } ?: Instant.MAX
    return maxOf(start.plusSeconds(45 * 60), minOf(twoH, nextAt))
}

fun groupState(group: Group, logs: List<DoseLog>, now: Instant, next: Group? = null): GroupState {
    val nk = nowKey(now)
    val states = group.doses.map { doseState(logs, it, nk) }
    if (states.all { it.logged }) return GroupState.Done
    if (nk < group.key) return GroupState.Upcoming
    if (DoseState.Snoozed in states && DoseState.Open !in states) return GroupState.Snoozed
    if (!now.isBefore(windowEnd(group, next))) return GroupState.Unlogged
    return GroupState.Due
}

fun snoozedUntil(group: Group, logs: List<DoseLog>, now: String): String? {
    var until: String? = null
    for (d in group.doses) {
        val l = latestLog(logs, d.medId, d.due)
        if (l?.status == DoseStatus.Snoozed && l.snoozeUntil != null && l.snoozeUntil > now) {
            if (until == null || l.snoozeUntil > until) until = l.snoozeUntil
        }
    }
    return until
}

data class PrnState(val todayCount: Int, val last: String?, val nextAt: String?, val full: Boolean) {
    val canTake get() = nextAt == null && !full
}

fun prnState(med: Medicine, logs: List<DoseLog>, now: Instant): PrnState? {
    val s = med.schedule as? Schedule.Prn ?: return null
    val nk = nowKey(now)
    val today = nk.take(10)
    val taken = logs.filter { it.medId == med.id && it.status == DoseStatus.Taken }.map { it.at ?: it.due }.sorted()
    val todayCount = taken.count { it.startsWith(today) }
    val last = taken.lastOrNull()
    var nextAt: String? = null
    if (last != null && s.minGapH != null && s.minGapH > 0) {
        val at = nowKey(dueDate(last.take(16)).plusSeconds((s.minGapH * 3600).toLong()))
        if (at > nk) nextAt = at
    }
    val full = s.maxPerDay != null && todayCount >= s.maxPerDay
    return PrnState(todayCount, last, nextAt, full)
}

fun perDay(med: Medicine, routines: List<Routine>, from: String): Double {
    val s = med.schedule
    if (s is Schedule.Prn) return 0.0
    var n = 0.0
    for (i in 0 until 28) {
        val day = addDays(from, i)
        if (!scheduledOn(s, day)) continue
        if (s is Schedule.Once) n += med.amount
        else {
            val amounts = LinkedHashMap<Int, Double>()
            for (a in s.anchors.orEmpty()) {
                val m = anchorMin(a, routines, day)
                if (m !in amounts) amounts[m] = a.amount ?: med.amount
            }
            n += amounts.values.sum()
        }
    }
    return n / 28
}

data class StockInfo(val count: Double, val days: Int?, val low: Boolean, val rate: Double)

fun stockInfo(med: Medicine, routines: List<Routine>, from: String): StockInfo? {
    val stock = med.stock ?: return null
    val rate = perDay(med, routines, from)
    val days = if (rate > 0) floor(stock.count / rate).toInt() else null
    return StockInfo(stock.count, days, days != null && days <= stock.refillAtDays, rate)
}

fun nextGroup(meds: List<Medicine>, routines: List<Routine>, logs: List<DoseLog>, now: Instant): Group? {
    val nk = nowKey(now)
    val today = nk.take(10)
    for (i in 0 until 8) {
        for (g in groupsOn(meds, routines, addDays(today, i))) {
            if (g.key <= nk) continue
            if (g.doses.any { doseState(logs, it, nk).pending }) return g
        }
    }
    return null
}

data class PlanItem(val key: String, val at: Instant)

fun plan(meds: List<Medicine>, routines: List<Routine>, logs: List<DoseLog>, now: Instant, days: Int = 7): List<PlanItem> {
    val nk = nowKey(now)
    val today = nk.take(10)
    val items = mutableListOf<PlanItem>()
    for (i in 0 until days) {
        for (g in groupsOn(meds, routines, addDays(today, i))) {
            val due = snoozedUntil(g, logs, nk) ?: g.key
            if (due <= nk) continue
            if (g.doses.any { doseState(logs, it, nk).pending }) items += PlanItem(g.key, dueDate(due))
        }
    }
    return items
}

internal fun clampInt(v: Int, lo: Int, hi: Int) = min(hi, max(lo, v))
