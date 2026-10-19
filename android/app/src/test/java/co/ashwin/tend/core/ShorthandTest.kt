package co.ashwin.tend.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ShorthandTest {
    @Test fun `pattern, strength and food`() {
        val p = parse("Metformin 500mg 1-0-1 PC")
        assertEquals("Metformin", p.name)
        assertEquals(Strength(500.0, Unit.Mg), p.strength)
        assertEquals(listOf(RoutineId.Breakfast, RoutineId.Dinner), p.slots)
        assertEquals(1.0, p.amount)
        assertEquals(Food.After, p.food)
        assertEquals(listOf("Metformin", "500 mg", "1 morning, 1 night", "after food"), echo(p))
        assertTrue(understood(p))
    }

    @Test fun `forms are read and dropped from the name`() {
        val p = parse("Cap Omez 20mg 1-0-0 AC")
        assertEquals("Omez", p.name)
        assertEquals(Form.Capsule, p.form)
        assertEquals(listOf(RoutineId.Breakfast), p.slots)
        assertEquals(Food.Before, p.food)
    }

    @Test fun `syrups take ml as the amount`() {
        val p = parse("Syp Calpol 5ml TDS x 3 days")
        assertEquals(Form.Liquid, p.form)
        assertEquals(5.0, p.amount)
        assertNull(p.strength)
        assertEquals(listOf(RoutineId.Breakfast, RoutineId.Lunch, RoutineId.Dinner), p.slots)
        assertEquals(3, p.days)
    }

    @Test fun `when needed`() {
        val p = parse("Tab Dolo 650mg SOS")
        assertEquals("Dolo", p.name)
        assertTrue(p.prn)
        assertEquals(listOf("Dolo", "650 mg", "only when needed"), echo(p))
    }

    @Test fun `leading-dot strengths and bedtime`() {
        val p = parse("Tab Clonazepam .5mg HS")
        assertEquals(Strength(0.5, Unit.Mg), p.strength)
        assertEquals(listOf(RoutineId.Bed), p.slots)
        assertEquals("0.5 mg", echo(p)[1])
    }

    @Test fun `units are spelled out`() {
        assertEquals(Strength(10.0, Unit.Units), parse("Insulin 10 u 1-0-1").strength)
        assertEquals(Unit.Iu, parse("Vitamin D3 60000 IU weekly").strength?.unit)
    }

    @Test fun `four-part pattern and halves`() {
        val p = parse("Tab Thyronorm ½-0-0-1")
        assertEquals(listOf(RoutineId.Breakfast, RoutineId.Bed), p.slots)
        assertEquals(0.5, p.amount)
    }

    @Test fun `durations in weeks`() = assertEquals(14, parse("Amoxicillin 500mg 1-1-1 for 2 weeks").days)

    @Test fun `a name alone is not understood`() = assertFalse(understood(parse("Metformin")))

    @Test fun `names with digits survive`() = assertEquals("Vitamin D3", parse("Vitamin D3 60000 IU weekly").name)

    @Test fun `a scanned label finds the line that reads as shorthand`() {
        val lines = listOf("Dr. A Rao, MBBS", "Rx", "Tab Metformin 500mg 1-0-1 PC", "Review in 1 month")
        assertEquals("Tab Metformin 500mg 1-0-1 PC", shorthandFromScan(lines))
        assertEquals("Metformin 500mg 1-0-1", shorthandFromScan(listOf("Metformin 500mg", "1-0-1", "x")))
    }
}
