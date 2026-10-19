package co.ashwin.tend.data

import android.content.Context
import android.util.AtomicFile
import co.ashwin.tend.core.DEFAULT_ROUTINES
import co.ashwin.tend.core.Data
import co.ashwin.tend.core.DoseLog
import co.ashwin.tend.core.Edit
import co.ashwin.tend.core.Medicine
import co.ashwin.tend.core.Outcome
import co.ashwin.tend.core.Routine
import co.ashwin.tend.core.TendJson
import co.ashwin.tend.core.deviceZone
import co.ashwin.tend.core.setZone
import co.ashwin.tend.core.sortMeds
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.io.File
import java.time.ZoneId
import java.util.concurrent.Executors

@Serializable
enum class Theme {
    @SerialName("system") System,
    @SerialName("light") Light,
    @SerialName("dark") Dark,
}

@Serializable
data class Travel(val mode: String = "local", val home: String = "", val seen: String? = null) {
    val keepHome get() = mode == "home"
}

@Serializable
data class Settings(
    val routines: List<Routine> = DEFAULT_ROUTINES,
    val theme: Theme = Theme.System,
    val sound: Boolean = true,
    val hideNames: Boolean = false,
    val refillAlerts: Boolean = true,
    val onboarded: Boolean = false,
    val travel: Travel = Travel(),
)

@Serializable
data class Stored(
    val meds: List<Medicine> = emptyList(),
    val logs: List<DoseLog> = emptyList(),
    val settings: Settings = Settings(),
) {
    val data get() = Data(meds, logs)
}

/**
 * Everything Tend knows lives in one small JSON file, held in memory and written off the main
 * thread. Android Auto Backup copies the file.
 */
object Repo {
    private lateinit var file: AtomicFile
    private lateinit var app: Context
    private val writer = Executors.newSingleThreadExecutor()
    private val flow = MutableStateFlow(Stored())
    private var loaded = false

    val state: StateFlow<Stored> get() = flow
    val now: Stored get() = flow.value

    /** Called after every change, to move alarms, notifications and widgets with the data. */
    var onChange: (Context) -> kotlin.Unit = {}

    @Synchronized
    fun init(context: Context) {
        if (loaded) return
        app = context.applicationContext
        file = AtomicFile(File(app.filesDir, "tend.json"))
        val read = try {
            TendJson.decodeFromString(Stored.serializer(), file.readFully().decodeToString())
        } catch (_: Exception) {
            Stored()
        }
        val travel = read.settings.travel
        val fixed = if (travel.home.isEmpty()) {
            read.copy(settings = read.settings.copy(travel = travel.copy(home = deviceZone().id)))
        } else read
        flow.value = fixed.copy(meds = sortMeds(fixed.meds))
        loaded = true
        applyZone()
    }

    /** Points the time functions at home time while the person keeps it. */
    fun applyZone() {
        val t = flow.value.settings.travel
        setZone(if (t.keepHome) runCatching { ZoneId.of(t.home) }.getOrNull() else null)
    }

    @Synchronized
    fun update(change: (Stored) -> Stored) {
        val before = flow.value
        val next = change(before)
        if (next == before) return
        flow.value = next
        if (next.settings.travel != before.settings.travel) applyZone()
        val text = TendJson.encodeToString(Stored.serializer(), next)
        writer.execute {
            synchronized(file) {
                val out = file.startWrite()
                try {
                    out.write(text.encodeToByteArray())
                    file.finishWrite(out)
                } catch (e: Exception) {
                    file.failWrite(out)
                }
            }
        }
        onChange(app)
    }

    fun edit(change: Edit) = update { s ->
        val d = change(s.data)
        s.copy(meds = d.meds, logs = d.logs)
    }

    /** Applies an action's result and returns its undo. */
    fun apply(outcome: Outcome?): (() -> kotlin.Unit)? {
        outcome ?: return null
        update { it.copy(meds = outcome.data.meds, logs = outcome.data.logs) }
        return { edit(outcome.undo) }
    }

    fun settings(change: (Settings) -> Settings) = update { it.copy(settings = change(it.settings)) }

    /** Waits for pending writes, for receivers that are about to return. */
    fun flush() {
        writer.submit {}.get()
    }
}
