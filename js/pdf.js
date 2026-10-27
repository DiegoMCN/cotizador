/**
 * GENERADOR DE PDF (jsPDF, fuente Helvetica)
 * ---------------------------------------------------------------
 * Helvetica solo admite caracteres WinAnsi: acentos y ñ sí; evita
 * símbolos como ≈ → ✓ (se verían rotos).
 */
(function () {
  'use strict';

  const BRAND = [179, 21, 95];
  const INK = [36, 26, 47];
  const MUTED = [100, 90, 112];
  const LINE = [227, 220, 233];
  const SOFT = [252, 237, 244];
  const PAGE_W = 210;
  const PAGE_H = 297;
  const M = 18;
  const W = PAGE_W - M * 2;

  const money = (n) => '$' + Number(n).toLocaleString('es-MX', { maximumFractionDigits: 0 });
  const LEVEL = { baja: 'bajo', media: 'medio', alta: 'alto' };
  const weeksLabel = (a, b) => (a === b ? 'Semana ' + a : 'Semanas ' + a + ' a ' + b);

  function build(q, state, cfg) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const c = state.client;
    let y = M;

    const set = (size, style, color) => {
      doc.setFont('helvetica', style || 'normal');
      doc.setFontSize(size);
      doc.setTextColor.apply(doc, color || INK);
    };
    const ensure = (h) => {
      if (y + h > PAGE_H - 20) { doc.addPage(); y = M; }
    };
    const wrap = (text, width) => doc.splitTextToSize(String(text), width);
    const para = (text, size, color, width, lh) => {
      set(size, 'normal', color);
      const lines = wrap(text, width || W);
      const step = lh || size * 0.42;
      lines.forEach((ln) => { ensure(step); doc.text(ln, M, y); y += step; });
    };
    const rule = () => { doc.setDrawColor.apply(doc, LINE); doc.setLineWidth(0.25); doc.line(M, y, M + W, y); };
    const heading = (text) => {
      ensure(16);
      y += 5;
      set(14, 'bold');
      doc.text(text, M, y);
      y += 2;
      doc.setDrawColor.apply(doc, BRAND);
      doc.setLineWidth(0.6);
      doc.line(M, y, M + 12, y);
      y += 5;
    };

    /* ---- Encabezado ---- */
    doc.setFillColor.apply(doc, BRAND);
    doc.rect(0, 0, PAGE_W, 34, 'F');
    set(22, 'bold', [255, 255, 255]);
    doc.text('Cotización', M, 16);
    set(10.5, 'normal', [255, 255, 255]);
    doc.text(cfg.projectName, M, 23);
    doc.text('Folio ' + state.quoteId, PAGE_W - M, 16, { align: 'right' });
    const created = new Date(state.createdAt || Date.now());
    const until = new Date(created.getTime() + cfg.validityDays * 86400000);
    const fmt = (d) => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.text(fmt(created), PAGE_W - M, 23, { align: 'right' });
    y = 44;

    /* ---- Partes ---- */
    const colW = W / 2 - 4;
    set(9, 'bold', MUTED); doc.text('PREPARADA PARA', M, y); doc.text('PREPARADA POR', M + colW + 8, y);
    y += 5.5;
    set(12, 'bold'); doc.text(c.name, M, y); doc.text(cfg.developer.name, M + colW + 8, y);
    y += 5;
    set(10, 'normal', MUTED);
    const left = [c.clinic, c.email, c.phone, c.city].filter(Boolean);
    const right = [cfg.developer.role, cfg.developer.email, cfg.developer.whatsapp].filter(Boolean);
    const rows = Math.max(left.length, right.length);
    for (let i = 0; i < rows; i++) {
      if (left[i]) doc.text(wrap(left[i], colW)[0], M, y);
      if (right[i]) doc.text(wrap(right[i], colW)[0], M + colW + 8, y);
      y += 4.8;
    }
    y += 3;

    /* ---- Cifras ---- */
    const boxW = (W - 8) / 3;
    const kpis = [
      ['Inversión de desarrollo', money(q.total) + ' MXN', true],
      ['Soporte mensual', money(q.support.monthly), false],
      ['Tiempo estimado', q.weeks + (q.weeks === 1 ? ' semana' : ' semanas'), false],
    ];
    kpis.forEach((k, i) => {
      const x = M + i * (boxW + 4);
      if (k[2]) doc.setFillColor.apply(doc, INK); else doc.setFillColor.apply(doc, SOFT);
      doc.roundedRect(x, y, boxW, 22, 3, 3, 'F');
      set(8.5, 'normal', k[2] ? [216, 207, 226] : MUTED);
      doc.text(k[0], x + 4, y + 7);
      set(15, 'bold', k[2] ? [255, 255, 255] : INK);
      doc.text(k[1], x + 4, y + 16);
    });
    y += 28;
    para('Pago: ' + cfg.payment + ' Vigente hasta el ' + fmt(until) + '.', 9.5, MUTED);

    /* ---- Fases ---- */
    heading('Fases del desarrollo');
    q.phases.forEach((p) => {
      ensure(22 + p.items.length * 5.4);
      doc.setFillColor.apply(doc, BRAND);
      doc.circle(M + 3, y - 1.3, 3, 'F');
      set(9, 'bold', [255, 255, 255]);
      doc.text(String(p.number), M + 3, y + 0.1, { align: 'center' });
      set(12, 'bold');
      doc.text('Fase ' + p.number + ' · ' + p.name, M + 9, y);
      doc.text(money(p.price), M + W, y, { align: 'right' });
      y += 4.8;
      set(9, 'normal', MUTED);
      doc.text(weeksLabel(p.startWeek, p.endWeek), M + 9, y);
      y += 4.4;
      if (p.goal) {
        set(9.5, 'normal', MUTED);
        wrap(p.goal, W - 9).forEach((ln) => { ensure(4.4); doc.text(ln, M + 9, y); y += 4.4; });
      }
      y += 1;
      p.items.forEach((l) => {
        ensure(5.4);
        set(10, 'normal', l.extra ? MUTED : INK);
        const label = (l.extra ? '+ ' : '') + l.name + (l.custom ? ' (estimado)' : '');
        doc.text(wrap(label, W - 40)[0], M + (l.extra ? 13 : 9), y);
        doc.text(money(l.price), M + W, y, { align: 'right' });
        y += 5.2;
        doc.setDrawColor.apply(doc, LINE);
        doc.setLineWidth(0.15);
        doc.line(M + 9, y - 3.6, M + W, y - 3.6);
      });
      y += 4;
    });

    /* ---- Módulos propios ---- */
    const customs = q.lines.filter((l) => l.custom && l.desc);
    if (customs.length) {
      heading('Tus ideas');
      customs.forEach((l) => {
        set(10.5, 'bold'); ensure(6); doc.text(l.name, M, y); y += 4.8;
        para(l.desc, 9.5, MUTED);
        y += 1.5;
      });
    }

    /* ---- Soporte ---- */
    heading('Soporte mensual');
    const s = q.support;
    const supRows = [['Plataforma base (cuentas, respaldos, actualizaciones)', money(s.base)]];
    ['baja', 'media', 'alta'].forEach((lv) => {
      const b = s.byLevel[lv];
      if (b.count) supRows.push([b.count + (b.count === 1 ? ' módulo' : ' módulos') + ' de mantenimiento ' + LEVEL[lv] + ' (' + money(b.unit) + ' c/u)', money(b.amount)]);
    });
    supRows.forEach((r) => {
      ensure(6);
      set(10, 'normal'); doc.text(r[0], M, y); doc.text(r[1], M + W, y, { align: 'right' }); y += 5.4;
    });
    rule(); y += 5;
    set(11, 'bold'); doc.text('Soporte mensual (redondeado)', M, y); doc.text(money(s.monthly), M + W, y, { align: 'right' });
    y += 6;
    para('Incluye correcciones, actualizaciones de seguridad, respaldos y atención a dudas.', 9.5, MUTED);

    /* ---- Tiendas ---- */
    heading(cfg.stores.title);
    para(cfg.stores.text, 10, INK, W, 4.6);
    y += 1.5;
    para(cfg.stores.note, 9.5, MUTED);

    /* ---- Terceros ---- */
    heading('Servicios de terceros (no incluidos)');
    para('Se contratan a tu nombre y se pagan directo a cada proveedor.', 9.5, MUTED);
    y += 1.5;
    cfg.thirdParty.filter((t) => !t.needs || q.lines.some((l) => l.id === t.needs)).forEach((t) => {
      ensure(16);
      set(10.5, 'bold'); doc.text(t.name, M, y); y += 4.6;
      para(t.use, 9.5, MUTED);
      para(t.cost, 9.5, INK);
      y += 2;
    });

    /* ---- Condiciones ---- */
    heading('Condiciones');
    cfg.terms.forEach((t) => {
      set(9.5, 'normal');
      const lines = wrap(t, W - 5);
      ensure(lines.length * 4.4 + 1);
      doc.text('•', M, y);
      lines.forEach((ln) => { doc.text(ln, M + 5, y); y += 4.4; });
      y += 1;
    });

    /* ---- Pie de página ---- */
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      set(8.5, 'normal', MUTED);
      doc.text(cfg.developer.name + ' · ' + state.quoteId, M, PAGE_H - 10);
      doc.text('Página ' + i + ' de ' + n, PAGE_W - M, PAGE_H - 10, { align: 'right' });
    }
    return doc;
  }

  function download(q, state, cfg) {
    build(q, state, cfg).save('Cotizacion-' + (state.quoteId || 'borrador') + '.pdf');
  }

  window.CotizadorPDF = { build, download };
})();
