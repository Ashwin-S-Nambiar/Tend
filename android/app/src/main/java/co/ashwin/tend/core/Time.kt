package co.ashwin.tend.core

import java.time.DayOfWeek
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToInt

// Day keys are yyyy-MM-dd and due keys yyyy-MM-ddTHH:mm, both wall
// times in the active zone: the home zone while keeping home time, otherwise the device zone.

private var zone: ZoneId? = null

/** The device zone; replaceable in tests. */
var deviceZone: () -> ZoneId = { ZoneId.systemDefault() }

/** The current instant; replaceable in tests. */
var clock: () -> Instant = { Instant.now() }

/** Follows the device's 12 or 24 hour setting. */
var use24h = false

private val en = Locale.ENGLISH

fun setZone(next: ZoneId?) {
    zone = if (next != null && next != deviceZone()) next else null
}

fun activeZone(): ZoneId = zone ?: deviceZone()

fun zonedInstant(y: Int, m: Int, d: Int, h: Int, mi: Int, z: ZoneId): Instant =
    LocalDateTime.of(y, m, d, h, mi).atZone(z).toInstant()

private fun pad(n: Int) = n.toString().padStart(2, '0')

private fun calKey(date: LocalDate) = "${date.year}-${pad(date.monthValue)}-${pad(date.dayOfMonth)}"

fun parseDay(key: String): LocalDate {
    val p = key.split("-").map { it.toIntOrNull() }
    return LocalDate.of(p.getOrNull(0) ?: 1970, p.getOrNull(1) ?: 1, p.getOrNull(2) ?: 1)
}

fun dayKey(at: Instant = clock()): String = calKey(at.atZone(activeZone()).toLocalDate())

fun addDays(key: String, n: Int): String = calKey(parseDay(key).plusDays(n.toLong()))

fun dayDiff(from: String, to: String): Int =
    (parseDay(to).toEpochDay() - parseDay(from).toEpochDay()).toInt()

/** 0 is Sunday, as in JavaScript. */
fun weekday(key: String): Int = parseDay(key).dayOfWeek.value % 7

fun isWeekend(key: String): Boolean = parseDay(key).dayOfWeek.let { it == DayOfWeek.SATURDAY || it == DayOfWeek.SUNDAY }

fun toMin(hhmm: String): Int {
    val p = hhmm.split(":")
    return (p.getOrNull(0)?.toIntOrNull() ?: 0) * 60 + (p.getOrNull(1)?.toIntOrNull() ?: 0)
}

fun fromMin(min: Int): String {
    val m = min.coerceIn(0, 1439)
    return "${pad(m / 60)}:${pad(m % 60)}"
}

fun dueKey(day: String, hhmm: String) = "${day}T$hhmm"

data class DueParts(val day: String, val time: String)

fun dueParts(due: String): DueParts {
    val p = due.split("T")
    return DueParts(p.getOrElse(0) { "" }, p.getOrElse(1) { "00:00" })
}

fun dueLocal(due: String): LocalDateTime {
    val (day, time) = dueParts(due)
    val m = toMin(time.take(5))
    return parseDay(day).atTime(m / 60, m % 60)
}

fun dueDate(due: String): Instant = dueLocal(due).atZone(activeZone()).toInstant()

fun nowKey(at: Instant = clock()): String {
    val w = at.atZone(activeZone()).toLocalDateTime()
    return dueKey(calKey(w.toLocalDate()), "${pad(w.hour)}:${pad(w.minute)}")
}

/** Times use a no-break space so "8:00 AM" never wraps between its parts. */
fun clockText(t: LocalTime): String =
    if (use24h) "${t.hour}:${pad(t.minute)}"
    else t.format(DateTimeFormatter.ofPattern("h:mm a", en)).replace("am", "AM").replace("pm", "PM")

/** A wall time from "HH:mm" or a due key, read as written. */
fun fmtTime(at: String): String {
    val time = if ('T' in at) dueParts(at).time else at
    val m = toMin(time.take(5))
    return clockText(LocalTime.of((m / 60) % 24, m % 60))
}

/** An instant shown in the active zone. */
fun fmtTime(at: Instant): String = clockText(at.atZone(activeZone()).toLocalTime())

/** A due key shown on the device's own clock, for travellers keeping home time. */
fun fmtHere(due: String): String = clockText(dueDate(due).atZone(deviceZone()).toLocalTime())

fun fmtDay(key: String, pattern: String): String =
    parseDay(key).format(DateTimeFormatter.ofPattern(pattern, en))

fun relDay(key: String, today: String = dayKey()): String {
    val d = dayDiff(today, key)
    return when {
        d == 0 -> "today"
        d == 1 -> "tomorrow"
        d == -1 -> "yesterday"
        d in 2..6 -> fmtDay(key, "EEEE")
        else -> fmtDay(key, "d MMM")
    }
}

/** relDay phrased to follow a time: "at 8:00 AM tomorrow", "at 8:00 AM on 25 Oct". */
fun relDayAfterTime(key: String, today: String = dayKey()): String {
    val r = relDay(key, today)
    return if (r == "today") "" else if (r[0].isDigit()) " on $r" else " $r"
}

fun zoneName(z: String): String = z.substringAfterLast('/').replace('_', ' ')

/** Minutes zone a is ahead of zone b at an instant. */
fun zoneGap(a: ZoneId, b: ZoneId, at: Instant = clock()): Int {
    val oa = a.rules.getOffset(at).totalSeconds
    val ob = b.rules.getOffset(at).totalSeconds
    return ((oa - ob) / 60.0).roundToInt()
}

fun minutesBetween(a: Instant, b: Instant): Long = Duration.between(a, b).toMinutes()

fun gapText(min: Int): String {
    val m = abs(min)
    val h = m / 60
    val r = m % 60
    val size = when (r) {
        0 -> "$h h"
        30 -> "$h½ h"
        else -> "$h h $r min"
    }
    return "$size ${if (min > 0) "ahead of" else "behind"}"
}
