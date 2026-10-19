package co.ashwin.tend.ui.screens

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.text.LineBreaker
import android.os.Build
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import co.ashwin.tend.alarm.Alarms
import co.ashwin.tend.alarm.Permissions
import co.ashwin.tend.core.Medicine
import co.ashwin.tend.core.NotABackup
import co.ashwin.tend.core.ROUTINE_NAME
import co.ashwin.tend.core.ROUTINE_ORDER
import co.ashwin.tend.core.ROUTINE_SCENE
import co.ashwin.tend.core.RoutineId
import co.ashwin.tend.core.buildIcs
import co.ashwin.tend.core.dayKey
import co.ashwin.tend.core.deviceZone
import co.ashwin.tend.core.doctorCardText
import co.ashwin.tend.core.doseLine
import co.ashwin.tend.core.dueKey
import co.ashwin.tend.core.exportBackup
import co.ashwin.tend.core.fmtDay
import co.ashwin.tend.core.fmtHere
import co.ashwin.tend.core.fmtTime
import co.ashwin.tend.core.readBackup
import co.ashwin.tend.core.scheduleText
import co.ashwin.tend.core.zoneName
import co.ashwin.tend.data.Repo
import co.ashwin.tend.data.Theme
import co.ashwin.tend.data.Travel
import co.ashwin.tend.ui.Btn
import co.ashwin.tend.ui.CardBox
import co.ashwin.tend.ui.Field
import co.ashwin.tend.ui.H2
import co.ashwin.tend.ui.Ic
import co.ashwin.tend.ui.Icon
import co.ashwin.tend.ui.IconBtn
import co.ashwin.tend.ui.Kind
import co.ashwin.tend.ui.Label
import co.ashwin.tend.ui.LocalLayout
import co.ashwin.tend.ui.LocalPalette
import co.ashwin.tend.ui.Mood
import co.ashwin.tend.ui.Nav
import co.ashwin.tend.ui.Opt
import co.ashwin.tend.ui.PillChip
import co.ashwin.tend.ui.Pip
import co.ashwin.tend.ui.Route
import co.ashwin.tend.ui.SceneIcon
import co.ashwin.tend.ui.Segmented
import co.ashwin.tend.ui.Sheet
import co.ashwin.tend.ui.SwitchRow
import co.ashwin.tend.ui.Txt
import co.ashwin.tend.ui.body
import co.ashwin.tend.ui.display
import co.ashwin.tend.ui.rememberStored
import co.ashwin.tend.ui.tap
import co.ashwin.tend.ui.toast
import java.io.File
import java.time.ZoneId

data class PermissionState(val notify: Boolean, val exact: Boolean, val battery: Boolean)

/** Permission state, re-read whenever the app comes back from Settings. */
@Composable
fun rememberPermissions(): PermissionState {
    val context = LocalContext.current
    fun read() = PermissionState(Alarms.canNotify(context), Alarms.canExact(context), Permissions.ignoringBattery(context))
    var state by remember { mutableStateOf(read()) }
    val owner = LocalLifecycleOwner.current
    DisposableEffect(owner) {
        val o = LifecycleEventObserver { _, e ->
            if (e == Lifecycle.Event.ON_RESUME) {
                state = read()
                Alarms.replan(context)
            }
        }
        owner.lifecycle.addObserver(o)
        onDispose { owner.lifecycle.removeObserver(o) }
    }
    return state
}

@Composable
fun notificationLauncher(onResult: (Boolean) -> Unit = {}): () -> Unit {
    val context = LocalContext.current
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        if (!ok) Permissions.notificationSettings(context)
        onResult(ok)
    }
    return {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED
        ) launcher.launch(Manifest.permission.POST_NOTIFICATIONS)
        else Permissions.notificationSettings(context)
    }
}

@Composable
private fun Row(icon: Ic, label: String, hint: String?, onClick: () -> Unit) {
    val p = LocalPalette.current
    androidx.compose.foundation.layout.Row(
        Modifier.fillMaxWidth().heightIn(min = 56.dp).tap(sink = 0.98f, onClick = onClick).padding(horizontal = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(Modifier.size(40.dp).background(p.milk, RoundedCornerShape(13.dp)), contentAlignment = Alignment.Center) { Icon(icon, p.ink, size = 20.dp) }
        Column(Modifier.weight(1f)) {
            Txt(label, body(16, 600, 1.3f, p.ink))
            hint?.let { Txt(it, body(14, 400, 1.35f, p.soft)) }
        }
        Icon(Ic.Next, p.soft, size = 18.dp)
    }
}

@Composable
fun YouScreen(top: Dp) {
    val p = LocalPalette.current
    val s = rememberStored()
    val context = LocalContext.current
    val l = LocalLayout.current
    val perms = rememberPermissions()
    var card by remember { mutableStateOf(false) }
    val askNotify = notificationLauncher()
    val active = s.meds.filter { !it.isArchived }

    val saveIcs = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/calendar")) { uri ->
        uri ?: return@rememberLauncherForActivityResult
        runCatching {
            context.contentResolver.openOutputStream(uri)!!.use { it.write(buildIcs(active, s.settings.routines).encodeToByteArray()) }
        }.onSuccess { toast("Calendar file saved") }.onFailure { toast("Couldn't save the calendar file") }
    }
    val saveBackup = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        uri ?: return@rememberLauncherForActivityResult
        val now = Repo.now
        runCatching {
            context.contentResolver.openOutputStream(uri)!!.use { it.write(exportBackup(now.meds, now.logs, now.settings.routines).encodeToByteArray()) }
        }.onSuccess { toast("Backup saved") }.onFailure { toast("Couldn't save the backup") }
    }
    val restore = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        uri ?: return@rememberLauncherForActivityResult
        try {
            val text = context.contentResolver.openInputStream(uri)!!.use { it.readBytes().decodeToString() }
            val b = readBackup(text)
            val prev = Repo.now
            Repo.update { st ->
                st.copy(
                    meds = co.ashwin.tend.core.sortMeds(b.meds),
                    logs = b.logs,
                    settings = if (b.routines.isNotEmpty()) st.settings.copy(routines = b.routines) else st.settings,
                )
            }
            toast("Backup restored") { Repo.update { it.copy(meds = prev.meds, logs = prev.logs, settings = it.settings.copy(routines = prev.settings.routines)) } }
        } catch (e: NotABackup) {
            toast("That file isn't a Tend backup")
        } catch (e: Exception) {
            toast("Couldn't read that file")
        }
    }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = if (l.narrow) 12.dp else if (l.phone) 16.dp else 32.dp).padding(top = top + 12.dp, bottom = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Column(Modifier.widthIn(max = 640.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            Txt("You", display(if (l.phone) 32 else 40, 800, 1.1f, p.ink), Modifier.padding(horizontal = 4.dp).semantics { heading() })

            CardBox {
                val on = perms.notify && perms.exact
                androidx.compose.foundation.layout.Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Pip(if (on) Mood.Done else Mood.Nudge, size = 56.dp)
                    Column(Modifier.weight(1f)) {
                        Txt(if (on) "Reminders are on" else "Reminders", body(17, 700, 1.3f, p.ink), Modifier.semantics { heading() })
                        Txt(
                            when {
                                !perms.notify -> "Allow notifications so Tend can tap you on the shoulder at each scheduled time."
                                !perms.exact -> "Reminders may arrive a few minutes late. Allow alarms on the minute to keep them on time."
                                else -> "An alarm at each time, then a follow-up 30 min later if nothing is logged."
                            },
                            body(14, 400, 1.35f, p.soft),
                        )
                    }
                }
                if (!perms.notify) Btn("Turn on reminders", Modifier.fillMaxWidth(), icon = Ic.Bell) { askNotify() }
                else if (!perms.exact) Btn("Allow alarms on the minute", Modifier.fillMaxWidth(), icon = Ic.Alarm) { Permissions.exactAlarmSettings(context) }
                if (Permissions.needsAutostart && !perms.battery) {
                    Row(Ic.Phone, "Keep running in the background", "Your phone can stop reminders to save battery. Allow Tend to start in the background.") {
                        Permissions.backgroundSettings(context)
                    }
                }
                SwitchRow(
                    !s.settings.hideNames,
                    { v -> Repo.settings { it.copy(hideNames = !v) } },
                    "Show names on the lock screen",
                    if (s.settings.hideNames) "Locked, it says \"Time for your 8:00 AM medicines\"" else "Reminders name each medicine",
                    Ic.Lock,
                )
                SwitchRow(
                    s.settings.refillAlerts,
                    { v -> Repo.settings { it.copy(refillAlerts = v) } },
                    "Refill reminders",
                    if (s.settings.refillAlerts) "A nudge when a supply is about to run out" else "Shown on Today only",
                    Ic.Bell,
                )
                Row(Ic.Sound, "Reminder sound and vibration", "Opens Android's notification settings") { Permissions.notificationSettings(context, Alarms.CH_DOSES) }
            }

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                H2("Your day")
                CardBox(padding = 12.dp) {
                    Row(Ic.Routines, "Meal & sleep times", "When you wake, eat and sleep") { Nav.push(Route.MealTimes) }
                    TravelSettings()
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                H2("Look and sound")
                CardBox {
                    Label("Theme")
                    Segmented(
                        "Theme", s.settings.theme,
                        listOf(Opt(Theme.System, "System"), Opt(Theme.Light, "Light"), Opt(Theme.Dark, "Night")),
                        { t -> Repo.settings { it.copy(theme = t) } },
                    )
                    SwitchRow(
                        s.settings.sound, { v -> Repo.settings { it.copy(sound = v) } },
                        "In-app sounds", "Chimes when you log a dose. Reminder sound follows your phone's settings.",
                        if (s.settings.sound) Ic.Sound else Ic.Mute,
                    )
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                H2("Share and keep")
                CardBox(padding = 12.dp) {
                    Row(Ic.Card, "My medicines card", "Share a list with your doctor") { card = true }
                    Row(Ic.Calendar, "Add to calendar", "The next 30 days as calendar alerts") { saveIcs.launch("tend.ics") }
                    Row(Ic.Download, "Back up", "Save everything to a file, or Google Drive") { saveBackup.launch("tend-${dayKey()}.json") }
                    Row(Ic.Upload, "Restore", "Works with backups from the web app too") { restore.launch(arrayOf("application/json", "text/plain", "application/octet-stream")) }
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                H2("About")
                CardBox {
                    Txt(
                        "Everything stays on this phone. Reminders are alarms on the phone itself: no account and no server.",
                        body(14, 400, 1.5f, p.soft),
                    )
                    Txt("Tend is not medical advice and doesn't check interactions. Ask your doctor or pharmacist.", body(14, 400, 1.5f, p.soft))
                    Txt("Gabarito and Rethink Sans, both under the SIL Open Font License. Made by Ashwin.", body(14, 400, 1.5f, p.soft))
                }
            }
        }
    }
    DoctorCard(card, { card = false }, active)
}

@Composable
private fun TravelSettings() {
    val p = LocalPalette.current
    val s = rememberStored()
    val t = s.settings.travel
    val here = deviceZone().id
    var picking by remember { mutableStateOf(false) }
    val breakfast = s.settings.routines.find { it.id == RoutineId.Breakfast }?.weekday ?: "08:00"
    SwitchRow(
        t.keepHome,
        { v -> Repo.settings { it.copy(travel = it.travel.copy(mode = if (v) "home" else "local")) } },
        "Keep home time when travelling",
        if (t.keepHome) "Doses stay on ${zoneName(t.home)} time wherever you are" else "Doses follow the clock wherever you are",
        Ic.Globe,
    )
    if (t.keepHome) Column(Modifier.padding(start = 56.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Label("Home time zone")
        androidx.compose.foundation.layout.Row(
            Modifier.fillMaxWidth().heightIn(min = 52.dp).tap { picking = true }.background(p.milk, RoundedCornerShape(16.dp)).padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Txt(t.home.replace('_', ' '), body(16, 500, 1.3f, p.ink), Modifier.weight(1f))
            Icon(Ic.Next, p.soft, size = 18.dp)
        }
        if (t.home != here) {
            Txt("Breakfast at ${fmtTime(breakfast)} ${zoneName(t.home)} time is ${fmtHere(dueKey(dayKey(), breakfast))} here.", body(14, 400, 1.4f, p.soft))
            Btn("Make ${zoneName(here)} home", kind = Kind.Soft, small = true) { Repo.settings { it.copy(travel = Travel("home", here, here)) } }
        }
    }
    ZonePicker(picking, { picking = false }, t.home) { z -> Repo.settings { it.copy(travel = it.travel.copy(home = z)) } }
}

@Composable
private fun ZonePicker(open: Boolean, onClose: () -> Unit, current: String, onPick: (String) -> Unit) {
    val p = LocalPalette.current
    var q by remember(open) { mutableStateOf("") }
    val all = remember { ZoneId.getAvailableZoneIds().filter { '/' in it && !it.startsWith("Etc") && !it.startsWith("SystemV") }.sorted() }
    val shown = remember(q) {
        val needle = q.trim().lowercase().replace(' ', '_')
        (if (needle.isEmpty()) listOf(current, deviceZone().id).distinct() + all else all.filter { needle in it.lowercase() }).take(80)
    }
    Sheet(
        open = open,
        onClose = onClose,
        label = "Home time zone",
        detents = true,
        header = {
            Txt("Home time zone", display(22, 800, 1.15f, p.ink), Modifier.padding(top = 4.dp, bottom = 8.dp))
            Field(q, { q = it }, null, placeholder = "Search a city", imeAction = ImeAction.Search)
            androidx.compose.foundation.layout.Spacer(Modifier.size(8.dp))
        },
    ) {
        shown.forEach { z ->
            androidx.compose.foundation.layout.Row(
                Modifier.fillMaxWidth().heightIn(min = 48.dp).tap(sink = 0.98f) { onPick(z); onClose() }
                    .background(if (z == current) p.pipWash else p.milk, RoundedCornerShape(14.dp)).padding(horizontal = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Txt(z.replace('_', ' '), body(16, if (z == current) 700 else 500, 1.3f, if (z == current) p.pipInk else p.ink), Modifier.weight(1f))
                if (z == current) Icon(Ic.Check, p.pipInk, size = 18.dp)
            }
        }
    }
}

/** A list to show a doctor: shared as text or as an image, or copied. */
@Composable
private fun DoctorCard(open: Boolean, onClose: () -> Unit, meds: List<Medicine>) {
    val p = LocalPalette.current
    val context = LocalContext.current
    val date = fmtDay(dayKey(), "d MMMM yyyy")
    val text = doctorCardText(meds, date)
    var choose by remember { mutableStateOf(false) }
    Sheet(
        open = open,
        onClose = onClose,
        label = "My medicines card",
        detents = true,
        header = {
            Txt("My medicines", display(24, 800, 1.15f, p.ink), Modifier.padding(top = 4.dp).semantics { heading() })
            Txt("As of $date", body(16, 400, 1.4f, p.soft), Modifier.padding(bottom = 8.dp))
        },
        footer = {
            androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Btn("Copy", Modifier.weight(1f), Kind.Soft, icon = Ic.Copy) {
                    context.getSystemService(ClipboardManager::class.java).setPrimaryClip(ClipData.newPlainText("My medicines", text))
                    if (Build.VERSION.SDK_INT < 33) toast("Copied the list")
                }
                Btn("Share", Modifier.weight(2f), icon = Ic.Share) { choose = true }
            }
        },
    ) {
        if (meds.isEmpty()) Txt("Nothing added yet.", body(16, 400, 1.4f, p.soft))
        meds.forEach { m ->
            androidx.compose.foundation.layout.Row(
                Modifier.fillMaxWidth().background(p.milk, RoundedCornerShape(16.dp)).padding(12.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                PillChip(m.look, m.form, tile = p.card)
                Column(Modifier.weight(1f)) {
                    Txt(m.name, body(16, 700, 1.3f, p.ink))
                    Txt(doseLine(m), body(15, 400, 1.35f, p.ink))
                    Txt(scheduleText(m.schedule), body(15, 400, 1.35f, p.soft))
                }
            }
        }
    }
    co.ashwin.tend.ui.ActionSheet(
        open = choose,
        onClose = { choose = false },
        title = "Share my medicines",
        actions = listOf(
            co.ashwin.tend.ui.SheetAction("As text", Ic.Card) { shareText(context, text) },
            co.ashwin.tend.ui.SheetAction("As an image", Ic.Share) { shareImage(context, meds, date) },
        ),
    )
}

private fun shareText(context: Context, text: String) {
    val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text).putExtra(Intent.EXTRA_SUBJECT, "My medicines")
    context.startActivity(Intent.createChooser(send, "Share my medicines").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
}

/** Draws the card as a tall image in Tend's colours, for messaging apps that drop long text. */
private fun shareImage(context: Context, meds: List<Medicine>, date: String) {
    val w = 1080
    val pad = 72f
    val ink = 0xFF1D2430.toInt()
    val soft = 0xFF5E6673.toInt()
    val display = androidx.core.content.res.ResourcesCompat.getFont(context, co.ashwin.tend.R.font.gabarito)
    val ui = androidx.core.content.res.ResourcesCompat.getFont(context, co.ashwin.tend.R.font.rethink_sans)
    fun paint(size: Float, color: Int, face: android.graphics.Typeface?, bold: Boolean) = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
        textSize = size; this.color = color
        typeface = android.graphics.Typeface.create(face, if (bold) 700 else 400, false)
    }
    fun layout(t: String, paint: TextPaint, width: Int) = StaticLayout.Builder.obtain(t, 0, t.length, paint, width)
        .setAlignment(Layout.Alignment.ALIGN_NORMAL).setBreakStrategy(LineBreaker.BREAK_STRATEGY_HIGH_QUALITY).build()
    val inner = (w - pad * 2 - 64).toInt()
    val blocks = meds.map { m ->
        listOf(layout(m.name, paint(44f, ink, ui, true), inner), layout(doseLine(m), paint(38f, ink, ui, false), inner), layout(scheduleText(m.schedule), paint(38f, soft, ui, false), inner))
    }
    val title = layout("My medicines", paint(76f, ink, display, true), (w - pad * 2).toInt())
    val sub = layout("As of $date", paint(38f, soft, ui, false), (w - pad * 2).toInt())
    val h = (pad + title.height + 12 + sub.height + 40 + blocks.sumOf { b -> b.sumOf { it.height } + 64 + 20 } + pad).toInt()
    val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    val c = Canvas(bmp)
    c.drawColor(0xFFFAF7F3.toInt())
    var y = pad
    fun draw(l: StaticLayout, x: Float) { c.save(); c.translate(x, y); l.draw(c); c.restore(); y += l.height }
    draw(title, pad); y += 12; draw(sub, pad); y += 40
    val card = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFFFFFFF.toInt() }
    blocks.forEach { b ->
        val bh = b.sumOf { it.height } + 64f
        c.drawRoundRect(RectF(pad, y, w - pad, y + bh), 40f, 40f, card)
        y += 32
        b.forEach { draw(it, pad + 32) }
        y += 32 + 20
    }
    val dir = File(context.cacheDir, "shared").apply { mkdirs() }
    val file = File(dir, "my-medicines.png")
    file.outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
    val send = Intent(Intent.ACTION_SEND).setType("image/png").putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    context.startActivity(Intent.createChooser(send, "Share my medicines").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
}

/** Meal and sleep times, shared by every medicine linked to them. */
@Composable
fun MealTimesScreen(top: Dp) {
    val p = LocalPalette.current
    val s = rememberStored()
    val l = LocalLayout.current
    val routines = s.settings.routines
    val weekend = routines.any { it.weekend != null }
    fun get(id: RoutineId) = routines.find { it.id == id } ?: co.ashwin.tend.core.DEFAULT_ROUTINES.first { it.id == id }
    fun set(id: RoutineId, change: (co.ashwin.tend.core.Routine) -> co.ashwin.tend.core.Routine) =
        Repo.settings { st -> st.copy(routines = ROUTINE_ORDER.map { r -> if (r == id) change(get(r)) else get(r) }) }

    @Composable
    fun rows(field: String) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            ROUTINE_ORDER.forEach { r ->
                val routine = get(r)
                val value = if (field == "weekend") routine.weekend ?: routine.weekday else routine.weekday
                val count = s.meds.count { m -> !m.isArchived && m.schedule.anchors?.any { it is co.ashwin.tend.core.Anchor.AtRoutine && it.routine == r } == true }
                androidx.compose.foundation.layout.Row(
                    Modifier.fillMaxWidth().heightIn(min = 60.dp).background(p.milk, RoundedCornerShape(16.dp)).padding(start = 12.dp, end = 8.dp, top = 8.dp, bottom = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    SceneIcon(ROUTINE_SCENE.getValue(r))
                    Column(Modifier.weight(1f)) {
                        Txt(ROUTINE_NAME.getValue(r), body(16, 600, 1.3f, p.ink))
                        if (count > 0) Txt("$count ${if (count == 1) "medicine" else "medicines"}", body(13, 400, 1.3f, p.soft))
                    }
                    TimeField("${ROUTINE_NAME.getValue(r)} time", value, { v ->
                        set(r) { if (field == "weekend") it.copy(weekend = v) else it.copy(weekday = v) }
                        if (count > 0) toast("${ROUTINE_NAME.getValue(r)} doses moved with it")
                    }, tone = p.card)
                }
            }
        }
    }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = if (l.narrow) 12.dp else 16.dp).padding(top = top + 8.dp, bottom = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Column(Modifier.widthIn(max = 640.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(20.dp)) {
            androidx.compose.foundation.layout.Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                IconBtn(Ic.Back, "Back to You", tone = null) { Nav.pop() }
                Txt("Meal & sleep times", display(if (l.narrow) 24 else 28, 800, 1.15f, p.ink), Modifier.weight(1f).semantics { heading() })
            }
            Txt(
                "These times are shared by medicines linked to meals, waking or bedtime. Fixed clock reminders stay at their own times.",
                body(15, 400, 1.5f, p.soft),
                Modifier.padding(horizontal = 4.dp),
            )
            CardBox {
                Txt(if (weekend) "Weekdays" else "Every day", body(17, 700, 1.3f, p.ink))
                rows("weekday")
            }
            CardBox {
                SwitchRow(weekend, { on ->
                    Repo.settings { st ->
                        st.copy(routines = ROUTINE_ORDER.map { get(it) }.map { r -> if (on) r.copy(weekend = r.weekend ?: r.weekday) else r.copy(weekend = null) })
                    }
                }, "Different on weekends", "Saturday and Sunday get their own times", Ic.Calendar)
                if (weekend) rows("weekend")
            }
        }
    }
}

