// My Market — read a bank statement (Excel / CSV from any bank) into credit lines.
// Finds the narration, credit, date and reference columns; keeps credits only; reads the
// shop payment code (MM + 8 characters) and the 12-digit UPI transaction ID.
(function () {
  let xlsxLoad = null;
  const loadXLSX = () => xlsxLoad || (xlsxLoad = new Promise((res, rej) => {
    const sc = document.createElement("script"); sc.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    sc.onload = () => res(window.XLSX); sc.onerror = () => { xlsxLoad = null; rej(new Error("Needs the internet to read Excel files")); }; document.head.appendChild(sc);
  }));
  const num = (v) => { const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, "")); return isFinite(n) ? n : 0; };
  function statementRows(grid) {
    // find the header row: it names a narration column and a credit column
    const low = (x) => String(x ?? "").toLowerCase().trim();
    let h = -1, col = {};
    for (let i = 0; i < Math.min(grid.length, 60); i++) {
      const r = grid[i].map(low);
      const find = (re, not) => r.findIndex((x) => re.test(x) && !(not && not.test(x)));
      const narr = find(/narration|description|particular|remark|details|transaction details/);
      const cr = find(/credit|deposit|cr amount|amount \(cr\)|^cr$/, /debit/);
      if (narr >= 0 && cr >= 0) { h = i; col = { narr, cr, dt: find(/date/), ref: find(/ref|utr|chq|cheque/), amt: -1 }; break; }
      const amt = find(/^amount|txn amount|transaction amount/), type = find(/type|dr\s*\/\s*cr|cr\s*\/\s*dr/);
      if (narr >= 0 && amt >= 0 && type >= 0) { h = i; col = { narr, cr: -1, amt, type, dt: find(/date/), ref: find(/ref|utr|chq|cheque/) }; break; }
    }
    if (h < 0) return null;
    const out = [];
    for (const r of grid.slice(h + 1)) {
      const narration = String(r[col.narr] ?? "").trim(); if (!narration) continue;
      let amount = col.cr >= 0 ? num(r[col.cr]) : (/cr|credit/i.test(String(r[col.type] ?? "")) ? num(r[col.amt]) : 0);
      if (!(amount > 0)) continue;
      const refCell = col.ref >= 0 ? String(r[col.ref] ?? "").replace(/\D/g, "") : "";
      // UPI transaction IDs are 12 digits; banks may pad the reference column with zeros
      const inNarr = (narration.match(/(?:^|\D)(\d{12})(?:\D|$)/) || [])[1] || "";
      const fromRef = refCell.replace(/^0+/, "");
      const utr = inNarr || (/^0{2,}/.test(refCell) && fromRef.length <= 12 ? fromRef : refCell);
      const dtRaw = col.dt >= 0 ? r[col.dt] : "";
      let at = ""; if (dtRaw instanceof Date) at = dtRaw.toISOString();
      else if (dtRaw) { const m = String(dtRaw).match(/(\d{1,2})[\/\-. ](\d{1,2}|[A-Za-z]{3})[\/\-. ](\d{2,4})/); if (m) { const mon = isNaN(+m[2]) ? "JanFebMarAprMayJunJulAugSepOctNovDec".indexOf(m[2].slice(0, 3)) / 3 : +m[2] - 1; const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; const d = new Date(y, mon, +m[1], 12); if (!isNaN(d)) at = d.toISOString(); } }
      out.push({ utr, amount, narration, at, code: (narration.toUpperCase().match(/MM[0-9A-F]{8}/) || [""])[0] });
    }
    return out;
  }
  window.MM_STATEMENT = { loadXLSX, statementRows };
})();
