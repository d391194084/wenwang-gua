// 平台與保存邊界：Service Worker 快取範圍與 HTTP 錯誤、雙分頁設定合併、紀錄視窗重新讀取。
// 直接讀專案 3-2.html 與 sw.js，用 VM 模型執行原事件函式；只替換畫布與表格繪製，不依賴 tmp。
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const appRaw = fs.readFileSync(path.join(ROOT, '3-2.html'), 'utf8');
const swRaw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const sha = text => crypto.createHash('sha256').update(Buffer.from(text)).digest('hex');
const sourceHash = sha(appRaw), swHash = sha(swRaw), records = [];
const appScript = appRaw.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
const INIT_MARK = '/* ---------- 初始化 ---------- */';
const lunarLib = require(path.join(ROOT, 'lib/lunar.js'));

/* ---------- Service Worker 模型 ---------- */

const BASE = 'https://example.test/wenwang-gua/';
const urlOf = x => new URL(typeof x === 'string' ? x : x.url, BASE).href;
const noSearch = x => { const u = new URL(x); u.search = ''; return u.href; };
const DOC = '<!DOCTYPE html>';

function loadSw() {
  const events = {}, stores = new Map(), timers = [], deleted = [];
  let fetchImpl = () => Promise.reject(new Error('offline'));
  const caches = {
    keys: async () => Array.from(stores.keys()),
    delete: async k => { deleted.push(k); return stores.delete(k); },
    open: async k => {
      if (!stores.has(k)) stores.set(k, new Map());
      const data = stores.get(k);
      return {
        addAll: async paths => { for (const p of paths) data.set(urlOf(p), new Response(fs.readFileSync(path.join(ROOT, p === './' ? 'index.html' : p.replace(/^\.\//, ''))))); },
        // 依真實 CacheStorage：put 先移除同網址舊筆再附加；match 依清單順序回第一筆，ignoreSearch 時不會偏好精確網址
        put: async (req, res) => { const k = urlOf(req); data.delete(k); data.set(k, res.clone()); },
        match: async (req, opts) => {
          const target = urlOf(req), ignoreSearch = !!(opts && opts.ignoreSearch);
          const key = Array.from(data.keys()).find(k => ignoreSearch ? noSearch(k) === noSearch(target) : k === target);
          return key === undefined ? undefined : data.get(key).clone();
        }
      };
    }
  };
  const env = { URL, Promise, Response, location: { origin: new URL(BASE).origin }, fetch: r => fetchImpl(r), caches, setTimeout: fn => { timers.push(fn); return timers.length; }, self: { addEventListener: (n, f) => { events[n] = f; }, skipWaiting: () => {}, clients: { claim: () => {} } } };
  vm.createContext(env);
  vm.runInContext(swRaw, env, { filename: 'sw.js' });
  return {
    env, stores, deleted, timers, caches,
    setFetch: fn => { fetchImpl = fn; },
    async lifecycle(name) { let work; events[name]({ waitUntil: p => { work = p; } }); await work; },
    async request(pathname) {
      let response;
      events.fetch({ request: { url: urlOf(pathname), method: 'GET', mode: 'navigate', destination: 'document' }, respondWith: p => { response = p; } });
      return await response;
    },
    async asset(pathname) {
      let response;
      events.fetch({ request: { url: urlOf(pathname), method: 'GET', mode: 'no-cors', destination: 'script' }, respondWith: p => { response = p; } });
      return await response;
    },
    async cachedText(pathname) { const hit = await (await caches.open(env.CACHE)).match(urlOf(pathname)); return hit && await hit.text(); }
  };
}
const flush = () => new Promise(r => setImmediate(r));
const errorBody = status => new Response('SERVER ERROR ' + status, { status });

/* ---------- 3-2.html 設定與紀錄模型 ---------- */

function storage() {
  const data = new Map(), hooks = [];
  return {
    data,
    getItem(k) { const v = data.has(k) ? data.get(k) : null; if (k === 'wenwang_gua_settings') hooks.splice(0).forEach(fn => fn()); return v; },
    setItem: (k, v) => { data.set(k, String(v)); },
    afterNextSettingsRead: fn => { hooks.push(fn); }
  };
}

function dom() {
  const fields = new Map(), selected = { castMode: 'auto', ziMode: '00', gender: '' };
  const radios = { castMode: ['auto', 'manual'], ziMode: ['00', '23'], gender: ['', '男', '女'] };
  function el(id) {
    if (!fields.has(id)) fields.set(id, {
      id, value: '', disabled: false, _html: '', children: [], listeners: {},
      options: ['', '世', '應', '父母', '兄弟', '子孫', '妻財', '官鬼'].map(text => ({ text })),
      get selectedIndex() { return this.options.findIndex(o => o.text === this.value); },
      get innerHTML() { return this._html; }, set innerHTML(v) { this._html = v; this.children = []; },
      classList: { toggle: () => {}, add: () => {}, remove: () => {}, contains: () => false },
      getContext: () => ({}), addEventListener(n, f) { (this.listeners[n] = this.listeners[n] || []).push(f); },
      appendChild(c) { this.children.push(c); }, setAttribute: () => {}, removeAttribute: () => {}
    });
    return fields.get(id);
  }
  const radioEls = {};
  for (const [name, values] of Object.entries(radios)) radioEls[name] = values.map(value => ({
    value, disabled: false, listeners: {},
    get checked() { return selected[name] === value; }, set checked(v) { if (v) selected[name] = value; },
    addEventListener(n, f) { (this.listeners[n] = this.listeners[n] || []).push(f); }
  }));
  const document = {
    getElementById: el,
    createElement: tag => ({ ...el(Symbol(tag)), tag }),
    querySelectorAll: s => { const m = s.match(/input\[name="([^"]+)"\]/); return (m && radioEls[m[1]]) || []; },
    querySelector: s => {
      const m = s.match(/input\[name="([^"]+)"\](?:\[value="([^"]*)"\])?/);
      if (!m || !radioEls[m[1]]) return null;
      return radioEls[m[1]].find(r => m[2] !== undefined ? r.value === m[2] : r.checked) || null;
    },
    documentElement: { style: { removeProperty: () => {}, setProperty: () => {} } },
    body: { appendChild: () => {}, removeChild: () => {} }
  };
  function change(name, value) {
    const r = radioEls[name].find(x => x.value === value);
    assert(r, '找不到選項 ' + name + '=' + value);
    r.checked = true;
    (r.listeners.change || []).forEach(f => f.call(r));
  }
  return { el, selected, document, change };
}

let ticks = 0;
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : ['2026-10-27T23:30:00+08:00'])); }
  static now() { return 1793115000000 + (ticks++); }
}

function openTab(localStorage, { search = '', hash = '' } = {}) {
  const d = dom();
  const env = {
    Solar: lunarLib.Solar, Date: Clock, console, localStorage, document: d.document,
    window: { matchMedia: () => ({ matches: false }), addEventListener: () => {} },
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {}, navigator: {},
    location: { protocol: 'https:', search, hash, pathname: '/wenwang-gua/3-2.html' }, history: { replaceState: () => {} }
  };
  vm.createContext(env);
  for (const n of ['zhouyi', 'jiegua']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'lib', n + '.js'), 'utf8'), env);
  vm.runInContext(appScript.split(INIT_MARK)[0], env, { filename: '3-2.html' });
  env.drawCoins = () => {}; env.renderPan = () => {}; env.scheduleFitFont = () => {};
  vm.runInContext(appScript.slice(appScript.indexOf(INIT_MARK)), env, { filename: '3-2.html' });
  function cast(question) {
    env.resetAll(); d.el('question').value = question; env.autoPickYong();
    for (let i = 0; i < 6; i++) env.manualCast(2);
    return env.readHistory()[0];
  }
  return { ...d, env, cast, rows: () => d.el('historyList').children, saved: () => JSON.parse(localStorage.getItem(env.SETTINGS_KEY)) };
}
const rowText = row => row.children[0].textContent;

/* ---------- 測試 ---------- */

const jobs = [];
const test = (id, fn) => jobs.push({ id, fn });

// SW-01：activate 只清本 App 舊版快取
test('SW-01 啟用新版只刪本 App 舊版快取，同 origin 其他 App 的快取保留', async () => {
  const x = loadSw(); await x.lifecycle('install');
  x.stores.set('other-app-v3', new Map([['https://example.test/other-app/', new Response('other offline')]]));
  x.stores.set('wenwang-gua-v47', new Map()); x.stores.set('wenwang-gua-v1', new Map()); x.stores.set('notes-cache', new Map());
  await x.lifecycle('activate');
  assert.deepEqual(Array.from(x.stores.keys()).sort(), [x.env.CACHE, 'notes-cache', 'other-app-v3'].sort());
  assert.deepEqual(x.deleted.sort(), ['wenwang-gua-v1', 'wenwang-gua-v47']);
});
test('SW-01 反例：只有本 App 舊版時，舊版清掉、目前版本保留且仍有預快取', async () => {
  const x = loadSw(); await x.lifecycle('install'); x.stores.set('wenwang-gua-v47', new Map());
  await x.lifecycle('activate');
  assert.deepEqual(Array.from(x.stores.keys()), [x.env.CACHE]);
  assert((await x.cachedText('3-2.html')).startsWith(DOC));
});

// SW-02：HTTP 錯誤時回既有快取；沒有快取則保留原錯誤
for (const status of [404, 500, 503]) {
  test('SW-02 HTML 網路回 ' + status + ' 時回該頁既有快取，錯誤頁不寫進快取', async () => {
    const x = loadSw(); await x.lifecycle('install'); x.setFetch(async () => errorBody(status));
    for (const p of ['3-2.html', 'index.html', './', '3-2.html?mode=manual']) {
      const res = await x.request(p);
      assert.equal(res.status, 200, p);
      assert((await res.text()).startsWith(DOC), p);
    }
    assert((await x.cachedText('3-2.html')).startsWith(DOC));
    assert((await x.cachedText('index.html')).startsWith(DOC));
  });
  test('SW-02 反例：沒有快取時保留原本 ' + status + ' 錯誤，也不拿別頁頂替', async () => {
    const x = loadSw(); x.setFetch(async () => errorBody(status));
    const none = await x.request('3-2.html');
    assert.equal(none.status, status); assert.equal(await none.text(), 'SERVER ERROR ' + status);
    await x.lifecycle('install');
    const other = await x.request('no-such-page.html');
    assert.equal(other.status, status); assert.equal(await other.text(), 'SERVER ERROR ' + status);
    const deep = await x.request('some/other/path/');
    assert.equal(deep.status, status);
  });
}
test('SW-02 反例：HTTP 200 照常回傳並更新快取', async () => {
  const x = loadSw(); await x.lifecycle('install'); x.setFetch(async () => new Response('new HTML', { status: 200 }));
  const res = await x.request('3-2.html');
  assert.equal(await res.text(), 'new HTML'); assert.equal(await x.cachedText('3-2.html'), 'new HTML');
  const q = await x.request('3-2.html?mode=auto');
  assert.equal(await q.text(), 'new HTML');
});
test('SW-02 反例：錯誤回應之後，下一次 200 仍會更新快取（錯誤不鎖死快取）', async () => {
  const x = loadSw(); await x.lifecycle('install');
  x.setFetch(async () => errorBody(503)); await x.request('3-2.html');
  x.setFetch(async () => new Response('fresh HTML', { status: 200 })); await x.request('3-2.html');
  assert.equal(await x.cachedText('3-2.html'), 'fresh HTML');
  x.setFetch(async () => errorBody(500));
  assert.equal(await (await x.request('3-2.html')).text(), 'fresh HTML');
});
test('SW-02 反例：離線（fetch reject）有快取回快取，沒快取不會捏造頁面', async () => {
  const x = loadSw(); x.setFetch(() => Promise.reject(new Error('offline')));
  assert(!(await x.request('3-2.html')));
  await x.lifecycle('install');
  for (const p of ['./', 'index.html', '3-2.html', '3-2.html?mode=manual']) assert((await (await x.request(p)).text()).startsWith(DOC), p);
  assert(!(await x.request('no-such-page.html')));
});
test('SW-02 反例：4 秒沒回應有快取回快取，之後才到的 503 不影響', async () => {
  const x = loadSw(); await x.lifecycle('install');
  let settle; x.setFetch(() => new Promise(r => { settle = r; }));
  const pending = x.request('3-2.html'); await flush(); x.timers.forEach(f => f());
  const res = await pending;
  assert.equal(res.status, 200); assert((await res.text()).startsWith(DOC));
  settle(errorBody(503)); await flush();
  assert((await x.cachedText('3-2.html')).startsWith(DOC));
});
test('SW-02 反例：4 秒沒回應且沒有快取時，等網路結果並保留原錯誤或 200', async () => {
  for (const [status, expected] of [[503, 'SERVER ERROR 503'], [200, 'late HTML']]) {
    const x = loadSw(); let settle; x.setFetch(() => new Promise(r => { settle = r; }));
    const pending = x.request('3-2.html'); await flush(); x.timers.forEach(f => f());
    settle(status === 200 ? new Response(expected, { status }) : errorBody(status));
    const res = await pending;
    assert.equal(res.status, status); assert.equal(await res.text(), expected);
  }
});
test('SW-02 反例：伺服器導向（opaqueredirect）原樣交給瀏覽器，不用快取頂替', async () => {
  const x = loadSw(); await x.lifecycle('install');
  const redirect = { type: 'opaqueredirect', status: 0, ok: false, clone() { return this; } };
  x.setFetch(async () => redirect);
  assert.equal(await x.request('3-2.html'), redirect);
});
test('SW-02 反例：非頁面檔案仍先回快取；沒快取的檔案保留原錯誤', async () => {
  const x = loadSw(); await x.lifecycle('install'); x.setFetch(async () => errorBody(503));
  assert((await (await x.asset('lib/lunar.js')).text()).length > 1000);
  assert.equal((await x.asset('lib/not-cached.js')).status, 503);
});

// SW-03：同一頁不同查詢參數各自有快取時，精確網址的快取優先，不被先存進去的 canonical 舊內容頂替
const FRESH = '3-2.html?network=fresh', MANUAL = '3-2.html?mode=manual';
const respondByUrl = bodies => async r => new Response(bodies[urlOf(r)], { status: 200 });
async function seedPageVariants() {
  const x = loadSw(); await x.lifecycle('install');
  x.setFetch(respondByUrl({ [urlOf(MANUAL)]: 'MANUAL OLD', [urlOf(FRESH)]: 'FRESH NETWORK' }));
  assert.equal(await (await x.request(MANUAL)).text(), 'MANUAL OLD');
  assert.equal(await (await x.request(FRESH)).text(), 'FRESH NETWORK');
  await flush();
  assert.equal(await x.cachedText(FRESH), 'FRESH NETWORK');
  return x;
}
async function assertVariantsKept(x, label) {
  assert.equal(await (await x.request(FRESH)).text(), 'FRESH NETWORK', label + ' ?network=fresh');
  assert.equal(await (await x.request(MANUAL)).text(), 'MANUAL OLD', label + ' ?mode=manual');
  assert.equal(await (await x.request('3-2.html')).text(), appRaw, label + ' canonical');
  assert.equal(await x.cachedText(FRESH), 'FRESH NETWORK', label + ' 錯誤或離線不改寫快取');
}
test('SW-03 模型自檢：ignoreSearch 依清單順序回第一筆，不偏好精確網址；不加 ignoreSearch 才只比對精確網址', async () => {
  const x = loadSw(), c = await x.caches.open('model-check');
  await c.put('3-2.html', new Response('CANONICAL OLD')); await c.put(FRESH, new Response('FRESH NEW'));
  assert.equal(await (await c.match(FRESH, { ignoreSearch: true })).text(), 'CANONICAL OLD');
  assert.equal(await (await c.match(FRESH)).text(), 'FRESH NEW');
  assert(!(await c.match('3-2.html?unseen=1')));
  await c.put(FRESH, new Response('FRESH NEWER'));
  assert.equal(await (await c.match(FRESH)).text(), 'FRESH NEWER');
  assert.equal(await (await c.match('3-2.html')).text(), 'CANONICAL OLD');
});
for (const [label, setup] of [
  ['離線（fetch reject）', x => x.setFetch(() => Promise.reject(new Error('offline')))],
  ['HTTP 404', x => x.setFetch(async () => errorBody(404))],
  ['HTTP 500', x => x.setFetch(async () => errorBody(500))],
  ['HTTP 503', x => x.setFetch(async () => errorBody(503))]
]) {
  test('SW-03 ' + label + '：canonical 舊內容與精確查詢新內容並存時，各網址回自己的快取', async () => {
    const x = await seedPageVariants(); setup(x);
    await assertVariantsKept(x, label);
  });
}
test('SW-03 4 秒沒回應：精確查詢網址回自己的快取，之後才到的 503 不改寫', async () => {
  const x = await seedPageVariants();
  for (const [p, expected] of [[FRESH, 'FRESH NETWORK'], [MANUAL, 'MANUAL OLD'], ['3-2.html', appRaw]]) {
    let settle; x.setFetch(() => new Promise(r => { settle = r; }));
    const pending = x.request(p); await flush(); x.timers.forEach(f => f());
    const res = await pending;
    assert.equal(res.status, 200, p); assert.equal(await res.text(), expected, p);
    settle(errorBody(503)); await flush();
  }
  assert.equal(await x.cachedText(FRESH), 'FRESH NETWORK');
});
test('SW-03 精確網址優先與快取清單順序無關：精確網址在 canonical 前或後都回自己的快取', async () => {
  for (const order of [['3-2.html', FRESH], [FRESH, '3-2.html']]) {
    const x = loadSw();
    x.stores.set(x.env.CACHE, new Map(order.map(p => [urlOf(p), new Response(p === FRESH ? 'FRESH NETWORK' : 'CANONICAL OLD')])));
    x.setFetch(() => Promise.reject(new Error('offline')));
    assert.equal(await (await x.request(FRESH)).text(), 'FRESH NETWORK', order.join(' → '));
    assert.equal(await (await x.request('3-2.html')).text(), 'CANONICAL OLD', order.join(' → '));
  }
});
test('SW-03 200 更新後立刻離線：精確查詢網址回最新一次，canonical 與其他查詢不受影響', async () => {
  const x = await seedPageVariants();
  x.setFetch(respondByUrl({ [urlOf(FRESH)]: 'FRESH V2' })); assert.equal(await (await x.request(FRESH)).text(), 'FRESH V2');
  x.setFetch(() => Promise.reject(new Error('offline')));
  assert.equal(await (await x.request(FRESH)).text(), 'FRESH V2');
  assert.equal(await (await x.request(MANUAL)).text(), 'MANUAL OLD');
  assert.equal(await (await x.request('3-2.html')).text(), appRaw);
  x.setFetch(respondByUrl({ [urlOf('3-2.html')]: 'CANONICAL V2' })); assert.equal(await (await x.request('3-2.html')).text(), 'CANONICAL V2');
  x.setFetch(async () => errorBody(503));
  assert.equal(await (await x.request('3-2.html')).text(), 'CANONICAL V2');
  assert.equal(await (await x.request(FRESH)).text(), 'FRESH V2');
});
test('SW-03 反例：沒有精確查詢網址時仍回同一頁的快取，不拿別頁頂替，也不憑空捏造', async () => {
  const x = await seedPageVariants();
  x.setFetch(respondByUrl({ [urlOf('index.html?x=1')]: 'INDEX VARIANT' })); await x.request('index.html?x=1'); await flush();
  x.setFetch(() => Promise.reject(new Error('offline')));
  const res = await x.request('3-2.html?unseen=1'), text = await res.text();
  assert(['MANUAL OLD', 'FRESH NETWORK', appRaw].includes(text), '回同一頁的快取');
  assert.equal(await (await x.request('index.html?x=1')).text(), 'INDEX VARIANT');
  const otherIndex = await (await x.request('index.html?y=2')).text();
  assert(otherIndex === 'INDEX VARIANT' || otherIndex.startsWith(DOC), 'index 的其他查詢只用 index 自己的快取');
  assert(!['MANUAL OLD', 'FRESH NETWORK'].includes(otherIndex), 'index 不拿 3-2 的變體頂替');
  assert(!(await x.request('no-such-page.html?x=1')));
  const fresh = loadSw(); fresh.setFetch(() => Promise.reject(new Error('offline')));
  assert(!(await fresh.request(FRESH)));
});
test('SW-03 非頁面檔案同理：帶查詢參數已快取的版本優先於先存的 canonical', async () => {
  const x = loadSw(); await x.lifecycle('install');
  x.setFetch(respondByUrl({ [urlOf('lib/lunar.js?v=2')]: 'LUNAR V2' }));
  const first = await x.asset('lib/lunar.js?v=2'); assert((await first.text()).length > 1000, '第一次沒有精確快取，先回 canonical');
  await flush(); assert.equal(await x.cachedText('lib/lunar.js?v=2'), 'LUNAR V2');
  x.setFetch(() => Promise.reject(new Error('offline')));
  assert.equal(await (await x.asset('lib/lunar.js?v=2')).text(), 'LUNAR V2');
  assert((await (await x.asset('lib/lunar.js')).text()).length > 1000);
  assert((await (await x.asset('lib/lunar.js?v=3')).text()).length > 1000, '沒有精確網址仍可用 canonical');
  assert(!(await x.asset('lib/not-cached.js?v=1')));
});

// STORAGE-01：雙分頁設定只合併這次真正變更的欄位
const FIELD_CASES = [
  { field: 'castMode', value: 'manual', others: { ziMode: '23', gender: '女' } },
  { field: 'ziMode', value: '23', others: { castMode: 'manual', gender: '女' } },
  { field: 'gender', value: '男', others: { castMode: 'manual', ziMode: '23' } }
];
test('STORAGE-01 A 男、B 載入男、A 改女、B 只改子時：性別仍是女，重新載入與自動用神一致', () => {
  const s = storage(), a = openTab(s); a.change('gender', '男');
  const b = openTab(s); assert.equal(b.selected.gender, '男');
  a.change('gender', '女'); assert.equal(a.saved().gender, '女');
  b.change('ziMode', '23');
  assert.equal(b.selected.gender, '男', 'B 畫面不被背景同步');
  const saved = a.saved();
  assert.equal(saved.gender, '女'); assert.equal(saved.ziMode, '23');
  const c = openTab(s); assert.equal(c.selected.gender, '女'); assert.equal(c.selected.ziMode, '23');
  const q = '我的感情何時開始';
  a.el('question').value = q; c.el('question').value = q; a.env.autoPickYong(); c.env.autoPickYong();
  assert.equal(a.el('yongShen').value, '官鬼'); assert.equal(c.el('yongShen').value, '官鬼');
});
for (const { field, value, others } of FIELD_CASES) {
  test('STORAGE-01 舊分頁只改 ' + field + '：另一分頁已改的其他欄位保留', () => {
    const s = storage(), b = openTab(s), a = openTab(s);
    for (const [k, v] of Object.entries(others)) a.change(k, v);
    b.change(field, value);
    assert.deepEqual(Object.fromEntries(Object.entries(b.saved()).filter(([k]) => ['castMode', 'ziMode', 'gender'].includes(k))), { ...others, [field]: value });
    const c = openTab(s);
    assert.deepEqual(c.selected, { ...others, [field]: value });
  });
}
test('STORAGE-01 URL ?mode 入口：只寫起卦方式，保留另一分頁剛存的子時與性別', () => {
  const s = storage(); s.data.set('wenwang_gua_settings', JSON.stringify({ castMode: 'auto', ziMode: '00', gender: '男' }));
  s.afterNextSettingsRead(() => s.data.set('wenwang_gua_settings', JSON.stringify({ castMode: 'auto', ziMode: '23', gender: '女' })));
  const b = openTab(s, { search: '?mode=manual' });
  assert.deepEqual(b.saved(), { castMode: 'manual', ziMode: '23', gender: '女' });
  assert.equal(b.selected.castMode, 'manual');
});
test('STORAGE-01 URL ?mode 反例：mode=auto 照存；無效 mode 或沒有 mode 不寫入；空儲存只寫該欄', () => {
  const s = storage(); s.data.set('wenwang_gua_settings', JSON.stringify({ castMode: 'manual', ziMode: '23', gender: '女' }));
  openTab(s, { search: '?mode=auto' });
  assert.deepEqual(JSON.parse(s.data.get('wenwang_gua_settings')), { castMode: 'auto', ziMode: '23', gender: '女' });
  const before = s.data.get('wenwang_gua_settings');
  openTab(s, { search: '?mode=other' }); openTab(s, { search: '' });
  assert.equal(s.data.get('wenwang_gua_settings'), before);
  const empty = storage(); openTab(empty, { search: '?mode=manual' });
  assert.deepEqual(JSON.parse(empty.data.get('wenwang_gua_settings')), { castMode: 'manual' });
  assert.equal(openTab(empty).selected.castMode, 'manual');
});
test('STORAGE-01 反例：單分頁逐一修改三項設定都保存，重新載入還原', () => {
  const s = storage(), a = openTab(s);
  a.change('castMode', 'manual'); a.change('ziMode', '23'); a.change('gender', '女');
  assert.deepEqual(a.saved(), { castMode: 'manual', ziMode: '23', gender: '女' });
  assert.deepEqual(openTab(s).selected, { castMode: 'manual', ziMode: '23', gender: '女' });
  a.change('gender', '男'); a.change('ziMode', '00');
  assert.deepEqual(openTab(s).selected, { castMode: 'manual', ziMode: '00', gender: '男' });
});
test('STORAGE-01 反例：改子時仍同步更新剛存紀錄的文字', () => {
  const s = storage(), a = openTab(s), record = a.cast('工作順利嗎');
  a.change('ziMode', '23');
  assert.equal(a.env.readHistory()[0].id, record.id); assert.equal(a.env.readHistory()[0].text, a.env.buildRecordText());
});
test('STORAGE-01 反例：既有設定的其他欄位保留；儲存內容損毀或不是物件時仍能保存本次欄位', () => {
  const s = storage(); s.data.set('wenwang_gua_settings', JSON.stringify({ castMode: 'manual', note: 'keep' }));
  openTab(s).change('gender', '女');
  assert.deepEqual(JSON.parse(s.data.get('wenwang_gua_settings')), { castMode: 'manual', note: 'keep', gender: '女' });
  for (const bad of ['{broken', '[1,2]', '"text"', 'null', '7']) {
    const t = storage(); t.data.set('wenwang_gua_settings', bad);
    const tab = openTab(t); tab.change('ziMode', '23');
    assert.deepEqual(JSON.parse(t.data.get('wenwang_gua_settings')), { ziMode: '23' }, bad);
    assert.equal(openTab(t).selected.ziMode, '23', bad);
  }
});

// STORAGE-02：同一分頁重新開紀錄視窗要讀最新紀錄
test('STORAGE-02 同一 B 分頁開紀錄 1 筆、關閉、A 存第 2 筆、B 再開：顯示 2 筆且新的在前', () => {
  const s = storage(), a = openTab(s); a.cast('第一卦工作順利嗎');
  const b = openTab(s); b.env.openDialog('dlgHistory'); assert.equal(b.rows().length, 1); b.env.closeDialog('dlgHistory');
  a.cast('第二卦工作順利嗎'); assert.equal(a.env.readHistory().length, 2);
  b.env.openDialog('dlgHistory');
  assert.equal(b.rows().length, 2);
  assert(rowText(b.rows()[0]).includes('第二卦工作順利嗎')); assert(rowText(b.rows()[1]).includes('第一卦工作順利嗎'));
  b.env.closeDialog('dlgHistory'); b.env.openDialog('dlgHistory'); assert.equal(b.rows().length, 2);
});
test('STORAGE-02 另一分頁刪除或清空紀錄後，B 再開視窗不殘留舊筆', () => {
  const s = storage(), a = openTab(s); a.cast('第一卦工作順利嗎'); a.cast('第二卦工作順利嗎');
  const b = openTab(s); b.env.openDialog('dlgHistory'); assert.equal(b.rows().length, 2); b.env.closeDialog('dlgHistory');
  const [newest, oldest] = a.env.readHistory(); a.env.writeHistory([oldest]);
  b.env.openDialog('dlgHistory'); assert.equal(b.rows().length, 1); assert(rowText(b.rows()[0]).includes('第一卦工作順利嗎'));
  b.env.closeDialog('dlgHistory'); a.env.writeHistory([]);
  b.env.openDialog('dlgHistory'); assert.equal(b.rows().length, 0); assert(b.el('historyList').textContent.includes('尚無紀錄'));
  assert(newest.id !== oldest.id);
});
test('STORAGE-02 反例：本分頁自己的紀錄與刪除鈕照常運作，#history 入口也讀最新紀錄', () => {
  const s = storage(), a = openTab(s); a.cast('第一卦工作順利嗎'); a.cast('第二卦工作順利嗎');
  a.env.openDialog('dlgHistory'); assert.equal(a.rows().length, 2);
  a.rows()[0].children[2].onclick();
  assert.equal(a.env.readHistory().length, 1); assert.equal(a.rows().length, 1);
  assert(rowText(a.rows()[0]).includes('第一卦工作順利嗎'));
  const fromHash = openTab(s, { hash: '#history' }); assert.equal(fromHash.rows().length, 1);
  a.env.openDialog('dlgSettings'); a.env.openDialog('dlgRules'); assert.equal(a.rows().length, 1);
});

/* ---------- 執行 ---------- */

(async () => {
  for (const { id, fn } of jobs) {
    try { await fn(); records.push({ id, pass: true }); } catch (e) { records.push({ id, pass: false, error: e.message.split('\n')[0] }); }
  }
  const failures = records.filter(r => !r.pass).length;
  console.log(JSON.stringify({ tested: records.length, failures, records, sourceHash, swHash }, null, 2));
  process.exitCode = failures ? 1 : 0;
})();
