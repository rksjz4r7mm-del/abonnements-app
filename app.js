(function () {
'use strict';
const C = window.Core, $ = id => document.getElementById(id), KEY = 'abos.v1';
let state = { lang: (navigator.language || 'en').toLowerCase().indexOf('fr') === 0 ? 'fr' : 'en', items: [] };
let failed = false, editing = null, lastFocus = null;
try {
  const r = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (r) { if (r.lang === 'fr' || r.lang === 'en') state.lang = r.lang; state.items = (r.items || []).map(C.validateItem).filter(Boolean); }
} catch (e) {}
function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); failed = false; } catch (e) { failed = true; } }
const t = (k, v) => C.t(state.lang, k, v);

function applyStatic() {
  document.documentElement.lang = state.lang; document.title = t('title');
  document.querySelectorAll('[data-i18n]').forEach(e => { e.textContent = t(e.dataset.i18n); });
  document.querySelectorAll('[data-ph]').forEach(e => { e.placeholder = t(e.dataset.ph); });
  document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === state.lang)));
  const sel = $('f-freq'), cur = sel.value || 'month'; sel.innerHTML = '';
  Object.keys(C.FREQ).forEach(k => { const o = document.createElement('option'); o.value = k; o.textContent = t('f_' + k); sel.append(o); });
  sel.value = cur;
}
function render() {
  const today = C.todayStr(), tot = C.totals(state.items), n = state.items.length;
  $('month').textContent = C.money(tot.monthly, state.lang);
  $('year').textContent = t('perYear', { v: C.money(tot.yearly, state.lang) });
  $('count').textContent = n === 0 ? '' : n === 1 ? t('count1') : t('countN', { n });
  $('empty').hidden = n > 0; $('listWrap').hidden = n === 0; $('fab').hidden = n === 0;
  $('doExport').disabled = n === 0;
  $('warn').hidden = !failed; $('warn').textContent = failed ? t('saveError') : '';
  const ul = $('list'); ul.innerHTML = '';
  state.items.map(i => ({ i, next: C.nextCharge(i.next, i.freq, today) }))
    .sort((a, b) => a.next < b.next ? -1 : a.next > b.next ? 1 : a.i.name.localeCompare(b.i.name))
    .forEach(({ i, next }) => {
      const li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button'; b.className = 'row'; b.setAttribute('aria-label', t('edit') + ' : ' + i.name);
      const mk = (cls, txt) => { const s = document.createElement('span'); s.className = cls; s.textContent = txt; return s; };
      b.append(mk('nm', i.name), mk('pr', C.money(i.cents, state.lang)),
        mk('mt', C.when(state.lang, C.daysBetween(today, next), next, today)), mk('un', t('u_' + i.freq)));
      b.onclick = () => openForm(i.id); li.append(b); ul.append(li);
    });
}
function openSheet(id, focusId) {
  lastFocus = document.activeElement; $(id).hidden = false; document.body.classList.add('lock');
  setTimeout(() => $(focusId).focus(), 60);
}
function closeSheet() {
  document.querySelectorAll('.sheet').forEach(s => { s.hidden = true; }); document.body.classList.remove('lock');
  if (lastFocus && lastFocus.focus && document.contains(lastFocus) && !lastFocus.hidden) lastFocus.focus();
}
function setErr(field, bad) { $('e-' + field).hidden = !bad; $('f-' + field).setAttribute('aria-invalid', String(bad)); }
function openForm(id) {
  editing = id || null; const it = state.items.find(i => i.id === id);
  $('formTitle').textContent = t(it ? 'edit' : 'addTitle');
  $('f-name').value = it ? it.name : ''; $('f-price').value = it ? C.centsToInput(it.cents, state.lang) : '';
  $('f-freq').value = it ? it.freq : 'month'; $('f-next').value = it ? it.next : C.todayStr();
  $('f-del').hidden = !it; ['name', 'price', 'next'].forEach(f => setErr(f, false));
  openSheet('sheetForm', 'f-name');
}
$('form').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('f-name').value.trim(), cents = C.parsePrice($('f-price').value), next = $('f-next').value, freq = $('f-freq').value;
  const bad = { name: !name || name.length > 60, price: cents === null, next: !C.parseDate(next) };
  Object.keys(bad).forEach(f => setErr(f, bad[f]));
  if (bad.name || bad.price || bad.next) { $(bad.name ? 'f-name' : bad.price ? 'f-price' : 'f-next').focus(); return; }
  const it = state.items.find(i => i.id === editing);
  if (it) Object.assign(it, { name, cents, freq, next }); else state.items.push({ id: C.makeId(), name, cents, freq, next });
  persist(); closeSheet(); render();
});
$('f-del').onclick = () => {
  const it = state.items.find(i => i.id === editing);
  if (it && confirm(t('delConfirm', { n: it.name }))) { state.items = state.items.filter(i => i !== it); persist(); closeSheet(); render(); }
};
function msg(key, vars, bad) { const m = $('bmsg'); m.textContent = t(key, vars); m.className = bad ? 'bad' : ''; }
$('doExport').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([C.exportJSON(state)], { type: 'application/json' }));
  a.download = 'abonnements-' + C.todayStr() + '.json'; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000); msg('exportDone');
};
$('doImport').onclick = () => $('file').click();
$('file').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  let txt; try { txt = await f.text(); } catch (_) { return msg('importFail', null, true); }
  const r = C.parseBackup(txt);
  if (!r || (r.items.length === 0 && r.skipped > 0)) return msg('importFail', null, true);
  state.items = C.merge(state.items, r.items); persist(); render();
  r.skipped ? msg('importedSkip', { n: r.items.length, s: r.skipped }) : msg('imported', { n: r.items.length });
};
document.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => { state.lang = b.dataset.lang; persist(); applyStatic(); render(); });
document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeSheet);
document.querySelectorAll('.sheet').forEach(s => s.addEventListener('click', e => { if (e.target === s) closeSheet(); }));
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
$('fab').onclick = $('addFirst').onclick = () => openForm();
$('openBackup').onclick = () => { $('bmsg').textContent = ''; openSheet('sheetBackup', 'doExport'); };
applyStatic(); render();
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
