package co.ashwin.tend.core

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

class ActionsTest {
    @Before fun setUp() = resetClock()
    @After fun tearDown() = resetClock()

    private val metformin = base.copy(id = "m", name = "Metformin", schedule = Schedule.Daily(listOf(br(), di())), stock = Stock(14.0, 7, 15.0))
    private val data = Data(listOf(metformin))
    private val morning get() = groupsOn(data.meds, DEFAULT_ROUTINES, "2026-10-19")[0]

    @Test fun `taking logs the dose and counts the stock, undo puts both back`() {
        val o = take(data, morning.doses, "Morning", "2026-10-19T08:04")!!
        assertEquals(13.0, o.data.meds[0].stock!!.count, 0.0)
        assertEquals("Morning taken at 8:04 AM", o.message)
        val back = o.undo(o.data)
        assertEquals(data, back)
        assertNull(take(o.data, morning.doses, "Morning"))
    }

    @Test fun `skipping a taken dose refunds the stock`() {
        val taken = take(data, morning.doses, "Morning", "2026-10-19T08:04")!!.data
        val skipped = skip(taken, morning.doses, "Morning")!!
        assertEquals(14.0, skipped.data.meds[0].stock!!.count, 0.0)
        assertEquals("Metformin skipped", skipped.message)
    }

    @Test fun `undo keeps changes made after the action`() {
        val o = take(data, morning.doses, "Morning", "2026-10-19T08:04")!!
        val refilled = refill(o.data, o.data.meds[0]).data
        val undone = o.undo(refilled)
        assertEquals(29.0, undone.meds[0].stock!!.count, 0.0)
        assertEquals(emptyList<DoseLog>(), undone.logs)
    }

    @Test fun `snooze moves from the due time when early`() {
        val o = snooze(data, morning, 10, local(2026, 10, 19, 7))!!
        assertEquals("2026-10-19T08:10", o.data.logs[0].snoozeUntil)
    }

    @Test fun `follow-ups come thirty minutes after an open reminder`() {
        val r = reminders(data.meds, DEFAULT_ROUTINES, emptyList(), local(2026, 10, 19, 7), away = false, days = 1)
        val today = r.filter { it.key.startsWith("2026-10-19") }
        assertEquals(listOf("2026-10-19T08:00", "2026-10-19T08:00+f", "2026-10-19T20:30", "2026-10-19T20:30+f"), today.map { it.id })
        assertEquals("Metformin 1 tablet.", today[0].body)
        assertEquals("Time for your 8:00 AM medicines", today[0].publicBody)
        val logged = take(data, morning.doses, "Morning", "2026-10-19T08:04")!!.data
        val after = reminders(logged.meds, DEFAULT_ROUTINES, logged.logs, local(2026, 10, 19, 8, 5), away = false, days = 1)
        assertEquals(listOf("2026-10-19T20:30", "2026-10-19T20:30+f"), after.filter { it.key.startsWith("2026-10-19") }.map { it.id })
    }
}
