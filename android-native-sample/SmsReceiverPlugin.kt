/*
  SmsReceiverPlugin.kt — نمونه افزونه بومی Capacitor برای دریافت خودکار پیامک در اندروید
  ------------------------------------------------------------------------------
  یک PWA به‌تنهایی اجازه دسترسی به پیامک‌های دریافتی را ندارد (محدودیت مرورگر/امنیتی).
  این فایل یک نمونه مرجع (Reference Implementation) است که باید داخل پروژه‌ی
  اندرویدِ تولیدشده توسط Capacitor (پوشه android/) قرار گیرد و در Android Studio
  Build شود. مسیر پیشنهادی:
      android/app/src/main/java/ir/local/daftartarakonesh/SmsReceiverPlugin.kt

  عملکرد:
   1) مجوزهای RECEIVE_SMS و READ_SMS را در زمان اجرا درخواست می‌کند.
   2) با یک BroadcastReceiver به پیامک‌های ورودی گوش می‌دهد.
   3) متن پیامک را به لایه‌ی وب (index.html / app.js) از طریق رویداد Capacitor
      با نام "smsReceived" ارسال می‌کند تا SmsParser.js آن را پردازش کند.
   4) هیچ داده‌ای به خارج از دستگاه ارسال نمی‌شود؛ تمام پردازش در سمت وب/داخل گوشی است.
*/

package ir.local.daftartarakonesh

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.provider.Telephony
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
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

    private var receiver: BroadcastReceiver? = null

    @PluginMethod
    fun requestSmsPermission(call: PluginCall) {
        if (getPermissionState("sms") != com.getcapacitor.PermissionState.GRANTED) {
            requestPermissionForAlias("sms", call, "smsPermsCallback")
        } else {
            call.resolve()
            startListening()
        }
    }

    @PermissionCallback
    private fun smsPermsCallback(call: PluginCall) {
        if (getPermissionState("sms") == com.getcapacitor.PermissionState.GRANTED) {
            call.resolve()
            startListening()
        } else {
            call.reject("کاربر دسترسی پیامک را رد کرد")
        }
    }

    @PluginMethod
    fun startListening(call: PluginCall? = null) {
        if (receiver != null) { call?.resolve(); return }

        receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
                for (msg in messages) {
                    val body = msg.messageBody ?: continue
                    val sender = msg.originatingAddress ?: ""
                    val payload = JSObject()
                    payload.put("body", body)
                    payload.put("sender", sender)
                    payload.put("receivedAt", System.currentTimeMillis())
                    // این رویداد در لایه‌ی وب توسط app.js شنیده می‌شود
                    notifyListeners("smsReceived", payload)
                }
            }
        }
        val filter = IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION)
        context.registerReceiver(receiver, filter)
        call?.resolve()
    }

    @PluginMethod
    fun stopListening(call: PluginCall) {
        receiver?.let { context.unregisterReceiver(it) }
        receiver = null
        call.resolve()
    }

    override fun handleOnDestroy() {
        receiver?.let { try { context.unregisterReceiver(it) } catch (e: Exception) {} }
        super.handleOnDestroy()
    }
}

/*
  ثبت افزونه — در MainActivity.java/.kt پروژه‌ی Capacitor اضافه کنید:

      import ir.local.daftartarakonesh.SmsReceiverPlugin;
      ...
      registerPlugin(SmsReceiverPlugin.class);

  و در سمت جاوااسکریپت (مثلاً در ابتدای app.js یا index.html) به‌صورت زیر استفاده کنید:

      if (window.Capacitor?.Plugins?.SmsReceiver) {
        const { SmsReceiver } = window.Capacitor.Plugins;
        await SmsReceiver.requestSmsPermission();
        SmsReceiver.addListener('smsReceived', async (data) => {
          const parsed = SmsParser.parse(data.body);
          await DB.add('transactions', {
            ...parsed, status: 'new', unitId: null, categoryId: null,
            description: '', tags: [], createdAt: new Date().toISOString(),
          });
          // نمایش اعلان محلی (بدون سرور) در صورت فعال بودن در تنظیمات
        });
      }
*/
