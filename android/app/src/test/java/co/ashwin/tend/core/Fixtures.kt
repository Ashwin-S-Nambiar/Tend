package co.ashwin.tend.core

import java.time.Instant
import java.time.ZoneId

/** A wall time in the active zone. */
fun local(y: Int, m: Int, d: Int, h: Int, mi: Int = 0): Instant = zonedInstant(y, m, d, h, mi, activeZone())

fun resetClock(device: String = "Asia/Kolkata") {
    deviceZone = { ZoneId.of(device) }
    setZone(null)
    use24h = false
}

val base = Medicine(
    id = "x",
    name = "x",
    form = Form.Tablet,
    amount = 1.0,
    look = Look(Shape.Round, listOf("#fff")),
    schedule = Schedule.Daily(emptyList()),
    created = "2026-10-01T00:00",
)

fun br(offset: Int = 0) = Anchor.AtRoutine(RoutineId.Breakfast, offset)
fun di(offset: Int = 0) = Anchor.AtRoutine(RoutineId.Dinner, offset)
fun bed() = Anchor.AtRoutine(RoutineId.Bed, 0)
