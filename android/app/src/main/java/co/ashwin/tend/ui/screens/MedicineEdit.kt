package co.ashwin.tend.ui.screens

import android.app.DatePickerDialog
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.toggleableState
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import co.ashwin.tend.core.Anchor
import co.ashwin.tend.core.ClockTime
import co.ashwin.tend.core.DEFAULT_ROUTINES
import co.ashwin.tend.core.Draft
import co.ashwin.tend.core.DraftUnit
import co.ashwin.tend.core.FORM_FIELDS
import co.ashwin.tend.core.Food
import co.ashwin.tend.core.Form
import co.ashwin.tend.core.Look
import co.ashwin.tend.core.Medicine
import co.ashwin.tend.core.MedicineType
import co.ashwin.tend.core.Parsed
import co.ashwin.tend.core.ROUTINE_NAME
import co.ashwin.tend.core.ROUTINE_ORDER
import co.ashwin.tend.core.Routine
import co.ashwin.tend.core.RoutineId
import co.ashwin.tend.core.Schedule
import co.ashwin.tend.core.Shape
import co.ashwin.tend.core.anchorText
import co.ashwin.tend.core.blank
import co.ashwin.tend.core.detailsProblem
import co.ashwin.tend.core.doseLine
import co.ashwin.tend.core.echo
import co.ashwin.tend.core.fmtDay
import co.ashwin.tend.core.fmtStrength
import co.ashwin.tend.core.fmtTime
import co.ashwin.tend.core.fromMed
import co.ashwin.tend.core.fromMin
import co.ashwin.tend.core.fromParsed
import co.ashwin.tend.core.hasFoodTiming
import co.ashwin.tend.core.medicineDose
import co.ashwin.tend.core.parse
import co.ashwin.tend.core.parseDay
import co.ashwin.tend.core.problem
import co.ashwin.tend.core.putMed
import co.ashwin.tend.core.scheduleText
import co.ashwin.tend.core.selectMedicineType
import co.ashwin.tend.core.shorthandFromScan
import co.ashwin.tend.core.toMed
import co.ashwin.tend.core.toMin
import co.ashwin.tend.core.understood
import co.ashwin.tend.core.wholeOnly
import co.ashwin.tend.data.Repo
import co.ashwin.tend.feel.Feels
import co.ashwin.tend.feel.Haptic
import co.ashwin.tend.feel.Sound
import co.ashwin.tend.ui.Btn
import co.ashwin.tend.ui.COLOR_NAME
import co.ashwin.tend.ui.Chips
import co.ashwin.tend.ui.Field
import co.ashwin.tend.ui.Ic
import co.ashwin.tend.ui.Icon
import co.ashwin.tend.ui.Kind
import co.ashwin.tend.ui.Label
import co.ashwin.tend.ui.LocalPalette
import co.ashwin.tend.ui.LocalReducedMotion
import co.ashwin.tend.ui.Opt
import co.ashwin.tend.ui.Optional
import co.ashwin.tend.ui.PILL_COLORS
import co.ashwin.tend.ui.Pill
import co.ashwin.tend.ui.Segmented
import co.ashwin.tend.ui.Sheet
import co.ashwin.tend.ui.Stepper
import co.ashwin.tend.ui.SwitchRow
import co.ashwin.tend.ui.TimeWheel
import co.ashwin.tend.ui.Txt
import co.ashwin.tend.ui.body
import co.ashwin.tend.ui.display
import co.ashwin.tend.ui.hex
import co.ashwin.tend.ui.numberText
import co.ashwin.tend.ui.rememberStored
import co.ashwin.tend.ui.shown
import co.ashwin.tend.ui.tap
import co.ashwin.tend.ui.toast
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.io.File

private val STEPS = listOf("Medicine", "Schedule", "Review")
private val WEEK = listOf(1, 2, 3, 4, 5, 6, 0)
private val WEEK_SHORT = listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")
private val WEEK_LONG = listOf("Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday")

private fun reminderTimes(anchor: Anchor, routines: List<Routine>): String = when (anchor) {
    is Anchor.AtTime -> fmtTime(anchor.time)
    is Anchor.AtRoutine -> {
        val r = routines.find { it.id == anchor.routine }
        if (r == null) "" else {
            fun t(v: String) = fmtTime(fromMin(((toMin(v) + anchor.offsetMin) % 1440 + 1440) % 1440))
            if (r.weekend != null && r.weekend != r.weekday) "${t(r.weekday)} weekdays · ${t(r.weekend)} weekends" else t(r.weekday)
        }
    }
}

/** Add or edit a medicine in three steps, as a sheet. */
@Composable
fun MedicineEdit(id: String?, onDone: () -> Unit) {
    val p = LocalPalette.current
    val s = rememberStored()
    val prev = id?.let { i -> s.meds.find { it.id == i } }
    var open by remember { mutableStateOf(true) }
    var d by remember { mutableStateOf(prev?.let(::fromMed) ?: blank()) }
    var step by remember { mutableStateOf(0) }
    var tried by remember { mutableStateOf(false) }
    var timeEdits by remember { mutableStateOf(mapOf<RoutineId, String>()) }
    val saved = s.settings.routines
    val routines = DEFAULT_ROUTINES.map { fallback ->
        val base = saved.find { it.id == fallback.id } ?: fallback
        val edit = timeEdits[fallback.id]
        if (d.scheduled && fallback.id in d.routines && edit != null) base.copy(weekday = edit) else base
    }
    val changed = routines.filter { r -> r.weekday != (saved.find { it.id == r.id } ?: DEFAULT_ROUTINES.first { it.id == r.id }).weekday }
    val issue = if (step == 0) detailsProblem(d) else problem(d)
    val set: (Draft) -> Unit = { d = it }

    fun next() {
        tried = true
        if (issue != null) {
            Feels.haptic(Haptic.Warn)
            return
        }
        if (step < 2) {
            tried = false
            step += 1
            Feels.haptic(Haptic.Tick)
            return
        }
        val med = toMed(d, prev)
        val before = Repo.now.settings.routines
        val (data, undo) = putMed(Repo.now.data, med)
        Repo.update { st -> st.copy(meds = data.meds, settings = if (changed.isNotEmpty()) st.settings.copy(routines = routines) else st.settings) }
        Feels.sound(Sound.Taken)
        Feels.haptic(Haptic.Success)
        toast(if (prev != null) "${med.name} saved" else "${med.name} added") {
            Repo.edit(undo)
            if (changed.isNotEmpty()) Repo.settings { st ->
                st.copy(routines = st.routines.map { r ->
                    val c = changed.find { it.id == r.id }
                    val b = before.find { it.id == r.id } ?: DEFAULT_ROUTINES.find { it.id == r.id }
                    if (c != null && b != null && r.weekday == c.weekday) r.copy(weekday = b.weekday) else r
                })
            }
        }
        open = false
    }

    Sheet(
        open = open,
        onClose = { open = false },
        onClosed = onDone,
        label = if (prev != null) "Edit ${prev.name}" else "Add a medicine",
        page = step,
        header = {
            Column(Modifier.padding(top = 4.dp, bottom = 8.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(Modifier.size(48.dp).background(p.pipWash, RoundedCornerShape(16.dp)), contentAlignment = Alignment.Center) {
                        Pill(Look(d.shape, d.colors), d.form, 30.dp)
                    }
                    Column(Modifier.weight(1f)) {
                        Txt(if (prev != null) "Edit ${prev.name}" else "Add a medicine", body(13, 400, 1.3f, p.soft))
                        Txt(listOf("What do you take?", "When do you use it?", "Does this look right?")[step], display(24, 800, 1.15f, p.ink), Modifier.semantics { heading() })
                    }
                    Box(
                        Modifier.size(44.dp).tap(label = "Close medicine editor") { open = false }
                            .semantics { contentDescription = "Close medicine editor" }
                            .background(p.milk, RoundedCornerShape(14.dp)),
                        contentAlignment = Alignment.Center,
                    ) { Icon(Ic.Close, p.soft, size = 20.dp) }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    STEPS.forEachIndexed { i, name ->
                        val on = i <= step
                        Column(Modifier.weight(1f).semantics(mergeDescendants = true) { if (i == step) stateDescription = "Current step" }) {
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                                if (i < step) Icon(Ic.Check, p.pipInk, size = 14.dp) else Txt("${i + 1}.", body(13, 600, 1.2f, if (on) p.pipInk else p.soft))
                                Txt(name, body(13, 600, 1.2f, if (on) p.pipInk else p.soft), lines = 1)
                            }
                            Box(Modifier.padding(top = 8.dp).fillMaxWidth().height(3.dp).background(if (on) p.pip else p.line))
                        }
                    }
                }
            }
        },
        footer = {
            if (tried && issue != null) {
                Txt(issue, body(14, 600, 1.3f, p.danger).copy(textAlign = TextAlign.Center), Modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Assertive })
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Btn(if (step > 0) "Back" else "Cancel", Modifier.weight(1f), Kind.Soft) {
                    if (step > 0) { step -= 1; tried = false } else open = false
                }
                Btn(
                    when (step) { 2 -> if (prev != null) "Save changes" else "Add medicine"; 1 -> "Review"; else -> "Schedule" },
                    Modifier.weight(2f),
                    trailing = if (step < 2) Ic.Next else null,
                ) { next() }
            }
        },
    ) {
        val reduced = LocalReducedMotion.current
        AnimatedContent(
            step,
            transitionSpec = {
                val dir = if (targetState > initialState) 1 else -1
                if (reduced) fadeIn(tween(160)) togetherWith fadeOut(tween(120))
                else (slideInHorizontally(tween(260, easing = co.ashwin.tend.ui.EaseOut)) { it / 8 * dir } + fadeIn(tween(200))) togetherWith
                    (slideOutHorizontally(tween(180)) { -it / 12 * dir } + fadeOut(tween(120)))
            },
            label = "step",
        ) { st ->
            Column(Modifier.fillMaxWidth().padding(top = 4.dp, bottom = 8.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                when (st) {
                    0 -> MedicineFields(d, set, s.meds.map { it.name }, shorthand = prev == null) { parsed -> d = fromParsed(d, parsed) }
                    1 -> ScheduleFields(d, set, routines) { r, t -> timeEdits = timeEdits + (r to t) }
                    else -> ReviewFields(d, set, routines, changed, s.meds.filter { it.id != id && !it.isArchived }) { step = it; tried = false }
                }
            }
        }
    }
}

@Composable
private fun Amount(d: Draft, set: (Draft) -> Unit, label: String? = null) {
    val f = FORM_FIELDS.getValue(d.form)
    var typed by remember(d.form, d.insulin) { mutableStateOf(shown(d.amount)) }
    // Keeps a half-typed "1." while it means the same amount, but follows changes made elsewhere (shorthand).
    val text = if ((typed.toDoubleOrNull() ?: 0.0) == d.amount) typed else shown(d.amount)
    val whole = wholeOnly(d.form)
    Field(
        text,
        { raw ->
            typed = numberText(raw, !whole)
            set(d.copy(amount = typed.toDoubleOrNull() ?: 0.0))
        },
        label ?: if (d.insulin) "Units per dose" else f.amountLabel,
        placeholder = "Enter prescribed amount",
        keyboard = if (whole) KeyboardType.Number else KeyboardType.Decimal,
        trailing = { Txt(d.doseUnit.unit?.label ?: f.noun, body(15, 400, 1.3f, LocalPalette.current.soft), Modifier.padding(start = 8.dp)) },
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun MedicineFields(d: Draft, set: (Draft) -> Unit, names: List<String>, shorthand: Boolean, parsed: (Parsed) -> Unit) {
    val p = LocalPalette.current
    val f = FORM_FIELDS.getValue(d.form)
    val q = d.name.trim().lowercase()
    val suggestions = if (q.isEmpty()) emptyList() else names.distinct().filter { it.lowercase().contains(q) && it.lowercase() != q }.take(4)
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Field(d.name, { set(d.copy(name = it)) }, "Medicine name", placeholder = "Name on the label", caps = KeyboardCapitalization.Words, autocorrect = false)
        if (suggestions.isNotEmpty()) {
            Txt("Previously added", body(13, 400, 1.3f, p.soft))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                suggestions.forEach { n ->
                    Box(
                        Modifier.heightIn(min = 44.dp).tap(label = "Use medicine name $n") { set(d.copy(name = n)) }
                            .background(p.pipWash, RoundedCornerShape(12.dp)).padding(horizontal = 12.dp),
                        contentAlignment = Alignment.Center,
                    ) { Txt(n, body(14, 600, 1.3f, p.pipInk)) }
                }
            }
        }
    }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Label("Medicine type")
        FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp), maxItemsInEachRow = 3) {
            MedicineType.entries.forEach { t ->
                val on = d.type == t
                Column(
                    Modifier.weight(1f).heightIn(min = 72.dp)
                        .tap(role = Role.RadioButton) { Feels.haptic(Haptic.Tick); set(selectMedicineType(d, t)) }
                        .semantics { toggleableState = ToggleableState(on) }
                        .background(if (on) p.pipWash else p.milk, RoundedCornerShape(16.dp))
                        .then(if (on) Modifier.border(2.dp, p.pip, RoundedCornerShape(16.dp)) else Modifier)
                        .padding(horizontal = 4.dp, vertical = 10.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    val tint = if (on) "#17a58f" else "#8fc6e8"
                    Box(Modifier.size(32.dp), contentAlignment = Alignment.Center) {
                        Pill(Look(if (t.form == Form.Capsule) Shape.Cap else Shape.Round, if (t.form == Form.Capsule) listOf(tint, "#f6d57a") else listOf(tint)), t.form, 26.dp)
                    }
                    Txt(t.label, body(13, 600, 1.2f, if (on) p.pipInk else p.ink).copy(textAlign = TextAlign.Center))
                }
            }
        }
    }
    when {
        d.insulin -> Txt(
            "Next, choose meal times or set times and enter your prescribed units for each dose.",
            body(14, 400, 1.4f, p.pipInk),
            Modifier.fillMaxWidth().background(p.pipWash, RoundedCornerShape(16.dp)).padding(horizontal = 14.dp, vertical = 12.dp),
        )
        d.form == Form.Cream -> Field(d.instructions, { set(d.copy(instructions = it)) }, f.amountLabel, placeholder = "Thin layer, or prescribed fingertip units")
        else -> Amount(d, set)
    }
    if (d.form == Form.Injection && !d.insulin) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Label("Dose unit")
            Segmented(
                "Injection dose unit", d.doseUnit,
                listOf(Opt(DraftUnit.Default, "Injections"), Opt(DraftUnit.Ml, "ml"), Opt(DraftUnit.Mg, "mg"), Opt(DraftUnit.Mcg, "mcg"), Opt(DraftUnit.Units, "Units")),
                { set(d.copy(doseUnit = it)) }, wrap = true,
            )
        }
    }
    f.siteLabel?.let { Field(d.site, { v -> set(d.copy(site = v)) }, it, placeholder = f.siteExample ?: "") }
    var strengthOpen by remember { mutableStateOf(d.strength.isNotEmpty() || d.strengthLabel.isNotEmpty() || d.notes.isNotEmpty()) }
    Optional(if (d.insulin) "Concentration & notes" else "Strength & notes", "Optional · copy the details on your label", strengthOpen, { strengthOpen = it }) {
        Field(
            d.strengthLabel.ifEmpty { d.strength.toDoubleOrNull()?.let { fmtStrength(co.ashwin.tend.core.Strength(it, d.unit)) } ?: "" },
            { set(d.copy(strengthLabel = it, strength = "")) },
            if (d.insulin) "Concentration (optional)" else "Strength (optional)",
            placeholder = if (d.insulin) "100 units / ml" else f.strengthExample,
            tone = p.card,
            hint = "For identifying the medicine. This does not change your dose.",
        )
        Field(d.notes, { set(d.copy(notes = it)) }, "Notes (optional)", placeholder = "Any instructions you want to remember", tone = p.card, lines = 3, imeAction = ImeAction.Default)
    }
    if (shorthand) {
        var shOpen by remember { mutableStateOf(true) }
        Optional("Use prescription shorthand", "Type it, or scan the label with the camera", shOpen, { shOpen = it }) { Shorthand(parsed) }
    }
}

@Composable
private fun Shorthand(onApply: (Parsed) -> Unit) {
    val p = LocalPalette.current
    val context = LocalContext.current
    var text by remember { mutableStateOf("") }
    var scanning by remember { mutableStateOf(false) }
    val parsedNow = remember(text) { parse(text) }
    val ok = understood(parsedNow)
    val photo = remember { mutableStateOf<Uri?>(null) }
    val camera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { taken ->
        val uri = photo.value
        if (!taken || uri == null) return@rememberLauncherForActivityResult
        scanning = true
        // On-device text recognition: the photo never leaves the phone.
        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        runCatching { InputImage.fromFilePath(context, uri) }.onSuccess { image ->
            recognizer.process(image)
                .addOnSuccessListener { result ->
                    val lines = result.textBlocks.flatMap { b -> b.lines.map { it.text } }
                    text = shorthandFromScan(lines)
                    scanning = false
                    if (text.isEmpty()) toast("Couldn't read that label. Try again in better light.")
                    else Feels.haptic(Haptic.Success)
                }
                .addOnFailureListener {
                    scanning = false
                    toast("Couldn't read that label. Type it instead.")
                }
        }.onFailure {
            scanning = false
            toast("Couldn't open the photo.")
        }
    }
    Field(
        text,
        { text = it },
        "Prescription shorthand",
        placeholder = "Metformin 500mg 1-0-1 PC",
        tone = p.card,
        caps = KeyboardCapitalization.None,
        keyboard = KeyboardType.Ascii,
        autocorrect = false,
        imeAction = ImeAction.Done,
        onIme = { if (ok) onApply(parsedNow) },
        trailing = {
            Box(
                Modifier.size(44.dp).tap(label = "Scan a label") {
                    val dir = File(context.cacheDir, "shared").apply { mkdirs() }
                    val file = File(dir, "label.jpg")
                    val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
                    photo.value = uri
                    runCatching { camera.launch(uri) }.onFailure { toast("No camera app found") }
                }.semantics { contentDescription = "Scan a label" }.background(p.pipWash, RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center,
            ) { Icon(Ic.Camera, p.pipInk, size = 22.dp) }
        },
    )
    Txt(
        when {
            scanning -> "Reading the label…"
            text.isNotEmpty() -> echo(parsedNow).joinToString(" · ")
            else -> "Also supports Inj Apidra 14-8-6 units AC."
        },
        body(13, 400, 1.35f, p.soft),
        Modifier.semantics { liveRegion = LiveRegionMode.Polite },
    )
    Btn("Use these details", kind = Kind.Ghost, small = true, enabled = ok) { onApply(parsedNow); Feels.haptic(Haptic.Tick) }
}

/** A time shown as a button that opens the wheel. */
@Composable
fun TimeField(label: String, value: String, onChange: (String) -> Unit, modifier: Modifier = Modifier, tone: Color = LocalPalette.current.milk) {
    val p = LocalPalette.current
    var open by remember { mutableStateOf(false) }
    var draft by remember(open) { mutableStateOf(value) }
    Row(
        modifier.heightIn(min = 44.dp).tap(label = label) { open = true }
            .semantics(mergeDescendants = true) { contentDescription = "$label, ${fmtTime(value)}" }
            .background(tone, RoundedCornerShape(14.dp)).padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Txt(fmtTime(value), display(16, 700, 1.2f, p.ink), lines = 1)
        Icon(Ic.Clock, p.soft, size = 18.dp)
    }
    Sheet(
        open = open,
        onClose = { open = false },
        label = label,
        header = { Txt(label, display(22, 800, 1.15f, p.ink), Modifier.padding(top = 4.dp, bottom = 4.dp)) },
        footer = {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Btn("Cancel", Modifier.weight(1f), Kind.Soft) { open = false }
                Btn("Save", Modifier.weight(1f)) { onChange(draft); open = false }
            }
        },
    ) { if (open) TimeWheel(draft) { draft = it } }
}

/** A date, picked with the system date picker. */
@Composable
fun DateField(label: String, value: String, onChange: (String) -> Unit) {
    val p = LocalPalette.current
    val context = LocalContext.current
    Row(
        Modifier.fillMaxWidth().heightIn(min = 52.dp)
            .tap(label = label) {
                val d = parseDay(value)
                DatePickerDialog(context, { _, y, m, day ->
                    onChange("$y-${(m + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}")
                }, d.year, d.monthValue - 1, d.dayOfMonth).show()
            }
            .semantics(mergeDescendants = true) { contentDescription = "$label, ${fmtDay(value, "d MMMM yyyy")}" }
            .background(p.milk, RoundedCornerShape(16.dp)).padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Txt(fmtDay(value, "EEE, d MMM yyyy"), body(17, 500, 1.3f, p.ink), Modifier.weight(1f))
        Icon(Ic.Calendar, p.soft, size = 20.dp)
    }
}

@Composable
private fun Group(label: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Label(label)
        content()
    }
}

@Composable
private fun ScheduleFields(d: Draft, set: (Draft) -> Unit, routines: List<Routine>, setTime: (RoutineId, String) -> Unit) {
    val p = LocalPalette.current
    val f = FORM_FIELDS.getValue(d.form)
    val mealPlan = d.insulin && d.scheduled && d.variable && d.food == Food.Before &&
        d.routines.all { it in listOf(RoutineId.Breakfast, RoutineId.Lunch, RoutineId.Dinner) } && d.times.isEmpty()
    data class SlotRowData(val key: String, val label: String, val routine: Routine?, val time: String)
    val slots = ROUTINE_ORDER.filter { it in d.routines }.map { r ->
        SlotRowData(
            r.key, ROUTINE_NAME.getValue(r), routines.find { it.id == r },
            reminderTimes(Anchor.AtRoutine(r, d.offsets[r] ?: if (d.before && r != RoutineId.Wake && r != RoutineId.Bed) -d.beforeMin else 0), routines),
        )
    } + d.times.mapIndexed { i, x -> SlotRowData("time-${x.id}", "Clock time ${i + 1}", null, fmtTime(x.t)) }

    if (d.insulin) Group("How do you schedule this insulin?") {
        Segmented(
            "Insulin schedule", if (mealPlan) "meals" else "times",
            listOf(Opt("meals", "Meal times"), Opt("times", "Set times")),
            { v ->
                set(d.copy(
                    kind = Schedule.Kind.Daily,
                    routines = if (v == "times") listOf(RoutineId.Bed) else listOf(RoutineId.Breakfast, RoutineId.Lunch, RoutineId.Dinner),
                    times = emptyList(), food = if (v == "times") null else Food.Before, before = v == "meals",
                    variable = v == "meals", amount = 0.0, amounts = emptyMap(), offsets = emptyMap(),
                ))
            },
        )
        Txt("Use the schedule you were prescribed. Set times can include bedtime or a clock time.", body(13, 400, 1.35f, p.soft))
    }
    var repeatOpen by remember { mutableStateOf(d.kind != Schedule.Kind.Daily) }
    Optional(
        if (d.form == Form.Patch) "Change the patch" else "Repeat",
        when (d.kind) {
            Schedule.Kind.Daily -> "Every day"
            Schedule.Kind.Weekdays -> "On selected days"
            Schedule.Kind.Interval -> "Every ${d.everyDays} days"
            Schedule.Kind.Prn -> "When needed"
            Schedule.Kind.Once -> "One time"
            Schedule.Kind.Cycle -> "${d.on} days on, ${d.off} off"
        },
        repeatOpen, { repeatOpen = it },
    ) {
        Segmented(
            "How often", d.kind,
            listOf(
                Opt(Schedule.Kind.Daily, "Every day"), Opt(Schedule.Kind.Weekdays, "Some days"), Opt(Schedule.Kind.Interval, "Every few days"),
                Opt(Schedule.Kind.Prn, "When needed"), Opt(Schedule.Kind.Once, "Once"), Opt(Schedule.Kind.Cycle, "On and off"),
            ),
            { k -> set(d.copy(kind = k, variable = if (k == Schedule.Kind.Once || k == Schedule.Kind.Prn) false else d.variable)) },
            wrap = true,
            tone = p.card,
        )
    }
    when (d.kind) {
        Schedule.Kind.Weekdays -> Group("Which days") {
            Chips("Which days", d.days, WEEK.map { Opt(it, WEEK_SHORT[it], WEEK_LONG[it]) }) { set(d.copy(days = it)) }
        }
        Schedule.Kind.Interval -> Group(if (d.form == Form.Patch) "Time between changes" else "Days between doses") {
            Stepper("Every how many days", d.everyDays, { set(d.copy(everyDays = it)) }, 2, 365) { "$it days" }
        }
        Schedule.Kind.Cycle -> Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(Modifier.weight(1f)) { Group("Days on") { Stepper("Days on", d.on, { set(d.copy(on = it)) }, 1, 365) } }
            Box(Modifier.weight(1f)) { Group("Days off") { Stepper("Days off", d.off, { set(d.copy(off = it)) }, 1, 365) } }
        }
        Schedule.Kind.Once -> Group("When") {
            DateField("One-time dose date", d.once.take(10)) { set(d.copy(once = "${it}T${d.once.drop(11).ifEmpty { "09:00" }}")) }
            TimeField("One-time dose time", d.once.drop(11).ifEmpty { "09:00" }, { set(d.copy(once = "${d.once.take(10)}T$it")) })
        }
        Schedule.Kind.Prn -> {
            Txt("No scheduled reminders. Log a dose whenever you use it.", body(14, 400, 1.4f, p.soft))
            var limitsOpen by remember { mutableStateOf(d.limitGap || d.limitMax) }
            Optional("Dose limits", "Optional · only if specified on your prescription", limitsOpen, { limitsOpen = it }) {
                SwitchRow(d.limitGap, { set(d.copy(limitGap = it)) }, "Minimum time between doses")
                if (d.limitGap) {
                    var t by remember { mutableStateOf(shown(d.gap)) }
                    Field(t, { t = numberText(it); set(d.copy(gap = t.toDoubleOrNull() ?: 0.0)) }, "Minimum gap in hours", placeholder = "As prescribed", keyboard = KeyboardType.Decimal, tone = p.card)
                }
                SwitchRow(d.limitMax, { set(d.copy(limitMax = it)) }, "Maximum doses per day")
                if (d.limitMax) {
                    var t by remember { mutableStateOf(if (d.max == 0) "" else "${d.max}") }
                    Field(t, { t = numberText(it, false); set(d.copy(max = t.toIntOrNull() ?: 0)) }, "Daily dose limit", placeholder = "As prescribed", keyboard = KeyboardType.Number, tone = p.card)
                }
            }
        }
        Schedule.Kind.Daily -> Unit
    }
    if (d.kind == Schedule.Kind.Interval || d.kind == Schedule.Kind.Cycle) Group("Starting date") {
        DateField("Schedule starting date", d.start) { set(d.copy(start = it)) }
    }
    if (d.insulin && (!d.variable || !d.scheduled)) Amount(d, set)
    if (!d.scheduled) return
    Group(if (mealPlan) "Meals" else "Reminder times") {
        Chips(
            "Meals and sleep", d.routines,
            ROUTINE_ORDER.filter { !mealPlan || it in listOf(RoutineId.Breakfast, RoutineId.Lunch, RoutineId.Dinner) }.map { Opt(it, ROUTINE_NAME.getValue(it)) },
        ) { set(d.copy(routines = it)) }
    }
    if (!mealPlan) Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        d.times.forEachIndexed { i, x ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TimeField("Clock time ${i + 1}", x.t, { t -> set(d.copy(times = d.times.map { if (it.id == x.id) it.copy(t = t) else it })) }, Modifier.weight(1f))
                Box(
                    Modifier.size(44.dp).tap(label = "Remove clock time ${i + 1}") { set(d.copy(times = d.times.filter { it.id != x.id })) }
                        .semantics { contentDescription = "Remove clock time ${i + 1}" }.background(p.milk, RoundedCornerShape(14.dp)),
                    contentAlignment = Alignment.Center,
                ) { Icon(Ic.Close, p.soft, size = 18.dp) }
            }
        }
        Btn("Add a clock time", kind = Kind.Soft, small = true, icon = Ic.Clock) {
            set(d.copy(times = d.times + ClockTime(System.currentTimeMillis(), "09:00")))
        }
    }
    if (hasFoodTiming(d.form)) {
        var foodOpen by remember { mutableStateOf(d.food != null) }
        Optional("Food timing", d.food?.let { co.ashwin.tend.core.FOOD_TEXT.getValue(it) } ?: "Optional · if specified on the label", foodOpen, { foodOpen = it }) {
            Segmented(
                "Food", d.food,
                listOf(Opt(null, "Any time"), Opt(Food.Before, "Before"), Opt(Food.With, "With"), Opt(Food.After, "After"), Opt(Food.Empty, "Empty stomach")),
                { food -> set(d.copy(food = food, before = food == Food.Before, offsets = emptyMap())) },
                wrap = true,
                tone = p.card,
            )
        }
    }
    if (mealPlan || (d.before && d.routines.any { it != RoutineId.Wake && it != RoutineId.Bed })) Group("Reminder before meals") {
        Stepper("Minutes before meals", d.beforeMin, { set(d.copy(beforeMin = it, offsets = emptyMap())) }, 0, 120, 5) { if (it > 0) "$it min before" else "At the meal" }
        Txt("Use your prescribed timing; it varies by medicine.", body(13, 400, 1.35f, p.soft))
    }
    if (!mealPlan && (slots.size > 1 || d.variable) && d.form != Form.Cream) {
        SwitchRow(d.variable, { v ->
            set(d.copy(variable = v, amounts = slots.associate { it.key to (d.amounts[it.key] ?: shown(d.amount)) }))
        }, "Different amounts at each reminder")
    }
    if (d.routines.isNotEmpty() || d.variable) Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (d.routines.isNotEmpty()) Txt(
            "Set when you eat or sleep; the reminder time appears below. These times are shared across medicines. Changes apply when you save.",
            body(13, 400, 1.4f, p.soft),
        )
        val unit = if (d.insulin) "units" else d.doseUnit.unit?.label ?: f.noun
        slots.filter { it.routine != null || d.variable }.forEach { slot ->
            Column(Modifier.fillMaxWidth().background(p.milk, RoundedCornerShape(18.dp)).padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Txt(slot.label, body(16, 700, 1.3f, p.ink))
                        slot.routine?.let { r -> TimeField("${slot.label} time", r.weekday, { setTime(r.id, it) }, tone = p.card) }
                    }
                    if (d.variable) {
                        Field(
                            d.amounts[slot.key] ?: "",
                            { set(d.copy(amounts = d.amounts + (slot.key to numberText(it)))) },
                            null,
                            Modifier.width(96.dp),
                            placeholder = "Dose",
                            keyboard = KeyboardType.Decimal,
                            tone = p.card,
                        )
                        Txt(unit, body(13, 400, 1.3f, p.soft), Modifier.widthIn(min = 36.dp))
                    }
                }
                val amount = if (d.variable) d.amounts[slot.key]?.toDoubleOrNull() else d.amount
                Txt(
                    "${d.name.ifBlank { "Reminder" }}${if (amount != null && amount > 0) " · ${medicineDose(toMed(d), amount)}" else ""} at ${slot.time}",
                    body(13, 400, 1.35f, p.soft),
                )
            }
        }
    }
    var courseOpen by remember { mutableStateOf(d.course) }
    Optional("Course length", if (d.course) "${d.courseDays} days" else "Optional · for a treatment with an end date", courseOpen, { courseOpen = it }) {
        SwitchRow(d.course, { set(d.copy(course = it)) }, "End after a set number of days")
        if (d.course) {
            Group("Number of days") { Stepper("Course length in days", d.courseDays, { set(d.copy(courseDays = it)) }, 1, 365) }
            Group("Starting") { DateField("Course starting date", d.start) { set(d.copy(start = it)) } }
        }
    }
}

@Composable
private fun ReviewFields(d: Draft, set: (Draft) -> Unit, routines: List<Routine>, changed: List<Routine>, others: List<Medicine>, edit: (Int) -> Unit) {
    val p = LocalPalette.current
    val med = toMed(d)
    val f = FORM_FIELDS.getValue(d.form)
    val stockUnit = when {
        d.insulin -> "units"
        d.form == Form.Injection -> d.doseUnit.unit?.label ?: "injections"
        else -> f.stockUnit
    }
    Row(Modifier.fillMaxWidth().background(p.milk, RoundedCornerShape(22.dp)).padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Pill(med.look, d.form, 40.dp)
        Column(Modifier.weight(1f)) {
            Txt(med.name, display(21, 700, 1.2f, p.ink))
            Txt(doseLine(med), body(14, 400, 1.35f, p.soft))
        }
        EditBtn("Edit medicine details") { edit(0) }
    }
    Column(Modifier.fillMaxWidth().background(p.pipWash, RoundedCornerShape(22.dp)).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Column(Modifier.weight(1f)) {
                Txt(if (d.form == Form.Patch) "Patch changes" else "Schedule", body(16, 700, 1.3f, p.ink))
                Txt(scheduleText(med.schedule), body(14, 400, 1.4f, p.ink))
            }
            EditBtn("Edit medicine schedule") { edit(1) }
        }
        med.schedule.anchors?.forEach { a ->
            Box(Modifier.fillMaxWidth().height(1.dp).background(p.line))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Txt(anchorText(a), body(14, 400, 1.35f, p.ink))
                    Txt(reminderTimes(a, routines), body(13, 400, 1.35f, p.ink))
                }
                Txt(medicineDose(med, a.amount ?: med.amount), body(14, 700, 1.35f, p.ink).copy(textAlign = TextAlign.End))
            }
        }
        if (d.course) Txt("For ${d.courseDays} days, starting ${fmtDay(d.start, "d MMM")}", body(13, 400, 1.35f, p.ink))
        changed.forEach { r ->
            val count = others.count { m -> m.schedule.anchors?.any { it is Anchor.AtRoutine && it.routine == r.id } == true }
            Txt(
                "Saving sets ${ROUTINE_NAME.getValue(r.id).lowercase()} to ${fmtTime(r.weekday)}${if (r.weekend != null) " on weekdays" else ""}." +
                    if (count > 0) " This also moves reminders for $count other ${if (count == 1) "medicine" else "medicines"}." else "",
                body(13, 400, 1.35f, p.ink),
            )
        }
    }
    if (stockUnit != null || d.stock) {
        val unit = stockUnit ?: "doses"
        var refillOpen by remember { mutableStateOf(d.stock) }
        Optional("Refill reminders", "Optional · count your remaining supply", refillOpen, { refillOpen = it }) {
            SwitchRow(d.stock, { set(d.copy(stock = it)) }, "Track remaining supply", "Count in $unit")
            if (d.stock) {
                var count by remember { mutableStateOf(shown(d.count)) }
                var pack by remember { mutableStateOf(shown(d.pack)) }
                Field(count, { count = numberText(it); set(d.copy(count = count.toDoubleOrNull() ?: 0.0)) }, "Remaining $unit", keyboard = KeyboardType.Decimal, tone = p.card)
                Group("Remind when this many days remain") { Stepper("Refill reminder, days left", d.refill, { set(d.copy(refill = it)) }, 1, 60) { "$it days" } }
                Field(pack, { pack = numberText(it); set(d.copy(pack = pack.toDoubleOrNull() ?: 0.0)) }, "Refill amount ($unit)", keyboard = KeyboardType.Decimal, tone = p.card, imeAction = ImeAction.Done)
            }
        }
    }
    if (d.form == Form.Tablet || d.form == Form.Capsule) {
        var lookOpen by remember { mutableStateOf(false) }
        Optional("Appearance", "Optional · recognise it at a glance", lookOpen, { lookOpen = it }) {
            if (d.form == Form.Tablet) Segmented("Shape", if (d.shape == Shape.Cap) Shape.Round else d.shape, listOf(Opt(Shape.Round, "Round"), Opt(Shape.Oval, "Oval")), { set(d.copy(shape = it)) }, tone = p.card)
            ColorPick(d.colors, d.form == Form.Capsule) { set(d.copy(colors = it)) }
        }
    }
    med.notes?.let { Txt(it, body(14, 400, 1.4f, p.soft)) }
}

@Composable
private fun EditBtn(label: String, onClick: () -> Unit) {
    val p = LocalPalette.current
    Box(
        Modifier.size(44.dp).tap(label = label, onClick = onClick).semantics { contentDescription = label }.background(p.card, RoundedCornerShape(12.dp)),
        contentAlignment = Alignment.Center,
    ) { Icon(Ic.Edit, p.ink, size = 18.dp) }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ColorPick(colors: List<String>, two: Boolean, onChange: (List<String>) -> Unit) {
    val p = LocalPalette.current
    var half by remember { mutableStateOf(0) }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (two) Segmented("Which half", half, listOf(Opt(0, "Left half"), Opt(1, "Right half")), { half = it }, small = true, tone = p.card)
        FlowRow(
            Modifier.semantics { contentDescription = if (two) "Colour, ${if (half == 1) "right" else "left"} half" else "Colour" },
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            PILL_COLORS.forEach { c ->
                val i = if (two) half else 0
                val on = colors.getOrNull(i) == c
                Box(
                    Modifier.size(44.dp).tap(role = Role.RadioButton, label = COLOR_NAME[c]) {
                        Feels.haptic(Haptic.Tick)
                        val next = if (two) mutableListOf(colors.getOrElse(0) { c }, colors.getOrElse(1) { c }) else mutableListOf(c)
                        next[i] = c
                        onChange(next)
                    }.semantics { contentDescription = COLOR_NAME[c] ?: c; toggleableState = ToggleableState(on) },
                    contentAlignment = Alignment.Center,
                ) {
                    Box(
                        Modifier.size(32.dp)
                            .then(if (on) Modifier.border(2.5.dp, p.pip, CircleShape).padding(4.dp) else Modifier.border(1.5.dp, p.lineStrong, CircleShape))
                            .background(hex(c), CircleShape),
                    )
                }
            }
        }
    }
}

