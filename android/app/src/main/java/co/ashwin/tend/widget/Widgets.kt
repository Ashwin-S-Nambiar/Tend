package co.ashwin.tend.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.view.View
import android.widget.RemoteViews
import co.ashwin.tend.R
import co.ashwin.tend.alarm.ActionReceiver
import co.ashwin.tend.alarm.Alarms
import co.ashwin.tend.core.GroupState
import co.ashwin.tend.core.Group
import co.ashwin.tend.core.Scene
import co.ashwin.tend.core.Slot
import co.ashwin.tend.core.addDays
import co.ashwin.tend.core.clock
import co.ashwin.tend.core.dayKey
import co.ashwin.tend.core.dueDate
import co.ashwin.tend.core.doseState
import co.ashwin.tend.core.fmtDay
import co.ashwin.tend.core.fmtTime
import co.ashwin.tend.core.medById
import co.ashwin.tend.core.nowKey
import co.ashwin.tend.core.pending
import co.ashwin.tend.core.progress
import co.ashwin.tend.core.relDayAfterTime
import co.ashwin.tend.core.slotsOn
import co.ashwin.tend.core.today
import co.ashwin.tend.core.weekday
import co.ashwin.tend.data.Repo
import kotlin.math.roundToInt

class NextDoseWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        Repo.init(context)
        Widgets.updateAll(context)
    }
}

class SmallNextWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        Repo.init(context)
        Widgets.updateAll(context)
    }
}

class WeekWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        Repo.init(context)
        Widgets.updateAll(context)
    }
}

fun takeLabel(n: Int) = when (n) {
    1 -> "Take"
    2 -> "Take both"
    else -> "Take all $n"
}

object Widgets {
    private fun ids(context: Context, cls: Class<*>) =
        AppWidgetManager.getInstance(context).getAppWidgetIds(ComponentName(context, cls))

    fun updateAll(context: Context) {
        val m = AppWidgetManager.getInstance(context)
        ids(context, NextDoseWidget::class.java).takeIf { it.isNotEmpty() }?.let { m.updateAppWidget(it, next(context)) }
        ids(context, SmallNextWidget::class.java).takeIf { it.isNotEmpty() }?.let { m.updateAppWidget(it, small(context)) }
        ids(context, WeekWidget::class.java).takeIf { it.isNotEmpty() }?.let { m.updateAppWidget(it, week(context)) }
    }

    private fun names(g: Group): String {
        val meds = Repo.now.meds
        return g.doses.mapNotNull { medById(meds, it.medId)?.name }.distinct().joinToString(", ")
    }

    private fun action(context: Context, what: String, key: String) = PendingIntent.getBroadcast(
        context,
        ("w$what$key").hashCode(),
        Intent(context, ActionReceiver::class.java).setAction(what).putExtra(ActionReceiver.KEY, key),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    internal fun next(context: Context): RemoteViews {
        val s = Repo.now
        val now = clock()
        val t = today(s.meds, s.settings.routines, s.logs, now)
        val v = RemoteViews(context.packageName, R.layout.widget_next)
        val focus: Slot? = t.focus
        val scene = focus?.scene ?: t.next?.scene ?: Scene.Evening
        val night = scene == Scene.Night
        v.setInt(android.R.id.background, "setBackgroundResource", bg(scene))
        v.setImageViewResource(R.id.orb, orb(scene))
        v.setImageViewResource(R.id.pip, if (night) R.drawable.pip_night else R.drawable.pip)
        val ink = if (night) 0xFFF2EEE8.toInt() else 0xFF1D2430.toInt()
        v.setTextColor(R.id.meta, ink)
        v.setTextColor(R.id.title, ink)
        when {
            t.empty -> {
                v.setTextViewText(R.id.meta, "Tend")
                v.setTextViewText(R.id.title, "Add a medicine")
                v.setViewVisibility(R.id.actions, View.GONE)
                v.setOnClickPendingIntent(R.id.open, Alarms.open(context, "medicine/new"))
            }
            focus != null -> {
                val due = focus.state == GroupState.Due || focus.state == GroupState.Snoozed
                val meta = when {
                    focus.state == GroupState.Snoozed && focus.until != null -> "${focus.label} · snoozed to ${fmtTime(focus.until)}"
                    due -> "${focus.label} · due ${fmtTime(focus.key)}"
                    else -> "${focus.label} · at ${fmtTime(focus.key)}"
                }
                v.setTextViewText(R.id.meta, meta)
                v.setTextViewText(R.id.title, names(focus.group))
                val open = focus.doses.count { doseState(s.logs, it, nowKey(now)).pending }
                v.setViewVisibility(R.id.actions, if (due && open > 0) View.VISIBLE else View.GONE)
                v.setTextViewText(R.id.take, takeLabel(open))
                v.setOnClickPendingIntent(R.id.take, action(context, ActionReceiver.TAKE, focus.key))
                v.setOnClickPendingIntent(R.id.snooze, action(context, ActionReceiver.SNOOZE, focus.key))
                v.setOnClickPendingIntent(R.id.open, Alarms.open(context, "dose/${focus.key}"))
            }
            else -> {
                val n = t.next
                v.setTextViewText(R.id.meta, "All done for now")
                v.setTextViewText(
                    R.id.title,
                    n?.let { "Next: ${names(it)} at ${fmtTime(it.key)}${relDayAfterTime(it.day, t.today)}" } ?: "Nothing else scheduled",
                )
                v.setViewVisibility(R.id.actions, View.GONE)
                v.setOnClickPendingIntent(R.id.open, Alarms.open(context, "today"))
            }
        }
        return v
    }

    internal fun small(context: Context): RemoteViews {
        val s = Repo.now
        val now = clock()
        val t = today(s.meds, s.settings.routines, s.logs, now)
        val v = RemoteViews(context.packageName, R.layout.widget_small)
        val g = t.focus?.group ?: t.next
        if (g == null) {
            v.setTextViewText(R.id.time, if (t.empty) "Tend" else "All done")
            v.setTextViewText(R.id.what, if (t.empty) "Add a medicine" else "Nothing else scheduled")
        } else {
            val day = relDayAfterTime(g.day, t.today)
            v.setTextViewText(R.id.time, fmtTime(g.key) + day)
            v.setTextViewText(R.id.what, "${g.label} · ${names(g)}")
        }
        v.setOnClickPendingIntent(android.R.id.background, Alarms.open(context, g?.let { "dose/${it.key}" } ?: "today"))
        return v
    }

    internal fun week(context: Context): RemoteViews {
        val s = Repo.now
        val now = clock()
        val today = dayKey(now)
        val monday = addDays(today, -((weekday(today) + 6) % 7))
        val days = (0 until 7).map { i ->
            val day = addDays(monday, i)
            val future = day > today
            val slots = if (future) emptyList() else slotsOn(
                s.meds.filter { !it.isArchived },
                s.settings.routines,
                s.logs,
                day,
                if (day == today) now else dueDate("${day}T23:59"),
            )
            Triple(day, future, progress(slots, s.logs, now))
        }
        val total = days.sumOf { it.third.total }
        val done = days.sumOf { it.third.done }
        val v = RemoteViews(context.packageName, R.layout.widget_week)
        v.setImageViewBitmap(R.id.rings, rings(context, days.map { (day, future, p) -> Ring(fmtDay(day, "EEEEE"), if (p.total == 0) 0f else p.done.toFloat() / p.total, day == today, future) }))
        v.setContentDescription(R.id.rings, "$done of $total doses logged this week")
        v.setTextViewText(R.id.summary, if (total == 0) "Nothing scheduled yet" else "${(done * 100f / total).roundToInt()}% logged")
        v.setOnClickPendingIntent(android.R.id.background, Alarms.open(context, "history"))
        return v
    }

    private data class Ring(val label: String, val fill: Float, val today: Boolean, val future: Boolean)

    private fun rings(context: Context, rings: List<Ring>): Bitmap {
        val d = context.resources.displayMetrics.density
        val cell = 30 * d
        val w = (cell * 7 + 6 * 4 * d).toInt()
        val h = (cell + 18 * d).toInt()
        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val stroke = 4.5f * d
        val track = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = stroke }
        val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE; strokeWidth = stroke; strokeCap = Paint.Cap.ROUND; color = 0xFF17A58F.toInt()
        }
        val text = Paint(Paint.ANTI_ALIAS_FLAG).apply { textSize = 11 * d; textAlign = Paint.Align.CENTER }
        rings.forEachIndexed { i, r ->
            val x = i * (cell + 4 * d)
            val rect = RectF(x + stroke, stroke, x + cell - stroke, cell - stroke)
            track.color = if (r.today) 0x591D2430 else 0x1A1D2430
            track.pathEffect = if (r.future) android.graphics.DashPathEffect(floatArrayOf(2 * d, 4 * d), 0f) else null
            c.drawArc(rect, 0f, 360f, false, track)
            if (r.fill > 0) c.drawArc(rect, -90f, 360f * r.fill, false, fill)
            text.color = if (r.today) 0xFF1D2430.toInt() else 0xFF5E6673.toInt()
            text.typeface = if (r.today) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
            c.drawText(r.label, x + cell / 2, h - 3 * d, text)
        }
        return bmp
    }

    private fun bg(scene: Scene) = when (scene) {
        Scene.Morning -> R.drawable.w_bg_morning
        Scene.Afternoon -> R.drawable.w_bg_afternoon
        Scene.Evening -> R.drawable.w_bg_evening
        Scene.Night -> R.drawable.w_bg_night
    }

    private fun orb(scene: Scene) = when (scene) {
        Scene.Morning -> R.drawable.w_orb_morning
        Scene.Afternoon -> R.drawable.w_orb_afternoon
        Scene.Evening -> R.drawable.w_orb_evening
        Scene.Night -> R.drawable.w_orb_night
    }
}
