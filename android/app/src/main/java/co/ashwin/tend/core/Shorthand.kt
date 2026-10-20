package co.ashwin.tend.core

import java.text.NumberFormat
import java.util.Locale


data class Parsed(
    val name: String = "",
    val strength: Strength? = null,
    val form: Form? = null,
    val amount: Double? = null,
    val amounts: Map<RoutineId, Double>? = null,
    val doseUnit: DoseUnit? = null,
    val slots: List<RoutineId>? = null,
    val prn: Boolean = false,
    val stat: Boolean = false,
    val weekly: Boolean = false,
    val everyDays: Int? = null,
    val food: Food? = null,
    val days: Int? = null,
)

private val FORMS = mapOf(
    "TAB" to Form.Tablet, "TABLET" to Form.Tablet,
    "CAP" to Form.Capsule, "CAPSULE" to Form.Capsule,
    "SYP" to Form.Liquid, "SYRUP" to Form.Liquid, "SUSP" to Form.Liquid,
    "INJ" to Form.Injection,
    "DROPS" to Form.Drops, "DROP" to Form.Drops,
    "OINT" to Form.Cream, "CREAM" to Form.Cream, "GEL" to Form.Cream,
    "PUFF" to Form.Puff, "PUFFS" to Form.Puff, "INHALER" to Form.Puff,
    "PATCH" to Form.Patch,
)

private val B = RoutineId.Breakfast
private val L = RoutineId.Lunch
private val D = RoutineId.Dinner
private val H = RoutineId.Bed

private sealed interface Freq {
    data class Slots(val slots: List<RoutineId>) : Freq
    data object Prn : Freq
    data object Stat : Freq
}

private val FREQ: Map<String, Freq> = mapOf(
    "OD" to Freq.Slots(listOf(B)),
    "QD" to Freq.Slots(listOf(B)),
    "BD" to Freq.Slots(listOf(B, D)),
    "BID" to Freq.Slots(listOf(B, D)),
    "TDS" to Freq.Slots(listOf(B, L, D)),
    "TID" to Freq.Slots(listOf(B, L, D)),
    "QID" to Freq.Slots(listOf(B, L, D, H)),
    "HS" to Freq.Slots(listOf(H)),
    "SOS" to Freq.Prn,
    "PRN" to Freq.Prn,
    "STAT" to Freq.Stat,
)

private val THREE = listOf(B, L, D)
private val FOUR = listOf(B, L, D, H)

private val ic = RegexOption.IGNORE_CASE
private val UNIT = Regex("(\\d*\\.?\\d+)\\s*(mg|mcg|µg|g|ml|iu|units?|u)\\b", ic)
private val PATTERN = Regex("(?:^|\\s)([0-9½]+)\\s*-\\s*([0-9½]+)\\s*-\\s*([0-9½]+)(?:\\s*-\\s*([0-9½]+))?(?=\\s|$)")
private val DURATION = Regex("\\b(?:x|for)\\s*(\\d+)\\s*(days?|d|weeks?|wks?|w|months?|m)\\b", ic)

private fun amountOf(s: String): Double = when {
    s == "½" -> 0.5
    s.endsWith("½") -> (s.dropLast(1).toDoubleOrNull() ?: 0.0) + 0.5
    else -> s.toDoubleOrNull() ?: 0.0
}

private fun unitOf(raw: String): Unit = when (val u = raw.lowercase()) {
    "iu" -> Unit.Iu
    "u", "unit", "units" -> Unit.Units
    "µg", "mcg" -> Unit.Mcg
    "mg" -> Unit.Mg
    "g" -> Unit.G
    "ml" -> Unit.Ml
    else -> error("unit $u")
}

private fun titleCase(s: String) = s.split(Regex("\\s+")).filter { it.isNotEmpty() }
    .joinToString(" ") { w -> if (w == w.lowercase()) w.replaceFirstChar { it.uppercase() } else w }

fun parse(line: String): Parsed {
    var rest = " ${line.replace(Regex("\\s+"), " ").trim()} "
    var out = Parsed()
    fun take(re: Regex): MatchResult? {
        val m = re.find(rest)
        if (m != null) rest = rest.replaceFirst(m.value, " ")
        return m
    }

    val pattern = take(PATTERN)
    if (pattern != null) {
        val parts = (1..4).mapNotNull { pattern.groups[it]?.value }
        val names = if (parts.size == 4) FOUR else THREE
        val slots = mutableListOf<RoutineId>()
        val amounts = linkedMapOf<RoutineId, Double>()
        var amount = 0.0
        parts.forEachIndexed { i, p ->
            val n = amountOf(p)
            val slot = names.getOrNull(i)
            if (n > 0 && slot != null) {
                slots += slot
                amounts[slot] = n
                if (amount == 0.0) amount = n
            }
        }
        out = out.copy(slots = slots, amounts = amounts, amount = if (amount != 0.0) amount else null)
    }

    if (pattern != null && take(Regex("\\bunits?\\b", ic)) != null) {
        out = out.copy(doseUnit = DoseUnit.Units, form = Form.Injection)
    }

    take(DURATION)?.let { dur ->
        val n = dur.groupValues[1].toInt()
        val u = dur.groupValues[2].lowercase()[0]
        out = out.copy(days = if (u == 'w') n * 7 else if (u == 'm') n * 30 else n)
    }

    take(UNIT)?.let { s -> out = out.copy(strength = Strength(s.groupValues[1].toDouble(), unitOf(s.groupValues[2]))) }

    out = when {
        take(Regex("\\b(?:AC|before (?:food|meals?))\\b\\.?", ic)) != null -> out.copy(food = Food.Before)
        take(Regex("\\b(?:PC|after (?:food|meals?))\\b\\.?", ic)) != null -> out.copy(food = Food.After)
        take(Regex("\\bwith (?:food|meals?)\\b", ic)) != null -> out.copy(food = Food.With)
        take(Regex("\\b(?:empty stomach|on an empty stomach)\\b", ic)) != null -> out.copy(food = Food.Empty)
        else -> out
    }

    if (take(Regex("\\b(?:weekly|once a week|every week)\\b", ic)) != null) out = out.copy(weekly = true)
    if (take(Regex("\\b(?:alternate days?|every other day|EOD)\\b", ic)) != null) out = out.copy(everyDays = 2)

    for (word in rest.trim().split(" ")) {
        val k = word.uppercase().removeSuffix(".")
        val freq = FREQ[k]
        if (freq != null) {
            out = when (freq) {
                Freq.Prn -> out.copy(prn = true)
                Freq.Stat -> out.copy(stat = true)
                is Freq.Slots -> when {
                    out.slots == null -> out.copy(slots = freq.slots)
                    k == "HS" && H !in out.slots -> out.copy(slots = out.slots + H)
                    else -> out
                }
            }
            rest = rest.replaceFirst(" $word ", " ")
            continue
        }
        val form = FORMS[k]
        if (form != null) {
            if (out.form == null) out = out.copy(form = form)
            rest = rest.replaceFirst(" $word ", " ")
        }
    }

    if (out.form == Form.Liquid && out.strength?.unit == Unit.Ml) {
        out = out.copy(amount = out.strength.value, strength = null)
    }

    if (out.form == Form.Injection && out.strength?.unit == Unit.Units) {
        val amount = out.strength.value
        out = out.copy(
            doseUnit = DoseUnit.Units,
            amount = amount,
            amounts = out.slots?.associateWith { amount } ?: out.amounts,
            strength = null,
        )
    }

    return out.copy(name = titleCase(rest.replace(Regex("[,;]+"), " ").trim()))
}

private val SLOT_WORD = mapOf(
    RoutineId.Wake to "on waking",
    RoutineId.Breakfast to "morning",
    RoutineId.Lunch to "afternoon",
    RoutineId.Dinner to "night",
    RoutineId.Bed to "bedtime",
)

private val enNum = NumberFormat.getNumberInstance(Locale.ENGLISH)

fun echo(p: Parsed): List<String> {
    val out = mutableListOf<String>()
    if (p.name.isNotEmpty()) out += p.name
    p.strength?.let { out += "${enNum.format(it.value)} ${it.unit.label}" }
    val slots = p.slots
    if (!slots.isNullOrEmpty()) {
        val words = slots.map { SLOT_WORD.getValue(it) }.toMutableList()
        if (slots.size == 4 && H !in slots) words[2] = "evening"
        out += words.mapIndexed { i, w ->
            val amount = p.amounts?.get(slots[i]) ?: p.amount ?: 1.0
            val n = if (amount == 0.5) "half" else enNum.format(amount)
            "$n${if (p.doseUnit != null) " units" else if (p.form == Form.Liquid) " ml" else ""} $w"
        }.joinToString(", ")
    } else if (p.prn) out += "only when needed"
    else if (p.stat) out += "once, right away"
    if (p.weekly) out += "once a week"
    if (p.everyDays == 2) out += "every other day"
    p.food?.let { out += FOOD_TEXT.getValue(it) }
    p.days?.let { out += "for $it days" }
    return out
}

fun understood(p: Parsed) = p.name.isNotEmpty() && (!p.slots.isNullOrEmpty() || p.prn || p.stat)

/** Picks the most useful text from a scanned label: a line that parses, or the first few lines. */
fun shorthandFromScan(lines: List<String>): String {
    val clean = lines.map { it.replace(Regex("\\s+"), " ").trim() }.filter { it.length > 1 }
    clean.firstOrNull { understood(parse(it)) }?.let { return it }
    for (i in clean.indices) {
        val joined = clean.subList(i, minOf(clean.size, i + 3)).joinToString(" ")
        if (understood(parse(joined))) return joined
    }
    return clean.take(3).joinToString(" ").take(80)
}
