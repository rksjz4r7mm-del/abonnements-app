const assert = require('assert'), C = require('./core.js');
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('OK  ' + name); };
ok('parsePrice valides', () => {
  [['9,99', 999], ['9.99', 999], [' 12 ', 1200], ['1 234,50', 123450], ['0,5', 50], ['7', 700]].forEach(([i, o]) => assert.strictEqual(C.parsePrice(i), o, i));
});
ok('parsePrice invalides', () => {
  ['', '0', '0,00', '-3', 'abc', '9,999', '1e3', '9,9,9', null, undefined, '1000000,01'].forEach(i => assert.strictEqual(C.parsePrice(i), null, String(i)));
});
ok('totaux par fréquence', () => {
  const it = (cents, freq) => ({ cents, freq });
  assert.deepStrictEqual(C.totals([it(999, 'month')]), { yearly: 11988, monthly: 999 });
  assert.deepStrictEqual(C.totals([it(1000, 'week')]), { yearly: 52000, monthly: 4333 });
  assert.deepStrictEqual(C.totals([it(3000, 'quarter')]), { yearly: 12000, monthly: 1000 });
  assert.deepStrictEqual(C.totals([it(12000, 'year')]), { yearly: 12000, monthly: 1000 });
  assert.deepStrictEqual(C.totals([it(999, 'month'), it(12000, 'year'), it(3000, 'quarter')]), { yearly: 35988, monthly: 2999 });
  assert.deepStrictEqual(C.totals([]), { yearly: 0, monthly: 0 });
});
ok('pas d’erreur flottante (3 x 0,10 €)', () => assert.strictEqual(C.totals([{ cents: C.parsePrice('0,10') * 1, freq: 'month' }]).yearly, 120));
ok('parseDate', () => {
  assert.ok(C.parseDate('2024-02-29')); assert.strictEqual(C.parseDate('2026-02-29'), null);
  assert.strictEqual(C.parseDate('2026-02-30'), null); assert.strictEqual(C.parseDate('26-1-1'), null); assert.strictEqual(C.parseDate(''), null);
});
ok('prochain prélèvement', () => {
  assert.strictEqual(C.nextCharge('2026-12-01', 'month', '2026-10-09'), '2026-12-01');
  assert.strictEqual(C.nextCharge('2026-10-09', 'month', '2026-10-09'), '2026-10-09');
  assert.strictEqual(C.nextCharge('2026-01-31', 'month', '2026-02-10'), '2026-02-28');
  assert.strictEqual(C.nextCharge('2026-01-31', 'month', '2026-03-01'), '2026-03-31');
  assert.strictEqual(C.nextCharge('2024-02-29', 'year', '2025-03-01'), '2026-02-28');
  assert.strictEqual(C.nextCharge('2026-10-01', 'week', '2026-10-09'), '2026-10-15');
  assert.strictEqual(C.nextCharge('2026-01-15', 'quarter', '2026-10-09'), '2026-10-15');
  assert.strictEqual(C.nextCharge('2026-11-30', 'month', '2026-12-31'), '2027-01-30');
  assert.strictEqual(C.nextCharge('2026-11-30', 'month', '2026-12-15'), '2026-12-30');
  assert.strictEqual(C.nextCharge('bad', 'month', '2026-10-09'), null);
});
ok('daysBetween', () => {
  assert.strictEqual(C.daysBetween('2026-10-09', '2026-10-31'), 22); assert.strictEqual(C.daysBetween('2024-02-28', '2024-03-01'), 2);
  assert.strictEqual(C.daysBetween('2026-10-24', '2026-10-27'), 3); assert.strictEqual(C.daysBetween('2026-03-28', '2026-03-30'), 2);
});
ok('validateItem', () => {
  const g = { id: 'a', name: ' Netflix ', cents: 999, freq: 'month', next: '2026-11-01' };
  assert.deepStrictEqual(C.validateItem(g), { id: 'a', name: 'Netflix', cents: 999, freq: 'month', next: '2026-11-01' });
  [{ ...g, name: '' }, { ...g, cents: 0 }, { ...g, cents: 9.5 }, { ...g, freq: 'day' }, { ...g, next: '2026-13-01' }, null, 'x'].forEach(b => assert.strictEqual(C.validateItem(b), null));
  assert.ok(C.validateItem({ ...g, id: undefined }).id);
});
ok('sauvegarde : aller-retour et rejets', () => {
  const items = [{ id: 'a', name: 'A', cents: 100, freq: 'week', next: '2026-10-10' }, { id: 'b', name: 'B', cents: 5000, freq: 'year', next: '2027-01-01' }];
  assert.deepStrictEqual(C.parseBackup(C.exportJSON({ items })).items, items);
  assert.strictEqual(C.parseBackup('pas du json'), null); assert.strictEqual(C.parseBackup('{"app":"autre","items":[]}'), null);
  assert.strictEqual(C.parseBackup('{"app":"abos"}'), null);
  const r = C.parseBackup(JSON.stringify({ app: 'abos', items: [items[0], { name: '' }] })); assert.strictEqual(r.items.length, 1); assert.strictEqual(r.skipped, 1);
});
ok('fusion à l’import (mise à jour par identifiant, sans doublon)', () => {
  const m = C.merge([{ id: 'a', name: 'Ancien' }, { id: 'c', name: 'C' }], [{ id: 'a', name: 'Nouveau' }, { id: 'b', name: 'B' }]);
  assert.strictEqual(m.length, 3); assert.strictEqual(m.find(i => i.id === 'a').name, 'Nouveau');
});
ok('traductions FR/EN complètes et cohérentes', () => {
  const fr = Object.keys(C.I18N.fr).sort(), en = Object.keys(C.I18N.en).sort();
  assert.deepStrictEqual(fr, en);
  fr.forEach(k => { assert.ok(C.I18N.fr[k] && C.I18N.en[k], k); const p = s => (s.match(/\{\w+\}/g) || []).sort().join(); assert.strictEqual(p(C.I18N.fr[k]), p(C.I18N.en[k]), k); });
  Object.keys(C.FREQ).forEach(f => ['f_', 'u_'].forEach(p => assert.ok(C.I18N.fr[p + f] && C.I18N.en[p + f])));
});
ok('formats monétaires et dates', () => {
  assert.ok(/9,99\s€/.test(C.money(999, 'fr'))); assert.strictEqual(C.money(123456, 'en'), '€1,234.56');
  assert.strictEqual(C.centsToInput(999, 'fr'), '9,99'); assert.strictEqual(C.centsToInput(999, 'en'), '9.99');
  assert.strictEqual(C.when('fr', 0, '2026-10-09', '2026-10-09').split(',')[0], 'Aujourd’hui');
  assert.ok(C.when('en', 5, '2027-01-02', '2026-10-09').includes('2027'));
});
console.log('\n' + n + ' groupes de tests réussis');
