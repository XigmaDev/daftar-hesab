/*
  seed.js — داده‌های نمونه برای تست اولیه برنامه (فقط در صورت خالی بودن دیتابیس اجرا می‌شود)
*/

const Seed = (() => {

  const SAMPLE_UNITS = [
    { name: 'شخصی', color: '#5B8C7B' },
    { name: 'مالی', color: '#C9A227' },
    { name: 'فروش', color: '#3E7CB1' },
    { name: 'پروژه الف', color: '#8A5FB0' },
  ];

  const SAMPLE_CATEGORIES = [
    { name: 'خرید', color: '#C1453A' },
    { name: 'حقوق', color: '#1E8F63' },
    { name: 'قبوض', color: '#C9A227' },
    { name: 'اجاره', color: '#8A5FB0' },
    { name: 'انتقال', color: '#3E7CB1' },
    { name: 'دریافت پروژه', color: '#5B8C7B' },
  ];

  const SAMPLE_BANKS = [
    { name: 'بانک ملت', color: '#0D3A42' },
    { name: 'بانک سامان', color: '#3E7CB1' },
  ];

  // موجودی اولیه بر حسب تومان (در زمان ذخیره در ۱۰ ضرب می‌شود تا به ریال تبدیل شود)
  const SAMPLE_ACCOUNTS = [
    { bankName: 'بانک ملت', title: 'حساب اصلی', accountType: 'checking', cardNumber: '6104-XXXX-XXXX-3321', accountNumber: '1234567890', iban: '', initialBalanceToman: 5000000 },
    { bankName: 'بانک سامان', title: 'کارت شخصی', accountType: 'card', cardNumber: '6219-XXXX-XXXX-4471', accountNumber: '', iban: '', initialBalanceToman: 1200000 },
  ];

  const SAMPLE_SMS = [
    'بانک ملت\nواریز به مبلغ: 12,500,000 ریال\nحساب: 1234567890\nمانده: 84,300,000 ریال\nتاریخ: 1403/04/12 ساعت 09:14\nپیگیری: 88213045',
    'صادرات\nخرید کارت 6037-****-****-2214\nمبلغ: 450,000 ریال\nمانده: 83,850,000 ریال\n1403/04/13 14:02\nکد پیگیری: 55102938',
    'بانک ملی ایران: برداشت مبلغ 2,000,000 ریال از حساب 9988776655 - مانده: 81,850,000 ریال - 1403/04/14 11:30 - پیگیری 10029384',
    'پارسیان: واریزی 35,000,000 ریال به کارت 6221-****-****-7788، مانده 116,850,000 ریال، تاریخ 1403/04/15 ساعت 08:00، پیگیری 77341022',
  ];

  async function run() {
    const existingUnits = await DB.getAll('units');
    if (existingUnits.length > 0) return; // فقط بار اول

    const unitIds = {};
    for (const u of SAMPLE_UNITS) {
      unitIds[u.name] = await DB.add('units', u);
    }

    const catIds = {};
    for (const c of SAMPLE_CATEGORIES) {
      catIds[c.name] = await DB.add('categories', c);
    }

    const bankIds = {};
    for (const b of SAMPLE_BANKS) {
      bankIds[b.name] = await DB.add('banks', { name: b.name, color: b.color });
    }

    const accountIds = {};
    for (const a of SAMPLE_ACCOUNTS) {
      accountIds[a.title] = await DB.add('accounts', {
        bankId: bankIds[a.bankName],
        title: a.title,
        accountType: a.accountType,
        cardNumber: a.cardNumber,
        accountNumber: a.accountNumber,
        iban: a.iban,
        initialBalance: a.initialBalanceToman * 10,
      });
    }

    // چند تراکنش نمونه در کارتابل (بدون دسته‌بندی) + چند تای دسته‌بندی‌شده
    for (const sms of SAMPLE_SMS) {
      const parsed = SmsParser.parse(sms);
      await DB.add('transactions', {
        ...parsed,
        status: 'new',
        unitId: null,
        categoryId: null,
        accountId: null,
        description: '',
        tags: [],
        createdAt: new Date().toISOString(),
      });
    }

    // یک تراکنش دستی نمونه که قبلاً دسته‌بندی و به یک حساب متصل شده
    await DB.add('transactions', {
      bankName: 'بانک سامان',
      type: 'withdraw',
      amount: 1800000,
      balanceAfter: null,
      cardNumber: null,
      accountNumber: null,
      trackingCode: null,
      accountId: accountIds['کارت شخصی'],
      date: '1403/04/10',
      time: '10:00',
      rawText: '',
      recognized: true,
      status: 'reviewed',
      unitId: unitIds['شخصی'],
      categoryId: catIds['قبوض'],
      description: 'پرداخت قبض برق',
      tags: ['قبض', 'خانه'],
      createdAt: new Date().toISOString(),
    });
  }

  return { run };
})();
