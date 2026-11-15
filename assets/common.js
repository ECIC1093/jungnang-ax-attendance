/* 공통 기능: 저장소(Supabase) 호출, 주소·관리 열쇠, 글자·시간, QR, 알림·확인 창.
   참고 사이트(jungnangai/edu-attendance)의 assets/common.js에서 가져와 줄였다.
   이 포럼은 행사가 하나뿐이라 행사 ID(?e=)·행사 목록·테마·이미지·위촉장 기능은 뺐다. */
(function () {
  'use strict';
  const CFG = window.APP_CONFIG || {};

  /* ---------- 저장소 호출 ---------- */
  class RpcError extends Error {}
  async function rpc(fn, args) {
    if (!CFG.supabaseUrl || !CFG.supabaseKey) throw new RpcError('저장소(Supabase) 설정이 아직 없습니다. config.js를 확인해 주세요.');
    const key = CFG.supabaseKey;
    const headers = { 'Content-Type': 'application/json', apikey: key };
    if (/^eyJ/.test(key)) headers.Authorization = 'Bearer ' + key;  // 예전 anon 키(JWT)는 둘 다 보냄
    let res;
    try {
      res = await fetch(CFG.supabaseUrl.replace(/\/$/, '') + '/rest/v1/rpc/' + fn, { method: 'POST', headers, body: JSON.stringify(args || {}) });
    } catch (e) { throw new RpcError('인터넷 연결을 확인해 주세요.'); }
    const text = await res.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    if (!res.ok) throw new RpcError((data && data.message) || ('저장소 오류 (' + res.status + ')'));
    return data;
  }

  /* ---------- 주소 ---------- */
  const query = name => new URLSearchParams(location.search).get(name);
  const hashParam = name => new URLSearchParams(location.hash.replace(/^#/, '')).get(name);
  function siteBase() { return location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, ''); }
  const links = token => ({
    screen: siteBase() + 'index.html',
    join: siteBase() + 'join.html',
    admin: siteBase() + 'admin.html' + (token ? '#k=' + token : ''),
    screenAdmin: siteBase() + 'index.html' + (token ? '#k=' + token : ''),   // 구청장 확인 버튼이 보이는 화면(관리 열쇠)
    screenView: key => siteBase() + 'index.html#s=' + key                    // 보기 전용 화면(화면 열쇠, 관리 기능 없음)
  });
  // 주소 #k=(관리 열쇠)·#s=(화면 열쇠)로 받으면 이 탭에 기억하고 주소창에서는 지운다(프로젝터에 띄워도 안 보이게)
  function takeKey(name, store) {
    const k = hashParam(name);
    if (k) {
      try { sessionStorage.setItem(store, k); } catch (e) {}
      history.replaceState(null, '', location.pathname + location.search);
      return k;
    }
    try { return sessionStorage.getItem(store) || null; } catch (e) { return null; }
  }
  const takeToken = () => takeKey('k', 'admin-k');
  const takeScreenKey = () => takeKey('s', 'screen-k');

  /* ---------- 같은 휴대폰 중복 등록 방지(서버에서도 한 번 더 막음) ---------- */
  function myRegistration() { try { return JSON.parse(localStorage.getItem('ax-registered') || 'null'); } catch (e) { return null; } }
  function rememberRegistration(r) { try { localStorage.setItem('ax-registered', JSON.stringify({ ...r, at: Date.now() })); } catch (e) {} }
  function forgetRegistration() { try { localStorage.removeItem('ax-registered'); } catch (e) {} }

  /* ---------- 글자·시간 ---------- */
  // 받침에 맞는 조사: josa('구청장', '이', '가') → '구청장이'
  const josa = (w, a, b) => { const c = String(w || '').trim().slice(-1).charCodeAt(0); const has = c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 > 0 : false; return String(w || '') + (has ? a : b); };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tz = { timeZone: 'Asia/Seoul' };
  const hhmm = iso => new Date(iso).toLocaleTimeString('ko-KR', { ...tz, hour: '2-digit', minute: '2-digit', hour12: false });
  const ymd = iso => new Date(iso).toLocaleDateString('ko-KR', { ...tz, year: 'numeric', month: 'numeric', day: 'numeric' });

  /* ---------- QR (assets/qrcode.js 필요) ---------- */
  function qrCanvas(text, px = 640, margin = 2) {
    const q = window.qrcode(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(), cell = Math.floor(px / (n + margin * 2)), size = cell * (n + margin * 2);
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, size, size); x.fillStyle = '#111';
    for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) if (q.isDark(r, col)) x.fillRect((col + margin) * cell, (r + margin) * cell, cell, cell);
    return c;
  }
  function qrSvg(text) {
    const q = window.qrcode(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(); let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return `<svg viewBox="-1 -1 ${n + 2} ${n + 2}" shape-rendering="crispEdges" role="img" aria-label="참석 등록 QR 코드"><rect x="-1" y="-1" width="${n + 2}" height="${n + 2}" fill="#fff"/><path d="${d}" fill="#111"/></svg>`;
  }
  function download(url, name) { const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }

  /* ---------- 알림·확인 창 (브라우저 기본 alert 대신). 모양은 각 페이지 CSS의 #app-toast, .app-modal ---------- */
  function toast(msg, kind = '') {
    let t = document.getElementById('app-toast');
    if (!t) { t = document.createElement('div'); t.id = 'app-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.className = 'show ' + kind;
    clearTimeout(toast._t); toast._t = setTimeout(() => t.className = '', 2800);
  }
  function dialog({ title, message = '', ok = '확인', cancel = '취소', input = null, danger = false }) {
    return new Promise(resolve => {
      const wrap = document.createElement('div'); wrap.className = 'app-modal';
      wrap.innerHTML = `<div class="app-modal-box" role="dialog" aria-modal="true" aria-labelledby="amt">
        <h2 id="amt">${esc(title)}</h2>${message ? `<p>${esc(message).replace(/\n/g, '<br>')}</p>` : ''}
        ${input !== null ? `<input type="text" class="app-modal-input" value="${esc(input)}" maxlength="40">` : ''}
        <div class="app-modal-btns">${cancel ? `<button type="button" class="btn ghost" data-v="0">${esc(cancel)}</button>` : ''}
        <button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-v="1">${esc(ok)}</button></div></div>`;
      document.body.appendChild(wrap);
      const inp = wrap.querySelector('input');
      const done = v => { wrap.classList.add('out'); setTimeout(() => wrap.remove(), 180); resolve(v ? (inp ? inp.value.trim() : true) : (inp ? null : false)); };
      wrap.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) done(b.dataset.v === '1'); else if (e.target === wrap && cancel) done(false); });
      wrap.addEventListener('keydown', e => { if (e.key === 'Escape' && cancel) done(false); if (e.key === 'Enter' && inp) done(true); });
      requestAnimationFrame(() => { wrap.classList.add('in'); (inp || wrap.querySelector('[data-v="1"]')).focus(); if (inp) inp.select(); });
    });
  }

  window.App = {
    CFG, ready: !!(CFG.supabaseUrl && CFG.supabaseKey),
    rpc, RpcError, query, hashParam, links, siteBase, takeToken, takeScreenKey,
    myRegistration, rememberRegistration, forgetRegistration,
    esc, josa, hhmm, ymd, qrCanvas, qrSvg, download, toast, dialog
  };
})();
