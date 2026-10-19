package co.ashwin.tend.core

import java.math.BigDecimal
import java.math.RoundingMode
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.util.Locale
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.roundToInt

// Ported from src/lib/dose-format.ts.

private val numFmt = DecimalFormat("#,##0.###", DecimalFormatSymbols(Locale.ENGLISH))

fun fmtNum(n: Double): String = numFmt.format(BigDecimal(n).setScale(3, RoundingMode.HALF_EVEN))

private val FRACTIONS = mapOf(25 to "¼", 50 to "½", 75 to "¾")

fun fmtAmount(n: Double): String {
    val whole = floor(n)
    val frac = FRACTIONS[((n - whole) * 100).roundToInt()]
    if (frac != null) return if (whole != 0.0) "${whole.toInt()}$frac" else frac
    return fmtNum(n)
}

fun fmtStrength(s: Strength) = "${fmtNum(s.value)} ${s.unit.label}"

private val NOUN = mapOf(
    Form.Tablet to ("tablet" to "tablets"),
    Form.Capsule to ("capsule" to "capsules"),
    Form.Liquid to ("ml" to "ml"),
    Form.Drops to ("drop" to "drops"),
    Form.Puff to ("puff" to "puffs"),
    Form.Injection to ("injection" to "injections"),
    Form.Patch to ("patch" to "patches"),
    Form.Cream to ("application" to "applications"),
)

val FORM_NAME = mapOf(
    Form.Tablet to "Tablet",
    Form.Capsule to "Capsule",
    Form.Liquid to "Liquid",
    Form.Drops to "Drops",
    Form.Puff to "Inhaler",
    Form.Injection to "Injection",
    Form.Patch to "Patch",
    Form.Cream to "Cream",
)

fun fmtDose(form: Form, amount: Double): String {
    val (one, many) = NOUN.getValue(form)
    return "${fmtAmount(amount)} ${if (amount > 0 && amount <= 1) one else many}"
}

val FOOD_TEXT = mapOf(
    Food.Before to "before food",
    Food.With to "with food",
    Food.After to "after food",
    Food.Empty to "on an empty stomach",
)

fun medicineDose(med: Medicine, amount: Double = med.amount): String {
    if (med.form == Form.Cream && med.instructions != null) return med.instructions
    return med.doseUnit?.let { "${fmtAmount(amount)} ${it.label}" } ?: fmtDose(med.form, amount)
}

fun doseLine(med: Medicine, withFood: Boolean = true, amount: Double? = null): String {
    val parts = mutableListOf<String>()
    if (med.strengthLabel != null) parts += med.strengthLabel else med.strength?.let { parts += fmtStrength(it) }
    val at = med.schedule.anchors
    val varies = at != null && at.any { it.amount != null && it.amount != med.amount }
    parts += if (amount == null && varies) at.joinToString(" / ") { medicineDose(med, it.amount ?: med.amount) }
    else medicineDose(med, amount ?: med.amount)
    med.site?.let { parts += it }
    if (withFood) med.food?.let { parts += FOOD_TEXT.getValue(it) }
    return parts.joinToString(" · ")
}

fun fmtOffset(min: Int): String {
    val m = abs(min)
    if (m < 60) return "$m min"
    return if (m % 60 == 0) "${m / 60} h" else "${m / 60} h ${m % 60} min"
}

fun anchorText(a: Anchor): String = when (a) {
    is Anchor.AtTime -> "at ${fmtTime(a.time)}"
    is Anchor.AtRoutine -> {
        val name = ROUTINE_NAME.getValue(a.routine).lowercase()
        val where = if (a.routine == RoutineId.Wake) "waking up" else name
        if (a.offsetMin == 0) {
            if (a.routine == RoutineId.Wake) "on waking" else "at $name"
        } else "${fmtOffset(a.offsetMin)} ${if (a.offsetMin < 0) "before" else "after"} $where"
    }
}

private fun list(xs: List<String>) = joinNames(xs)

private val DAY = listOf("Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays")

private val ROUTINE_BASE = mapOf(
    RoutineId.Wake to 420,
    RoutineId.Breakfast to 480,
    RoutineId.Lunch to 810,
    RoutineId.Dinner to 1230,
    RoutineId.Bed to 1350,
)

private fun sortKey(a: Anchor) = when (a) {
    is Anchor.AtTime -> toMin(a.time)
    is Anchor.AtRoutine -> ROUTINE_BASE.getValue(a.routine) + a.offsetMin
}

private fun anchorsText(at: List<Anchor>) = list(at.sortedBy(::sortKey).map(::anchorText))

fun scheduleText(s: Schedule): String = when (s) {
    is Schedule.Daily -> "Every day, ${anchorsText(s.at)}"
    is Schedule.Weekdays -> {
        val days = s.days.sortedBy { (it + 6) % 7 }
        val named = if (days.size == 5 && 0 !in days && 6 !in days) "Weekdays" else list(days.map { DAY.getOrElse(it) { "" } })
        "$named, ${anchorsText(s.at)}"
    }
    is Schedule.Interval -> "Every ${if (s.everyDays == 2) "other day" else "${s.everyDays} days"}, ${anchorsText(s.at)}"
    is Schedule.Cycle -> "${s.on} days on, ${s.off} off, ${anchorsText(s.at)}"
    is Schedule.Once -> "Once, ${fmtDay(s.`when`.take(10), "d MMM")} at ${fmtTime(s.`when`)}"
    is Schedule.Prn -> listOfNotNull(
        "When needed",
        s.minGapH?.takeIf { it > 0 }?.let { "${fmtNum(it)} h apart" },
        s.maxPerDay?.takeIf { it > 0 }?.let { "up to $it a day" },
    ).joinToString(", ")
}

fun shortSchedule(s: Schedule): String = when (s) {
    is Schedule.Daily -> if (s.at.size == 1) "Once a day" else "${s.at.size} times a day"
    is Schedule.Weekdays -> if (s.days.size == 1) DAY.getOrElse(s.days[0]) { "" } else "${s.days.size} days a week"
    is Schedule.Interval -> if (s.everyDays == 2) "Every other day" else "Every ${s.everyDays} days"
    is Schedule.Cycle -> "${s.on} on, ${s.off} off"
    is Schedule.Once -> "Once"
    is Schedule.Prn -> "When needed"
}

fun plural(n: Int, one: String, many: String = "${one}s") = "$n ${if (n == 1) one else many}"
