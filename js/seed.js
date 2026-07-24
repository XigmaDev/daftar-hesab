/*
  seed.js — داده‌های نمونه برای تست اولیه برنامه (فقط در صورت خالی بودن دیتابیس اجرا می‌شود)
*/

const Seed = (() => {

  const SAMPLE_UNITS = [
    { name: 'شخصی', color: '#5B8C7B' },
    { name: 'مالی', color: '#C99A3E' },
    { name: 'فروش', color: '#3E7CB1' },
    { name: 'پروژه الف', color: '#8A5FB0' },
  ];

  const SAMPLE_CATEGORIES = [
    { name: 'خرید', color: '#B4433B' },
    { name: 'حقوق', color: '#2E7D5B' },
    { name: 'قبوض', color: '#C99A3E' },
    { name: 'اجاره', color: '#8A5FB0' },
    { name: 'انتقال', color: '#3E7CB1' },
    { name: 'دریافت پروژه', color: '#5B8C7B' },
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

    // چند تراکنش نمونه در کارتابل (بدون دسته‌بندی) + چند تای دسته‌بندی‌شده
    for (const sms of SAMPLE_SMS) {
      const parsed = SmsParser.parse(sms);
      await DB.add('transactions', {
        ...parsed,
        status: 'new',
        unitId: null,
        categoryId: null,
        description: '',
        tags: [],
        createdAt: new Date().toISOString(),
      });
    }

    // یک تراکنش دستی نمونه که قبلاً دسته‌بندی شده
    await DB.add('transactions', {
      bankName: 'بانک سامان',
      type: 'withdraw',
      amount: 1800000,
      balanceAfter: null,
      cardNumber: null,
      accountNumber: null,
      trackingCode: null,
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
