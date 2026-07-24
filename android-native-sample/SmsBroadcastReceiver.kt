/*
  SmsBroadcastReceiver.kt — دریافت‌کننده‌ی پیامک اعلام‌شده در Manifest
  ------------------------------------------------------------------------------
  این کلاس همان چیزی است که در AndroidManifest-additions.xml به آن اشاره شده:

      <receiver
          android:name="ir.local.daftartarakonesh.SmsBroadcastReceiver"
          android:exported="true"
          android:permission="android.permission.BROADCAST_SMS">
          <intent-filter android:priority="999">
              <action android:name="android.provider.Telephony.SMS_RECEIVED" />
          </intent-filter>
      </receiver>

  چرا این کلاس لازم است؟
  SmsReceiverPlugin در زمان اجرا (context.registerReceiver) یک Receiver داخلی
  ثبت می‌کند که فقط وقتی پردازش (process) اپلیکیشن زنده است پیامک را می‌گیرد.
  اما وقتی اپ کاملاً بسته یا Kill شده باشد، فقط یک Receiver که در Manifest
  اعلام شده می‌تواند توسط سیستم بیدار شود. این کلاس همان نقش را ایفا می‌کند.

  محدودیت مهم: از اندروید ۸ (API 26) به بعد، یک BroadcastReceiver اعلام‌شده در
  Manifest اجازه‌ی راه‌اندازی مستقیم Activity یا اتصال طولانی‌مدت به WebView را
  ندارد و onReceive() تنها چند ثانیه فرصت اجرا دارد. به همین دلیل این کلاس
  پیامک را مستقیماً به لایه‌ی وب نمی‌فرستد؛ در عوض آن را در SharedPreferences
  به‌صورت یک صف (queue) ذخیره می‌کند. به‌محض اینکه کاربر بعداً اپ را باز کند،
  SmsReceiverPlugin این صف را می‌خواند، هر پیام را از طریق رویداد "smsReceived"
  به SmsParser.js می‌فرستد و سپس صف را پاک می‌کند (به متد drainQueuedMessages
  در SmsReceiverPlugin.kt نگاه کنید).

  هیچ داده‌ای به خارج از دستگاه ارسال نمی‌شود؛ فقط در SharedPreferences محلی
  ذخیره می‌شود.
*/

package ir.local.daftartarakonesh

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import org.json.JSONArray
import org.json.JSONObject

class SmsBroadcastReceiver : BroadcastReceiver() {

    companion object {
        const val PREFS_NAME = "ir.local.daftartarakonesh.sms_queue"
        const val QUEUE_KEY = "pending_sms_queue"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
        if (messages.isEmpty()) return

        // پیامک ممکن است به چند قطعه (PDU) تقسیم شده باشد؛ همه را به هم می‌چسبانیم
        val sender = messages[0].originatingAddress ?: ""
        val body = messages.joinToString(separator = "") { it.messageBody ?: "" }
        if (body.isEmpty()) return

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val queue = try {
            JSONArray(prefs.getString(QUEUE_KEY, "[]"))
        } catch (e: Exception) {
            JSONArray()
        }

        val entry = JSONObject()
        entry.put("body", body)
        entry.put("sender", sender)
        entry.put("receivedAt", System.currentTimeMillis())
        queue.put(entry)

        prefs.edit().putString(QUEUE_KEY, queue.toString()).apply()

        // این Receiver عمداً هیچ Activity/Notification‌ای راه‌اندازی نمی‌کند تا
        // با محدودیت‌های Background اندروید ۸+ برخورد نکند. اگر می‌خواهید کاربر
        // فوراً مطلع شود، می‌توانید اینجا یک Notification ساده (بدون باز کردن
        // WebView) اضافه کنید.
    }
}
