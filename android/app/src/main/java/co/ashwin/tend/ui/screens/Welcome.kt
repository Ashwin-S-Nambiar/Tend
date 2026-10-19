package co.ashwin.tend.ui.screens

import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import co.ashwin.tend.alarm.Permissions
import co.ashwin.tend.core.readBackup
import co.ashwin.tend.core.scheduleText
import co.ashwin.tend.core.sortMeds
import co.ashwin.tend.data.Repo
import co.ashwin.tend.feel.Feels
import co.ashwin.tend.feel.Haptic
import co.ashwin.tend.feel.Sound
import co.ashwin.tend.ui.Btn
import co.ashwin.tend.ui.Ic
import co.ashwin.tend.ui.Icon
import co.ashwin.tend.ui.LocalLayout
import co.ashwin.tend.ui.LocalPalette
import co.ashwin.tend.ui.LocalReducedMotion
import co.ashwin.tend.ui.Mode
import co.ashwin.tend.ui.Mood
import co.ashwin.tend.ui.PillChip
import co.ashwin.tend.ui.Pip
import co.ashwin.tend.ui.Txt
import co.ashwin.tend.ui.Welcome
import co.ashwin.tend.ui.body
import co.ashwin.tend.ui.display
import co.ashwin.tend.ui.rememberStored
import co.ashwin.tend.ui.tap
import co.ashwin.tend.ui.toast

private val Sun = Color(0xFFFFC845)
private val Teal = Color(0xFF0E8576)

/** Welcome, medicines, reminders: three steps on Pip's yellow. */
@Composable
fun WelcomeScreen(finish: () -> Unit) {
    var editor by remember { mutableStateOf<String?>(null) }
    var editing by remember { mutableStateOf(false) }
    // The editor keeps the app's own palette; only the onboarding page is on yellow.
    if (editing) MedicineEdit(editor) { editing = false }
    CompositionLocalProvider(LocalPalette provides Welcome) {
        val p = Welcome
        val s = rememberStored()
        val context = LocalContext.current
        val l = LocalLayout.current
        val reduced = LocalReducedMotion.current
        var step by remember { mutableStateOf(0) }
        val perms = rememberPermissions()
        val askNotify = notificationLauncher()
        val restore = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
            if (uri == null) { finish(); return@rememberLauncherForActivityResult }
            runCatching {
                val b = readBackup(context.contentResolver.openInputStream(uri)!!.use { it.readBytes().decodeToString() })
                Repo.update { st -> st.copy(meds = sortMeds(b.meds), logs = b.logs, settings = if (b.routines.isNotEmpty()) st.settings.copy(routines = b.routines) else st.settings) }
            }.onSuccess { toast("Backup restored"); step = 2 }.onFailure { toast("That file isn't a Tend backup") }
        }
        fun go(n: Int) {
            Feels.haptic(Haptic.Tick)
            Feels.sound(Sound.Whoosh)
            step = n
        }
        BackHandler(step > 0) { go(step - 1) }
        val mood = listOf(Mood.Hello, Mood.Adding, Mood.Nudge)[step]
        val land = l.mode == Mode.Land
        val pipSize by animateDpAsState(
            listOf(190.dp, 120.dp, 140.dp)[step].let { if (land) it * 0.7f else if (l.heightDp < 700) it * 0.75f else it },
            if (reduced) tween(0) else spring(1f, 300f),
            label = "pip",
        )
        val stage: @Composable (Modifier) -> Unit = { m ->
            Box(m, contentAlignment = Alignment.Center) { Pip(mood, size = pipSize, poke = true) }
        }
        val steps: @Composable (Modifier) -> Unit = { m ->
            AnimatedContent(
                step,
                m,
                transitionSpec = {
                    val dir = if (targetState > initialState) 1 else -1
                    if (reduced) fadeIn(tween(160)) togetherWith fadeOut(tween(160))
                    else (slideInHorizontally(tween(240, easing = co.ashwin.tend.ui.EaseOut)) { 24 * dir } + fadeIn(tween(180))) togetherWith
                        (slideOutHorizontally(tween(180)) { -16 * dir } + fadeOut(tween(140)))
                },
                contentAlignment = Alignment.BottomStart,
                label = "welcome",
            ) { st ->
                Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 22.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Txt(
                        listOf("Hi, I’m Pip.", "What do you take?", if (perms.notify && perms.exact) "You’re all set." else "Can I tap you on the shoulder?")[st],
                        display(if (l.narrow) 30 else 36, 800, 1.04f, p.ink),
                        Modifier.semantics { heading() },
                    )
                    when (st) {
                        0 -> Txt("I'll help you tend to your medicines, on time. Everything stays on this phone.", body(17, 400, 1.45f, p.ink))
                        1 -> {
                            Txt("Choose the medicine type, set its schedule, then review it. Add as many as you need.", body(16, 400, 1.45f, p.ink))
                            s.meds.forEach { m ->
                                Row(
                                    Modifier.fillMaxWidth().tap(sink = 0.98f, label = "Edit ${m.name}") { editor = m.id; editing = true }
                                        .background(Color.White.copy(alpha = 0.8f), RoundedCornerShape(20.dp)).padding(10.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                                ) {
                                    PillChip(m.look, m.form)
                                    Column(Modifier.weight(1f)) {
                                        Txt(m.name, body(16, 700, 1.25f, p.ink))
                                        Txt(scheduleText(m.schedule), body(13, 400, 1.35f, p.ink))
                                    }
                                    Icon(Ic.Edit, p.ink, size = 18.dp)
                                }
                            }
                            Btn(
                                if (s.meds.isEmpty()) "Add a medicine" else "Add another medicine",
                                Modifier.fillMaxWidth(),
                                icon = Ic.Plus,
                                background = Color.White.copy(alpha = 0.85f),
                                foreground = p.ink,
                            ) { editor = null; editing = true }
                            if (s.meds.isEmpty()) Txt("Tablets, insulin, creams, patches and more. Each gets just the details it needs.", body(14, 400, 1.4f, p.ink))
                        }
                        else -> Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Txt(
                                "I'll remind you at each scheduled time, with Taken and Snooze right on the notification. No account, no server.",
                                body(16, 400, 1.45f, p.ink),
                            )
                            Permission(
                                Ic.Bell, "Notifications", if (perms.notify) "Allowed" else "So reminders can reach you",
                                perms.notify, "Allow",
                            ) { askNotify() }
                            Permission(
                                Ic.Alarm, "Alarms on the minute", if (perms.exact) "Allowed" else "So doses ring on time while the phone sleeps",
                                perms.exact, "Allow",
                            ) { Permissions.exactAlarmSettings(context) }
                            Permission(
                                Ic.Phone, "Keep running in the background",
                                if (perms.battery) "Allowed" else if (Permissions.needsAutostart) "Needed on this phone so reminders aren't stopped" else "Recommended on Xiaomi, Oppo, OnePlus and Vivo phones",
                                perms.battery, "Open",
                            ) { Permissions.backgroundSettings(context) }
                        }
                    }
                }
            }
        }
        val controls: @Composable () -> Unit = {
            Column(Modifier.fillMaxWidth().padding(horizontal = 22.dp).padding(top = 12.dp, bottom = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp, Alignment.CenterHorizontally)) {
                    repeat(3) { i ->
                        val w by animateDpAsState(if (i == step) 20.dp else 7.dp, if (reduced) tween(0) else tween(320, easing = co.ashwin.tend.ui.Drawer), label = "dot")
                        val c by animateColorAsState(if (i == step) p.ink else p.ink.copy(alpha = 0.28f), tween(200), label = "dotc")
                        Box(Modifier.width(w).height(7.dp).background(c, CircleShape))
                    }
                }
                Txt("Step ${step + 1} of 3", body(1, 400, 1f, Color.Transparent), Modifier.size(1.dp).semantics { liveRegion = LiveRegionMode.Polite })
                val primary = when (step) {
                    0 -> "Let’s set up"
                    1 -> if (s.meds.isEmpty()) "Skip for now" else "Continue"
                    else -> if (perms.notify) "Finish setup" else "Allow reminders"
                }
                Btn(primary, Modifier.fillMaxWidth(), background = Teal, foreground = Color.White) {
                    when (step) {
                        0 -> go(1)
                        1 -> go(2)
                        else -> if (perms.notify) finish() else askNotify()
                    }
                }
                val secondary = when (step) {
                    0 -> "I’ve used it before"
                    1 -> "Back"
                    else -> "Not now"
                }
                Box(
                    Modifier.fillMaxWidth().heightIn(min = 44.dp).tap {
                        when (step) {
                            0 -> restore.launch(arrayOf("application/json", "text/plain", "application/octet-stream"))
                            1 -> go(0)
                            else -> finish()
                        }
                    },
                    contentAlignment = Alignment.Center,
                ) { Txt(secondary, display(15, 700, 1.2f, p.ink.copy(alpha = 0.9f))) }
            }
        }
        Box(Modifier.fillMaxSize().background(Sun).windowInsetsPadding(WindowInsets.safeDrawing)) {
            if (land) {
                Row(Modifier.fillMaxSize()) {
                    stage(Modifier.weight(0.38f).fillMaxSize())
                    Column(Modifier.weight(0.62f).fillMaxSize(), verticalArrangement = Arrangement.Center) {
                        steps(Modifier.weight(1f, fill = false))
                        controls()
                    }
                }
            } else {
                Column(Modifier.fillMaxSize().padding(top = 12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    stage(Modifier.fillMaxWidth().weight(1f).heightIn(min = 96.dp))
                    Column(Modifier.widthIn(max = 520.dp).fillMaxWidth()) {
                        steps(Modifier.weight(1f, fill = false))
                        controls()
                    }
                }
            }
        }
    }
}

@Composable
private fun Permission(icon: Ic, title: String, hint: String, done: Boolean, action: String, onClick: () -> Unit) {
    val p = LocalPalette.current
    Row(
        Modifier.fillMaxWidth().background(Color.White.copy(alpha = 0.65f), RoundedCornerShape(16.dp)).padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            Modifier.size(36.dp).background(if (done) Teal else Color.White, CircleShape),
            contentAlignment = Alignment.Center,
        ) { Icon(if (done) Ic.Check else icon, if (done) Color.White else p.ink, size = 20.dp) }
        Column(Modifier.weight(1f)) {
            Txt(title, body(16, 700, 1.25f, p.ink))
            Txt(hint, body(13, 400, 1.35f, p.ink))
        }
        if (!done) Btn(action, small = true, background = Color.White, foreground = p.ink, label = "$action $title") { onClick() }
    }
}
