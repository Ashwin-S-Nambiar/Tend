package co.ashwin.tend.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.ime
import androidx.compose.runtime.LaunchedEffect
import kotlinx.coroutines.delay
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.draw.dropShadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.shadow.Shadow
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.toggleableState
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.DpOffset
import androidx.compose.ui.unit.dp
import co.ashwin.tend.feel.Feels
import co.ashwin.tend.feel.Haptic
import co.ashwin.tend.feel.Sound
import androidx.compose.foundation.text.BasicText as Text

/**
 * Every tappable thing sinks on press: quick in, springing back on release. No ripple, because the
 * press itself is the feedback. Reduced motion keeps the press as a dim instead.
 */
@OptIn(ExperimentalFoundationApi::class)
fun Modifier.tap(
    enabled: Boolean = true,
    role: Role? = Role.Button,
    label: String? = null,
    onLongClick: (() -> Unit)? = null,
    sink: Float = 0.96f,
    onClick: () -> Unit,
): Modifier = composed {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    val focused by source.collectIsFocusedAsState()
    val reduced = LocalReducedMotion.current
    val scale by animateFloatAsState(
        if (pressed && enabled && !reduced) sink else 1f,
        if (pressed) tween(80, easing = EaseOut) else spring(dampingRatio = 0.6f, stiffness = Spring.StiffnessMedium),
        label = "press",
    )
    val dim by animateFloatAsState(if (pressed && enabled && reduced) 0.7f else 1f, tween(80), label = "dim")
    val p = LocalPalette.current
    this
        .graphicsLayer { scaleX = scale; scaleY = scale; alpha = dim }
        .then(if (focused) Modifier.border(2.dp, p.pipInk, RoundedCornerShape(12.dp)) else Modifier)
        .combinedClickable(
            interactionSource = source,
            indication = null,
            enabled = enabled,
            role = role,
            onClickLabel = label,
            onLongClick = onLongClick?.let { l -> { Feels.haptic(Haptic.Thud); l() } },
            onClick = onClick,
        )
}

enum class Kind { Primary, Soft, Ghost }

@Composable
fun Btn(
    text: String,
    modifier: Modifier = Modifier,
    kind: Kind = Kind.Primary,
    small: Boolean = false,
    enabled: Boolean = true,
    icon: Ic? = null,
    trailing: Ic? = null,
    label: String? = null,
    background: Color? = null,
    foreground: Color? = null,
    onLongClick: (() -> Unit)? = null,
    onClick: () -> Unit,
) {
    val p = LocalPalette.current
    val bg = background ?: when (kind) {
        Kind.Primary -> p.pipDeep
        Kind.Soft -> p.milk
        Kind.Ghost -> p.card
    }
    val fg = foreground ?: if (kind == Kind.Primary) p.onPip else p.ink
    val shape = RoundedCornerShape(if (small) 14.dp else 18.dp)
    Row(
        modifier
            .heightIn(min = if (small) 44.dp else 52.dp)
            .alpha(if (enabled) 1f else 0.5f)
            .tap(enabled, label = label, onLongClick = onLongClick, onClick = onClick)
            .then(if (label != null) Modifier.semantics { contentDescription = label } else Modifier)
            .background(bg, shape)
            .padding(horizontal = if (small) 14.dp else 18.dp, vertical = if (small) 8.dp else 10.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        icon?.let { Icon(it, fg, size = 20.dp) }
        Text(text, style = display(if (small) 15 else 17, 700, 1.2f, fg).copy(textAlign = TextAlign.Center))
        trailing?.let { Icon(it, fg, size = 18.dp) }
    }
}

@Composable
fun IconBtn(
    icon: Ic,
    label: String,
    modifier: Modifier = Modifier,
    tone: Color? = LocalPalette.current.card,
    tint: Color = LocalPalette.current.ink,
    size: Dp = 44.dp,
    shadow: Boolean = false,
    onClick: () -> Unit,
) {
    Box(
        modifier
            .size(size)
            .tap(label = label, onClick = onClick)
            .semantics { contentDescription = label }
            .then(if (shadow) Modifier.softShadow(RoundedCornerShape(14.dp)) else Modifier)
            .then(if (tone != null) Modifier.background(tone, RoundedCornerShape(14.dp)) else Modifier),
        contentAlignment = Alignment.Center,
    ) { Icon(icon, tint, size = 22.dp) }
}

fun Modifier.softShadow(shape: Shape): Modifier = composed {
    val p = LocalPalette.current
    if (p.dark) this.dropShadow(shape, Shadow(2.dp, color = Color(0x4D000000), offset = DpOffset(0.dp, 1.dp)))
    else this
        .dropShadow(shape, Shadow(24.dp, color = Color(0x0F1D2430), offset = DpOffset(0.dp, 8.dp)))
        .dropShadow(shape, Shadow(2.dp, color = Color(0x0F1D2430), offset = DpOffset(0.dp, 1.dp)))
}

@Composable
fun CardBox(modifier: Modifier = Modifier, padding: Dp = 16.dp, radius: Dp = 24.dp, content: @Composable ColumnScope.() -> Unit) {
    val p = LocalPalette.current
    val shape = RoundedCornerShape(radius)
    Column(
        modifier.fillMaxWidth().softShadow(shape).background(p.card, shape).padding(padding),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        content = content,
    )
}

@Composable
fun H2(text: String, modifier: Modifier = Modifier) {
    Text(
        text,
        modifier.padding(horizontal = 4.dp).semantics { heading() },
        style = display(16, 700, 1.25f, LocalPalette.current.soft),
    )
}

@Composable
fun Label(text: String, modifier: Modifier = Modifier, color: Color = LocalPalette.current.soft) {
    Text(text, modifier, style = display(14, 700, 1.2f, color))
}

@Composable
fun SwitchRow(on: Boolean, onChange: (Boolean) -> Unit, label: String, hint: String? = null, icon: Ic? = null) {
    val p = LocalPalette.current
    val track by animateColorAsState(if (on) p.pipDeep else p.lineStrong, tween(200), label = "track")
    val x by animateDpAsState(if (on) 18.dp else 0.dp, spring(dampingRatio = 0.8f, stiffness = 700f), label = "knob")
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 56.dp)
            .tap(role = Role.Switch, onClick = { Feels.haptic(Haptic.Tick); Feels.sound(Sound.Tick); onChange(!on) })
            .semantics(mergeDescendants = true) {
                toggleableState = ToggleableState(on)
                stateDescription = if (on) "On" else "Off"
            }
            .padding(horizontal = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        icon?.let {
            Box(Modifier.size(40.dp).background(p.milk, RoundedCornerShape(13.dp)), contentAlignment = Alignment.Center) {
                Icon(it, p.ink, size = 20.dp)
            }
        }
        Column(Modifier.weight(1f)) {
            Text(label, style = body(16, 600, 1.3f, p.ink))
            hint?.let { Text(it, style = body(14, 400, 1.35f, p.soft)) }
        }
        Box(Modifier.size(48.dp, 30.dp).background(track, CircleShape).padding(3.dp)) {
            Box(Modifier.offset(x = x).size(24.dp).dropShadow(CircleShape, Shadow(2.dp, color = Color(0x33000000))).background(Color.White, CircleShape))
        }
    }
}

data class Opt<T>(val value: T, val label: String, val aria: String? = null)

/**
 * A radio group. Unwrapped, the selection is an ink pill that slides between options; wrapped, each
 * option is its own pill. Arrow keys move the choice, as for a native radio group.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun <T> Segmented(
    label: String,
    value: T,
    options: List<Opt<T>>,
    onChange: (T) -> Unit,
    wrap: Boolean = false,
    small: Boolean = false,
    modifier: Modifier = Modifier,
    /** The resting colour of unselected options; card when the control sits on a milk panel. */
    tone: Color = LocalPalette.current.milk,
) {
    val p = LocalPalette.current
    val pick = { o: Opt<T> ->
        if (o.value != value) { Feels.haptic(Haptic.Tick); Feels.sound(Sound.Tick) }
        onChange(o.value)
    }
    val minH = if (small) 40.dp else 44.dp
    val style = body(if (small) 14 else 15, 600, 1.3f)
    if (wrap) {
        FlowRow(
            modifier.fillMaxWidth().selectableGroup().semantics { contentDescription = label },
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            options.forEach { o ->
                val on = o.value == value
                val bg by animateColorAsState(if (on) p.ink else tone, tween(150), label = "seg")
                val fg by animateColorAsState(if (on) p.milk else p.ink, tween(150), label = "segfg")
                Box(
                    Modifier
                        .heightIn(min = minH)
                        .tap(role = Role.RadioButton) { pick(o) }
                        .semantics { selected = on; o.aria?.let { contentDescription = it } }
                        .background(bg, RoundedCornerShape(12.dp))
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    contentAlignment = Alignment.Center,
                ) { Text(o.label, style = style.copy(color = fg)) }
            }
        }
        return
    }
    val density = LocalDensity.current
    var width by remember { mutableIntStateOf(0) }
    val index = options.indexOfFirst { it.value == value }.coerceAtLeast(0)
    val cell = with(density) { ((width - 8.dp.toPx()) / options.size).toDp() }
    val reduced = LocalReducedMotion.current
    val x by animateDpAsState(cell * index, if (reduced) tween(0) else spring(dampingRatio = 1f, stiffness = 500f), label = "slide")
    Row(
        modifier
            .fillMaxWidth()
            .onSizeChanged { width = it.width }
            .background(tone, RoundedCornerShape(16.dp))
            .padding(4.dp)
            .drawBehind {
                if (width > 0) drawRoundRect(p.ink, Offset(x.toPx(), 0f), Size(cell.toPx(), size.height), CornerRadius(12.dp.toPx()))
            }
            .selectableGroup()
            .semantics { contentDescription = label },
    ) {
        options.forEachIndexed { i, o ->
            val on = i == index
            val fg by animateColorAsState(if (on) p.milk else p.soft, tween(150), label = "fg")
            Box(
                Modifier
                    .weight(1f)
                    .heightIn(min = minH)
                    .tap(role = Role.RadioButton) { pick(o) }
                    .semantics { selected = on; o.aria?.let { contentDescription = it } }
                    .padding(horizontal = 6.dp, vertical = 8.dp),
                contentAlignment = Alignment.Center,
            ) { Text(o.label, style = style.copy(color = fg, textAlign = TextAlign.Center)) }
        }
    }
}


/** Multi-select chips, like the meal and weekday pickers. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun <T> Chips(label: String, values: List<T>, options: List<Opt<T>>, onChange: (List<T>) -> Unit) {
    val p = LocalPalette.current
    FlowRow(
        Modifier.fillMaxWidth().semantics { contentDescription = label },
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        options.forEach { o ->
            val on = o.value in values
            val bg by animateColorAsState(if (on) p.pipWash else p.milk, tween(150), label = "chip")
            val fg by animateColorAsState(if (on) p.pipInk else p.ink, tween(150), label = "chipfg")
            Box(
                Modifier
                    .heightIn(min = 44.dp)
                    .widthIn(min = 44.dp)
                    .tap(role = Role.Checkbox) {
                        Feels.haptic(Haptic.Tick)
                        onChange(if (on) values - o.value else values + o.value)
                    }
                    .semantics {
                        toggleableState = ToggleableState(on)
                        o.aria?.let { contentDescription = it }
                    }
                    .background(bg, RoundedCornerShape(12.dp))
                    .then(if (on) Modifier.border(2.dp, p.pip, RoundedCornerShape(12.dp)) else Modifier)
                    .padding(horizontal = 12.dp),
                contentAlignment = Alignment.Center,
            ) { Text(o.label, style = body(15, 600, 1.2f, fg)) }
        }
    }
}

/** A number with − and + either side; exposes itself as an adjustable value to TalkBack. */
@Composable
fun Stepper(label: String, value: Int, onChange: (Int) -> Unit, min: Int, max: Int, step: Int = 1, format: (Int) -> String = { "$it" }) {
    val p = LocalPalette.current
    fun set(n: Int) {
        val v = n.coerceIn(min, max)
        if (v != value) { Feels.haptic(Haptic.Tick); onChange(v) }
    }
    Row(
        Modifier
            .background(p.milk, RoundedCornerShape(16.dp))
            .padding(4.dp)
            .semantics(mergeDescendants = false) {
                contentDescription = label
                stateDescription = format(value)
            },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        StepBtn("−", "Less", value > min) { set(value - step) }
        Text(
            format(value),
            Modifier.widthIn(min = 96.dp).padding(horizontal = 4.dp),
            style = display(18, 700, 1.2f, p.ink).copy(textAlign = TextAlign.Center),
        )
        StepBtn("+", "More", value < max) { set(value + step) }
    }
}

@Composable
private fun StepBtn(glyph: String, label: String, enabled: Boolean, onClick: () -> Unit) {
    val p = LocalPalette.current
    Box(
        Modifier
            .size(44.dp)
            .alpha(if (enabled) 1f else 0.4f)
            .tap(enabled, label = label, onClick = onClick)
            .semantics { contentDescription = label; if (!enabled) disabled() }
            .background(p.card, RoundedCornerShape(12.dp)),
        contentAlignment = Alignment.Center,
    ) { Text(glyph, style = display(22, 600, 1f, p.ink)) }
}

/** A labelled text field at 16sp or more, with the right keyboard. */
@Composable
fun Field(
    value: String,
    onChange: (String) -> Unit,
    label: String?,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    keyboard: KeyboardType = KeyboardType.Text,
    caps: KeyboardCapitalization = KeyboardCapitalization.Sentences,
    imeAction: ImeAction = ImeAction.Next,
    onIme: (() -> Unit)? = null,
    tone: Color = LocalPalette.current.milk,
    lines: Int = 1,
    textStyle: TextStyle = body(17, 500, 1.3f),
    hint: String? = null,
    trailing: @Composable (RowScope.() -> Unit)? = null,
    autocorrect: Boolean = keyboard == KeyboardType.Text,
) {
    val p = LocalPalette.current
    val source = remember { MutableInteractionSource() }
    val focused by source.collectIsFocusedAsState()
    // Keeps the field in view while the keyboard slides up and the sheet above it shrinks.
    val into = remember { BringIntoViewRequester() }
    val density = LocalDensity.current
    val ime = WindowInsets.ime.getBottom(density)
    LaunchedEffect(focused, ime) {
        if (focused) {
            delay(60)
            into.bringIntoView()
        }
    }
    val ring by animateColorAsState(if (focused) p.pip else p.line, tween(160), label = "ring")
    Column(modifier.bringIntoViewRequester(into), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        label?.let { Label(it) }
        Row(
            Modifier
                .fillMaxWidth()
                .heightIn(min = if (lines > 1) 84.dp else 52.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(tone)
                .border(2.dp, ring, RoundedCornerShape(16.dp))
                .padding(horizontal = 16.dp, vertical = if (lines > 1) 12.dp else 0.dp),
            verticalAlignment = if (lines > 1) Alignment.Top else Alignment.CenterVertically,
        ) {
            Box(Modifier.weight(1f)) {
                if (value.isEmpty()) Text(placeholder, style = textStyle.copy(color = p.soft.copy(alpha = 0.8f)))
                BasicTextField(
                    value = value,
                    onValueChange = onChange,
                    modifier = Modifier.fillMaxWidth().semantics { label?.let { contentDescription = it } },
                    textStyle = textStyle.copy(color = p.ink),
                    cursorBrush = SolidColor(p.pip),
                    singleLine = lines == 1,
                    minLines = lines,
                    interactionSource = source,
                    keyboardOptions = KeyboardOptions(capitalization = caps, keyboardType = keyboard, imeAction = imeAction, autoCorrectEnabled = autocorrect),
                    keyboardActions = KeyboardActions(onAny = { onIme?.invoke() ?: defaultKeyboardAction(imeAction) }),
                )
            }
            trailing?.invoke(this)
        }
        hint?.let { Text(it, style = body(13, 400, 1.35f, p.soft)) }
    }
}

/** Numbers typed into a field: keeps digits and one point. */
fun numberText(raw: String, decimals: Boolean = true): String {
    val kept = raw.filter { it.isDigit() || (decimals && it == '.') }
    val i = kept.indexOf('.')
    return if (i < 0) kept else kept.substring(0, i + 1) + kept.substring(i + 1).replace(".", "")
}

fun shown(n: Double): String = if (n == 0.0 || !n.isFinite()) "" else co.ashwin.tend.core.fmtNum(n).replace(",", "")

/** A disclosure group that opens in place. */
@Composable
fun Optional(title: String, hint: String?, open: Boolean, onToggle: (Boolean) -> Unit, tone: Color = LocalPalette.current.milk, content: @Composable ColumnScope.() -> Unit) {
    val p = LocalPalette.current
    val turn by animateFloatAsState(if (open) 45f else 0f, tween(200, easing = EaseOut), label = "plus")
    Column(Modifier.fillMaxWidth().background(tone, RoundedCornerShape(20.dp)).padding(horizontal = 14.dp)) {
        Row(
            Modifier
                .fillMaxWidth()
                .heightIn(min = 56.dp)
                .tap(role = Role.Button, sink = 0.98f) { onToggle(!open) }
                .semantics(mergeDescendants = true) { stateDescription = if (open) "Expanded" else "Collapsed" }
                .padding(vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column(Modifier.weight(1f)) {
                Text(title, style = body(15, 700, 1.3f, p.ink))
                hint?.let { Text(it, style = body(13, 400, 1.35f, p.soft)) }
            }
            Icon(Ic.Plus, p.ink, Modifier.graphicsLayer { rotationZ = turn }, size = 18.dp)
        }
        androidx.compose.animation.AnimatedVisibility(open) {
            Column(Modifier.padding(top = 4.dp, bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(16.dp), content = content)
        }
    }
}

@Composable
fun Gap(h: Dp) = Spacer(Modifier.size(h))

val PageInsets = PaddingValues(horizontal = 16.dp)
