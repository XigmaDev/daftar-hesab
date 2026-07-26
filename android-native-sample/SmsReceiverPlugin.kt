/*
  SmsReceiverPlugin.kt — پل ارتباطی بین اندروید و لایه‌ی وب (Capacitor Plugin)
  ------------------------------------------------------------------------------
  یک PWA به‌تنهایی اجازه‌ی دسترسی به پیامک‌های دریافتی را ندارد؛ این افزونه همان
  دسترسی را در نسخه‌ی بسته‌بندی‌شده با Capacitor فراهم می‌کند. مسیر پیشنهادی:
      android/app/src/main/java/ir/local/daftartarakonesh/SmsReceiverPlugin.kt

  معماری (چرا دو مکانیزم با هم، و چرا فقط یکی «منبع واقعی داده» است؟):
   ۱) SmsBroadcastReceiver.kt (گیرنده‌ی ایستا، در Manifest ثبت می‌شود) — تنها منبع
      واقعیِ داده. قابل‌اعتماد و حتی وقتی برنامه Kill شده هم کار می‌کند؛ همیشه
      پیامک را در SharedPreferences صف می‌کند و یک اعلان نشان می‌دهد.
   ۲) گیرنده‌ی پویا در همین فایل (startForegroundListening) — دیگر خودش پیامک را
      استخراج نمی‌کند (نسخه‌ی قبلی این کار را می‌کرد و همین باعث می‌شد گاهی
      اعلان بیاید ولی تراکنش هرگز در کارتابل ثبت نشود — دو مسیر مستقل برای نوشتن
      در دیتابیس که یکی‌شان بی‌سروصدا شکست می‌خورد). الان این گیرنده فقط یک
      «زنگ خبر» بی‌محتوا به سمت جاوااسکریپت می‌فرستد تا صفِ SharedPreferences را
      همان لحظه بخواند — دقیقاً همان صفی که گیرنده‌ی ایستا پر کرده.

   متد getPendingSms تنها راهی است که پیامک واقعاً وارد دیتابیس محلی می‌شود؛
   app.js این متد را در سه حالت صدا می‌زند: در ابتدای اجرا، هر بار برنامه به
   foreground برمی‌گردد، و با کمی تأخیر بعد از هر «زنگ خبر» (نگاه کنید به
   drainPendingNativeSms در js/app.js) — یعنی حتی اگر «زنگ خبر» به هر دلیلی
   نرسد، دیر یا زود (با باز کردن دوباره‌ی برنامه) پیامک از دست نمی‌رود.
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

    // گیرنده‌ی پویا — دیگر خودش پیامک را استخراج/ارسال نمی‌کند (این دقیقاً همان چیزی
    // بود که باعث می‌شد گاهی اعلان بیاید ولی تراکنش ثبت نشود: دو مسیر مستقل برای
    // نوشتن در دیتابیس، که یکی از آن‌ها بی‌سروصدا شکست می‌خورد). حالا این گیرنده فقط
    // یک «زنگ خبر» به سمت جاوااسکریپت می‌فرستد تا صفِ SharedPreferences را — که
    // توسط SmsBroadcastReceiver.kt (تنها منبع واقعی داده) پر شده — همان لحظه بخواند.
    @PluginMethod
    fun startForegroundListening(call: PluginCall? = null) {
        if (dynamicReceiver != null) { call?.resolve(); return }
        dynamicReceiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                android.util.Log.d(TAG, "گیرنده‌ی پویا: broadcast دریافت شد؛ به جاوااسکریپت اطلاع داده می‌شود تا صف را بخواند")
                notifyListeners("smsReceived", JSObject())
            }
        }
        // priority پایین‌تر از گیرنده‌ی ایستا (که در Manifest با priority=999 ثبت شده)
        // تا مطمئن شویم صف SharedPreferences قبل از این «زنگ خبر» پر شده است
        val filter = IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION)
        filter.priority = 0
        context.registerReceiver(dynamicReceiver, filter)
        android.util.Log.d(TAG, "گیرنده‌ی پویا (زنگ خبر) ثبت شد")
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
            val jsArray = JSArray(json)
            result.put("items", jsArray)
            result.put("count", jsArray.length())
            android.util.Log.d(TAG, "getPendingSms: ${jsArray.length()} مورد با موفقیت parse شد")
        } catch (e: Exception) {
            android.util.Log.e(TAG, "خطا در parse کردن صف پیامک (JSON نامعتبر؟)", e)
            result.put("items", JSArray())
            result.put("count", 0)
        }

        // صف را خالی می‌کنیم چون قرار است همین الان به لایه‌ی وب تحویل داده شود
        prefs.edit().putString(SmsBroadcastReceiver.KEY_PENDING_SMS, "[]").apply()
        android.util.Log.d(TAG, "صف SharedPreferences پس از تحویل، خالی شد")

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
  ثبت افزونه — این مهم‌ترین قدم است و اگر انجام نشود،
  window.Capacitor.Plugins.SmsReceiver در جاوااسکریپت همیشه undefined می‌ماند
  (دقیقاً همان چیزی که با دکمه‌ی «بررسی وضعیت اتصال» در تنظیمات قابل تشخیص است).

  به‌جای ویرایش دستی MainActivity، فایل آماده‌ی MainActivity.java (یا
  MainActivity.kt اگر پروژه‌ی شما Kotlin است) را از همین پوشه کپی و جایگزین
  فایل موجودتان کنید — نگاه کنید به بخش «مراحل بسته‌بندی» در README.md.

  برای اطمینان، بعد از کپی این دستور باید حداقل یک نتیجه چاپ کند:
      grep -r "registerPlugin(SmsReceiverPlugin" android/app/src/main/java/
*/
