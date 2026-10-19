package co.ashwin.tend

import android.app.Application
import co.ashwin.tend.alarm.Alarms
import co.ashwin.tend.data.Repo
import co.ashwin.tend.feel.Feels
import co.ashwin.tend.widget.Widgets

class TendApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Repo.init(this)
        Feels.init(this)
        Alarms.channels(this)
        // Every saved change moves the alarm, clears logged notifications and refreshes widgets.
        Repo.onChange = { context ->
            Alarms.replan(context)
            Widgets.updateAll(context)
        }
        Alarms.replan(this)
    }
}
