# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository shape

Single self-contained file: `delivery-dashboard.html` (~1670 lines). No build system, no package manager, no backend. Open the file directly in a browser to run it; there are no commands to build, lint, or test.

External dependencies are loaded from CDN at the top of the HTML:
- Chart.js 4.4.7 (`chart.umd.min.js`)
- SheetJS / xlsx 0.18.5 (`xlsx.full.min.js`)

UI strings, sheet names, and many data values are Korean. Preserve them exactly — they are matched against incoming Excel data.

## Domain model

The dashboard tracks two distinct manufacturing KPIs per customer/year/month:
- **납기준수율** (delivery compliance rate) — % of orders delivered on time
- **수량완납율** (quantity fulfillment rate) — delivered qty / ordered qty

A row in `RAW` represents one purchase-order line. The `compliance` field is the string `'준수'` (compliant) or anything else (treated as non-compliant). `delayOwner` categorizes who/what caused a missed delivery and drives the delay-analysis tab.

## Architecture

### Five tabs, one render dispatcher
The five `.section` panels (`sec-dashboard`, `sec-customer`, `sec-delay`, `sec-summary`, `sec-upload`) are toggled by `.active` class. `refresh()` reads the active tab from `.tab.active` and calls the matching `render*` function. When adding a new tab, both the tab click handler and `refresh()` must learn about it.

### State lives in localStorage, keyed by `STORE.*`
All persistence is via `localStorage` — there is no server. The keys are defined at the top of `<script>`:
- `dd_raw_data` — array of parsed PO line rows
- `dd_priority` — customer rank per year, shape `{ "2025": { "LOJ": 1, ... }, "2026": {...} }`. Legacy flat shape `{ "LOJ": 1, ... }` is still detected in `loadPriority()`; do not break that fallback path.
- `dd_targets`, `dd_targets_qr` — per-year target % for delivery and quantity rates respectively
- `dd_upload_history` — last 10 uploads (truncated)

`load(key, def)` swallows JSON parse errors and returns `def`. `save(key, val)` JSON-stringifies. Helpers `loadRaw()` / `loadPriority(year)` / `loadTargets()` etc. wrap these.

### Excel ingestion is the only data entry path
`handleFile()` (around line 378) parses a workbook with three expected sheets — names are matched verbatim:
- `'Raw data'` (case variants `raw data`, `RawData` are tolerated) — read with `header: 'A'`, then mapped column-by-column: customer=A, year=B, month=C, poNumber=D, ... orderQty=J, deliveredQty=K, ... compliance=T, delayOwner=U, delayDetail=V. Changing the column layout means updating this mapping.
- `'우선순위'` — read by **direct cell address** (`G2:I21`) rather than `sheet_to_json`. G=rank, H=2025 customer name, I=2026 customer name. The whole `dd_priority` key is wiped and rewritten on every upload.
- `'납기준수율목표'` — yearly targets. Values ≤ 1 are treated as fractions and multiplied by 100.

### Render pipeline conventions
- `aggregate(data)` groups RAW by `customer|year|month` into running counters; most render functions take RAW and reduce it themselves rather than calling this — be aware of both styles.
- Customer dropdowns share `updateCustomerDropdownForYear()` and inject two synthetic group options (`TOP10`, `BOTTOM`) plus a disabled separator before the customer list. Render code branches on these magic values.
- Charts are stored in the module-level `charts = {}` map and destroyed via `destroyCharts()` before every re-render — Chart.js will leak canvases otherwise. Always register new charts into this map.
- `dataLabelPlugin` is a custom Chart.js plugin defined once and reused; bar values use it to draw inline labels.
- Rate styling uses `rateClass(v, target, type)` returning `rate-good` / `rate-good-qr` / `rate-bad`. The `type === 'qr'` branch is what differentiates green (quantity) from blue (delivery) in the UI palette.

### Export / share
- `exportCustomerExcel()` — single-customer xlsx
- `exportShareFile()` — generates a standalone HTML snapshot for teammates
- `exportBackup()` / `importBackup()` — full JSON dump of all `dd_*` keys
- `localStorage.clear()` is wired to the "전체 초기화" button; it nukes everything including targets and history.

### Summary tab is AS-IS vs TO-BE
`renderSummary()` compares two (year, month) pairs and emits KPI deltas, per-delay-owner deltas, and an auto-generated Korean commentary block. `copyFullReport()` / `copyOwnerReport()` write that commentary to the clipboard for pasting into reports — they assemble strings from the rendered DOM, so don't rename the element IDs they read.

## Working notes

- The file is large and monolithic on purpose; prefer surgical `Edit` over rewrites.
- When changing data shape, also update `exportBackup`/`importBackup` and the `handleFile` parser together, or restores will silently drop fields.
- Year-keyed vs flat priority is a real compatibility concern — older saved state in users' browsers still uses the flat shape.
