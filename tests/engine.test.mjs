// Pruebas del motor de cotización. Ejecutar con:  node tests/engine.test.mjs
import { createRequire } from 'node:module';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const require = createRequire(import.meta.url);
const Engine = require(path.join(root, 'js/engine.js'));

function load(file, key) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx);
  return ctx.window[key];
}
const CFG = load('js/config.js', 'COTIZADOR_CONFIG');
const CAT = load('js/catalog.js', 'COTIZADOR_CATALOG');

const q = (selected = [], customs = []) => Engine.buildQuote({ selected, customs }, CAT, CFG);
let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log('  ok  ' + name);
};

test('solo la base: $8,000, 3 semanas, soporte $200', () => {
  const r = q();
  assert.equal(r.total, 8000);
  assert.equal(r.support.monthly, 200);
  assert.equal(r.phases.length, 2);
  assert.equal(r.weeks, 3);
});

test('alcance de la primera cotización: $47,000, 16 semanas, soporte $800', () => {
  const ids = Engine.presetIds({ ids: '*' }, CAT).filter((id) => !['bitacora', 'fuera_gym'].includes(id));
  const r = q(ids);
  assert.equal(r.total, 47000);
  assert.equal(r.weeks, 16);
  assert.equal(r.support.monthly, 800);
  assert.equal(r.phases.length, 6);
  assert.deepEqual(r.issues, []);
});

test('catálogo completo: $50,000 y soporte $850', () => {
  const r = q(Engine.presetIds({ ids: '*' }, CAT));
  assert.equal(r.total, 50000);
  assert.equal(r.support.monthly, 850);
  assert.deepEqual(r.issues, []);
});

test('paquete Esencial: $29,000 y soporte $400', () => {
  const preset = CAT.presets.find((p) => p.id === 'esencial');
  const r = q(Engine.presetIds(preset, CAT));
  assert.equal(r.total, 29000);
  assert.equal(r.support.monthly, 400);
  assert.deepEqual(r.issues, []);
});

test('calendario sin sesiones marca un requisito "needsAny"', () => {
  const r = q(['calendario']);
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].type, 'needsAny');
  assert.deepEqual([...r.issues[0].candidates], ['fuerza', 'cardio']);
});

test('un extra sin su módulo padre no cuenta', () => {
  const r = q(['equivalentes']);
  assert.equal(r.total, 8000);
});

test('mapa muscular exige fuerza', () => {
  const r = q(['metricas', 'mapa']);
  assert.ok(r.issues.some((i) => i.id === 'mapa' && i.type === 'needs'));
  assert.equal(q(['metricas', 'mapa', 'fuerza']).issues.length, 0);
});

test('un módulo propio suma precio, fase y soporte', () => {
  const r = q([], [{ id: 'a', name: 'Recetas', tier: 'mediano' }]);
  assert.equal(r.total, 8000 + 6000);
  assert.equal(r.phases.at(-1).name, 'Módulos propios');
  assert.equal(r.support.monthly, 250); // 200 + 40 = 240 -> 250
  assert.ok(r.hasCustom);
});

test('las fases se numeran sin huecos y los semanas son consecutivas', () => {
  const r = q(['nutricion']);
  r.phases.forEach((p, i) => assert.equal(p.number, i));
  r.phases.forEach((p, i) => {
    if (i) assert.equal(p.startWeek, r.phases[i - 1].endWeek + 1);
  });
});

test('pruneSelection quita extras huérfanos', () => {
  const s = Engine.pruneSelection(['equivalentes', 'plan_cal', 'dashboard'], CAT);
  assert.deepEqual([...s], ['dashboard']);
});

test('catálogo: ids únicos, fases y grupos existentes, requisitos válidos', () => {
  const ids = CAT.items.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
  const phaseIds = new Set(CAT.phases.map((p) => p.id));
  const groupIds = new Set([...CAT.groups.map((g) => g.id), 'base']);
  CAT.items.forEach((it) => {
    assert.ok(phaseIds.has(it.phase), it.id + ' fase');
    assert.ok(groupIds.has(it.group), it.id + ' grupo');
    if (!it.base) assert.ok(['baja', 'media', 'alta'].includes(it.level), it.id + ' nivel');
    if (it.parent) assert.ok(ids.includes(it.parent), it.id + ' padre');
    [...(it.needs || []), ...(it.needsAny || [])].forEach((n) => assert.ok(ids.includes(n), it.id + ' requiere ' + n));
  });
});

console.log(`\n${passed} pruebas pasaron.`);
