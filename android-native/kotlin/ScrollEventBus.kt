package com.scrolltracker

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.CopyOnWriteArrayList

/** Crash-safe transport for canonical native events. */
object ScrollEventBus {
    data class Event(
        val id: String = UUID.randomUUID().toString(),
        val packageName: String,
        val timestamp: Long,
        val eventType: String,
        val direction: String? = null,
        val appScreen: String? = null
    )

    private const val PREFS = "scrolltracker_native_events"
    private const val EVENTS = "events"
    private const val MAX_EVENTS = 5000
    private val listeners = CopyOnWriteArrayList<(Event) -> Unit>()
    private lateinit var appContext: Context

    @Synchronized
    fun init(context: Context) {
        appContext = context.applicationContext
    }

    @Synchronized
    fun publish(event: Event) {
        if (event.eventType == "video_swipe") persist(event)
        listeners.toList().forEach { it(event) }
    }

    private fun persist(event: Event) {
        if (!::appContext.isInitialized) return
        val pending = readArray()
        if (pending.length() >= MAX_EVENTS) pending.remove(0)
        pending.put(toJson(event))
        // commit is intentional: a confirmed swipe must be durable before delivery.
        appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(EVENTS, pending.toString()).commit()
    }

    @Synchronized
    fun pending(): List<Event> {
        if (!::appContext.isInitialized) return emptyList()
        val array = readArray()
        return (0 until array.length()).mapNotNull { index -> fromJson(array.optJSONObject(index)) }
    }

    @Synchronized
    fun acknowledge(ids: Set<String>) {
        if (!::appContext.isInitialized || ids.isEmpty()) return
        val current = readArray()
        val remaining = JSONArray()
        for (index in 0 until current.length()) {
            val item = current.optJSONObject(index) ?: continue
            if (item.optString("id") !in ids) remaining.put(item)
        }
        appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(EVENTS, remaining.toString()).commit()
    }

    fun addListener(listener: (Event) -> Unit) = listeners.add(listener)
    fun removeListener(listener: (Event) -> Unit) = listeners.remove(listener)

    private fun readArray(): JSONArray = try {
        val raw = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(EVENTS, "[]")
        JSONArray(raw ?: "[]")
    } catch (_: Exception) {
        JSONArray()
    }

    private fun toJson(event: Event) = JSONObject().apply {
        put("id", event.id)
        put("packageName", event.packageName)
        put("timestamp", event.timestamp)
        put("eventType", event.eventType)
        event.direction?.let { put("direction", it) }
        event.appScreen?.let { put("appScreen", it) }
    }

    private fun fromJson(value: JSONObject?): Event? {
        if (value == null) return null
        val id = value.optString("id")
        val packageName = value.optString("packageName")
        if (id.isBlank() || packageName.isBlank()) return null
        return Event(
            id = id,
            packageName = packageName,
            timestamp = value.optLong("timestamp"),
            eventType = value.optString("eventType"),
            direction = value.optString("direction").takeIf { it.isNotBlank() },
            appScreen = value.optString("appScreen").takeIf { it.isNotBlank() }
        )
    }
}
