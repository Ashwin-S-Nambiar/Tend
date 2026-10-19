package co.ashwin.tend.feel

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.os.Build
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import co.ashwin.tend.core.Feel
import co.ashwin.tend.data.Repo
import java.util.concurrent.Executors
import kotlin.math.PI
import kotlin.math.exp
import kotlin.math.ln
import kotlin.math.sin
import kotlin.random.Random

/** Animator scale 0 is Android's reduced motion: it turns movement into fades and silences haptics and sound. */
fun reducedMotion(context: Context): Boolean =
    Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f

/** Named haptic patterns, each paired with its sound. */
enum class Haptic { Tap, Tick, Success, Warn, Thud }

object Feels {
    private lateinit var app: Context
    private val audio = Executors.newSingleThreadExecutor()

    fun init(context: Context) {
        app = context.applicationContext
        audio.execute { Sound.entries.forEach { runCatching { it.prepare() } } }
    }

    private var lastTick = 0L

    private val vibrator: Vibrator? by lazy {
        if (Build.VERSION.SDK_INT >= 31) app.getSystemService(VibratorManager::class.java)?.defaultVibrator
        else @Suppress("DEPRECATION") app.getSystemService(Vibrator::class.java)
    }

    fun haptic(h: Haptic) {
        if (reducedMotion(app)) return
        if (h == Haptic.Tick) {
            val now = SystemClock.uptimeMillis()
            if (now - lastTick < 35) return
            lastTick = now
        }
        val v = vibrator ?: return
        if (!v.hasVibrator()) return
        val effect = if (Build.VERSION.SDK_INT >= 29) {
            when (h) {
                Haptic.Tap -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK)
                Haptic.Tick -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK)
                Haptic.Success -> VibrationEffect.createWaveform(longArrayOf(0, 10, 40, 14), intArrayOf(0, 160, 0, 220), -1)
                Haptic.Warn -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_DOUBLE_CLICK)
                Haptic.Thud -> VibrationEffect.createPredefined(VibrationEffect.EFFECT_HEAVY_CLICK)
            }
        } else {
            when (h) {
                Haptic.Tap -> VibrationEffect.createOneShot(8, 120)
                Haptic.Tick -> VibrationEffect.createOneShot(4, 80)
                Haptic.Success -> VibrationEffect.createWaveform(longArrayOf(0, 10, 40, 14), -1)
                Haptic.Warn -> VibrationEffect.createWaveform(longArrayOf(0, 24, 60, 24), -1)
                Haptic.Thud -> VibrationEffect.createOneShot(30, 255)
            }
        }
        runCatching { v.vibrate(effect) }
    }

    fun sound(s: Sound) {
        if (!Repo.now.settings.sound || reducedMotion(app)) return
        if (!s.claim(SystemClock.uptimeMillis())) return
        audio.execute { runCatching { s.play() } }
    }

    /** Haptic and sound fire together, on the action that caused them. */
    fun feel(f: Feel) = when (f) {
        Feel.Taken -> { haptic(Haptic.Success); sound(Sound.Taken) }
        Feel.Skip -> { haptic(Haptic.Tick); sound(Sound.Skip) }
        Feel.Snooze -> { haptic(Haptic.Tick); sound(Sound.Snooze) }
        Feel.Quiet -> haptic(Haptic.Tap)
    }
}

/** Every sound is synthesized: sine tones and filtered noise with exponential envelopes, as on the web. */
enum class Sound(private val gap: Long, private val build: Synth.() -> kotlin.Unit) {
    Taken(300, { tone(660.0, dur = 0.35, gain = 0.05); tone(990.0, dur = 0.4, gain = 0.04, delay = 0.09) }),
    Skip(150, { tone(330.0, to = 280.0, dur = 0.12, gain = 0.04) }),
    Snooze(200, { tone(1200.0, dur = 0.04, gain = 0.022); tone(1200.0, dur = 0.04, gain = 0.022, delay = 0.09) }),
    Whoosh(250, { noise(dur = 0.28, gain = 0.022, freq = 500.0) }),
    Night(1000, { tone(392.0, dur = 1.1, gain = 0.032); tone(587.0, dur = 1.2, gain = 0.022, delay = 0.14) }),
    Tick(70, { tone(1800.0, dur = 0.02, gain = 0.012) }),
    Tap(70, { tone(740.0, to = 560.0, dur = 0.035, gain = 0.014) });

    @Volatile private var last = 0L
    private var track: AudioTrack? = null

    fun claim(now: Long): Boolean {
        if (now - last < gap) return false
        last = now
        return true
    }

    fun prepare(): AudioTrack {
        track?.let { return it }
        val data = Synth().apply(build).render()
        val t = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build(),
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setSampleRate(Synth.RATE)
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build(),
            )
            .setTransferMode(AudioTrack.MODE_STATIC)
            .setBufferSizeInBytes(data.size * 2)
            .build()
        t.write(data, 0, data.size)
        track = t
        return t
    }

    fun play() {
        val t = prepare()
        if (t.playState != AudioTrack.PLAYSTATE_STOPPED) t.pause()
        if (t.setPlaybackHeadPosition(0) != AudioTrack.SUCCESS) {
            t.stop()
            t.reloadStaticData()
        }
        t.play()
    }
}

class Synth {
    companion object {
        const val RATE = 44100
        // Web Audio peaks at 1.0 through laptop speakers; a phone speaker needs a little more.
        private const val LOUDNESS = 1.8
    }

    private val parts = mutableListOf<Pair<Int, DoubleArray>>()

    private fun envelope(t: Double, dur: Double, attack: Double, gain: Double): Double {
        val floor = 0.0001
        return if (t < attack) floor * exp(ln(gain / floor) * t / attack)
        else gain * exp(ln(floor / gain) * (t - attack) / (dur - attack))
    }

    fun tone(freq: Double, to: Double? = null, dur: Double, gain: Double, delay: Double = 0.0) {
        val n = (dur * RATE).toInt()
        val out = DoubleArray(n)
        var phase = 0.0
        for (i in 0 until n) {
            val t = i.toDouble() / RATE
            val f = if (to == null) freq else freq * exp(ln(to / freq) * t / dur)
            phase += 2 * PI * f / RATE
            out[i] = sin(phase) * envelope(t, dur, 0.01, gain)
        }
        parts += (delay * RATE).toInt() to out
    }

    /** Band-passed white noise whose centre sweeps up, like the web's whoosh. */
    fun noise(dur: Double, gain: Double, freq: Double, q: Double = 0.7) {
        val n = (dur * RATE).toInt()
        val out = DoubleArray(n)
        var x1 = 0.0; var x2 = 0.0; var y1 = 0.0; var y2 = 0.0
        val rnd = Random(7)
        for (i in 0 until n) {
            val t = i.toDouble() / RATE
            val f = freq * exp(ln(2.2) * t / dur)
            val w = 2 * PI * f / RATE
            val alpha = sin(w) / (2 * q)
            val b0 = alpha; val b2 = -alpha
            val a0 = 1 + alpha; val a1 = -2 * kotlin.math.cos(w); val a2 = 1 - alpha
            val x = rnd.nextDouble() * 2 - 1
            val y = (b0 * x + b2 * x2 - a1 * y1 - a2 * y2) / a0
            x2 = x1; x1 = x; y2 = y1; y1 = y
            out[i] = y * envelope(t, dur, dur * 0.4, gain)
        }
        parts += 0 to out
    }

    fun render(): ShortArray {
        val len = parts.maxOf { it.first + it.second.size } + RATE / 100
        val mix = DoubleArray(len)
        for ((start, p) in parts) for (i in p.indices) mix[start + i] += p[i]
        return ShortArray(len) { i -> (mix[i] * LOUDNESS * Short.MAX_VALUE).coerceIn(-32767.0, 32767.0).toInt().toShort() }
    }
}
