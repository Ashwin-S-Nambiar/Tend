package co.ashwin.tend

import co.ashwin.tend.core.Anchor
import co.ashwin.tend.core.Course
import co.ashwin.tend.core.DoseLog
import co.ashwin.tend.core.DoseStatus
import co.ashwin.tend.core.DoseUnit
import co.ashwin.tend.core.Food
import co.ashwin.tend.core.Form
import co.ashwin.tend.core.Look
import co.ashwin.tend.core.Medicine
import co.ashwin.tend.core.RoutineId
import co.ashwin.tend.core.Schedule
import co.ashwin.tend.core.Shape
import co.ashwin.tend.core.Stock
import co.ashwin.tend.core.Strength
import co.ashwin.tend.core.Unit
import co.ashwin.tend.core.addDays
import co.ashwin.tend.core.dayKey
import co.ashwin.tend.core.dosesOn
import co.ashwin.tend.core.nowKey
import co.ashwin.tend.data.Repo

/** Debug builds only: tend://debug/sample loads the canvas's sample medicines and a week of logs. */
object Sample {
    /** tend://debug/widgets renders each widget's real views as PNGs in the cache folder. */
    fun renderWidgets(context: android.content.Context) {
        val dir = java.io.File(context.cacheDir, "widgets").apply { mkdirs() }
        val d = context.resources.displayMetrics.density
        listOf(
            Triple("next", co.ashwin.tend.widget.Widgets.next(context), 320 to 180),
            Triple("small", co.ashwin.tend.widget.Widgets.small(context), 180 to 80),
            Triple("week", co.ashwin.tend.widget.Widgets.week(context), 250 to 170),
        ).forEach { (name, views, size) ->
            val parent = android.widget.FrameLayout(context)
            val v = views.apply(context, parent)
            val w = (size.first * d).toInt()
            val h = (size.second * d).toInt()
            v.measure(android.view.View.MeasureSpec.makeMeasureSpec(w, android.view.View.MeasureSpec.EXACTLY), android.view.View.MeasureSpec.makeMeasureSpec(h, android.view.View.MeasureSpec.EXACTLY))
            v.layout(0, 0, w, h)
            val bmp = android.graphics.Bitmap.createBitmap(w, h, android.graphics.Bitmap.Config.ARGB_8888)
            v.draw(android.graphics.Canvas(bmp))
            java.io.File(dir, "$name.png").outputStream().use { bmp.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it) }
        }
    }

    fun load() {
        val today = dayKey()
        val start = addDays(today, -10)
        val r = { id: RoutineId, off: Int, amount: Double? -> Anchor.AtRoutine(id, off, amount) }
        val meds = listOf(
            Medicine("met", "Metformin", Strength(500.0, Unit.Mg), Form.Tablet, 1.0, food = Food.After,
                look = Look(Shape.Round, listOf("#ffffff")), schedule = Schedule.Daily(listOf(r(RoutineId.Breakfast, 0, null), r(RoutineId.Dinner, 0, null))),
                stock = Stock(6.0, 7, 30.0), created = "${start}T08:00"),
            Medicine("api", "Apidra", form = Form.Injection, amount = 14.0, doseUnit = DoseUnit.Units, insulin = true, food = Food.Before,
                look = Look(Shape.Oval, listOf("#8fc6e8")),
                schedule = Schedule.Daily(listOf(r(RoutineId.Breakfast, -15, 14.0), r(RoutineId.Lunch, -15, 8.0), r(RoutineId.Dinner, -15, 6.0))),
                stock = Stock(212.0, 7, 300.0), created = "${start}T08:00"),
            Medicine("lan", "Lantus", form = Form.Injection, amount = 24.0, doseUnit = DoseUnit.Units, insulin = true,
                look = Look(Shape.Oval, listOf("#8fc6e8")), schedule = Schedule.Daily(listOf(r(RoutineId.Bed, 0, null))), created = "${start}T08:00"),
            Medicine("amx", "Amoxicillin", Strength(500.0, Unit.Mg), Form.Capsule, 1.0, food = Food.After,
                look = Look(Shape.Cap, listOf("#e9a23b", "#f6d57a")),
                schedule = Schedule.Daily(listOf(r(RoutineId.Breakfast, 0, null), r(RoutineId.Lunch, 0, null), r(RoutineId.Dinner, 0, null))),
                course = Course(addDays(today, -2), 5), created = "${start}T08:00"),
            Medicine("d3", "Vitamin D3", Strength(60000.0, Unit.Iu), Form.Capsule, 1.0,
                look = Look(Shape.Cap, listOf("#f2c230", "#f2c230")), schedule = Schedule.Weekdays(listOf(6), listOf(r(RoutineId.Breakfast, 0, null))), created = "${start}T08:00"),
            Medicine("par", "Paracetamol", Strength(650.0, Unit.Mg), Form.Tablet, 1.0,
                look = Look(Shape.Oval, listOf("#ffffff")), schedule = Schedule.Prn(6.0, 4), created = "${start}T08:00"),
        )
        val now = nowKey()
        val logs = mutableListOf<DoseLog>()
        for (i in 1..7) {
            val day = addDays(today, -i)
            for (d in dosesOn(meds, Repo.now.settings.routines, day)) {
                if (d.due > now) continue
                val skipped = (d.due.hashCode() and 7) == 0
                logs += DoseLog(d.medId, d.due, if (skipped) DoseStatus.Skipped else DoseStatus.Taken, d.amount, if (skipped) d.due else d.due.dropLast(1) + "4")
            }
        }
        Repo.update { it.copy(meds = meds, logs = logs, settings = it.settings.copy(onboarded = true)) }
    }
}
