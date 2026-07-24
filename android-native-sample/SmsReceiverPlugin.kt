/*
  SmsReceiverPlugin.kt — پل ارتباطی بین اندروید و لایه‌ی وب (Capacitor Plugin)
  ------------------------------------------------------------------------------
  یک PWA به‌تنهایی اجازه‌ی دسترسی به پیامک‌های دریافتی را ندارد؛ این افزونه همان
  دسترسی را در نسخه‌ی بسته‌بندی‌شده با Capacitor فراهم می‌کند. مسیر پیشنهادی:
      android/app/src/main/java/ir/local/daftartarakonesh/SmsReceiverPlugin.kt

  معماری (چرا دو مکانیزم با هم؟):
   ۱) SmsBroadcastReceiver.kt (گیرنده‌ی ایستا، در Manifest ثبت می‌شود) — قابل‌اعتماد
      و حتی وقتی برنامه Kill شده هم کار می‌کند؛ پیامک را در SharedPreferences
      صف می‌کند. این متد اصلی و ضروری برای دریافت واقعی در پس‌زمینه است.
   ۲) گیرنده‌ی پویا در همین فایل (registerReceiver در startListening) — فقط زمانی
      که برنامه باز است، بلافاصله رویداد smsReceived را به‌سمت جاوااسکریپت
      می‌فرستد تا تجربه‌ی کاربری آنی (Real-time) داشته باشیم. این اختیاری است.

   متد getPendingSms صفِ ذخیره‌شده توسط گیرنده‌ی ایستا را می‌خواند، خالی می‌کند و
   برمی‌گرداند — app.js این متد را در ابتدای اجرا و هر بار که برنامه به foreground
   برمی‌گردد صدا می‌زند (نگاه کنید به drainPendingNativeSms در js/app.js).
*/

package ir.local.daftartarakonesh

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.provider.Telephony
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import org.json.JSONArray

@CapacitorPlugin(
    name = "SmsReceiver",
    permissions = [
        Permission(strings = [Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS], alias = "sms")
    ]
)
class SmsReceiverPlugin : Plugin() {

    private var dynamicReceiver: BroadcastReceiver? = null
    private val TAG = "DaftarSmsPlugin"

    @PluginMethod
    fun requestSmsPermission(call: PluginCall) {
        android.util.Log.d(TAG, "requestSmsPermission فراخوانی شد؛ وضعیت فعلی: ${getPermissionState("sms")}")
        if (getPermissionState("sms") != com.getcapacitor.PermissionState.GRANTED) {
            requestPermissionForAlias("sms", call, "smsPermsCallback")
        } else {
            startForegroundListening()
            call.resolve()
        }
    }

    @PermissionCallback
    fun smsPermsCallback(call: PluginCall) {
        val granted = getPermissionState("sms") == com.getcapacitor.PermissionState.GRANTED
        android.util.Log.d(TAG, "نتیجه‌ی درخواست مجوز: ${if (granted) "تأیید شد" else "رد شد"}")
        if (granted) {
            startForegroundListening()
            call.resolve()
        } else {
            call.reject("کاربر دسترسی پیامک را رد کرد")
        }
    }

    // گیرنده‌ی پویا — فقط برای بروزرسانی آنیِ رابط کاربری وقتی برنامه باز است
    @PluginMethod
    fun startForegroundListening(call: PluginCall? = null) {
        if (dynamicReceiver != null) { call?.resolve(); return }
        dynamicReceiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
                if (messages.isNullOrEmpty()) return
                val sender = messages[0].originatingAddress ?: ""
                val body = messages.joinToString("") { it.messageBody ?: "" }
                android.util.Log.d(TAG, "گیرنده‌ی پویا: پیامک آنی از $sender دریافت شد")
                val payload = JSObject()
                payload.put("body", body)
                payload.put("sender", sender)
                payload.put("receivedAt", System.currentTimeMillis())
                notifyListeners("smsReceived", payload)
            }
        }
        context.registerReceiver(dynamicReceiver, IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION))
        android.util.Log.d(TAG, "گیرنده‌ی پویا ثبت شد")
        call?.resolve()
    }

    // صف پیامک‌هایی که وقتی برنامه بسته بود، توسط گیرنده‌ی ایستا ذخیره شده‌اند
    @PluginMethod
    fun getPendingSms(call: PluginCall) {
        val prefs = context.getSharedPreferences(SmsBroadcastReceiver.PREFS_NAME, Context.MODE_PRIVATE)
        val json = prefs.getString(SmsBroadcastReceiver.KEY_PENDING_SMS, "[]") ?: "[]"
        android.util.Log.d(TAG, "getPendingSms فراخوانی شد؛ محتوای خام صف: $json")

        val result = JSObject()
        try {
            val arr = JSONArray(json)
            result.put("items", JSArray(arr.toString()))
            result.put("count", arr.length())
        } catch (e: Exception) {
            android.util.Log.e(TAG, "خطا در خواندن صف پیامک", e)
            result.put("items", JSArray())
            result.put("count", 0)
        }

        // صف را خالی می‌کنیم چون قرار است همین الان به لایه‌ی وب تحویل داده شود
        prefs.edit().putString(SmsBroadcastReceiver.KEY_PENDING_SMS, "[]").apply()

        call.resolve(result)
    }

    @PluginMethod
    fun stopListening(call: PluginCall) {
        dynamicReceiver?.let { context.unregisterReceiver(it) }
        dynamicReceiver = null
        call.resolve()
    }

    override fun handleOnDestroy() {
        dynamicReceiver?.let { try { context.unregisterReceiver(it) } catch (e: Exception) {} }
        super.handleOnDestroy()
    }
}

/*
  ثبت افزونه — در MainActivity.java پروژه‌ی Capacitor (مسیر:
  android/app/src/main/java/ir/local/daftartarakonesh/MainActivity.java) اضافه کنید:

      import ir.local.daftartarakonesh.SmsReceiverPlugin;
      ...
      public class MainActivity extends BridgeActivity {
        @Override
        public void onCreate(Bundle savedInstanceState) {
          registerPlugin(SmsReceiverPlugin.class);
          super.onCreate(savedInstanceState);
        }
      }

  نکته‌ی مهم: registerPlugin باید قبل از super.onCreate فراخوانی شود.

  اگر MainActivity.java وجود نداشت (بعضی نسخه‌های Capacitor آن را نمی‌سازند)،
  آن را داخل همان مسیر با محتوای بالا ایجاد کنید.
*/
