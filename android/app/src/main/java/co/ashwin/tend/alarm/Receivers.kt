package co.ashwin.tend.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import co.ashwin.tend.core.GroupState
import co.ashwin.tend.core.clock
import co.ashwin.tend.core.doseState
import co.ashwin.tend.core.findSlot
import co.ashwin.tend.core.nowKey
import co.ashwin.tend.core.pending
import co.ashwin.tend.core.refill
import co.ashwin.tend.core.skip
import co.ashwin.tend.core.snooze
import co.ashwin.tend.core.take
import co.ashwin.tend.data.Repo
import co.ashwin.tend.data.Travel
import co.ashwin.tend.widget.Widgets

/** Runs work off the main thread and keeps the receiver alive until the data is on disk. */
private fun BroadcastReceiver.work(context: Context, block: () -> Unit) {
    val result = goAsync()
    Thread {
        try {
            Repo.init(context)
            block()
            Repo.flush()
        } finally {
            result.finish()
        }
    }.start()
}

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) = work(context) { Alarms.ring(context) }
}

class SystemReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) = work(context) {
        // A new device zone changes what "home time" and "today" mean.
        Repo.applyZone()
        if (intent.action == Intent.ACTION_TIMEZONE_CHANGED) Alarms.travelPrompt(context)
        Alarms.channels(context)
        Alarms.replan(context)
        Widgets.updateAll(context)
    }
}

/** Taken, Snooze and Skip straight from a notification or widget, without opening the app. */
class ActionReceiver : BroadcastReceiver() {
    companion object {
        const val KEY = "key"
        const val TAKE = "co.ashwin.tend.TAKE"
        const val SNOOZE = "co.ashwin.tend.SNOOZE"
        const val SKIP = "co.ashwin.tend.SKIP"
        const val REFILL = "co.ashwin.tend.REFILL"
        const val DISMISS = "co.ashwin.tend.DISMISS"
        const val TRAVEL_HOME = "co.ashwin.tend.TRAVEL_HOME"
        const val TRAVEL_LOCAL = "co.ashwin.tend.TRAVEL_LOCAL"
    }

    override fun onReceive(context: Context, intent: Intent) = work(context) {
        val key = intent.getStringExtra(KEY) ?: return@work
        when (intent.action) {
            TAKE, SNOOZE, SKIP -> dose(context, intent.action!!, key)
            REFILL -> {
                Repo.now.meds.find { it.id == key }?.let { Repo.apply(refill(Repo.now.data, it)) }
                Alarms.cancel(context, key, refill = true)
            }
            DISMISS -> Alarms.cancel(context, key, refill = true)
            TRAVEL_HOME -> {
                Repo.settings { it.copy(travel = it.travel.copy(mode = "home", seen = key)) }
                Alarms.cancel(context, "travel", refill = false)
            }
            TRAVEL_LOCAL -> {
                Repo.settings { it.copy(travel = Travel("local", it.travel.home, key)) }
                Alarms.cancel(context, "travel", refill = false)
            }
        }
    }

    private fun dose(context: Context, action: String, key: String) {
        val s = Repo.now
        val now = clock()
        val slot = findSlot(s.meds, s.settings.routines, s.logs, if (key == "next") "next" else key, now)
        if (slot == null) {
            Alarms.cancelDose(context, key)
            return
        }
        val nk = nowKey(now)
        val open = slot.doses.filter { doseState(s.logs, it, nk).pending }
        when (action) {
            TAKE -> Repo.apply(take(s.data, open, slot.label))
            SKIP -> Repo.apply(skip(s.data, open, slot.label))
            SNOOZE -> if (slot.state != GroupState.Done) Repo.apply(snooze(s.data, slot.group, 10, now))
        }
        Alarms.cancelDose(context, slot.key)
    }
}

