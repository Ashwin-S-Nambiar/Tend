package co.ashwin.tend.core

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File

class BackupTest {
    @Before fun setUp() = resetClock()
    @After fun tearDown() = resetClock()

    // A backup exactly as the web app writes it, with integer numbers and absent optional fields.
    private val web = """
        {
          "app": "tend",
          "version": 1,
          "exported": "2026-10-19T03:00:00.000Z",
          "routines": [{ "id": "breakfast", "weekday": "08:00", "weekend": "09:30" }],
          "meds": [
            { "id": "a1", "name": "Apidra", "form": "injection", "amount": 14, "doseUnit": "units", "insulin": true,
              "look": { "shape": "oval", "colors": ["#8fc6e8"] }, "food": "before",
              "schedule": { "kind": "daily", "at": [
                { "routine": "breakfast", "offsetMin": -15, "amount": 14 },
                { "routine": "lunch", "offsetMin": -15, "amount": 8 },
                { "time": "23:00", "amount": 2 } ] },
              "stock": { "count": 212, "refillAtDays": 7, "pack": 300 },
              "created": "2026-10-01T09:00" },
            { "id": "p1", "name": "Paracetamol", "strength": { "value": 650, "unit": "mg" }, "form": "tablet", "amount": 1,
              "look": { "shape": "oval", "colors": ["#ffffff"] }, "schedule": { "kind": "prn", "minGapH": 6, "maxPerDay": 4 },
              "created": "2026-10-02T10:00", "futureField": true },
            { "id": "d1", "name": "Vitamin D3", "form": "capsule", "amount": 1, "look": { "shape": "cap", "colors": ["#f2c230", "#f2c230"] },
              "schedule": { "kind": "weekdays", "days": [6], "at": [{ "routine": "breakfast", "offsetMin": 0 }] },
              "course": { "start": "2026-10-01", "days": 60 }, "created": "2026-10-01T09:00" }
          ],
          "logs": [
            { "medId": "a1", "due": "2026-10-18T07:45", "status": "taken", "amount": 14, "at": "2026-10-18T07:48" },
            { "medId": "a1", "due": "2026-10-18T13:15", "status": "snoozed", "snoozeUntil": "2026-10-18T13:25" }
          ]
        }
    """.trimIndent()

    @Test fun `reads a web backup`() {
        val b = readBackup(web)
        assertEquals(3, b.meds.size)
        val apidra = b.meds[0]
        assertEquals(DoseUnit.Units, apidra.doseUnit)
        val at = apidra.schedule.anchors!!
        assertEquals(Anchor.AtRoutine(RoutineId.Breakfast, -15, 14.0), at[0])
        assertEquals(Anchor.AtTime("23:00", 2.0), at[2])
        assertEquals(Schedule.Prn(6.0, 4), b.meds[1].schedule)
        assertEquals("09:30", b.routines[0].weekend)
        assertEquals(DoseStatus.Snoozed, b.logs[1].status)
    }

    @Test fun `round trips without inventing fields`() {
        val b = readBackup(web)
        val text = exportBackup(b.meds, b.logs, b.routines)
        assertFalse(text.contains("null"))
        assertFalse(text.contains("\"type\""))
        assertTrue(text.contains("\"kind\": \"daily\""))
        val again = readBackup(text)
        assertEquals(b.meds, again.meds)
        assertEquals(b.logs, again.logs)
    }

    @Test(expected = NotABackup::class)
    fun `rejects other files`() {
        readBackup("""{ "app": "other", "meds": [], "logs": [] }""")
    }

    @Test fun `calendar export has an alarm per group`() {
        val b = readBackup(web)
        val ics = buildIcs(b.meds.take(1), b.routines, 2, local(2026, 10, 19, 0))
        assertEquals(6, Regex("BEGIN:VEVENT").findAll(ics).count())
        assertTrue(ics.contains("TRIGGER:PT0M"))
    }

    @Test fun `the shared logic never imports Android`() {
        val dir = File("src/main/java/co/ashwin/tend/core")
        val offenders = dir.listFiles()!!.filter { f -> f.readLines().any { it.startsWith("import android") || it.startsWith("import androidx") } }
        assertEquals(emptyList<File>(), offenders)
    }
}
