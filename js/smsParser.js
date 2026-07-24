/*
  smsParser.js — تشخیص و استخراج اطلاعات از متن پیامک‌های بانکی ایرانی
  چون فرمت پیامک هر بانک متفاوت است، به‌جای یک Regex واحد، از یک موتور
  «تشخیص بانک + استخراج عمومی» استفاده شده که روی اکثر فرمت‌های رایج جواب می‌دهد.
*/

const SmsParser = (() => {

  // فهرست بانک‌ها + کلیدواژه‌هایی که معمولاً در پیامک یا شماره فرستنده دیده می‌شوند
  const BANKS = [
    { name: 'بانک ملت', aliases: ['ملت', 'mellat', 'behpardakht'] },
    { name: 'بانک ملی', aliases: ['ملی ایران', 'بام ملی', 'melli', 'sibbank'] },
    { name: 'بانک صادرات', aliases: ['صادرات', 'saderat', 'sadad'] },
    { name: 'بانک تجارت', aliases: ['تجارت', 'tejarat'] },
    { name: 'بانک سپه', aliases: ['سپه', 'sepah'] },
    { name: 'بانک سامان', aliases: ['سامان', 'saman'] },
    { name: 'بانک پاسارگاد', aliases: ['پاسارگاد', 'pasargad'] },
    { name: 'بانک آینده', aliases: ['آینده', 'ayandeh'] },
    { name: 'بانک پارسیان', aliases: ['پارسیان', 'parsian'] },
    { name: 'بانک شهر', aliases: ['شهر', 'city bank', 'shahr'] },
    { name: 'بانک کشاورزی', aliases: ['کشاورزی', 'keshavarzi'] },
    { name: 'بانک رفاه', aliases: ['رفاه کارگران', 'رفاه', 'refah'] },
    { name: 'بانک اقتصاد نوین', aliases: ['اقتصاد نوین', 'اقتصادنوین', 'en bank'] },
    { name: 'بانک سینا', aliases: ['سینا', 'sina'] },
    { name: 'بانک دی', aliases: ['بانک دی', 'dey bank'] },
    { name: 'بانک کارآفرین', aliases: ['کارآفرین', 'karafarin'] },
    { name: 'بانک قرض‌الحسنه رسالت', aliases: ['رسالت', 'resalat'] },
    { name: 'بانک مهر ایران', aliases: ['مهر ایران', 'قرض الحسنه مهر'] },
    { name: 'بانک ایران زمین', aliases: ['ایران زمین', 'iranzamin'] },
    { name: 'بانک گردشگری', aliases: ['گردشگری', 'gardeshgari'] },
    { name: 'بانک مسکن', aliases: ['مسکن', 'maskan', 'بام مسکن'] },
    { name: 'پست بانک ایران', aliases: ['پست بانک'] },
    { name: 'بانک انصار', aliases: ['انصار'] },
    { name: 'بانک حکمت ایرانیان', aliases: ['حکمت ایرانیان', 'حکمت'] },
    { name: 'موسسه ملل (عسکریه)', aliases: ['موسسه ملل', 'عسکریه'] },
  ];

  // تبدیل ارقام فارسی/عربی به لاتین برای پردازش عددی
  function toLatinDigits(str) {
    if (!str) return str;
    const fa = '۰۱۲۳۴۵۶۷۸۹';
    const ar = '٠١٢٣٤٥٦٧٨٩';
    return str.replace(/[۰-۹٠-٩]/g, (d) => {
      const i = fa.indexOf(d);
      if (i > -1) return String(i);
      const j = ar.indexOf(d);
      if (j > -1) return String(j);
      return d;
    });
  }

  function detectBank(text) {
    const lower = text.toLowerCase();
    for (const bank of BANKS) {
      for (const alias of bank.aliases) {
        if (lower.includes(alias.toLowerCase())) return bank.name;
      }
    }
    return null;
  }

  function detectType(text) {
    // واریز / برداشت را از کلمات کلیدی رایج در پیامک‌های بانکی تشخیص می‌دهد
    const depositWords = ['واریز', 'واریزی', 'دریافت وجه', 'افزایش موجودی', 'بستانکار'];
    const withdrawWords = ['برداشت', 'خرید', 'انتقال', 'کسر', 'بدهکار', 'پرداخت'];
    for (const w of depositWords) if (text.includes(w)) return 'deposit';
    for (const w of withdrawWords) if (text.includes(w)) return 'withdraw';
    return 'unknown';
  }

  function extractAmount(text) {
    // مبلغ: 150,000 ریال  یا  مبلغ 20000 تومان  یا  به مبلغ: 1,200,000
    const t = toLatinDigits(text);
    const re = /(?:مبلغ|بمبلغ)\s*[:：]?\s*([\d,۰-۹]+)\s*(ریال|تومان|ريال)?/;
    const m = t.match(re);
    if (m) {
      const raw = m[1].replace(/,/g, '');
      let amount = parseInt(raw, 10);
      if (m[2] && m[2].includes('تومان')) amount *= 10; // نمایش یکسان بر حسب ریال داخلی
      return isNaN(amount) ? null : amount;
    }
    // فرمت جایگزین: عددی بزرگ همراه با "ریال" در هر جای متن
    const re2 = /([\d,]{4,})\s*(ریال|تومان)/;
    const m2 = t.match(re2);
    if (m2) {
      let amount = parseInt(m2[1].replace(/,/g, ''), 10);
      if (m2[2] === 'تومان') amount *= 10;
      return isNaN(amount) ? null : amount;
    }
    return null;
  }

  function extractBalance(text) {
    const t = toLatinDigits(text);
    const re = /(?:مانده|موجودی)\s*[:：]?\s*([\d,]+)/;
    const m = t.match(re);
    if (m) return parseInt(m[1].replace(/,/g, ''), 10);
    return null;
  }

  function extractCard(text) {
    const t = toLatinDigits(text);
    // شماره کارت معمولاً به‌صورت پوشیده نمایش داده می‌شود: 6274-****-****-1234
    const re = /(\d{4}[-*]{1,}\d{0,4}[-*]{0,}\d{0,4}[-*]{0,}\d{4})/;
    const m = t.match(re);
    return m ? m[1] : null;
  }

  function extractAccount(text) {
    const t = toLatinDigits(text);
    const re = /(?:حساب)\s*[:：]?\s*(\d{4,20})/;
    const m = t.match(re);
    return m ? m[1] : null;
  }

  function extractTrackingCode(text) {
    const t = toLatinDigits(text);
    const re = /(?:پیگیری|کد رهگیری|شناسه پیگیری)\s*[:：]?\s*(\d{4,20})/;
    const m = t.match(re);
    return m ? m[1] : null;
  }

  function extractDate(text) {
    const t = toLatinDigits(text);
    // فرمت‌های رایج: 1403/05/12 یا 12/05/1403 یا 1403-05-12
    const re = /(\d{2,4}[\/\-]\d{1,2}[\/\-]\d{1,4})/;
    const m = t.match(re);
    return m ? m[1] : null;
  }

  function extractTime(text) {
    const t = toLatinDigits(text);
    const re = /(\d{1,2}:\d{2}(?::\d{2})?)/;
    const m = t.match(re);
    return m ? m[1] : null;
  }

  /**
   * تابع اصلی: یک متن پیامک را گرفته و یک آبجکت تراکنش استخراج‌شده برمی‌گرداند.
   */
  function parse(rawText) {
    const text = (rawText || '').trim();
    const bankName = detectBank(text);
    const type = detectType(text);
    const amount = extractAmount(text);
    const balanceAfter = extractBalance(text);
    const cardNumber = extractCard(text);
    const accountNumber = extractAccount(text);
    const trackingCode = extractTrackingCode(text);
    const date = extractDate(text);
    const time = extractTime(text);

    return {
      bankName: bankName || 'نامشخص',
      type,                 // 'deposit' | 'withdraw' | 'unknown'
      amount,                // به ریال
      balanceAfter,
      cardNumber,
      accountNumber,
      trackingCode,
      date,
      time,
      rawText: text,
      recognized: Boolean(bankName && amount !== null),
    };
  }

  return { parse, detectBank, detectType, extractAmount, toLatinDigits, BANKS };
})();
