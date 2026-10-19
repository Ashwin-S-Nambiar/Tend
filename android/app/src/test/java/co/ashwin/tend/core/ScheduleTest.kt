package co.ashwin.tend.core

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.Instant
import java.time.ZoneId

class ScheduleTest {
    @Before fun setUp() = resetClock()
    @After fun tearDown() = resetClock()

    private val metformin = base.copy(
        id = "m",
        name = "Metformin",
        schedule = Schedule.Daily(listOf(br(), di())),
        stock = Stock(14.0, 7, 15.0),
    )
    private val d3 = base.copy(id = "d", name = "Vitamin D3", schedule = Schedule.Weekdays(listOf(6), listOf(br())))
    private val amox = base.copy(
        id = "a",
        name = "Amoxicillin",
        schedule = Schedule.Daily(listOf(bed())),
        course = Course("2026-10-15", 5),
    )

    @Test fun `routines expand into due times`() =
        assertEquals(listOf("2026-10-17T08:00", "2026-10-17T20:30"), dosesOn(listOf(metformin), DEFAULT_ROUTINES, "2026-10-17").map { it.due })

    @Test fun `weekend routine times apply on weekends`() {
        val routines = DEFAULT_ROUTINES.map { if (it.id == RoutineId.Breakfast) it.copy(weekend = "09:30") else it }
        assertEquals("2026-10-17T09:30", dosesOn(listOf(metformin), routines, "2026-10-17")[0].due)
        assertEquals("2026-10-19T08:00", dosesOn(listOf(metformin), routines, "2026-10-19")[0].due)
    }

    @Test fun `offsets move with the routine`() {
        val m = metformin.copy(schedule = Schedule.Daily(listOf(br(-30))))
        assertEquals("2026-10-17T07:30", dosesOn(listOf(m), DEFAULT_ROUTINES, "2026-10-17")[0].due)
    }

    @Test fun `doses on one routine share a group`() {
        val groups = groupsOn(listOf(metformin, d3, amox), DEFAULT_ROUTINES, "2026-10-17")
        assertEquals(listOf("Morning" to 2, "Evening" to 1, "Bedtime" to 1), groups.map { it.label to it.doses.size })
    }

    @Test fun `courses end on their own`() {
        assertEquals(1, dosesOn(listOf(amox), DEFAULT_ROUTINES, "2026-10-19").size)
        assertEquals(0, dosesOn(listOf(amox), DEFAULT_ROUTINES, "2026-10-20").size)
        assertEquals(CourseDay(3, 5, "2026-10-19"), courseDay(amox, "2026-10-17"))
    }

    @Test fun `cycles and intervals`() {
        val cycle = metformin.copy(schedule = Schedule.Cycle(21, 7, "2026-10-01", listOf(Anchor.AtTime("09:00"))))
        assertEquals(1, dosesOn(listOf(cycle), DEFAULT_ROUTINES, "2026-10-21").size)
        assertEquals(0, dosesOn(listOf(cycle), DEFAULT_ROUTINES, "2026-10-22").size)
        assertEquals(1, dosesOn(listOf(cycle), DEFAULT_ROUTINES, "2026-10-29").size)
        val every3 = metformin.copy(schedule = Schedule.Interval(3, "2026-10-01", listOf(Anchor.AtTime("09:00"))))
        assertEquals(1, dosesOn(listOf(every3), DEFAULT_ROUTINES, "2026-10-04").size)
        assertEquals(0, dosesOn(listOf(every3), DEFAULT_ROUTINES, "2026-10-05").size)
    }

    @Test fun `a group is due, then not logged after its window`() {
        val (morning, evening) = groupsOn(listOf(metformin), DEFAULT_ROUTINES, "2026-10-17")
        assertEquals(GroupState.Upcoming, groupState(morning, emptyList(), local(2026, 10, 17, 7, 59), evening))
        assertEquals(GroupState.Due, groupState(morning, emptyList(), local(2026, 10, 17, 8, 5), evening))
        assertEquals(GroupState.Unlogged, groupState(morning, emptyList(), local(2026, 10, 17, 10, 1), evening))
        val logs = listOf(DoseLog("m", morning.key, DoseStatus.Taken, at = "2026-10-17T08:02"))
        assertEquals(GroupState.Done, groupState(morning, logs, local(2026, 10, 17, 8, 5), evening))
    }

    @Test fun `snoozed groups come back`() {
        val morning = groupsOn(listOf(metformin), DEFAULT_ROUTINES, "2026-10-17")[0]
        val logs = listOf(DoseLog("m", morning.key, DoseStatus.Snoozed, snoozeUntil = "2026-10-17T08:15"))
        assertEquals(GroupState.Snoozed, groupState(morning, logs, local(2026, 10, 17, 8, 10)))
        assertEquals(GroupState.Due, groupState(morning, logs, local(2026, 10, 17, 8, 16)))
    }

    @Test fun `when needed respects the gap and the daily maximum`() {
        val prn = base.copy(id = "p", name = "Paracetamol", schedule = Schedule.Prn(6.0, 2))
        val now = local(2026, 10, 17, 12)
        assertTrue(prnState(prn, emptyList(), now)!!.canTake)
        val one = listOf(DoseLog("p", "2026-10-17T09:00", DoseStatus.Taken, at = "2026-10-17T09:00"))
        assertEquals("2026-10-17T15:00", prnState(prn, one, now)?.nextAt)
        val two = one + DoseLog("p", "2026-10-17T15:00", DoseStatus.Taken, at = "2026-10-17T15:00")
        assertTrue(prnState(prn, two, local(2026, 10, 17, 22))!!.full)
    }

    @Test fun `stock runs low at its refill point`() {
        val s = stockInfo(metformin, DEFAULT_ROUTINES, "2026-10-17")!!
        assertEquals(7, s.days)
        assertTrue(s.low)
    }

    @Test fun `the plan skips what is logged and keeps what is ahead`() {
        val items = plan(listOf(metformin), DEFAULT_ROUTINES, emptyList(), local(2026, 10, 17, 9), 2)
        assertEquals(listOf("2026-10-17T20:30", "2026-10-18T08:00", "2026-10-18T20:30"), items.map { it.key })
    }

    @Test fun `across the spring-forward gap the day still has its doses`() {
        val m = metformin.copy(schedule = Schedule.Daily(listOf(Anchor.AtTime("02:30"), Anchor.AtTime("09:00"))))
        assertEquals(2, dosesOn(listOf(m), DEFAULT_ROUTINES, "2027-03-28").size)
    }

    @Test fun `a medicine added just after its routine still shows that dose`() {
        assertEquals("2026-10-17T08:00", dosesOn(listOf(metformin.copy(created = "2026-10-17T08:02")), DEFAULT_ROUTINES, "2026-10-17")[0].due)
        assertEquals("2026-10-17T20:30", dosesOn(listOf(metformin.copy(created = "2026-10-17T12:30")), DEFAULT_ROUTINES, "2026-10-17")[0].due)
    }

    @Test fun `home time plans reminders at home instants while away`() {
        resetClock("Europe/London")
        setZone(ZoneId.of("Asia/Kolkata"))
        val items = plan(listOf(metformin), DEFAULT_ROUTINES, emptyList(), Instant.parse("2026-10-17T06:00:00Z"), 1)
        assertEquals("2026-10-17T15:00:00Z", items[0].at.toString())
        assertEquals("2026-10-17T20:30", items[0].key)
    }

    @Test fun `the last seven days end today`() {
        val week = lastDays(listOf(metformin), DEFAULT_ROUTINES, emptyList(), local(2026, 10, 19, 9))
        assertEquals("2026-10-13", week.first().day)
        assertEquals("2026-10-19", week.last().day)
        assertTrue(week.last().today)
        assertEquals(2, week.last().total)
        assertNotNull(week.find { it.day == "2026-10-18" && it.total == 2 })
    }
}
