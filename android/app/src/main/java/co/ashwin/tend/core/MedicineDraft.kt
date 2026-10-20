package co.ashwin.tend.core

import java.util.UUID
import kotlin.math.abs


enum class MedicineType(val label: String, val form: Form) {
    Tablet("Tablet", Form.Tablet),
    Capsule("Capsule", Form.Capsule),
    Liquid("Liquid", Form.Liquid),
    Insulin("Insulin", Form.Injection),
    Injection("Injection", Form.Injection),
    Puff("Inhaler", Form.Puff),
    Drops("Drops", Form.Drops),
    Cream("Cream / gel", Form.Cream),
    Patch("Patch", Form.Patch),
}

data class FormFields(
    val amountLabel: String,
    val noun: String,
    val strengthExample: String,
    val stockUnit: String? = null,
    val siteLabel: String? = null,
    val siteExample: String? = null,
)

val FORM_FIELDS = mapOf(
    Form.Tablet to FormFields("Tablets per dose", "tablets", "500 mg", "tablets"),
    Form.Capsule to FormFields("Capsules per dose", "capsules", "20 mg", "capsules"),
    Form.Liquid to FormFields("Volume per dose", "ml", "250 mg / 5 ml", "ml"),
    Form.Puff to FormFields("Puffs per dose", "puffs", "100 mcg / puff", "puffs"),
    Form.Drops to FormFields("Drops per application", "drops", "0.5%", siteLabel = "Where to use (optional)", siteExample = "Both eyes, left eye, or right ear"),
    Form.Injection to FormFields("Amount per dose", "injections", "40 mg / 0.4 ml"),
    Form.Cream to FormFields("Amount to apply (optional)", "applications", "1%", siteLabel = "Where to apply (optional)", siteExample = "Affected area, or left arm"),
    Form.Patch to FormFields("Patches per change", "patches", "25 mcg / hour", "patches", "Application instructions (optional)", "Rotate the application site as prescribed"),
)

private val INSULIN_NAMES = Regex("\\b(insulin|apidra|lantus|humalog|novorapid|fiasp|tresiba|levemir|toujeo|novomix)\\b", RegexOption.IGNORE_CASE)

/** Recognises insulin entries saved before the type was recorded explicitly. */
fun isInsulin(med: Medicine): Boolean =
    med.insulin ?: (med.form == Form.Injection && med.doseUnit == DoseUnit.Units && INSULIN_NAMES.containsMatchIn(med.name))

fun hasFoodTiming(form: Form) = form == Form.Tablet || form == Form.Capsule || form == Form.Liquid

private val WHOLE_FORMS = setOf(Form.Capsule, Form.Drops, Form.Puff, Form.Patch)

fun wholeOnly(form: Form) = form in WHOLE_FORMS

/** The choice in the editor's dose-unit control; Default means the form's own noun. */
enum class DraftUnit(val unit: DoseUnit?) { Default(null), Units(DoseUnit.Units), Ml(DoseUnit.Ml), Mg(DoseUnit.Mg), Mcg(DoseUnit.Mcg) }

fun DoseUnit?.toDraft(): DraftUnit = DraftUnit.entries.first { it.unit == this }

data class ClockTime(val id: Long, val t: String)

data class Draft(
    val name: String = "",
    val strength: String = "",
    val unit: Unit = Unit.Mg,
    val form: Form = Form.Tablet,
    val amount: Double = 1.0,
    val food: Food? = null,
    val shape: Shape = Shape.Round,
    val colors: List<String> = listOf("#ffffff"),
    val kind: Schedule.Kind = Schedule.Kind.Daily,
    val routines: List<RoutineId> = listOf(RoutineId.Breakfast),
    val times: List<ClockTime> = emptyList(),
    val before: Boolean = false,
    val beforeMin: Int = 30,
    val doseUnit: DraftUnit = DraftUnit.Default,
    val insulin: Boolean = false,
    val strengthLabel: String = "",
    val instructions: String = "",
    val site: String = "",
    val variable: Boolean = false,
    val amounts: Map<String, String> = emptyMap(),
    val offsets: Map<RoutineId, Int> = emptyMap(),
    val days: List<Int> = emptyList(),
    val everyDays: Int = 2,
    val on: Int = 21,
    val off: Int = 7,
    val once: String = "",
    val gap: Double = 0.0,
    val limitGap: Boolean = false,
    val limitMax: Boolean = false,
    val max: Int = 0,
    val course: Boolean = false,
    val courseDays: Int = 5,
    val start: String = "",
    val stock: Boolean = false,
    val count: Double = 30.0,
    val refill: Int = 7,
    val pack: Double = 10.0,
    val notes: String = "",
) {
    val type: MedicineType get() = if (insulin) MedicineType.Insulin else MedicineType.entries.first { it.form == form && it != MedicineType.Insulin }
    val scheduled: Boolean get() = kind != Schedule.Kind.Once && kind != Schedule.Kind.Prn
}

fun blank(): Draft {
    val today = dayKey()
    return Draft(days = listOf(weekday(today)), once = "${today}T09:00", start = today)
}

fun lookFor(form: Form): Pair<Shape, List<String>> = when (form) {
    Form.Capsule -> Shape.Cap to listOf("#e9a23b", "#f6d57a")
    Form.Tablet -> Shape.Round to listOf("#ffffff")
    Form.Liquid -> Shape.Oval to listOf("#f08a6c")
    else -> Shape.Oval to listOf("#8fc6e8")
}

private fun Double.str(): String = fmtNum(this).replace(",", "")

fun fromParsed(d: Draft, p: Parsed): Draft {
    val type = if (p.form == Form.Injection && p.doseUnit == DoseUnit.Units) MedicineType.Insulin
    else p.form?.let { f -> MedicineType.entries.first { it.form == f && it != MedicineType.Insulin } }
    var next = if (type != null) selectMedicineType(d, type) else d
    if (p.name.isNotEmpty()) next = next.copy(name = p.name)
    p.strength?.let { next = next.copy(strengthLabel = "", strength = it.value.str(), unit = it.unit) }
    p.amount?.let { next = next.copy(amount = it) }
    p.amounts?.let { a ->
        next = next.copy(amounts = a.entries.associate { (k, v) -> k.key to v.str() }, variable = a.values.toSet().size > 1)
    }
    p.doseUnit?.let { next = next.copy(doseUnit = it.toDraft()) }
    if (p.form == Form.Injection && p.doseUnit == DoseUnit.Units) next = next.copy(insulin = true)
    if (p.form == Form.Injection && p.food == Food.Before) next = next.copy(beforeMin = 15)
    p.everyDays?.let { next = next.copy(everyDays = it) }
    p.food?.let { next = next.copy(food = it, before = it == Food.Before) }
    if (!p.slots.isNullOrEmpty()) {
        next = next.copy(
            routines = p.slots,
            times = emptyList(),
            kind = when {
                p.weekly -> Schedule.Kind.Weekdays
                p.everyDays != null -> Schedule.Kind.Interval
                else -> Schedule.Kind.Daily
            },
        )
    }
    if (p.prn) next = next.copy(kind = Schedule.Kind.Prn)
    if (p.stat) next = next.copy(kind = Schedule.Kind.Once, once = nowKey())
    p.days?.let { next = next.copy(course = true, courseDays = it) }
    return next
}

fun fromMed(m: Medicine): Draft {
    val d = blank()
    val s = m.schedule
    val at = s.anchors.orEmpty()
    return d.copy(
        name = m.name,
        strength = m.strength?.value?.str() ?: "",
        unit = m.strength?.unit ?: Unit.Mg,
        doseUnit = m.doseUnit.toDraft(),
        insulin = isInsulin(m),
        strengthLabel = m.strengthLabel ?: "",
        instructions = m.instructions ?: "",
        site = m.site ?: "",
        variable = at.any { it.amount != null },
        amounts = at.mapIndexed { i, a ->
            (if (a is Anchor.AtRoutine) a.routine.key else "time-$i") to (a.amount ?: m.amount).str()
        }.toMap(),
        offsets = at.filterIsInstance<Anchor.AtRoutine>().associate { it.routine to it.offsetMin },
        beforeMin = abs(
            at.filterIsInstance<Anchor.AtRoutine>()
                .firstOrNull { it.offsetMin < 0 && it.routine != RoutineId.Wake && it.routine != RoutineId.Bed }
                ?.offsetMin ?: 30,
        ),
        form = m.form,
        amount = m.amount,
        food = m.food,
        shape = m.look.shape,
        colors = m.look.colors,
        kind = s.kind,
        routines = at.filterIsInstance<Anchor.AtRoutine>().map { it.routine },
        times = at.mapIndexedNotNull { i, a -> (a as? Anchor.AtTime)?.let { ClockTime(i.toLong(), it.time) } },
        before = at.any { it is Anchor.AtRoutine && it.offsetMin < 0 },
        days = (s as? Schedule.Weekdays)?.days ?: d.days,
        everyDays = (s as? Schedule.Interval)?.everyDays ?: d.everyDays,
        on = (s as? Schedule.Cycle)?.on ?: d.on,
        off = (s as? Schedule.Cycle)?.off ?: d.off,
        once = (s as? Schedule.Once)?.`when` ?: d.once,
        gap = (s as? Schedule.Prn)?.minGapH ?: d.gap,
        limitGap = s is Schedule.Prn && s.minGapH != null,
        limitMax = s is Schedule.Prn && s.maxPerDay != null,
        max = (s as? Schedule.Prn)?.maxPerDay ?: d.max,
        start = (s as? Schedule.Interval)?.start ?: (s as? Schedule.Cycle)?.start ?: m.course?.start ?: d.start,
        course = m.course != null,
        courseDays = m.course?.days ?: d.courseDays,
        stock = m.stock != null,
        count = m.stock?.count ?: d.count,
        refill = m.stock?.refillAtDays ?: d.refill,
        pack = m.stock?.pack ?: d.pack,
        notes = m.notes ?: "",
    )
}

private fun amountOf(raw: String?): Double = raw?.toDoubleOrNull() ?: Double.NaN

fun anchors(d: Draft): List<Anchor> {
    val off = if (d.before) -d.beforeMin else 0
    return ROUTINE_ORDER.filter { it in d.routines }.map { r ->
        Anchor.AtRoutine(
            routine = r,
            offsetMin = d.offsets[r] ?: if (r == RoutineId.Wake || r == RoutineId.Bed) 0 else off,
            amount = if (d.variable) amountOf(d.amounts[r.key]) else null,
        )
    } + d.times.map { x ->
        Anchor.AtTime(x.t, if (d.variable) amountOf(d.amounts["time-${x.id}"]) else null)
    }
}

fun insulinDraft(d: Draft, bedtime: Boolean = false): Draft {
    val (shape, colors) = lookFor(Form.Injection)
    return d.copy(
        form = Form.Injection,
        insulin = true,
        doseUnit = DraftUnit.Units,
        strength = "",
        strengthLabel = "",
        shape = shape,
        colors = colors,
        kind = Schedule.Kind.Daily,
        routines = if (bedtime) listOf(RoutineId.Bed) else listOf(RoutineId.Breakfast, RoutineId.Lunch, RoutineId.Dinner),
        times = emptyList(),
        food = if (bedtime) null else Food.Before,
        before = !bedtime,
        beforeMin = 15,
        variable = !bedtime,
        amounts = emptyMap(),
        offsets = emptyMap(),
        amount = if (bedtime) 0.0 else d.amount,
    )
}

fun newId(): String = UUID.randomUUID().toString().take(8)

fun toMed(d: Draft, prev: Medicine? = null): Medicine {
    val at = anchors(d)
    val schedule: Schedule = when (d.kind) {
        Schedule.Kind.Daily -> Schedule.Daily(at)
        Schedule.Kind.Weekdays -> Schedule.Weekdays(d.days, at)
        Schedule.Kind.Interval -> Schedule.Interval(d.everyDays, d.start, at)
        Schedule.Kind.Cycle -> Schedule.Cycle(d.on, d.off, d.start, at)
        Schedule.Kind.Once -> Schedule.Once(d.once)
        Schedule.Kind.Prn -> Schedule.Prn(
            minGapH = if (d.limitGap) d.gap else null,
            maxPerDay = if (d.limitMax) d.max else null,
        )
    }
    val value = d.strength.toDoubleOrNull() ?: 0.0
    return Medicine(
        id = prev?.id ?: newId(),
        created = prev?.created ?: nowKey(),
        name = d.name.trim(),
        strength = if (d.strength.isNotEmpty() && value > 0) Strength(value, d.unit) else null,
        form = d.form,
        amount = if (d.variable && d.scheduled && at.isNotEmpty()) at[0].amount ?: d.amount else d.amount,
        doseUnit = d.doseUnit.unit,
        insulin = if (d.form == Form.Injection) d.insulin else null,
        strengthLabel = d.strengthLabel.trim().ifEmpty { null },
        instructions = d.instructions.trim().ifEmpty { null },
        site = d.site.trim().ifEmpty { null },
        food = d.food,
        look = Look(d.shape, d.colors.take(2)),
        schedule = schedule,
        course = if (d.course && d.scheduled) Course(d.start, d.courseDays) else null,
        stock = if (d.stock) Stock(d.count, d.refill, d.pack) else null,
        notes = d.notes.trim().ifEmpty { null },
        archived = prev?.archived,
    )
}

fun selectMedicineType(d: Draft, type: MedicineType): Draft {
    val form = type.form
    if (form == d.form && (type == MedicineType.Insulin) == d.insulin) return d
    val (shape, colors) = lookFor(form)
    val next = d.copy(
        form = form,
        insulin = type == MedicineType.Insulin,
        shape = shape,
        colors = colors,
        strength = "",
        strengthLabel = "",
        instructions = "",
        site = "",
        amount = if (form == Form.Injection) 0.0 else 1.0,
        doseUnit = if (form == Form.Liquid || form == Form.Injection) DraftUnit.Ml else DraftUnit.Default,
        food = null,
        before = false,
        offsets = emptyMap(),
        variable = false,
        amounts = emptyMap(),
        stock = false,
    )
    return if (type == MedicineType.Insulin) insulinDraft(next) else next
}

private fun Double.isWhole() = isFinite() && this == kotlin.math.floor(this)

fun detailsProblem(d: Draft): String? {
    if (d.name.isBlank()) return "Give it a name"
    if (!d.insulin && d.form != Form.Cream && (!d.amount.isFinite() || d.amount <= 0)) return "Enter a dose greater than zero"
    if (wholeOnly(d.form) && !d.amount.isWhole()) return "Use a whole number for this medicine"
    return null
}

fun problem(d: Draft): String? {
    detailsProblem(d)?.let { return it }
    val at = anchors(d)
    if (d.scheduled && at.isEmpty()) return "Pick at least one time"
    if (d.kind == Schedule.Kind.Weekdays && d.days.isEmpty()) return "Pick at least one day"
    if (d.variable && d.scheduled) {
        if (at.any { val a = it.amount ?: Double.NaN; !a.isFinite() || a <= 0 }) return "Enter a dose greater than zero for each reminder"
    } else if (!d.amount.isFinite() || d.amount <= 0) return "Enter a dose greater than zero"
    if (d.kind == Schedule.Kind.Prn) {
        if (d.limitGap && (!d.gap.isFinite() || d.gap <= 0)) return "Enter the prescribed minimum gap"
        if (d.limitMax && d.max <= 0) return "Enter the prescribed daily limit"
    }
    if (d.stock && (!d.count.isFinite() || d.count < 0 || !d.pack.isFinite() || d.pack <= 0)) return "Enter a valid remaining supply and refill amount"
    if (d.variable && wholeOnly(d.form) && at.any { !(it.amount ?: Double.NaN).isWhole() }) return "Use a whole number for each reminder"
    val times = d.times.map { it.t }
    if (times.toSet().size != times.size) return "Each clock time must be different"
    return null
}
