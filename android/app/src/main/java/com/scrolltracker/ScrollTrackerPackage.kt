package com.scrolltracker

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class ScrollTrackerPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(ScrollTrackerModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}

/**
 * Registration note (Expo prebuild / bare workflow):
 * Add `packages.add(ScrollTrackerPackage())` inside the `getPackages()`
 * override of MainApplication.kt, alongside the autolinked packages list.
 * Autolinking cannot discover this package automatically because it isn't
 * a separate npm module - it ships inside the app's own android/ folder.
 */
