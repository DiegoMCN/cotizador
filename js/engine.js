/**
 * MOTOR DE COTIZACIÓN (funciones puras, sin DOM)
 * ---------------------------------------------------------------
 * buildQuote(input, catalog, config) calcula:
 *   - líneas de la cotización (base + módulos elegidos + propios)
 *   - fases con precio, días y semanas
 *   - soporte mensual según complejidad de mantenimiento
 *   - requisitos pendientes entre módulos
 * Se usa igual en el navegador (window.CotizadorEngine) y en las
 * pruebas de Node (tests/engine.test.mjs).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CotizadorEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DAYS_PER_WEEK = 5;
  const LEVELS = ['baja', 'media', 'alta'];

  const weeksFor = (days) => Math.max(1, Math.ceil(days / DAYS_PER_WEEK));

  function indexItems(catalog) {
    const byId = {};
    catalog.items.forEach((it) => (byId[it.id] = it));
    return byId;
  }

  /**
   * @param {{selected: string[], customs: {id:string,name:string,desc?:string,tier:string}[]}} input
   */
  function buildQuote(input, catalog, config) {
    const byId = indexItems(catalog);
    const pickedIds = new Set((input.selected || []).filter((id) => byId[id] && !byId[id].base));

    // Un extra solo existe si su módulo padre está elegido.
    const active = new Set();
    catalog.items.forEach((it) => {
      if (it.base) active.add(it.id);
    });
    catalog.items.forEach((it) => {
      if (it.base || !pickedIds.has(it.id)) return;
      if (it.parent && !pickedIds.has(it.parent)) return;
      active.add(it.id);
    });

    const chosen = catalog.items.filter((it) => active.has(it.id));

    // Requisitos pendientes
    const issues = [];
    chosen.forEach((it) => {
      if (it.base) return;
      (it.needs || []).forEach((n) => {
        if (!active.has(n)) issues.push({ id: it.id, type: 'needs', candidates: [n] });
      });
      if (it.needsAny && it.needsAny.length && !it.needsAny.some((n) => active.has(n))) {
        issues.push({ id: it.id, type: 'needsAny', candidates: it.needsAny.slice() });
      }
    });

    // Líneas
    const tiers = {};
    (config.customTiers || []).forEach((t) => (tiers[t.id] = t));
    const lines = chosen.map((it) => ({
      id: it.id,
      name: it.name,
      price: it.price,
      days: it.days,
      level: it.level || null,
      phase: it.phase,
      base: !!it.base,
      extra: !!it.parent,
      parent: it.parent || null,
      custom: false,
    }));
    (input.customs || []).forEach((c) => {
      const t = tiers[c.tier] || config.customTiers[0];
      lines.push({
        id: 'custom:' + c.id,
        name: c.name,
        price: t.price,
        days: t.days,
        level: t.level,
        phase: 6,
        base: false,
        extra: false,
        parent: null,
        custom: true,
        tier: t.name,
        desc: c.desc || '',
      });
    });

    // Fases (solo las que tienen contenido, numeradas desde 0)
    const phases = [];
    let cursor = 1;
    catalog.phases.forEach((ph) => {
      const items = lines.filter((l) => l.phase === ph.id);
      if (!items.length) return;
      const price = items.reduce((s, l) => s + l.price, 0);
      const days = items.reduce((s, l) => s + l.days, 0);
      const weeks = weeksFor(days);
      phases.push({
        key: ph.id,
        number: phases.length,
        name: ph.name,
        goal: ph.goal || '',
        items,
        price,
        days,
        weeks,
        startWeek: cursor,
        endWeek: cursor + weeks - 1,
      });
      cursor += weeks;
    });

    const total = lines.reduce((s, l) => s + l.price, 0);
    const days = lines.reduce((s, l) => s + l.days, 0);
    const weeks = phases.reduce((s, p) => s + p.weeks, 0);

    // Soporte mensual
    const sup = config.support;
    const byLevel = {};
    LEVELS.forEach((lv) => (byLevel[lv] = { count: 0, unit: sup.levels[lv], amount: 0 }));
    lines.forEach((l) => {
      if (l.level && byLevel[l.level]) {
        byLevel[l.level].count += 1;
        byLevel[l.level].amount += sup.levels[l.level];
      }
    });
    const raw = sup.base + LEVELS.reduce((s, lv) => s + byLevel[lv].amount, 0);
    const monthly = Math.round(raw / sup.roundTo) * sup.roundTo;

    return {
      lines,
      phases,
      total,
      days,
      weeks,
      support: { base: sup.base, byLevel, raw, monthly },
      issues,
      moduleCount: lines.filter((l) => !l.base && !l.extra && !l.custom).length,
      extraCount: lines.filter((l) => l.extra).length,
      customCount: lines.filter((l) => l.custom).length,
      hasCustom: lines.some((l) => l.custom),
    };
  }

  /** Ids de un preset (resuelve '*' = todo el catálogo no base). */
  function presetIds(preset, catalog) {
    if (preset.ids === '*') return catalog.items.filter((i) => !i.base).map((i) => i.id);
    return preset.ids.slice();
  }

  /** Quita de la selección los extras cuyo módulo padre ya no está. */
  function pruneSelection(selected, catalog) {
    const set = new Set(selected);
    let changed = true;
    while (changed) {
      changed = false;
      catalog.items.forEach((it) => {
        if (it.parent && set.has(it.id) && !set.has(it.parent)) {
          set.delete(it.id);
          changed = true;
        }
      });
    }
    return set;
  }

  return { buildQuote, presetIds, pruneSelection, weeksFor, LEVELS, DAYS_PER_WEEK };
});
