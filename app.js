/* ==========================================================
   SpaceTracker Pro - app.js
   ISS位置・クルー・打上げ・Starlink可視予報・オーロラ・流星群・PWA
   ========================================================== */

const els = {
  speed: document.getElementById('speed'),
  altitude: document.getElementById('altitude'),
  lat: document.getElementById('lat'),
  lon: document.getElementById('lon'),
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
  celestialWidget: document.getElementById('celestialWidget'),
  moonGraphic: document.getElementById('moonGraphic'),
  locDot: document.getElementById('locDot'),
  moonAgeText: document.getElementById('moonAgeText'),
  moonNameText: document.getElementById('moonNameText'),
  celestialLoc: document.getElementById('celestialLoc'),
  sunriseText: document.getElementById('sunriseText'),
  sunsetText: document.getElementById('sunsetText'),
  celestialModalOverlay: document.getElementById('celestialModalOverlay'),
  celestialModalClose: document.getElementById('celestialModalClose'),
  celestialModalBody: document.getElementById('celestialModalBody'),
};

/* ---------------- ISS 現在位置 ----------------
   地図の可視化はisstracker.plの埋め込みウィジェットに任せているため、
   ここでは数値（速度・高度・緯度経度）の取得のみ行う。 */
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

/* ---------------- 天体計算（日の出・日の入り・月齢・月相） ---------------- */
let userLocation = {
  lat: 35.6895,
  lon: 139.6917,
  city: '東京都',
  isAuto: false,
};

function getJulianDay(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

function getSolarTimes(date, lat, lon) {
  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  const julianDate = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  const T = (julianDate - 2451545.0) / 36525;

  let L0 = 280.46646 + T * (36000.76983 + 0.0003032 * T);
  L0 = ((L0 % 360) + 360) % 360;

  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);

  const C = Math.sin(M * rad) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
            Math.sin(2 * M * rad) * (0.019993 - 0.000101 * T) +
            Math.sin(3 * M * rad) * 0.000289;

  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * rad);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * rad);
  const delta = Math.asin(Math.sin(eps * rad) * Math.sin(lambda * rad));

  const varY = Math.tan((eps / 2) * rad) * Math.tan((eps / 2) * rad);
  const eqTime = 4 * deg * (
    varY * Math.sin(2 * L0 * rad) -
    2 * e * Math.sin(M * rad) +
    4 * e * varY * Math.sin(M * rad) * Math.cos(2 * L0 * rad) -
    0.5 * varY * varY * Math.sin(4 * L0 * rad) -
    1.25 * e * e * Math.sin(2 * M * rad)
  );

  const zenith = 90.8333 * rad;
  const cosH0 = (Math.cos(zenith) - Math.sin(lat * rad) * Math.sin(delta)) / (Math.cos(lat * rad) * Math.cos(delta));
  const tzOffset = -date.getTimezoneOffset() / 60;
  const solarNoon = 720 - (4 * lon) - eqTime + (tzOffset * 60);

  if (cosH0 > 1) {
    return { sunriseStr: '--:--', sunsetStr: '--:--', noonStr: formatMins(solarNoon), dayLenStr: '0h', isDay: false };
  } else if (cosH0 < -1) {
    return { sunriseStr: '沈まない', sunsetStr: '沈まない', noonStr: formatMins(solarNoon), dayLenStr: '24h', isDay: true };
  }

  const H0 = Math.acos(cosH0) * deg;
  const sunriseMins = solarNoon - (H0 * 4);
  const sunsetMins = solarNoon + (H0 * 4);
  const dayLenMins = sunsetMins - sunriseMins;
  const curMins = date.getHours() * 60 + date.getMinutes();
  const isDay = curMins >= sunriseMins && curMins <= sunsetMins;

  return {
    sunriseStr: formatMins(sunriseMins),
    sunsetStr: formatMins(sunsetMins),
    noonStr: formatMins(solarNoon),
    dayLenStr: `${Math.floor(dayLenMins / 60)}時間${Math.floor(dayLenMins % 60).toString().padStart(2, '0')}分`,
    isDay,
  };
}

function formatMins(m) {
  const norm = ((m % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const min = Math.floor(norm % 60);
  return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
}

function getMoonDetails(date = new Date()) {
  const jd = getJulianDay(date);
  const refJD = 2451549.260417; // 2000-01-06 18:14 UTC
  const synodicMonth = 29.530588853;

  const age = ((jd - refJD) % synodicMonth + synodicMonth) % synodicMonth;
  const phaseAngle = (age / synodicMonth) * 2 * Math.PI;
  const illumination = (1 - Math.cos(phaseAngle)) / 2;
  const isWaxing = age < (synodicMonth / 2);

  let phaseName = '新月';
  if (age < 1.0 || age >= 28.5) phaseName = '新月';
  else if (age < 2.5) phaseName = '既朔';
  else if (age < 4.5) phaseName = '三日月';
  else if (age < 6.8) phaseName = '眉月';
  else if (age < 8.2) phaseName = '上弦の月';
  else if (age < 11.5) phaseName = '十日夜';
  else if (age < 13.5) phaseName = '十三夜';
  else if (age < 14.5) phaseName = '待宵月';
  else if (age < 15.5) phaseName = '満月';
  else if (age < 16.5) phaseName = '十六夜';
  else if (age < 17.5) phaseName = '立待月';
  else if (age < 18.5) phaseName = '居待月';
  else if (age < 19.5) phaseName = '寝待月';
  else if (age < 21.5) phaseName = '更待月';
  else if (age < 23.5) phaseName = '下弦の月';
  else if (age < 27.0) phaseName = '有明月';
  else phaseName = '三十日月';

  const daysToFull = ((synodicMonth / 2) - age + synodicMonth) % synodicMonth;

  return {
    age: Math.round(age * 10) / 10,
    rawAge: age,
    illumination: Math.round(illumination * 100),
    isWaxing,
    phaseName,
    daysToFull: Math.round(daysToFull * 10) / 10,
  };
}

function renderMoonSVG(moon, size = 32) {
  const r = 48;
  const c = 50;
  const phi = (moon.rawAge / 29.530588853) * 2 * Math.PI;
  const termX = Math.abs(Math.cos(phi) * r);
  const isGibbous = moon.illumination > 50;
  const uid = Math.random().toString(36).slice(2, 7);

  let path = '';
  if (moon.illumination <= 1) {
    path = '';
  } else if (moon.illumination >= 99) {
    path = `M ${c - r} ${c} A ${r} ${r} 0 1 0 ${c + r} ${c} A ${r} ${r} 0 1 0 ${c - r} ${c} Z`;
  } else if (moon.isWaxing) {
    const sweep = isGibbous ? 1 : 0;
    path = `M ${c} ${c - r} A ${r} ${r} 0 0 1 ${c} ${c + r} A ${termX} ${r} 0 0 ${sweep} ${c} ${c - r} Z`;
  } else {
    const sweep = isGibbous ? 0 : 1;
    path = `M ${c} ${c - r} A ${r} ${r} 0 0 0 ${c} ${c + r} A ${termX} ${r} 0 0 ${sweep} ${c} ${c - r} Z`;
  }

  return `
    <svg viewBox="0 0 100 100" width="${size}" height="${size}" style="overflow:visible;">
      <defs>
        <radialGradient id="base-${uid}" cx="38%" cy="32%" r="65%">
          <stop offset="0%" stop-color="#2c3a52"/>
          <stop offset="100%" stop-color="#090f1b"/>
        </radialGradient>
        <radialGradient id="lit-${uid}" cx="${moon.isWaxing ? '65%' : '35%'}" cy="35%" r="70%">
          <stop offset="0%" stop-color="#fffbf0"/>
          <stop offset="35%" stop-color="#f3e5b8"/>
          <stop offset="80%" stop-color="#d8b979"/>
          <stop offset="100%" stop-color="#7a5b25"/>
        </radialGradient>
        <mask id="mask-${uid}">
          <rect width="100" height="100" fill="black"/>
          <path d="${path}" fill="white"/>
        </mask>
      </defs>
      <circle cx="${c}" cy="${c}" r="${r}" fill="url(#base-${uid})" stroke="rgba(79,209,232,0.2)" stroke-width="1"/>
      ${path ? `
        <g mask="url(#mask-${uid})">
          <circle cx="${c}" cy="${c}" r="${r}" fill="url(#lit-${uid})"/>
          <circle cx="38" cy="48" r="3" fill="#e2d2a4" opacity="0.6"/>
          <circle cx="58" cy="38" r="4.5" fill="#cca666" opacity="0.5"/>
          <circle cx="50" cy="74" r="3" fill="#fff" opacity="0.7"/>
        </g>
      ` : ''}
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="rgba(232,181,79,0.35)" stroke-width="1"/>
    </svg>
  `;
}

function updateCelestialUI() {
  const now = new Date();
  const solar = getSolarTimes(now, userLocation.lat, userLocation.lon);
  const moon = getMoonDetails(now);

  if (els.sunriseText) els.sunriseText.textContent = solar.sunriseStr;
  if (els.sunsetText) els.sunsetText.textContent = solar.sunsetStr;
  if (els.moonAgeText) els.moonAgeText.textContent = `月齢 ${moon.age.toFixed(1)}`;
  if (els.moonNameText) els.moonNameText.textContent = moon.phaseName;
  if (els.celestialLoc) els.celestialLoc.textContent = `📍 ${userLocation.city || `${userLocation.lat.toFixed(1)}°, ${userLocation.lon.toFixed(1)}°`}`;
  if (els.moonGraphic) els.moonGraphic.innerHTML = renderMoonSVG(moon, 32);

  if (els.locDot) {
    if (userLocation.isAuto) els.locDot.classList.add('active');
    else els.locDot.classList.remove('active');
  }

  // Update Starlink/ISS visibility section
  if (els.starlinkResult) {
    els.starlinkResult.innerHTML = `
      <div class="pass">
        現在地: <strong>${escapeHtml(userLocation.city || '現在地')}</strong>（緯度 ${userLocation.lat.toFixed(2)}°, 経度 ${userLocation.lon.toFixed(2)}°）<br>
        ページを開いた時に現在地を取得しました。以下のHeavens-Aboveリンクで現在の座標における通過予測がすぐに確認できます。
      </div>
      <div class="link-row">
        <a href="https://www.heavens-above.com/PassSummary.aspx?satid=25544&lat=${userLocation.lat.toFixed(4)}&lng=${userLocation.lon.toFixed(4)}&loc=${encodeURIComponent(userLocation.city || 'My Location')}" target="_blank" rel="noopener" class="btn-secondary">ISS 可視パス予報 ↗</a>
        <a href="https://www.heavens-above.com/StarlinkLaunchPasses.aspx?lat=${userLocation.lat.toFixed(4)}&lng=${userLocation.lon.toFixed(4)}" target="_blank" rel="noopener" class="btn-secondary">Starlink 通過予測 ↗</a>
        <a href="https://www.heavens-above.com/?lat=${userLocation.lat.toFixed(4)}&lng=${userLocation.lon.toFixed(4)}" target="_blank" rel="noopener" class="btn-ghost">Heavens-Above トップ ↗</a>
      </div>
    `;
  }
}

async function acquireLocation(silent = false) {
  if (!('geolocation' in navigator)) {
    if (!silent && els.starlinkResult) {
      els.starlinkResult.innerHTML = '<p class="hint">このブラウザは位置情報に対応していません。</p>';
    }
    updateCelestialUI();
    return;
  }

  if (els.celestialLoc) els.celestialLoc.textContent = '📍 取得中...';

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const { latitude, longitude } = pos.coords;
    userLocation.lat = latitude;
    userLocation.lon = longitude;
    userLocation.isAuto = true;

    try {
      const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=ja`);
      if (res.ok) {
        const d = await res.json();
        userLocation.city = d.locality || d.city || d.principalSubdivision || `${latitude.toFixed(1)}°, ${longitude.toFixed(1)}°`;
      }
    } catch (e) {
      userLocation.city = `${latitude.toFixed(1)}°N, ${longitude.toFixed(1)}°E`;
    }

    updateCelestialUI();
  }, (err) => {
    console.warn('Geolocation error or declined:', err);
    userLocation.isAuto = false;
    updateCelestialUI();
  }, { timeout: 8000, maximumAge: 300000 });
}

/* ---------------- Celestial Modal ---------------- */
const C_PRESETS = [
  { name: '札幌', lat: 43.0642, lon: 141.3469 },
  { name: '仙台', lat: 38.2682, lon: 140.8694 },
  { name: '東京', lat: 35.6895, lon: 139.6917 },
  { name: '名古屋', lat: 35.1815, lon: 136.9066 },
  { name: '大阪', lat: 34.6937, lon: 135.5023 },
  { name: '広島', lat: 34.3853, lon: 132.4553 },
  { name: '福岡', lat: 33.5904, lon: 130.4017 },
  { name: '那覇', lat: 26.2124, lon: 127.6809 },
];

function openCelestialModal() {
  const now = new Date();
  const solar = getSolarTimes(now, userLocation.lat, userLocation.lon);
  const moon = getMoonDetails(now);

  els.celestialModalBody.innerHTML = `
    <div class="celestial-modal-body">
      <div style="font-family:var(--font-display); font-size:18px; font-weight:700; color:var(--text);">
        🌌 現在地の天体インフォ
      </div>

      <!-- Moon Hero Card -->
      <div class="c-hero-box">
        <div style="background:#070b14; padding:8px; border-radius:16px; border:1px solid var(--line); flex-shrink:0;">
          ${renderMoonSVG(moon, 72)}
        </div>
        <div>
          <div style="color:var(--gold); font-size:13px; font-weight:600;">${moon.phaseName}</div>
          <div style="font-family:var(--font-display); font-size:22px; font-weight:700; margin:2px 0;">月齢 ${moon.age.toFixed(1)}</div>
          <div style="font-size:12px; color:var(--text-dim);">輝面比: <strong style="color:var(--text);">${moon.illumination}%</strong> ・ ${moon.isWaxing ? '満ちていく月' : '欠けていく月'}</div>
          <div style="font-size:11px; color:var(--gold); margin-top:4px;">次の満月まで あと約 ${moon.daysToFull.toFixed(1)} 日</div>
        </div>
      </div>

      <!-- Sun Cards -->
      <div class="c-sun-grid">
        <div class="c-sun-card">
          <span class="c-icon">🌅</span>
          <div>
            <div class="c-lbl">日の出</div>
            <div class="c-val">${solar.sunriseStr}</div>
          </div>
        </div>
        <div class="c-sun-card">
          <span class="c-icon">🌇</span>
          <div>
            <div class="c-lbl">日の入り</div>
            <div class="c-val">${solar.sunsetStr}</div>
          </div>
        </div>
      </div>

      <!-- Location row & City selector -->
      <div style="background:var(--bg-elev); border:1px solid var(--line); border-radius:14px; padding:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="font-size:13px; font-weight:600;">📍 ${escapeHtml(userLocation.city)} (${userLocation.lat.toFixed(2)}°, ${userLocation.lon.toFixed(2)}°)</div>
          <button id="modalLocBtn" class="btn-ghost" style="padding:4px 10px; font-size:11px;">GPS再取得</button>
        </div>
        <div style="font-size:11px; color:var(--text-dim); margin-top:10px;">主要都市を選択:</div>
        <div class="c-preset-grid">
          ${C_PRESETS.map((c, i) => `
            <button class="c-preset-btn" data-city-idx="${i}">${escapeHtml(c.name)}</button>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  document.getElementById('modalLocBtn')?.addEventListener('click', () => {
    acquireLocation(false);
  });

  els.celestialModalBody.querySelectorAll('.c-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.cityIdx);
      const c = C_PRESETS[idx];
      if (c) {
        userLocation.lat = c.lat;
        userLocation.lon = c.lon;
        userLocation.city = c.name;
        userLocation.isAuto = false;
        updateCelestialUI();
        openCelestialModal();
      }
    });
  });

  els.celestialModalOverlay.hidden = false;
  els.celestialModalClose?.focus();
}

function closeCelestialModal() {
  if (els.celestialModalOverlay) els.celestialModalOverlay.hidden = true;
}

els.celestialWidget?.addEventListener('click', openCelestialModal);
els.celestialModalClose?.addEventListener('click', closeCelestialModal);
els.celestialModalOverlay?.addEventListener('click', (e) => {
  if (e.target === els.celestialModalOverlay) closeCelestialModal();
});

/* ---------------- Starlink可視予報 & ISS可視パス（現在地ベース） ---------------- */
els.locateBtn?.addEventListener('click', () => {
  acquireLocation(false);
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
updateCelestialUI();
acquireLocation(true); // ページを開いたときに現在地を自動取得

setInterval(loadISS, 5000);
setInterval(loadKp, 5 * 60 * 1000); // 5分ごと
setInterval(updateCelestialUI, 60 * 1000); // 1分ごとに太陽・月情報を更新

