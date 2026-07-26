/*
  smsParser.js — تشخیص و استخراج اطلاعات از متن پیامک‌های بانکی ایرانی
  چون فرمت پیامک هر بانک (و حتی هر نسخه از سامانه‌ی پیامکی همان بانک) متفاوت است،
  این موتور به‌صورت «چند لایه‌ای» عمل می‌کند: چند الگوی Regex به ترتیب اولویت
  امتحان می‌شوند تا مبلغ، تاریخ، نوع تراکنش و... استخراج شوند.
*/

const SmsParser = (() => {

  // فهرست بانک‌ها + کلیدواژه‌هایی که معمولاً در پیامک یا شماره فرستنده دیده می‌شوند
  // نکته: چون پیامک‌های واقعی گاهی از حروف عربی (ي، ك) به‌جای فارسی (ی، ک) استفاده می‌کنند،
  // قبل از تشخیص، متن نرمال‌سازی می‌شود؛ پس نیازی به تکرار هر دو حالت در alias نیست.
  const BANKS = [
    { name: 'بانک ملت', aliases: ['ملت', 'mellat', 'behpardakht'] },
    { name: 'بانک ملی ایران', aliases: ['ملی ایران', 'بام ملی', 'ملی', 'melli', 'sibbank'] },
    { name: 'بانک صادرات', aliases: ['صادرات', 'saderat', 'sadad'] },
    { name: 'بانک تجارت', aliases: ['تجارت', 'tejarat'] },
    { name: 'بانک سپه', aliases: ['سپه', 'sepah'] },
    { name: 'بلو (بانک دیجیتال سپه)', aliases: ['بلو'] },
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
    { name: 'بانک قرض‌الحسنه مهر ایران', aliases: ['مهر ایران', 'قرض الحسنه مهر', 'مهرایران'] },
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

  // یکسان‌سازی حروف عربی رایج در پیامک‌های بانکی (ي→ی، ك→ک) تا تشخیص بانک/کلیدواژه‌ها
  // مستقل از سلیقه‌ی سامانه‌ی پیامکی هر بانک کار کند.
  function normalizeArabic(str) {
    if (!str) return str;
    return str.replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/‌/g, '');
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
    const depositWords = ['واریزی', 'واریز', 'دریافت وجه', 'افزایش موجودی', 'بستانکار'];
    const withdrawWords = ['برداشت', 'خرید', 'انتقال', 'کسر', 'بدهکار', 'پرداخت', 'پرید'];
    for (const w of depositWords) if (text.includes(w)) return 'deposit';
    for (const w of withdrawWords) if (text.includes(w)) return 'withdraw';
    return 'unknown';
  }

  function detectTypeFromSign(text) {
    const t = toLatinDigits(text);
    const m = t.match(/[\d,]{3,}\s*([+\-−])(?!\d)/);
    if (!m) return null;
    return m[1] === '+' ? 'deposit' : 'withdraw';
  }

  function applyCurrency(raw, currencyWord) {
    const amount = parseInt(String(raw).replace(/[,\s]/g, ''), 10);
    if (isNaN(amount)) return null;
    if (currencyWord && currencyWord.includes('تومان')) return amount * 10;
    return amount;
  }

  function extractAmount(text) {
    const t = toLatinDigits(text);

    let m = t.match(/(?:مبلغ|بمبلغ)\s*[:：]?\s*([\d,]+)\s*(ریال|تومان|ريال)?/);
    if (m) return applyCurrency(m[1], m[2]);

    m = t.match(/(?:برداشت|واریزی|واریز)\s*[:：]?\s*([\d,]{3,})/);
    if (m) return applyCurrency(m[1], null);

    m = t.match(/([\d,]{4,})\s*(ریال|تومان)/);
    if (m) return applyCurrency(m[1], m[2]);

    m = t.match(/([\d,]{4,})\s*[+\-−](?!\d)/);
    if (m) return applyCurrency(m[1], null);

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
    // شماره کارت همیشه به‌صورت پوشیده (masked) با ستاره نمایش داده می‌شود؛ مثل 6274-****-****-1234
    // (بدون نیاز به ستاره در متن، شماره حساب‌های خط‌تیره‌دار به‌اشتباه کارت تشخیص داده می‌شدند)
    const re = /(\d{4}-?\*{2,4}-?\*{2,4}-?\d{4})/;
    const m = t.match(re);
    return m ? m[1] : null;
  }

  function extractAccount(text) {
    const t = toLatinDigits(text);
    const re = /(?:حساب)\s*[:：]?\s*([\d\-]{4,30})/;
    const m = t.match(re);
    if (!m) return null;
    return m[1].replace(/-+$/, '');
  }

  function extractTrackingCode(text) {
    const t = toLatinDigits(text);
    const re = /(?:پیگیری|کد رهگیری|شناسه پیگیری|مستند)\s*[:：]?\s*(\d{4,20})/;
    const m = t.match(re);
    return m ? m[1] : null;
  }

  function extractDate(text) {
    const t = toLatinDigits(text);

    // ۰) اگر پس از کلمه‌ی «تاریخ» یا «زمان» یک تاریخ آمده، همیشه اولویت با همان است
    let m = t.match(/(?:تاریخ|زمان)\s*[:：]?\s*(\d{2,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4})/);
    if (m) return m[1];

    // ۱) در میان همه‌ی الگوهای «کامل» موجود در متن، آن‌که گروه اول‌اش به سال شمسی
    // شبیه‌تر است (۱۳xx یا ۱۴xx) در اولویت است — این از قاطی‌شدن با شماره‌حساب‌های
    // خط‌تیره‌دار (مثل 3605-10-5330227) جلوگیری می‌کند.
    const fullMatches = [...t.matchAll(/(\d{2,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})/g)];
    const yearLike = fullMatches.find((mm) => {
      const y = parseInt(mm[1], 10);
      return y >= 1300 && y <= 1500;
    });
    if (yearLike) return yearLike[0];
    if (fullMatches.length) return fullMatches[0][0];

    // ۲) فرمت کوتاه بدون سال — مثل 1/4 (روز/ماه)
    m = t.match(/\b(\d{1,2}\/\d{1,2})(?=[\s\-]|$)/);
    if (m) return m[1];

    // ۳) فرمت فشرده بدون هیچ جداکننده‌ای، بلافاصله قبل از ساعت — مثل 1128-23:58
    m = t.match(/\b(\d{3,4})\s*-\s*\d{1,2}:\d{2}/);
    if (m) return m[1];

    return null;
  }

  function extractTime(text) {
    const t = toLatinDigits(text);
    const re = /(\d{1,2}:\d{2}(?::\d{2})?)/;
    const m = t.match(re);
    return m ? m[1] : null;
  }

  function parse(rawText) {
    const original = (rawText || '').trim();
    const text = normalizeArabic(original);

    const bankName = detectBank(text);
    let type = detectType(text);
    if (type === 'unknown') {
      const signType = detectTypeFromSign(text);
      if (signType) type = signType;
    }
    const amount = extractAmount(text);
    const balanceAfter = extractBalance(text);
    const cardNumber = extractCard(text);
    const accountNumber = extractAccount(text);
    const trackingCode = extractTrackingCode(text);
    const date = extractDate(text);
    const time = extractTime(text);

    return {
      bankName: bankName || 'نامشخص',
      type,
      amount,
      balanceAfter,
      cardNumber,
      accountNumber,
      trackingCode,
      date,
      time,
      rawText: original,
      recognized: Boolean(bankName && amount !== null),
    };
  }

  return { parse, detectBank, detectType, extractAmount, toLatinDigits, normalizeArabic, BANKS };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = SmsParser;
