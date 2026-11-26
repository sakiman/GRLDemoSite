/** 保存頁面狀態；selected 指向目前 Port 的測試項目。 */
const state = { categories: [], categoryIndex: 0, productionIndex: 0, mode: 'wheel', ports: [{ name: 'Port 1', selected: new Map() }], portIndex: 0, query: '', productionQuery: '', categoryQuery: '', favorites: [], get selected() { return this.ports[this.portIndex].selected; } };
/** 依 ID 取得頁面元素。 */
const byId = (id) => document.getElementById(id);
/** 跳脫文字中的 HTML 特殊字元，供產生頁面內容使用。 */
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
/** 將頁面中尚未處理的 Lucide 標記轉為圖示。 */
const icons = () => window.lucide?.createIcons();
/** 取得目前選取的分類。 */
const currentCategory = () => state.categories[state.categoryIndex];
/** 取得目前分類中選取的產品功能。 */
const currentProduction = () => currentCategory()?.productions[state.productionIndex];
/** 依名稱自然排序，數字按數值比較且忽略大小寫差異。 */
const compareNames = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
/** 圓柱模式依名稱排序，列表模式維持資料原順序。 */
const wheelOrder = (entries, key) => (state.mode === 'wheel' ? entries.sort((a, b) => compareNames(a[key].name, b[key].name)) : entries);
/** 依搜尋條件取得可見分類及其原始索引。 */
const visibleCategories = () => wheelOrder(state.categories.map((category, index) => ({ category, index })).filter(({ category }) => category.name.toLocaleLowerCase().includes(state.categoryQuery.toLocaleLowerCase())), 'category');
/** 依搜尋條件取得目前分類的可見產品功能及其原始索引。 */
const visibleProductions = () => wheelOrder((currentCategory()?.productions || []).map((production, index) => ({ production, index })).filter(({ production }) => production.name.toLocaleLowerCase().includes(state.productionQuery.toLocaleLowerCase())), 'production');
/** 將已選項目依分類、產品功能及項目名稱排序。 */
const sortedSelection = (selected = state.selected) => [...selected.entries()].sort(([, a], [, b]) => compareNames(a.category, b.category) || compareNames(a.production, b.production) || compareNames(a.item, b.item));
/** 由分類、產品功能與項目名稱組成已選項目的唯一鍵。 */
const itemKey = (category, production, item) => JSON.stringify([category, production, item]);
const FAVORITES_KEY = 'grl-test-selector-favorites';
/** 將項目物件轉為已選項目的唯一鍵。 */
const entryKey = ({ category, production, item }) => itemKey(category, production, item);
/** 檢查項目是否仍存在於目前載入的資料中。 */
const itemExists = ({ category, production, item }) => Boolean(state.categories.find((entry) => entry.name === category)?.productions.find((entry) => entry.name === production)?.items.includes(item));
/** 檢查保存的項目是否包含字串格式的分類、產品功能及項目名稱。 */
const isEntry = (entry) => [entry?.category, entry?.production, entry?.item].every((value) => typeof value === 'string');
const PORTS_KEY = 'grl-test-selector-ports';
const MAX_PORT_BATCH = 20;
/** 取得目前選取的 Port。 */
const currentPort = () => state.ports[state.portIndex];
/** 建立 Port，並將傳入的測試項目整理成以唯一鍵索引的 Map。 */
const newPort = (name, entries = []) => ({ name, selected: new Map(entries.map(({ category, production, item }) => [itemKey(category, production, item), { category, production, item }])) });
/** 檢查是否已有同名 Port。 */
const portNameTaken = (name) => state.ports.some((port) => port.name === name);
/** 計算所有 Port 已選測試項目的總數。 */
const totalSelected = () => state.ports.reduce((total, port) => total + port.selected.size, 0);

/** 產生指定數量且不與現有 Port 同名的編號名稱。 */
function numberedPortNames(base, count) {
  const names = [];
  for (let number = portNameTaken(base) ? 2 : 1; names.length < count; number += 1) {
    const name = `${base} ${number}`;
    if (!portNameTaken(name)) names.push(name);
  }
  return names;
}

/** 從 localStorage 載入 Port，回傳已保存但目前資料中找不到的項目數量。 */
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

/** 將所有 Port、勾選項目與目前 Port 存入 localStorage；成功時回傳 true。 */
function savePorts() {
  try {
    localStorage.setItem(PORTS_KEY, JSON.stringify({ active: state.portIndex, ports: state.ports.map(({ name, selected }) => ({ name, items: [...selected.values()] })) }));
    return true;
  } catch {
    return false;
  }
}

/** 保存 Port 設定並更新選取畫面；保存失敗時顯示提示。 */
function refreshSelection(message = '') {
  const notice = savePorts() ? message : '無法保存 Port 設定，重新整理後勾選內容將不會保留。';
  renderPorts();
  renderItems();
  renderSelection();
  if (notice) byId('message').textContent = notice;
}

/** 有多個 Port 時產生拖曳握把的 HTML。 */
const dragGrip = () => (state.ports.length > 1 ? '<i data-lucide="grip-vertical" class="drag-grip"></i>' : '');
/** 有多個 Port 時回傳可拖曳排序的提示文字。 */
const dragHint = () => (state.ports.length > 1 ? '（可拖曳調整順序）' : '');

/** 更新 Port 分頁、新增按鈕、刪除按鈕狀態及圖示。 */
function renderPorts() {
  byId('port-list').innerHTML = `${state.ports.map((port, index) => {
    const active = index === state.portIndex;
    return `<button type="button" class="port-tab ${active ? 'active' : ''}" data-port="${index}" aria-pressed="${active}" title="第 ${index + 1} 個 Port：${escapeHtml(port.name)}${dragHint()}">${dragGrip()}<b class="port-order">#${index + 1}</b><span>${escapeHtml(port.name)}</span><small>${port.selected.size}</small></button>`;
  }).join('')}<button type="button" class="port-add" data-port-action="add"><i data-lucide="plus"></i>新增 Port</button>`;
  byId('port-delete').disabled = state.ports.length < 2;
  icons();
}

let portFormMode = 'add';
/** 依新增或重新命名模式顯示並初始化 Port 表單。 */
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

/** 隱藏 Port 表單。 */
function closePortForm() {
  byId('port-form').hidden = true;
}

/** 切換目前 Port，關閉表單並刷新選取畫面。 */
function choosePort(index) {
  state.portIndex = index;
  closePortForm();
  closeFavoriteForm();
  refreshSelection();
}

/** 複製目前 Port 的勾選內容，並切換至新 Port。 */
function duplicatePort() {
  const source = currentPort();
  const [name] = numberedPortNames(source.name.replace(/\s+\d+$/, '') || source.name, 1);
  state.ports.push(newPort(name, [...source.selected.values()]));
  state.portIndex = state.ports.length - 1;
  closePortForm();
  refreshSelection(`已將「${source.name}」複製為「${name}」（${source.selected.size} 項）`);
}

/** 刪除目前 Port；至少保留一個 Port。 */
function deletePort() {
  if (state.ports.length < 2) return;
  const { name } = currentPort();
  state.ports.splice(state.portIndex, 1);
  state.portIndex = Math.min(state.portIndex, state.ports.length - 1);
  closePortForm();
  closeFavoriteForm();
  refreshSelection(`已刪除 Port「${name}」`);
}

/** 移動 Port 的排序位置，並保留目前選取的 Port。 */
function movePort(from, to) {
  const active = currentPort();
  const [port] = state.ports.splice(from, 1);
  state.ports.splice(to, 0, port);
  state.portIndex = state.ports.indexOf(active);
  refreshSelection(`已將「${port.name}」移到第 ${to + 1} 個位置`);
}

let portDrag = null;
let suppressPortClick = false;
/** 更新拖曳中的 Port 與預計插入位置的視覺標記。 */
const markPortDrop = (targets, from = -1, index = -1, after = false) => targets.forEach((target, position) => {
  target.classList.toggle('dragging', position === from);
  target.classList.toggle('drop-before', position === index && !after);
  target.classList.toggle('drop-after', position === index && after);
});

/** 在指定容器啟用 Port 拖曳排序；vertical 決定以垂直或水平位置判斷落點。 */
function enablePortDrag(container, handleSelector, targetSelector, vertical) {
  container.addEventListener('pointerdown', (event) => {
    const handle = event.target.closest(handleSelector);
    if (!handle || event.button !== 0 || state.ports.length < 2) return;
    const rect = handle.getBoundingClientRect();
    portDrag = { from: Number(handle.dataset.port), to: null, x: event.clientX, y: event.clientY, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, handle, ghost: null, container, targetSelector, vertical, active: false };
  });
}

/** 建立跟隨游標移動的半透明 Port 分身。 */
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

/** 更新 Port 拖曳分身與落點；移動距離不足時仍視為點選。 */
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

/** 結束或取消 Port 拖曳，清除視覺標記，並在有效落點更新順序。 */
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

/** 從 localStorage 載入格式有效且包含項目的最愛。 */
function loadFavorites() {
  try {
    const stored = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    return Array.isArray(stored) ? stored.filter((favorite) => typeof favorite?.name === 'string' && Array.isArray(favorite.items) && favorite.items.length && favorite.items.every(isEntry)) : [];
  } catch {
    return [];
  }
}

/** 保存最愛並更新畫面；保存失敗時提示使用者並回傳 false。 */
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

/** 更新最愛按鈕及其與目前 Port 勾選內容的符合狀態。 */
function renderFavorites() {
  byId('favorite-list').innerHTML = state.favorites.length ? state.favorites.map((favorite, index) => {
    const name = escapeHtml(favorite.name);
    const active = favorite.items.every((entry) => state.selected.has(entryKey(entry)));
    return `<span class="favorite-chip ${active ? 'active' : ''}"><button type="button" class="favorite-apply" data-favorite="${index}" aria-pressed="${active}" title="帶入「${name}」"><span>${name}</span><small>${favorite.items.length}</small></button><button type="button" class="favorite-remove" data-remove-favorite="${index}" title="刪除「${name}」" aria-label="刪除「${name}」"><i data-lucide="x"></i></button></span>`;
  }).join('') : '<span class="favorites-empty">勾選測試項目後，按「存為我的最愛」即可保存常用組合。</span>';
  icons();
}

/** 將仍存在的最愛項目加入目前 Port，並提示新增及缺失數量。 */
function applyFavorite(favorite) {
  const available = favorite.items.filter(itemExists);
  const added = available.filter((entry) => !state.selected.has(entryKey(entry)));
  added.forEach(({ category, production, item }) => state.selected.set(itemKey(category, production, item), { category, production, item }));
  const missing = favorite.items.length - available.length;
  refreshSelection(`已將「${favorite.name}」帶入「${currentPort().name}」：${added.length ? `新增 ${added.length} 項` : '項目都已在清單中'}${missing ? `，另有 ${missing} 項已不在資料中` : ''}`);
}

/** 經使用者確認後刪除指定的最愛。 */
function removeFavorite(index) {
  const { name } = state.favorites[index];
  if (!window.confirm(`確定刪除我的最愛「${name}」？`)) return;
  if (storeFavorites(state.favorites.filter((_, position) => position !== index))) byId('message').textContent = `已刪除我的最愛「${name}」`;
}

/** 隱藏最愛表單並清空名稱。 */
function closeFavoriteForm() {
  byId('favorite-form').hidden = true;
  byId('favorite-name').value = '';
}

/** 依選擇模式及搜尋條件更新分類選單、數量與空狀態。 */
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

/** 繪製有限邊界的圓柱選單，並綁定滾輪及方向鍵；values 對應資料原始索引。 */
function renderWheel(container, names, activeIndex, kind, noun, onShift, values = names.map((_, index) => index)) {
  const positions = ['far-previous', 'previous', 'center', 'next', 'far-next'];
  const items = positions.map((position, slot) => {
    const index = activeIndex + slot - 2;
    if (index < 0 || index >= names.length) return '';
    return `<button type="button" class="wheel-item ${position}" data-${kind}="${values[index]}" ${index === activeIndex ? 'aria-current="true"' : ''}><span>${escapeHtml(names[index])}</span>${index === activeIndex ? '<i data-lucide="arrow-right"></i>' : ''}</button>`;
  }).join('');
  container.innerHTML = `<div class="wheel-controls"><span>${noun}瀏覽</span><div><button type="button" data-shift="-1" title="上一個${noun}" aria-label="上一個${noun}" ${activeIndex === 0 ? 'disabled' : ''}><i data-lucide="chevron-up"></i></button><button type="button" data-shift="1" title="下一個${noun}" aria-label="下一個${noun}" ${activeIndex === names.length - 1 ? 'disabled' : ''}><i data-lucide="chevron-down"></i></button></div></div><div class="wheel" tabindex="0" aria-label="${noun}選擇器，可使用上下方向鍵">${items}</div><div class="wheel-caption"><span>SCROLL TO EXPLORE</span><span>${String(activeIndex + 1).padStart(2, '0')} / ${String(names.length).padStart(2, '0')}</span></div>`;
  const wheel = container.querySelector('.wheel');
  /** 移動選取項目，成功時播放圓柱動畫。 */
  const shift = (direction) => { if (onShift(direction)) rollWheel(container, direction); };
  wheel.addEventListener('wheel', (event) => {
    if (!event.deltaY || names.length < 2) return;
    event.preventDefault();
    const distance = event.deltaMode === 0
      ? Math.max(-WHEEL_STEP, Math.min(WHEEL_STEP, event.deltaY))
      : Math.sign(event.deltaY) * WHEEL_STEP;
    moveWheelByScroll(container, wheel, names, activeIndex, kind, values, distance);
  }, { passive: false });
  wheel.addEventListener('keydown', (event) => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); shift(event.key === 'ArrowDown' ? 1 : -1); container.querySelector('.wheel')?.focus(); } });
}

/** 依移動方向播放一次圓柱切換動畫。 */
function rollWheel(container, direction) {
  const wheel = container.querySelector('.wheel');
  if (!direction || !wheel || wheel.children.length < 2) return;
  wheel.classList.add(direction > 0 ? 'roll-down' : 'roll-up');
}

/** 依選擇模式及搜尋條件更新目前分類的產品功能選單。 */
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

/** 取得符合搜尋條件並依名稱排序的測試項目。 */
const visibleItems = () => (currentProduction()?.items || []).filter((item) => item.toLocaleLowerCase().includes(state.query.toLocaleLowerCase())).sort(compareNames);

/** 更新測試項目清單、勾選數量、全選狀態及目前路徑。 */
function renderItems() {
  const category = currentCategory();
  const production = currentProduction();
  const items = production?.items || [];
  const visible = visibleItems();
  /** 檢查目前分類與產品功能中的項目是否已勾選。 */
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

/** 更新所有 Port 的已選項目清單、總數與操作按鈕狀態。 */
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

/** 重新繪製 Port、選擇器及已選項目的主要畫面。 */
function render() { renderPorts(); renderCategories(); renderProductions(); renderItems(); renderSelection(); }
/** 切換分類，清除相關搜尋並選取該分類第一個可見產品功能。 */
function chooseCategory(index) { state.categoryIndex = index; state.query = ''; state.productionQuery = ''; state.productionIndex = visibleProductions()[0]?.index ?? 0; byId('item-search').value = ''; byId('production-search').value = ''; render(); }
/** 依方向切換相鄰的可見分類；超出邊界時回傳 false。 */
function shiftCategory(direction) {
  const visible = visibleCategories();
  const position = Math.max(0, visible.findIndex(({ index }) => index === state.categoryIndex));
  const target = visible[position + direction];
  if (!target) return false;
  chooseCategory(target.index);
  return true;
}
/** 切換產品功能，清除測試項目搜尋並更新相關畫面。 */
function chooseProduction(index) { state.productionIndex = index; state.query = ''; byId('item-search').value = ''; renderProductions(); renderItems(); }
/** 依方向切換相鄰的可見產品功能；超出邊界時回傳 false。 */
function shiftProduction(direction) {
  const visible = visibleProductions();
  const position = Math.max(0, visible.findIndex(({ index }) => index === state.productionIndex));
  const target = visible[position + direction];
  if (!target) return false;
  chooseProduction(target.index);
  return true;
}
/** 在目前 Port 中加入或移除目前分類及產品功能的測試項目。 */
function setItem(item, checked) {
  const category = currentCategory().name;
  const production = currentProduction().name;
  const key = itemKey(category, production, item);
  if (checked) state.selected.set(key, { category, production, item });
  else state.selected.delete(key);
}

// 切換圓柱與列表模式，並更新兩個選單。
document.querySelector('.mode-switch').addEventListener('click', (event) => {
  const button = event.target.closest('[data-mode]');
  if (!button) return;
  state.mode = button.dataset.mode;
  document.querySelectorAll('.mode-button').forEach((option) => { const active = option === button; option.classList.toggle('active', active); option.setAttribute('aria-pressed', String(active)); });
  renderCategories();
  renderProductions();
});
/** 依圓柱項目的位置判斷切換動畫方向。 */
const wheelDirection = (item) => (/previous/.test(item.className) ? -1 : /next/.test(item.className) ? 1 : 0);
let holdTimer = 0;
/** 停止上下按鈕長按時的延遲或連續切換。 */
function stopHold() {
  clearTimeout(holdTimer);
  clearInterval(holdTimer);
}
/** 綁定圓柱上下按鈕，按下時切換一次，長按時持續切換。 */
function enableHoldShift(container, shiftBy) {
  container.addEventListener('pointerdown', (event) => {
    const button = event.target.closest('[data-shift]');
    if (!button || event.button !== 0) return;
    const direction = Number(button.dataset.shift);
    /** 嘗試依按鈕方向切換一項，成功時播放動畫。 */
    const step = () => { if (shiftBy(direction)) rollWheel(container, direction); };
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
const WHEEL_MOMENTUM_DECELERATION = 0.002;
const WHEEL_MOMENTUM_MIN_SPEED = 0.08;
const WHEEL_MOMENTUM_MAX_SPEED = 1.8;
const WHEEL_VELOCITY_WINDOW = 100;
let wheelGesture = null;
let suppressWheelClick = false;

/** 依手勢距離預覽圓柱項目的位置與外觀，不直接變更已選項目。 */
function previewWheel(gesture, distance = gesture.distance) {
  const { wheel, names, activeIndex, kind, values } = gesture;
  const step = Math.round(distance / WHEEL_STEP);
  const center = activeIndex + step;
  const positions = ['outer-previous', 'far-previous', 'previous', 'center', 'next', 'far-next', 'outer-next'];
  if (gesture.previewCenter !== center) {
    wheel.innerHTML = positions.map((position, slot) => {
      const offset = slot - 3;
      const index = center + offset;
      if (index < 0 || index >= names.length) return '';
      return `<button type="button" class="wheel-item ${position}" data-wheel-offset="${offset}" data-${kind}="${values[index]}"><span>${escapeHtml(names[index])}</span></button>`;
    }).join('');
    gesture.previewCenter = center;
  }
  // 與靜止時的圓柱位置一致，避免回正後跳動
  const tops = [-53, -1, 43, 91, 143, 189, 235];
  const heights = [42, 42, 44, 48, 44, 42, 42];
  /** 以相鄰位置的數值內插，讓項目在圓柱上平滑移動。 */
  const interpolate = (values, position) => {
    const lower = Math.max(0, Math.min(5, Math.floor(position + 3)));
    const fraction = Math.max(0, Math.min(1, position + 3 - lower));
    return values[lower] + (values[lower + 1] - values[lower]) * fraction;
  };
  wheel.querySelectorAll('.wheel-item').forEach((item) => {
    const offset = Number(item.dataset.wheelOffset);
    const fraction = distance / WHEEL_STEP - step;
    const position = offset - fraction;
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

/** 結束圓柱手勢：取消時還原原選項，否則回正至最近項目後提交選取。 */
function finishWheelGesture(cancel = false) {
  const gesture = wheelGesture;
  if (!gesture) return;
  clearTimeout(gesture.timer);
  cancelAnimationFrame(gesture.frame);
  if (!gesture.wheel.isConnected) { wheelGesture = null; return; }
  const step = cancel ? 0 : Math.round(gesture.distance / WHEEL_STEP);
  const target = gesture.activeIndex + step;
  const focused = document.activeElement === gesture.wheel;
  /** 套用最終選取並重繪圓柱；必要時恢復鍵盤焦點。 */
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
  gesture.wheel.querySelectorAll('.wheel-item').forEach((item) => {
    const offset = Number(item.dataset.wheelOffset);
    if (Math.abs(offset) > 2) item.style.opacity = '0';
  });
  gesture.snapping = true;
  gesture.timer = setTimeout(commit, WHEEL_SNAP_DURATION);
}

/** 建立滾輪手勢狀態，並將圓柱切換至移動中的外觀。 */
function startWheelGesture(container, wheel, names, activeIndex, kind, values) {
  if (wheelGesture) finishWheelGesture();
  wheel.classList.remove('roll-up', 'roll-down');
  wheel.classList.add('wheel-moving');
  wheelGesture = { container, wheel, names, activeIndex, kind, values, distance: 0, previewCenter: null };
  return wheelGesture;
}

/** 累積滾輪移動距離並更新預覽；停止滾動後執行回正。 */
function moveWheelByScroll(container, wheel, names, activeIndex, kind, values, distance) {
  if (wheelGesture && (wheelGesture.wheel !== wheel || wheelGesture.pointerId !== undefined)) {
    finishWheelGesture(true);
  }
  const gesture = wheelGesture || startWheelGesture(container, wheel, names, activeIndex, kind, values);
  clearTimeout(gesture.timer);
  cancelAnimationFrame(gesture.frame);
  gesture.frame = null;
  if (gesture.snapping) {
    gesture.distance = Math.round(gesture.distance / WHEEL_STEP) * WHEEL_STEP;
    gesture.wheel.classList.remove('snapping');
    gesture.snapping = false;
  }
  gesture.distance = clampWheelDistance(gesture, gesture.distance + distance);
  previewWheel(gesture);
  gesture.timer = setTimeout(() => finishWheelGesture(), 120);
}

/** 將圓柱移動距離限制在第一項與最後一項之間。 */
function clampWheelDistance(gesture, distance) {
  return Math.max(-gesture.activeIndex * WHEEL_STEP, Math.min((gesture.names.length - 1 - gesture.activeIndex) * WHEEL_STEP, distance));
}

/** 記錄近期觸控位置，用於估算放手時的滑動速度。 */
function sampleWheelVelocity(gesture) {
  const now = performance.now();
  gesture.samples.push({ time: now, distance: gesture.distance });
  gesture.samples = gesture.samples.filter((sample) => now - sample.time <= WHEEL_VELOCITY_WINDOW);
}

/** 觸控放手後依近期速度逐漸減速，停止或碰到邊界後回正。 */
function coastWheel(gesture) {
  sampleWheelVelocity(gesture);
  const first = gesture.samples[0];
  const last = gesture.samples[gesture.samples.length - 1];
  const elapsed = last.time - first.time;
  let velocity = elapsed > 0 ? (last.distance - first.distance) / elapsed : 0;
  velocity = Math.max(-WHEEL_MOMENTUM_MAX_SPEED, Math.min(WHEEL_MOMENTUM_MAX_SPEED, velocity));
  if (Math.abs(velocity) < WHEEL_MOMENTUM_MIN_SPEED || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    finishWheelGesture();
    return;
  }
  let previousTime = performance.now();
  /** 更新一個慣性動畫影格；速度不足或碰到邊界時結束手勢。 */
  const tick = (time) => {
    if (wheelGesture !== gesture) return;
    if (!gesture.wheel.isConnected) { wheelGesture = null; return; }
    const duration = Math.min(time - previousTime, Math.abs(velocity) / WHEEL_MOMENTUM_DECELERATION);
    previousTime = time;
    const nextVelocity = velocity - Math.sign(velocity) * WHEEL_MOMENTUM_DECELERATION * duration;
    const nextDistance = gesture.distance + (velocity + nextVelocity) * duration / 2;
    gesture.distance = clampWheelDistance(gesture, nextDistance);
    previewWheel(gesture);
    velocity = nextVelocity;
    if (gesture.distance !== nextDistance || Math.abs(velocity) < WHEEL_MOMENTUM_MIN_SPEED) {
      finishWheelGesture();
    } else {
      gesture.frame = requestAnimationFrame(tick);
    }
  };
  gesture.frame = requestAnimationFrame(tick);
}

/** 綁定圓柱拖曳起始事件，並處理新手勢對慣性或回正的中斷。 */
function enableSwipeShift(container, getEntries, getActiveIndex, kind) {
  container.addEventListener('pointerdown', (event) => {
    const wheel = event.target.closest('.wheel');
    const entries = getEntries();
    if (!wheel || event.button !== 0 || entries.length < 2) return;
    if (wheelGesture && wheelGesture.wheel !== wheel) {
      finishWheelGesture(true);
    }
    if (wheelGesture) {
      if (wheelGesture.pointerId !== undefined) return;
      clearTimeout(wheelGesture.timer);
      const interruptedMomentum = Boolean(wheelGesture.frame);
      cancelAnimationFrame(wheelGesture.frame);
      wheelGesture.frame = null;
      if (wheelGesture.snapping) wheelGesture.distance = Math.round(wheelGesture.distance / WHEEL_STEP) * WHEEL_STEP;
      wheelGesture.wheel.classList.remove('snapping');
      Object.assign(wheelGesture, { snapping: false, pointerId: event.pointerId, pointerType: event.pointerType, startY: event.clientY, baseDistance: wheelGesture.distance, moved: false, interruptedMomentum, samples: [] });
      if (event.pointerType === 'touch') sampleWheelVelocity(wheelGesture);
      return;
    }
    const activeIndex = Math.max(0, entries.findIndex(({ index }) => index === getActiveIndex()));
    wheelGesture = { container, wheel, names: entries.map((entry) => entry[kind].name), activeIndex, kind, values: entries.map(({ index }) => index), distance: 0, previewCenter: null, pointerId: event.pointerId, pointerType: event.pointerType, startY: event.clientY, baseDistance: 0, moved: false, samples: [] };
    if (event.pointerType === 'touch') sampleWheelVelocity(wheelGesture);
  });
}
enableSwipeShift(byId('category-picker'), visibleCategories, () => state.categoryIndex, 'category');
enableSwipeShift(byId('production-list'), visibleProductions, () => state.productionIndex, 'production');
// 拖曳時更新圓柱預覽；碰到邊界後重設基準，讓反向滑動立即生效。
window.addEventListener('pointermove', (event) => {
  const gesture = wheelGesture;
  if (!gesture || event.pointerId !== gesture.pointerId || !gesture.wheel.isConnected) return;
  const movement = gesture.startY - event.clientY;
  const nextDistance = gesture.baseDistance + movement;
  gesture.distance = clampWheelDistance(gesture, nextDistance);
  if (gesture.pointerType === 'touch') sampleWheelVelocity(gesture);
  if (!gesture.moved && Math.abs(movement) < 4) return;
  if (!gesture.moved && event.isTrusted) gesture.wheel.setPointerCapture(event.pointerId);
  gesture.moved = true;
  if (gesture.distance !== nextDistance) {
    gesture.startY = event.clientY;
    gesture.baseDistance = gesture.distance;
    if (gesture.pointerType === 'touch') gesture.samples = gesture.samples.slice(-1);
  }
  gesture.wheel.classList.remove('roll-up', 'roll-down');
  gesture.wheel.classList.add('wheel-moving');
  previewWheel(gesture);
});
// 結束拖曳：觸控放手啟動慣性，取消或失焦則還原選項。
['pointerup', 'pointercancel', 'blur'].forEach((type) => window.addEventListener(type, (event) => {
  const gesture = wheelGesture;
  if (!gesture || gesture.pointerId === undefined || (type !== 'blur' && event.pointerId !== gesture.pointerId)) return;
  delete gesture.pointerId;
  if (!gesture.moved) {
    if (gesture.interruptedMomentum) {
      suppressWheelClick = true;
      setTimeout(() => { suppressWheelClick = false; }, 0);
    }
    if (gesture.previewCenter !== null) finishWheelGesture();
    else wheelGesture = null;
    return;
  }
  suppressWheelClick = true;
  setTimeout(() => { suppressWheelClick = false; }, 0);
  if (type === 'pointerup' && gesture.pointerType === 'touch') coastWheel(gesture);
  else finishWheelGesture(type !== 'pointerup');
}));
// 避免拖曳結束後產生的 click 意外選取圓柱項目。
window.addEventListener('click', (event) => {
  if (!suppressWheelClick) return;
  event.preventDefault();
  event.stopPropagation();
}, true);
// 滑鼠與觸控的上下按鈕已在 pointerdown 處理，click 只處理鍵盤（detail 為 0）
// 處理分類項目點選及鍵盤觸發的上下按鈕。
byId('category-picker').addEventListener('click', (event) => {
  const category = event.target.closest('[data-category]');
  const shift = event.target.closest('[data-shift]');
  const direction = category ? wheelDirection(category) : Number(shift?.dataset.shift);
  if (category) chooseCategory(Number(category.dataset.category));
  else if (!shift || event.detail || !shiftCategory(direction)) return;
  rollWheel(event.currentTarget, direction);
});
// 處理產品功能點選及鍵盤觸發的上下按鈕。
byId('production-list').addEventListener('click', (event) => {
  const production = event.target.closest('[data-production]');
  const shift = event.target.closest('[data-shift]');
  const direction = production ? wheelDirection(production) : Number(shift?.dataset.shift);
  if (production) chooseProduction(Number(production.dataset.production));
  else if (!shift || event.detail || !shiftProduction(direction)) return;
  rollWheel(event.currentTarget, direction);
});
// 更新個別項目及全選操作，並保存目前 Port 的勾選內容。
byId('item-list').addEventListener('change', (event) => { if (event.target.matches('[data-item]')) { setItem(event.target.dataset.item, event.target.checked); refreshSelection(); } });
byId('select-all').addEventListener('change', (event) => { visibleItems().forEach((item) => setItem(item, event.target.checked)); refreshSelection(); });
// 依輸入內容篩選測試項目。
byId('item-search').addEventListener('input', (event) => { state.query = event.target.value.trim(); renderItems(); });
// 篩選分類；目前選項不在結果中時改選第一項。
byId('category-search').addEventListener('input', (event) => {
  state.categoryQuery = event.target.value.trim();
  const visible = visibleCategories();
  if (visible.length && !visible.some(({ index }) => index === state.categoryIndex)) chooseCategory(visible[0].index);
  else renderCategories();
});
// 篩選產品功能；目前選項不在結果中時改選第一項。
byId('production-search').addEventListener('input', (event) => {
  state.productionQuery = event.target.value.trim();
  const visible = visibleProductions();
  if (visible.length && !visible.some(({ index }) => index === state.productionIndex)) chooseProduction(visible[0].index);
  else renderProductions();
});
// 處理已選清單中的移除項目、清除 Port 及切換 Port 操作。
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
// 清除所有 Port 的勾選；影響多個 Port 時先要求確認。
byId('clear-selection').addEventListener('click', () => {
  const affected = state.ports.filter((port) => port.selected.size).length;
  if (affected > 1 && !window.confirm(`確定清除 ${affected} 個 Port 的全部 ${totalSelected()} 個測試項目？`)) return;
  state.ports.forEach((port) => port.selected.clear());
  refreshSelection();
});
// 將所有 Port 的已選項目複製到剪貼簿，並顯示操作結果。
byId('copy-selection').addEventListener('click', async () => {
  const text = state.ports.flatMap((port) => sortedSelection(port.selected).map(([, { category, production, item }]) => `${port.name}, ${category}, ${production}, ${item}`)).join('\n');
  try { await navigator.clipboard.writeText(text); byId('message').textContent = '已複製選取清單'; }
  catch { byId('message').textContent = '無法複製，請確認瀏覽器的剪貼簿權限。'; }
});
// 處理 Port 切換、新增、重新命名、複製與刪除操作。
byId('port-bar').addEventListener('click', (event) => {
  const tab = event.target.closest('[data-port]');
  const action = event.target.closest('[data-port-action]')?.dataset.portAction;
  if (tab) { choosePort(Number(tab.dataset.port)); byId('port-list').querySelector('[aria-pressed="true"]')?.focus(); }
  else if (action === 'add' || action === 'rename') openPortForm(action);
  else if (action === 'duplicate') duplicatePort();
  else if (action === 'delete') deletePort();
});
// 綁定 Port 表單取消與兩處 Port 清單的拖曳排序。
byId('port-cancel').addEventListener('click', closePortForm);
enablePortDrag(byId('port-list'), '.port-tab', '.port-tab', false);
enablePortDrag(byId('selected-list'), '.selected-group-name', '.selected-group', true);
window.addEventListener('pointermove', trackPortDrag);
['pointerup', 'pointercancel', 'blur'].forEach((type) => window.addEventListener(type, endPortDrag));
// 拖曳放開後瀏覽器仍可能送出 click，避免被當成切換 Port
window.addEventListener('click', (event) => { if (suppressPortClick) { suppressPortClick = false; event.stopPropagation(); event.preventDefault(); } }, true);
// 修改 Port 名稱時清除先前的表單驗證錯誤。
byId('port-name').addEventListener('input', (event) => event.target.setCustomValidity(''));
// 驗證 Port 表單並依模式新增、批次新增或重新命名。
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
// 開啟或取消最愛表單。
byId('save-favorite').addEventListener('click', () => { byId('favorite-form').hidden = false; byId('favorite-name').focus(); });
byId('favorite-cancel').addEventListener('click', closeFavoriteForm);
// 以目前 Port 的選取內容新增或更新同名最愛。
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
// 處理最愛的套用與刪除操作。
byId('favorite-list').addEventListener('click', (event) => {
  const apply = event.target.closest('[data-favorite]');
  const remove = event.target.closest('[data-remove-favorite]');
  if (apply) applyFavorite(state.favorites[Number(apply.dataset.favorite)]);
  else if (remove) removeFavorite(Number(remove.dataset.removeFavorite));
});

/** 驗證並載入 data.js、最愛與 Port 設定，完成初始選取及畫面呈現。 */
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