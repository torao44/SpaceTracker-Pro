/* ==========================================================
   SpaceTracker Pro - app.js
   ISS位置・クルー・打上げ・Starlink可視予報・オーロラ・流星群・PWA

   ※ 地球儀（球体表示）を廃止し、正距円筒図法のフラットな世界地図に変更。
      - 海＋大陸（Natural Earth / world-atlas）をSVGで描画
      - 前後約100分の地上軌道を連続曲線＋セグメント点で表示
      - 現在位置は「ピン付きマーカー」で表示
      - 日付変更線（±180°）をまたぐ部分も3枚重ね描きでシームレスに表示
   ========================================================== */

const els = {
  speed: document.getElementById('speed'),
  altitude: document.getElementById('altitude'),
  lat: document.getElementById('lat'),
  lon: document.getElementById('lon'),
  globeCaption: document.getElementById('globeCaption'),
  refreshBtn: document.getElementById('refreshBtn'),
  crewList: document.getElementById('crewList'),
  crewCount: document.getElementById('crewCount'),
  launchList: document.getElementById('launchList'),
  agencyFilter: document.getElementById('agencyFilter'),
  locateBtn: document.getElementById('locateBtn'),
  starlinkResult: document.getElementById('starlinkResult'),
  kpValue: document.getElementById('kpValue'),
  kpFill: document.getElementById('kpFill'),
  kpDesc: document.getElementById('kpDesc'),
  meteorList: document.getElementById('meteorList'),
  installBtn: document.getElementById('installBtn'),
  crewModalOverlay: document.getElementById('crewModalOverlay'),
  crewModalClose: document.getElementById('crewModalClose'),
  crewModalBody: document.getElementById('crewModalBody'),
  // --- 世界地図まわり（新規） ---
  mapLand: document.getElementById('mapLand'),
  mapGraticule: document.getElementById('mapGraticule'),
  trackLayer: document.getElementById('trackLayer'),
  issMarker: document.getElementById('issMarker'),
};

/* ---------------- ISS 現在位置・地上軌道（正距円筒図法） ----------------
   SVGの viewBox は 0 0 360 180。
   経度 -180..180 → x 0..360 ／ 緯度 90..-90 → y 0..180 に線形対応させる。 */
const MAP_W = 360;
const MAP_H = 180;

function mapPoint(lat, lon) {
  return { x: lon + 180, y: 90 - lat };
}

function updateMapMarker(lat, lon) {
  if (!els.issMarker) return;
  const { x, y } = mapPoint(lat, lon);
  els.issMarker.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
  els.issMarker.hidden = false;
}

async function loadISS() {
  try {
    const r = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
    const d = await r.json();
    els.speed.textContent = Math.round(d.velocity).toLocaleString('ja-JP');
    els.altitude.textContent = d.altitude.toFixed(1);
    els.lat.textContent = d.latitude.toFixed(2);
    els.lon.textContent = d.longitude.toFixed(2);
    updateMapMarker(d.latitude, d.longitude);
    if (els.globeCaption) {
      const now = new Date();
      els.globeCaption.textContent =
        `最終更新 ${now.toLocaleTimeString('ja-JP')}（5秒ごとに自動更新）`;
    }
  } catch (e) {
    console.error('ISS位置の取得に失敗', e);
  }
}

/* 地上軌道：前後 TRACK_SPAN_MIN 分ぶんの位置をまとめて取得して描画する。
   セグメント点の間隔は画面右下の「segment: 5 min」表示と合わせている。 */
const TRACK_SPAN_MIN = 100;   // 前後この分数（約1周＋α）を描く
const SEGMENT_MIN = 5;        // セグメント点の間隔（分）

async function loadGroundTrack() {
  if (!els.trackLayer) return;
  try {
    const now = Math.floor(Date.now() / 1000);
    const timestamps = [];
    for (let m = -TRACK_SPAN_MIN; m <= TRACK_SPAN_MIN; m += SEGMENT_MIN) {
      timestamps.push(now + m * 60);
    }
    const r = await fetch(`https://api.wheretheiss.at/v1/satellites/25544/positions?timestamps=${timestamps.join(',')}`);
    const list = await r.json();
    if (!Array.isArray(list) || !list.length) return;

    // 経度を連続値に「ほどく」（日付変更線をまたぐと ±360 されるのを補正）
    const pts = [];
    let unLon = list[0].longitude;
    list.forEach((p, i) => {
      if (i > 0) {
        let d = p.longitude - unLon;
        while (d > 180) d -= 360;
        while (d < -180) d += 360;
        unLon += d;
      }
      pts.push({ x: unLon + 180, y: 90 - p.latitude });
    });

    // 連続した折れ線パスを1本作る
    let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)}`;
    }

    // セグメント点（画像の「segment: 5 min」に対応）
    const dots = pts.map(p =>
      `<rect class="track-dot" x="${(p.x - 1.3).toFixed(2)}" y="${(p.y - 1.3).toFixed(2)}" width="2.6" height="2.6" rx="0.4"/>`
    ).join('');

    const inner = `<path class="track-line" d="${d}"/>${dots}`;

    // ±180°をまたぐ描画を継ぎ目なく見せるため、-360 / 0 / +360 の3枚重ねにする
    els.trackLayer.innerHTML =
      `<g clip-path="url(#mapClip)">` +
        `<g transform="translate(-360 0)">${inner}</g>` +
        `<g>${inner}</g>` +
        `<g transform="translate(360 0)">${inner}</g>` +
      `</g>`;
  } catch (e) {
    console.warn('地上軌道の取得に失敗', e);
  }
}

/* ---------------- 世界地図（大陸の描画） ----------------
   Natural Earth 由来の world-atlas（TopoJSON）をCDNから取得し、
   d3-geo の正距円筒図法で SVG パスに変換して描画する。 */
async function loadWorldMap() {
  if (!els.mapLand) return;
  if (typeof d3 === 'undefined' || typeof topojson === 'undefined') {
    console.warn('地図ライブラリ(d3/topojson)が読み込まれていないため、大陸は描画しません');
    return;
  }
  try {
    const topo = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(r => r.json());

    const projection = d3.geoEquirectangular()
      .scale(180 / Math.PI)
      .translate([MAP_W / 2, MAP_H / 2]);

    const path = d3.geoPath(projection);

    // 大陸・国境
    const countries = topojson.feature(topo, topo.objects.countries);
    els.mapLand.innerHTML = countries.features
      .map(f => `<path d="${path(f)}"/>`)
      .join('');

    // 経緯線（30°間隔の薄いグリッド）
    if (els.mapGraticule) {
      const grat = d3.geoGraticule().step([30, 30]);
      els.mapGraticule.innerHTML = `<path d="${path(grat())}"/>`;
    }
  } catch (e) {
    console.warn('世界地図の取得に失敗', e);
  }
}

/* ---------------- ISSクルー ----------------
   open-notify.org はダウンやCORSエラーが頻発するため、
   より安定したミラー(corquaid/international-space-station-APIs)を優先し、
   失敗した場合のみ open-notify にフォールバックする。 */
async function fetchWithTimeout(url, ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const r = await fetch(url, { signal: controller.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

async function loadCrew() {
  // 1) 安定版ミラー（HTTPS・CORS対応、GitHub Pages配信、詳細プロフィール付き）
  try {
    const d = await fetchWithTimeout('https://corquaid.github.io/international-space-station-APIs/JSON/people-in-space.json');
    const iss = (d.people || []).filter(p => p.iss === true || p.spacecraft?.includes('ISS'));
    renderCrew(iss.length ? iss : (d.people || []));
    return;
  } catch (e) {
    console.warn('ミラーAPIの取得に失敗、open-notifyへフォールバック', e);
  }

  // 2) フォールバック: open-notify（不安定な場合あり、詳細情報なし）
  try {
    const d = await fetchWithTimeout('https://api.open-notify.org/astros.json');
    const iss = (d.people || []).filter(p => p.craft === 'ISS');
    renderCrew(iss.map(p => ({ name: p.name, spacecraft: p.craft })));
  } catch (e) {
    els.crewList.innerHTML = '<li>クルー情報を取得できませんでした。しばらくしてから再読み込みしてください。</li>';
    els.crewCount.textContent = '--';
    console.error('クルー取得失敗（両方のソース）', e);
  }
}

let currentCrew = [];

function initials(name) {
  return String(name).trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function renderCrew(list) {
  currentCrew = list;
  els.crewCount.textContent = `${list.length}名`;
  els.crewList.innerHTML = list.map((p, i) => `
    <li data-index="${i}" tabindex="0" role="button" aria-haspopup="dialog">
      ${p.image
        ? `<img class="crew-avatar" data-fallback="${escapeHtml(initials(p.name))}" src="${p.image}" alt="" loading="lazy">`
        : `<div class="crew-avatar">${escapeHtml(initials(p.name))}</div>`
      }
      <div class="crew-text">
        <span class="name">${escapeHtml(p.name)}</span>
        <span class="craft">${escapeHtml(p.spacecraft || p.craft || 'ISS')} 搭乗中</span>
      </div>
    </li>
  `).join('') || '<li>データがありません</li>';
}

// 画像が読み込めなかった場合、イニシャルのアイコンに差し替える
// （error イベントはバブリングしないため capture:true で委譲する）
els.crewList?.addEventListener('error', (e) => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || !img.classList.contains('crew-avatar')) return;
  const div = document.createElement('div');
  div.className = 'crew-avatar';
  div.textContent = img.dataset.fallback || '?';
  img.replaceWith(div);
}, true);

function openCrewModal(index) {
  const p = currentCrew[index];
  if (!p) return;

  const rows = [];
  if (p.country) rows.push(['国', p.country]);
  if (p.agency) rows.push(['所属機関', p.agency]);
  if (p.position) rows.push(['役職', p.position]);
  if (p.spacecraft || p.craft) rows.push(['搭乗機', p.spacecraft || p.craft]);
  if (p.launched) {
    const d = new Date(p.launched * 1000);
    rows.push(['打上げ日', d.toLocaleDateString('ja-JP')]);
  }
  if (typeof p.days_in_space === 'number') rows.push(['宇宙滞在日数', `${p.days_in_space}日`]);

  const links = [];
  if (p.url) links.push(`<a href="${p.url}" target="_blank" rel="noopener">Wikipedia ↗</a>`);
  if (p.twitter) links.push(`<a href="${p.twitter}" target="_blank" rel="noopener">X (Twitter) ↗</a>`);
  if (p.instagram) links.push(`<a href="${p.instagram}" target="_blank" rel="noopener">Instagram ↗</a>`);
  if (!p.url && !p.twitter && !p.instagram) {
    links.push(`<a href="https://ja.wikipedia.org/wiki/${encodeURIComponent(p.name)}" target="_blank" rel="noopener">Wikipediaで検索 ↗</a>`);
  }

  const photoHtml = p.image
    ? `<img class="crew-detail-photo" data-fallback="${escapeHtml(initials(p.name))}" src="${p.image}" alt="${escapeHtml(p.name)}">`
    : `<div class="crew-detail-avatar-fallback">${escapeHtml(initials(p.name))}</div>`;

  els.crewModalBody.innerHTML = `
    ${photoHtml}
    <div class="crew-detail-main">
      <div class="crew-detail-name">${escapeHtml(p.name)}</div>
      <div class="crew-detail-role">${escapeHtml(p.position || p.agency || 'ISS クルー')}</div>
      ${rows.length ? `<div class="crew-detail-rows">${rows.map(([k, v]) => `
        <div class="crew-detail-row"><span>${escapeHtml(k)}</span><span>${escapeHtml(String(v))}</span></div>
      `).join('')}</div>` : '<p class="hint">この人物の詳細データは取得元から提供されていません。</p>'}
      <div class="crew-detail-links">${links.join('')}</div>
    </div>
  `;
  els.crewModalOverlay.hidden = false;
  els.crewModalClose.focus();
}

els.crewModalBody?.addEventListener('error', (e) => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || !img.classList.contains('crew-detail-photo')) return;
  const div = document.createElement('div');
  div.className = 'crew-detail-avatar-fallback';
  div.textContent = img.dataset.fallback || '?';
  img.replaceWith(div);
}, true);

function closeCrewModal() {
  els.crewModalOverlay.hidden = true;
}

els.crewList?.addEventListener('click', (e) => {
  const item = e.target.closest('li[data-index]');
  if (item) openCrewModal(Number(item.dataset.index));
});
els.crewList?.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const item = e.target.closest('li[data-index]');
  if (item) { e.preventDefault(); openCrewModal(Number(item.dataset.index)); }
});
els.crewModalClose?.addEventListener('click', closeCrewModal);
els.crewModalOverlay?.addEventListener('click', (e) => {
  if (e.target === els.crewModalOverlay) closeCrewModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !els.crewModalOverlay.hidden) closeCrewModal();
});

/* ---------------- 打上げ一覧 ---------------- */
let allLaunches = [];

async function loadLaunches() {
  try {
    const r = await fetch('https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=30&mode=normal');
    const d = await r.json();
    allLaunches = d.results || [];
    renderLaunches('all');
  } catch (e) {
    els.launchList.innerHTML = '<p class="hint">打上げ情報の取得に失敗しました</p>';
    console.error('打上げ取得失敗', e);
  }
}

function agencyMatch(launch, key) {
  const provider = (launch.launch_service_provider?.name || '').toLowerCase();
  const map = {
    spacex: ['spacex'],
    nasa: ['nasa'],
    jaxa: ['jaxa'],
  };
  return map[key].some(k => provider.includes(k));
}

function renderLaunches(filter) {
  let list = allLaunches;
  if (filter !== 'all') {
    list = allLaunches.filter(l => agencyMatch(l, filter));
  }
  if (!list.length) {
    els.launchList.innerHTML = '<p class="hint">直近の予定にはありませんでした（このAPIが返す範囲は今後30件程度のため、日にちが空くこともあります）</p>';
    return;
  }
  els.launchList.innerHTML = list.slice(0, 8).map(l => {
    const date = l.net ? new Date(l.net) : null;
    const dateStr = date ? date.toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '未定';
    const pad = l.pad?.location?.name || '';
    const provider = l.launch_service_provider?.name || '';
    return `
      <div class="launch-item">
        <div>
          <div class="date">${escapeHtml(dateStr)}</div>
          <div class="name">${escapeHtml(l.name || '')}</div>
          <div class="meta">${escapeHtml(provider)}${pad ? ' ・ ' + escapeHtml(pad) : ''}</div>
        </div>
        <span class="agency-tag">${escapeHtml(provider || '未定')}</span>
      </div>
    `;
  }).join('');
}

els.agencyFilter?.addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  els.agencyFilter.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  renderLaunches(btn.dataset.agency);
});

/* ---------------- Starlink可視予報 & ISS可視パス（現在地ベース） ----------------
   Heavens-Aboveは位置情報をセッション/Cookieで管理する仕組みのため、
   シークレット（プライベート）ブラウジングだとCookieが保存されず、
   正しいURLでもサーバー側エラーになることがある。
   そのため深いリンクではなく、まずトップページを開いてもらう方式にしている。 */
els.locateBtn?.addEventListener('click', () => {
  if (!('geolocation' in navigator)) {
    els.starlinkResult.innerHTML = '<p>このブラウザは位置情報に対応していません。</p>';
    return;
  }
  els.starlinkResult.innerHTML = '<p>現在地を取得中...</p>';
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude, longitude } = pos.coords;
    els.starlinkResult.innerHTML = `
      <div class="pass">
        現在地: 緯度 ${latitude.toFixed(2)}°, 経度 ${longitude.toFixed(2)}°<br>
        Heavens-Aboveのトップページで、この緯度・経度を「Select from map」または検索欄に入力して場所を保存すると、
        以降はISSやStarlinkの通過予測がそのまま使えるようになります（シークレットウィンドウでは保存されないのでご注意ください）。
      </div>
      <div class="link-row">
        <a href="https://www.heavens-above.com/" target="_blank" rel="noopener" class="btn-secondary">Heavens-Aboveを開く ↗</a>
      </div>
    `;
  }, err => {
    els.starlinkResult.innerHTML = `<p>位置情報を取得できませんでした（${escapeHtml(err.message)}）。ブラウザの位置情報許可設定をご確認ください。</p>`;
  });
});

/* ---------------- オーロラ Kp指数 ---------------- */
async function loadKp() {
  try {
    const r = await fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json');
    const d = await r.json();
    // d[0] はヘッダー行、最後の行が最新データ [time_tag, Kp, ...]
    const latest = d[d.length - 1];
    const kp = parseFloat(latest[1]);
    els.kpValue.textContent = kp.toFixed(1);
    els.kpFill.style.width = `${Math.min(kp / 9 * 100, 100)}%`;
    let desc = '静穏 - オーロラは高緯度地域のみ';
    if (kp >= 7) desc = '大規模な磁気嵐 - 中緯度でもオーロラが見える可能性';
    else if (kp >= 5) desc = '磁気嵐 - 高緯度〜一部中緯度でオーロラの可能性';
    else if (kp >= 3) desc = 'やや活発 - 高緯度地域で観測しやすい状態';
    els.kpDesc.textContent = desc;
  } catch (e) {
    els.kpDesc.textContent = 'Kp指数の取得に失敗しました';
    console.error('Kp取得失敗', e);
  }
}

/* ---------------- 流星群カレンダー（主要なものを固定データで表示） ---------------- */
const METEOR_SHOWERS = [
  { name: 'しぶんぎ座流星群', peak: '1月上旬', rate: '最大 約120個/時' },
  { name: 'みずがめ座η流星群', peak: '5月上旬', rate: '最大 約50個/時' },
  { name: 'ペルセウス座流星群', peak: '8月中旬', rate: '最大 約100個/時' },
  { name: 'オリオン座流星群', peak: '10月下旬', rate: '最大 約20個/時' },
  { name: 'しし座流星群', peak: '11月中旬', rate: '最大 約15個/時' },
  { name: 'ふたご座流星群', peak: '12月中旬', rate: '最大 約150個/時' },
];

function renderMeteors() {
  els.meteorList.innerHTML = METEOR_SHOWERS.map(m => `
    <div class="meteor-item">
      <div class="m-name">${escapeHtml(m.name)}</div>
      <div class="m-peak">極大: ${escapeHtml(m.peak)}</div>
      <div class="m-rate">${escapeHtml(m.rate)}</div>
    </div>
  `).join('');
}

/* ---------------- PWA インストール ---------------- */
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  els.installBtn.hidden = false;
});
els.installBtn?.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  els.installBtn.hidden = true;
});
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW登録失敗', err));
  });
}

/* ---------------- ユーティリティ ---------------- */
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[s]));
}

/* ---------------- 初期化 ---------------- */
els.refreshBtn?.addEventListener('click', loadISS);

loadWorldMap();
loadISS();
loadGroundTrack();
loadCrew();
loadLaunches();
loadKp();
renderMeteors();

setInterval(loadISS, 5000);
setInterval(loadGroundTrack, 5 * 60 * 1000); // 5分ごと
setInterval(loadKp, 5 * 60 * 1000); // 5分ごと
