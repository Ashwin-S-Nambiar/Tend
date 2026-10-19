package co.ashwin.tend.core

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.Instant
import java.time.ZoneId

class TimeTest {
    @Before fun setUp() = resetClock("Europe/London")
    @After fun tearDown() = resetClock()

    @Test fun `wall times in a zone become the right instant`() {
        assertEquals("2026-10-17T02:30:00Z", zonedInstant(2026, 10, 17, 8, 0, ZoneId.of("Asia/Kolkata")).toString())
        assertEquals("2026-10-17T07:00:00Z", zonedInstant(2026, 10, 17, 8, 0, ZoneId.of("Europe/London")).toString())
        assertEquals("2026-12-17T08:00:00Z", zonedInstant(2026, 12, 17, 8, 0, ZoneId.of("Europe/London")).toString())
        assertEquals("2026-10-17T12:00:00Z", zonedInstant(2026, 10, 17, 8, 0, ZoneId.of("America/New_York")).toString())
    }

    @Test fun `home time keeps 8 00 in India while travelling`() {
        setZone(ZoneId.of("Asia/Kolkata"))
        assertEquals("2026-10-17T02:30:00Z", dueDate("2026-10-17T08:00").toString())
        assertEquals("2026-10-17T12:30", nowKey(Instant.parse("2026-10-17T07:00:00Z")))
        assertEquals("2026-10-18", dayKey(Instant.parse("2026-10-17T20:00:00Z")))
    }

    @Test fun `home days roll over at home midnight`() {
        setZone(ZoneId.of("America/Los_Angeles"))
        assertEquals("2026-10-17", dayKey(Instant.parse("2026-10-18T05:00:00Z")))
        assertEquals("2026-10-17T22:00", nowKey(Instant.parse("2026-10-18T05:00:00Z")))
    }

    @Test fun `calendar maths ignores zones`() {
        setZone(ZoneId.of("Pacific/Auckland"))
        assertEquals("2026-11-01", addDays("2026-10-31", 1))
        assertEquals("2027-02-28", addDays("2027-03-01", -1))
    }

    @Test fun `the gap between two zones`() {
        assertEquals(270, zoneGap(ZoneId.of("Asia/Kolkata"), ZoneId.of("Europe/London"), Instant.parse("2026-10-17T12:00:00Z")))
    }

    @Test fun `a home time in the spring-forward gap still lands`() {
        val t = zonedInstant(2027, 3, 14, 2, 30, ZoneId.of("America/New_York"))
        assertTrue(t.epochSecond > 0)
    }

    @Test fun `times never break between the number and AM`() {
        assertEquals("8:00 AM", fmtTime("08:00"))
        assertEquals("10:30 PM", fmtTime("2026-10-19T22:30"))
        use24h = true
        assertEquals("22:30", fmtTime("22:30"))
    }

    @Test fun `next up reads naturally after a time`() {
        assertEquals("", relDayAfterTime("2026-10-19", "2026-10-19"))
        assertEquals(" tomorrow", relDayAfterTime("2026-10-20", "2026-10-19"))
        assertEquals(" on 30 Oct", relDayAfterTime("2026-10-30", "2026-10-19"))
    }
}
