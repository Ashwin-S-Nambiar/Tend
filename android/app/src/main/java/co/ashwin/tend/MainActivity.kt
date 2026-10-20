package co.ashwin.tend

import android.content.Intent
import android.content.res.Configuration
import android.os.Bundle
import android.text.format.DateFormat
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import co.ashwin.tend.core.use24h
import co.ashwin.tend.data.Repo
import co.ashwin.tend.feel.reducedMotion
import co.ashwin.tend.ui.Nav
import co.ashwin.tend.ui.TendRoot

class MainActivity : ComponentActivity() {
    private var reduced by mutableStateOf(false)
    private var splash by mutableStateOf(false)
    private var lightBars: Boolean? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        val system = installSplashScreen()
        super.onCreate(savedInstanceState)
        Repo.init(this)
        // Our own splash draws the same frame, so the system one leaves at once with no fade.
        system.setOnExitAnimationListener { it.remove() }
        splash = savedInstanceState == null && Repo.now.settings.onboarded
        reduced = reducedMotion(this)
        use24h = DateFormat.is24HourFormat(this)
        if (intent?.data?.host == "debug") debug(intent?.data?.lastPathSegment)
        else if (savedInstanceState == null) Nav.deepLink(intent?.data)
        bars(true)
        setContent {
            TendRoot(reduced, splash, { splash = false }) { light -> bars(light) }
        }
    }

    private fun bars(light: Boolean) {
        if (lightBars == light) return
        lightBars = light
        val t = android.graphics.Color.TRANSPARENT
        enableEdgeToEdge(
            statusBarStyle = if (light) SystemBarStyle.light(t, t) else SystemBarStyle.dark(t),
            navigationBarStyle = if (light) SystemBarStyle.light(t, t) else SystemBarStyle.dark(t),
        )
    }

    private fun debug(what: String?) = if (what == "widgets") Sample.renderWidgets(this) else Sample.load(night = what == "night")

    override fun onResume() {
        super.onResume()
        reduced = reducedMotion(this)
        use24h = DateFormat.is24HourFormat(this)
        Repo.applyZone()
    }

    // A theme change resets the bar icons to the window theme, so the next composition must reapply ours.
    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        lightBars = null
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (intent.data?.host == "debug") debug(intent.data?.lastPathSegment) else Nav.deepLink(intent.data)
    }
}
