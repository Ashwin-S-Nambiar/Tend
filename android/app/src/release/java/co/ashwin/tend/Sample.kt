package co.ashwin.tend

/** Release builds never load sample data or render debug widgets. */
object Sample {
    fun load(night: Boolean = false) = Unit
    fun renderWidgets(context: android.content.Context) = Unit
}
