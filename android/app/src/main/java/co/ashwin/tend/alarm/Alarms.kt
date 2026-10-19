package co.ashwin.tend.alarm

import android.Manifest
import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.net.Uri
import android.os.Build
import androidx.core.content.ContextCompat
import androidx.core.content.edit
import co.ashwin.tend.MainActivity
import co.ashwin.tend.R
import co.ashwin.tend.core.GroupState
import co.ashwin.tend.core.Reminder
import co.ashwin.tend.core.activeZone
import co.ashwin.tend.core.clock
import co.ashwin.tend.core.dayKey
import co.ashwin.tend.core.deviceZone
import co.ashwin.tend.core.doseState
import co.ashwin.tend.core.findSlot
import co.ashwin.tend.core.fmtNum
import co.ashwin.tend.core.gapText
import co.ashwin.tend.core.lowStock
import co.ashwin.tend.core.nextReminder
import co.ashwin.tend.core.nowKey
import co.ashwin.tend.core.pending
import co.ashwin.tend.core.plural
import co.ashwin.tend.core.reminders
import co.ashwin.tend.core.remindersBetween
import co.ashwin.tend.core.zoneGap
import co.ashwin.tend.core.zoneName
import co.ashwin.tend.data.Repo
import co.ashwin.tend.widget.Widgets
import java.time.Instant
import java.time.LocalTime
import java.time.ZoneId

/**
 * Local exact alarms replace the push server. One alarm is armed at a time, for the earliest of the
 * next reminder, follow-up or refill check; when it rings, everything due is posted and the next
 * one is armed.
 */
object Alarms {
    const val CH_DOSES = "doses"
    const val CH_FOLLOW = "follow-ups"
    const val CH_REFILLS = "refills"
    const val CH_TRAVEL = "travel"

    private const val PREFS = "alarms"
    private const val LAST = "last-fired"
    private const val REFILL_DAY = "refill-day"
    private const val REFILL_HOUR = 9
    private const val NOTIFY_DOSE = 1
    private const val NOTIFY_REFILL = 2
    private const val NOTIFY_TRAVEL = 3

    fun channels(context: Context) {
        val nm = context.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannels(
            listOf(
                NotificationChannel(CH_DOSES, "Doses", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "A reminder at each scheduled time"
                },
                NotificationChannel(CH_FOLLOW, "Follow-ups", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "A second reminder 30 minutes later if nothing is logged"
                },
                NotificationChannel(CH_REFILLS, "Refills", NotificationManager.IMPORTANCE_DEFAULT).apply {
                    description = "When a supply is about to run out"
                },
                NotificationChannel(CH_TRAVEL, "Travel", NotificationManager.IMPORTANCE_DEFAULT).apply {
                    description = "When you arrive in a new time zone"
                },
            ),
        )
    }

    fun canNotify(context: Context) = Build.VERSION.SDK_INT < 33 ||
        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    fun canExact(context: Context) = Build.VERSION.SDK_INT < 31 ||
        context.getSystemService(AlarmManager::class.java).canScheduleExactAlarms()

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun all(now: Instant): List<Reminder> {
        val s = Repo.now
        return reminders(s.meds, s.settings.routines, s.logs, now, away = activeZone() != deviceZone())
    }

    private fun nextRefillCheck(context: Context, now: Instant): Instant? {
        val s = Repo.now
        if (!s.settings.refillAlerts) return null
        if (lowStock(s.meds, s.settings.routines, dayKey(now)).isEmpty()) return null
        val zone = deviceZone()
        val today = now.atZone(zone).toLocalDate()
        val done = prefs(context).getString(REFILL_DAY, null) == today.toString()
        val at = today.atTime(LocalTime.of(REFILL_HOUR, 0)).atZone(zone).toInstant()
        return when {
            !done && !now.isBefore(at) -> now.plusSeconds(5)
            !done -> at
            else -> today.plusDays(1).atTime(LocalTime.of(REFILL_HOUR, 0)).atZone(zone).toInstant()
        }
    }

    private fun pending(context: Context, action: String): PendingIntent =
        PendingIntent.getBroadcast(
            context,
            0,
            Intent(context, AlarmReceiver::class.java).setAction(action),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

    /** Re-arms the single alarm and clears notifications for doses that are now logged. */
    fun replan(context: Context) {
        val now = clock()
        val p = prefs(context)
        if (!p.contains(LAST)) p.edit { putLong(LAST, now.toEpochMilli()) }
        val candidates = listOfNotNull(nextReminder(all(now), now)?.at, nextRefillCheck(context, now))
        val am = context.getSystemService(AlarmManager::class.java)
        val pi = pending(context, ACTION_RING)
        val at = candidates.minOrNull()
        if (at == null) {
            am.cancel(pi)
        } else if (canExact(context)) {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at.toEpochMilli(), pi)
        } else {
            // If a phone still refuses exact alarms, a 10 minute window beats the hour Android allows otherwise.
            am.setWindow(AlarmManager.RTC_WAKEUP, at.toEpochMilli(), 10 * 60_000L, pi)
        }
        clearLogged(context)
    }

    private fun clearLogged(context: Context) {
        val nm = context.getSystemService(NotificationManager::class.java)
        val s = Repo.now
        val nk = nowKey()
        for (n in nm.activeNotifications) {
            val tag = n.tag ?: continue
            if (n.id == NOTIFY_DOSE) {
                val slot = findSlot(s.meds, s.settings.routines, s.logs, tag, clock())
                if (slot == null || slot.state == GroupState.Snoozed || slot.doses.none { doseState(s.logs, it, nk).pending }) {
                    nm.cancel(tag, n.id)
                }
            }
            if (n.id == NOTIFY_REFILL && lowStock(s.meds, s.settings.routines, dayKey()).none { it.med.id == tag }) {
                nm.cancel(tag, n.id)
            }
        }
    }

    /** The alarm rang: post what is due, then arm the next one. */
    fun ring(context: Context) {
        val now = clock()
        val p = prefs(context)
        // Reminders missed while the phone was off are posted if they are still recent.
        val last = Instant.ofEpochMilli(p.getLong(LAST, now.toEpochMilli()))
        val from = maxOf(last, now.minusSeconds(20 * 60))
        val due = remindersBetween(all(now), from, now.plusSeconds(30))
        // A follow-up replaces its reminder, so only the latest of each group is posted.
        due.groupBy { it.key }.values.map { it.last() }.forEach { post(context, it) }
        p.edit { putLong(LAST, now.plusSeconds(30).toEpochMilli()) }
        refillCheck(context, now)
        replan(context)
        Widgets.updateAll(context)
    }

    private fun refillCheck(context: Context, now: Instant) {
        val at = nextRefillCheck(context, now) ?: return
        if (at.isAfter(now.plusSeconds(30))) return
        val s = Repo.now
        for (row in lowStock(s.meds, s.settings.routines, dayKey(now))) {
            val days = row.info.days ?: continue
            val title = "${row.med.name} is running low"
            val body = "${fmtNum(row.info.count)} left, about ${plural(days, "day")} at this pace."
            val n = base(context, CH_REFILLS, "medicine/${row.med.id}")
                .setContentTitle(title)
                .setContentText(body)
                .setLargeIcon(pipIcon(context))
                .addAction(action(context, "Refilled", ActionReceiver.REFILL, row.med.id))
                .addAction(action(context, "Later", ActionReceiver.DISMISS, row.med.id))
                .setPublicVersion(publicVersion(context, CH_REFILLS, "A medicine is running low"))
                .setVisibility(if (s.settings.hideNames) Notification.VISIBILITY_PRIVATE else Notification.VISIBILITY_PUBLIC)
                .build()
            notify(context, row.med.id, NOTIFY_REFILL, n)
        }
        prefs(context).edit { putString(REFILL_DAY, now.atZone(deviceZone()).toLocalDate().toString()) }
    }

    fun post(context: Context, r: Reminder) {
        val hide = Repo.now.settings.hideNames
        val b = base(context, if (r.followUp) CH_FOLLOW else CH_DOSES, "dose/${r.key}")
            .setContentTitle(r.title)
            .setContentText(r.body)
            .setStyle(Notification.BigTextStyle().bigText(r.body))
            .setLargeIcon(pipIcon(context))
            .setWhen(r.at.toEpochMilli())
            .setShowWhen(true)
            .addAction(action(context, "Taken", ActionReceiver.TAKE, r.key))
            .addAction(action(context, "Snooze 10 min", ActionReceiver.SNOOZE, r.key))
            .addAction(action(context, "Skip", ActionReceiver.SKIP, r.key))
            .setVisibility(if (hide) Notification.VISIBILITY_PRIVATE else Notification.VISIBILITY_PUBLIC)
            .setPublicVersion(publicVersion(context, if (r.followUp) CH_FOLLOW else CH_DOSES, r.publicBody))
        notify(context, r.key, NOTIFY_DOSE, b.build())
    }

    /** Asks whether to keep home time after the phone moves to a new zone. */
    fun travelPrompt(context: Context) {
        val t = Repo.now.settings.travel
        val here = deviceZone().id
        if (t.keepHome || t.home == here || t.seen == here) return
        val home = zoneName(t.home)
        val gap = zoneGap(ZoneId.of(t.home), deviceZone())
        val n = base(context, CH_TRAVEL, "today")
            .setContentTitle("You’re on ${zoneName(here)} time")
            .setContentText("Keep your doses on $home time, or follow the clock here?")
            .setStyle(
                Notification.BigTextStyle().bigText(
                    "$home is ${gapText(gap)} ${zoneName(here)}. Keep your doses on $home time, or follow the clock here?",
                ),
            )
            .addAction(action(context, "Keep home time", ActionReceiver.TRAVEL_HOME, here))
            .addAction(action(context, "Use local", ActionReceiver.TRAVEL_LOCAL, here))
            .build()
        notify(context, "travel", NOTIFY_TRAVEL, n)
    }

    fun cancelDose(context: Context, key: String) =
        context.getSystemService(NotificationManager::class.java).cancel(key, NOTIFY_DOSE)

    fun cancel(context: Context, tag: String, refill: Boolean) =
        context.getSystemService(NotificationManager::class.java).cancel(tag, if (refill) NOTIFY_REFILL else NOTIFY_TRAVEL)

    private fun notify(context: Context, tag: String, id: Int, n: Notification) {
        if (!canNotify(context)) return
        runCatching { context.getSystemService(NotificationManager::class.java).notify(tag, id, n) }
    }

    private fun base(context: Context, channel: String, route: String) =
        Notification.Builder(context, channel)
            .setSmallIcon(R.drawable.ic_stat_pip)
            .setColor(context.getColor(R.color.pip_deep))
            .setCategory(Notification.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(open(context, route))

    private fun publicVersion(context: Context, channel: String, text: String) =
        Notification.Builder(context, channel)
            .setSmallIcon(R.drawable.ic_stat_pip)
            .setColor(context.getColor(R.color.pip_deep))
            .setContentTitle("Tend")
            .setContentText(text)
            .build()

    fun open(context: Context, route: String): PendingIntent =
        PendingIntent.getActivity(
            context,
            route.hashCode(),
            Intent(Intent.ACTION_VIEW, Uri.parse("tend://$route"), context, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

    private fun action(context: Context, label: String, what: String, key: String): Notification.Action {
        val intent = Intent(context, ActionReceiver::class.java)
            .setAction(what)
            .putExtra(ActionReceiver.KEY, key)
        val pi = PendingIntent.getBroadcast(
            context,
            (what + key).hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return Notification.Action.Builder(null, label, pi).build()
    }

    private var pipBitmap: Bitmap? = null

    private fun pipIcon(context: Context): Bitmap = pipBitmap ?: run {
        val d = context.getDrawable(R.drawable.pip)!!
        val px = (64 * context.resources.displayMetrics.density).toInt()
        Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888).also { bmp ->
            d.setBounds(0, 0, px, px)
            d.draw(Canvas(bmp))
            pipBitmap = bmp
        }
    }

    const val ACTION_RING = "co.ashwin.tend.RING"
}
