// My Market — the A4 bill PDF. Used by the shop app (send / print / backup) and by
// bill.html, where the customer's phone makes the PDF from the bill saved on the server.
// Needs jsPDF (window.jspdf) loaded first.
(function () {
  const rs = (n) => "Rs. " + Math.round(n).toLocaleString("en-IN");
  const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (n) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : ""));
  const three = (n) => (n >= 100 ? ONES[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " : "") : "") + (n % 100 ? two(n % 100) : "");
  function inWords(n) { // Indian system: thousand, lakh, crore
    n = Math.round(n); if (!n) return "Zero";
    const cr = Math.floor(n / 1e7); n %= 1e7; const la = Math.floor(n / 1e5); n %= 1e5; const th = Math.floor(n / 1000); n %= 1000;
    return [cr && inWords(cr) + " Crore", la && two(la) + " Lakh", th && two(th) + " Thousand", n && three(n)].filter(Boolean).join(" ");
  }

  // b: { no, at, lines[{name, brand, qty, price}], sub, discount, total, units, pay, received, cancelled, phone | phoneLast4 }
  // s: { name, phone, gst, promo, shopNo, floor, landmark, locality, pincode }
  // opts: { market: {name, locality, pincode}, shopUrl, into: jsPDF to add pages to }
  function make(b, s, opts = {}) {
    const into = opts.into || null;
    const { jsPDF } = window.jspdf;
    const doc = into || new jsPDF({ unit: "mm", format: "a4", compress: true });
    const firstPage = into ? (into.addPage(), into.getNumberOfPages()) : 1;
    const W = 210, L = 15, R = 195;
    const m = opts.market || null, d = new Date(b.at);
    const NAVY = [23, 35, 49], ORANGE = [255, 164, 28], GREY = [96, 100, 100], LINE = [222, 226, 226], INK = [15, 17, 17], ZEBRA = [247, 249, 249];
    const money = (n) => Math.round(n).toLocaleString("en-IN");
    const addr = [s.shopNo && s.shopNo !== "—" ? `Shop ${s.shopNo}` : "", s.floor && s.floor !== "Ground floor" ? s.floor : "", s.landmark || "", m?.name || "",
      [s.locality || m?.locality || "", s.pincode || m?.pincode || ""].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    const header = (first) => {
      doc.setFillColor(...NAVY); doc.rect(0, 0, W, 40, "F");
      doc.setFillColor(...ORANGE); doc.rect(0, 40, W, 1.6, "F");
      doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(19);
      doc.text(doc.splitTextToSize(s.name, 118)[0], L, 16);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(205, 216, 226);
      const al = doc.splitTextToSize(addr, 118).slice(0, 2);
      doc.text(al, L, 23);
      doc.text([s.phone ? `Phone / WhatsApp: ${s.phone}` : "", s.gst ? `GSTIN: ${s.gst}` : ""].filter(Boolean).join("     "), L, 23 + al.length * 4.2 + 1.5);
      doc.setTextColor(...ORANGE); doc.setFont("helvetica", "bold"); doc.setFontSize(22);
      doc.text("BILL", R, 16, { align: "right" });
      doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
      doc.text(`No. ${b.no}`, R, 23, { align: "right" });
      doc.text(d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }), R, 28, { align: "right" });
      doc.text(d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }), R, 33, { align: "right" });
      if (!first) { doc.setFontSize(8.5); doc.setTextColor(205, 216, 226); doc.text("(continued)", R, 37.5, { align: "right" }); }
    };
    const tableHead = (y) => {
      doc.setFillColor(...NAVY); doc.rect(L, y, R - L, 8.5, "F");
      doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
      doc.text("#", L + 3, y + 5.6); doc.text("ITEM", L + 12, y + 5.6);
      doc.text("QTY", 132, y + 5.6, { align: "right" }); doc.text("RATE", 160, y + 5.6, { align: "right" }); doc.text("AMOUNT", R - 3, y + 5.6, { align: "right" });
      return y + 8.5;
    };
    header(true);
    let y = 50;
    // billed to / payment
    doc.setDrawColor(...LINE); doc.setLineWidth(0.3);
    doc.roundedRect(L, y, 86, 21, 2, 2, "S"); doc.roundedRect(109, y, 86, 21, 2, 2, "S");
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(...GREY);
    doc.text("BILLED TO", L + 4, y + 6); doc.text("PAYMENT", 113, y + 6);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(...INK);
    const ph = String(b.phone || "").replace(/\D/g, "").slice(-10);
    doc.text(ph.length === 10 ? `Customer: +91 ${ph.slice(0, 5)} ${ph.slice(5)}` : b.phoneLast4 ? `Customer: +91 xxxxxx${b.phoneLast4}` : "Walk-in customer", L + 4, y + 13);
    doc.text({ cash: "Cash", upi: "UPI", card: "Card", khata: "Khata (pay later)" }[b.pay] || b.pay, 113, y + 13);
    if (b.received) { doc.setFontSize(8.5); doc.setTextColor(...GREY); doc.text(`Received ${rs(b.received)} · Returned ${rs(Math.max(0, b.received - b.total))}`, 113, y + 18); }
    if (b.cancelled) { doc.setTextColor(177, 39, 4); doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text("CANCELLED", R - 4, y + 13, { align: "right" }); }
    y = tableHead(y + 29);
    // rows
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
    b.lines.forEach((l, i) => {
      const nameL = doc.splitTextToSize(l.name + (l.brand && l.brand !== "Generic" ? ` (${l.brand})` : ""), 98);
      const rh = nameL.length * 4.4 + 4.2;
      if (y + rh > 262) { // new page
        doc.setFontSize(8); doc.setTextColor(...GREY); doc.text("Continued on next page", R, 270, { align: "right" });
        doc.addPage(); header(false); y = tableHead(50); doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
      }
      if (i % 2) { doc.setFillColor(...ZEBRA); doc.rect(L, y, R - L, rh, "F"); }
      doc.setTextColor(...GREY); doc.text(String(i + 1), L + 3, y + 5.6);
      doc.setTextColor(...INK); doc.text(nameL, L + 12, y + 5.6);
      doc.text(String(l.qty), 132, y + 5.6, { align: "right" });
      doc.text(money(l.price), 160, y + 5.6, { align: "right" });
      doc.text(money(l.qty * l.price), R - 3, y + 5.6, { align: "right" });
      y += rh; doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(L, y, R, y);
    });
    // totals (right) and amount in words (left)
    if (y + 52 > 270) { doc.addPage(); header(false); y = 50; }
    y += 6;
    const tx = 120, row = (label, val, yy, bold) => {
      doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(9.5); doc.setTextColor(...(bold ? INK : GREY));
      doc.text(label, tx + 3, yy); doc.text(val, R - 3, yy, { align: "right" });
    };
    row(`Items (${b.units})`, rs(b.sub), y + 4);
    let ty = y + 4;
    if (b.discount) { ty += 6; row("Discount", "- " + rs(b.discount), ty); }
    ty += 4;
    doc.setFillColor(...NAVY); doc.roundedRect(tx, ty, R - tx, 11, 1.5, 1.5, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(12.5);
    doc.text("TOTAL", tx + 4, ty + 7.4); doc.text(rs(b.total), R - 4, ty + 7.4, { align: "right" });
    // bargained items + bill discount, against the shop's selling prices
    const saved = Math.max(0, (b.lines || []).reduce((t, l) => t + l.qty * Math.max(0, (l.list || l.price) - l.price), 0) + (b.discount || 0));
    if (saved) { doc.setFontSize(9); doc.setTextColor(30, 120, 70); doc.text(`You saved ${rs(saved)}`, R - 4, ty + 16, { align: "right" }); }
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(...GREY);
    doc.text("AMOUNT IN WORDS", L, y + 4);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...INK);
    doc.text(doc.splitTextToSize(`Rupees ${inWords(b.total)} Only`, 95), L, y + 9.5);
    y = ty + 20;
    // the shop's message / small advert
    const promo = s.promo || `Visit ${s.name} again — new stock every week.`;
    doc.setFontSize(10); const pl = doc.splitTextToSize(promo, R - L - 26);
    const bh = 10 + pl.length * 4.6;
    doc.setFillColor(255, 243, 223); doc.setDrawColor(...ORANGE); doc.setLineWidth(0.4);
    doc.roundedRect(L, y, R - L, bh, 2, 2, "FD");
    doc.setFillColor(...ORANGE); doc.circle(L + 8, y + bh / 2, 4, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text("%", L + 8, y + bh / 2 + 1.3, { align: "center" });
    doc.setTextColor(112, 63, 0); doc.text(pl, L + 16, y + 6.5);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(140, 90, 20);
    doc.text(opts.shopUrl ? "See our full stock and prices online: tap here (My Market)" : `See our stock & prices on My Market: search "${s.name}"`, L + 16, y + 6.5 + pl.length * 4.6);
    if (opts.shopUrl) doc.link(L, y, R - L, bh, { url: opts.shopUrl });
    // footer on every page
    const last = doc.getNumberOfPages(), pages = last - firstPage + 1;
    for (let p = firstPage; p <= last; p++) {
      doc.setPage(p);
      doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.line(L, 276, R, 276);
      doc.setTextColor(...INK); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
      doc.text("Thank you! Visit again.", L, 283);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...GREY);
      doc.text("This is a computer-generated bill and does not need a signature.", L, 288);
      doc.text(`Powered by My Market${pages > 1 ? `  ·  Page ${p - firstPage + 1} of ${pages}` : ""}`, R, 288, { align: "right" });
    }
    return doc;
  }
  const fileName = (b, s) => `${String(s.name).replace(/[^\w]+/g, "-").replace(/^-|-$/g, "")}-bill-${b.no}.pdf`;
  window.MM_BILLPDF = { make, inWords, fileName };
})();
