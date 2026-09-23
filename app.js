/* ==========================================================
   SpaceTracker Pro - app.js
   ISS位置・クルー・打上げ・Starlink可視予報・オーロラ・流星群・PWA
   ========================================================== */

const els = {
  speed: document.getElementById('speed'),
  altitude: document.getElementById('altitude'),
  lat: document.getElementById('lat'),
  lon: document.getElementById('lon'),
  issDot: document.getElementById('issDot'),
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
};

/* ---------------- ISS 現在位置 ---------------- */
async function loadISS() {
  try {
    const r = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
    const d = await r.json();
    els.speed.textContent = Math.round(d.velocity).toLocaleString('ja-JP');
    els.altitude.textContent = d.altitude.toFixed(1);
    els.lat.textContent = d.latitude.toFixed(2);
    els.lon.textContent = d.longitude.toFixed(2);
  } catch (e) {
    console.error('ISS位置の取得に失敗', e);
  }
}

/* ---------------- ISSクルー ---------------- */
async function loadCrew() {
  try {
    const r = await fetch('https://api.open-notify.org/astros.json');
    const d = await r.json();
    const iss = d.people.filter(p => p.craft === 'ISS');
    els.crewCount.textContent = `${iss.length}名`;
    els.crewList.innerHTML = iss.map(p => `
      <li>
        <span class="name">${escapeHtml(p.name)}</span>
        <span class="craft">${escapeHtml(p.craft)} 搭乗中</span>
      </li>
    `).join('') || '<li>データがありません</li>';
  } catch (e) {
    els.crewList.innerHTML = '<li>クルー情報の取得に失敗しました</li>';
    console.error('クルー取得失敗', e);
  }
}

/* ---------------- 打上げ一覧 ---------------- */
let allLaunches = [];

async function loadLaunches() {
  try {
    const r = await fetch('https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=15&mode=normal');
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
    els.launchList.innerHTML = '<p class="hint">該当する打上げ予定が見つかりませんでした</p>';
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

/* ---------------- Starlink 可視予報（現在地ベース） ---------------- */
els.locateBtn?.addEventListener('click', () => {
  if (!('geolocation' in navigator)) {
    els.starlinkResult.innerHTML = '<p>このブラウザは位置情報に対応していません。</p>';
    return;
  }
  els.starlinkResult.innerHTML = '<p>現在地を取得中...</p>';
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude, longitude } = pos.coords;
    const tz = -new Date().getTimezoneOffset() / 60;
    const url = `https://www.heavens-above.com/StarlinkTrainList.aspx?lat=${latitude.toFixed(4)}&lng=${longitude.toFixed(4)}&loc=Unspecified&alt=0&tz=${tz}`;
    els.starlinkResult.innerHTML = `
      <div class="pass">
        現在地（緯度 ${latitude.toFixed(2)}°, 経度 ${longitude.toFixed(2)}°）に基づく、
        今夜のStarlink可視パスをHeavens-Aboveで確認できます。
      </div>
      <p style="margin-top:10px;"><a href="${url}" target="_blank" rel="noopener" class="btn-secondary" style="display:inline-block; text-decoration:none;">可視パス一覧を開く ↗</a></p>
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

loadISS();
loadCrew();
loadLaunches();
loadKp();
renderMeteors();

setInterval(loadISS, 5000);
setInterval(loadKp, 5 * 60 * 1000); // 5分ごと
