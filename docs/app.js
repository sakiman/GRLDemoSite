const state = { categories: [], categoryIndex: 0, productionIndex: 0, mode: 'wheel', selected: new Map(), query: '', productionQuery: '', categoryQuery: '', favorites: [] };
const byId = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const icons = () => window.lucide?.createIcons();
const currentCategory = () => state.categories[state.categoryIndex];
const currentProduction = () => currentCategory()?.productions[state.productionIndex];
const compareNames = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
const wheelOrder = (entries, key) => (state.mode === 'wheel' ? entries.sort((a, b) => compareNames(a[key].name, b[key].name)) : entries);
const visibleCategories = () => wheelOrder(state.categories.map((category, index) => ({ category, index })).filter(({ category }) => category.name.toLocaleLowerCase().includes(state.categoryQuery.toLocaleLowerCase())), 'category');
const visibleProductions = () => wheelOrder((currentCategory()?.productions || []).map((production, index) => ({ production, index })).filter(({ production }) => production.name.toLocaleLowerCase().includes(state.productionQuery.toLocaleLowerCase())), 'production');
const sortedSelection = () => [...state.selected.entries()].sort(([, a], [, b]) => compareNames(a.category, b.category) || compareNames(a.production, b.production) || compareNames(a.item, b.item));
const itemKey = (category, production, item) => JSON.stringify([category, production, item]);
const FAVORITES_KEY = 'grl-test-selector-favorites';
const entryKey = ({ category, production, item }) => itemKey(category, production, item);
const itemExists = ({ category, production, item }) => Boolean(state.categories.find((entry) => entry.name === category)?.productions.find((entry) => entry.name === production)?.items.includes(item));

function loadFavorites() {
  try {
    const stored = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    const isEntry = (entry) => [entry?.category, entry?.production, entry?.item].every((value) => typeof value === 'string');
    return Array.isArray(stored) ? stored.filter((favorite) => typeof favorite?.name === 'string' && Array.isArray(favorite.items) && favorite.items.length && favorite.items.every(isEntry)) : [];
  } catch {
    return [];
  }
}

function storeFavorites(favorites) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  } catch {
    byId('message').textContent = '無法儲存我的最愛，請確認瀏覽器允許此頁面保存資料。';
    return false;
  }
  state.favorites = favorites;
  renderFavorites();
  return true;
}

function renderFavorites() {
  byId('favorite-list').innerHTML = state.favorites.length ? state.favorites.map((favorite, index) => {
    const name = escapeHtml(favorite.name);
    const active = favorite.items.every((entry) => state.selected.has(entryKey(entry)));
    return `<span class="favorite-chip ${active ? 'active' : ''}"><button type="button" class="favorite-apply" data-favorite="${index}" aria-pressed="${active}" title="帶入「${name}」"><span>${name}</span><small>${favorite.items.length}</small></button><button type="button" class="favorite-remove" data-remove-favorite="${index}" title="刪除「${name}」" aria-label="刪除「${name}」"><i data-lucide="x"></i></button></span>`;
  }).join('') : '<span class="favorites-empty">勾選測試項目後，按「存為我的最愛」即可保存常用組合。</span>';
  icons();
}

function applyFavorite(favorite) {
  const available = favorite.items.filter(itemExists);
  const added = available.filter((entry) => !state.selected.has(entryKey(entry)));
  added.forEach(({ category, production, item }) => state.selected.set(itemKey(category, production, item), { category, production, item }));
  renderItems();
  renderSelection();
  const missing = favorite.items.length - available.length;
  byId('message').textContent = `已帶入「${favorite.name}」：${added.length ? `新增 ${added.length} 項` : '項目都已在清單中'}${missing ? `，另有 ${missing} 項已不在資料中` : ''}`;
}

function removeFavorite(index) {
  const { name } = state.favorites[index];
  if (!window.confirm(`確定刪除我的最愛「${name}」？`)) return;
  if (storeFavorites(state.favorites.filter((_, position) => position !== index))) byId('message').textContent = `已刪除我的最愛「${name}」`;
}

function closeFavoriteForm() {
  byId('favorite-form').hidden = true;
  byId('favorite-name').value = '';
}

function renderCategories() {
  const picker = byId('category-picker');
  const categories = state.categories;
  const visible = visibleCategories();
  byId('category-count').textContent = state.categoryQuery ? `${visible.length} / ${categories.length}` : String(categories.length).padStart(2, '0');
  byId('category-search').disabled = !categories.length;
  if (!visible.length) {
    picker.innerHTML = `<div class="empty-column">${categories.length ? '找不到符合的分類' : '沒有可選的分類'}</div>`;
    return;
  }
  if (state.mode === 'list') {
    picker.innerHTML = `<div class="category-list">${visible.map(({ category, index }) => `<button class="category-option ${index === state.categoryIndex ? 'active' : ''}" data-category="${index}" type="button" ${index === state.categoryIndex ? 'aria-current="true"' : ''}><span>${escapeHtml(category.name)}</span><i data-lucide="arrow-up-right"></i></button>`).join('')}</div>`;
  } else {
    renderWheel(picker, visible.map(({ category }) => category.name), Math.max(0, visible.findIndex(({ index }) => index === state.categoryIndex)), 'category', '分類', shiftCategory, visible.map(({ index }) => index));
  }
  icons();
}

function renderWheel(container, names, activeIndex, kind, noun, onShift, values = names.map((_, index) => index)) {
  const positions = ['far-previous', 'previous', 'center', 'next', 'far-next'];
  const visible = Math.min(positions.length, names.length);
  const before = visible - 1 - Math.floor((visible - 1) / 2);
  const wheelItem = (offset) => { const index = (activeIndex + offset + names.length) % names.length; return `<button type="button" class="wheel-item ${positions[offset + 2]}" data-${kind}="${values[index]}" ${offset === 0 ? 'aria-current="true"' : ''}><span>${escapeHtml(names[index])}</span>${offset === 0 ? '<i data-lucide="arrow-right"></i>' : ''}</button>`; };
  const items = Array.from({ length: visible }, (_, position) => wheelItem(position - before)).join('');
  container.innerHTML = `<div class="wheel-controls"><span>${noun}瀏覽</span><div><button type="button" data-shift="-1" title="上一個${noun}" aria-label="上一個${noun}"><i data-lucide="chevron-up"></i></button><button type="button" data-shift="1" title="下一個${noun}" aria-label="下一個${noun}"><i data-lucide="chevron-down"></i></button></div></div><div class="wheel" tabindex="0" aria-label="${noun}選擇器，可使用上下方向鍵">${items}</div><div class="wheel-caption"><span>SCROLL TO EXPLORE</span><span>${String(activeIndex + 1).padStart(2, '0')} / ${String(names.length).padStart(2, '0')}</span></div>`;
  const wheel = container.querySelector('.wheel');
  const shift = (direction) => { onShift(direction); rollWheel(container, direction); };
  wheel.addEventListener('wheel', (event) => { if (!event.deltaY) return; event.preventDefault(); shift(event.deltaY > 0 ? 1 : -1); }, { passive: false });
  wheel.addEventListener('keydown', (event) => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); shift(event.key === 'ArrowDown' ? 1 : -1); container.querySelector('.wheel')?.focus(); } });
}

function rollWheel(container, direction) {
  const wheel = container.querySelector('.wheel');
  if (direction && wheel && wheel.children.length > 1) wheel.classList.add(direction > 0 ? 'roll-down' : 'roll-up');
}

function renderProductions() {
  const list = byId('production-list');
  const productions = currentCategory()?.productions || [];
  const visible = visibleProductions();
  byId('production-count').textContent = state.productionQuery ? `${visible.length} / ${productions.length}` : String(productions.length).padStart(2, '0');
  byId('production-search').disabled = !productions.length;
  if (!visible.length) {
    list.innerHTML = `<div class="empty-column">${productions.length ? '找不到符合的產品功能' : '此分類沒有產品功能'}</div>`;
    return;
  }
  if (state.mode === 'list') {
    list.innerHTML = `<div class="production-options">${visible.map(({ production, index }) => `<button type="button" class="production-option ${index === state.productionIndex ? 'active' : ''}" data-production="${index}" ${index === state.productionIndex ? 'aria-current="true"' : ''}><span><small>${String(index + 1).padStart(2, '0')}</small>${escapeHtml(production.name)}</span><i data-lucide="chevron-right"></i></button>`).join('')}</div>`;
  } else {
    renderWheel(list, visible.map(({ production }) => production.name), Math.max(0, visible.findIndex(({ index }) => index === state.productionIndex)), 'production', '產品功能', shiftProduction, visible.map(({ index }) => index));
  }
  icons();
}

function renderItems() {
  const category = currentCategory();
  const production = currentProduction();
  const items = production?.items || [];
  const visible = items.filter((item) => item.toLocaleLowerCase().includes(state.query.toLocaleLowerCase())).sort(compareNames);
  const selectedCount = items.filter((item) => state.selected.has(itemKey(category.name, production.name, item))).length;
  byId('item-count').textContent = `${selectedCount} / ${items.length}`;
  const all = byId('select-all');
  all.disabled = !items.length;
  all.checked = items.length > 0 && selectedCount === items.length;
  all.indeterminate = selectedCount > 0 && selectedCount < items.length;
  byId('item-search').disabled = !production;
  byId('item-list').innerHTML = visible.length ? visible.map((item) => `<label class="item-option"><input type="checkbox" data-item="${escapeHtml(item)}" ${state.selected.has(itemKey(category.name, production.name, item)) ? 'checked' : ''}><span>${escapeHtml(item)}</span><i data-lucide="check"></i></label>`).join('') : `<div class="empty-column">${items.length ? '找不到符合的測試項目' : '此產品功能沒有測試項目'}</div>`;
  byId('current-path').textContent = [category?.name, production?.name].filter(Boolean).join('  /  ') || '尚無資料';
  icons();
}

function renderSelection() {
  const selected = sortedSelection();
  byId('selected-count').textContent = selected.length;
  byId('clear-selection').disabled = !selected.length;
  byId('copy-selection').disabled = !selected.length;
  byId('save-favorite').disabled = !selected.length;
  if (!selected.length) closeFavoriteForm();
  renderFavorites();
  byId('selected-list').innerHTML = selected.length ? selected.map(([key, value]) => `<div class="selected-row"><span class="selected-check"><i data-lucide="check"></i></span><span class="selected-path">${escapeHtml(value.category)} <b>/</b> ${escapeHtml(value.production)}</span><span class="selected-name">${escapeHtml(value.item)}</span><button type="button" class="remove-button" data-key="${escapeHtml(key)}" title="移除 ${escapeHtml(value.item)}" aria-label="移除 ${escapeHtml(value.item)}"><i data-lucide="x"></i></button></div>`).join('') : '<div class="empty-selection"><span class="empty-icon"><i data-lucide="list-checks"></i></span><div><strong>尚未選取測試項目</strong><p>選取的項目會顯示在這裡</p></div></div>';
  icons();
}

function render() { renderCategories(); renderProductions(); renderItems(); renderSelection(); }
function chooseCategory(index) { state.categoryIndex = index; state.query = ''; state.productionQuery = ''; state.productionIndex = visibleProductions()[0]?.index ?? 0; byId('item-search').value = ''; byId('production-search').value = ''; render(); }
function shiftCategory(direction) {
  const visible = visibleCategories();
  if (visible.length < 2) return;
  const position = Math.max(0, visible.findIndex(({ index }) => index === state.categoryIndex));
  chooseCategory(visible[(position + direction + visible.length) % visible.length].index);
}
function chooseProduction(index) { state.productionIndex = index; state.query = ''; byId('item-search').value = ''; renderProductions(); renderItems(); }
function shiftProduction(direction) {
  const visible = visibleProductions();
  if (visible.length < 2) return;
  const position = Math.max(0, visible.findIndex(({ index }) => index === state.productionIndex));
  chooseProduction(visible[(position + direction + visible.length) % visible.length].index);
}
function setItem(item, checked) {
  const category = currentCategory().name;
  const production = currentProduction().name;
  const key = itemKey(category, production, item);
  if (checked) state.selected.set(key, { category, production, item });
  else state.selected.delete(key);
}

document.querySelector('.mode-switch').addEventListener('click', (event) => {
  const button = event.target.closest('[data-mode]');
  if (!button) return;
  state.mode = button.dataset.mode;
  document.querySelectorAll('.mode-button').forEach((option) => { const active = option === button; option.classList.toggle('active', active); option.setAttribute('aria-pressed', String(active)); });
  renderCategories();
  renderProductions();
});
const wheelDirection = (item) => (/previous/.test(item.className) ? -1 : /next/.test(item.className) ? 1 : 0);
let holdTimer = 0;
function stopHold() {
  clearTimeout(holdTimer);
  clearInterval(holdTimer);
}
function enableHoldShift(container, shiftBy) {
  container.addEventListener('pointerdown', (event) => {
    const button = event.target.closest('[data-shift]');
    if (!button || event.button !== 0) return;
    const direction = Number(button.dataset.shift);
    const step = () => { shiftBy(direction); rollWheel(container, direction); };
    stopHold();
    step();
    holdTimer = setTimeout(() => { step(); holdTimer = setInterval(step, 140); }, 400);
  });
}
enableHoldShift(byId('category-picker'), shiftCategory);
enableHoldShift(byId('production-list'), shiftProduction);
['pointerup', 'pointercancel', 'blur'].forEach((type) => window.addEventListener(type, stopHold));
// 滑鼠與觸控的上下按鈕已在 pointerdown 處理，click 只處理鍵盤（detail 為 0）
byId('category-picker').addEventListener('click', (event) => {
  const category = event.target.closest('[data-category]');
  const shift = event.target.closest('[data-shift]');
  const direction = category ? wheelDirection(category) : Number(shift?.dataset.shift);
  if (category) chooseCategory(Number(category.dataset.category));
  else if (shift && !event.detail) shiftCategory(direction);
  else return;
  rollWheel(event.currentTarget, direction);
});
byId('production-list').addEventListener('click', (event) => {
  const production = event.target.closest('[data-production]');
  const shift = event.target.closest('[data-shift]');
  const direction = production ? wheelDirection(production) : Number(shift?.dataset.shift);
  if (production) chooseProduction(Number(production.dataset.production));
  else if (shift && !event.detail) shiftProduction(direction);
  else return;
  rollWheel(event.currentTarget, direction);
});
byId('item-list').addEventListener('change', (event) => { if (event.target.matches('[data-item]')) { setItem(event.target.dataset.item, event.target.checked); renderItems(); renderSelection(); } });
byId('select-all').addEventListener('change', (event) => { (currentProduction()?.items || []).forEach((item) => setItem(item, event.target.checked)); renderItems(); renderSelection(); });
byId('item-search').addEventListener('input', (event) => { state.query = event.target.value.trim(); renderItems(); });
byId('category-search').addEventListener('input', (event) => {
  state.categoryQuery = event.target.value.trim();
  const visible = visibleCategories();
  if (visible.length && !visible.some(({ index }) => index === state.categoryIndex)) chooseCategory(visible[0].index);
  else renderCategories();
});
byId('production-search').addEventListener('input', (event) => {
  state.productionQuery = event.target.value.trim();
  const visible = visibleProductions();
  if (visible.length && !visible.some(({ index }) => index === state.productionIndex)) chooseProduction(visible[0].index);
  else renderProductions();
});
byId('selected-list').addEventListener('click', (event) => { const button = event.target.closest('[data-key]'); if (button) { state.selected.delete(button.dataset.key); renderItems(); renderSelection(); } });
byId('clear-selection').addEventListener('click', () => { state.selected.clear(); renderItems(); renderSelection(); });
byId('copy-selection').addEventListener('click', async () => {
  const text = sortedSelection().map(([, { category, production, item }]) => `${category}, ${production}, ${item}`).join('\n');
  try { await navigator.clipboard.writeText(text); byId('message').textContent = '已複製選取清單'; }
  catch { byId('message').textContent = '無法複製，請確認瀏覽器的剪貼簿權限。'; }
});
byId('save-favorite').addEventListener('click', () => { byId('favorite-form').hidden = false; byId('favorite-name').focus(); });
byId('favorite-cancel').addEventListener('click', closeFavoriteForm);
byId('favorite-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const name = byId('favorite-name').value.trim();
  if (!name || !state.selected.size) return;
  const favorite = { name, items: sortedSelection().map(([, { category, production, item }]) => ({ category, production, item })) };
  const existing = state.favorites.findIndex((entry) => entry.name === name);
  const favorites = existing < 0 ? [...state.favorites, favorite] : state.favorites.map((entry, index) => (index === existing ? favorite : entry));
  if (!storeFavorites(favorites)) return;
  closeFavoriteForm();
  byId('message').textContent = `${existing < 0 ? '已存為' : '已更新'}我的最愛「${name}」（${favorite.items.length} 項）`;
});
byId('favorite-list').addEventListener('click', (event) => {
  const apply = event.target.closest('[data-favorite]');
  const remove = event.target.closest('[data-remove-favorite]');
  if (apply) applyFavorite(state.favorites[Number(apply.dataset.favorite)]);
  else if (remove) removeFavorite(Number(remove.dataset.removeFavorite));
});

function loadData() {
  try {
    const data = window.GRL_DATA;
    if (!data) throw new Error('GRL_DATA is not defined');
    if (!Array.isArray(data.categories) || !data.categories.every((category) => typeof category.name === 'string' && Array.isArray(category.productions) && category.productions.every((production) => typeof production.name === 'string' && Array.isArray(production.items) && production.items.every((item) => typeof item === 'string')))) throw new Error('Invalid data format');
    state.categories = data.categories;
    state.favorites = loadFavorites();
    chooseCategory(visibleCategories()[0]?.index ?? 0);
  } catch (error) {
    render();
    byId('message').textContent = '無法載入資料。請確認 data.js 存在且格式正確。';
    console.error('Failed to load data.js:', error);
  }
}
loadData();