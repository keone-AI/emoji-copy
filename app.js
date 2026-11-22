/* 콕콕티콘 — 탭 한 번 복사 */
(function () {
  'use strict';

  var EMOJI = window.EMOJI_DATA || [];
  var KAO = window.KAOMOJI_DATA || [];
  var SYM = window.SYMBOL_DATA || [];

  var RECENT_KEY = 'kokkok.recent.v1';
  var TAB_KEY = 'kokkok.tab.v1';
  var RECENT_MAX = 48;
  var SEARCH_EMOJI_MAX = 400;

  var $ = function (id) { return document.getElementById(id); };
  var main = $('main');
  var sticky = $('sticky');
  var top = $('top');
  var catsBar = $('cats');
  var q = $('q');
  var qClear = $('qClear');
  var toastEl = $('toast');
  var composer = $('composer');
  var composeInput = $('composeInput');
  var composeToggle = $('composeToggle');
  var panels = {
    recent: $('panel-recent'),
    emoji: $('panel-emoji'),
    kaomoji: $('panel-kaomoji'),
    symbol: $('panel-symbol'),
    search: $('panel-search')
  };

  /* ---------- 저장소 (사생활 보호 모드 등에서 실패해도 앱은 계속 동작) ---------- */
  var store = {
    get: function (k, d) {
      try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set: function (k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장 불가 — 무시 */ }
    }
  };

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- 분류 정의 ---------- */
  var emojiSet = new Set();
  var symbolSet = new Set();
  EMOJI.forEach(function (g) { g.items.forEach(function (it) { emojiSet.add(it[0]); }); });
  SYM.forEach(function (c) { c.items.forEach(function (t) { symbolSet.add(t); }); });

  var TABS = {
    emoji: EMOJI.map(function (g) {
      return { id: 'e-' + g.id, name: g.name, icon: g.icon, kind: 'emoji', items: g.items.map(function (it) { return it[0]; }) };
    }),
    kaomoji: KAO.map(function (c) {
      return { id: 'k-' + c.id, name: c.name, kind: 'chip', items: c.items };
    }),
    symbol: SYM.map(function (c) {
      return { id: 's-' + c.id, name: c.name, kind: 'sym', items: c.items };
    })
  };

  /* ---------- 렌더링 ---------- */
  function itemsHTML(kind, items) {
    var out = '';
    var cls = kind === 'chip' ? 'it chip' : (kind === 'sym' ? 'it cell sym' : 'it cell');
    for (var i = 0; i < items.length; i++) {
      out += '<button type="button" class="' + cls + '">' + esc(items[i]) + '</button>';
    }
    return out;
  }

  function sectionHTML(id, title, kind, items, action) {
    return '<section class="sec" id="sec-' + id + '" data-cat="' + id + '">' +
      '<div class="sec-head"><h2 class="sec-title">' + esc(title) +
      '<span class="sec-count">' + items.length + '</span></h2>' + (action || '') + '</div>' +
      '<div class="' + (kind === 'chip' ? 'chips' : 'grid') + '">' + itemsHTML(kind, items) + '</div></section>';
  }

  // 탭별 렌더 상태. 이모지는 카테고리 하나씩 나눠 그려서 첫 화면이 바로 뜨게 한다.
  var rendered = { emoji: 0, kaomoji: 0, symbol: 0 };
  var renderTimer = null;

  function renderSectionAt(tab, i) {
    var c = TABS[tab][i];
    panels[tab].insertAdjacentHTML('beforeend', sectionHTML(c.id, c.name, c.kind, c.items));
  }

  function ensureRendered(tab, upto) {
    var cats = TABS[tab];
    var target = Math.min(upto, cats.length - 1);
    while (rendered[tab] <= target) {
      renderSectionAt(tab, rendered[tab]);
      rendered[tab]++;
    }
  }

  function renderRestProgressively(tab) {
    clearTimeout(renderTimer);
    (function step() {
      if (rendered[tab] >= TABS[tab].length) return;
      ensureRendered(tab, rendered[tab]);
      renderTimer = setTimeout(step, 16);
    })();
  }

  function renderTab(tab) {
    if (tab === 'recent') { renderRecent(); return; }
    if (tab === 'emoji') {
      ensureRendered('emoji', 0); // 첫 분류는 즉시
      renderRestProgressively('emoji');
    } else {
      ensureRendered(tab, TABS[tab].length - 1); // 카오모지·특수문자는 양이 적어 한 번에
    }
  }

  /* ---------- 최근 사용 ---------- */
  var recent = store.get(RECENT_KEY, []);
  if (!Array.isArray(recent)) recent = [];
  var recentDirty = true;

  function pushRecent(text) {
    var i = recent.indexOf(text);
    if (i !== -1) recent.splice(i, 1);
    recent.unshift(text);
    if (recent.length > RECENT_MAX) recent.length = RECENT_MAX;
    store.set(RECENT_KEY, recent);
    recentDirty = true;
    // 최근 탭을 보는 중이면 손가락 밑에서 칸이 움직이지 않도록 다음에 들어올 때 다시 그린다.
  }

  function renderRecent() {
    if (!recentDirty) return;
    recentDirty = false;
    var p = panels.recent;
    if (!recent.length) {
      p.innerHTML = emptyHTML('(˶ᵔ ᵕ ᵔ˶)', '아직 복사한 게 없어요', '이모지나 이모티콘을 콕 누르면 여기에 모여요');
      return;
    }
    var short = [], kao = [];
    recent.forEach(function (t) { (emojiSet.has(t) || symbolSet.has(t) ? short : kao).push(t); });
    var clearBtn = '<button type="button" class="sec-action" data-action="clear-recent">기록 지우기</button>';
    var html = '';
    if (short.length) html += sectionGridMixed('r-short', '최근 이모지·특수문자', short, clearBtn);
    if (kao.length) html += sectionHTML('r-kao', '최근 이모티콘', 'chip', kao, short.length ? '' : clearBtn);
    p.innerHTML = html;
  }

  // 이모지와 특수문자가 섞인 그리드(글꼴만 다르게)
  function sectionGridMixed(id, title, items, action) {
    var cells = '';
    items.forEach(function (t) {
      cells += '<button type="button" class="it cell' + (symbolSet.has(t) ? ' sym' : '') + '">' + esc(t) + '</button>';
    });
    return '<section class="sec" id="sec-' + id + '"><div class="sec-head"><h2 class="sec-title">' + esc(title) +
      '<span class="sec-count">' + items.length + '</span></h2>' + action + '</div><div class="grid">' + cells + '</div></section>';
  }

  function emptyHTML(face, title, desc) {
    return '<div class="empty"><p class="empty-face">' + esc(face) + '</p><p class="empty-title">' + esc(title) +
      '</p><p class="empty-desc">' + esc(desc) + '</p></div>';
  }

  /* ---------- 분류 칩 바 + 스크롤 위치 표시 ---------- */
  var currentTab = null;
  var activeCat = null;
  var spyLockUntil = 0;

  function renderCats(tab) {
    var cats = TABS[tab];
    if (!cats || searching) { catsBar.hidden = true; catsBar.innerHTML = ''; return; }
    catsBar.hidden = false;
    catsBar.innerHTML = cats.map(function (c) {
      return '<button type="button" class="cat" data-cat="' + c.id + '"><span>' +
        (c.icon ? '<span class="cat-ico" aria-hidden="true">' + esc(c.icon) + '</span>' : '') + esc(c.name) + '</span></button>';
    }).join('');
    catsBar.scrollLeft = 0;
    activeCat = null;
    updateStickyH();
  }

  function setActiveCat(id) {
    if (id === activeCat) return;
    activeCat = id;
    var btns = catsBar.querySelectorAll('.cat');
    for (var i = 0; i < btns.length; i++) {
      var on = btns[i].getAttribute('data-cat') === id;
      if (on) {
        btns[i].setAttribute('aria-current', 'true');
        // 가로 칩 바만 움직인다(scrollIntoView 는 세로 페이지까지 움직여서 쓰지 않음)
        var b = btns[i];
        var left = b.offsetLeft - (catsBar.clientWidth - b.offsetWidth) / 2;
        if (catsBar.scrollTo) catsBar.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
        else catsBar.scrollLeft = Math.max(0, left);
      } else {
        btns[i].removeAttribute('aria-current');
      }
    }
  }

  var stickyH = 112;
  function updateStickyH() {
    stickyH = sticky.offsetHeight;
    document.documentElement.style.setProperty('--sticky-h', stickyH + 'px');
  }

  function spy() {
    sticky.classList.toggle('stuck', window.scrollY > top.offsetHeight - 1);
    if (searching || !TABS[currentTab]) return;
    if (Date.now() < spyLockUntil) return;
    var secs = panels[currentTab].children;
    if (!secs.length) return;
    var line = stickyH + 14;
    var id = secs[0].getAttribute('data-cat');
    var atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    var allRendered = rendered[currentTab] >= TABS[currentTab].length;
    if (atBottom && allRendered && window.scrollY > 0) {
      // 마지막 분류가 화면보다 짧으면 기준선에 못 닿으니 맨 끝에선 마지막 분류를 켠다
      id = secs[secs.length - 1].getAttribute('data-cat');
    } else {
      for (var i = 0; i < secs.length; i++) {
        if (secs[i].getBoundingClientRect().top - line <= 0) id = secs[i].getAttribute('data-cat');
        else break;
      }
    }
    setActiveCat(id);
  }

  var spyQueued = false;
  window.addEventListener('scroll', function () {
    if (spyQueued) return;
    spyQueued = true;
    requestAnimationFrame(function () { spyQueued = false; spy(); });
  }, { passive: true });

  catsBar.addEventListener('click', function (e) {
    var b = e.target.closest('.cat');
    if (!b) return;
    jumpTo(b.getAttribute('data-cat'));
  });

  function jumpTo(catId) {
    var cats = TABS[currentTab];
    var idx = -1;
    for (var i = 0; i < cats.length; i++) if (cats[i].id === catId) idx = i;
    if (idx < 0) return;
    ensureRendered(currentTab, idx);
    var sec = $('sec-' + catId);
    if (!sec) return;
    var y = sec.getBoundingClientRect().top + window.scrollY - stickyH - 8;
    spyLockUntil = Date.now() + 800;
    setActiveCat(catId);
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  }

  /* ---------- 탭 전환 ---------- */
  var scrollByTab = {};
  var tabBtns = document.querySelectorAll('.tab');

  function showTab(tab, opts) {
    if (currentTab && !searching) scrollByTab[currentTab] = window.scrollY;
    currentTab = tab;
    store.set(TAB_KEY, tab);
    for (var i = 0; i < tabBtns.length; i++) {
      if (tabBtns[i].getAttribute('data-tab') === tab) tabBtns[i].setAttribute('aria-current', 'page');
      else tabBtns[i].removeAttribute('aria-current');
    }
    if (searching) {
      // 검색 중에 아래 탭을 누르면 검색을 닫고 그 탭으로 간다
      clearTimeout(searchTimer);
      q.value = '';
      qClear.hidden = true;
      clearSearch(true);
    }
    Object.keys(panels).forEach(function (k) { panels[k].hidden = k !== tab; });
    renderTab(tab);
    renderCats(tab);
    var y = (opts && opts.toTop) ? 0 : (scrollByTab[tab] || 0);
    window.scrollTo(0, y);
    spy();
  }

  $('tabbar').addEventListener('click', function (e) {
    var b = e.target.closest('.tab');
    if (!b) return;
    var tab = b.getAttribute('data-tab');
    if (tab === currentTab && !searching) {
      // 같은 탭을 한 번 더 누르면 맨 위로
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    showTab(tab);
  });

  /* ---------- 검색 ---------- */
  var searching = false;
  var searchTimer = null;
  var hay = null;

  function buildHay() {
    hay = { emoji: [], kao: [], sym: [] };
    EMOJI.forEach(function (g) {
      g.items.forEach(function (it) {
        hay.emoji.push([it[0], (it[1] + ' ' + it[2] + ' ' + g.name).toLowerCase()]);
      });
    });
    KAO.forEach(function (c) {
      var base = (c.name + ' ' + c.kw).toLowerCase();
      c.items.forEach(function (t) { hay.kao.push([t, base + ' ' + t.toLowerCase()]); });
    });
    SYM.forEach(function (c) {
      var base = (c.name + ' ' + c.kw).toLowerCase();
      c.items.forEach(function (t) { hay.sym.push([t, base + ' ' + t.toLowerCase()]); });
    });
  }

  function match(list, tokens, max) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var h = list[i][1], ok = true;
      for (var j = 0; j < tokens.length; j++) { if (h.indexOf(tokens[j]) === -1) { ok = false; break; } }
      if (ok) { out.push(list[i][0]); if (max && out.length >= max) break; }
    }
    return out;
  }

  function runSearch() {
    var raw = q.value.trim();
    qClear.hidden = !q.value;
    if (!raw) { if (searching) clearSearch(false); return; }
    if (!hay) buildHay();
    var tokens = raw.toLowerCase().split(/\s+/);
    var e = match(hay.emoji, tokens, SEARCH_EMOJI_MAX);
    var k = match(hay.kao, tokens);
    var s = match(hay.sym, tokens);

    if (!searching) {
      searching = true;
      if (currentTab) scrollByTab[currentTab] = window.scrollY;
      Object.keys(panels).forEach(function (key) { panels[key].hidden = key !== 'search'; });
      catsBar.hidden = true;
      updateStickyH();
    }
    var p = panels.search;
    var total = e.length + k.length + s.length;
    if (!total) {
      p.innerHTML = emptyHTML('(｡•́︿•̀｡)', '‘' + raw + '’ 결과가 없어요', '다른 말로 찾아볼까요? 예: 하트, 별, 고양이, 웃음');
    } else {
      var html = '<p class="search-note">‘' + esc(raw) + '’ 검색 결과 <b>' + total + '개</b>' +
        (e.length >= SEARCH_EMOJI_MAX ? ' · 이모지는 앞쪽 ' + SEARCH_EMOJI_MAX + '개만 보여요' : '') + '</p>';
      if (e.length) html += sectionHTML('q-emoji', '이모지', 'emoji', e);
      if (k.length) html += sectionHTML('q-kao', '이모티콘', 'chip', k);
      if (s.length) html += sectionHTML('q-sym', '특수문자', 'sym', s);
      p.innerHTML = html;
    }
    window.scrollTo(0, 0);
  }

  function clearSearch(keepTabHidden) {
    searching = false;
    panels.search.hidden = true;
    panels.search.innerHTML = '';
    if (!keepTabHidden) {
      panels[currentTab].hidden = false;
      renderTab(currentTab);
      renderCats(currentTab);
      window.scrollTo(0, scrollByTab[currentTab] || 0);
      spy();
    }
  }

  q.addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, 140);
  });
  q.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { q.blur(); }
    if (e.key === 'Escape') { q.value = ''; runSearch(); }
  });
  qClear.addEventListener('click', function () {
    q.value = '';
    runSearch();
    q.focus();
  });

  /* ---------- 복사 ---------- */
  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0;';
    document.body.appendChild(ta);
    var ok = false;
    try {
      // iOS 는 readonly 상태로는 선택이 안 돼서 선택하는 순간만 풀고(키보드는 안 뜸) 범위를 직접 지정한다.
      ta.removeAttribute('readonly');
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      ta.setAttribute('readonly', '');
      ok = document.execCommand('copy');
    } catch (e) { ok = false; }
    var sel = window.getSelection && window.getSelection();
    if (sel) sel.removeAllRanges();
    document.body.removeChild(ta);
    return ok;
  }

  // 탭 핸들러 안에서 동기로 먼저 execCommand 를 시도한다.
  // (iOS·카카오톡 인앱은 Promise 거절 뒤로 미루면 사용자 제스처로 인정되지 않아 실패함)
  // 그게 안 되면 Clipboard API, 둘 다 실패하면 false → 수동 복사 시트.
  function copyText(text) {
    if (legacyCopy(text)) return Promise.resolve(true);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return false; });
    }
    return Promise.resolve(false);
  }

  function showManualSheet(text) {
    var ta = $('sheetText');
    ta.value = text;
    $('sheet').hidden = false;
    setTimeout(function () { ta.focus(); ta.setSelectionRange(0, text.length); }, 50);
  }
  $('sheetClose').addEventListener('click', function () { $('sheet').hidden = true; });
  $('sheet').addEventListener('click', function (e) { if (e.target === this) this.hidden = true; });

  /* ---------- 토스트 ---------- */
  var toastTimer = null;
  function toast(msg, preview) {
    toastEl.innerHTML = '<span class="toast-heart" aria-hidden="true">♥︎</span><span>' + esc(msg) + '</span>' +
      (preview ? '<span class="toast-preview">' + esc(preview) + '</span>' : '');
    toastEl.classList.remove('show');
    void toastEl.offsetWidth; // 연속으로 눌러도 애니메이션 다시 시작
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 1400);
  }

  function pop(el) {
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }

  /* ---------- 항목 탭 ---------- */
  var composing = false;

  main.addEventListener('click', function (e) {
    var act = e.target.closest('[data-action]');
    if (act && act.getAttribute('data-action') === 'clear-recent') {
      recent = [];
      store.set(RECENT_KEY, recent);
      recentDirty = true;
      renderRecent();
      toast('기록을 지웠어요');
      return;
    }
    var b = e.target.closest('.it');
    if (!b) return;
    var text = b.textContent;
    pop(b);
    if (composing) {
      composeInput.value += text;
      composeInput.scrollLeft = composeInput.scrollWidth;
      pushRecent(text);
      toast('담았어요', text);
      return;
    }
    copyText(text).then(function (ok) {
      if (ok) { pushRecent(text); toast('복사됨 ✓', text); }
      else showManualSheet(text);
    });
  });

  // 긴 누름 메뉴(선택·확대 미리보기) 막기 — 칸에서만
  main.addEventListener('contextmenu', function (e) { if (e.target.closest('.it')) e.preventDefault(); });

  /* ---------- 모아쓰기 ---------- */
  composeToggle.addEventListener('click', function () {
    composing = !composing;
    composeToggle.setAttribute('aria-pressed', String(composing));
    composer.hidden = !composing;
    document.body.classList.toggle('composing', composing);
    toast(composing ? '콕콕 누르면 아래 칸에 담겨요' : '모아쓰기를 껐어요');
  });
  $('composeClear').addEventListener('click', function () {
    composeInput.value = '';
  });
  $('composeCopy').addEventListener('click', function () {
    var text = composeInput.value;
    if (!text) { toast('먼저 콕콕 눌러 담아 주세요'); return; }
    copyText(text).then(function (ok) {
      if (ok) toast('전체 복사됨 ✓', text);
      else showManualSheet(text);
    });
  });

  /* ---------- 시작 ---------- */
  // iOS Safari 에서 :active 스타일이 바로 보이게
  document.addEventListener('touchstart', function () {}, { passive: true });

  if (window.ResizeObserver) new ResizeObserver(updateStickyH).observe(sticky);
  window.addEventListener('resize', updateStickyH);

  var saved = store.get(TAB_KEY, null);
  var first = (saved && (saved === 'recent' || TABS[saved])) ? saved : (recent.length ? 'recent' : 'emoji');
  showTab(first, { toTop: true });
})();
