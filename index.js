// FAIFAH Affection Bar v1.1 - SillyTavern extension
// สองค่า: ❤️ ความโรแมนติก (love) และ 🤝 ความสนิท (friend)
// บอทปิดท้ายทุกข้อความด้วย [LOVE:+N] [FRIEND:+N]  ส่วนนี้จะซ่อนแท็ก แสดงชิปใต้ข้อความ
// และรวมค่าเป็นแถบด้านบนแชท กดที่แถบเพื่อดูโหมดความสัมพันธ์ทั้งหมด
(() => {
  const MODULE = 'faifah_affection';
  const PROMPT_KEY = 'faifah_affection_prompt';
  // [LIKE:+N] แบบเก่ายังอ่านได้ (นับเป็น love)
  const LOVE_RE = /\[\s*(?:LOVE|LIKE)\s*:\s*([+-]?\d+)\s*\]/gi;
  const FRIEND_RE = /\[\s*FRIEND\s*:\s*([+-]?\d+)\s*\]/gi;

  const DEFAULTS = {
    enabled: true,
    name: 'ไฟฟ้า',
    loveStart: 50,
    friendStart: -275,
    loveMin: -10,
    loveMaxDelta: 20,
    friendMin: -20,
    friendMaxDelta: 20,
  };

  // ช่วงคะแนนตามแอป (min ของแต่ละขั้น, max ของขั้นสุดท้ายคือเพดานของค่านั้น)
  const LOVE_LO = 0, LOVE_HI = 3000;
  const FRIEND_LO = -1000, FRIEND_HI = 2000;
  const LOVE_TIERS = [
    { min: 0,    max: 100,  label: 'เฉยๆ',    color: '#bd9072' },
    { min: 101,  max: 300,  label: 'หวั่นไหว', color: '#db6e60' },
    { min: 301,  max: 700,  label: 'คนคุย',    color: '#ea5c48' },
    { min: 701,  max: 1500, label: 'แฟน',      color: '#d84230' },
    { min: 1501, max: 3000, label: 'แต่งงาน',  color: '#a32818' },
  ];
  const FRIEND_TIERS = [
    { min: -1000, max: -501, label: 'คู่อริ',     color: '#c8373c' },
    { min: -500,  max: -51,  label: 'เกลียด',     color: '#ee7f36' },
    { min: -50,   max: 50,   label: 'คนรู้จัก',   color: '#e8b440' },
    { min: 51,    max: 200,  label: 'เพื่อน',     color: '#6ccbd8' },
    { min: 201,   max: 500,  label: 'เพื่อนสนิท', color: '#4560e0' },
    { min: 501,   max: 2000, label: 'เพื่อนตาย',  color: '#78e070' },
  ];

  // ตาราง [ขั้น love][ขั้น friend] -> โหมดความสัมพันธ์ (ตรงกับเงื่อนไขในแอป)
  const SNOOP = 'เพื่อนสนิทคิดไม่ซื่อ';
  const MATRIX = [
    ['ศัตรู',         'ไม่ถูกกัน',     'คนรู้จัก', 'เพื่อน',    'เพื่อนสนิท', 'เพื่อนตาย'],
    ['คู่ปรับ',       'คู่ปรับ',       'แอบชอบ',  'แอบชอบ',   SNOOP,        SNOOP],
    ['คู่กัด',        'คู่กัด',        'ลองคุย',  'คนคุย',     'คนคุย',      'คนคุย'],
    ['แฟน Toxic',     'แฟน Toxic',     'แฟน',     'คนรัก',     'คนรัก',      'คนรัก'],
    ['คู่ครอง Toxic', 'คู่ครอง Toxic', 'คู่ครอง', 'คู่ชีวิต',  'คู่ชีวิต',   'คู่แท้'],
  ];
  const ALL_MODES = [
    'ศัตรู', 'ไม่ถูกกัน', 'คู่ปรับ', 'คู่กัด',
    'คนรู้จัก', 'เพื่อน', 'เพื่อนสนิท', 'เพื่อนตาย',
    'แอบชอบ', SNOOP, 'ลองคุย', 'คนคุย',
    'แฟน', 'แฟน Toxic', 'คนรัก', 'คู่ชีวิต',
    'คู่ครอง', 'คู่ครอง Toxic', 'คู่แท้',
  ];
  const ICONS = {
    'ศัตรู': '💀', 'ไม่ถูกกัน': '🌀', 'คู่ปรับ': '🥊', 'คู่กัด': '⚔️',
    'คนรู้จัก': '💬', 'เพื่อน': '🙂', 'เพื่อนสนิท': '🤝', 'เพื่อนตาย': '♾️',
    'แอบชอบ': '💗', [SNOOP]: '😏', 'ลองคุย': '💭', 'คนคุย': '💞',
    'แฟน': '❤️', 'แฟน Toxic': '😈', 'คนรัก': '💘', 'คู่ชีวิต': '💍',
    'คู่ครอง': '💑', 'คู่ครอง Toxic': '🖤', 'คู่แท้': '✨',
  };

  // คำอธิบายเงื่อนไขของแต่ละโหมด (แตะที่ช่องในแผงเพื่อดู)
  function modeRequirement(mode) {
    const lo = new Set(), fr = new Set();
    MATRIX.forEach((row, li) => row.forEach((m, fi) => {
      if (m === mode) { lo.add(li); fr.add(fi); }
    }));
    const span = (tiers, set) => {
      const a = [...set].sort((x, y) => x - y);
      return `${a.map((i) => tiers[i].label).join(', ')} (${tiers[a[0]].min}→${tiers[a[a.length - 1]].max} คะแนน)`;
    };
    return { love: span(LOVE_TIERS, lo), friend: span(FRIEND_TIERS, fr) };
  }

  const ctx = () => SillyTavern.getContext();

  function settings() {
    const c = ctx();
    if (!c.extensionSettings[MODULE]) c.extensionSettings[MODULE] = {};
    const s = c.extensionSettings[MODULE];
    for (const k of Object.keys(DEFAULTS)) if (s[k] === undefined) s[k] = DEFAULTS[k];
    return s;
  }
  const save = () => ctx().saveSettingsDebounced();
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const fmt = (n) => (n > 0 ? '+' : '') + n;

  function tierIndex(value, tiers) {
    let idx = 0;
    tiers.forEach((tr, i) => { if (value >= tr.min) idx = i; });
    return idx;
  }

  function modeFor(love, friend) {
    return MATRIX[tierIndex(love, LOVE_TIERS)][tierIndex(friend, FRIEND_TIERS)];
  }

  function lastTag(text, re) {
    if (!text) return null;
    let m, last = null;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) last = parseInt(m[1], 10);
    return last;
  }

  // เดินทั้งแชท คำนวณค่ารวมและค่าที่ถูกใช้ของแต่ละข้อความ
  function compute() {
    const s = settings();
    const chat = ctx().chat || [];
    let love = clamp(Number(s.loveStart) || 0, LOVE_LO, LOVE_HI);
    let friend = clamp(Number(s.friendStart) || 0, FRIEND_LO, FRIEND_HI);
    const applied = {};
    chat.forEach((msg, i) => {
      if (!msg || msg.is_user || msg.is_system) return;
      const dl = lastTag(msg.mes, LOVE_RE);
      const df = lastTag(msg.mes, FRIEND_RE);
      if (dl === null && df === null) return;
      const l = clamp(dl ?? 0, s.loveMin, s.loveMaxDelta);
      const f = clamp(df ?? 0, s.friendMin, s.friendMaxDelta);
      love = clamp(love + l, LOVE_LO, LOVE_HI);
      friend = clamp(friend + f, FRIEND_LO, FRIEND_HI);
      applied[i] = { love: l, friend: f };
    });
    return { love, friend, applied };
  }

  function ensureBar() {
    if ($('#fa-like-bar').length) return;
    const bar = $(`
      <div id="fa-like-wrap">
        <div id="fa-like-bar" title="กดเพื่อดูโหมดความสัมพันธ์">
          <div class="fa-lv"><span class="fa-lv-ic"></span><span class="fa-lv-name"></span></div>
          <div class="fa-track fa-love"><div class="fa-fill"></div><div class="fa-num"></div><div class="fa-knob">❤️</div></div>
          <div class="fa-track fa-friend"><div class="fa-fill"></div><div class="fa-num"></div><div class="fa-knob">🤝</div></div>
        </div>
        <div id="fa-like-panel" class="fa-hidden"></div>
      </div>`);
    $('#chat').before(bar);
    $('#fa-like-bar').on('click', () => $('#fa-like-panel').toggleClass('fa-hidden'));
  }

  function segBar(tiers, value, caption) {
    const cur = tierIndex(value, tiers);
    const segs = tiers.map((tr, i) =>
      `<div class="fa-seg${i === cur ? ' fa-cur' : ''}" style="background:${tr.color}">${i === cur ? value : ''}</div>`
    ).join('');
    const t = tiers[cur];
    return `<div class="fa-segbar">${segs}</div><div class="fa-cap">${caption}: ${t.label} (${t.min}→${t.max})</div>`;
  }

  function renderPanel(love, friend, mode) {
    const grid = ALL_MODES.map((m) =>
      `<div class="fa-cell${m === mode ? ' fa-on' : ''}" data-mode="${m}"><div class="fa-cell-ic">${ICONS[m]}</div>${m}</div>`
    ).join('');
    $('#fa-like-panel').html(
      `<div class="fa-panel-title">โหมดความสัมพันธ์: ${ICONS[mode]} ${mode}</div>` +
      segBar(LOVE_TIERS, love, 'ความโรแมนติก') +
      segBar(FRIEND_TIERS, friend, 'ความสนิท') +
      `<div class="fa-grid">${grid}</div><div class="fa-tip" style="display:none"></div>`
    );
    $('#fa-like-panel .fa-cell').on('click', function (e) {
      e.stopPropagation();
      const r = modeRequirement(this.dataset.mode);
      $('#fa-like-panel .fa-tip').show().html(`<b>${this.dataset.mode}</b><br>ความโรแมนติก: ${r.love}<br>ความสนิท: ${r.friend}`);
    });
  }

  function renderBar(love, friend) {
    const s = settings();
    ensureBar();
    $('#fa-like-wrap').toggleClass('fa-hidden', !s.enabled);
    const mode = modeFor(love, friend);
    const bar = $('#fa-like-bar');
    bar.find('.fa-lv-ic').text(ICONS[mode]);
    bar.find('.fa-lv-name').text(mode);
    const set = (sel, v, lo, hi, tiers) => {
      const pct = clamp(((v - lo) / (hi - lo)) * 100, 0, 100);
      const t = bar.find(sel);
      t.find('.fa-fill').css({ width: pct + '%', background: tiers[tierIndex(v, tiers)].color });
      t.find('.fa-knob').css('left', `calc(${pct}% - 10px)`);
      t.find('.fa-num').text(v);
    };
    set('.fa-love', love, LOVE_LO, LOVE_HI, LOVE_TIERS);
    set('.fa-friend', friend, FRIEND_LO, FRIEND_HI, FRIEND_TIERS);
    renderPanel(love, friend, mode);
    return mode;
  }

  function updatePrompt(love, friend, mode) {
    const s = settings();
    const c = ctx();
    if (!s.enabled) {
      c.setExtensionPrompt(PROMPT_KEY, '', 1, 0, false, 0);
      return;
    }
    const text =
      `[ระบบค่าความสัมพันธ์ของ${s.name} กับ {{user}} มี 2 ค่าแยกกัน\n` +
      `- ความโรแมนติก (love): ${love} (ช่วง ${LOVE_LO}→${LOVE_HI}, ขั้น: ${LOVE_TIERS[tierIndex(love, LOVE_TIERS)].label})\n` +
      `- ความสนิท (friend): ${friend} (ช่วง ${FRIEND_LO}→${FRIEND_HI}, ขั้น: ${FRIEND_TIERS[tierIndex(friend, FRIEND_TIERS)].label}; ติดลบ = เกลียด/เป็นปฏิปักษ์)\n` +
      `สถานะตอนนี้: ${mode}\n` +
      `ท้ายคำตอบทุกครั้ง ให้เติมบรรทัดสุดท้ายเป็นรูปแบบนี้เท่านั้น: [LOVE:+N] [FRIEND:+N]\n` +
      `LOVE คือการเปลี่ยนของความรู้สึกโรแมนติก (ใจเต้น หวั่นไหว หึง เขิน) เป็นจำนวนเต็ม ${s.loveMin} ถึง +${s.loveMaxDelta}\n` +
      `FRIEND คือการเปลี่ยนของความสนิท ความไว้ใจ ความสบายใจที่อยู่ด้วยกัน (ทำให้ไม่พอใจ/ผิดหวังก็ลดได้ ติดลบได้) เป็นจำนวนเต็ม ${s.friendMin} ถึง +${s.friendMaxDelta}\n` +
      `สองค่านี้เป็นอิสระต่อกัน เช่น ทะเลาะกันอาจ LOVE ขึ้นแต่ FRIEND ลด ถ้าไม่เปลี่ยนใส่ +0\n` +
      `ปรับทีละน้อยให้เข้ากับนิสัยของ${s.name} ซึ่งปากแข็งและไม่ยอมรับความรู้สึกตรงๆ ` +
      `ห้ามพูดถึงระบบนี้หรือแท็กนี้ในเนื้อเรื่อง และห้ามใส่ตัวเลขนี้ที่อื่น]`;
    c.setExtensionPrompt(PROMPT_KEY, text, 1, 0, false, 0);
  }

  function stripTags(html) {
    return html.replace(LOVE_RE, '').replace(FRIEND_RE, '').replace(/(<br\s*\/?>|\s)+$/i, '');
  }

  function decorate(applied) {
    const chat = ctx().chat || [];
    document.querySelectorAll('#chat .mes').forEach((el) => {
      const id = Number(el.getAttribute('mesid'));
      const msg = chat[id];
      if (!msg || msg.is_user) return;
      const mt = el.querySelector('.mes_text');
      if (!mt) return;

      LOVE_RE.lastIndex = 0; FRIEND_RE.lastIndex = 0;
      const hasTag = LOVE_RE.test(mt.innerHTML);
      FRIEND_RE.lastIndex = 0;
      if (hasTag || FRIEND_RE.test(mt.innerHTML)) {
        LOVE_RE.lastIndex = 0; FRIEND_RE.lastIndex = 0;
        mt.innerHTML = stripTags(mt.innerHTML);
      }

      const d = applied[id];
      const old = el.querySelector('.fa-chips');
      if (d === undefined) {
        if (old) old.remove();
        return;
      }
      const key = `${d.love}|${d.friend}`;
      if (old && old.dataset.v === key) return;
      if (old) old.remove();
      const wrap = document.createElement('div');
      wrap.className = 'fa-chips';
      wrap.dataset.v = key;
      const mk = (icon, v) => {
        const chip = document.createElement('span');
        chip.className = 'fa-chip' + (v < 0 ? ' fa-neg' : v === 0 ? ' fa-zero' : '');
        chip.textContent = `${icon} ${fmt(v)}`;
        return chip;
      };
      wrap.append(mk('❤️', d.love), mk('🤝', d.friend));
      mt.insertAdjacentElement('afterend', wrap);
    });
  }

  let busy = false;
  function refresh() {
    if (busy) return;
    busy = true;
    try {
      const { love, friend, applied } = compute();
      const mode = renderBar(love, friend);
      updatePrompt(love, friend, mode);
      if (settings().enabled) decorate(applied);
    } catch (e) {
      console.error('[faifah_affection]', e);
    } finally {
      busy = false;
    }
  }

  let timer = null;
  const refreshSoon = () => { clearTimeout(timer); timer = setTimeout(refresh, 150); };

  function buildSettingsUI() {
    const s = settings();
    const html = `
      <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
          <b>FAIFAH Affection Bar</b>
          <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
          <label class="checkbox_label"><input type="checkbox" id="fa_enabled"><span>เปิดใช้งาน</span></label>
          <label>ชื่อตัวละคร <input type="text" id="fa_name" class="text_pole"></label>
          <hr>
          <b>❤️ ความโรแมนติก</b>
          <label>ค่าเริ่มต้น <input type="number" id="fa_lstart" class="text_pole"></label>
          <label>ลดได้สุด ต่อข้อความ <input type="number" id="fa_lmin" class="text_pole"></label>
          <label>เพิ่มได้สุด ต่อข้อความ <input type="number" id="fa_lmaxd" class="text_pole"></label>
          <hr>
          <b>🤝 ความสนิท</b>
          <label>ค่าเริ่มต้น <input type="number" id="fa_fstart" class="text_pole"></label>
          <label>ลดได้สุด ต่อข้อความ <input type="number" id="fa_fmin" class="text_pole"></label>
          <label>เพิ่มได้สุด ต่อข้อความ <input type="number" id="fa_fmaxd" class="text_pole"></label>
        </div>
      </div>`;
    $('#extensions_settings2').append(html);
    const bindNum = (id, key, fallback, minVal) => {
      $(id).val(s[key]).on('input', function () {
        const n = Number(this.value);
        s[key] = Number.isFinite(n) && this.value !== '' ? (minVal !== undefined ? Math.max(minVal, n) : n) : fallback;
        save(); refresh();
      });
    };
    $('#fa_enabled').prop('checked', s.enabled).on('change', function () { s.enabled = this.checked; save(); refresh(); });
    $('#fa_name').val(s.name).on('input', function () { s.name = this.value || DEFAULTS.name; save(); refresh(); });
    bindNum('#fa_lstart', 'loveStart', DEFAULTS.loveStart);
    bindNum('#fa_lmin', 'loveMin', DEFAULTS.loveMin);
    bindNum('#fa_lmaxd', 'loveMaxDelta', DEFAULTS.loveMaxDelta);
    bindNum('#fa_fstart', 'friendStart', DEFAULTS.friendStart);
    bindNum('#fa_fmin', 'friendMin', DEFAULTS.friendMin);
    bindNum('#fa_fmaxd', 'friendMaxDelta', DEFAULTS.friendMaxDelta);
  }

  jQuery(() => {
    const c = ctx();
    settings();
    buildSettingsUI();
    ensureBar();
    const ev = c.eventSource, T = c.event_types;
    [T.CHAT_CHANGED, T.MESSAGE_RECEIVED, T.MESSAGE_SENT, T.MESSAGE_EDITED, T.MESSAGE_UPDATED,
     T.MESSAGE_SWIPED, T.MESSAGE_DELETED, T.CHARACTER_MESSAGE_RENDERED, T.GENERATION_ENDED]
      .filter(Boolean)
      .forEach((e) => ev.on(e, refreshSoon));
    const chatEl = document.getElementById('chat');
    if (chatEl) new MutationObserver(refreshSoon).observe(chatEl, { childList: true, subtree: true, characterData: true });
    refresh();
  });
})();
