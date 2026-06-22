/**
 * China Delight — Sales Dashboard builder (v3: date range + monthly summary + strict exclusions).
 *
 * Builds/refreshes a "Dashboard" tab from live formulas that reference the "Orders" tab, plus
 * exactly two charts. Safe + idempotent: never touches, renames, or deletes the Orders tab or its data; if
 * "Dashboard" exists it is cleared and rebuilt (no duplicate tabs/charts). Everything is live
 * formulas, so totals/charts update automatically as new orders append.
 *
 * Orders is written by the website with money + date as TEXT (valueInputOption=RAW). Hidden
 * helper blocks (columns AA:BC) convert text -> real numbers (VALUE), parse text dates into real
 * dates, and build chart/table sources. Everything visible reads from those clean helpers.
 *
 * STRICT include filter — a row counts toward the dashboard ONLY when ALL are true:
 *   - Order Number (col B) is present
 *   - Order Number does NOT contain "TEST" or "DEMO" (case-insensitive, trimmed)
 *   - Status (col F) is NOT "cancelled" or "canceled" (case-insensitive, trimmed)
 *   - Cancelled? (col X) is NOT yes/true/cancelled/canceled
 *   - Test Order? (col W) is NOT yes/true/test/demo
 *   - Count Toward Sales? (col Y), when present, is NOT no/false/0
 *   - the order's date is within the Start/End date range (blank = unbounded)
 * (This does NOT rely on "Count Toward Sales?" col Y, so tests/cancelled are excluded even if Y is
 *  blank or inconsistent; it only honors Y when it explicitly says not to count the row.)
 *
 * Orders columns used: A date, B order#, F status, K subtotal, L discount, M tax, N processing fee,
 *   O tip, P total, Q 4% website fee, W test order?, X cancelled?, Y count toward sales?.
 *
 * HOW TO RUN:
 *   1. Open the sheet -> Extensions -> Apps Script.
 *   2. SELECT ALL existing code and DELETE it, paste this whole file, Save.
 *   3. Run buildChinaDelightDashboard (authorize if prompted).
 *   4. Open the "Dashboard" tab. (A "China Delight" menu also appears after reload.)
 *
 * NOTE: assumes US locale (comma formula/array separators). For semicolon locales, replace "," with
 * ";" inside the formulas below.
 */

var SPREADSHEET_ID = '1YIoAqzjpciRyX8my_cNryifJvrrF93PWv5g9cxyH6BQ';
var ORDERS_TAB = 'Orders';
var DASHBOARD_TAB = 'Dashboard';
var MONEY = '$#,##0.00';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('China Delight')
    .addItem('Rebuild Sales Dashboard', 'buildChinaDelightDashboard')
    .addToUi();
}

function buildChinaDelightDashboard() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var orders = ss.getSheetByName(ORDERS_TAB);
  if (!orders) {
    throw new Error('Could not find the "' + ORDERS_TAB + '" tab. Aborting so nothing is changed.');
  }

  // Create or safely reset the Dashboard tab only.
  var dash = ss.getSheetByName(DASHBOARD_TAB);
  if (!dash) {
    dash = ss.insertSheet(DASHBOARD_TAB);
  } else {
    dash.getCharts().forEach(function (c) { dash.removeChart(c); });
    dash.clear();
    if (dash.getMaxColumns() > 1) dash.showColumns(1, dash.getMaxColumns());
  }

  // Make sure the Dashboard grid is big enough for helper spills (>= Orders rows; >= col BC=55).
  var needRows = Math.max(orders.getMaxRows(), 1000);
  if (dash.getMaxRows() < needRows) dash.insertRowsAfter(dash.getMaxRows(), needRows - dash.getMaxRows());
  if (dash.getMaxColumns() < 55) dash.insertColumnsAfter(dash.getMaxColumns(), 55 - dash.getMaxColumns());

  // Locale-independent date parse of the text "MM/DD/YYYY, h:mm AM/PM" (date portion is fixed width).
  var dExpr = 'IFERROR(DATE(VALUE(MID(Orders!A2:A,7,4)),VALUE(MID(Orders!A2:A,1,2)),VALUE(MID(Orders!A2:A,4,2))),"")';

  // ---- Title -----------------------------------------------------------
  dash.getRange('A1:N1').merge().setValue('China Delight Sales Dashboard')
    .setFontSize(20).setFontWeight('bold').setHorizontalAlignment('center')
    .setBackground('#B81D1D').setFontColor('#FFFFFF');
  dash.getRange('A2:N2').merge()
    .setValue('Auto-updated from the Orders tab. Excludes TEST orders and cancelled orders. Use the date range below.')
    .setFontStyle('italic').setFontColor('#666666').setHorizontalAlignment('center');

  // ---- Date range controls (row 3) ------------------------------------
  dash.getRange('A3').setValue('Start Date:').setFontWeight('bold').setHorizontalAlignment('right');
  dash.getRange('C3').setValue('End Date:').setFontWeight('bold').setHorizontalAlignment('right');
  dash.getRange('F3:N3').merge().setValue('Leave blank to show all dates.').setFontStyle('italic').setFontColor('#666666');
  [dash.getRange('B3'), dash.getRange('D3')].forEach(function (cell) {
    cell.setNumberFormat('mm/dd/yyyy')
      .setBackground('#FFF7CC')
      .setBorder(true, true, true, true, false, false)
      .setHorizontalAlignment('center')
      .setDataValidation(SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).build());
  });

  // ---- Hidden helper block (AA:AK) ------------------------------------
  // AA date | AB include(1/0) | AC total | AD procFee | AE webFee | AF tip | AG discount
  // AH subtotal | AI tax | AJ status | AK monthStart(date)
  dash.getRange('AA1:AK1').setValues([[
    'date', 'include', 'total', 'procFee', 'webFee', 'tip', 'discount', 'subtotal', 'tax', 'status', 'monthStart'
  ]]);
  dash.getRange('AA2').setFormula('=ARRAYFORMULA(' + dExpr + ')');
  // Strict include flag (exclusions + date range). All arrays come from Orders (same height).
  // Normalize with LOWER(TRIM()) and regex so stale rows with "Canceled", " cancelled ", "TEST-...",
  // or demo/test marker columns cannot leak into any totals, charts, fees, or summaries.
  dash.getRange('AB2').setFormula(
    '=ARRAYFORMULA(' +
      '(LEN(TRIM(Orders!B2:B&""))>0)' +
      '*NOT(REGEXMATCH(LOWER(TRIM(Orders!B2:B&"")),"test|demo"))' +
      '*NOT(REGEXMATCH(LOWER(TRIM(Orders!F2:F&"")),"cancelled|canceled"))' +
      '*NOT(REGEXMATCH(LOWER(TRIM(Orders!X2:X&"")),"yes|true|cancelled|canceled"))' +
      '*NOT(REGEXMATCH(LOWER(TRIM(Orders!W2:W&"")),"yes|true|test|demo"))' +
      '*NOT(REGEXMATCH(LOWER(TRIM(Orders!Y2:Y&"")),"^(no|false|0)$"))' +
      '*(($B$3="")+(ISNUMBER(' + dExpr + ')*(' + dExpr + '>=$B$3))>0)' +
      '*(($D$3="")+(ISNUMBER(' + dExpr + ')*(' + dExpr + '<=$D$3))>0)' +
    ')'
  );
  dash.getRange('AC2').setFormula(
    '=ARRAYFORMULA({' +
      'IFERROR(VALUE(Orders!P2:P),0),' +  // total
      'IFERROR(VALUE(Orders!N2:N),0),' +  // processing fee
      'IFERROR(VALUE(Orders!Q2:Q),0),' +  // 4% website fee
      'IFERROR(VALUE(Orders!O2:O),0),' +  // tip
      'IFERROR(VALUE(Orders!L2:L),0),' +  // discount
      'IFERROR(VALUE(Orders!K2:K),0),' +  // subtotal
      'IFERROR(VALUE(Orders!M2:M),0),' +  // tax
      'TRIM(Orders!F2:F&"")' +            // status
    '})'
  );
  dash.getRange('AK2').setFormula('=ARRAYFORMULA(IF(ISNUMBER(AA2:AA),DATE(YEAR(AA2:AA),MONTH(AA2:AA),1),""))');

  // ---- Key metrics (A6:B15) -------------------------------------------
  dash.getRange('A5').setValue('KEY METRICS').setFontWeight('bold').setFontColor('#B81D1D');
  dash.getRange('A6:B6').setValues([['Metric', 'Value']]).setFontWeight('bold').setBackground('#FFF7E8');
  var metrics = [
    ['Total Sales',                        '=SUMIF($AB$2:$AB,1,$AC$2:$AC)'],
    ['Total Orders',                       '=SUM($AB$2:$AB)'],
    ['Average Order Value',                '=IFERROR(B7/B8,0)'],
    ['Food Subtotal (before tax/fees)',    '=SUMIF($AB$2:$AB,1,$AH$2:$AH)'],
    ['Total Tax',                          '=SUMIF($AB$2:$AB,1,$AI$2:$AI)'],
    ['Total Processing Fees',              '=SUMIF($AB$2:$AB,1,$AD$2:$AD)'],
    ['Total 4% Website Fee (your income)', '=B12*(4/6)'],
    ['Total Tips',                         '=SUMIF($AB$2:$AB,1,$AF$2:$AF)'],
    ['Total Discounts',                    '=SUMIF($AB$2:$AB,1,$AG$2:$AG)']
  ];
  for (var i = 0; i < metrics.length; i++) {
    var r = 7 + i;
    dash.getRange('A' + r).setValue(metrics[i][0]);
    dash.getRange('B' + r).setFormula(metrics[i][1]);
  }
  dash.getRange('A7:A15').setFontWeight('bold');
  dash.getRange('B7').setNumberFormat(MONEY);      // Total Sales
  dash.getRange('B8').setNumberFormat('#,##0');     // Total Orders
  dash.getRange('B9:B15').setNumberFormat(MONEY);   // money metrics

  // ---- Total sales breakdown pie source (D6:E11) ----------------------
  dash.getRange('D5').setValue('TOTAL SALES BREAKDOWN').setFontWeight('bold').setFontColor('#B81D1D');
  dash.getRange('D6:E6').setValues([['Sales Component', 'Amount']]).setFontWeight('bold').setBackground('#FFF7E8');
  dash.getRange('D7:D11').setValues([['Food Subtotal'], ['Tax'], ['Actual Processing Fee'], ['4% Website Fee'], ['Tips']]);
  dash.getRange('E7').setFormula('=B10'); // Food subtotal
  dash.getRange('E8').setFormula('=B11'); // Tax
  dash.getRange('E9').setFormula('=B12*(2/6)'); // Actual processing fee portion of the full 6% fee.
  dash.getRange('E10').setFormula('=B12*(4/6)'); // 4% website fee portion of the full 6% fee.
  dash.getRange('E11').setFormula('=B14'); // Tips
  dash.getRange('E7:E11').setNumberFormat(MONEY);

  // ---- Order status breakdown (G5 label, G6 spill) --------------------
  dash.getRange('G5').setValue('ORDER STATUS (counted orders)').setFontWeight('bold').setFontColor('#B81D1D');
  dash.getRange('G6').setFormula(
    '=QUERY($AA$2:$AK,"select Col10, count(Col10) where Col2 = 1 group by Col10 ' +
    'order by count(Col10) desc label Col10 \'Order Status\', count(Col10) \'Orders\'",0)'
  );
  dash.getRange('G6:H6').setFontWeight('bold');

  // ---- Monthly summary (visible table at A38:J, raw helper at AL:AT) ---
  dash.getRange('AL18').setFormula(
    '=QUERY($AA$2:$AK,"select Col11, count(Col11), sum(Col3), sum(Col8), sum(Col9), sum(Col4), sum(Col6), sum(Col7), avg(Col3) ' +
    'where Col2 = 1 and Col11 is not null group by Col11 order by Col11 ' +
    'label Col11 \'Month\', count(Col11) \'Orders\', sum(Col3) \'Total Sales\', sum(Col8) \'Food Subtotal\', sum(Col9) \'Tax\', ' +
    'sum(Col4) \'Total Processing Fees\', sum(Col6) \'Tips\', sum(Col7) \'Discounts\', avg(Col3) \'Avg Order Value\'",0)'
  );
  dash.getRange('A37').setValue('MONTHLY SALES SUMMARY').setFontWeight('bold').setFontColor('#B81D1D');
  dash.getRange('A38:J38').setValues([[
    'Month', 'Orders', 'Total Sales', 'Food Subtotal', 'Tax', 'Total Processing Fees', '4% Website Fee', 'Tips', 'Discounts', 'Avg Order Value'
  ]]);
  dash.getRange('A38:J38').setFontWeight('bold').setBackground('#FFF7E8');
  dash.getRange('A39').setFormula('=ARRAYFORMULA(IF($AL$19:$AL$42="","",TEXT($AL$19:$AL$42,"mmmm yyyy")))');
  dash.getRange('B39').setFormula('=ARRAYFORMULA(IF($AL$19:$AL$42="","",$AM$19:$AM$42))');
  dash.getRange('C39').setFormula('=ARRAYFORMULA(IF($AL$19:$AL$42="","",$AN$19:$AN$42))');
  dash.getRange('D39').setFormula('=ARRAYFORMULA(IF($AL$19:$AL$42="","",$AO$19:$AO$42))');
  dash.getRange('E39').setFormula('=ARRAYFORMULA(IF($AL$19:$AL$42="","",$AP$19:$AP$42))');
  dash.getRange('F39').setFormula('=ARRAYFORMULA(IF($AL$19:$AL$42="","",$AQ$19:$AQ$42))');
  dash.getRange('G39').setFormula('=ARRAYFORMULA(IF($AL$19:$AL$42="","",$AQ$19:$AQ$42*(4/6)))');
  dash.getRange('H39').setFormula('=ARRAYFORMULA(IF($AL$19:$AL$42="","",$AR$19:$AR$42))');
  dash.getRange('I39').setFormula('=ARRAYFORMULA(IF($AL$19:$AL$42="","",$AS$19:$AS$42))');
  dash.getRange('J39').setFormula('=ARRAYFORMULA(IF($AL$19:$AL$42="","",$AT$19:$AT$42))');
  dash.getRange('B39:B62').setNumberFormat('#,##0');
  dash.getRange('C39:J62').setNumberFormat(MONEY);

  // ---- Daily summary (visible latest 5 days, full data in hidden AV:BC) -----------------
  dash.getRange('AV18').setFormula(
    '=QUERY($AA$2:$AK,"select Col1, count(Col1), sum(Col3), sum(Col8), sum(Col9), sum(Col4), sum(Col6), sum(Col7) ' +
    'where Col2 = 1 and Col1 is not null group by Col1 order by Col1 desc ' +
    'label Col1 \'Date\', count(Col1) \'Orders\', sum(Col3) \'Total Sales\', sum(Col8) \'Food Subtotal\', sum(Col9) \'Tax\', ' +
    'sum(Col4) \'Total Processing Fees\', sum(Col6) \'Tips\', sum(Col7) \'Discounts\'",0)'
  );
  dash.getRange('A66').setValue('DAILY SALES SUMMARY').setFontWeight('bold').setFontColor('#B81D1D');
  dash.getRange('A67:I67').setValues([[
    'Date', 'Orders', 'Total Sales', 'Food Subtotal', 'Tax', 'Total Processing Fees', '4% Website Fee', 'Tips', 'Discounts'
  ]]);
  dash.getRange('A67:I67').setFontWeight('bold').setBackground('#FFF7E8');
  dash.getRange('A68').setFormula('=ARRAYFORMULA(IF($AV$19:$AV$23="","",TEXT($AV$19:$AV$23,"mm/dd/yyyy")))');
  dash.getRange('B68').setFormula('=ARRAYFORMULA(IF($AV$19:$AV$23="","",$AW$19:$AW$23))');
  dash.getRange('C68').setFormula('=ARRAYFORMULA(IF($AV$19:$AV$23="","",$AX$19:$AX$23))');
  dash.getRange('D68').setFormula('=ARRAYFORMULA(IF($AV$19:$AV$23="","",$AY$19:$AY$23))');
  dash.getRange('E68').setFormula('=ARRAYFORMULA(IF($AV$19:$AV$23="","",$AZ$19:$AZ$23))');
  dash.getRange('F68').setFormula('=ARRAYFORMULA(IF($AV$19:$AV$23="","",$BA$19:$BA$23))');
  dash.getRange('G68').setFormula('=ARRAYFORMULA(IF($AV$19:$AV$23="","",$BA$19:$BA$23*(4/6)))');
  dash.getRange('H68').setFormula('=ARRAYFORMULA(IF($AV$19:$AV$23="","",$BB$19:$BB$23))');
  dash.getRange('I68').setFormula('=ARRAYFORMULA(IF($AV$19:$AV$23="","",$BC$19:$BC$23))');
  dash.getRange('A73:I73').merge().setValue('Showing latest 5 days. Full daily summary data is retained in hidden helper columns AV:BC.').setFontStyle('italic').setFontColor('#666666');
  dash.getRange('AV19:AV1000').setNumberFormat('mm/dd/yyyy');
  dash.getRange('A68:A72').setNumberFormat('mm/dd/yyyy');
  dash.getRange('B68:B72').setNumberFormat('#,##0');
  dash.getRange('C68:I72').setNumberFormat(MONEY);
  dash.getRange('AW19:AW1000').setNumberFormat('#,##0');
  dash.getRange('AX19:BC1000').setNumberFormat(MONEY);

  // ---- Layout polish ---------------------------------------------------
  dash.setFrozenRows(3);
  dash.setColumnWidth(1, 230);  // A
  dash.setColumnWidth(2, 130);  // B
  dash.setColumnWidth(3, 100);  // C
  dash.setColumnWidth(4, 150);  // D
  dash.setColumnWidth(5, 120);  // E
  dash.setColumnWidths(6, 9, 120);  // F-N
  dash.setHiddenGridlines(true);
  dash.getRange('A5:B15').setBorder(true, true, true, true, true, true);
  dash.getRange('D5:E11').setBorder(true, true, true, true, true, true);
  dash.getRange('G5:H15').setBorder(true, true, true, true, true, true);
  dash.getRange('A38:J62').setBorder(true, true, true, true, true, true);
  dash.getRange('A67:I73').setBorder(true, true, true, true, true, true);
  dash.hideColumns(27, 29); // hide helper columns AA:BC

  // Let helper spills + tables compute before charts read their ranges.
  SpreadsheetApp.flush();

  // ---- Charts (floating, kept near the visible dashboard content) ----
  function place(chart, row, col) { dash.insertChart(chart.setPosition(row, col, 0, 0).build()); }

  // Chart 1: total sales breakdown. Website fee is separated from processing fee and not double-counted.
  place(dash.newChart().asPieChart()
    .addRange(dash.getRange('D6:E11'))
    .setNumHeaders(1)
    .setOption('title', 'Total Sales Breakdown')
    .setOption('pieSliceText', 'value')
    .setOption('legend', { position: 'right' })
    .setOption('width', 520)
    .setOption('height', 300), 17, 1);

  // Chart 2: one monthly graph for order count and total sales.
  place(dash.newChart().asComboChart()
    .addRange(dash.getRange('A38:C62'))
    .setNumHeaders(1)
    .setOption('title', 'Monthly Orders and Sales')
    .setOption('series', {
      0: { type: 'bars', targetAxisIndex: 0, labelInLegend: 'Orders' },
      1: { type: 'line', targetAxisIndex: 1, labelInLegend: 'Total Sales' }
    })
    .setOption('vAxes', {
      0: { title: 'Orders' },
      1: { title: 'Sales ($)' }
    })
    .setOption('hAxis', { title: 'Month', format: 'MMMM yyyy' })
    .setOption('legend', { position: 'bottom' })
    .setOption('width', 620)
    .setOption('height', 320), 17, 8);

  ss.setActiveSheet(dash);
  SpreadsheetApp.flush();
}
