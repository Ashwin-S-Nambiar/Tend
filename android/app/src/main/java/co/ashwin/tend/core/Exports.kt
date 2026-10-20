package co.ashwin.tend.core

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter


private val stampFmt = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'").withZone(ZoneOffset.UTC)

private fun esc(s: String) = s.replace(Regex("[\\\\,;]")) { "\\${it.value}" }.replace("\n", "\\n")

fun buildIcs(meds: List<Medicine>, routines: List<Routine>, days: Int = 30, now: Instant = clock()): String {
    val today = dayKey(now)
    val stamp = stampFmt.format(now)
    val lines = mutableListOf("BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Tend//Medicines//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Tend")
    for (i in 0 until days) {
        for (g in groupsOn(meds, routines, addDays(today, i))) {
            val list = g.doses.mapNotNull { d -> medById(meds, d.medId)?.let { it.copy(amount = d.amount ?: it.amount) } }
            val start = dueDate(g.key)
            lines += listOf(
                "BEGIN:VEVENT",
                "UID:${g.key}-${list.joinToString("-") { it.id }}@tend.ashwin.co.in",
                "DTSTAMP:$stamp",
                "DTSTART:${stampFmt.format(start)}",
                "DTEND:${stampFmt.format(start.plusSeconds(15 * 60))}",
                "SUMMARY:${esc("${g.label} medicines")}",
                "DESCRIPTION:${esc(list.joinToString("\n") { "${it.name}, ${doseLine(it, true, it.amount)}" })}",
                "BEGIN:VALARM",
                "ACTION:DISPLAY",
                "DESCRIPTION:${esc(list.joinToString(", ") { it.name })}",
                "TRIGGER:PT0M",
                "END:VALARM",
                "END:VEVENT",
            )
        }
    }
    lines += "END:VCALENDAR"
    return lines.joinToString("\r\n")
}

@Serializable
data class Backup(
    val app: String,
    val version: Int,
    val exported: String,
    val routines: List<Routine> = emptyList(),
    val meds: List<Medicine>,
    val logs: List<DoseLog>,
)

private val pretty = Json(TendJson) { prettyPrint = true; prettyPrintIndent = "  " }

fun exportBackup(meds: List<Medicine>, logs: List<DoseLog>, routines: List<Routine>, now: Instant = clock()): String =
    pretty.encodeToString(Backup.serializer(), Backup("tend", 1, now.toString(), routines, meds, logs))

class NotABackup : Exception("not a Tend backup")

fun readBackup(text: String): Backup {
    val b = try {
        TendJson.decodeFromString(Backup.serializer(), text)
    } catch (e: Exception) {
        throw NotABackup()
    }
    if (b.app != "tend") throw NotABackup()
    return b
}

fun doctorCardText(meds: List<Medicine>, dateText: String): String =
    (listOf("My medicines, $dateText", "") + meds.map { m ->
        "• ${m.name}, ${doseLine(m)}. ${scheduleText(m.schedule)}.${m.notes?.let { " $it" } ?: ""}"
    }).joinToString("\n")
