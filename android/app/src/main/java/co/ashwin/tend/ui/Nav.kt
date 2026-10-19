package co.ashwin.tend.ui

import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

enum class Tab(val label: String, val icon: Ic) {
    Today("Today", Ic.Today),
    Medicines("Medicines", Ic.Meds),
    History("History", Ic.History),
    You("You", Ic.You),
}

sealed interface Route {
    val tab: Tab

    data object Today : Route { override val tab = Tab.Today }
    data object Medicines : Route { override val tab = Tab.Medicines }
    data class Medicine(val id: String) : Route { override val tab = Tab.Medicines }
    data object History : Route { override val tab = Tab.History }
    data class Day(val date: String) : Route { override val tab = Tab.History }
    data object You : Route { override val tab = Tab.You }
    data object MealTimes : Route { override val tab = Tab.You }
}

/** Things that open over the page: the dose sheet and the medicine editor. */
sealed interface Over {
    data class Dose(val due: String) : Over
    data class Editor(val id: String?) : Over
}

/**
 * A small navigation stack. Pushes slide forward, pops slide back, tab switches cross-fade.
 * Each tab keeps its own stack, as a native bottom bar does.
 */
object Nav {
    private val stacks = Tab.entries.associateWith { mutableStateListOf<Route>(root(it)) }
    var tab by mutableStateOf(Tab.Today)
        private set
    var over by mutableStateOf<Over?>(null)
        private set
    /** +1 for a push, -1 for a pop, 0 for a tab switch: the direction screens slide. */
    var direction by mutableStateOf(0)
        private set

    private fun root(t: Tab): Route = when (t) {
        Tab.Today -> Route.Today
        Tab.Medicines -> Route.Medicines
        Tab.History -> Route.History
        Tab.You -> Route.You
    }

    val stack get() = stacks.getValue(tab)
    val current: Route get() = stack.last()
    val canPop get() = stack.size > 1 || tab != Tab.Today

    fun go(t: Tab) {
        if (t == tab) {
            // A second tap on the current tab goes back to its root.
            if (stack.size > 1) {
                direction = -1
                while (stack.size > 1) stack.removeAt(stack.lastIndex)
            }
            return
        }
        direction = 0
        tab = t
    }

    fun push(r: Route) {
        if (r.tab != tab) { direction = 0; tab = r.tab }
        else direction = 1
        if (stack.last() != r) stack += r
    }

    fun replace(r: Route) {
        direction = 0
        stack[stack.lastIndex] = r
    }

    fun pop(): Boolean {
        direction = -1
        if (stack.size > 1) {
            stack.removeAt(stack.lastIndex)
            return true
        }
        if (tab != Tab.Today) {
            direction = 0
            tab = Tab.Today
            return true
        }
        return false
    }

    fun open(o: Over) { over = o }
    fun closeOver() { over = null }

    /** tend://today, tend://dose/next, tend://dose/2026-10-19T08:00, tend://medicine/new, tend://medicine/{id}, tend://history */
    fun deepLink(uri: Uri?) {
        uri ?: return
        val parts = listOfNotNull(uri.host) + uri.pathSegments
        when (parts.firstOrNull()) {
            "today" -> { go(Tab.Today); while (stack.size > 1) stack.removeAt(stack.lastIndex) }
            "dose" -> { go(Tab.Today); open(Over.Dose(parts.getOrNull(1) ?: "next")) }
            "medicine" -> when (val id = parts.getOrNull(1)) {
                null, "new" -> open(Over.Editor(null))
                else -> { go(Tab.Medicines); push(Route.Medicine(id)) }
            }
            "history" -> go(Tab.History)
        }
    }
}
