plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "kr.co.weplat.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "kr.co.weplat.app"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "4.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

// 루트의 웹 자산(index.html, assets/)을 app/src/main/assets/www/ 로 복사
val webRoot = file("$rootDir/..")
val webOut = layout.buildDirectory.dir("generated/web-assets/www")

val copyWebAssets = tasks.register<Copy>("copyWebAssets") {
    from(webRoot) {
        include("index.html")
        include("assets/**")
    }
    into(webOut)
}

android.sourceSets.getByName("main").assets.srcDir(layout.buildDirectory.dir("generated/web-assets"))

tasks.named("preBuild") { dependsOn(copyWebAssets) }

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.9.2")
    implementation("androidx.webkit:webkit:1.11.0")
}
