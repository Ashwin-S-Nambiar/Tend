package co.ashwin.tend.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class DoseFormatTest {
    @Test fun `no trailing zeros, always a leading zero`() {
        assertEquals("1", fmtNum(1.0))
        assertEquals("0.5", fmtNum(0.5))
        assertEquals("60,000", fmtNum(60000.0))
    }

    @Test fun `amounts read as fractions`() {
        assertEquals("½", fmtAmount(0.5))
        assertEquals("1½", fmtAmount(1.5))
        assertEquals("2", fmtAmount(2.0))
    }

    @Test fun `plural forms`() {
        assertEquals("1 tablet", fmtDose(Form.Tablet, 1.0))
        assertEquals("2 tablets", fmtDose(Form.Tablet, 2.0))
        assertEquals("½ tablet", fmtDose(Form.Tablet, 0.5))
        assertEquals("5 ml", fmtDose(Form.Liquid, 5.0))
        assertEquals("2 puffs", fmtDose(Form.Puff, 2.0))
    }

    @Test fun `a dose line`() {
        val med = base.copy(name = "Metformin", strength = Strength(500.0, Unit.Mg), food = Food.After)
        assertEquals("500 mg · 1 tablet · after food", doseLine(med))
    }

    @Test fun `anchors in plain words, never abbreviations`() {
        assertEquals("30 min before breakfast", anchorText(br(-30)))
        assertEquals("at bedtime", anchorText(bed()))
        assertEquals("on waking", anchorText(Anchor.AtRoutine(RoutineId.Wake, 0)))
        val text = scheduleText(Schedule.Daily(listOf(di(), br())))
        assertEquals("Every day, at breakfast and at dinner", text)
        assertFalse(Regex("\\b(OD|BD|QD|TDS)\\b").containsMatchIn(text))
    }

    @Test fun `weekday schedules`() =
        assertEquals("Saturdays, at breakfast", scheduleText(Schedule.Weekdays(listOf(6), listOf(br()))))
}
