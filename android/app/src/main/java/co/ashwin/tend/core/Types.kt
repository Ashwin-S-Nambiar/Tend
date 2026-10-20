package co.ashwin.tend.core

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonClassDiscriminator
import kotlinx.serialization.json.JsonContentPolymorphicSerializer
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.jsonObject

// Field names match the web app's backups, so those files still restore here.

@Serializable
enum class RoutineId {
    @SerialName("wake") Wake,
    @SerialName("breakfast") Breakfast,
    @SerialName("lunch") Lunch,
    @SerialName("dinner") Dinner,
    @SerialName("bed") Bed;

    val key: String get() = name.lowercase()
}

@Serializable
data class Routine(val id: RoutineId, val weekday: String, val weekend: String? = null)

@Serializable(with = AnchorSerializer::class)
sealed interface Anchor {
    val amount: Double?

    @Serializable
    data class AtRoutine(
        val routine: RoutineId,
        val offsetMin: Int,
        override val amount: Double? = null,
    ) : Anchor

    @Serializable
    data class AtTime(val time: String, override val amount: Double? = null) : Anchor
}

object AnchorSerializer : JsonContentPolymorphicSerializer<Anchor>(Anchor::class) {
    override fun selectDeserializer(element: JsonElement) =
        if ("time" in element.jsonObject) Anchor.AtTime.serializer() else Anchor.AtRoutine.serializer()
}

@OptIn(ExperimentalSerializationApi::class)
@Serializable
@JsonClassDiscriminator("kind")
sealed interface Schedule {
    @Serializable @SerialName("daily")
    data class Daily(val at: List<Anchor>) : Schedule

    @Serializable @SerialName("weekdays")
    data class Weekdays(val days: List<Int>, val at: List<Anchor>) : Schedule

    @Serializable @SerialName("interval")
    data class Interval(val everyDays: Int, val start: String, val at: List<Anchor>) : Schedule

    @Serializable @SerialName("once")
    data class Once(val `when`: String) : Schedule

    @Serializable @SerialName("cycle")
    data class Cycle(val on: Int, val off: Int, val start: String, val at: List<Anchor>) : Schedule

    @Serializable @SerialName("prn")
    data class Prn(val minGapH: Double? = null, val maxPerDay: Int? = null) : Schedule

    val kind: Kind
        get() = when (this) {
            is Daily -> Kind.Daily
            is Weekdays -> Kind.Weekdays
            is Interval -> Kind.Interval
            is Once -> Kind.Once
            is Cycle -> Kind.Cycle
            is Prn -> Kind.Prn
        }

    /** The anchors of a repeating schedule, or null for once and when-needed. */
    val anchors: List<Anchor>?
        get() = when (this) {
            is Daily -> at
            is Weekdays -> at
            is Interval -> at
            is Cycle -> at
            is Once, is Prn -> null
        }

    enum class Kind { Daily, Weekdays, Interval, Once, Cycle, Prn }
}

fun Schedule.withAnchors(at: List<Anchor>): Schedule = when (this) {
    is Schedule.Daily -> copy(at = at)
    is Schedule.Weekdays -> copy(at = at)
    is Schedule.Interval -> copy(at = at)
    is Schedule.Cycle -> copy(at = at)
    is Schedule.Once, is Schedule.Prn -> this
}

@Serializable
enum class Unit(val label: String) {
    @SerialName("mg") Mg("mg"),
    @SerialName("mcg") Mcg("mcg"),
    @SerialName("g") G("g"),
    @SerialName("ml") Ml("ml"),
    @SerialName("IU") Iu("IU"),
    @SerialName("units") Units("units"),
}

@Serializable
enum class Form {
    @SerialName("tablet") Tablet,
    @SerialName("capsule") Capsule,
    @SerialName("liquid") Liquid,
    @SerialName("drops") Drops,
    @SerialName("puff") Puff,
    @SerialName("injection") Injection,
    @SerialName("patch") Patch,
    @SerialName("cream") Cream,
}

@Serializable
enum class Food {
    @SerialName("before") Before,
    @SerialName("with") With,
    @SerialName("after") After,
    @SerialName("empty") Empty,
}

@Serializable
enum class Shape {
    @SerialName("cap") Cap,
    @SerialName("round") Round,
    @SerialName("oval") Oval,
}

@Serializable
enum class DoseUnit(val label: String) {
    @SerialName("units") Units("units"),
    @SerialName("ml") Ml("ml"),
    @SerialName("mg") Mg("mg"),
    @SerialName("mcg") Mcg("mcg"),
}

@Serializable
data class Strength(val value: Double, val unit: Unit)

@Serializable
data class Look(val shape: Shape, val colors: List<String>)

@Serializable
data class Course(val start: String, val days: Int? = null, val end: String? = null)

@Serializable
data class Stock(val count: Double, val refillAtDays: Int, val pack: Double)

@Serializable
data class Medicine(
    val id: String,
    val name: String,
    val strength: Strength? = null,
    val form: Form,
    val amount: Double,
    val doseUnit: DoseUnit? = null,
    val insulin: Boolean? = null,
    val strengthLabel: String? = null,
    val instructions: String? = null,
    val site: String? = null,
    val food: Food? = null,
    val look: Look,
    val schedule: Schedule,
    val course: Course? = null,
    val stock: Stock? = null,
    val notes: String? = null,
    val archived: Boolean? = null,
    val created: String,
) {
    val isArchived: Boolean get() = archived == true
}

@Serializable
enum class DoseStatus {
    @SerialName("taken") Taken,
    @SerialName("skipped") Skipped,
    @SerialName("snoozed") Snoozed,
}

@Serializable
data class DoseLog(
    val medId: String,
    val due: String,
    val status: DoseStatus,
    val amount: Double? = null,
    val at: String? = null,
    val snoozeUntil: String? = null,
)

enum class Scene { Morning, Afternoon, Evening, Night }

@OptIn(ExperimentalSerializationApi::class)
val TendJson = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
    encodeDefaults = false
    coerceInputValues = true
}

fun <T> KSerializer<T>.encode(value: T): String = TendJson.encodeToString(this, value)
