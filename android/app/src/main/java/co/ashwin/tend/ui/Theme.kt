package co.ashwin.tend.ui

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import co.ashwin.tend.R

// Teal (pip) is the one action colour; the scene colours belong to
// Pip's day: sun for morning, noon for afternoon, dusk for evening, night for bedtime.

@Immutable
data class Palette(
    val milk: Color,
    val card: Color,
    val ink: Color,
    val soft: Color,
    val line: Color,
    val lineStrong: Color,
    val pip: Color,
    val pipDeep: Color,
    val pipInk: Color,
    val onPip: Color,
    val pipWash: Color,
    val sun: Color,
    val sunWash: Color,
    val noon: Color,
    val noonWash: Color,
    val dusk: Color,
    val duskWash: Color,
    val night: Color,
    val night2: Color,
    val star: Color,
    val eye: Color,
    val scrim: Color,
    val danger: Color,
    val dark: Boolean,
)

val Light = Palette(
    milk = Color(0xFFFAF7F3),
    card = Color(0xFFFFFFFF),
    ink = Color(0xFF1D2430),
    soft = Color(0xFF5E6673),
    line = Color(0x1A1D2430),
    lineStrong = Color(0x2E1D2430),
    pip = Color(0xFF17A58F),
    pipDeep = Color(0xFF0E8576),
    pipInk = Color(0xFF0B7568),
    onPip = Color(0xFFFFFFFF),
    pipWash = Color(0xFFDDF3EE),
    sun = Color(0xFFFFC845),
    sunWash = Color(0xFFFFF1C9),
    noon = Color(0xFFFF8B5E),
    noonWash = Color(0xFFFFE4D8),
    dusk = Color(0xFF7CC4F0),
    duskWash = Color(0xFFDFF1FC),
    night = Color(0xFF182544),
    night2 = Color(0xFF22335C),
    star = Color(0xFFFFE38A),
    eye = Color(0xFFFFFFFF),
    scrim = Color(0x6B0E1528),
    danger = Color(0xFFB4402F),
    dark = false,
)

val Dark = Light.copy(
    milk = Color(0xFF0E1528),
    card = Color(0xFF172340),
    ink = Color(0xFFF2EEE8),
    soft = Color(0xFFA9B2C3),
    line = Color(0x1FF2EEE8),
    lineStrong = Color(0x38F2EEE8),
    pip = Color(0xFF2CC1AA),
    pipDeep = Color(0xFF2CC1AA),
    pipInk = Color(0xFF5ED6C3),
    onPip = Color(0xFF0B1A2E),
    pipWash = Color(0xFF12343A),
    sunWash = Color(0xFF3A3320),
    noonWash = Color(0xFF3B2627),
    duskWash = Color(0xFF1A3350),
    eye = Color(0xFF0B1A2E),
    scrim = Color(0x9903060E),
    danger = Color(0xFFFF9A8A),
    dark = true,
)

/** Onboarding sits on Pip's yellow, in the light palette whatever the theme. */
val Welcome = Light.copy(soft = Color(0xFF4C5361), pipWash = Color(0x99FFFFFF))

val LocalPalette = staticCompositionLocalOf { Light }
val LocalReducedMotion = staticCompositionLocalOf { false }

val Display = FontFamily(
    listOf(500, 600, 700, 800, 900).map { w ->
        Font(R.font.gabarito, FontWeight(w), variationSettings = FontVariation.Settings(FontVariation.weight(w)))
    },
)

val Ui = FontFamily(
    listOf(400, 500, 600, 700, 800).map { w ->
        Font(R.font.rethink_sans, FontWeight(w), variationSettings = FontVariation.Settings(FontVariation.weight(w)))
    },
)

private val trim = LineHeightStyle(LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.None)

/** Display type tightens as it grows; body type stays near zero tracking. */
fun display(size: Int, weight: Int = 800, height: Float = 1.08f, color: Color = Color.Unspecified): TextStyle {
    val tracking: TextUnit = if (size >= 28) (-0.02).em else if (size >= 22) (-0.01).em else 0.em
    return TextStyle(
        fontFamily = Display,
        fontWeight = FontWeight(weight),
        fontSize = size.sp,
        lineHeight = (size * height).sp,
        letterSpacing = tracking,
        color = color,
        lineHeightStyle = trim,
    )
}

fun body(size: Int, weight: Int = 400, height: Float = 1.4f, color: Color = Color.Unspecified) = TextStyle(
    fontFamily = Ui,
    fontWeight = FontWeight(weight),
    fontSize = size.sp,
    lineHeight = (size * height).sp,
    color = color,
    lineHeightStyle = trim,
)

/** The house curves: one ease-out for everything, the drawer curve for sheets. */
val EaseOut = CubicBezierEasing(0.23f, 1f, 0.32f, 1f)
val Drawer = CubicBezierEasing(0.32f, 0.72f, 0f, 1f)

@Composable
fun TendTheme(palette: Palette, reduced: Boolean, content: @Composable () -> kotlin.Unit) {
    CompositionLocalProvider(LocalPalette provides palette, LocalReducedMotion provides reduced, content = content)
}
