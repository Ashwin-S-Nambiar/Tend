plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

// Release signing comes from the environment (CI secrets). Never commit a keystore.
val keystorePath: String? = System.getenv("TEND_KEYSTORE")

android {
    namespace = "co.ashwin.tend"
    compileSdk {
        version = release(37) { minorApiLevel = 2 }
    }

    defaultConfig {
        applicationId = "in.co.ashwin.tend"
        minSdk = 26
        targetSdk = 36
        versionCode = (System.getenv("TEND_VERSION_CODE") ?: "1").toInt()
        versionName = System.getenv("TEND_VERSION_NAME") ?: "1.0.0"
        resValue("string", "package_id", "in.co.ashwin.tend")
        // Phones are ARM; the x86 copies of the on-device text recognizer only served emulators.
        ndk { abiFilters += listOf("arm64-v8a", "armeabi-v7a") }
    }

    signingConfigs {
        if (keystorePath != null) {
            create("release") {
                storeFile = file(keystorePath)
                storePassword = System.getenv("TEND_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("TEND_KEY_ALIAS")
                keyPassword = System.getenv("TEND_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (keystorePath != null) signingConfig = signingConfigs.getByName("release")
        }
        debug {
            applicationIdSuffix = ".debug"
            resValue("string", "package_id", "in.co.ashwin.tend.debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        resValues = true
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.foundation)
    implementation(libs.compose.tooling.preview)
    debugImplementation(libs.compose.tooling)
    implementation(libs.activity.compose)
    implementation(libs.core.ktx)
    implementation(libs.splashscreen)
    implementation(libs.lifecycle.runtime.compose)
    implementation(libs.serialization.json)
    implementation(libs.coroutines.android)
    implementation(libs.mlkit.text)
    testImplementation(libs.junit)
}
