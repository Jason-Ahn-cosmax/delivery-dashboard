/**
 * Delivery Dashboard backend (Google Apps Script).
 *
 * Bound to a Google Spreadsheet. Exposes doGet (public read) and doPost
 * (token-gated write). The frontend (delivery-dashboard.html) calls these
 * to load and persist all dashboard state.
 *
 * Setup:
 *   1) In a fresh Google Sheet → Extensions → Apps Script. Paste this file.
 *   2) Set the upload token (one-time):
 *        Run → setUploadToken_   (it will prompt via Logs; or edit the
 *        TOKEN_DEFAULT below and run installDefaultToken_ once).
 *   3) Run → setup        (creates the sheets and header rows).
 *   4) Deploy → New deployment → Web app
 *        - Execute as: Me
 *        - Who has access: Anyone
 *        - Copy the /exec URL into BACKEND_URL inside delivery-dashboard.html.
 *
 *   Re-deploy whenever this code changes (Deploy → Manage deployments → edit
 *   → New version).
 */

const SHEETS = {
  RAW: 'raw_data',
  META: 'meta'
};

const RAW_HEADERS = [
  'customer','year','month','poNumber','poDetail','salesDoc','item',
  'productCode','productName','orderQty','deliveredQty',
  'orderDate','origDeliveryDate','origPlus30','materialInDate',
  'prodCompleteDate','finalDeliveryDate','leadTime','matLeadTime',
  'compliance','delayOwner','delayDetail'
];

const META_KEYS = ['priority','targets','targetsQR','history'];

// ---------- one-time setup ----------

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, SHEETS.RAW, RAW_HEADERS);
  ensureSheet_(ss, SHEETS.META, ['key','value']);
  // Seed meta keys with empty JSON if missing
  const meta = readMeta_(ss);
  if (!meta.priority) writeMetaKey_(ss, 'priority', {});
  if (!meta.targets) writeMetaKey_(ss, 'targets', { 2024: 80, 2025: 85, 2026: 85 });
  if (!meta.targetsQR) writeMetaKey_(ss, 'targetsQR', { 2024: 80, 2025: 85, 2026: 85 });
  if (!meta.history) writeMetaKey_(ss, 'history', []);
  Logger.log('Setup complete. Sheets ready: ' + Object.values(SHEETS).join(', '));
}

function setUploadToken_() {
  // Generates and stores a random token. Re-run to rotate.
  const token = Utilities.getUuid().replace(/-/g, '').slice(0, 20);
  PropertiesService.getScriptProperties().setProperty('UPLOAD_TOKEN', token);
  Logger.log('NEW upload token: ' + token);
  Logger.log('Share this with admins who will upload Excel files.');
}

function showUploadToken_() {
  const t = PropertiesService.getScriptProperties().getProperty('UPLOAD_TOKEN');
  Logger.log(t ? ('Current upload token: ' + t) : 'No token set. Run setUploadToken_ first.');
}

// ---------- web app entry points ----------

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const meta = readMeta_(ss);
    const data = {
      raw: readRaw_(ss),
      priority: meta.priority || {},
      targets: meta.targets || {},
      targetsQR: meta.targetsQR || {},
      history: meta.history || [],
      updatedAt: new Date().toISOString()
    };
    return jsonOut_(data);
  } catch (err) {
    return jsonOut_({ error: String(err && err.message || err) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const expected = PropertiesService.getScriptProperties().getProperty('UPLOAD_TOKEN');
    if (!expected) return jsonOut_({ ok: false, error: 'server: token not configured' });

    const payload = JSON.parse(e.postData.contents || '{}');
    if (payload.token !== expected) {
      return jsonOut_({ ok: false, error: 'invalid token' });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (Array.isArray(payload.raw)) writeRaw_(ss, payload.raw);
    if (payload.priority) writeMetaKey_(ss, 'priority', payload.priority);
    if (payload.targets) writeMetaKey_(ss, 'targets', payload.targets);
    if (payload.targetsQR) writeMetaKey_(ss, 'targetsQR', payload.targetsQR);
    if (Array.isArray(payload.history)) writeMetaKey_(ss, 'history', payload.history);

    return jsonOut_({ ok: true, updatedAt: new Date().toISOString() });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

// ---------- sheet helpers ----------

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function readRaw_(ss) {
  const sheet = ss.getSheetByName(SHEETS.RAW);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const out = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.every(c => c === '' || c === null)) continue;
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      let v = row[j];
      if (v instanceof Date) v = v.toISOString().slice(0, 10);
      obj[headers[j]] = v;
    }
    out.push(obj);
  }
  return out;
}

function writeRaw_(ss, rows) {
  const sheet = ensureSheet_(ss, SHEETS.RAW, RAW_HEADERS);
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, RAW_HEADERS.length).clearContent();
  }
  if (!rows.length) return;
  const data = rows.map(r => RAW_HEADERS.map(h => {
    const v = r[h];
    if (v === undefined || v === null) return '';
    return v;
  }));
  sheet.getRange(2, 1, data.length, RAW_HEADERS.length).setValues(data);
}

function readMeta_(ss) {
  const sheet = ensureSheet_(ss, SHEETS.META, ['key','value']);
  const out = {};
  if (sheet.getLastRow() < 2) return out;
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  values.forEach(([k, v]) => {
    if (!k) return;
    try { out[k] = v ? JSON.parse(v) : null; } catch (_) { out[k] = null; }
  });
  return out;
}

function writeMetaKey_(ss, key, value) {
  const sheet = ensureSheet_(ss, SHEETS.META, ['key','value']);
  const serialized = JSON.stringify(value);
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < keys.length; i++) {
      if (keys[i][0] === key) {
        sheet.getRange(i + 2, 2).setValue(serialized);
        return;
      }
    }
  }
  sheet.appendRow([key, serialized]);
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
