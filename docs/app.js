const state = { categories: [], categoryIndex: 0, productionIndex: 0, mode: 'wheel', ports: [{ name: 'Port 1', selected: new Map() }], portIndex: 0, query: '', productionQuery: '', categoryQuery: '', favorites: [], get selected() { return this.ports[this.portIndex].selected; } };
const byId = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const icons = () => window.lucide?.createIcons();
const currentCategory = () => state.categories[state.categoryIndex];
const currentProduction = () => currentCategory()?.productions[state.productionIndex];
const compareNames = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
const wheelOrder = (entries, key) => (state.mode === 'wheel' ? entries.sort((a, b) => compareNames(a[key].name, b[key].name)) : entries);
const visibleCategories = () => wheelOrder(state.categories.map((category, index) => ({ category, index })).filter(({ category }) => category.name.toLocaleLowerCase().includes(state.categoryQuery.toLocaleLowerCase())), 'category');
const visibleProductions = () => wheelOrder((currentCategory()?.productions || []).map((production, index) => ({ production, index })).filter(({ production }) => production.name.toLocaleLowerCase().includes(state.productionQuery.toLocaleLowerCase())), 'production');
const sortedSelection = (selected = state.selected) => [...selected.entries()].sort(([, a], [, b]) => compareNames(a.category, b.category) || compareNames(a.production, b.production) || compareNames(a.item, b.item));
const itemKey = (category, production, item) => JSON.stringify([category, production, item]);
const FAVORITES_KEY = 'grl-test-selector-favorites';
const entryKey = ({ category, production, item }) => itemKey(category, production, item);
const itemExists = ({ category, production, item }) => Boolean(state.categories.find((entry) => entry.name === category)?.productions.find((entry) => entry.name === production)?.items.includes(item));
const isEntry = (entry) => [entry?.category, entry?.production, entry?.item].every((value) => typeof value === 'string');
const PORTS_KEY = 'grl-test-selector-ports';
const MAX_PORT_BATCH = 20;
const currentPort = () => state.ports[state.portIndex];
const newPort = (name, entries = []) => ({ name, selected: new Map(entries.map(({ category, production, item }) => [itemKey(category, production, item), { category, production, item }])) });
const portNameTaken = (name) => state.ports.some((port) => port.name === name);
const totalSelected = () => state.ports.reduce((total, port) => total + port.selected.size, 0);

function numberedPortNames(base, count) {
  const names = [];
  for (let number = portNameTaken(base) ? 2 : 1; names.length < count; number += 1) {
    const name = `${base} ${number}`;
    if (!portNameTaken(name)) names.push(name);
  }
  return names;
}

// 回傳已保存但目前資料中找不到的測試項目數量
function loadPorts() {
  try {
    const stored = JSON.parse(localStorage.getItem(PORTS_KEY) || 'null');
    const ports = Array.isArray(stored?.ports) ? stored.ports.filter((port) => typeof port?.name === 'string' && port.name && Array.isArray(port.items) && port.items.every(isEntry)) : [];
    if (!ports.length) return 0;
    state.ports = ports.map((port) => newPort(port.name, port.items.filter(itemExists)));
    state.portIndex = Number.isInteger(stored.active) && stored.active >= 0 && stored.active < ports.length ? stored.active : 0;
    return ports.reduce((total, port) => total + port.items.length, 0) - totalSelected();
  } catch {
    return 0;
  }
}

function savePorts() {
  try {
    localStorage.setItem(PORTS_KEY, JSON.stringify({ active: state.portIndex, ports: state.ports.map(({ name, selected }) => ({ name, items: [...selected.values()] })) }));
    return true;
  } catch {
    return false;
  }
}

function refreshSelection(message = '') {
  const notice = savePorts() ? message : '無法保存 Port 設定，重新整理後勾選內容將不會保留。';
  renderPorts();
  renderItems();
  renderSelection();
  if (notice) byId('message').textContent = notice;
}

const dragGrip = () => (state.ports.length > 1 ? '<i data-lucide="grip-vertical" class="drag-grip"></i>' : '');
const dragHint = () => (state.ports.length > 1 ? '（可拖曳調整順序）' : '');

function renderPorts() {
  byId('port-list').innerHTML = `${state.ports.map((port, index) => {
    const active = index === state.portIndex;
    return `<button type="button" class="port-tab ${active ? 'active' : ''}" data-port="${index}" aria-pressed="${active}" title="第 ${index + 1} 個 Port：${escapeHtml(port.name)}${dragHint()}">${dragGrip()}<b class="port-order">#${index + 1}</b><span>${escapeHtml(port.name)}</span><small>${port.selected.size}</small></button>`;
  }).join('')}<button type="button" class="port-add" data-port-action="add"><i data-lucide="plus"></i>新增 Port</button>`;
  byId('port-delete').disabled = state.ports.length < 2;
  icons();
}

let portFormMode = 'add';
function openPortForm(mode) {
  const rename = mode === 'rename';
  const input = byId('port-name');
  portFormMode = mode;
  byId('port-form').hidden = false;
  byId('port-count-wrap').hidden = rename;
  byId('port-count').value = 1;
  byId('port-submit').textContent = rename ? '重新命名' : '新增';
  input.setCustomValidity('');
  input.value = rename ? currentPort().name : '';
  input.focus();
  input.select();
}

function closePortForm() {
  byId('port-form').hidden = true;
}

function choosePort(index) {
  state.portIndex = index;
  closePortForm();
  closeFavoriteForm();
  refreshSelection();
}

function duplicatePort() {
  const source = currentPort();
  const [name] = numberedPortNames(source.name.replace(/\s+\d+$/, '') || source.name, 1);
  state.ports.push(newPort(name, [...source.selected.values()]));
  state.portIndex = state.ports.length - 1;
  closePortForm();
  refreshSelection(`已將「${source.name}」複製為「${name}」（${source.selected.size} 項）`);
}

function deletePort() {
  if (state.ports.length < 2) return;
  const { name } = currentPort();
  state.ports.splice(state.portIndex, 1);
  state.portIndex = Math.min(state.portIndex, state.ports.length - 1);
  closePortForm();
  closeFavoriteForm();
  refreshSelection(`已刪除 Port「${name}」`);
}

function movePort(from, to) {
  const active = currentPort();
  const [port] = state.ports.splice(from, 1);
  state.ports.splice(to, 0, port);
  state.portIndex = state.ports.indexOf(active);
  refreshSelection(`已將「${port.name}」移到第 ${to + 1} 個位置`);
}

let portDrag = null;
let suppressPortClick = false;
const markPortDrop = (targets, from = -1, index = -1, after = false) => targets.forEach((target, position) => {
  target.classList.toggle('dragging', position === from);
  target.classList.toggle('drop-before', position === index && !after);
  target.classList.toggle('drop-after', position === index && after);
});

function enablePortDrag(container, handleSelector, targetSelector, vertical) {
  container.addEventListener('pointerdown', (event) => {
    const handle = event.target.closest(handleSelector);
    if (!handle || event.button !== 0 || state.ports.length < 2) return;
    const rect = handle.getBoundingClientRect();
    portDrag = { from: Number(handle.dataset.port), to: null, x: event.clientX, y: event.clientY, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, handle, ghost: null, container, targetSelector, vertical, active: false };
  });
}

// 跟著游標移動的半透明分身
function createPortGhost(handle) {
  const ghost = handle.cloneNode(true);
  const { width, height } = handle.getBoundingClientRect();
  ghost.classList.add('port-ghost');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.style.width = `${width}px`;
  ghost.style.height = `${height}px`;
  document.body.append(ghost);
  return ghost;
}

function trackPortDrag(event) {
  if (!portDrag) return;
  const { from, container, targetSelector, vertical } = portDrag;
  // 移動超過一小段距離才算拖曳，否則仍視為點選
  if (!portDrag.active && Math.hypot(event.clientX - portDrag.x, event.clientY - portDrag.y) < 6) return;
  portDrag.active = true;
  portDrag.ghost ??= createPortGhost(portDrag.handle);
  portDrag.ghost.style.translate = `${event.clientX - portDrag.offsetX}px ${event.clientY - portDrag.offsetY}px`;
  document.body.classList.add('port-dragging');
  const targets = [...container.querySelectorAll(targetSelector)];
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(targetSelector);
  const index = targets.indexOf(target);
  if (index < 0) {
    // 在分頁間的空隙維持原本的落點；移出範圍則取消
    if (!container.contains(document.elementFromPoint(event.clientX, event.clientY))) {
      portDrag.to = null;
      markPortDrop(targets, from);
    }
    return;
  }
  const rect = target.getBoundingClientRect();
  const after = vertical ? event.clientY > rect.top + rect.height / 2 : event.clientX > rect.left + rect.width / 2;
  const slot = index + (after ? 1 : 0);
  portDrag.to = slot === from || slot === from + 1 ? null : slot;
  markPortDrop(targets, from, portDrag.to === null ? -1 : index, after);
}

function endPortDrag(event) {
  if (!portDrag) return;
  const { from, to, container, targetSelector, active, ghost } = portDrag;
  portDrag = null;
  if (!active) return;
  ghost?.remove();
  document.body.classList.remove('port-dragging');
  markPortDrop([...container.querySelectorAll(targetSelector)]);
  suppressPortClick = true;
  setTimeout(() => { suppressPortClick = false; });
  if (event.type === 'pointerup' && to !== null) movePort(from, to > from ? to - 1 : to);
}

function loadFavorites() {
  try {
    const stored = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
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
  const missing = favorite.items.length - available.length;
  refreshSelection(`已將「${favorite.name}」帶入「${currentPort().name}」：${added.length ? `新增 ${added.length} 項` : '項目都已在清單中'}${missing ? `，另有 ${missing} 項已不在資料中` : ''}`);
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
  const before = names.length === 2 ? activeIndex : visible - 1 - Math.floor((visible - 1) / 2);
  const wheelItem = (offset) => { const index = (activeIndex + offset + names.length) % names.length; return `<button type="button" class="wheel-item ${positions[offset + 2]}" data-${kind}="${values[index]}" ${offset === 0 ? 'aria-current="true"' : ''}><span>${escapeHtml(names[index])}</span>${offset === 0 ? '<i data-lucide="arrow-right"></i>' : ''}</button>`; };
  const items = Array.from({ length: visible }, (_, position) => wheelItem(position - before)).join('');
  container.innerHTML = `<div class="wheel-controls"><span>${noun}瀏覽</span><div><button type="button" data-shift="-1" title="上一個${noun}" aria-label="上一個${noun}"><i data-lucide="chevron-up"></i></button><button type="button" data-shift="1" title="下一個${noun}" aria-label="下一個${noun}"><i data-lucide="chevron-down"></i></button></div></div><div class="wheel" tabindex="0" aria-label="${noun}選擇器，可使用上下方向鍵">${items}</div><div class="wheel-caption"><span>SCROLL TO EXPLORE</span><span>${String(activeIndex + 1).padStart(2, '0')} / ${String(names.length).padStart(2, '0')}</span></div>`;
  const wheel = container.querySelector('.wheel');
  const shift = (direction) => { onShift(direction); rollWheel(container, direction); };
  wheel.addEventListener('wheel', (event) => {
    if (!event.deltaY || names.length < 2) return;
    event.preventDefault();
    const distance = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? wheel.clientHeight : 1);
    moveWheelByScroll(container, wheel, names, activeIndex, kind, values, distance);
  }, { passive: false });
  wheel.addEventListener('keydown', (event) => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); shift(event.key === 'ArrowDown' ? 1 : -1); container.querySelector('.wheel')?.focus(); } });
}

// 捲動後停在第一項時，下一次 rollWheel 會顯示提示分身
let wheelWrapped = false;
function noteWrap(visible, from, to, direction) {
  wheelWrapped = Boolean(direction) && to !== from && visible[0]?.index === to;
}

function rollWheel(container, direction) {
  const wheel = container.querySelector('.wheel');
  const wrapped = wheelWrapped;
  wheelWrapped = false;
  if (!direction || !wheel || wheel.children.length < 2) return;
  const center = wrapped ? wheel.querySelector('.center') : null;
  // 先量測位置再加上滾動動畫，避免量到位移中的座標
  const box = center?.getBoundingClientRect();
  wheel.classList.add(direction > 0 ? 'roll-down' : 'roll-up');
  if (!center) return;
  // 分身掛在 body 上，才不會被圓柱外框裁切
  const ghost = document.createElement('div');
  ghost.className = 'wheel-ghost';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.append(center.querySelector('span').cloneNode(true));
  Object.assign(ghost.style, { left: `${box.left + window.scrollX}px`, top: `${box.top + window.scrollY}px`, width: `${box.width}px`, height: `${box.height}px` });
  ghost.addEventListener('animationend', () => ghost.remove());
  wheel.classList.add('wrapped');
  document.body.append(ghost);
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

const visibleItems = () => (currentProduction()?.items || []).filter((item) => item.toLocaleLowerCase().includes(state.query.toLocaleLowerCase())).sort(compareNames);

function renderItems() {
  const category = currentCategory();
  const production = currentProduction();
  const items = production?.items || [];
  const visible = visibleItems();
  const isSelected = (item) => state.selected.has(itemKey(category.name, production.name, item));
  const selectedCount = items.filter(isSelected).length;
  byId('item-count').textContent = `${selectedCount} / ${items.length}`;
  // 有搜尋文字時，全選只作用於篩選後的項目
  const visibleSelected = visible.filter(isSelected).length;
  const all = byId('select-all');
  all.disabled = !visible.length;
  all.checked = visible.length > 0 && visibleSelected === visible.length;
  all.indeterminate = visibleSelected > 0 && visibleSelected < visible.length;
  all.nextElementSibling.textContent = state.query ? `全選篩選結果（${visible.length} 項）` : '全選此產品功能';
  byId('item-search').disabled = !production;
  byId('item-list').innerHTML = visible.length ? visible.map((item) => `<label class="item-option"><input type="checkbox" data-item="${escapeHtml(item)}" ${state.selected.has(itemKey(category.name, production.name, item)) ? 'checked' : ''}><span>${escapeHtml(item)}</span><i data-lucide="check"></i></label>`).join('') : `<div class="empty-column">${items.length ? '找不到符合的測試項目' : '此產品功能沒有測試項目'}</div>`;
  byId('current-path').textContent = category ? [currentPort().name, category.name, production?.name].filter(Boolean).join('  /  ') : '尚無資料';
  byId('item-target').textContent = `勾選「${currentPort().name}」的測試項目`;
  icons();
}

function renderSelection() {
  const total = totalSelected();
  byId('selected-count').textContent = total;
  byId('clear-selection').disabled = !total;
  byId('copy-selection').disabled = !total;
  byId('save-favorite').disabled = !state.selected.size;
  if (!state.selected.size) closeFavoriteForm();
  renderFavorites();
  byId('selected-list').innerHTML = total ? state.ports.map((port, portIndex) => {
    const active = portIndex === state.portIndex;
    const name = escapeHtml(port.name);
    const rows = sortedSelection(port.selected).map(([key, value]) => `<div class="selected-row"><span class="selected-check"><i data-lucide="check"></i></span><span class="selected-path">${escapeHtml(value.category)} <b>/</b> ${escapeHtml(value.production)}</span><span class="selected-name">${escapeHtml(value.item)}</span><button type="button" class="remove-button" data-port="${portIndex}" data-key="${escapeHtml(key)}" title="移除 ${escapeHtml(value.item)}" aria-label="從 ${name} 移除 ${escapeHtml(value.item)}"><i data-lucide="x"></i></button></div>`).join('');
    return `<section class="selected-group ${active ? 'active' : ''}"><div class="selected-group-header"><button type="button" class="selected-group-name" data-port="${portIndex}" aria-pressed="${active}" title="第 ${portIndex + 1} 個 Port：切換到「${name}」${dragHint()}">${dragGrip()}<b class="port-order">#${portIndex + 1}</b><i data-lucide="plug"></i><span>${name}</span><small>${port.selected.size}</small></button><button type="button" class="text-button" data-clear-port="${portIndex}" ${port.selected.size ? '' : 'disabled'}>清除</button></div>${rows || '<div class="selected-group-empty">此 Port 尚未選取測試項目</div>'}</section>`;
  }).join('') : '<div class="empty-selection"><span class="empty-icon"><i data-lucide="list-checks"></i></span><div><strong>尚未選取測試項目</strong><p>選取的項目會顯示在這裡</p></div></div>';
  icons();
}

function render() { renderPorts(); renderCategories(); renderProductions(); renderItems(); renderSelection(); }
function chooseCategory(index) { state.categoryIndex = index; state.query = ''; state.productionQuery = ''; state.productionIndex = visibleProductions()[0]?.index ?? 0; byId('item-search').value = ''; byId('production-search').value = ''; render(); }
function shiftCategory(direction) {
  const visible = visibleCategories();
  if (visible.length < 2) return;
  const position = Math.max(0, visible.findIndex(({ index }) => index === state.categoryIndex));
  const target = visible[(position + direction + visible.length) % visible.length].index;
  noteWrap(visible, state.categoryIndex, target, direction);
  chooseCategory(target);
}
function chooseProduction(index) { state.productionIndex = index; state.query = ''; byId('item-search').value = ''; renderProductions(); renderItems(); }
function shiftProduction(direction) {
  const visible = visibleProductions();
  if (visible.length < 2) return;
  const position = Math.max(0, visible.findIndex(({ index }) => index === state.productionIndex));
  const target = visible[(position + direction + visible.length) % visible.length].index;
  noteWrap(visible, state.productionIndex, target, direction);
  chooseProduction(target);
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
const WHEEL_STEP = 52;
const WHEEL_SNAP_DURATION = 160;
let wheelGesture = null;
let suppressWheelClick = false;

function wheelDistance(gesture, distance) {
  if (gesture.names.length !== 2) return distance;
  return Math.max(-gesture.activeIndex * WHEEL_STEP, Math.min((1 - gesture.activeIndex) * WHEEL_STEP, distance));
}

function previewWheel(gesture, distance = gesture.distance) {
  const { wheel, names, activeIndex, kind, values } = gesture;
  const step = Math.round(distance / WHEEL_STEP);
  const center = ((activeIndex + step) % names.length + names.length) % names.length;
  const positions = ['outer-previous', 'far-previous', 'previous', 'center', 'next', 'far-next', 'outer-next'];
  if (gesture.previewCenter !== center) {
    const offsets = names.length === 2 ? names.map((_, index) => index - center) : positions.map((_, slot) => slot - 3);
    wheel.innerHTML = offsets.map((offset) => {
      const index = ((center + offset) % names.length + names.length) % names.length;
      return `<button type="button" class="wheel-item ${positions[offset + 3]}" data-wheel-offset="${offset}" data-${kind}="${values[index]}"><span>${escapeHtml(names[index])}</span></button>`;
    }).join('');
    gesture.previewCenter = center;
  }
  // 與靜止時的圓柱位置一致，避免回正後跳動
  const tops = [-53, -1, 43, 91, 143, 189, 235];
  const heights = [42, 42, 44, 48, 44, 42, 42];
  const interpolate = (values, position) => {
    const lower = Math.max(0, Math.min(5, Math.floor(position + 3)));
    const fraction = Math.max(0, Math.min(1, position + 3 - lower));
    return values[lower] + (values[lower + 1] - values[lower]) * fraction;
  };
  wheel.querySelectorAll('.wheel-item').forEach((item) => {
    const position = Number(item.dataset.wheelOffset) + step - distance / WHEEL_STEP;
    const magnitude = Math.min(3, Math.abs(position));
    Object.assign(item.style, {
      top: `${interpolate(tops, position)}px`,
      height: `${interpolate(heights, position)}px`,
      fontSize: `${16 - Math.min(1, Math.max(0, magnitude - 1))}px`,
      transform: `rotateX(${-9 * position}deg) scale(${1 - 0.03 * magnitude})`,
      transformOrigin: position < 0 ? 'bottom' : position > 0 ? 'top' : 'center',
      opacity: '',
    });
  });
}

function finishWheelGesture(cancel = false) {
  const gesture = wheelGesture;
  if (!gesture) return;
  clearTimeout(gesture.timer);
  if (!gesture.wheel.isConnected) { wheelGesture = null; return; }
  const step = cancel ? 0 : Math.round(gesture.distance / WHEEL_STEP);
  const target = ((gesture.activeIndex + step) % gesture.names.length + gesture.names.length) % gesture.names.length;
  const focused = document.activeElement === gesture.wheel;
  const commit = () => {
    if (wheelGesture === gesture) wheelGesture = null;
    if (!gesture.wheel.isConnected) return;
    if (target !== gesture.activeIndex) {
      if (gesture.kind === 'category') chooseCategory(gesture.values[target]);
      else chooseProduction(gesture.values[target]);
    } else if (gesture.kind === 'category') renderCategories();
    else renderProductions();
    if (focused) gesture.container.querySelector('.wheel')?.focus();
  };
  if (cancel) {
    commit();
    return;
  }
  gesture.wheel.classList.add('snapping');
  previewWheel(gesture, step * WHEEL_STEP);
  const visible = Math.min(5, gesture.names.length);
  const before = gesture.names.length === 2 ? target : visible - 1 - Math.floor((visible - 1) / 2);
  gesture.wheel.querySelectorAll('.wheel-item').forEach((item) => {
    const offset = Number(item.dataset.wheelOffset);
    if (offset < -before || offset >= visible - before) item.style.opacity = '0';
  });
  gesture.snapping = true;
  gesture.timer = setTimeout(commit, WHEEL_SNAP_DURATION);
}

function startWheelGesture(container, wheel, names, activeIndex, kind, values) {
  if (wheelGesture) finishWheelGesture();
  wheel.classList.remove('roll-up', 'roll-down', 'wrapped');
  wheel.classList.add('wheel-moving');
  wheelGesture = { container, wheel, names, activeIndex, kind, values, distance: 0, previewCenter: null };
  return wheelGesture;
}

function moveWheelByScroll(container, wheel, names, activeIndex, kind, values, distance) {
  if (wheelGesture && (wheelGesture.wheel !== wheel || wheelGesture.pointerId !== undefined)) {
    finishWheelGesture();
    wheelGesture = null;
  }
  const gesture = wheelGesture || startWheelGesture(container, wheel, names, activeIndex, kind, values);
  clearTimeout(gesture.timer);
  if (gesture.snapping) {
    gesture.distance = Math.round(gesture.distance / WHEEL_STEP) * WHEEL_STEP;
    gesture.wheel.classList.remove('snapping');
    gesture.snapping = false;
  }
  gesture.distance = wheelDistance(gesture, gesture.distance + distance);
  previewWheel(gesture);
  gesture.timer = setTimeout(() => finishWheelGesture(), 120);
}

function enableSwipeShift(container, getEntries, getActiveIndex, kind) {
  container.addEventListener('pointerdown', (event) => {
    const wheel = event.target.closest('.wheel');
    const entries = getEntries();
    if (!wheel || event.button !== 0 || entries.length < 2) return;
    if (wheelGesture && wheelGesture.wheel !== wheel) {
      finishWheelGesture();
      wheelGesture = null;
    }
    if (wheelGesture) {
      if (wheelGesture.pointerId !== undefined) return;
      clearTimeout(wheelGesture.timer);
      if (wheelGesture.snapping) wheelGesture.distance = Math.round(wheelGesture.distance / WHEEL_STEP) * WHEEL_STEP;
      wheelGesture.wheel.classList.remove('snapping');
      Object.assign(wheelGesture, { snapping: false, pointerId: event.pointerId, startY: event.clientY, baseDistance: wheelGesture.distance, moved: false });
      return;
    }
    const activeIndex = Math.max(0, entries.findIndex(({ index }) => index === getActiveIndex()));
    wheelGesture = { container, wheel, names: entries.map((entry) => entry[kind].name), activeIndex, kind, values: entries.map(({ index }) => index), distance: 0, previewCenter: null, pointerId: event.pointerId, startY: event.clientY, baseDistance: 0, moved: false };
  });
}
enableSwipeShift(byId('category-picker'), visibleCategories, () => state.categoryIndex, 'category');
enableSwipeShift(byId('production-list'), visibleProductions, () => state.productionIndex, 'production');
window.addEventListener('pointermove', (event) => {
  const gesture = wheelGesture;
  if (!gesture || event.pointerId !== gesture.pointerId || !gesture.wheel.isConnected) return;
  const movement = gesture.startY - event.clientY;
  gesture.distance = wheelDistance(gesture, gesture.baseDistance + movement);
  if (!gesture.moved && Math.abs(movement) < 4) return;
  if (!gesture.moved && event.isTrusted) gesture.wheel.setPointerCapture(event.pointerId);
  gesture.moved = true;
  gesture.wheel.classList.remove('roll-up', 'roll-down', 'wrapped');
  gesture.wheel.classList.add('wheel-moving');
  previewWheel(gesture);
});
['pointerup', 'pointercancel', 'blur'].forEach((type) => window.addEventListener(type, (event) => {
  const gesture = wheelGesture;
  if (!gesture || gesture.pointerId === undefined || (type !== 'blur' && event.pointerId !== gesture.pointerId)) return;
  delete gesture.pointerId;
  if (!gesture.moved) {
    if (gesture.previewCenter !== null) finishWheelGesture();
    else wheelGesture = null;
    return;
  }
  suppressWheelClick = true;
  setTimeout(() => { suppressWheelClick = false; }, 0);
  finishWheelGesture(type !== 'pointerup');
}));
window.addEventListener('click', (event) => {
  if (!suppressWheelClick) return;
  event.preventDefault();
  event.stopPropagation();
}, true);
// 滑鼠與觸控的上下按鈕已在 pointerdown 處理，click 只處理鍵盤（detail 為 0）
byId('category-picker').addEventListener('click', (event) => {
  const category = event.target.closest('[data-category]');
  const shift = event.target.closest('[data-shift]');
  const direction = category ? wheelDirection(category) : Number(shift?.dataset.shift);
  if (category) { noteWrap(visibleCategories(), state.categoryIndex, Number(category.dataset.category), direction); chooseCategory(Number(category.dataset.category)); }
  else if (shift && !event.detail) shiftCategory(direction);
  else return;
  rollWheel(event.currentTarget, direction);
});
byId('production-list').addEventListener('click', (event) => {
  const production = event.target.closest('[data-production]');
  const shift = event.target.closest('[data-shift]');
  const direction = production ? wheelDirection(production) : Number(shift?.dataset.shift);
  if (production) { noteWrap(visibleProductions(), state.productionIndex, Number(production.dataset.production), direction); chooseProduction(Number(production.dataset.production)); }
  else if (shift && !event.detail) shiftProduction(direction);
  else return;
  rollWheel(event.currentTarget, direction);
});
byId('item-list').addEventListener('change', (event) => { if (event.target.matches('[data-item]')) { setItem(event.target.dataset.item, event.target.checked); refreshSelection(); } });
byId('select-all').addEventListener('change', (event) => { visibleItems().forEach((item) => setItem(item, event.target.checked)); refreshSelection(); });
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
byId('selected-list').addEventListener('click', (event) => {
  const remove = event.target.closest('[data-key]');
  const clear = event.target.closest('[data-clear-port]');
  const port = event.target.closest('[data-port]');
  if (remove) { state.ports[Number(remove.dataset.port)].selected.delete(remove.dataset.key); refreshSelection(); }
  else if (clear) {
    state.portIndex = Number(clear.dataset.clearPort);
    state.ports[state.portIndex].selected.clear();
    refreshSelection();
    byId('port-list').querySelector('.port-tab.active')?.focus();
  }
  else if (port) choosePort(Number(port.dataset.port));
});
byId('clear-selection').addEventListener('click', () => {
  const affected = state.ports.filter((port) => port.selected.size).length;
  if (affected > 1 && !window.confirm(`確定清除 ${affected} 個 Port 的全部 ${totalSelected()} 個測試項目？`)) return;
  state.ports.forEach((port) => port.selected.clear());
  refreshSelection();
});
byId('copy-selection').addEventListener('click', async () => {
  const text = state.ports.flatMap((port) => sortedSelection(port.selected).map(([, { category, production, item }]) => `${port.name}, ${category}, ${production}, ${item}`)).join('\n');
  try { await navigator.clipboard.writeText(text); byId('message').textContent = '已複製選取清單'; }
  catch { byId('message').textContent = '無法複製，請確認瀏覽器的剪貼簿權限。'; }
});
byId('port-bar').addEventListener('click', (event) => {
  const tab = event.target.closest('[data-port]');
  const action = event.target.closest('[data-port-action]')?.dataset.portAction;
  if (tab) { choosePort(Number(tab.dataset.port)); byId('port-list').querySelector('[aria-pressed="true"]')?.focus(); }
  else if (action === 'add' || action === 'rename') openPortForm(action);
  else if (action === 'duplicate') duplicatePort();
  else if (action === 'delete') deletePort();
});
byId('port-cancel').addEventListener('click', closePortForm);
enablePortDrag(byId('port-list'), '.port-tab', '.port-tab', false);
enablePortDrag(byId('selected-list'), '.selected-group-name', '.selected-group', true);
window.addEventListener('pointermove', trackPortDrag);
['pointerup', 'pointercancel', 'blur'].forEach((type) => window.addEventListener(type, endPortDrag));
// 拖曳放開後瀏覽器仍可能送出 click，避免被當成切換 Port
window.addEventListener('click', (event) => { if (suppressPortClick) { suppressPortClick = false; event.stopPropagation(); event.preventDefault(); } }, true);
byId('port-name').addEventListener('input', (event) => event.target.setCustomValidity(''));
byId('port-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = byId('port-name');
  const name = input.value.trim();
  const rename = portFormMode === 'rename';
  const count = rename ? 1 : Math.min(MAX_PORT_BATCH, Math.max(1, Math.trunc(Number(byId('port-count').value)) || 1));
  const problem = name ? '' : '請輸入 Port 名稱';
  if (problem) {
    input.setCustomValidity(problem);
    input.reportValidity();
    return;
  }
  let message;
  if (rename) {
    currentPort().name = name;
    message = `已將 Port 重新命名為「${name}」`;
  } else {
    const names = count === 1 ? [name] : numberedPortNames(name, count);
    state.portIndex = state.ports.length;
    state.ports.push(...names.map((portName) => newPort(portName)));
    message = count === 1 ? `已新增 Port「${name}」` : `已新增 ${count} 個 Port：${names[0]} – ${names[count - 1]}`;
  }
  closePortForm();
  closeFavoriteForm();
  refreshSelection(message);
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
    const missing = loadPorts();
    chooseCategory(visibleCategories()[0]?.index ?? 0);
    if (missing) byId('message').textContent = `上次保存的勾選中有 ${missing} 項已不在資料中，已自動移除。`;
  } catch (error) {
    render();
    byId('message').textContent = '無法載入資料。請確認 data.js 存在且格式正確。';
    console.error('Failed to load data.js:', error);
  }
}
loadData();