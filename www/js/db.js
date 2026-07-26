/*
  db.js — لایه دسترسی به داده (Repository Pattern) روی IndexedDB
  تمام داده‌ها فقط داخل مرورگر/گوشی ذخیره می‌شوند. هیچ درخواست شبکه‌ای وجود ندارد.

  جداول (Object Store ها):
    - banks        : بانک‌ها
    - accounts      : حساب‌ها/کارت‌ها
    - transactions  : تراکنش‌ها
    - units         : واحدها
    - categories    : دسته‌بندی‌ها
    - tags          : برچسب‌ها
    - settings      : تنظیمات (تک‌رکوردی به‌ازای هر کلید)
    - backups       : تاریخچه فایل‌های پشتیبان (فقط ابرداده)
*/

const DB_NAME = 'daftar-tarakonesh-db';
const DB_VERSION = 1;

const DB = (() => {
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;

        // بانک‌ها
        if (!db.objectStoreNames.contains('banks')) {
          const s = db.createObjectStore('banks', { keyPath: 'id', autoIncrement: true });
          s.createIndex('by_name', 'name', { unique: true });
        }

        // حساب‌ها / کارت‌ها
        if (!db.objectStoreNames.contains('accounts')) {
          const s = db.createObjectStore('accounts', { keyPath: 'id', autoIncrement: true });
          s.createIndex('by_bank', 'bankId');
          s.createIndex('by_card', 'cardNumber');
          s.createIndex('by_accountNumber', 'accountNumber');
        }

        // واحدها (مالی، فروش، پروژه...)
        if (!db.objectStoreNames.contains('units')) {
          const s = db.createObjectStore('units', { keyPath: 'id', autoIncrement: true });
          s.createIndex('by_name', 'name', { unique: true });
        }

        // دسته‌بندی‌ها
        if (!db.objectStoreNames.contains('categories')) {
          const s = db.createObjectStore('categories', { keyPath: 'id', autoIncrement: true });
          s.createIndex('by_name', 'name');
          s.createIndex('by_unit', 'unitId');
        }

        // برچسب‌ها
        if (!db.objectStoreNames.contains('tags')) {
          const s = db.createObjectStore('tags', { keyPath: 'id', autoIncrement: true });
          s.createIndex('by_name', 'name', { unique: true });
        }

        // تراکنش‌ها — هسته اصلی برنامه
        if (!db.objectStoreNames.contains('transactions')) {
          const s = db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
          s.createIndex('by_status', 'status');
          s.createIndex('by_date', 'date');
          s.createIndex('by_bank', 'bankName');
          s.createIndex('by_account', 'accountId');
          s.createIndex('by_unit', 'unitId');
          s.createIndex('by_category', 'categoryId');
          s.createIndex('by_type', 'type');
          s.createIndex('by_amount', 'amount');
          s.createIndex('by_trackingCode', 'trackingCode');
        }

        // تنظیمات
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        // ابرداده نسخه‌های پشتیبان
        if (!db.objectStoreNames.contains('backups')) {
          const s = db.createObjectStore('backups', { keyPath: 'id', autoIncrement: true });
          s.createIndex('by_date', 'createdAt');
        }
      };

      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    });
    return dbPromise;
  }

  function tx(storeNames, mode, fn) {
    return open().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(storeNames, mode);
      const result = fn(t);
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    }));
  }

  function req2promise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // --- عملیات عمومی CRUD قابل استفاده مجدد برای هر Store ---
  function add(store, value) {
    return open().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(store, 'readwrite');
      const r = t.objectStore(store).add(value);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    }));
  }

  function put(store, value) {
    return open().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(store, 'readwrite');
      const r = t.objectStore(store).put(value);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    }));
  }

  function get(store, key) {
    return open().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(store, 'readonly');
      const r = t.objectStore(store).get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    }));
  }

  function del(store, key) {
    return open().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(store, 'readwrite');
      const r = t.objectStore(store).delete(key);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    }));
  }

  function getAll(store, indexName, query) {
    return open().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(store, 'readonly');
      const os = indexName ? t.objectStore(store).index(indexName) : t.objectStore(store);
      const r = query !== undefined ? os.getAll(query) : os.getAll();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    }));
  }

  function clearStore(store) {
    return open().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(store, 'readwrite');
      const r = t.objectStore(store).clear();
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    }));
  }

  // خروجی کامل دیتابیس برای پشتیبان‌گیری
  const ALL_STORES = ['banks', 'accounts', 'units', 'categories', 'tags', 'transactions', 'settings'];

  async function exportAll() {
    const out = {};
    for (const store of ALL_STORES) {
      out[store] = await getAll(store);
    }
    out.__meta = { app: 'daftar-tarakonesh', version: DB_VERSION, exportedAt: new Date().toISOString() };
    return out;
  }

  async function importAll(data) {
    for (const store of ALL_STORES) {
      if (!Array.isArray(data[store])) continue;
      await clearStore(store);
      const db = await open();
      await new Promise((resolve, reject) => {
        const t = db.transaction(store, 'readwrite');
        const os = t.objectStore(store);
        data[store].forEach((row) => os.put(row));
        t.oncomplete = resolve;
        t.onerror = () => reject(t.error);
      });
    }
    return true;
  }

  async function wipeAll() {
    for (const store of ALL_STORES) {
      await clearStore(store);
    }
  }

  return { open, add, put, get, del, getAll, clearStore, exportAll, importAll, wipeAll };
})();
