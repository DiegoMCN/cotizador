/**
 * COTIZADOR · interfaz
 * ---------------------------------------------------------------
 * Flujo: 0 Tus datos -> 1 Módulos -> 2 Resumen -> 3 Listo.
 * Todo el cálculo vive en engine.js; aquí solo se dibuja y se
 * reacciona a la clienta. Sin dependencias, sin build.
 */
(function () {
  'use strict';

  const CFG = window.COTIZADOR_CONFIG;
  const CAT = window.COTIZADOR_CATALOG;
  const Engine = window.CotizadorEngine;
  const STORE_KEY = 'cotizador:v1';
  const STEP_NAMES = ['Tus datos', 'Módulos', 'Resumen'];
  const MAX_CUSTOMS = 5;

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const byId = {};
  CAT.items.forEach((it) => (byId[it.id] = it));

  const money = (n) =>
    '$' + Number(n).toLocaleString('es-MX', { maximumFractionDigits: 0 });
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const weeksLabel = (a, b) => (a === b ? 'Semana ' + a : 'Semanas ' + a + ' a ' + b);
  const SIDE = { paciente: 'Lo usa el paciente', 'nutrióloga': 'Lo usas tú', ambos: 'Pacientes y tú' };
  const LEVEL = { baja: 'Mantenimiento bajo', media: 'Mantenimiento medio', alta: 'Mantenimiento alto' };

  /* ---------------- Estado ---------------- */
  const blank = () => ({
    step: 0,
    client: { name: '', clinic: '', email: '', phone: '', city: '', patients: '', idea: '', consent: false },
    selected: [],
    customs: [],
    quoteId: '',
    createdAt: '',
    result: null, // { status: 'sent' | 'demo' | 'failed' }
  });
  let state = blank();
  let prevPhaseSig = {};
  let sending = false;

  function save() {
    try {
      const { step, client, selected, customs } = state;
      localStorage.setItem(STORE_KEY, JSON.stringify({ step: Math.min(step, 2), client, selected, customs }));
    } catch (e) { /* sin almacenamiento: no pasa nada */ }
  }
  function restore() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.client) Object.assign(state.client, d.client);
      if (Array.isArray(d.selected)) state.selected = d.selected.filter((id) => byId[id] && !byId[id].base);
      if (Array.isArray(d.customs)) state.customs = d.customs.slice(0, MAX_CUSTOMS);
      state.step = d.step >= 0 && d.step <= 2 ? d.step : 0;
      if (state.step > 0 && !validClient()) state.step = 0;
    } catch (e) { /* borrador dañado: se ignora */ }
  }
  function clearDraft() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) { /* nada */ }
  }

  const quote = () => Engine.buildQuote({ selected: state.selected, customs: state.customs }, CAT, CFG);

  /* ---------------- Validación ---------------- */
  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  const phoneOk = (v) => v.replace(/\D/g, '').length >= 10;
  function clientErrors() {
    const c = state.client;
    const e = {};
    if (c.name.trim().length < 2) e.name = 'Escribe tu nombre completo.';
    if (!emailOk(c.email.trim())) e.email = 'Escribe un correo válido, por ejemplo nombre@correo.com.';
    if (!phoneOk(c.phone)) e.phone = 'Escribe un teléfono de 10 dígitos para contactarte.';
    if (!c.consent) e.consent = 'Necesitamos tu autorización para usar tus datos en esta cotización.';
    return e;
  }
  const validClient = () => Object.keys(clientErrors()).length === 0;

  /* ---------------- Encabezado ---------------- */
  function renderSteps() {
    const el = $('#steps');
    el.innerHTML = STEP_NAMES.map((n, i) => {
      const st = state.step > i ? 'done' : state.step === i ? 'current' : 'todo';
      return `<li data-state="${st}"${st === 'current' ? ' aria-current="step"' : ''}><span>${i + 1}. ${n}</span></li>`;
    }).join('');
    $('#brandSub').textContent = CFG.projectName;
  }

  /* ---------------- Paso 0 · Datos ---------------- */
  function fieldHTML(id, label, opts) {
    const o = opts || {};
    const v = esc(state.client[id]);
    const req = o.req ? '' : ' <span class="opt">(opcional)</span>';
    const type = o.type || 'text';
    const common = `id="f_${id}" name="${id}" class="input" value="${v}" autocomplete="${o.ac || 'off'}"${o.req ? ' required' : ''} aria-describedby="e_${id}"`;
    const inputmode = o.mode ? ` inputmode="${o.mode}"` : '';
    return `<div class="field" data-field="${id}">
      <label for="f_${id}">${label}${req}</label>
      <input type="${type}"${inputmode} ${common}>
      <p class="err" id="e_${id}" role="alert" hidden></p>
    </div>`;
  }

  function viewData() {
    const c = state.client;
    return `
      <div>
        <h1 class="title">Cotiza tu app a tu medida</h1>
        <p class="lede">Cuéntanos quién eres, elige los módulos que quieres y mira cómo cambian el precio, el soporte y las fases del desarrollo mientras decides. Al final recibes tu cotización en PDF.</p>
      </div>
      <form class="form panel" id="dataForm" novalidate>
        <h2 class="h2">Tus datos</h2>
        <div class="grid-2">
          ${fieldHTML('name', 'Nombre completo', { req: 1, ac: 'name' })}
          ${fieldHTML('clinic', 'Consultorio o marca', { ac: 'organization' })}
        </div>
        <div class="grid-2">
          ${fieldHTML('email', 'Correo electrónico', { req: 1, type: 'email', ac: 'email', mode: 'email' })}
          ${fieldHTML('phone', 'Teléfono o WhatsApp', { req: 1, type: 'tel', ac: 'tel', mode: 'tel' })}
        </div>
        <div class="grid-2">
          ${fieldHTML('city', 'Ciudad', { ac: 'address-level2' })}
          <div class="field">
            <label for="f_patients">Pacientes activos <span class="opt">(aprox., opcional)</span></label>
            <select id="f_patients" name="patients" class="select">
              <option value="">Elegir…</option>
              ${CFG.patientRanges.map((r) => `<option${c.patients === r ? ' selected' : ''}>${esc(r)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="field">
          <label for="f_idea">¿Qué quieres lograr con tu app? <span class="opt">(opcional)</span></label>
          <textarea id="f_idea" name="idea" class="textarea" maxlength="600" placeholder="Cuéntalo con tus palabras. Más adelante puedes proponer tus propios módulos.">${esc(c.idea)}</textarea>
        </div>
        <div class="hp" aria-hidden="true"><label>No llenar<input type="text" id="f_website" tabindex="-1" autocomplete="off"></label></div>
        <div class="field" data-field="consent">
          <div class="check-line">
            <input class="box" type="checkbox" id="f_consent" name="consent"${c.consent ? ' checked' : ''} aria-describedby="e_consent">
            <label for="f_consent">${esc(CFG.privacy)}</label>
          </div>
          <p class="err" id="e_consent" role="alert" hidden></p>
        </div>
        <button class="btn btn-primary btn-block" type="submit">Elegir mis módulos</button>
      </form>`;
  }

  function showFieldErrors(errs) {
    $$('[data-field]').forEach((f) => {
      const id = f.dataset.field;
      const p = $('.err', f);
      if (!p) return;
      if (errs[id]) {
        p.textContent = errs[id];
        p.hidden = false;
        f.dataset.invalid = 'true';
        const inp = $('input,select,textarea', f);
        if (inp) inp.setAttribute('aria-invalid', 'true');
      } else {
        p.hidden = true;
        delete f.dataset.invalid;
        const inp = $('input,select,textarea', f);
        if (inp) inp.removeAttribute('aria-invalid');
      }
    });
  }

  function submitData(ev) {
    ev.preventDefault();
    const errs = clientErrors();
    showFieldErrors(errs);
    const first = Object.keys(errs)[0];
    if (first) {
      const target = $('#f_' + first);
      if (target) target.focus();
      return;
    }
    goto(1);
  }

  /* ---------------- Paso 1 · Módulos ---------------- */
  function metaTags(it) {
    const tags = [];
    if (it.side) tags.push(`<span class="tag">${esc(SIDE[it.side] || it.side)}</span>`);
    if (it.days) tags.push(`<span class="tag num">≈ ${it.days} ${it.days === 1 ? 'día' : 'días'} de trabajo</span>`);
    if (it.level) tags.push(`<span class="tag tag-${it.level}">${LEVEL[it.level]}</span>`);
    return tags.join('');
  }

  function detailsHTML(it, cls) {
    return `<details class="${cls}">
      <summary>Cómo funciona y para qué sirve</summary>
      <dl>
        <div><dt>Cómo funciona</dt><dd>${esc(it.how)}</dd></div>
        <div><dt>Para qué te sirve</dt><dd>${esc(it.why)}</dd></div>
      </dl>
    </details>`;
  }

  function moduleHTML(it) {
    const extras = CAT.items.filter((x) => x.parent === it.id);
    const id = 'm_' + it.id;
    return `<li class="mod" data-mod="${it.id}">
      <div class="mod-head">
        <input class="box" type="checkbox" id="${id}" data-pick="${it.id}" aria-describedby="${id}_lead">
        <label class="mod-title" for="${id}">${esc(it.name)}</label>
        <span class="mod-price num">${money(it.price)}</span>
      </div>
      <p class="mod-lead" id="${id}_lead">${esc(it.lead)}</p>
      <div class="mod-meta">${metaTags(it)}</div>
      ${detailsHTML(it, 'more')}
      ${extras.length ? `<div class="extras" data-extras="${it.id}" hidden>
        <p class="extras-title">Opcionales para este módulo</p>
        ${extras.map(extraHTML).join('')}
      </div>` : ''}
      <div data-warn="${it.id}"></div>
    </li>`;
  }

  function extraHTML(x) {
    const id = 'm_' + x.id;
    return `<div class="extra" data-mod="${x.id}">
      <input class="box" type="checkbox" id="${id}" data-pick="${x.id}">
      <label class="extra-name" for="${id}">${esc(x.name)}</label>
      <span class="mod-price num">+ ${money(x.price)}</span>
      <p class="extra-lead">${esc(x.lead)}</p>
      <div class="extra-more">${detailsHTML(x, 'more')}</div>
    </div>`;
  }

  function baseHTML() {
    const base = CAT.items.filter((i) => i.base);
    return `<section class="group" aria-labelledby="g_base">
      <div><h2 class="h2" id="g_base">Incluido siempre</h2>
      <p class="sub">La base sobre la que se construye todo lo demás. No se puede quitar.</p></div>
      <ul class="mods">${base.map((it) => `<li class="mod is-on">
        <div class="mod-head">
          <input class="box" type="checkbox" checked disabled aria-label="${esc(it.name)} (incluido)">
          <span class="mod-title">${esc(it.name)}</span>
          <span class="mod-price num">${money(it.price)}</span>
        </div>
        <p class="mod-lead">${esc(it.lead)}</p>
        ${detailsHTML(it, 'more')}
      </li>`).join('')}</ul>
    </section>`;
  }

  function customFormHTML() {
    return `<section class="group" aria-labelledby="g_custom">
      <div><h2 class="h2" id="g_custom">¿Tienes otra idea?</h2>
      <p class="sub">Propón tus propios módulos. Se ven en la cotización con un precio estimado según su tamaño y se confirman contigo antes de construirlos.</p></div>
      <ul class="custom-list" id="customList"></ul>
      <form class="custom-form panel" id="customForm" novalidate>
        <div class="field">
          <label for="c_name">Nombre del módulo</label>
          <input class="input" id="c_name" maxlength="60" placeholder="Ej. Recetario con fotos">
          <p class="err" id="c_err" role="alert" hidden></p>
        </div>
        <div class="field">
          <label for="c_desc">¿Qué debería hacer? <span class="opt">(opcional)</span></label>
          <textarea class="textarea" id="c_desc" maxlength="300"></textarea>
        </div>
        <fieldset class="tiers">
          <legend class="legend">Tamaño aproximado</legend>
          ${CFG.customTiers.map((t, i) => `<label class="tier">
            <input class="radio" type="radio" name="tier" value="${t.id}"${i === 1 ? ' checked' : ''}>
            <span><span class="tier-name">${esc(t.name)}</span><br><span class="tier-hint">${esc(t.hint)}</span></span>
            <span class="mod-price num">${money(t.price)}</span>
          </label>`).join('')}
        </fieldset>
        <button class="btn btn-ghost btn-block" type="submit">Agregar mi módulo</button>
      </form>
    </section>`;
  }

  function viewModules() {
    const groups = CAT.groups.map((g) => {
      const items = CAT.items.filter((i) => i.group === g.id && !i.parent && !i.base);
      if (!items.length) return '';
      return `<section class="group" aria-labelledby="g_${g.id}">
        <div class="group-head"><div><h2 class="h2" id="g_${g.id}">${esc(g.name)}</h2>
        <p class="sub">${esc(g.blurb)}</p></div>
        <span class="group-count num" data-count="${g.id}"></span></div>
        <ul class="mods">${items.map(moduleHTML).join('')}</ul>
      </section>`;
    }).join('');
    return `
      <div>
        <h1 class="title">Elige tus módulos</h1>
        <p class="lede">Marca lo que quieres en tu app. Cada módulo explica cómo funciona y para qué te sirve; el precio, el soporte y las fases se actualizan al instante.</p>
      </div>
      <div class="panel">
        <p class="legend">Empieza desde un paquete</p>
        <p class="sub">Puedes ajustarlo después, módulo por módulo.</p>
        <div class="presets" style="margin-top:12px">
          ${CAT.presets.map((p) => `<button type="button" class="chip-btn" data-action="preset" data-id="${p.id}">${esc(p.name)}</button>`).join('')}
        </div>
      </div>
      <details class="legend-box panel">
        <summary>¿Qué significa “mantenimiento”?</summary>
        <ul>${Engine.LEVELS.map((l) => `<li><strong>${LEVEL[l]}:</strong> ${esc(CFG.support.levelNotes[l])}</li>`).join('')}</ul>
        <p class="hint" style="margin-top:8px">El soporte mensual se calcula con estos niveles: cuanto más cuidado necesitan los módulos que elijas, mayor es el soporte.</p>
      </details>
      ${baseHTML()}
      ${groups}
      ${customFormHTML()}
      <div id="issueAlert" role="alert"></div>
      <div class="actions nav-inline">
        <button class="btn btn-primary" type="button" data-action="next">Ver mi resumen</button>
        <button class="btn btn-ghost" type="button" data-action="back">Volver a mis datos</button>
      </div>`;
  }

  function presetHTMLNote() { return ''; }

  /* Refleja el estado en las tarjetas sin volver a dibujarlas */
  function syncModules(q) {
    const sel = new Set(state.selected);
    $$('[data-pick]').forEach((cb) => {
      cb.checked = sel.has(cb.dataset.pick);
    });
    $$('li.mod[data-mod]').forEach((li) => li.classList.toggle('is-on', sel.has(li.dataset.mod)));
    $$('[data-extras]').forEach((box) => {
      box.hidden = !sel.has(box.dataset.extras);
    });
    // Contadores por grupo
    CAT.groups.forEach((g) => {
      const ids = CAT.items.filter((i) => i.group === g.id && !i.parent && !i.base).map((i) => i.id);
      const n = ids.filter((id) => sel.has(id)).length;
      const el = $(`[data-count="${g.id}"]`);
      if (el) el.textContent = n ? n + ' de ' + ids.length : '';
    });
    // Avisos de requisitos
    $$('[data-warn]').forEach((w) => (w.innerHTML = ''));
    q.issues.forEach((iss) => {
      const it = byId[iss.id];
      const holder = it.parent ? $(`[data-warn="${it.parent}"]`) : $(`[data-warn="${it.id}"]`);
      if (!holder) return;
      const names = iss.candidates.map((c) => byId[c].name);
      const text = iss.type === 'needs'
        ? `<strong>Falta un requisito:</strong> “${esc(it.name)}” necesita “${esc(names[0])}”.`
        : `<strong>Falta un requisito:</strong> “${esc(it.name)}” necesita al menos uno de estos módulos: ${names.map((n) => '“' + esc(n) + '”').join(' o ')}.`;
      const btns = iss.candidates.map((c) => `<button type="button" class="chip-btn" data-action="fix" data-id="${c}">Agregar ${esc(byId[c].name)}</button>`).join('');
      holder.insertAdjacentHTML('beforeend', `<div class="warn"><p>${text}</p><div class="warn-actions">${btns}</div></div>`);
    });
    const alertEl = $('#issueAlert');
    if (alertEl && !q.issues.length) alertEl.innerHTML = '';
  }

  function renderCustoms() {
    const list = $('#customList');
    if (!list) return;
    const q = quote();
    list.innerHTML = state.customs.map((c) => {
      const line = q.lines.find((l) => l.id === 'custom:' + c.id);
      return `<li class="custom-item">
        <p><strong>${esc(c.name)}</strong>${c.desc ? `<br><span class="hint">${esc(c.desc)}</span>` : ''}<br><span class="tag">Tamaño ${esc(line ? line.tier : c.tier)} · estimado</span></p>
        <span class="mod-price num">${money(line ? line.price : 0)}</span>
        <button type="button" class="btn-text" data-action="del-custom" data-id="${esc(c.id)}">Quitar</button>
      </li>`;
    }).join('');
    const form = $('#customForm');
    if (form) form.hidden = state.customs.length >= MAX_CUSTOMS;
  }

  function addCustom(ev) {
    ev.preventDefault();
    const name = $('#c_name').value.trim();
    const err = $('#c_err');
    if (name.length < 3) {
      err.textContent = 'Ponle un nombre de al menos 3 letras.';
      err.hidden = false;
      $('#c_name').focus();
      return;
    }
    err.hidden = true;
    state.customs.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      name,
      desc: $('#c_desc').value.trim(),
      tier: $('input[name="tier"]:checked').value,
    });
    $('#c_name').value = '';
    $('#c_desc').value = '';
    renderCustoms();
    refresh();
    toast('Módulo agregado a tu cotización');
  }

  /* ---------------- Paso 2 · Resumen ---------------- */
  function railHTML(q, compact, flash) {
    return `<ol class="rail${compact ? ' rail-compact' : ''}">${q.phases.map((p) => {
      const items = p.items.map((l) => `<li class="${l.extra ? 'sub-li' : ''}"><span>${l.extra ? '+ ' : ''}${esc(l.name)}${l.custom ? ' <span class="est">(estimado)</span>' : ''}</span><span class="num">${money(l.price)}</span></li>`).join('');
      return `<li class="phase${flash && flash.has(p.key) ? ' pulse' : ''}">
        <span class="phase-node" aria-hidden="true">${p.number}</span>
        <div class="phase-head"><h3 class="phase-name">Fase ${p.number} · ${esc(p.name)}</h3><span class="phase-price num">${money(p.price)}</span></div>
        <p class="phase-when num">${weeksLabel(p.startWeek, p.endWeek)}</p>
        ${p.goal && !compact ? `<p class="phase-goal">${esc(p.goal)}</p>` : ''}
        <ul class="phase-items">${items}</ul>
      </li>`;
    }).join('')}</ol>`;
  }

  function supportRows(q) {
    const s = q.support;
    const rows = [`<tr><td>Plataforma base (cuentas, respaldos, actualizaciones)</td><td class="num">${money(s.base)}</td></tr>`];
    Engine.LEVELS.forEach((lv) => {
      const b = s.byLevel[lv];
      if (b.count) rows.push(`<tr><td>${b.count} ${b.count === 1 ? 'módulo' : 'módulos'} de ${LEVEL[lv].toLowerCase()} (${money(b.unit)} c/u)</td><td class="num">${money(b.amount)}</td></tr>`);
    });
    return rows.join('');
  }

  function viewSummary() {
    const q = quote();
    const c = state.client;
    const first = c.name.trim().split(/\s+/)[0];
    const months = Math.max(1, Math.round(q.weeks / 4.33));
    const tp = CFG.thirdParty.filter((t) => !t.needs || q.lines.some((l) => l.id === t.needs));
    return `
      <div>
        <h1 class="title">${esc(first)}, este es tu proyecto</h1>
        <p class="lede">Revisa tu selección. Al enviarla te llevas tu cotización en PDF y yo recibo tu solicitud para platicar los detalles.</p>
      </div>
      <div class="kpis">
        <div class="kpi kpi-main"><p class="kpi-label">Inversión de desarrollo</p><p class="kpi-value num">${money(q.total)} <small>MXN</small></p><p class="kpi-note">Pago único, por fases. ${esc(CFG.payment)}</p></div>
        <div class="kpi"><p class="kpi-label">Soporte mensual</p><p class="kpi-value num">${money(q.support.monthly)} <small>/ mes</small></p><p class="kpi-note">Después de la entrega.</p></div>
        <div class="kpi"><p class="kpi-label">Tiempo estimado</p><p class="kpi-value num">${q.weeks} <small>${q.weeks === 1 ? 'semana' : 'semanas'}</small></p><p class="kpi-note">≈ ${months} ${months === 1 ? 'mes' : 'meses'}, ${q.phases.length} fases.</p></div>
      </div>
      <section class="group" aria-labelledby="s_phases">
        <div><h2 class="h2" id="s_phases">Fases del desarrollo</h2>
        <p class="sub">Se construye por etapas: al final de cada fase ves algo funcionando y lo apruebas antes de seguir.</p></div>
        <div class="panel">${railHTML(q, false)}</div>
      </section>
      <section class="group" aria-labelledby="s_support">
        <div><h2 class="h2" id="s_support">Cómo se calcula el soporte</h2>
        <p class="sub">Depende de cuánto mantenimiento exigen los módulos que elegiste y de la app en general.</p></div>
        <div class="panel"><table class="table">
          <thead><tr><th>Concepto</th><th>Mensual</th></tr></thead>
          <tbody>${supportRows(q)}</tbody>
          <tfoot><tr><td>Soporte mensual (redondeado)</td><td class="num">${money(q.support.monthly)}</td></tr></tfoot>
        </table>
        <p class="hint" style="margin-top:10px">Incluye correcciones, actualizaciones de seguridad, respaldos y atención a dudas. Los cambios de alcance se cotizan aparte.</p></div>
      </section>
      <section class="store" aria-labelledby="s_store">
        <h2 class="h2" id="s_store">${esc(CFG.stores.title)}</h2>
        <p>${esc(CFG.stores.text)}</p>
        <p class="hint">${esc(CFG.stores.note)}</p>
      </section>
      <section class="group" aria-labelledby="s_tp">
        <div><h2 class="h2" id="s_tp">Servicios de terceros</h2>
        <p class="sub">No están incluidos en el precio: se contratan a tu nombre y se pagan directo a cada proveedor.</p></div>
        <div class="panel"><ul class="cost-list">${tp.map((t) => `<li><span class="cost-name">${esc(t.name)}</span><span class="cost-use">${esc(t.use)}</span><span class="cost-cost">${esc(t.cost)}</span></li>`).join('')}</ul></div>
      </section>
      <details class="acc">
        <summary>Condiciones</summary>
        <div class="acc-body"><ul class="terms">${CFG.terms.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        <p class="hint">Vigencia de la cotización: ${CFG.validityDays} días.</p></div>
      </details>
      <div class="actions nav-inline">
        <button class="btn btn-primary" type="button" data-action="submit">Enviar y obtener mi PDF</button>
        <button class="btn btn-ghost" type="button" data-action="back">Editar mis módulos</button>
      </div>`;
  }

  /* ---------------- Paso 3 · Listo ---------------- */
  function viewDone() {
    const r = state.result || { status: 'demo' };
    const sent = r.status === 'sent';
    const failed = r.status === 'failed';
    const head = failed ? 'Tu PDF está listo, pero no pudimos enviar la solicitud'
      : 'Listo, ' + esc(state.client.name.trim().split(/\s+/)[0]);
    const msg = sent ? 'Recibimos tu solicitud y tu cotización se descargó como PDF. Te contactaré pronto para platicar los detalles.'
      : failed ? 'Descarga tu PDF y envíamelo por correo o WhatsApp para que lo reciba. Puedes intentar el envío de nuevo cuando tengas conexión.'
      : 'Tu cotización se descargó como PDF. (Modo de prueba: esta solicitud no se guardó en ninguna hoja.)';
    const contact = [CFG.developer.email, CFG.developer.whatsapp].filter(Boolean).map(esc).join(' · ');
    return `
      <div class="done">
        <div class="done-badge"${failed ? ' data-tone="warn"' : ''} aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <h1 class="title">${head}</h1>
        <p class="done-id">Folio ${esc(state.quoteId)}</p>
        <p class="lede">${msg}</p>
        ${contact ? `<p class="hint">Contacto: ${contact}</p>` : ''}
        <ol class="next-list">
          <li>Revisa el PDF con calma.</li>
          <li>Platicamos el alcance y ajustamos lo que haga falta.</li>
          <li>Se confirma la primera fase y arrancamos.</li>
        </ol>
        <div class="actions">
          <button class="btn btn-primary" type="button" data-action="pdf">Descargar PDF otra vez</button>
          ${failed ? '<button class="btn btn-ghost" type="button" data-action="retry">Reintentar envío</button>' : ''}
          <button class="btn btn-ghost" type="button" data-action="restart">Hacer otra cotización</button>
        </div>
      </div>`;
  }

  /* ---------------- Resumen en vivo (barra, hoja, panel) ---------------- */
  function liveHTML(q, flash) {
    return `<div class="live">
      <div class="live-total"><span class="live-meta">Inversión estimada</span><span class="big num">${money(q.total)}</span>
        <span class="live-meta num">${q.weeks} ${q.weeks === 1 ? 'semana' : 'semanas'} · ${q.moduleCount + q.customCount} ${q.moduleCount + q.customCount === 1 ? 'módulo' : 'módulos'}${q.extraCount ? ' + ' + q.extraCount + ' extras' : ''}</span></div>
      <div class="live-total"><span class="live-meta">Soporte mensual</span><span class="big num" style="font-size:24px">${money(q.support.monthly)}</span></div>
      <div><p class="live-title">Fases según tu selección</p>${railHTML(q, true, flash)}</div>
      <p class="live-note">Empieza como webapp y después se publica en App Store y Google Play. Montos en MXN.</p>
    </div>`;
  }

  function refresh() {
    const q = quote();
    syncModules(q);
    updateLive(q);
    save();
  }

  function updateLive(q) {
    q = q || quote();
    const sig = {};
    q.phases.forEach((p) => (sig[p.key] = p.price + ':' + p.items.length));
    const flash = new Set();
    Object.keys(sig).forEach((k) => {
      if (prevPhaseSig[k] !== undefined && prevPhaseSig[k] !== sig[k]) flash.add(Number(k));
      if (prevPhaseSig[k] === undefined && Object.keys(prevPhaseSig).length) flash.add(Number(k));
    });
    prevPhaseSig = sig;
    $('#barTotal').textContent = money(q.total);
    $('#barSupport').textContent = 'Soporte ' + money(q.support.monthly) + '/mes · ' + q.weeks + ' sem.';
    const html = liveHTML(q, flash);
    $('#aside').innerHTML = html;
    if ($('#sheet').open) $('#sheetBody').innerHTML = html;
  }

  /* ---------------- Navegación ---------------- */
  function render() {
    const views = [viewData, viewModules, viewSummary, viewDone];
    $('#view').innerHTML = views[state.step]();
    renderSteps();
    const live = state.step === 1 || state.step === 2;
    const layout = $('#layout');
    layout.dataset.bar = live ? 'on' : 'off';
    layout.dataset.aside = live ? 'on' : 'off';
    $('#bar').hidden = !live;
    const go = $('#barGo');
    go.dataset.action = state.step === 2 ? 'submit' : 'next';
    go.textContent = state.step === 2 ? 'Enviar y obtener PDF' : 'Continuar';
    if (state.step === 0) $('#dataForm').addEventListener('submit', submitData);
    if (state.step === 1) {
      $('#customForm').addEventListener('submit', addCustom);
      renderCustoms();
    }
    if (live) {
      prevPhaseSig = {};
      if (state.step === 1) refresh(); else { updateLive(); save(); }
    } else save();
  }

  function goto(step, opts) {
    state.step = step;
    render();
    const v = $('#view');
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (!opts || !opts.silent) v.focus({ preventScroll: true });
    if (step === 3) clearDraft();
  }

  function next() {
    if (state.step === 0) { $('#dataForm').requestSubmit(); return; }
    if (state.step === 1) {
      const q = quote();
      if (q.issues.length) {
        $('#issueAlert').innerHTML = `<p class="alert" data-tone="bad">Hay ${q.issues.length === 1 ? 'un módulo' : q.issues.length + ' módulos'} con requisitos pendientes. Usa los botones amarillos de cada tarjeta para resolverlo.</p>`;
        const w = $('.warn');
        if (w) w.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      goto(2);
    }
  }

  /* ---------------- Envío y PDF ---------------- */
  function newId() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
    return 'COT-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + rnd;
  }

  function payload(q) {
    return {
      id: state.quoteId,
      createdAt: state.createdAt,
      client: Object.assign({}, state.client, { website: ($('#f_website') || {}).value || '' }),
      total: q.total,
      weeks: q.weeks,
      supportMonthly: q.support.monthly,
      phases: q.phases.length,
      lines: q.lines.map((l) => ({
        id: l.id, name: l.name, phase: l.phase, price: l.price, days: l.days, level: l.level,
        custom: l.custom, extra: l.extra, desc: l.desc || '', tier: l.tier || '',
      })),
    };
  }

  async function send(q) {
    if (!CFG.endpoint) return 'demo';
    try {
      const res = await fetch(CFG.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload(q)),
        redirect: 'follow',
      });
      if (!res.ok) return 'failed';
      const data = await res.json().catch(() => null);
      return data && data.ok ? 'sent' : 'failed';
    } catch (e) {
      return 'failed';
    }
  }

  function downloadPdf() {
    if (!window.CotizadorPDF) { toast('No se pudo preparar el PDF. Recarga la página.'); return false; }
    try {
      window.CotizadorPDF.download(quote(), state, CFG);
      return true;
    } catch (e) {
      console.error(e);
      toast('No se pudo generar el PDF.');
      return false;
    }
  }

  async function submit() {
    if (sending) return;
    const q = quote();
    if (q.issues.length) { goto(1); return; }
    sending = true;
    $$('[data-action="submit"]').forEach((b) => { b.setAttribute('aria-disabled', 'true'); b.textContent = 'Enviando…'; });
    if (!state.quoteId) { state.quoteId = newId(); state.createdAt = new Date().toISOString(); }
    const status = await send(q);
    state.result = { status };
    sending = false;
    downloadPdf();
    goto(3);
  }

  async function retry() {
    if (sending) return;
    sending = true;
    const status = await send(quote());
    sending = false;
    state.result = { status };
    goto(3);
  }

  /* ---------------- Eventos ---------------- */
  function applyPreset(id) {
    const p = CAT.presets.find((x) => x.id === id);
    if (!p) return;
    state.selected = Engine.presetIds(p, CAT);
    refresh();
    toast('Paquete “' + p.name + '” aplicado');
  }

  function toggle(id, on) {
    const set = new Set(state.selected);
    if (on) set.add(id); else set.delete(id);
    state.selected = Array.from(Engine.pruneSelection(Array.from(set), CAT));
    refresh();
  }

  document.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-action]');
    if (!t) return;
    const a = t.dataset.action;
    if (t.getAttribute('aria-disabled') === 'true') return;
    if (a === 'next') next();
    else if (a === 'back') goto(Math.max(0, state.step - 1));
    else if (a === 'preset') applyPreset(t.dataset.id);
    else if (a === 'fix') { toggle(t.dataset.id, true); toast('Agregado: ' + byId[t.dataset.id].name); }
    else if (a === 'del-custom') {
      state.customs = state.customs.filter((c) => c.id !== t.dataset.id);
      renderCustoms();
      refresh();
    } else if (a === 'submit') submit();
    else if (a === 'pdf') downloadPdf();
    else if (a === 'retry') retry();
    else if (a === 'restart') { state = blank(); clearDraft(); goto(0); }
    else if (a === 'close-sheet') $('#sheet').close();
  });

  document.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.matches('[data-pick]')) toggle(t.dataset.pick, t.checked);
  });

  document.addEventListener('input', (ev) => {
    const t = ev.target;
    if (state.step === 0 && t.closest('#dataForm') && t.name in state.client) {
      state.client[t.name] = t.type === 'checkbox' ? t.checked : t.value;
      const f = t.closest('[data-field]');
      if (f && f.dataset.invalid) showFieldErrors(clientErrors());
      save();
    }
  });
  $('#view').addEventListener('change', (ev) => {
    const t = ev.target;
    if (state.step === 0 && t.name in state.client) {
      state.client[t.name] = t.type === 'checkbox' ? t.checked : t.value;
      save();
    }
  });

  $('#barSum').addEventListener('click', () => {
    $('#sheetBody').innerHTML = liveHTML(quote());
    $('#sheet').showModal();
  });
  $('#sheet').addEventListener('click', (ev) => {
    if (ev.target === ev.currentTarget) ev.currentTarget.close();
  });

  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.dataset.show = 'true';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.dataset.show = 'false'), 2400);
  }

  /* ---------------- Inicio ---------------- */
  restore();
  render();
})();
