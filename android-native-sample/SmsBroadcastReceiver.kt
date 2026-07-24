/*
  SmsBroadcastReceiver.kt — گیرنده‌ی ایستا (Manifest-declared) پیامک
  ------------------------------------------------------------------
  برخلاف BroadcastReceiver پویا (که فقط وقتی پردازش برنامه زنده است کار می‌کند)،
  این گیرنده در AndroidManifest.xml ثبت می‌شود و android سیستم‌عامل آن را حتی وقتی
  برنامه به‌طور کامل بسته/Kill شده، برای لحظه‌ای بیدار می‌کند تا پیامک را تحویل بگیرد.
  این تنها روش قابل‌اعتماد برای دریافت پیامک در پس‌زمینه در اپ‌های Capacitor/Hybrid است.

  چون در این لحظه‌ی کوتاه، WebView/جاوااسکریپت برنامه اجرا نیست، نمی‌توان مستقیماً
  به app.js پیام فرستاد. به‌جای آن:
    ۱) پیامک خام در SharedPreferences ذخیره می‌شود (صف "در انتظار پردازش").
    ۲) یک اعلان محلی (Local Notification) نمایش داده می‌شود.
    ۳) وقتی کاربر بعداً برنامه را باز می‌کند، متد getPendingSms در SmsReceiverPlugin.kt
       این صف را می‌خواند، به app.js می‌دهد و پاک می‌کند (نگاه کنید به تابع
       drainPendingNativeSms در js/app.js).

  مسیر پیشنهادی: android/app/src/main/java/ir/local/daftartarakonesh/SmsBroadcastReceiver.kt
*/

package ir.local.daftartarakonesh

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Telephony
import androidx.core.app.NotificationCompat
import org.json.JSONArray
import org.json.JSONObject

class SmsBroadcastReceiver : BroadcastReceiver() {

    companion object {
        const val PREFS_NAME = "daftar_tarakonesh_prefs"
        const val KEY_PENDING_SMS = "pending_sms_queue"
        const val CHANNEL_ID = "sms_transactions"
        private const val TAG = "DaftarSmsReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        android.util.Log.d(TAG, "SMS_RECEIVED broadcast دریافت شد")

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages.isNullOrEmpty()) {
            android.util.Log.w(TAG, "پیامی داخل intent پیدا نشد")
            return
        }

        // پیامک‌های چندبخشی (طولانی) ممکن است در چند PDU جدا برسند؛ همه را به هم می‌چسبانیم
        val sender = messages[0].originatingAddress ?: ""
        val fullBody = messages.joinToString(separator = "") { it.messageBody ?: "" }
        android.util.Log.d(TAG, "پیامک از $sender دریافت شد، طول متن: ${fullBody.length}")

        addToPendingQueue(context, sender, fullBody)
        showNotification(context, fullBody)
    }

    private fun addToPendingQueue(context: Context, sender: String, body: String) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val existingJson = prefs.getString(KEY_PENDING_SMS, "[]") ?: "[]"
        val arr = try { JSONArray(existingJson) } catch (e: Exception) { JSONArray() }

        val item = JSONObject()
        item.put("sender", sender)
        item.put("body", body)
        item.put("receivedAt", System.currentTimeMillis())
        arr.put(item)

        prefs.edit().putString(KEY_PENDING_SMS, arr.toString()).apply()
        android.util.Log.d(TAG, "به صف در انتظار اضافه شد؛ تعداد فعلی صف: ${arr.length()}")
    }

    private fun showNotification(context: Context, body: String) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "تراکنش‌های بانکی", NotificationManager.IMPORTANCE_DEFAULT)
            channel.description = "اعلان دریافت پیامک بانکی جدید"
            nm.createNotificationChannel(channel)
        }

        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        val pendingIntent = PendingIntent.getActivity(
            context, 0, launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
        )

        val preview = if (body.length > 80) body.substring(0, 80) + "…" else body
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_notify_chat) // آیکون واقعی برنامه را جایگزین کنید
            .setContentTitle("پیامک بانکی جدید دریافت شد")
            .setContentText(preview)
            .setStyle(NotificationCompat.BigTextStyle().bigText(preview))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        nm.notify(System.currentTimeMillis().toInt(), notification)
    }
}
