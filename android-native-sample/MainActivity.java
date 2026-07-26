/*
  MainActivity.java — نسخه‌ی کامل و آماده برای جایگزینی
  --------------------------------------------------------
  چون تشخیص داده شد که «افزونه پیدا نشد» (window.Capacitor.Plugins.SmsReceiver
  undefined است)، یعنی این فایل هرگز registerPlugin را صدا نزده. به‌جای اضافه
  کردن دستی دو خط به فایل خودتان (که جای خطا دارد)، کل این فایل را کپی کنید و
  فایل موجودتان را با آن جایگزین کنید.

  مسیر دقیق فایل (باید از قبل وجود داشته باشد، چون Capacitor آن را در
  `npx cap add android` می‌سازد):
      android/app/src/main/java/ir/local/daftartarakonesh/MainActivity.java

  اگر appId شما در capacitor.config.json چیزی غیر از "ir.local.daftartarakonesh"
  است، هم مسیر پوشه‌ها و هم خط package زیر را متناسب با آن عوض کنید.

  نکته‌ی مهم: اگر بعداً دستور `npx cap add android` را دوباره اجرا کنید (نه
  `sync`، بلکه `add` از نو) این فایل بازنویسی و ویرایش شما پاک می‌شود — دستور
  `npx cap sync android` مشکلی ندارد و این فایل را دست نمی‌زند.
*/
package ir.local.daftartarakonesh;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // این خط باید قبل از super.onCreate باشد
        registerPlugin(SmsReceiverPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
