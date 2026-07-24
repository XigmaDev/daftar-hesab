/*
  app.js — هسته اصلی برنامه (Router + رندر صفحات + مدیریت رویدادها)
  معماری: SPA سبک با Hash Router، بدون فریمورک، بدون هیچ وابستگی بیرونی.
*/

const App = (() => {
  const root = document.getElementById('app-shell');
  let STATE = {
    period: 'today',
    txFilter: { status: null, unitId: null, categoryId: null, q: '' },
    selectMode: false,
    selectedIds: new Set(),
    unitsCache: [],
    categoriesCache: [],
    banksCache: [],
    accountsCache: [],
  };

  /* ---------------- ابزارهای کمکی ---------------- */
  const toFa = (n) => (n === null || n === undefined || isNaN(n)) ? '—' : Number(n).toLocaleString('fa-IR');
  const toman = (rial) => Math.round((rial || 0) / 10);
  const money = (rial) => `${toFa(toman(rial))} <small>تومان</small>`;
  const escapeHtml = (s) => (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }

  function openSheet(html) {
    const wrap = document.createElement('div');
    wrap.className = 'sheet-backdrop';
    wrap.id = 'active-sheet';
    wrap.innerHTML = `<div class="sheet"><div class="handle"></div>${html}</div>`;
    wrap.addEventListener('click', (e) => { if (e.target === wrap) closeSheet(); });
    document.body.appendChild(wrap);
    return wrap;
  }
  function closeSheet() { document.getElementById('active-sheet')?.remove(); }

  function confirmDialog(message) {
    return new Promise((resolve) => {
      const sheet = openSheet(`
        <p style="font-size:14px; line-height:1.9; margin-bottom:18px;">${escapeHtml(message)}</p>
        <div class="btn-row">
          <button class="btn btn-ghost" id="cd-cancel">انصراف</button>
          <button class="btn btn-danger" id="cd-ok">تأیید</button>
        </div>
      `);
      sheet.querySelector('#cd-cancel').onclick = () => { closeSheet(); resolve(false); };
      sheet.querySelector('#cd-ok').onclick = () => { closeSheet(); resolve(true); };
    });
  }

  /* ---------------- آیکون‌های SVG (بدون وابستگی بیرونی) ---------------- */
  const ICON = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/></svg>',
    inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    reports: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18.4 8.6 12 15l-3-3-3.6 3.6"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>',
    tray: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>',
    sms: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    coin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 9.5c0-1 1-1.8 3-1.8s3 .8 3 1.8-1 1.3-3 1.8-3 .8-3 1.9 1 1.8 3 1.8 3-.8 3-1.8"/></svg>',
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"/><circle cx="7" cy="7" r="1"/></svg>',
    bank: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 21 8 3 8"/></svg>',
    card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    backup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    theme: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    chevronL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
    export: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  };

  /* ---------------- بارگذاری داده‌های پایه (Cache) ---------------- */
  async function refreshLookups() {
    STATE.unitsCache = await DB.getAll('units');
    STATE.categoriesCache = await DB.getAll('categories');
    STATE.banksCache = await DB.getAll('banks');
    STATE.accountsCache = await DB.getAll('accounts');
  }
  const unitName = (id) => STATE.unitsCache.find((u) => u.id === id)?.name || null;
  const catName = (id) => STATE.categoriesCache.find((c) => c.id === id)?.name || null;
  const catColor = (id) => STATE.categoriesCache.find((c) => c.id === id)?.color || 'var(--primary)';
  const bankOf = (id) => STATE.banksCache.find((b) => b.id === id) || null;
  const accountOf = (id) => STATE.accountsCache.find((a) => a.id === id) || null;

  // موجودی فعلی هر حساب = موجودی اولیه + مجموع واریزها − مجموع برداشت‌های ثبت‌شده روی همان حساب
  function accountBalance(accountId, allTx) {
    const acc = accountOf(accountId);
    if (!acc) return 0;
    const related = allTx.filter((t) => t.accountId === accountId);
    const delta = related.reduce((s, t) => s + (t.type === 'deposit' ? (t.amount || 0) : t.type === 'withdraw' ? -(t.amount || 0) : 0), 0);
    return (acc.initialBalance || 0) + delta;
  }

  /* ---------------- محاسبه بازه زمانی ---------------- */
  function periodRange(period) {
    const now = new Date();
    let from;
    if (period === 'today') { from = new Date(now.getFullYear(), now.getMonth(), now.getDate()); }
    else if (period === 'week') { from = new Date(now); from.setDate(now.getDate() - 7); }
    else if (period === 'month') { from = new Date(now); from.setMonth(now.getMonth() - 1); }
    else if (period === 'year') { from = new Date(now); from.setFullYear(now.getFullYear() - 1); }
    else { from = new Date(0); }
    return { from, to: now };
  }

  /* برای سادگی، چون تاریخ تراکنش‌ها به فرمت متنی پیامک (شمسی خام) است،
     در نبود تاریخ معتبر از createdAt (تاریخ ثبت در برنامه) استفاده می‌شود. */
  function inPeriod(t, period) {
    if (period === 'all') return true;
    const { from } = periodRange(period);
    const d = new Date(t.createdAt);
    return d >= from;
  }

  /* ---------------- روتر ---------------- */
  const routes = {
    '/dashboard': renderDashboard,
    '/inbox': renderInbox,
    '/transactions': renderTransactions,
    '/reports': renderReports,
    '/units': renderUnits,
    '/categories': renderCategories,
    '/banks': renderBanks,
    '/settings': renderSettings,
    '/backup': renderBackup,
  };

  async function router() {
    let hash = location.hash.replace('#', '') || '/dashboard';
    await refreshLookups();

    let match = null, param = null;
    if (hash.startsWith('/transactions/new')) { match = renderTxForm; param = null; }
    else if (hash.startsWith('/transactions/edit/')) { match = renderTxForm; param = hash.split('/').pop(); }
    else if (hash.startsWith('/transactions/')) { match = renderTxDetail; param = hash.split('/').pop(); }
    else if (routes[hash]) { match = routes[hash]; }
    else { match = renderDashboard; }

    STATE.selectMode = false;
    STATE.selectedIds.clear();
    await match(param);
    renderNav(hash);
    window.scrollTo(0, 0);
  }

  function renderNav(hash) {
    const items = [
      { href: '#/dashboard', icon: ICON.dashboard, label: 'داشبورد' },
      { href: '#/inbox', icon: ICON.inbox, label: 'کارتابل' },
      { href: '#/transactions', icon: ICON.list, label: 'تراکنش‌ها' },
      { href: '#/reports', icon: ICON.reports, label: 'گزارش‌ها' },
      { href: '#/settings', icon: ICON.settings, label: 'تنظیمات' },
    ];
    let nav = document.getElementById('bottom-nav');
    if (!nav) {
      nav = document.createElement('nav');
      nav.className = 'bottom-nav';
      nav.id = 'bottom-nav';
      root.appendChild(nav);
    }
    nav.innerHTML = items.map((it) => {
      const active = ('#' + hash).startsWith(it.href) || (hash === '/dashboard' && it.href === '#/dashboard');
      return `<a href="${it.href}" class="${active ? 'active' : ''}">${it.icon}<span>${it.label}</span></a>`;
    }).join('');

    let fab = document.getElementById('fab-add');
    const showFab = ['/dashboard', '/inbox', '/transactions'].some((p) => ('/' + hash.split('/')[1]) === p || hash === p);
    if (!fab) {
      fab = document.createElement('button');
      fab.id = 'fab-add';
      fab.className = 'fab';
      fab.innerHTML = ICON.plus;
      fab.onclick = () => { location.hash = '#/transactions/new'; };
      root.appendChild(fab);
    }
    fab.classList.toggle('hidden', !showFab);
  }

  function topbar(title, opts = {}) {
    const back = opts.back ? `<button class="icon-btn" id="btn-back">${ICON.back}</button>` : '';
    const actions = opts.actions || '';
    return `<div class="topbar">${back}<div><h1>${title}</h1>${opts.subtitle ? `<span class="subtitle">${opts.subtitle}</span>` : ''}</div>${actions}</div>`;
  }

  function mountPage(html) {
    let main = document.getElementById('page-main');
    if (!main) {
      main = document.createElement('main');
      main.className = 'page';
      main.id = 'page-main';
    }
    main.innerHTML = html;
    // ترتیب: topbar باید قبل از main باشد، bottom-nav بعد از آن
    const oldMain = document.getElementById('page-main');
    if (root.contains(oldMain) && oldMain !== main) oldMain.remove();
    const nav = document.getElementById('bottom-nav');
    if (nav) root.insertBefore(main, nav); else root.appendChild(main);
    document.getElementById('btn-back')?.addEventListener('click', () => history.back());
    return main;
  }

  /* ================= داشبورد ================= */
  async function renderDashboard() {
    const all = await DB.getAll('transactions');
    const filtered = all.filter((t) => inPeriod(t, STATE.period));
    const deposit = filtered.filter((t) => t.type === 'deposit').reduce((s, t) => s + (t.amount || 0), 0);
    const withdraw = filtered.filter((t) => t.type === 'withdraw').reduce((s, t) => s + (t.amount || 0), 0);
    const lastBalance = [...all].reverse().find((t) => t.balanceAfter)?.balanceAfter;
    const newCount = all.filter((t) => t.status === 'new').length;

    const accounts = STATE.accountsCache;
    const hasAccounts = accounts.length > 0;
    const totalAccountsBalance = accounts.reduce((s, a) => s + accountBalance(a.id, all), 0);
    const heroBalance = hasAccounts ? totalAccountsBalance : lastBalance;
    const heroLabel = hasAccounts ? 'مجموع موجودی همه حساب‌ها' : 'آخرین موجودی ثبت‌شده';

    const periods = [['today', 'امروز'], ['week', 'این هفته'], ['month', 'این ماه'], ['year', 'امسال'], ['all', 'کل بازه']];

    // داده روند ۷ روز اخیر برای نمودار خطی
    const days = [...Array(7)].map((_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      const key = d.toDateString();
      const dayTx = all.filter((t) => new Date(t.createdAt).toDateString() === key);
      return {
        label: d.toLocaleDateString('fa-IR', { weekday: 'short' }),
        deposit: dayTx.filter((t) => t.type === 'deposit').reduce((s, t) => s + (t.amount || 0), 0),
        withdraw: dayTx.filter((t) => t.type === 'withdraw').reduce((s, t) => s + (t.amount || 0), 0),
      };
    });

    // بر اساس دسته‌بندی
    const byCat = {};
    filtered.forEach((t) => {
      if (!t.categoryId) return;
      byCat[t.categoryId] = (byCat[t.categoryId] || 0) + (t.amount || 0);
    });
    const catSlices = Object.entries(byCat).map(([id, value]) => ({
      label: catName(Number(id)) || 'سایر', value, color: catColor(Number(id)),
    })).sort((a, b) => b.value - a.value).slice(0, 6);

    const recent = [...all].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);

    mountPage(`
      ${topbar('داشبورد', { subtitle: 'دفتر تراکنش · کاملاً آفلاین' })}
      <div class="balance-hero">
        <div class="label">${heroLabel}</div>
        <div class="amount">${heroBalance ? toFa(toman(heroBalance)) : '—'} <small>تومان</small></div>
        <div class="row">
          <div class="stat deposit"><div class="k">واریز (${periods.find((p) => p[0] === STATE.period)[1]})</div><div class="v">${toFa(toman(deposit))}</div></div>
          <div class="stat withdraw"><div class="k">برداشت (${periods.find((p) => p[0] === STATE.period)[1]})</div><div class="v">${toFa(toman(withdraw))}</div></div>
        </div>
      </div>

      <div class="period-tabs">
        ${periods.map(([k, l]) => `<button data-period="${k}" class="${STATE.period === k ? 'active' : ''}">${l}</button>`).join('')}
      </div>

      <div class="stat-grid">
        <div class="stat-card"><div class="k">تعداد تراکنش‌ها</div><div class="v">${toFa(filtered.length)}</div></div>
        <div class="stat-card"><div class="k">در انتظار بررسی</div><div class="v">${toFa(newCount)}</div></div>
      </div>

      <div class="section-title"><h2>موجودی هر حساب</h2><span class="link" id="go-banks">مدیریت بانک‌ها</span></div>
      ${hasAccounts ? `
      <div class="tx-list">
        ${accounts.map((a) => {
          const bank = bankOf(a.bankId);
          const bal = accountBalance(a.id, all);
          return `<div class="tx-item" data-account-nav="${a.id}">
            <div class="avatar" style="background:${bank?.color || 'var(--primary)'}">${(bank?.name || '؟').replace('بانک ', '').slice(0, 1)}</div>
            <div class="info">
              <div class="top"><span class="bank">${escapeHtml(bank?.name || 'نامشخص')}</span><span class="amount ${bal >= 0 ? 'deposit' : 'withdraw'}">${toFa(toman(bal))} <small style="font-size:10px;">تومان</small></span></div>
              <div class="meta"><span>${escapeHtml(a.title || 'حساب بدون عنوان')}${a.cardNumber ? ` · ${escapeHtml(a.cardNumber)}` : ''}</span></div>
            </div>
          </div>`;
        }).join('')}
      </div>` : `<div class="card"><p class="text-muted" style="font-size:12.5px; line-height:1.9;">هنوز بانک یا حسابی اضافه نکرده‌اید. با افزودن بانک و حساب همراه موجودی اولیه، موجودی هر حساب و مجموع دارایی‌ها اینجا محاسبه می‌شود.</p></div>`}

      <div class="section-title"><h2>روند ورود و خروج (۷ روز اخیر)</h2></div>
      <div class="card"><div id="line-chart"></div></div>

      <div class="section-title"><h2>سهم دسته‌بندی‌ها</h2><span class="link" id="go-reports">گزارش کامل</span></div>
      <div class="card">
        ${catSlices.length ? `<div class="chart-row"><div style="flex:0 0 150px" id="donut-chart"></div></div>` : `<p class="text-muted" style="font-size:12.5px;">هنوز تراکنشی دسته‌بندی نشده است.</p>`}
      </div>

      <div class="section-title"><h2>تراکنش‌های اخیر</h2><span class="link" id="go-tx">مشاهده همه</span></div>
      <div class="tx-list">
        ${recent.length ? recent.map(txItemHtml).join('') : emptyInlineHtml('هنوز تراکنشی ثبت نشده', 'با دریافت یا افزودن دستی، تراکنش‌ها اینجا نمایش داده می‌شوند.')}
      </div>
    `);

    Charts.lineChart(document.getElementById('line-chart'), days);
    if (catSlices.length) Charts.donutChart(document.getElementById('donut-chart'), catSlices, { size: 150 });

    document.querySelectorAll('.period-tabs button').forEach((b) => b.onclick = () => { STATE.period = b.dataset.period; renderDashboard(); });
    document.getElementById('go-reports').onclick = () => location.hash = '#/reports';
    document.getElementById('go-tx').onclick = () => location.hash = '#/transactions';
    document.getElementById('go-banks').onclick = () => location.hash = '#/banks';
    document.querySelectorAll('[data-account-nav]').forEach((el) => el.onclick = () => location.hash = '#/banks');
    bindTxItemClicks();
  }

  function emptyInlineHtml(title, desc) {
    return `<div class="empty-state"><div class="icon-wrap">${ICON.tray}</div><h3>${title}</h3><p>${desc}</p></div>`;
  }

  function txItemHtml(t) {
    const isDeposit = t.type === 'deposit';
    const bankInitial = (t.bankName || '؟').replace('بانک ', '').slice(0, 1);
    return `
      <div class="tx-item" data-id="${t.id}">
        <div class="avatar ${isDeposit ? 'deposit' : t.type === 'withdraw' ? 'withdraw' : ''}">${bankInitial}</div>
        <div class="info">
          <div class="top">
            <span class="bank">${escapeHtml(t.bankName || 'نامشخص')}</span>
            <span class="amount ${isDeposit ? 'deposit' : 'withdraw'}">${isDeposit ? '+' : '−'}${toFa(toman(t.amount))} <small style="font-size:10px;">تومان</small></span>
          </div>
          <div class="meta">
            <span>${t.date || new Date(t.createdAt).toLocaleDateString('fa-IR')}</span>
            ${t.status === 'new' ? '<span class="chip chip--new">جدید</span>' : ''}
            ${catName(t.categoryId) ? `<span class="chip chip--muted">${escapeHtml(catName(t.categoryId))}</span>` : ''}
            ${unitName(t.unitId) ? `<span class="chip chip--muted">${escapeHtml(unitName(t.unitId))}</span>` : ''}
          </div>
        </div>
      </div>`;
  }

  function bindTxItemClicks() {
    document.querySelectorAll('.tx-item[data-id]').forEach((el) => {
      el.addEventListener('click', () => {
        if (STATE.selectMode) { toggleSelect(el, Number(el.dataset.id)); return; }
        location.hash = `#/transactions/${el.dataset.id}`;
      });
      let pressTimer;
      el.addEventListener('touchstart', () => { pressTimer = setTimeout(() => enterSelectMode(el, Number(el.dataset.id)), 480); });
      el.addEventListener('touchend', () => clearTimeout(pressTimer));
    });
  }

  function enterSelectMode(el, id) {
    STATE.selectMode = true;
    document.querySelectorAll('.tx-item').forEach((e) => e.classList.add('selectable'));
    toggleSelect(el, id);
    showBulkBar();
  }

  function toggleSelect(el, id) {
    if (STATE.selectedIds.has(id)) { STATE.selectedIds.delete(id); el.classList.remove('checked'); }
    else { STATE.selectedIds.add(id); el.classList.add('checked'); }
    if (STATE.selectedIds.size === 0) { STATE.selectMode = false; document.querySelectorAll('.tx-item').forEach((e) => e.classList.remove('selectable')); document.getElementById('bulk-bar')?.remove(); }
    else { updateBulkBar(); }
  }

  function showBulkBar() {
    let bar = document.getElementById('bulk-bar');
    if (bar) return updateBulkBar();
    bar = document.createElement('div');
    bar.id = 'bulk-bar';
    bar.className = 'sheet-backdrop';
    bar.style.background = 'transparent';
    bar.style.pointerEvents = 'none';
    bar.innerHTML = `<div class="sheet" style="pointer-events:auto; max-width:480px;">
      <div class="flex-between" style="margin-bottom:12px;">
        <b id="bulk-count" style="font-size:13.5px;"></b>
        <span class="link" id="bulk-cancel" style="color:var(--primary); font-weight:700; font-size:12.5px; cursor:pointer;">انصراف</span>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" id="bulk-edit">ویرایش گروهی</button>
        <button class="btn btn-danger" id="bulk-delete">${ICON.trash} حذف</button>
      </div>
    </div>`;
    document.body.appendChild(bar);
    document.getElementById('bulk-cancel').onclick = () => { STATE.selectMode = false; STATE.selectedIds.clear(); document.querySelectorAll('.tx-item').forEach((e) => { e.classList.remove('selectable', 'checked'); }); bar.remove(); };
    document.getElementById('bulk-delete').onclick = async () => {
      const ok = await confirmDialog(`${STATE.selectedIds.size} تراکنش حذف شود؟ این عملیات قابل بازگشت نیست.`);
      if (!ok) return;
      for (const id of STATE.selectedIds) await DB.del('transactions', id);
      toast('تراکنش‌های انتخاب‌شده حذف شدند');
      STATE.selectMode = false; STATE.selectedIds.clear(); bar.remove();
      router();
    };
    document.getElementById('bulk-edit').onclick = () => openBulkEditSheet();
    updateBulkBar();
  }
  function updateBulkBar() {
    const el = document.getElementById('bulk-count');
    if (el) el.textContent = `${toFa(STATE.selectedIds.size)} مورد انتخاب شده`;
  }

  function openBulkEditSheet() {
    const sheet = openSheet(`
      <h3>ویرایش گروهی</h3>
      <div class="field"><label>واحد</label>
        <select id="be-unit"><option value="">— بدون تغییر —</option>${STATE.unitsCache.map((u) => `<option value="${u.id}">${escapeHtml(u.name)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>دسته‌بندی</label>
        <select id="be-cat"><option value="">— بدون تغییر —</option>${STATE.categoriesCache.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
      </div>
      <button class="btn btn-primary" id="be-apply">اعمال روی موارد انتخاب‌شده</button>
    `);
    sheet.querySelector('#be-apply').onclick = async () => {
      const unitId = sheet.querySelector('#be-unit').value;
      const categoryId = sheet.querySelector('#be-cat').value;
      for (const id of STATE.selectedIds) {
        const t = await DB.get('transactions', id);
        if (unitId) t.unitId = Number(unitId);
        if (categoryId) t.categoryId = Number(categoryId);
        if (t.status === 'new') t.status = 'reviewed';
        await DB.put('transactions', t);
      }
      toast('تغییرات اعمال شد');
      closeSheet();
      document.getElementById('bulk-bar')?.remove();
      STATE.selectMode = false; STATE.selectedIds.clear();
      router();
    };
  }

  /* ================= کارتابل ================= */
  async function renderInbox() {
    const all = await DB.getAll('transactions', 'by_status', 'new');
    const sorted = all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    mountPage(`
      ${topbar('کارتابل', { subtitle: `${toFa(sorted.length)} تراکنش در انتظار بررسی` })}
      ${sorted.length ? `<div class="inbox-banner">${ICON.sms} این تراکنش‌ها از پیامک‌های بانکی استخراج شده‌اند. با ضربه روی هرکدام، دسته‌بندی را مشخص کنید.</div>` : ''}
      <div class="tx-list">
        ${sorted.length ? sorted.map(txItemHtml).join('') : emptyInlineHtml('کارتابل خالی است', 'وقتی پیامک بانکی جدیدی دریافت یا ثبت شود، اینجا نمایش داده می‌شود.')}
      </div>
    `);
    bindInboxItemClicks();
  }

  function bindInboxItemClicks() {
    document.querySelectorAll('.tx-item[data-id]').forEach((el) => {
      el.addEventListener('click', () => {
        if (STATE.selectMode) { toggleSelect(el, Number(el.dataset.id)); return; }
        quickCategorizeSheet(Number(el.dataset.id));
      });
      let pressTimer;
      el.addEventListener('touchstart', () => { pressTimer = setTimeout(() => enterSelectMode(el, Number(el.dataset.id)), 480); });
      el.addEventListener('touchend', () => clearTimeout(pressTimer));
    });
  }

  /* شیت «دسته‌بندی سریع» — سریع‌ترین مسیر برای مشخص‌کردن واحد/دسته‌بندی یک تراکنش
     در کارتابل و ثبت آن، بدون نیاز به باز کردن فرم کامل ویرایش. */
  async function quickCategorizeSheet(id) {
    const t = await DB.get('transactions', id);
    if (!t) return;
    const isDeposit = t.type === 'deposit';
    let selUnit = t.unitId || null;
    let selCat = t.categoryId || null;

    function unitsChipsHtml() {
      return STATE.unitsCache.map((u) => `<button type="button" class="chip-select ${selUnit === u.id ? 'active' : ''}" data-id="${u.id}">${escapeHtml(u.name)}</button>`).join('')
        + `<button type="button" class="chip-select" id="qc-add-unit">${ICON.plus} جدید</button>`;
    }
    function catsChipsHtml() {
      return STATE.categoriesCache.map((c) => `<button type="button" class="chip-select ${selCat === c.id ? 'active' : ''}" data-id="${c.id}">${escapeHtml(c.name)}</button>`).join('')
        + `<button type="button" class="chip-select" id="qc-add-cat">${ICON.plus} جدید</button>`;
    }
    function addRowHtml(placeholder, saveId, inputId) {
      return `<div style="display:flex; gap:8px; margin-top:8px;">
        <input id="${inputId}" placeholder="${placeholder}" style="flex:1; padding:10px 12px; border-radius:10px; border:1px solid var(--border); background:var(--surface); color:var(--text); font-size:13px;" />
        <button class="btn btn-primary" id="${saveId}" style="width:auto; padding:10px 16px;">افزودن</button>
      </div>`;
    }

    const sheet = openSheet(`
      <h3>دسته‌بندی سریع</h3>
      <div class="detail-amount" style="padding:4px 0 14px;">
        <div class="v ${isDeposit ? 'deposit' : 'withdraw'}" style="font-size:22px;">${isDeposit ? '+' : '−'} ${money(t.amount)}</div>
        <div class="bank-name">${escapeHtml(t.bankName || 'نامشخص')}${t.date ? ' · ' + escapeHtml(t.date) : ''}</div>
      </div>
      <div class="field">
        <label>واحد</label>
        <div class="chip-row" id="qc-units">${unitsChipsHtml()}</div>
        <div id="qc-unit-add-box"></div>
      </div>
      <div class="field">
        <label>دسته‌بندی</label>
        <div class="chip-row" id="qc-cats">${catsChipsHtml()}</div>
        <div id="qc-cat-add-box"></div>
      </div>
      <button class="btn btn-primary" id="qc-submit">${ICON.check} ثبت و انتقال به تراکنش‌ها</button>
      <button class="btn btn-ghost mt-8" id="qc-full-edit">ویرایش کامل تراکنش</button>
    `);

    function bindUnitChips() {
      sheet.querySelectorAll('#qc-units [data-id]').forEach((b) => b.onclick = () => {
        selUnit = (selUnit === Number(b.dataset.id)) ? null : Number(b.dataset.id);
        sheet.querySelectorAll('#qc-units [data-id]').forEach((x) => x.classList.toggle('active', Number(x.dataset.id) === selUnit));
      });
      sheet.querySelector('#qc-add-unit').onclick = () => {
        sheet.querySelector('#qc-unit-add-box').innerHTML = addRowHtml('نام واحد جدید', 'qc-new-unit-save', 'qc-new-unit-name');
        sheet.querySelector('#qc-new-unit-name').focus();
        sheet.querySelector('#qc-new-unit-save').onclick = async () => {
          const name = sheet.querySelector('#qc-new-unit-name').value.trim();
          if (!name) return;
          const newId = await DB.add('units', { name, color: PALETTE[STATE.unitsCache.length % PALETTE.length] });
          STATE.unitsCache = await DB.getAll('units');
          selUnit = newId;
          sheet.querySelector('#qc-units').innerHTML = unitsChipsHtml();
          sheet.querySelector('#qc-unit-add-box').innerHTML = '';
          bindUnitChips();
        };
      };
    }
    function bindCatChips() {
      sheet.querySelectorAll('#qc-cats [data-id]').forEach((b) => b.onclick = () => {
        selCat = (selCat === Number(b.dataset.id)) ? null : Number(b.dataset.id);
        sheet.querySelectorAll('#qc-cats [data-id]').forEach((x) => x.classList.toggle('active', Number(x.dataset.id) === selCat));
      });
      sheet.querySelector('#qc-add-cat').onclick = () => {
        sheet.querySelector('#qc-cat-add-box').innerHTML = addRowHtml('نام دسته‌بندی جدید', 'qc-new-cat-save', 'qc-new-cat-name');
        sheet.querySelector('#qc-new-cat-name').focus();
        sheet.querySelector('#qc-new-cat-save').onclick = async () => {
          const name = sheet.querySelector('#qc-new-cat-name').value.trim();
          if (!name) return;
          const newId = await DB.add('categories', { name, color: PALETTE[(STATE.categoriesCache.length + 1) % PALETTE.length], unitId: null });
          STATE.categoriesCache = await DB.getAll('categories');
          selCat = newId;
          sheet.querySelector('#qc-cats').innerHTML = catsChipsHtml();
          sheet.querySelector('#qc-cat-add-box').innerHTML = '';
          bindCatChips();
        };
      };
    }
    bindUnitChips();
    bindCatChips();

    sheet.querySelector('#qc-submit').onclick = async () => {
      t.unitId = selUnit;
      t.categoryId = selCat;
      t.status = 'reviewed';
      await DB.put('transactions', t);
      closeSheet();
      toast('تراکنش ثبت و دسته‌بندی شد');
      router();
    };
    sheet.querySelector('#qc-full-edit').onclick = () => {
      closeSheet();
      location.hash = `#/transactions/${t.id}`;
    };
  }
  async function renderTransactions() {
    let all = await DB.getAll('transactions');
    all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const f = STATE.txFilter;
    let filtered = all.filter((t) => {
      if (f.status && t.status !== f.status) return false;
      if (f.unitId && t.unitId !== f.unitId) return false;
      if (f.categoryId && t.categoryId !== f.categoryId) return false;
      if (f.q) {
        const q = f.q.toLowerCase();
        const hay = [t.bankName, t.rawText, t.description, t.cardNumber, t.accountNumber, String(t.amount)].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    mountPage(`
      ${topbar('تراکنش‌ها', { subtitle: `${toFa(filtered.length)} مورد` })}
      <input class="search-input" id="tx-search" placeholder="جستجو در مبلغ، بانک، شماره کارت، توضیحات..." value="${escapeHtml(f.q)}" />
      <div class="filter-bar mt-16">
        <button class="icon-btn" id="btn-filter">${ICON.filter}</button>
        ${f.status ? `<span class="chip chip--muted">وضعیت: ${f.status === 'new' ? 'جدید' : 'بررسی‌شده'}</span>` : ''}
        ${f.unitId ? `<span class="chip chip--muted">${escapeHtml(unitName(f.unitId) || '')}</span>` : ''}
        ${f.categoryId ? `<span class="chip chip--muted">${escapeHtml(catName(f.categoryId) || '')}</span>` : ''}
      </div>
      <div class="tx-list mt-16">
        ${filtered.length ? filtered.map(txItemHtml).join('') : emptyInlineHtml('چیزی پیدا نشد', 'فیلتر یا عبارت جستجو را تغییر دهید.')}
      </div>
    `);
    bindTxItemClicks();
    document.getElementById('tx-search').oninput = (e) => { STATE.txFilter.q = e.target.value; renderTransactions(); };
    document.getElementById('btn-filter').onclick = () => openTxFilterSheet();
  }

  function openTxFilterSheet() {
    const f = STATE.txFilter;
    const sheet = openSheet(`
      <h3>فیلتر تراکنش‌ها</h3>
      <div class="field"><label>وضعیت</label>
        <select id="ff-status">
          <option value="">همه</option>
          <option value="new" ${f.status === 'new' ? 'selected' : ''}>جدید</option>
          <option value="reviewed" ${f.status === 'reviewed' ? 'selected' : ''}>بررسی‌شده</option>
        </select>
      </div>
      <div class="field"><label>واحد</label>
        <select id="ff-unit"><option value="">همه</option>${STATE.unitsCache.map((u) => `<option value="${u.id}" ${f.unitId === u.id ? 'selected' : ''}>${escapeHtml(u.name)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>دسته‌بندی</label>
        <select id="ff-cat"><option value="">همه</option>${STATE.categoriesCache.map((c) => `<option value="${c.id}" ${f.categoryId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" id="ff-reset">پاک کردن فیلتر</button>
        <button class="btn btn-primary" id="ff-apply">اعمال</button>
      </div>
    `);
    sheet.querySelector('#ff-apply').onclick = () => {
      STATE.txFilter.status = sheet.querySelector('#ff-status').value || null;
      STATE.txFilter.unitId = Number(sheet.querySelector('#ff-unit').value) || null;
      STATE.txFilter.categoryId = Number(sheet.querySelector('#ff-cat').value) || null;
      closeSheet(); renderTransactions();
    };
    sheet.querySelector('#ff-reset').onclick = () => {
      STATE.txFilter = { status: null, unitId: null, categoryId: null, q: STATE.txFilter.q };
      closeSheet(); renderTransactions();
    };
  }

  /* ================= جزئیات تراکنش ================= */
  async function renderTxDetail(id) {
    const t = await DB.get('transactions', Number(id));
    if (!t) { location.hash = '#/transactions'; return; }
    const isDeposit = t.type === 'deposit';
    mountPage(`
      ${topbar('جزئیات تراکنش', { back: true, actions: `<button class="icon-btn" id="btn-edit">${ICON.edit}</button>` })}
      <div class="card">
        <div class="detail-amount">
          <div class="v ${isDeposit ? 'deposit' : 'withdraw'}">${isDeposit ? '+' : '−'} ${money(t.amount)}</div>
          <div class="bank-name">${escapeHtml(t.bankName || 'نامشخص')}</div>
          <div class="mt-8">${t.status === 'new' ? '<span class="chip chip--new">جدید</span>' : '<span class="chip chip--muted">بررسی‌شده</span>'}</div>
        </div>
        <div class="kv-list mt-16">
          <div class="kv-row"><span class="k">نوع تراکنش</span><span class="v">${isDeposit ? 'واریز' : t.type === 'withdraw' ? 'برداشت' : 'نامشخص'}</span></div>
          <div class="kv-row"><span class="k">مانده حساب</span><span class="v">${t.balanceAfter ? money(t.balanceAfter) : '—'}</span></div>
          <div class="kv-row"><span class="k">شماره کارت/حساب</span><span class="v">${escapeHtml(t.cardNumber || t.accountNumber || '—')}</span></div>
          <div class="kv-row"><span class="k">شماره پیگیری</span><span class="v">${escapeHtml(t.trackingCode || '—')}</span></div>
          <div class="kv-row"><span class="k">تاریخ / ساعت</span><span class="v">${escapeHtml(t.date || '—')} ${escapeHtml(t.time || '')}</span></div>
          <div class="kv-row"><span class="k">تاریخ ثبت در برنامه</span><span class="v">${new Date(t.createdAt).toLocaleString('fa-IR')}</span></div>
          <div class="kv-row"><span class="k">واحد</span><span class="v">${escapeHtml(unitName(t.unitId) || '—')}</span></div>
          <div class="kv-row"><span class="k">دسته‌بندی</span><span class="v">${escapeHtml(catName(t.categoryId) || '—')}</span></div>
          <div class="kv-row"><span class="k">حساب متصل</span><span class="v">${t.accountId && accountOf(t.accountId) ? escapeHtml(accountOf(t.accountId).title || 'حساب') : '—'}</span></div>
        </div>
      </div>

      ${t.description ? `<div class="section-title"><h2>توضیحات</h2></div><div class="card"><p style="font-size:13px; line-height:1.9;">${escapeHtml(t.description)}</p></div>` : ''}
      ${(t.tags && t.tags.length) ? `<div class="section-title"><h2>برچسب‌ها</h2></div><div class="card tags-line">${t.tags.map((tg) => `<span class="chip chip--muted">${escapeHtml(tg)}</span>`).join('')}</div>` : ''}

      ${t.rawText ? `<div class="section-title"><h2>متن کامل پیامک</h2></div><div class="raw-sms-box">${escapeHtml(t.rawText)}</div>` : ''}

      <button class="btn btn-danger mt-24" id="btn-delete-tx">${ICON.trash} حذف تراکنش</button>
    `);
    document.getElementById('btn-edit').onclick = () => location.hash = `#/transactions/edit/${t.id}`;
    document.getElementById('btn-delete-tx').onclick = async () => {
      const ok = await confirmDialog('این تراکنش برای همیشه حذف شود؟');
      if (!ok) return;
      await DB.del('transactions', t.id);
      toast('تراکنش حذف شد');
      location.hash = '#/transactions';
    };
  }

  /* ================= افزودن / ویرایش تراکنش ================= */
  async function renderTxForm(editId) {
    const isEdit = Boolean(editId);
    const existing = isEdit ? await DB.get('transactions', Number(editId)) : null;
    let mode = 'manual'; // manual | sms

    mountPage(`
      ${topbar(isEdit ? 'ویرایش تراکنش' : 'افزودن تراکنش', { back: true })}
      ${!isEdit ? `
      <div class="seg-control mt-8" id="mode-switch">
        <button class="active" data-mode="manual">افزودن دستی</button>
        <button data-mode="sms">استخراج از متن پیامک</button>
      </div>` : ''}

      <div id="sms-box" class="${isEdit ? 'hidden' : 'hidden'} mt-16">
        <div class="field"><label>متن پیامک بانکی را اینجا جای‌گذاری کنید</label>
          <textarea id="sms-text" placeholder="مثلاً: بانک ملت واریز به مبلغ 500000 ریال..."></textarea>
        </div>
        <button class="btn btn-outline" id="btn-parse-sms">${ICON.sms} استخراج اطلاعات</button>
        <p class="text-muted mt-8" style="font-size:11.5px; line-height:1.9;">
          توجه: در نسخه وب PWA، دریافت خودکار پیامک به دلیل محدودیت مرورگر امکان‌پذیر نیست. برای دریافت خودکار،
          از بسته‌بندی Capacitor همراه با افزونه بومی اندروید استفاده کنید (به فایل README مراجعه شود).
        </p>
      </div>

      <form id="tx-form" class="mt-16">
        <div class="field"><label>نوع تراکنش</label>
          <div class="seg-control" id="type-switch">
            <button type="button" class="${(existing?.type !== 'withdraw') ? 'active deposit' : ''}" data-type="deposit">واریز</button>
            <button type="button" class="${(existing?.type === 'withdraw') ? 'active withdraw' : ''}" data-type="withdraw">برداشت</button>
          </div>
        </div>
        <div class="field"><label>بانک</label>
          <input list="bank-list" id="f-bank" value="${escapeHtml(existing?.bankName || '')}" placeholder="مثلاً بانک ملت" />
          <datalist id="bank-list">${SmsParser.BANKS.map((b) => `<option value="${b.name}">`).join('')}</datalist>
        </div>
        <div class="field"><label>حساب/کارت (اختیاری)</label>
          <select id="f-account">
            <option value="">— بدون اتصال به حساب مشخص —</option>
            ${STATE.accountsCache.map((a) => {
              const b = bankOf(a.bankId);
              const label = `${b ? b.name : 'نامشخص'} — ${a.title || 'حساب'}${a.cardNumber ? ' · ' + a.cardNumber : ''}`;
              return `<option value="${a.id}" ${existing?.accountId === a.id ? 'selected' : ''}>${escapeHtml(label)}</option>`;
            }).join('')}
          </select>
          ${STATE.accountsCache.length === 0 ? `<p class="text-muted mt-8" style="font-size:11px;">هنوز حسابی اضافه نکرده‌اید؛ از تنظیمات ← بانک‌ها و حساب‌ها می‌توانید اضافه کنید.</p>` : ''}
        </div>
        <div class="field"><label>مبلغ (تومان)</label>
          <input type="number" id="f-amount" inputmode="numeric" value="${existing ? toman(existing.amount) : ''}" placeholder="0" />
        </div>
        <div class="field"><label>تاریخ</label>
          <input id="f-date" value="${escapeHtml(existing?.date || '')}" placeholder="1403/04/15" />
        </div>
        <div class="field"><label>ساعت</label>
          <input id="f-time" value="${escapeHtml(existing?.time || '')}" placeholder="14:30" />
        </div>
        <div class="field"><label>واحد</label>
          <select id="f-unit"><option value="">— انتخاب کنید —</option>${STATE.unitsCache.map((u) => `<option value="${u.id}" ${existing?.unitId === u.id ? 'selected' : ''}>${escapeHtml(u.name)}</option>`).join('')}</select>
        </div>
        <div class="field"><label>دسته‌بندی</label>
          <select id="f-category"><option value="">— انتخاب کنید —</option>${STATE.categoriesCache.map((c) => `<option value="${c.id}" ${existing?.categoryId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select>
        </div>
        <div class="field"><label>توضیحات</label>
          <textarea id="f-desc">${escapeHtml(existing?.description || '')}</textarea>
        </div>
        <div class="field"><label>برچسب‌ها (با کاما جدا کنید)</label>
          <input id="f-tags" value="${escapeHtml((existing?.tags || []).join('، '))}" placeholder="مثلاً قبض، خانه" />
        </div>
        <button type="submit" class="btn btn-primary mt-8">${ICON.check} ${isEdit ? 'ذخیره تغییرات' : 'ثبت تراکنش'}</button>
      </form>
    `);

    let currentType = existing?.type === 'withdraw' ? 'withdraw' : 'deposit';
    document.querySelectorAll('#type-switch button').forEach((b) => b.onclick = () => {
      currentType = b.dataset.type;
      document.querySelectorAll('#type-switch button').forEach((x) => x.classList.remove('active', 'deposit', 'withdraw'));
      b.classList.add('active', currentType);
    });

    document.getElementById('f-account').onchange = (e) => {
      const acc = accountOf(Number(e.target.value));
      if (acc) document.getElementById('f-bank').value = bankOf(acc.bankId)?.name || document.getElementById('f-bank').value;
    };

    if (!isEdit) {
      document.querySelectorAll('#mode-switch button').forEach((b) => b.onclick = () => {
        mode = b.dataset.mode;
        document.querySelectorAll('#mode-switch button').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        document.getElementById('sms-box').classList.toggle('hidden', mode !== 'sms');
      });

      document.getElementById('btn-parse-sms').onclick = () => {
        const text = document.getElementById('sms-text').value;
        if (!text.trim()) return toast('ابتدا متن پیامک را وارد کنید');
        const parsed = SmsParser.parse(text);
        document.getElementById('f-bank').value = parsed.bankName === 'نامشخص' ? '' : parsed.bankName;
        if (parsed.amount) document.getElementById('f-amount').value = toman(parsed.amount);
        if (parsed.date) document.getElementById('f-date').value = parsed.date;
        if (parsed.time) document.getElementById('f-time').value = parsed.time;
        if (parsed.type !== 'unknown') {
          currentType = parsed.type;
          document.querySelectorAll('#type-switch button').forEach((x) => {
            x.classList.toggle('active', x.dataset.type === parsed.type);
            x.classList.toggle(parsed.type, x.dataset.type === parsed.type);
          });
        }
        const matchedAccount = STATE.accountsCache.find((a) =>
          (parsed.cardNumber && a.cardNumber && a.cardNumber.replace(/[^\d]/g, '').slice(-4) === parsed.cardNumber.replace(/[^\d]/g, '').slice(-4)) ||
          (parsed.accountNumber && a.accountNumber && a.accountNumber === parsed.accountNumber)
        );
        if (matchedAccount) {
          document.getElementById('f-account').value = matchedAccount.id;
          document.getElementById('f-bank').value = bankOf(matchedAccount.bankId)?.name || document.getElementById('f-bank').value;
        }
        toast(parsed.recognized ? 'اطلاعات با موفقیت استخراج شد' : 'برخی اطلاعات پیدا نشد؛ لطفاً دستی تکمیل کنید');
      };
    }

    document.getElementById('tx-form').onsubmit = async (e) => {
      e.preventDefault();
      const bankName = document.getElementById('f-bank').value.trim();
      const amountToman = Number(document.getElementById('f-amount').value);
      if (!bankName) return markError('f-bank', 'نام بانک را وارد کنید');
      if (!amountToman || amountToman <= 0) return markError('f-amount', 'مبلغ معتبر وارد کنید');

      const tags = document.getElementById('f-tags').value.split('،').map((s) => s.trim()).filter(Boolean);
      const record = {
        bankName,
        type: currentType,
        amount: amountToman * 10,
        balanceAfter: existing?.balanceAfter || null,
        cardNumber: existing?.cardNumber || null,
        accountNumber: existing?.accountNumber || null,
        trackingCode: existing?.trackingCode || null,
        accountId: Number(document.getElementById('f-account').value) || null,
        date: document.getElementById('f-date').value.trim() || new Date().toLocaleDateString('fa-IR'),
        time: document.getElementById('f-time').value.trim(),
        rawText: existing?.rawText || (mode === 'sms' ? document.getElementById('sms-text')?.value.trim() : ''),
        recognized: true,
        status: 'reviewed',
        unitId: Number(document.getElementById('f-unit').value) || null,
        categoryId: Number(document.getElementById('f-category').value) || null,
        description: document.getElementById('f-desc').value.trim(),
        tags,
        createdAt: existing?.createdAt || new Date().toISOString(),
      };

      if (isEdit) { record.id = existing.id; await DB.put('transactions', record); toast('تغییرات ذخیره شد'); location.hash = `#/transactions/${existing.id}`; }
      else { const id = await DB.add('transactions', record); toast('تراکنش ثبت شد'); location.hash = `#/transactions/${id}`; }
    };
  }

  function markError(fieldId, msg) {
    const input = document.getElementById(fieldId);
    input.closest('.field').classList.add('has-error');
    let err = input.closest('.field').querySelector('.field-error');
    if (!err) { err = document.createElement('div'); err.className = 'field-error'; input.closest('.field').appendChild(err); }
    err.textContent = msg;
    input.focus();
  }

  /* ================= گزارش‌ها ================= */
  async function renderReports() {
    const all = await DB.getAll('transactions');
    mountPage(`
      ${topbar('گزارش‌ها', { subtitle: 'فیلتر کنید و خروجی بگیرید' })}
      <div class="card">
        <div class="field"><label>بانک</label>
          <select id="r-bank"><option value="">همه بانک‌ها</option>${[...new Set(all.map((t) => t.bankName))].map((b) => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join('')}</select>
        </div>
        <div class="field"><label>واحد</label>
          <select id="r-unit"><option value="">همه واحدها</option>${STATE.unitsCache.map((u) => `<option value="${u.id}">${escapeHtml(u.name)}</option>`).join('')}</select>
        </div>
        <div class="field"><label>دسته‌بندی</label>
          <select id="r-cat"><option value="">همه دسته‌ها</option>${STATE.categoriesCache.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</select>
        </div>
        <div class="field"><label>نوع تراکنش</label>
          <select id="r-type"><option value="">همه</option><option value="deposit">واریز</option><option value="withdraw">برداشت</option></select>
        </div>
        <div class="field"><label>جستجوی متنی</label><input id="r-q" placeholder="در متن پیامک، توضیحات و..." /></div>
        <button class="btn btn-primary" id="r-run">اجرای گزارش</button>
      </div>

      <div id="r-results" class="mt-24"></div>
    `);

    document.getElementById('r-run').onclick = async () => {
      const bank = document.getElementById('r-bank').value;
      const unitId = Number(document.getElementById('r-unit').value) || null;
      const categoryId = Number(document.getElementById('r-cat').value) || null;
      const type = document.getElementById('r-type').value;
      const q = document.getElementById('r-q').value.toLowerCase();

      const results = all.filter((t) => {
        if (bank && t.bankName !== bank) return false;
        if (unitId && t.unitId !== unitId) return false;
        if (categoryId && t.categoryId !== categoryId) return false;
        if (type && t.type !== type) return false;
        if (q) {
          const hay = [t.bankName, t.rawText, t.description].join(' ').toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

      const sum = results.reduce((s, t) => s + (t.type === 'deposit' ? t.amount : -t.amount), 0);
      const box = document.getElementById('r-results');
      box.innerHTML = `
        <div class="section-title"><h2>${toFa(results.length)} نتیجه — تراز: ${toFa(toman(sum))} تومان</h2></div>
        <div class="btn-row mt-8 mb-8" style="margin-bottom:14px;">
          <button class="btn btn-ghost" id="exp-csv">${ICON.export} CSV</button>
          <button class="btn btn-ghost" id="exp-json">${ICON.export} JSON</button>
          <button class="btn btn-ghost" id="exp-print">${ICON.export} چاپ / PDF</button>
        </div>
        <div class="tx-list">${results.map(txItemHtml).join('') || emptyInlineHtml('نتیجه‌ای یافت نشد', 'فیلترها را تغییر دهید.')}</div>
      `;
      bindTxItemClicks();
      document.getElementById('exp-csv').onclick = () => exportCsv(results);
      document.getElementById('exp-json').onclick = () => exportJson(results);
      document.getElementById('exp-print').onclick = () => printReport(results, sum);
    };
  }

  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function exportCsv(rows) {
    const headers = ['بانک', 'نوع', 'مبلغ (تومان)', 'تاریخ', 'ساعت', 'واحد', 'دسته‌بندی', 'توضیحات', 'شماره پیگیری'];
    const lines = [headers.join(',')];
    rows.forEach((t) => {
      lines.push([
        t.bankName, t.type === 'deposit' ? 'واریز' : 'برداشت', toman(t.amount), t.date || '', t.time || '',
        unitName(t.unitId) || '', catName(t.categoryId) || '', (t.description || '').replace(/,/g, ' '), t.trackingCode || '',
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    });
    downloadBlob('\uFEFF' + lines.join('\n'), 'گزارش-تراکنش‌ها.csv', 'text/csv;charset=utf-8');
    toast('فایل CSV دانلود شد');
  }

  function exportJson(rows) {
    downloadBlob(JSON.stringify(rows, null, 2), 'گزارش-تراکنش‌ها.json', 'application/json');
    toast('فایل JSON دانلود شد');
  }

  function printReport(rows, sum) {
    const w = window.open('', '_blank');
    w.document.write(`
      <html dir="rtl"><head><meta charset="utf-8"><title>گزارش تراکنش‌ها</title>
      <style>body{font-family:Tahoma,sans-serif;padding:20px} table{width:100%;border-collapse:collapse} td,th{border:1px solid #ccc;padding:6px;font-size:12px} th{background:#eee}</style>
      </head><body>
      <h2>گزارش تراکنش‌ها</h2>
      <p>تعداد: ${rows.length} — تراز: ${toman(sum).toLocaleString('fa-IR')} تومان</p>
      <table><tr><th>بانک</th><th>نوع</th><th>مبلغ (تومان)</th><th>تاریخ</th><th>واحد</th><th>دسته‌بندی</th></tr>
      ${rows.map((t) => `<tr><td>${t.bankName}</td><td>${t.type === 'deposit' ? 'واریز' : 'برداشت'}</td><td>${toman(t.amount).toLocaleString('fa-IR')}</td><td>${t.date || ''}</td><td>${unitName(t.unitId) || ''}</td><td>${catName(t.categoryId) || ''}</td></tr>`).join('')}
      </table></body></html>
    `);
    w.document.close(); w.print();
  }

  /* ================= مدیریت واحدها ================= */
  async function renderUnits() {
    const units = await DB.getAll('units');
    mountPage(`
      ${topbar('مدیریت واحدها', { back: true })}
      <ul class="tx-list">
        ${units.map((u) => `
          <li class="tx-item" data-id="${u.id}">
            <div class="avatar" style="background:${u.color}">${u.name.slice(0, 1)}</div>
            <div class="info"><div class="bank">${escapeHtml(u.name)}</div></div>
            <button class="icon-btn btn-edit-unit" data-id="${u.id}">${ICON.edit}</button>
            <button class="icon-btn btn-del-unit" data-id="${u.id}">${ICON.trash}</button>
          </li>`).join('') || emptyInlineHtml('واحدی ثبت نشده', 'با دکمه پایین، اولین واحد را اضافه کنید.')}
      </ul>
      <button class="btn btn-primary mt-24" id="add-unit">${ICON.plus} افزودن واحد</button>
    `);
    document.getElementById('add-unit').onclick = () => unitEditorSheet();
    document.querySelectorAll('.btn-edit-unit').forEach((b) => b.onclick = async (e) => { e.stopPropagation(); unitEditorSheet(await DB.get('units', Number(b.dataset.id))); });
    document.querySelectorAll('.btn-del-unit').forEach((b) => b.onclick = async (e) => {
      e.stopPropagation();
      const ok = await confirmDialog('این واحد حذف شود؟ تراکنش‌های مرتبط بدون واحد باقی می‌مانند.');
      if (!ok) return;
      await DB.del('units', Number(b.dataset.id)); toast('حذف شد'); renderUnits();
    });
  }

  const PALETTE = ['#114B4F', '#C99A3E', '#2E7D5B', '#B4433B', '#3E7CB1', '#8A5FB0', '#5B8C7B', '#B0793E'];

  function unitEditorSheet(existing) {
    const sheet = openSheet(`
      <h3>${existing ? 'ویرایش واحد' : 'واحد جدید'}</h3>
      <div class="field"><label>نام واحد</label><input id="u-name" value="${escapeHtml(existing?.name || '')}" placeholder="مثلاً فروش" /></div>
      <div class="field"><label>رنگ</label><div class="color-dot-list" id="u-colors">${PALETTE.map((c) => `<span class="color-dot ${existing?.color === c ? 'active' : ''}" style="background:${c}" data-color="${c}"></span>`).join('')}</div></div>
      <button class="btn btn-primary" id="u-save">ذخیره</button>
    `);
    let color = existing?.color || PALETTE[0];
    sheet.querySelectorAll('.color-dot').forEach((d) => d.onclick = () => { color = d.dataset.color; sheet.querySelectorAll('.color-dot').forEach((x) => x.classList.remove('active')); d.classList.add('active'); });
    sheet.querySelector('#u-save').onclick = async () => {
      const name = sheet.querySelector('#u-name').value.trim();
      if (!name) return toast('نام واحد را وارد کنید');
      if (existing) await DB.put('units', { ...existing, name, color });
      else await DB.add('units', { name, color });
      closeSheet(); toast('ذخیره شد'); renderUnits();
    };
  }

  /* ================= مدیریت دسته‌بندی‌ها ================= */
  async function renderCategories() {
    const cats = await DB.getAll('categories');
    mountPage(`
      ${topbar('مدیریت دسته‌بندی‌ها', { back: true })}
      <ul class="tx-list">
        ${cats.map((c) => `
          <li class="tx-item" data-id="${c.id}">
            <div class="avatar" style="background:${c.color}">${c.name.slice(0, 1)}</div>
            <div class="info"><div class="bank">${escapeHtml(c.name)}</div></div>
            <button class="icon-btn btn-edit-cat" data-id="${c.id}">${ICON.edit}</button>
            <button class="icon-btn btn-del-cat" data-id="${c.id}">${ICON.trash}</button>
          </li>`).join('') || emptyInlineHtml('دسته‌بندی ثبت نشده', 'با دکمه پایین، اولین دسته را اضافه کنید.')}
      </ul>
      <button class="btn btn-primary mt-24" id="add-cat">${ICON.plus} افزودن دسته‌بندی</button>
    `);
    document.getElementById('add-cat').onclick = () => catEditorSheet();
    document.querySelectorAll('.btn-edit-cat').forEach((b) => b.onclick = async (e) => { e.stopPropagation(); catEditorSheet(await DB.get('categories', Number(b.dataset.id))); });
    document.querySelectorAll('.btn-del-cat').forEach((b) => b.onclick = async (e) => {
      e.stopPropagation();
      const ok = await confirmDialog('این دسته‌بندی حذف شود؟');
      if (!ok) return;
      await DB.del('categories', Number(b.dataset.id)); toast('حذف شد'); renderCategories();
    });
  }

  function catEditorSheet(existing) {
    const sheet = openSheet(`
      <h3>${existing ? 'ویرایش دسته‌بندی' : 'دسته‌بندی جدید'}</h3>
      <div class="field"><label>نام دسته‌بندی</label><input id="c-name" value="${escapeHtml(existing?.name || '')}" placeholder="مثلاً قبوض" /></div>
      <div class="field"><label>واحد مرتبط (اختیاری)</label>
        <select id="c-unit"><option value="">—</option>${STATE.unitsCache.map((u) => `<option value="${u.id}" ${existing?.unitId === u.id ? 'selected' : ''}>${escapeHtml(u.name)}</option>`).join('')}</select>
      </div>
      <div class="field"><label>رنگ</label><div class="color-dot-list" id="c-colors">${PALETTE.map((c) => `<span class="color-dot ${existing?.color === c ? 'active' : ''}" style="background:${c}" data-color="${c}"></span>`).join('')}</div></div>
      <button class="btn btn-primary" id="c-save">ذخیره</button>
    `);
    let color = existing?.color || PALETTE[1];
    sheet.querySelectorAll('.color-dot').forEach((d) => d.onclick = () => { color = d.dataset.color; sheet.querySelectorAll('.color-dot').forEach((x) => x.classList.remove('active')); d.classList.add('active'); });
    sheet.querySelector('#c-save').onclick = async () => {
      const name = sheet.querySelector('#c-name').value.trim();
      if (!name) return toast('نام دسته‌بندی را وارد کنید');
      const unitId = Number(sheet.querySelector('#c-unit').value) || null;
      if (existing) await DB.put('categories', { ...existing, name, color, unitId });
      else await DB.add('categories', { name, color, unitId });
      closeSheet(); toast('ذخیره شد'); renderCategories();
    };
  }

  /* ================= مدیریت بانک‌ها و حساب‌ها ================= */
  async function renderBanks() {
    const banks = STATE.banksCache;
    const accounts = STATE.accountsCache;
    const allTx = await DB.getAll('transactions');

    const totalBalance = accounts.reduce((s, a) => s + accountBalance(a.id, allTx), 0);

    mountPage(`
      ${topbar('بانک‌ها و حساب‌ها', { back: true, subtitle: `${toFa(banks.length)} بانک · ${toFa(accounts.length)} حساب/کارت` })}

      <div class="balance-hero">
        <div class="label">مجموع موجودی همه حساب‌ها</div>
        <div class="amount">${toFa(toman(totalBalance))} <small>تومان</small></div>
      </div>

      <div class="section-title"><h2>بانک‌های شما</h2></div>
      <div id="banks-list">
        ${banks.length ? banks.map((b) => bankCardHtml(b, accounts.filter((a) => a.bankId === b.id), allTx)).join('') : emptyInlineHtml('هنوز بانکی اضافه نشده', 'با دکمه‌ی زیر، اولین بانک و حساب/کارت خود را اضافه کنید.')}
      </div>

      <button class="btn btn-primary mt-24" id="add-bank">${ICON.plus} افزودن بانک جدید</button>
    `);

    document.getElementById('add-bank').onclick = () => bankEditorSheet();
    bindBankCardEvents();
  }

  function bankCardHtml(bank, bankAccounts, allTx) {
    const bankTotal = bankAccounts.reduce((s, a) => s + accountBalance(a.id, allTx), 0);
    return `
      <div class="card" data-bank-id="${bank.id}" style="margin-bottom:12px;">
        <div class="settings-row" style="padding-top:0;">
          <div class="ic" style="background:${bank.color}22; color:${bank.color}">${ICON.bank}</div>
          <div class="txt">
            <div class="t">${escapeHtml(bank.name)}</div>
            <div class="d">${bankAccounts.length ? `${toFa(bankAccounts.length)} حساب/کارت — مجموع ${toFa(toman(bankTotal))} تومان` : 'بدون حساب ثبت‌شده'}</div>
          </div>
          <button class="icon-btn btn-edit-bank" data-id="${bank.id}">${ICON.edit}</button>
          <button class="icon-btn btn-del-bank" data-id="${bank.id}">${ICON.trash}</button>
        </div>
        ${bankAccounts.length ? `
        <div class="kv-list mt-8">
          ${bankAccounts.map((a) => `
            <div class="kv-row" data-account-id="${a.id}" style="align-items:center; cursor:pointer;">
              <span class="k" style="display:flex; align-items:center; gap:8px;">${ICON.card}
                <span>${escapeHtml(a.title || 'حساب بدون عنوان')}${a.cardNumber ? ` · ${escapeHtml(a.cardNumber)}` : ''}</span>
              </span>
              <span class="v">${toFa(toman(accountBalance(a.id, allTx)))} تومان</span>
            </div>
          `).join('')}
        </div>` : ''}
        <button class="btn btn-outline mt-8 btn-add-account" data-bank-id="${bank.id}">${ICON.plus} افزودن حساب/کارت به این بانک</button>
      </div>
    `;
  }

  function bindBankCardEvents() {
    document.querySelectorAll('.btn-edit-bank').forEach((b) => b.onclick = async (e) => { e.stopPropagation(); bankEditorSheet(await DB.get('banks', Number(b.dataset.id))); });
    document.querySelectorAll('.btn-del-bank').forEach((b) => b.onclick = async (e) => {
      e.stopPropagation();
      const relatedAccounts = STATE.accountsCache.filter((a) => a.bankId === Number(b.dataset.id));
      const msg = relatedAccounts.length
        ? `این بانک ${toFa(relatedAccounts.length)} حساب/کارت ثبت‌شده دارد. با حذف بانک، حساب‌های آن نیز حذف می‌شوند (تراکنش‌های مرتبط باقی می‌مانند ولی بدون حساب). ادامه می‌دهید؟`
        : 'این بانک حذف شود؟';
      const ok = await confirmDialog(msg);
      if (!ok) return;
      for (const acc of relatedAccounts) await DB.del('accounts', acc.id);
      await DB.del('banks', Number(b.dataset.id));
      toast('حذف شد'); router();
    });
    document.querySelectorAll('.btn-add-account').forEach((b) => b.onclick = (e) => { e.stopPropagation(); accountEditorSheet(null, Number(b.dataset.bankId)); });
    document.querySelectorAll('[data-account-id]').forEach((row) => row.onclick = async () => {
      const acc = await DB.get('accounts', Number(row.dataset.accountId));
      accountEditorSheet(acc, acc.bankId);
    });
  }

  function bankEditorSheet(existing) {
    const sheet = openSheet(`
      <h3>${existing ? 'ویرایش بانک' : 'افزودن بانک جدید'}</h3>
      <div class="field"><label>نام بانک</label>
        <input list="bank-known-list" id="bk-name" value="${escapeHtml(existing?.name || '')}" placeholder="مثلاً بانک ملت، یا نام بانک/موسسه دلخواه" />
        <datalist id="bank-known-list">${SmsParser.BANKS.map((b) => `<option value="${b.name}">`).join('')}</datalist>
      </div>
      <div class="field"><label>رنگ اختصاصی</label><div class="color-dot-list" id="bk-colors">${PALETTE.map((c) => `<span class="color-dot ${existing?.color === c ? 'active' : ''}" style="background:${c}" data-color="${c}"></span>`).join('')}</div></div>
      <button class="btn btn-primary" id="bk-save">ذخیره بانک</button>
      ${existing ? '' : '<p class="text-muted mt-8" style="font-size:11.5px; line-height:1.9;">بعد از ذخیره‌ی بانک، می‌توانید حساب یا کارت آن را به‌همراه موجودی اولیه اضافه کنید.</p>'}
    `);
    let color = existing?.color || PALETTE[STATE.banksCache.length % PALETTE.length];
    sheet.querySelectorAll('.color-dot').forEach((d) => d.onclick = () => { color = d.dataset.color; sheet.querySelectorAll('.color-dot').forEach((x) => x.classList.remove('active')); d.classList.add('active'); });
    sheet.querySelector('#bk-save').onclick = async () => {
      const name = sheet.querySelector('#bk-name').value.trim();
      if (!name) return toast('نام بانک را وارد کنید');
      let bankId;
      if (existing) { await DB.put('banks', { ...existing, name, color }); bankId = existing.id; }
      else { bankId = await DB.add('banks', { name, color }); }
      closeSheet(); toast('بانک ذخیره شد');
      await refreshLookups();
      if (!existing) accountEditorSheet(null, bankId);
      else router();
    };
  }

  const ACCOUNT_TYPES = [
    ['checking', 'حساب جاری'],
    ['savings', 'حساب پس‌انداز'],
    ['card', 'کارت بانکی'],
    ['currency', 'حساب ارزی'],
  ];

  function accountEditorSheet(existing, bankId) {
    const bank = bankOf(bankId);
    const sheet = openSheet(`
      <h3>${existing ? 'ویرایش حساب/کارت' : 'افزودن حساب/کارت جدید'}</h3>
      ${bank ? `<p class="text-muted mt-8" style="font-size:12px; margin-bottom:10px;">بانک: <b style="color:var(--text)">${escapeHtml(bank.name)}</b></p>` : ''}
      <div class="field"><label>عنوان حساب (اختیاری)</label>
        <input id="ac-title" value="${escapeHtml(existing?.title || '')}" placeholder="مثلاً حساب اصلی، کارت درآمد پروژه..." />
      </div>
      <div class="field"><label>نوع حساب</label>
        <select id="ac-type">${ACCOUNT_TYPES.map(([v, l]) => `<option value="${v}" ${existing?.accountType === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </div>
      <div class="field"><label>شماره کارت</label>
        <input id="ac-card" value="${escapeHtml(existing?.cardNumber || '')}" placeholder="مثلاً 6274-XXXX-XXXX-1234" />
      </div>
      <div class="field"><label>شماره حساب</label>
        <input id="ac-account" value="${escapeHtml(existing?.accountNumber || '')}" placeholder="شماره حساب بانکی" />
      </div>
      <div class="field"><label>شماره شبا (IBAN)</label>
        <input id="ac-iban" value="${escapeHtml(existing?.iban || '')}" placeholder="IR..." />
      </div>
      <div class="field"><label>موجودی اولیه (تومان)</label>
        <input type="number" id="ac-balance" inputmode="numeric" value="${existing ? toman(existing.initialBalance) : ''}" placeholder="0" />
        <p class="text-muted" style="font-size:11px; margin-top:6px; line-height:1.8;">موجودی فعلی این حساب = موجودی اولیه + مجموع تراکنش‌هایی که به این حساب متصل کنید.</p>
      </div>
      <div class="btn-row">
        ${existing ? `<button type="button" class="btn btn-danger" id="ac-delete">${ICON.trash} حذف حساب</button>` : ''}
        <button type="button" class="btn btn-primary" id="ac-save">ذخیره حساب</button>
      </div>
    `);
    sheet.querySelector('#ac-save').onclick = async () => {
      const title = sheet.querySelector('#ac-title').value.trim();
      const accountType = sheet.querySelector('#ac-type').value;
      const cardNumber = sheet.querySelector('#ac-card').value.trim();
      const accountNumber = sheet.querySelector('#ac-account').value.trim();
      const iban = sheet.querySelector('#ac-iban').value.trim();
      const initialBalanceToman = Number(sheet.querySelector('#ac-balance').value) || 0;
      const record = {
        bankId, title, accountType, cardNumber, accountNumber, iban,
        initialBalance: initialBalanceToman * 10,
      };
      if (existing) await DB.put('accounts', { ...existing, ...record });
      else await DB.add('accounts', record);
      closeSheet(); toast('حساب ذخیره شد');
      await refreshLookups(); router();
    };
    if (existing) {
      sheet.querySelector('#ac-delete').onclick = async () => {
        const ok = await confirmDialog('این حساب حذف شود؟ تراکنش‌های مرتبط بدون حساب باقی می‌مانند.');
        if (!ok) return;
        await DB.del('accounts', existing.id);
        closeSheet(); toast('حساب حذف شد');
        await refreshLookups(); router();
      };
    }
  }

  /* ================= تنظیمات ================= */
  async function renderSettings() {
    const smsEnabled = (await DB.get('settings', 'smsEnabled'))?.value ?? true;
    const notifEnabled = (await DB.get('settings', 'notifEnabled'))?.value ?? true;
    const theme = document.documentElement.dataset.theme || 'light';
    const pinSet = Boolean((await DB.get('settings', 'pin'))?.value);

    mountPage(`
      ${topbar('تنظیمات')}
      <div class="card">
        <div class="settings-row">
          <div class="ic">${ICON.sms}</div>
          <div class="txt"><div class="t">دریافت پیامک بانکی</div><div class="d">استخراج خودکار تراکنش از پیامک (نیازمند اپ Capacitor)</div></div>
          <label class="switch"><input type="checkbox" id="sw-sms" ${smsEnabled ? 'checked' : ''}/><span class="track"></span></label>
        </div>
        <div class="settings-row">
          <div class="ic">${ICON.bell}</div>
          <div class="txt"><div class="t">اعلان تراکنش جدید</div><div class="d">نمایش نوتیفیکیشن هنگام ثبت تراکنش جدید</div></div>
          <label class="switch"><input type="checkbox" id="sw-notif" ${notifEnabled ? 'checked' : ''}/><span class="track"></span></label>
        </div>
        <div class="settings-row">
          <div class="ic">${ICON.theme}</div>
          <div class="txt"><div class="t">تم تاریک</div><div class="d">تغییر ظاهر برنامه</div></div>
          <label class="switch"><input type="checkbox" id="sw-theme" ${theme === 'dark' ? 'checked' : ''}/><span class="track"></span></label>
        </div>
        <div class="settings-row">
          <div class="ic">${ICON.lock}</div>
          <div class="txt"><div class="t">رمز عبور برنامه (PIN)</div><div class="d">${pinSet ? 'فعال است' : 'غیرفعال'}</div></div>
          <button class="icon-btn" id="btn-pin">${ICON.chevronL}</button>
        </div>
      </div>

      <div class="section-title"><h2>مدیریت داده</h2></div>
      <div class="card">
        <div class="settings-row" id="row-banks"><div class="ic">${ICON.bank}</div><div class="txt"><div class="t">بانک‌ها و حساب‌ها</div><div class="d">افزودن بانک، کارت/حساب و موجودی اولیه</div></div><button class="icon-btn">${ICON.chevronL}</button></div>
        <div class="settings-row" id="row-units"><div class="ic">${ICON.layers}</div><div class="txt"><div class="t">مدیریت واحدها</div></div><button class="icon-btn">${ICON.chevronL}</button></div>
        <div class="settings-row" id="row-cats"><div class="ic">${ICON.tag}</div><div class="txt"><div class="t">مدیریت دسته‌بندی‌ها</div></div><button class="icon-btn">${ICON.chevronL}</button></div>
        <div class="settings-row" id="row-backup"><div class="ic">${ICON.backup}</div><div class="txt"><div class="t">پشتیبان‌گیری و بازیابی</div></div><button class="icon-btn">${ICON.chevronL}</button></div>
      </div>

      <div class="section-title"><h2>امنیت و حریم خصوصی</h2></div>
      <div class="card">
        <div class="settings-row"><div class="ic">${ICON.shield}</div><div class="txt"><div class="t">ذخیره‌سازی کاملاً محلی</div><div class="d">تمام داده‌ها فقط روی همین دستگاه ذخیره می‌شوند و هیچ درخواستی به اینترنت ارسال نمی‌شود.</div></div></div>
      </div>

      <button class="btn btn-danger mt-24" id="btn-wipe">${ICON.trash} پاک‌سازی کامل داده‌ها</button>
      <p class="text-muted mt-16" style="font-size:11px; text-align:center;">نسخه ۱.۰.۰ — دفتر تراکنش</p>
    `);

    document.getElementById('sw-sms').onchange = (e) => DB.put('settings', { key: 'smsEnabled', value: e.target.checked });
    document.getElementById('sw-notif').onchange = (e) => DB.put('settings', { key: 'notifEnabled', value: e.target.checked });
    document.getElementById('sw-theme').onchange = (e) => {
      const t = e.target.checked ? 'dark' : 'light';
      document.documentElement.dataset.theme = t;
      DB.put('settings', { key: 'theme', value: t });
    };
    document.getElementById('btn-pin').onclick = () => pinSetupSheet(pinSet);
    document.getElementById('row-banks').onclick = () => location.hash = '#/banks';
    document.getElementById('row-units').onclick = () => location.hash = '#/units';
    document.getElementById('row-cats').onclick = () => location.hash = '#/categories';
    document.getElementById('row-backup').onclick = () => location.hash = '#/backup';
    document.getElementById('btn-wipe').onclick = async () => {
      const ok = await confirmDialog('همه داده‌ها (تراکنش‌ها، واحدها، دسته‌بندی‌ها) برای همیشه پاک شوند؟');
      if (!ok) return;
      await DB.wipeAll();
      toast('داده‌ها پاک شدند');
      location.hash = '#/dashboard';
      router();
    };
  }

  function pinSetupSheet(pinSet) {
    const sheet = openSheet(`
      <h3>${pinSet ? 'تغییر یا غیرفعال‌سازی رمز' : 'تنظیم رمز عبور ۴ رقمی'}</h3>
      <div class="field"><label>رمز جدید (۴ رقم) — خالی بگذارید برای غیرفعال‌سازی</label>
        <input id="pin-input" inputmode="numeric" maxlength="4" placeholder="••••" />
      </div>
      <button class="btn btn-primary" id="pin-save">ذخیره</button>
    `);
    sheet.querySelector('#pin-save').onclick = async () => {
      const v = SmsParser.toLatinDigits(sheet.querySelector('#pin-input').value.trim());
      if (v && !/^\d{4}$/.test(v)) return toast('رمز باید دقیقاً ۴ رقم باشد');
      await DB.put('settings', { key: 'pin', value: v || null });
      toast(v ? 'رمز عبور فعال شد' : 'رمز عبور غیرفعال شد');
      closeSheet(); renderSettings();
    };
  }

  /* ================= پشتیبان‌گیری ================= */
  async function renderBackup() {
    mountPage(`
      ${topbar('پشتیبان‌گیری', { back: true })}
      <div class="card">
        <div class="settings-row">
          <div class="ic">${ICON.export}</div>
          <div class="txt"><div class="t">تهیه فایل پشتیبان</div><div class="d">خروجی کامل دیتابیس به‌صورت فایل JSON روی گوشی</div></div>
        </div>
        <button class="btn btn-primary mt-8" id="btn-export">${ICON.backup} دانلود نسخه پشتیبان</button>
      </div>

      <div class="card mt-16">
        <div class="settings-row">
          <div class="ic">${ICON.backup}</div>
          <div class="txt"><div class="t">بازیابی از فایل پشتیبان</div><div class="d">اطلاعات فعلی با محتوای فایل جایگزین می‌شود</div></div>
        </div>
        <input type="file" id="restore-file" accept="application/json" class="hidden" />
        <button class="btn btn-outline mt-8" id="btn-restore">انتخاب فایل و بازیابی</button>
      </div>
    `);

    document.getElementById('btn-export').onclick = async () => {
      const data = await DB.exportAll();
      downloadBlob(JSON.stringify(data, null, 2), `backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
      await DB.add('backups', { createdAt: new Date().toISOString() });
      toast('نسخه پشتیبان دانلود شد');
    };
    document.getElementById('btn-restore').onclick = () => document.getElementById('restore-file').click();
    document.getElementById('restore-file').onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const ok = await confirmDialog('بازیابی، تمام داده‌های فعلی را بازنویسی می‌کند. ادامه می‌دهید؟');
      if (!ok) return;
      const text = await file.text();
      try {
        const data = JSON.parse(text);
        await DB.importAll(data);
        toast('بازیابی با موفقیت انجام شد');
        location.hash = '#/dashboard'; router();
      } catch (err) {
        toast('فایل پشتیبان معتبر نیست');
      }
    };
  }

  /* ---------------- اتصال اختیاری به افزونه بومی دریافت پیامک (فقط داخل بسته Capacitor) ---------------- */

  // یک پیامک خام را پردازش و به‌عنوان تراکنش «جدید» در کارتابل ثبت می‌کند
  async function ingestRawSms(body) {
    const parsed = SmsParser.parse(body || '');
    await DB.add('transactions', {
      ...parsed, status: 'new', unitId: null, categoryId: null, accountId: null,
      description: '', tags: [], createdAt: new Date().toISOString(),
    });
    const notifEnabled = (await DB.get('settings', 'notifEnabled'))?.value ?? true;
    if (notifEnabled && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('تراکنش جدید', { body: `${parsed.bankName} — ${toFa(toman(parsed.amount || 0))} تومان` });
    }
    return parsed;
  }

  // پیامک‌هایی که وقتی برنامه کاملاً بسته بود توسط گیرنده‌ی ایستا (SmsBroadcastReceiver.kt)
  // در سمت اندروید ذخیره شده‌اند را می‌خواند و به دیتابیس محلی اضافه می‌کند.
  // باید در ابتدای اجرا و هر بار که برنامه به foreground برمی‌گردد صدا زده شود.
  async function drainPendingNativeSms() {
    const plugin = window.Capacitor?.Plugins?.SmsReceiver;
    if (!plugin || typeof plugin.getPendingSms !== 'function') return;
    try {
      const res = await plugin.getPendingSms();
      const items = res?.items || [];
      if (!items.length) return;
      for (const item of items) await ingestRawSms(item.body);
      toast(`${toFa(items.length)} پیامک بانکی جدید پردازش شد`);
      router();
    } catch (e) { /* افزونه در دسترس نیست یا خطای غیرمنتظره */ }
  }

  async function connectNativeSmsIfAvailable() {
    const plugin = window.Capacitor?.Plugins?.SmsReceiver;
    if (!plugin) return; // در نسخه وب PWA این افزونه وجود ندارد؛ کاملاً طبیعی است
    const enabled = (await DB.get('settings', 'smsEnabled'))?.value ?? true;
    if (!enabled) return;
    try {
      await plugin.requestSmsPermission();

      // ۱) هر پیامکی که وقتی برنامه بسته بود دریافت شده، همین الان پردازش شود
      await drainPendingNativeSms();

      // ۲) از این لحظه به بعد، هر بار پیامکی برسد (چه برنامه باز باشد چه در پس‌زمینه)،
      // سمت اندروید یک «زنگ خبر» بی‌محتوا می‌فرستد. تراکنش هرگز مستقیماً از روی
      // این رویداد ساخته نمی‌شود — تنها کاری که می‌کند این است که همین الان یک بار
      // دیگر صفِ SharedPreferences را (که SmsBroadcastReceiver.kt پر کرده) بخوانیم.
      // این یعنی همیشه یک مسیر واحد برای نوشتن در دیتابیس وجود دارد، نه دو مسیر
      // مستقل که ممکن است با هم ناهم‌خوان شوند.
      plugin.addListener('smsReceived', () => {
        // کمی تأخیر برای اطمینان از اینکه گیرنده‌ی ایستا نوشتن در صف را تمام کرده
        setTimeout(() => drainPendingNativeSms(), 400);
      });

      // ۳) هر بار برنامه از پس‌زمینه به foreground برمی‌گردد هم صف را بررسی کن
      const appPlugin = window.Capacitor?.Plugins?.App;
      if (appPlugin?.addListener) {
        appPlugin.addListener('resume', () => drainPendingNativeSms());
      }
    } catch (e) { /* کاربر مجوز را رد کرده یا افزونه در دسترس نیست */ }
  }

  /* ---------------- شروع برنامه ---------------- */
  async function init() {
    const savedTheme = (await DB.get('settings', 'theme'))?.value;
    if (savedTheme) document.documentElement.dataset.theme = savedTheme;
    await Seed.run();
    window.addEventListener('hashchange', router);
    await router();
    connectNativeSmsIfAvailable();
  }

  return { init, router };
})();
