(function (root) {
'use strict';
const FREQ = { week: 52, month: 12, quarter: 4, year: 1 };
const pad = n => String(n).padStart(2, '0');
const fmt = (y, m, d) => y + '-' + pad(m) + '-' + pad(d);
function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3], t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d ? { y, mo, d } : null;
}
function addMonths(s, k) {
  const p = parseDate(s), tot = p.y * 12 + p.mo - 1 + k, y = Math.floor(tot / 12), mo = tot % 12 + 1;
  return fmt(y, mo, Math.min(p.d, new Date(Date.UTC(y, mo, 0)).getUTCDate()));
}
function addDays(s, k) {
  const p = parseDate(s), t = new Date(Date.UTC(p.y, p.mo - 1, p.d + k));
  return fmt(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}
const shift = (a, f, k) => f === 'week' ? addDays(a, 7 * k) : addMonths(a, k * (f === 'month' ? 1 : f === 'quarter' ? 3 : 12));
function nextCharge(anchor, freq, today) {
  if (!parseDate(anchor) || !FREQ[freq]) return null;
  let k = 0, d = anchor;
  while (d < today && k < 20000) { k++; d = shift(anchor, freq, k); }
  return d;
}
function daysBetween(a, b) {
  const x = parseDate(a), y = parseDate(b);
  return Math.round((Date.UTC(y.y, y.mo - 1, y.d) - Date.UTC(x.y, x.mo - 1, x.d)) / 864e5);
}
function todayStr() { const n = new Date(); return fmt(n.getFullYear(), n.getMonth() + 1, n.getDate()); }
function parsePrice(s) {
  const v = String(s == null ? '' : s).replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
  const c = Math.round(parseFloat(v) * 100);
  return c >= 1 && c <= 100000000 ? c : null;
}
const centsToInput = (c, lang) => { const s = (c / 100).toFixed(2); return lang === 'fr' ? s.replace('.', ',') : s; };
const loc = l => l === 'fr' ? 'fr-FR' : 'en-IE';
const money = (c, l) => new Intl.NumberFormat(loc(l), { style: 'currency', currency: 'EUR' }).format(c / 100);
function totals(items) {
  const yearly = items.reduce((s, i) => s + i.cents * FREQ[i.freq], 0);
  return { yearly, monthly: Math.round(yearly / 12) };
}
function validateItem(o) {
  if (!o || typeof o !== 'object') return null;
  const name = typeof o.name === 'string' ? o.name.trim() : '';
  if (!name || name.length > 60 || !Number.isInteger(o.cents) || o.cents < 1 || o.cents > 100000000 ||
      !FREQ[o.freq] || !parseDate(o.next)) return null;
  return { id: typeof o.id === 'string' && o.id ? o.id.slice(0, 40) : makeId(), name, cents: o.cents, freq: o.freq, next: o.next };
}
function makeId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
const exportJSON = (s) => JSON.stringify({ app: 'abos', version: 1, exportedAt: new Date().toISOString(), items: s.items }, null, 2);
function parseBackup(text) {
  let o; try { o = JSON.parse(text); } catch (e) { return null; }
  if (!o || o.app !== 'abos' || !Array.isArray(o.items)) return null;
  const items = o.items.map(validateItem).filter(Boolean);
  return { items, skipped: o.items.length - items.length };
}
function merge(cur, inc) {
  const m = new Map(cur.map(i => [i.id, i]));
  inc.forEach(i => m.set(i.id, i));
  return [...m.values()];
}
const I18N = {
fr: {
  title: 'Mes abonnements', perMonth: 'par mois', perYear: 'soit {v} par an', count1: '1 abonnement', countN: '{n} abonnements',
  add: 'Ajouter', addTitle: 'Nouvel abonnement', edit: 'Modifier l’abonnement', emptyTitle: 'Aucun abonnement pour l’instant',
  emptyText: 'Ajoute ce que tu paies régulièrement pour voir où part ton argent. Tout reste sur ton téléphone.',
  addFirst: 'Ajouter mon premier abonnement', upcoming: 'Prochains prélèvements', hint: 'Touche un abonnement pour le modifier.',
  name: 'Nom', namePh: 'Netflix, salle de sport…', price: 'Prix en €', freq: 'Fréquence', next: 'Prochain prélèvement',
  f_week: 'Chaque semaine', f_month: 'Chaque mois', f_quarter: 'Chaque trimestre', f_year: 'Chaque année',
  u_week: 'par semaine', u_month: 'par mois', u_quarter: 'par trimestre', u_year: 'par an',
  save: 'Enregistrer', cancel: 'Annuler', del: 'Supprimer', delConfirm: 'Supprimer « {n} » ?', close: 'Fermer',
  errName: 'Entre un nom (60 caractères maximum).', errPrice: 'Entre un prix valide, par exemple 9,99.', errDate: 'Choisis une date.',
  today: 'Aujourd’hui', tomorrow: 'Demain', inDays: 'Dans {n} jours', charge: '{r}, {d}',
  backup: 'Sauvegarde', backupTitle: 'Sauvegarde', export: 'Exporter une sauvegarde', import: 'Importer une sauvegarde',
  backupHelp: 'La sauvegarde est un fichier à garder en lieu sûr. Importer ajoute les abonnements du fichier et met à jour ceux qui existent déjà.',
  imported: '{n} abonnement(s) importé(s).', importedSkip: '{n} importé(s), {s} ignoré(s) car invalides.',
  importFail: 'Fichier non valide : rien n’a été modifié.', exportDone: 'Sauvegarde exportée.',
  saveError: 'Impossible d’enregistrer sur cet appareil. Exporte une sauvegarde pour ne rien perdre.',
  privacy: 'Données stockées uniquement sur cet appareil. Aucun compte, aucune banque.', lang: 'Langue'
},
en: {
  title: 'My subscriptions', perMonth: 'per month', perYear: 'that is {v} per year', count1: '1 subscription', countN: '{n} subscriptions',
  add: 'Add', addTitle: 'New subscription', edit: 'Edit subscription', emptyTitle: 'No subscriptions yet',
  emptyText: 'Add what you pay for regularly to see where your money goes. Everything stays on your phone.',
  addFirst: 'Add my first subscription', upcoming: 'Upcoming charges', hint: 'Tap a subscription to edit it.',
  name: 'Name', namePh: 'Netflix, gym…', price: 'Price in €', freq: 'Frequency', next: 'Next charge',
  f_week: 'Every week', f_month: 'Every month', f_quarter: 'Every quarter', f_year: 'Every year',
  u_week: 'per week', u_month: 'per month', u_quarter: 'per quarter', u_year: 'per year',
  save: 'Save', cancel: 'Cancel', del: 'Delete', delConfirm: 'Delete “{n}”?', close: 'Close',
  errName: 'Enter a name (60 characters maximum).', errPrice: 'Enter a valid price, for example 9.99.', errDate: 'Pick a date.',
  today: 'Today', tomorrow: 'Tomorrow', inDays: 'In {n} days', charge: '{r}, {d}',
  backup: 'Backup', backupTitle: 'Backup', export: 'Export a backup', import: 'Import a backup',
  backupHelp: 'A backup is a file to keep somewhere safe. Importing adds the subscriptions from the file and updates the ones that already exist.',
  imported: '{n} subscription(s) imported.', importedSkip: '{n} imported, {s} skipped because invalid.',
  importFail: 'Invalid file: nothing was changed.', exportDone: 'Backup exported.',
  saveError: 'Cannot save on this device. Export a backup so you do not lose anything.',
  privacy: 'Data is stored on this device only. No account, no bank.', lang: 'Language'
}};
function t(lang, key, vars) {
  let s = (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}
function fmtDay(lang, s, today) {
  const p = parseDate(s), withYear = today && parseDate(today).y !== p.y;
  const o = { day: 'numeric', month: 'long', timeZone: 'UTC' }; if (withYear) o.year = 'numeric';
  return new Intl.DateTimeFormat(loc(lang), o).format(new Date(Date.UTC(p.y, p.mo - 1, p.d)));
}
function when(lang, days, s, today) {
  const r = days === 0 ? t(lang, 'today') : days === 1 ? t(lang, 'tomorrow') : t(lang, 'inDays', { n: days });
  return t(lang, 'charge', { r, d: fmtDay(lang, s, today) });
}
const Core = { FREQ, I18N, t, parseDate, addMonths, addDays, nextCharge, daysBetween, todayStr, parsePrice, centsToInput,
  money, totals, validateItem, makeId, exportJSON, parseBackup, merge, fmtDay, when };
if (typeof module !== 'undefined' && module.exports) module.exports = Core; else root.Core = Core;
})(typeof window !== 'undefined' ? window : globalThis);
