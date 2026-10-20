package co.ashwin.tend.core

import java.time.Instant
import kotlin.math.max

// Actions are pure: they return the next data and an undo that reverses only what they changed.

data class Data(val meds: List<Medicine> = emptyList(), val logs: List<DoseLog> = emptyList())

typealias Edit = (Data) -> Data

enum class Feel { Taken, Skip, Snooze, Quiet }

data class Outcome(val data: Data, val undo: Edit, val message: String, val feel: Feel)

private fun DoseLog.same(medId: String, due: String) = this.medId == medId && this.due == due

fun putLogs(data: Data, logs: List<DoseLog>): Pair<Data, Edit> {
    val prev = logs.map { l -> data.logs.find { it.same(l.medId, l.due) } }
    val next = data.copy(logs = data.logs.filterNot { x -> logs.any { x.same(it.medId, it.due) } } + logs)
    val undo: Edit = { d ->
        d.copy(logs = d.logs.filterNot { x -> logs.any { x.same(it.medId, it.due) } } + prev.filterNotNull())
    }
    return next to undo
}

fun putMed(data: Data, med: Medicine): Pair<Data, Edit> {
    val prev = data.meds.find { it.id == med.id }
    val next = data.copy(meds = sortMeds(data.meds.filterNot { it.id == med.id } + med))
    val undo: Edit = { d ->
        if (prev != null) d.copy(meds = sortMeds(d.meds.filterNot { it.id == prev.id } + prev))
        else d.copy(meds = d.meds.filterNot { it.id == med.id })
    }
    return next to undo
}

fun deleteMed(data: Data, id: String): Pair<Data, Edit> {
    val prev = data.meds.find { it.id == id }
    val prevLogs = data.logs.filter { it.medId == id }
    val next = Data(data.meds.filterNot { it.id == id }, data.logs.filterNot { it.medId == id })
    val undo: Edit = { d ->
        Data(
            if (prev != null) sortMeds(d.meds.filterNot { it.id == id } + prev) else d.meds,
            d.logs.filterNot { it.medId == id } + prevLogs,
        )
    }
    return next to undo
}

fun sortMeds(meds: List<Medicine>) = meds.sortedBy { it.created }

data class StockChange(val id: String, val by: Double)

fun adjustStock(data: Data, changes: List<StockChange>): Pair<Data, Edit> {
    val applied = mutableListOf<StockChange>()
    val meds = data.meds.map { m ->
        val stock = m.stock ?: return@map m
        val by = changes.filter { it.id == m.id }.sumOf { it.by }
        if (by == 0.0) return@map m
        val count = max(0.0, stock.count + by)
        applied += StockChange(m.id, count - stock.count)
        m.copy(stock = stock.copy(count = count))
    }
    val undo: Edit = { d ->
        d.copy(meds = d.meds.map { m ->
            val back = applied.filter { it.id == m.id }.sumOf { it.by }
            val stock = m.stock
            if (back == 0.0 || stock == null) m else m.copy(stock = stock.copy(count = max(0.0, stock.count - back)))
        })
    }
    return data.copy(meds = meds) to undo
}

private fun chain(vararg undos: Edit): Edit = { d -> undos.reversed().fold(d) { acc, u -> u(acc) } }

private fun names(meds: List<Medicine>) = when (meds.size) {
    1 -> meds[0].name
    2 -> "${meds[0].name} and ${meds[1].name}"
    else -> "${meds.size} medicines"
}

private fun medsFor(data: Data, doses: List<Dose>) = doses.mapNotNull { d -> data.meds.find { it.id == d.medId } }

fun take(data: Data, doses: List<Dose>, label: String, at: String = nowKey()): Outcome? {
    val fresh = doses.filter { d -> data.logs.find { it.same(d.medId, d.due) }?.status != DoseStatus.Taken }
    if (fresh.isEmpty()) return null
    val logs = fresh.map { d ->
        DoseLog(d.medId, d.due, DoseStatus.Taken, amount = d.amount ?: medById(data.meds, d.medId)?.amount, at = at)
    }
    val (a, u1) = putLogs(data, logs)
    val (b, u2) = adjustStock(a, fresh.map { d -> StockChange(d.medId, -(d.amount ?: medById(data.meds, d.medId)?.amount ?: 1.0)) })
    return Outcome(b, chain(u1, u2), "$label taken at ${fmtTime(at)}", Feel.Taken)
}

fun skip(data: Data, doses: List<Dose>, label: String, at: String = nowKey()): Outcome? {
    if (doses.isEmpty()) return null
    val logs = doses.map { DoseLog(it.medId, it.due, DoseStatus.Skipped, at = at) }
    val refunds = doses.mapNotNull { d ->
        val prev = data.logs.find { it.same(d.medId, d.due) }
        if (prev?.status != DoseStatus.Taken) null
        else StockChange(d.medId, prev.amount ?: d.amount ?: medById(data.meds, d.medId)?.amount ?: 1.0)
    }
    val (a, u1) = putLogs(data, logs)
    val (b, u2) = adjustStock(a, refunds)
    val msg = if (doses.size == 1) "${names(medsFor(data, doses))} skipped" else "$label skipped"
    return Outcome(b, chain(u1, u2), msg, Feel.Skip)
}

fun snooze(data: Data, group: Group, minutes: Long, now: Instant = clock()): Outcome? {
    val base = maxOf(now, dueDate(group.key))
    val until = nowKey(base.plusSeconds(minutes * 60))
    val open = group.doses.filter { d ->
        val s = data.logs.find { it.same(d.medId, d.due) }?.status
        s != DoseStatus.Taken && s != DoseStatus.Skipped
    }
    if (open.isEmpty()) return null
    val (a, u) = putLogs(data, open.map { DoseLog(it.medId, it.due, DoseStatus.Snoozed, snoozeUntil = until) })
    return Outcome(a, u, "${group.label} moved to ${fmtTime(until)}", Feel.Snooze)
}

fun unlog(data: Data, dose: Dose): Outcome? {
    val prev = data.logs.find { it.same(dose.medId, dose.due) } ?: return null
    val med = medById(data.meds, dose.medId)
    val (a, u1) = putLogs(data, listOf(DoseLog(dose.medId, dose.due, DoseStatus.Snoozed, snoozeUntil = dose.due)))
    val (b, u2) = if (prev.status == DoseStatus.Taken && med != null) {
        adjustStock(a, listOf(StockChange(med.id, prev.amount ?: dose.amount ?: med.amount)))
    } else a to { d: Data -> d }
    return Outcome(b, chain(u1, u2), "${med?.name ?: "Dose"} cleared", Feel.Quiet)
}

fun takePrn(data: Data, med: Medicine, at: String = nowKey()): Outcome {
    val (a, u1) = putLogs(data, listOf(DoseLog(med.id, at, DoseStatus.Taken, amount = med.amount, at = at)))
    val (b, u2) = adjustStock(a, listOf(StockChange(med.id, -med.amount)))
    return Outcome(b, chain(u1, u2), "${med.name} taken at ${fmtTime(at)}", Feel.Taken)
}

fun refill(data: Data, med: Medicine): Outcome {
    val by = med.stock?.pack ?: 10.0
    val (a, u) = adjustStock(data, listOf(StockChange(med.id, by)))
    return Outcome(a, u, "Added ${fmtNum(by)} ${med.name}", Feel.Quiet)
}
