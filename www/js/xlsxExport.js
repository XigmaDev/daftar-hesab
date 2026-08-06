/*
  xlsxExport.js — تولید فایل واقعی Excel (.xlsx) بدون هیچ کتابخانه‌ی بیرونی
  ---------------------------------------------------------------------------
  چون برنامه باید کاملاً آفلاین بماند (بدون CDN)، این فایل خودش از صفر:
    ۱) یک بایگانی ZIP معتبر می‌سازد (روش Store / بدون فشرده‌سازی — ساده و سریع)
    ۲) ساختار XML استاندارد OOXML (فرمت داخلی .xlsx) را تولید می‌کند
  خروجی یک فایل .xlsx واقعی است که در Excel، Google Sheets و LibreOffice
  به‌درستی باز می‌شود، با پشتیبانی از راست‌به‌چپ برای متن فارسی.
*/

const XlsxExport = (() => {

  /* ---------- CRC32 (برای هدر هر فایل داخل ZIP لازم است) ---------- */
  const CRC_TABLE = (() => {
    const table = new Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
      crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function strToBytes(str) { return new TextEncoder().encode(str); }

  function escapeXml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
  }

  function u16(n) { return new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF]); }
  function u32(n) { return new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF]); }

  function concatBytes(arrays) {
    let total = 0;
    for (const a of arrays) total += a.length;
    const result = new Uint8Array(total);
    let pos = 0;
    for (const a of arrays) { result.set(a, pos); pos += a.length; }
    return result;
  }

  /* ---------- نویسنده‌ی حداقلی ZIP (روش Store، بدون فشرده‌سازی) ---------- */
  function buildZip(files) {
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    for (const file of files) {
      const nameBytes = encoder.encode(file.name);
      const data = file.data;
      const crc = crc32(data);
      const size = data.length;

      const localHeader = concatBytes([
        u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(size), u32(size),
        u16(nameBytes.length), u16(0),
        nameBytes,
      ]);
      localParts.push(localHeader, data);

      const centralHeader = concatBytes([
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(size), u32(size),
        u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0),
        u32(offset),
        nameBytes,
      ]);
      centralParts.push(centralHeader);

      offset += localHeader.length + data.length;
    }

    const centralBytes = concatBytes(centralParts);
    const eocd = concatBytes([
      u32(0x06054b50), u16(0), u16(0),
      u16(files.length), u16(files.length),
      u32(centralBytes.length), u32(offset),
      u16(0),
    ]);

    return concatBytes([...localParts, centralBytes, eocd]);
  }

  /* ---------- تولید XML صفحه‌ی گسترده ---------- */
  function colName(idx) {
    let n = idx + 1, s = '';
    while (n > 0) {
      const rem = (n - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  function buildSheetXml(headers, rows) {
    const allRows = [headers, ...rows];
    let rowsXml = '';
    allRows.forEach((rowData, rIdx) => {
      const r = rIdx + 1;
      let cellsXml = '';
      rowData.forEach((val, cIdx) => {
        const ref = colName(cIdx) + r;
        if (typeof val === 'number' && isFinite(val)) {
          cellsXml += `<c r="${ref}"><v>${val}</v></c>`;
        } else {
          cellsXml += `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(val)}</t></is></c>`;
        }
      });
      rowsXml += `<row r="${r}">${cellsXml}</row>`;
    });
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews>` +
      `<sheetData>${rowsXml}</sheetData></worksheet>`;
  }

  function buildXlsxBytes(headers, rows, sheetName) {
    sheetName = (sheetName || 'گزارش').slice(0, 31); // محدودیت اکسل برای نام برگه

    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
      `</Types>`;

    const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
      `</Relationships>`;

    const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`;

    const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
      `</Relationships>`;

    const sheetXml = buildSheetXml(headers, rows);

    const files = [
      { name: '[Content_Types].xml', data: strToBytes(contentTypes) },
      { name: '_rels/.rels', data: strToBytes(rootRels) },
      { name: 'xl/workbook.xml', data: strToBytes(workbookXml) },
      { name: 'xl/_rels/workbook.xml.rels', data: strToBytes(workbookRels) },
      { name: 'xl/worksheets/sheet1.xml', data: strToBytes(sheetXml) },
    ];

    return buildZip(files);
  }

  /**
   * ساخت و دانلود فایل xlsx.
   * @param {string[]} headers - عنوان ستون‌ها (ردیف اول)
   * @param {Array<Array<string|number>>} rows - داده‌ها، هر آیتم یک آرایه از مقادیر سلول‌ها
   * @param {string} filename - نام فایل خروجی (باید به .xlsx ختم شود)
   * @param {string} [sheetName] - نام برگه (پیش‌فرض: «گزارش»)
   */
  function download(headers, rows, filename, sheetName) {
    const zipBytes = buildXlsxBytes(headers, rows, sheetName);
    const blob = new Blob([zipBytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  return { download, buildXlsxBytes };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = XlsxExport;
