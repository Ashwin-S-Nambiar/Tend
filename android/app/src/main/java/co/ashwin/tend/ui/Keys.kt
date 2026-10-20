package co.ashwin.tend.ui

import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.isCtrlPressed
import androidx.compose.ui.input.key.isMetaPressed
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.type
import co.ashwin.tend.core.GroupState
import co.ashwin.tend.core.clock
import co.ashwin.tend.core.doseState
import co.ashwin.tend.core.nowKey
import co.ashwin.tend.core.pending
import co.ashwin.tend.core.skip
import co.ashwin.tend.core.snooze
import co.ashwin.tend.core.take
import co.ashwin.tend.core.today
import co.ashwin.tend.data.Repo
import co.ashwin.tend.ui.screens.act

/**
 * Shortcuts for tablets and Chromebooks with a keyboard: T take, Z snooze, S skip,
 * Enter opens the due dose, N adds a medicine, 1 to 4 switch tabs, Ctrl or ⌘ Z undoes.
 * Events only arrive here when no text field took them first.
 */
fun shortcut(e: KeyEvent): Boolean {
    if (e.type != KeyEventType.KeyDown) return false
    if ((e.isCtrlPressed || e.isMetaPressed) && e.key == Key.Z) {
        val t = Toasts.current.value?.undo ?: return false
        t(); Toasts.dismiss(); return true
    }
    if (e.isCtrlPressed || e.isMetaPressed || Nav.over != null) return false
    val s = Repo.now
    val focus = today(s.meds, s.settings.routines, s.logs, clock()).focus
    val due = focus?.takeIf { it.state == GroupState.Due || it.state == GroupState.Snoozed }
    val open = due?.doses?.filter { doseState(s.logs, it, nowKey()).pending }.orEmpty()
    when (e.key) {
        Key.T -> if (due != null && open.isNotEmpty()) act(take(s.data, open, due.label)) else return false
        Key.Z -> if (due != null && open.isNotEmpty()) act(snooze(s.data, due.group, 10)) else return false
        Key.S -> if (due != null && open.isNotEmpty()) act(skip(s.data, open, due.label)) else return false
        Key.Enter -> Nav.open(Over.Dose(focus?.key ?: "next"))
        Key.N -> Nav.open(Over.Editor(null))
        Key.One -> Nav.go(Tab.Today)
        Key.Two -> Nav.go(Tab.Medicines)
        Key.Three -> Nav.go(Tab.History)
        Key.Four -> Nav.go(Tab.You)
        else -> return false
    }
    return true
}
