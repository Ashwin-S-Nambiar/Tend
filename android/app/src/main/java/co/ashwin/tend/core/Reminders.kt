package co.ashwin.tend.core

import java.time.Instant

// Replaces the push server in src/lib/push.ts: the same notification text, computed for local alarms.

const val FOLLOW_UP_MIN = 30L

data class ReminderDose(val medId: String, val due: String, val amount: Double)

data class Reminder(
    /** The group's key; follow-ups share it. */
    val key: String,
    val at: Instant,
    val followUp: Boolean,
    val title: String,
    val body: String,
    /** The lock-screen version when names are hidden. */
    val publicBody: String,
    val doses: List<ReminderDose>,
    val pip: String,
) {
    val id: String get() = if (followUp) "$key+f" else key
}

private fun groupText(meds: List<Medicine>, g: Group): String {
    val list = g.doses.mapNotNull { d -> medById(meds, d.medId)?.let { it to (d.amount ?: it.amount) } }
    val foods = list.mapNotNull { it.first.food }.toSet()
    val food = if (foods.size == 1) ", ${FOOD_TEXT.getValue(foods.first())}" else ""
    return joinNames(list.map { (m, amount) -> "${m.name} ${medicineDose(m, amount)}" }) + "$food."
}

/** Every dose reminder and follow-up that has not been logged, from now over the next days. */
fun reminders(
    meds: List<Medicine>,
    routines: List<Routine>,
    logs: List<DoseLog>,
    now: Instant,
    away: Boolean,
    days: Int = 3,
): List<Reminder> {
    val active = meds.filter { !it.isArchived }
    val nk = nowKey(now)
    val today = nk.take(10)
    val out = mutableListOf<Reminder>()
    for (i in -1 until days) {
        for (g in groupsOn(active, routines, addDays(today, i))) {
            if (g.doses.none { doseState(logs, it, nk).pending }) continue
            val due = snoozedUntil(g, logs, nk) ?: g.key
            val at = dueDate(due)
            val doses = g.doses.map { d -> ReminderDose(d.medId, d.due, d.amount ?: medById(active, d.medId)?.amount ?: 1.0) }
            val body = groupText(active, g)
            val time = fmtTime(g.key)
            val hidden = "Time for your $time${if (away) " home time" else ""} medicines"
            out += Reminder(g.key, at, false, "${g.label} medicines", body, hidden, doses, "due")
            out += Reminder(
                g.key,
                at.plusSeconds(FOLLOW_UP_MIN * 60),
                true,
                "Still due: ${g.label.lowercase()}",
                "${body.removeSuffix(".")}, due at $time.",
                "Your $time${if (away) " home time" else ""} medicines are still due",
                doses,
                "nudge",
            )
        }
    }
    return out.sortedBy { it.at }
}

/** Reminders whose time falls in (after, upTo]. */
fun remindersBetween(all: List<Reminder>, after: Instant, upTo: Instant) =
    all.filter { it.at.isAfter(after) && !it.at.isAfter(upTo) }

fun nextReminder(all: List<Reminder>, after: Instant) = all.firstOrNull { it.at.isAfter(after) }

/** Medicines that need a refill, for the daily refill notification. */
fun lowStock(meds: List<Medicine>, routines: List<Routine>, day: String) =
    meds.filter { !it.isArchived }.mapNotNull { m -> stockInfo(m, routines, day)?.takeIf { it.low }?.let { StockRow(m, it) } }
