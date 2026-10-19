package co.ashwin.tend.core

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class MedicineDraftTest {
    @Before fun setUp() = resetClock()
    @After fun tearDown() = resetClock()

    private fun apidra(): Medicine {
        val d = insulinDraft(blank()).copy(name = "Apidra", amounts = mapOf("breakfast" to "14", "lunch" to "8", "dinner" to "6"))
        return toMed(d).copy(created = "2026-10-01T00:00")
    }

    private fun assertMatch(re: String, s: String?) = assertTrue("$s !~ $re", Regex(re).containsMatchIn(s ?: ""))

    @Test fun `meal-time insulin requires a prescribed amount at every selected meal`() {
        var d = insulinDraft(blank()).copy(name = "Apidra")
        assertMatch("each reminder", problem(d))
        d = d.copy(amounts = mapOf("breakfast" to "14", "lunch" to "8", "dinner" to "6"))
        assertNull(problem(d))
        d = d.copy(amounts = d.amounts + ("lunch" to "0"))
        assertMatch("each reminder", problem(d))
    }

    @Test fun `Apidra repeats daily with 14, 8 and 6 units fifteen minutes before meals`() {
        val med = apidra()
        for (day in listOf("2026-10-18", "2026-10-19")) {
            assertEquals(
                listOf("${day}T07:45" to 14.0, "${day}T13:15" to 8.0, "${day}T20:15" to 6.0),
                dosesOn(listOf(med), DEFAULT_ROUTINES, day).map { it.due to it.amount },
            )
        }
        assertEquals("8 units", medicineDose(med, 8.0))
        assertEquals("6 units", doseLine(med, false, 6.0))
        assertEquals(28.0, perDay(med, DEFAULT_ROUTINES, "2026-10-18"), 1e-9)
    }

    @Test fun `Lantus is a separate daily bedtime dose without a meal offset`() {
        var d = insulinDraft(blank(), true).copy(name = "Lantus")
        assertMatch("greater than zero", problem(d))
        d = d.copy(amount = 24.0)
        assertNull(problem(d))
        val med = toMed(d).copy(created = "2026-10-01T00:00")
        assertEquals(listOf("2026-10-18T22:30" to 24.0), dosesOn(listOf(med), DEFAULT_ROUTINES, "2026-10-18").map { it.due to it.amount })
        assertEquals("24 units", doseLine(med))
    }

    @Test fun `dose amounts and offsets survive editing, including custom clock reminders`() {
        val a = apidra()
        val med = a.copy(schedule = a.schedule.withAnchors(a.schedule.anchors!! + Anchor.AtTime("23:00", 2.0)))
        assertEquals(med, toMed(fromMed(med), med))
    }

    @Test fun `prescription patterns preserve differing doses and explicit insulin units`() {
        val p = parse("Inj Apidra 14-8-6 units AC")
        assertEquals("Apidra", p.name)
        assertEquals(mapOf(RoutineId.Breakfast to 14.0, RoutineId.Lunch to 8.0, RoutineId.Dinner to 6.0), p.amounts)
        assertEquals(DoseUnit.Units, p.doseUnit)
        assertTrue(echo(p).contains("14 units morning, 8 units afternoon, 6 units night"))
        val d = fromParsed(blank(), p)
        assertEquals(15, d.beforeMin)
        assertNull(problem(d))
        val lantus = fromParsed(blank(), parse("Inj Lantus 24 units HS"))
        assertEquals(24.0, lantus.amount, 0.0)
        assertEquals(DraftUnit.Units, lantus.doseUnit)
        assertEquals(listOf(RoutineId.Bed), lantus.routines)
        assertNull(toMed(lantus).strength)
    }

    @Test fun `before-meal and with-meal doses receive distinct reminder times`() {
        val med = apidra()
        val food = med.copy(id = "with-food", schedule = Schedule.Daily(listOf(br())))
        val groups = groupsOn(listOf(med, food), DEFAULT_ROUTINES, "2026-10-18")
        assertEquals(listOf("2026-10-18T07:45" to 1, "2026-10-18T08:00" to 1), groups.take(2).map { it.key to it.doses.size })
        assertEquals(
            listOf("2026-10-18T07:45", "2026-10-18T08:00"),
            plan(listOf(med, food), DEFAULT_ROUTINES, emptyList(), local(2026, 10, 18, 7), 1).take(2).map { it.key },
        )
    }

    @Test fun `meal doses follow weekend routines and keep their amounts`() {
        val routines = DEFAULT_ROUTINES.map { it.copy(weekend = "10:00") }
        val first = dosesOn(listOf(apidra()), routines, "2026-10-18")[0]
        assertEquals("2026-10-18T09:45", first.due)
        assertEquals(14.0, first.amount)
    }

    @Test fun `interval schedules retain per-reminder amounts on scheduled days only`() {
        val d = fromMed(apidra()).copy(kind = Schedule.Kind.Interval, everyDays = 3, start = "2026-10-18")
        val med = toMed(d).copy(created = "2026-10-01T00:00")
        assertEquals(listOf(14.0, 8.0, 6.0), dosesOn(listOf(med), DEFAULT_ROUTINES, "2026-10-21").map { it.amount })
        assertEquals(0, dosesOn(listOf(med), DEFAULT_ROUTINES, "2026-10-20").size)
    }

    @Test fun `a before-meal reminder crosses midnight without being clamped`() {
        val routines = DEFAULT_ROUTINES.map { if (it.id == RoutineId.Breakfast) it.copy(weekday = "00:05", weekend = null) else it }
        val doses = dosesOn(listOf(apidra()), routines, "2026-10-18")
        assertTrue(doses.any { it.due == "2026-10-18T23:50" && it.amount == 14.0 })
        assertFalse(doses.any { it.due.endsWith("T00:00") })
    }

    @Test fun `changing a variable schedule to a one-time dose uses its entered amount`() {
        val d = fromMed(apidra()).copy(kind = Schedule.Kind.Once, amount = 24.0)
        assertEquals(24.0, toMed(d).amount, 0.0)
    }

    @Test fun `changing medicine type clears incompatible dose, food and stock settings`() {
        val insulin = fromMed(apidra()).copy(stock = true, strengthLabel = "100 units / ml")
        val cream = selectMedicineType(insulin, MedicineType.Cream)
        assertFalse(cream.insulin)
        assertNull(cream.food)
        assertFalse(cream.variable)
        assertFalse(cream.stock)
        assertEquals(emptyMap<String, String>(), cream.amounts)
        assertEquals("", cream.strengthLabel)
        val liquid = fromParsed(insulin, parse("Syp Calpol 5ml TDS"))
        assertEquals(DraftUnit.Ml, liquid.doseUnit)
        assertEquals(5.0, liquid.amount, 0.0)
        assertFalse(liquid.insulin)
    }

    @Test fun `application instructions and label strengths survive editing`() {
        val cream = selectMedicineType(blank().copy(name = "Hydrocortisone"), MedicineType.Cream)
            .copy(instructions = "Thin layer", site = "Affected arm", strengthLabel = "1%")
        val med = toMed(cream)
        assertEquals("1% · Thin layer · Affected arm", doseLine(med))
        assertEquals(med, toMed(fromMed(med), med))
        val liquid = selectMedicineType(cream, MedicineType.Liquid).copy(amount = 5.0, strengthLabel = "250 mg / 5 ml")
        assertEquals("250 mg / 5 ml · 5 ml", doseLine(toMed(liquid)))
    }

    @Test fun `when-needed medicines have no assumed limits and validate prescribed limits`() {
        var d = selectMedicineType(blank().copy(name = "Inhaler"), MedicineType.Puff).copy(kind = Schedule.Kind.Prn, amount = 2.0)
        val med = toMed(d)
        assertEquals(Schedule.Prn(), med.schedule)
        assertTrue(prnState(med, emptyList(), clock())!!.canTake)
        d = d.copy(limitGap = true)
        assertMatch("minimum gap", problem(d))
        d = d.copy(gap = 4.0, limitMax = true)
        assertMatch("daily limit", problem(d))
        d = d.copy(max = 3)
        assertNull(problem(d))
        assertEquals(Schedule.Prn(4.0, 3), toMed(d).schedule)
    }
}
