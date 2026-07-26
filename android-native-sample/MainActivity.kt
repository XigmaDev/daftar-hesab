/*
  MainActivity.kt — نسخه‌ی Kotlin، فقط اگر پروژه‌ی شما از این نوع MainActivity
  استفاده می‌کند (اکثر پروژه‌های پیش‌فرض Capacitor از MainActivity.java استفاده
  می‌کنند — اگر آن فایل را دارید، همان را با MainActivity.java جایگزین کنید، نه این را).

  مسیر: android/app/src/main/java/ir/local/daftartarakonesh/MainActivity.kt
*/
package ir.local.daftartarakonesh

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(SmsReceiverPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
