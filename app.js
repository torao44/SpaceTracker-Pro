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
  issPassesBox: document.getElementById('issPassesBox'),
  issPassesTitle: document.getElementById('issPassesTitle'),
  issPassesNotice: document.getElementById('issPassesNotice'),
  issPassesLoc: document.getElementById('issPassesLoc'),
  issPassesList: document.getElementById('issPassesList'),
  issPassCountdown: document.getElementById('issPassCountdown'),
  issHeavensLink: document.getElementById('issHeavensLink'),
  nextLaunchHero: document.getElementById('nextLaunchHero'),
  skyLocBadge: document.getElementById('skyLocBadge'),
  skyLocCity: document.getElementById('skyLocCity'),
  skyLocCoords: document.getElementById('skyLocCoords'),
  skyStarlinkBtn: document.getElementById('skyStarlinkBtn'),
  skyIssBtn: document.getElementById('skyIssBtn'),
  openArBtn: document.getElementById('openArBtn'),
  arNavModal: document.getElementById('arNavModal'),
  arViewport: document.getElementById('arViewport'),
  arVideo: document.getElementById('arVideo'),
  arCanvas: document.getElementById('arCanvas'),
  arTargetMarker: document.getElementById('arTargetMarker'),
  arTargetLabel: document.getElementById('arTargetLabel'),
  arTargetSub: document.getElementById('arTargetSub'),
  arOffscreenWrap: document.getElementById('arOffscreenWrap'),
  arOffscreenArrow: document.getElementById('arOffscreenArrow'),
  arPassSummary: document.getElementById('arPassSummary'),
  arInstructionsText: document.getElementById('arInstructionsText'),
  arAnglesText: document.getElementById('arAnglesText'),
  arCompassIcon: document.getElementById('arCompassIcon'),
  arGuidanceCard: document.getElementById('arGuidanceCard'),
  arSensorPrompt: document.getElementById('arSensorPrompt'),
  arSensorPermBtn: document.getElementById('arSensorPermBtn'),
  arPassTabs: document.getElementById('arPassTabs'),
  arModeToggle: document.getElementById('arModeToggle'),
  arSnapBtn: document.getElementById('arSnapBtn'),
  arSoundBtn: document.getElementById('arSoundBtn'),
  arCamBtn: document.getElementById('arCamBtn'),
  arCamText: document.getElementById('arCamText'),
  arHelpBtn: document.getElementById('arHelpBtn'),
  arCloseBtn: document.getElementById('arCloseBtn'),
  arHelpModalOverlay: document.getElementById('arHelpModalOverlay'),
  arHelpModalClose: document.getElementById('arHelpModalClose'),
  arHelpConfirmBtn: document.getElementById('arHelpConfirmBtn'),
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

/* ---------------- ISS 肉眼可視通過予報（近3回分） ---------------- */
let cachedISSTLE = null;
const FALLBACK_ISS_TLE = {
  line1: '1 25544U 98067A   26266.88389698  .00009434  00000+0  17760-3 0  9994',
  line2: '2 25544  51.6318 171.6234 0004723 174.4397 185.6645 15.49253495587058'
};

async function getISSTLE() {
  if (cachedISSTLE && Date.now() - cachedISSTLE.time < 3600 * 1000) return cachedISSTLE.data;
  try {
    const res = await fetch('https://api.wheretheiss.at/v1/satellites/25544/tles');
    if (res.ok) {
      const data = await res.json();
      if (data.line1 && data.line2) {
        cachedISSTLE = { data, time: Date.now() };
        return data;
      }
    }
  } catch (e) {
    console.warn('TLE API失敗、フォールバック使用', e);
  }
  return FALLBACK_ISS_TLE;
}

function azToCompass(deg) {
  const norm = ((deg % 360) + 360) % 360;
  const dirs = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
  return dirs[Math.round(norm / 45) % 8];
}

function getSunAltDeg(date, lat, lon) {
  const rad = Math.PI / 180;
  const d = date.getTime() / 86400000 - 10957.5;
  const L = (280.46 + 0.9856474 * d) % 360;
  const g = ((357.528 + 0.9856003 * d) % 360) * rad;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
  const eps = 23.439 * rad;
  const sinDec = Math.sin(eps) * Math.sin(lambda);
  const cosDec = Math.cos(Math.asin(sinDec));
  const gmstDeg = (280.46061837 + 360.98564736629 * d) % 360;
  const lmst = (gmstDeg + lon) * rad;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const ha = lmst - ra;
  const sinAlt = Math.sin(lat * rad) * sinDec + Math.cos(lat * rad) * cosDec * Math.cos(ha);
  return Math.asin(sinAlt) / rad;
}

function renderPassRadar(pass, size = 68) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.42;

  const getCoords = (azDeg, elevDeg) => {
    const clampedElev = Math.max(0, Math.min(90, elevDeg));
    const dist = r * ((90 - clampedElev) / 90);
    const theta = (azDeg - 90) * (Math.PI / 180);
    return {
      x: (cx + dist * Math.cos(theta)).toFixed(1),
      y: (cy + dist * Math.sin(theta)).toFixed(1),
    };
  };

  const pStart = getCoords(pass.startAz, 10);
  const midAz = pass.maxElev >= 75 ? pass.startAz : (pass.startAz + pass.endAz) / 2;
  const pMax = getCoords(midAz, pass.maxElev);
  const pEnd = getCoords(pass.endAz, 10);

  const isGold = pass.quality === 'perfect';
  const strokeColor = isGold ? '#e8b54f' : '#4fd1e8';

  return `
    <svg class="radar-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="#070c18" stroke="#1d2942" stroke-width="1"/>
      <circle cx="${cx}" cy="${cy}" r="${(r * 0.5).toFixed(1)}" fill="none" stroke="#1d2942" stroke-width="0.8" stroke-dasharray="2 2"/>
      <line x1="${cx}" y1="${(cy - r).toFixed(1)}" x2="${cx}" y2="${(cy + r).toFixed(1)}" stroke="#1d2942" stroke-width="0.7"/>
      <line x1="${(cx - r).toFixed(1)}" y1="${cy}" x2="${(cx + r).toFixed(1)}" y2="${cy}" stroke="#1d2942" stroke-width="0.7"/>
      <circle cx="${cx}" cy="${cy}" r="1.5" fill="#4fd1e8" opacity="0.6"/>
      <text x="${cx}" y="${(cy - r - 2).toFixed(1)}" text-anchor="middle" fill="#e8b54f" font-size="7" font-weight="bold">N</text>
      <text x="${(cx + r + 5).toFixed(1)}" y="${(cy + 2.5).toFixed(1)}" text-anchor="middle" fill="#8a99b3" font-size="6.5">E</text>
      <text x="${cx}" y="${(cy + r + 8).toFixed(1)}" text-anchor="middle" fill="#8a99b3" font-size="6.5">S</text>
      <text x="${(cx - r - 5).toFixed(1)}" y="${(cy + 2.5).toFixed(1)}" text-anchor="middle" fill="#8a99b3" font-size="6.5">W</text>
      <path d="M ${pStart.x} ${pStart.y} Q ${pMax.x} ${pMax.y} ${pEnd.x} ${pEnd.y}" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round"/>
      <circle cx="${pStart.x}" cy="${pStart.y}" r="2" fill="#4ee08a"/>
      <circle cx="${pMax.x}" cy="${pMax.y}" r="3" fill="${strokeColor}"/>
      <circle cx="${pEnd.x}" cy="${pEnd.y}" r="2" fill="#ef4444"/>
    </svg>
  `;
}

let currentVisiblePasses = [];

function updatePassCountdown() {
  if (!els.issPassCountdown) return;
  if (!currentVisiblePasses || currentVisiblePasses.length === 0) {
    els.issPassCountdown.hidden = true;
    return;
  }

  const next = currentVisiblePasses[0];
  const nowMs = Date.now();
  const startMs = next.startTime.getTime();
  const endMs = next.endTime.getTime();

  if (nowMs >= startMs && nowMs <= endMs) {
    els.issPassCountdown.hidden = false;
    els.issPassCountdown.className = 'pass-countdown-banner happening';
    els.issPassCountdown.innerHTML = `
      <span>🔥 現在頭上を通過中！夜空を見上げてください！</span>
      <span style="font-weight:700;">最大仰角 ${next.maxElev}° (${next.maxCompass})</span>
    `;
    return;
  }

  const diff = startMs - nowMs;
  if (diff <= 0) {
    els.issPassCountdown.hidden = true;
    return;
  }

  els.issPassCountdown.hidden = false;
  els.issPassCountdown.className = 'pass-countdown-banner';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  let timeStr = '';
  if (days > 0) timeStr += `${days}日 `;
  timeStr += `${hours}時間 ${minutes}分 ${seconds}秒`;

  const nextIsTop = next.quality === 'perfect';
  const nextIsGreat = next.quality === 'great';
  let badgeSpan = '';
  if (nextIsTop) {
    badgeSpan = `<span class="pass-cd-tag perfect">★ 絶好の好条件</span>`;
  } else if (nextIsGreat) {
    badgeSpan = `<span class="pass-cd-tag great">見晴らし良好</span>`;
  }

  els.issPassCountdown.innerHTML = `
    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
      <span>⏱</span>
      <span style="color:var(--text-dim); font-size:11px;">次回可視通過まで:</span>
      <span class="pass-cd-val ${nextIsTop ? 'perfect' : ''}">${timeStr}</span>
      ${badgeSpan}
    </div>
    <div style="display:flex; align-items:center; gap:8px;">
      <span style="color:var(--text-dim); font-size:11px;">${next.dateStr} ${next.startStr}</span>
      <button class="btn-cd-ar" id="countdownArBtn" onclick="openARNavigator(0)">📱 空に向けて探す</button>
    </div>
  `;
}

let lastPassLat = null;
let lastPassLon = null;

async function loadISSPasses(lat, lon, cityName) {
  if (!els.issPassesList) return;

  if (els.issPassesLoc) {
    els.issPassesLoc.textContent = `📍 ${cityName || '現在地'} 付近`;
  }
  if (els.issHeavensLink) {
    els.issHeavensLink.href = `https://www.heavens-above.com/PassSummary.aspx?satid=25544&lat=${lat.toFixed(4)}&lng=${lon.toFixed(4)}&loc=${encodeURIComponent(cityName || 'My Location')}`;
  }

  // Avoid recalculating if coordinates haven't changed
  if (lastPassLat === lat && lastPassLon === lon) return;
  lastPassLat = lat;
  lastPassLon = lon;

  if (typeof window.satellite === 'undefined') {
    els.issPassesList.innerHTML = `
      <div class="pass-empty">
        <a href="${els.issHeavensLink?.href || '#'}" target="_blank" rel="noopener" class="link-heavens">Heavens-Aboveで可視パス予報を開く ↗</a>
      </div>
    `;
    return;
  }

  els.issPassesList.innerHTML = '<div class="pass-loading">軌道要素から可視パスを計算中...</div>';

  try {
    const tle = await getISSTLE();
    const sat = window.satellite;
    const satrec = sat.twoline2satrec(tle.line1, tle.line2);

    const rad = Math.PI / 180;
    const observerGd = {
      latitude: lat * rad,
      longitude: lon * rad,
      height: 0.05
    };

    const now = new Date();
    const stepSec = 25;
    const maxSteps = (14 * 24 * 3600) / stepSec;

    let inPass = false;
    let currentPass = null;
    const visiblePasses = [];

    for (let i = 0; i < maxSteps; i++) {
      const time = new Date(now.getTime() + i * stepSec * 1000);
      const pv = sat.propagate(satrec, time);
      if (!pv.position || typeof pv.position.x !== 'number') continue;

      const gmst = sat.gstime(time);
      const posEcf = sat.eciToEcf(pv.position, gmst);
      const look = sat.ecfToLookAngles(observerGd, posEcf);
      const elev = look.elevation * (180 / Math.PI);
      const az = look.azimuth * (180 / Math.PI);

      if (elev > 10) {
        if (!inPass) {
          inPass = true;
          currentPass = {
            start: time,
            maxElev: elev,
            maxElevTime: time,
            startAz: az,
            maxAz: az,
            end: time,
            endAz: az
          };
        } else if (currentPass) {
          if (elev > currentPass.maxElev) {
            currentPass.maxElev = elev;
            currentPass.maxElevTime = time;
            currentPass.maxAz = az;
          }
          currentPass.end = time;
          currentPass.endAz = az;
        }
      } else {
        if (inPass && currentPass) {
          inPass = false;
          if (currentPass.maxElev >= 15) {
            const sunAlt = getSunAltDeg(currentPass.maxElevTime, lat, lon);
            if (sunAlt <= -6 && sunAlt >= -36) {
              const maxElevDeg = Math.round(currentPass.maxElev);
              let quality = 'normal';
              let qualityLabel = '標準観測';
              if (maxElevDeg >= 60) {
                quality = 'perfect';
                qualityLabel = '絶好の観測チャンス';
              } else if (maxElevDeg >= 35) {
                quality = 'great';
                qualityLabel = '好条件';
              }

              visiblePasses.push({
                dateStr: currentPass.maxElevTime.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' }),
                startStr: currentPass.start.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
                endStr: currentPass.end.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
                maxElev: maxElevDeg,
                startCompass: azToCompass(currentPass.startAz),
                maxCompass: maxElevDeg >= 75 ? '天頂' : azToCompass(currentPass.maxAz),
                endCompass: azToCompass(currentPass.endAz),
                startAz: currentPass.startAz,
                maxAz: currentPass.maxAz,
                endAz: currentPass.endAz,
                startTime: currentPass.start,
                endTime: currentPass.end,
                durMin: Math.max(1, Math.round((currentPass.end.getTime() - currentPass.start.getTime()) / 60000)),
                quality,
                qualityLabel
              });

              if (visiblePasses.length >= 3) break;
            }
          }
          currentPass = null;
        }
      }
    }

    currentVisiblePasses = visiblePasses;
    updatePassCountdown();

    const hasPerfect = visiblePasses.some(p => p.quality === 'perfect');
    const hasGreat = visiblePasses.some(p => p.quality === 'great');

    // Update section container and notice badge
    if (els.issPassesBox) {
      els.issPassesBox.classList.toggle('has-perfect', hasPerfect);
      els.issPassesBox.classList.toggle('has-great', !hasPerfect && hasGreat);
    }
    if (els.issPassesNotice) {
      if (hasPerfect) {
        els.issPassesNotice.innerHTML = `<span class="pass-head-badge perfect">★ 絶好の好条件あり！</span>`;
      } else if (hasGreat) {
        els.issPassesNotice.innerHTML = `<span class="pass-head-badge great">✨ 好条件の通過あり</span>`;
      } else {
        els.issPassesNotice.innerHTML = '';
      }
    }

    if (visiblePasses.length === 0) {
      els.issPassesList.innerHTML = `
        <div class="pass-empty">
          今後14日以内に条件の良い可視通過がありません。<br>
          <a href="${els.issHeavensLink?.href || '#'}" target="_blank" rel="noopener" class="link-heavens">Heavens-Aboveで全期間を確認 ↗</a>
        </div>
      `;
      return;
    }

    els.issPassesList.innerHTML = visiblePasses.map((p, idx) => {
      const isTop = p.quality === 'perfect';
      const isGreat = p.quality === 'great';
      const badgeHtml = isTop
        ? `<span class="pass-badge perfect">★ 最大 ${p.maxElev}° (好条件)</span>`
        : isGreat
        ? `<span class="pass-badge great">最大 ${p.maxElev}° (良好)</span>`
        : `<span class="pass-badge">最大 ${p.maxElev}°</span>`;

      const qualityTagHtml = isTop
        ? `<div class="pass-quality-tag perfect">⭐ ${p.qualityLabel}</div>`
        : isGreat
        ? `<div class="pass-quality-tag great">✨ ${p.qualityLabel}</div>`
        : `<div class="pass-quality-tag">${p.qualityLabel}</div>`;

      return `
        <div class="pass-card ${p.quality}" onclick="openARNavigator(${idx})" title="タップしてスマホを空に向けるARナビを起動">
          <div class="pass-card-top">
            <span class="pass-date">${isTop ? '★ ' : ''}${p.dateStr}</span>
            ${badgeHtml}
          </div>
          <div class="pass-card-main">
            ${renderPassRadar(p, 64)}
            <div class="pass-info-col">
              <div class="pass-time">⏰ ${p.startStr} 〜 ${p.endStr}</div>
              ${qualityTagHtml}
              <div class="pass-dur">観測時間: 約${p.durMin}分間</div>
            </div>
          </div>
          <div class="pass-route">
            <span>🧭 ${p.startCompass} ↗ ${p.maxCompass} ↘ ${p.endCompass}</span>
            <span class="btn-card-ar">🧭 ARナビ</span>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('可視パス計算エラー:', err);
    els.issPassesList.innerHTML = `
      <div class="pass-empty">
        <a href="${els.issHeavensLink?.href || '#'}" target="_blank" rel="noopener" class="link-heavens">Heavens-Aboveで通過予報を見る ↗</a>
      </div>
    `;
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
        <span class="craft">${escapeHtml((p.country ? `${p.country} • ` : '') + (p.spacecraft || p.craft || 'ISS'))}</span>
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

function getLaunchTMinus(netStr) {
  if (!netStr) return null;
  const nowMs = Date.now();
  const targetMs = new Date(netStr).getTime();
  const diff = targetMs - nowMs;
  const isPast = diff < 0;
  const absDiff = Math.abs(diff);

  const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((absDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((absDiff % (1000 * 60)) / 1000);

  const sign = isPast ? 'T +' : 'T -';
  let formatted = `${sign} `;
  if (days > 0) formatted += `${days}d `;
  formatted += `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return {
    days,
    hours,
    minutes,
    seconds,
    isPast,
    isImminent: !isPast && days === 0 && hours < 24,
    formatted,
  };
}

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
  // Update Next Launch Hero Banner
  const nextL = allLaunches.find(l => l.net && new Date(l.net).getTime() > Date.now()) || allLaunches[0];
  if (nextL && nextL.net && els.nextLaunchHero) {
    const tm = getLaunchTMinus(nextL.net);
    if (tm) {
      els.nextLaunchHero.hidden = false;
      const netDate = new Date(nextL.net);
      const netStr = netDate.toLocaleString('ja-JP', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      const padName = nextL.pad?.location?.name || '';
      els.nextLaunchHero.innerHTML = `
        <div class="next-hero-info">
          <div class="next-hero-tag">
            <span class="next-tag-pill">NEXT MISSION</span>
            <span class="next-hero-provider">${escapeHtml(nextL.launch_service_provider?.name || 'Rocket Launch')}</span>
          </div>
          <div class="next-hero-title">${escapeHtml(nextL.name || '')}</div>
          <div class="next-hero-meta">
            <span>⏰ ${escapeHtml(netStr)}</span>
            ${padName ? `<span>📍 ${escapeHtml(padName)}</span>` : ''}
          </div>
        </div>
        <div class="next-timer-cluster">
          <div class="led-box">
            <span class="led-val" id="ledDays">${String(tm.days).padStart(2, '0')}</span>
            <span class="led-lbl">DAYS</span>
          </div>
          <span class="led-colon">:</span>
          <div class="led-box">
            <span class="led-val" id="ledHours">${String(tm.hours).padStart(2, '0')}</span>
            <span class="led-lbl">HOURS</span>
          </div>
          <span class="led-colon">:</span>
          <div class="led-box">
            <span class="led-val" id="ledMins">${String(tm.minutes).padStart(2, '0')}</span>
            <span class="led-lbl">MINS</span>
          </div>
          <span class="led-colon">:</span>
          <div class="led-box">
            <span class="led-val secs" id="ledSecs">${String(tm.seconds).padStart(2, '0')}</span>
            <span class="led-lbl">SECS</span>
          </div>
        </div>
      `;
    }
  }

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
    const tm = getLaunchTMinus(l.net);
    return `
      <div class="launch-item">
        <div>
          <div class="date">${escapeHtml(dateStr)}</div>
          <div class="name">${escapeHtml(l.name || '')}</div>
          <div class="meta">${escapeHtml(provider)}${pad ? ' ・ ' + escapeHtml(pad) : ''}</div>
        </div>
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          ${tm ? `<span class="launch-tminus ${tm.isImminent ? 'imminent' : ''}" data-net="${escapeHtml(l.net || '')}">${tm.formatted}</span>` : ''}
          <span class="agency-tag">${escapeHtml(provider || '未定')}</span>
        </div>
      </div>
    `;
  }).join('');
}

function tickSecond() {
  updatePassCountdown();

  // Update Next Launch Hero LED numbers if present
  if (els.nextLaunchHero && !els.nextLaunchHero.hidden) {
    const nextL = allLaunches.find(l => l.net && new Date(l.net).getTime() > Date.now()) || allLaunches[0];
    if (nextL?.net) {
      const tm = getLaunchTMinus(nextL.net);
      if (tm) {
        const elDays = document.getElementById('ledDays');
        const elHours = document.getElementById('ledHours');
        const elMins = document.getElementById('ledMins');
        const elSecs = document.getElementById('ledSecs');
        if (elDays) elDays.textContent = String(tm.days).padStart(2, '0');
        if (elHours) elHours.textContent = String(tm.hours).padStart(2, '0');
        if (elMins) elMins.textContent = String(tm.minutes).padStart(2, '0');
        if (elSecs) elSecs.textContent = String(tm.seconds).padStart(2, '0');
      }
    }
  }

  // Update launch item pill countdowns
  document.querySelectorAll('.launch-tminus[data-net]').forEach(el => {
    const net = el.getAttribute('data-net');
    if (net) {
      const tm = getLaunchTMinus(net);
      if (tm) {
        el.textContent = tm.formatted;
        if (tm.isImminent) el.classList.add('imminent');
        else el.classList.remove('imminent');
      }
    }
  });
}
setInterval(tickSecond, 1000);

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
  if (els.skyLocCity) els.skyLocCity.textContent = userLocation.city || '現在地';
  if (els.skyLocCoords) els.skyLocCoords.textContent = `(${userLocation.lat.toFixed(2)}°, ${userLocation.lon.toFixed(2)}°)`;
  if (els.skyLocBadge) {
    if (userLocation.isAuto) {
      els.skyLocBadge.textContent = '📍 GPS取得完了';
      els.skyLocBadge.classList.add('active-pill');
    } else {
      els.skyLocBadge.textContent = '📍 現在地 (設定中)';
      els.skyLocBadge.classList.remove('active-pill');
    }
  }
  if (els.skyStarlinkBtn) {
    els.skyStarlinkBtn.href = `https://www.heavens-above.com/StarlinkLaunchPasses.aspx?lat=${userLocation.lat.toFixed(4)}&lng=${userLocation.lon.toFixed(4)}&loc=${encodeURIComponent(userLocation.city || 'My Location')}`;
  }
  if (els.skyIssBtn) {
    els.skyIssBtn.href = `https://www.heavens-above.com/PassSummary.aspx?satid=25544&lat=${userLocation.lat.toFixed(4)}&lng=${userLocation.lon.toFixed(4)}&loc=${encodeURIComponent(userLocation.city || 'My Location')}`;
  }

  // Update ISS visible passes for user location
  loadISSPasses(userLocation.lat, userLocation.lon, userLocation.city);
}

async function acquireLocation(silent = false) {
  if (!('geolocation' in navigator)) {
    updateCelestialUI();
    return;
  }

  if (els.celestialLoc) els.celestialLoc.textContent = '📍 取得中...';
  if (els.skyLocBadge) els.skyLocBadge.textContent = '📍 GPS取得中...';

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

/* ---------------- 銀河星空キャンバス ---------------- */
function initGalaxyCanvas() {
  const canvas = document.getElementById('galaxyCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    initStars();
  });

  const starCount = Math.floor((width * height) / 4500);
  let stars = [];
  const colors = ['#ffffff', '#eef2ff', '#dbeafe', '#fef08a', '#e0e7ff', '#c7d2fe', '#a5f3fc'];

  function initStars() {
    stars = [];
    for (let i = 0; i < starCount; i++) {
      const baseAlpha = Math.random() * 0.7 + 0.3;
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() < 0.85 ? Math.random() * 1.4 + 0.5 : Math.random() * 2.2 + 1.2,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: baseAlpha,
        baseAlpha: baseAlpha,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        twinkleOffset: Math.random() * Math.PI * 2,
      });
    }
  }
  initStars();

  const dustCount = 80;
  const dustParticles = [];
  const maxRadius = Math.max(width, height) * 0.75;
  for (let i = 0; i < dustCount; i++) {
    const radius = Math.pow(Math.random(), 0.7) * maxRadius;
    dustParticles.push({
      radius: radius,
      angle: Math.random() * Math.PI * 2,
      speed: (0.00015 + (1 - radius / maxRadius) * 0.0002),
      size: Math.random() * 2.5 + 1.0,
      color: i % 3 === 0 ? 'rgba(232, 181, 79, ' : i % 3 === 1 ? 'rgba(79, 209, 232, ' : 'rgba(192, 132, 252, ',
      alpha: Math.random() * 0.4 + 0.2,
    });
  }

  let time = 0;
  function render() {
    time++;
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const a = s.baseAlpha * (0.6 + 0.4 * Math.sin(time * s.twinkleSpeed + s.twinkleOffset));
      ctx.fillStyle = s.color;
      ctx.globalAlpha = Math.max(0.1, Math.min(1, a));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }

    const cx = width * 0.5;
    const cy = height * 0.42;
    for (let i = 0; i < dustParticles.length; i++) {
      const d = dustParticles[i];
      d.angle += d.speed;
      const x = cx + Math.cos(d.angle) * d.radius;
      const y = cy + Math.sin(d.angle) * (d.radius * 0.45);
      ctx.fillStyle = `${d.color}${d.alpha})`;
      ctx.globalAlpha = d.alpha;
      ctx.beginPath();
      ctx.arc(x, y, d.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    requestAnimationFrame(render);
  }
  render();
}

/* ==========================================================
   ISS AR Sky Navigator Engine (v1.4)
   スマホを空に向けてISSの位置を探すARナビゲーション
   ========================================================== */
const arState = {
  active: false,
  passIndex: 0,
  phase: 'peak', // 'peak' | 'start' | 'end'
  azimuth: 0,    // 0=N, 90=E, 180=S, 270=W
  pitch: 45,     // 0=horizon, 90=zenith
  manualMode: false,
  cameraActive: false,
  soundEnabled: true,
  mediaStream: null,
  audioCtx: null,
  lastBeep: 0,
  animId: null,
  dragStart: null,
};

function playLockBeepSound() {
  if (!arState.soundEnabled) return;
  try {
    if (!arState.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) arState.audioCtx = new AudioContextClass();
    }
    const ctx = arState.audioCtx;
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch (e) {
    // Audio context failed or blocked
  }
}

function getARTargetCoords() {
  const pass = currentVisiblePasses[arState.passIndex];
  if (!pass) return { az: 180, elev: 45, label: '天頂付近', time: '' };

  if (arState.phase === 'start') {
    return {
      az: Math.round(pass.startAz),
      elev: 10,
      label: `出現点 (${pass.startCompass})`,
      time: pass.startStr || '',
    };
  }
  if (arState.phase === 'end') {
    return {
      az: Math.round(pass.endAz),
      elev: 10,
      label: `消滅点 (${pass.endCompass})`,
      time: pass.endStr || '',
    };
  }
  // 'peak'
  const peakAz = pass.maxElev >= 75 ? pass.startAz : Math.round((pass.startAz + pass.endAz) / 2);
  return {
    az: Math.round(peakAz),
    elev: pass.maxElev,
    label: `最大仰角 (${pass.maxCompass} ${pass.maxElev}°)`,
    time: pass.dateStr || '',
  };
}

function updateARGuidance() {
  if (!arState.active) return;
  const pass = currentVisiblePasses[arState.passIndex];
  const target = getARTargetCoords();

  // Angle difference
  const deltaAz = ((target.az - arState.azimuth + 540) % 360) - 180;
  const deltaElev = target.elev - arState.pitch;
  const isLocked = Math.abs(deltaAz) <= 7 && Math.abs(deltaElev) <= 7;

  // Angles text
  if (els.arAnglesText) {
    els.arAnglesText.innerHTML = `
      <span>スマホ向き: ${arState.azimuth}°</span>
      <span>仰角: ${arState.pitch}°</span>
    `;
  }

  // Guidance card and text
  if (els.arGuidanceCard && els.arInstructionsText) {
    if (isLocked) {
      els.arGuidanceCard.classList.add('locked');
      els.arCompassIcon.textContent = '🎯';
      els.arInstructionsText.innerHTML = `
        <span class="ar-inst-locked">ロックオン！ この方角・高さにISSが見えます！</span>
      `;
      const now = Date.now();
      if (now - arState.lastBeep > 1800) {
        arState.lastBeep = now;
        playLockBeepSound();
        if (navigator.vibrate) navigator.vibrate([60, 40, 100]);
      }
    } else {
      els.arGuidanceCard.classList.remove('locked');
      els.arCompassIcon.textContent = '🧭';

      let hStr = '';
      if (deltaAz > 5) {
        hStr = `<span class="ar-badge-inst right">👉 もっと右へ (${Math.abs(Math.round(deltaAz))}°)</span>`;
      } else if (deltaAz < -5) {
        hStr = `<span class="ar-badge-inst left">👈 もっと左へ (${Math.abs(Math.round(deltaAz))}°)</span>`;
      } else {
        hStr = `<span class="ar-badge-inst match">↔ 方角一致</span>`;
      }

      let vStr = '';
      if (deltaElev > 5) {
        vStr = `<span class="ar-badge-inst up">👆 もっと上へ (${Math.abs(Math.round(deltaElev))}°)</span>`;
      } else if (deltaElev < -5) {
        vStr = `<span class="ar-badge-inst down">👇 もっと下へ (${Math.abs(Math.round(deltaElev))}°)</span>`;
      } else {
        vStr = `<span class="ar-badge-inst match">↕ 仰角一致</span>`;
      }

      els.arInstructionsText.innerHTML = `${hStr} ${vStr}`;
    }
  }

  // Projection FOV
  const fovH = 60;
  const fovV = 50;
  const inFov = Math.abs(deltaAz) <= fovH / 2 && Math.abs(deltaElev) <= fovV / 2;

  if (inFov) {
    if (els.arTargetMarker) {
      els.arTargetMarker.hidden = false;
      const pctX = 50 + (deltaAz / (fovH / 2)) * 45;
      const pctY = 50 - (deltaElev / (fovV / 2)) * 45;
      els.arTargetMarker.style.left = `${pctX}%`;
      els.arTargetMarker.style.top = `${pctY}%`;
      if (isLocked) {
        els.arTargetMarker.classList.add('locked');
      } else {
        els.arTargetMarker.classList.remove('locked');
      }
    }
    if (els.arTargetSub) {
      els.arTargetSub.textContent = `${target.label} (方角 ${target.az}° / 仰角 ${target.elev}°)`;
    }
    if (els.arOffscreenWrap) {
      els.arOffscreenWrap.hidden = true;
    }
  } else {
    if (els.arTargetMarker) els.arTargetMarker.hidden = true;
    if (els.arOffscreenWrap && els.arOffscreenArrow) {
      els.arOffscreenWrap.hidden = false;
      const rad = Math.atan2(-deltaElev, deltaAz);
      const deg = (rad * 180) / Math.PI;
      els.arOffscreenArrow.style.transform = `rotate(${deg}deg) translateX(min(38vw, 150px)) rotate(${-deg}deg)`;
    }
  }
}

function renderARCanvas() {
  if (!arState.active || arState.cameraActive) return;
  const canvas = els.arCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
  const h = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

  // Background Sky Gradient based on pitch
  const horizonY = h / 2 + (arState.pitch / 90) * (h * 0.6);
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#040711');
  grad.addColorStop(0.65, '#0b162a');
  grad.addColorStop(1, '#142542');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Stars
  ctx.save();
  for (let i = 0; i < 50; i++) {
    const starAz = (i * 37) % 360;
    const starElev = (i * 23) % 85 + 5;
    const sDeltaAz = ((starAz - arState.azimuth + 540) % 360) - 180;
    const sDeltaElev = starElev - arState.pitch;

    if (Math.abs(sDeltaAz) < 50 && Math.abs(sDeltaElev) < 40) {
      const sx = w / 2 + (sDeltaAz / 50) * (w / 2);
      const sy = h / 2 - (sDeltaElev / 40) * (h / 2);
      ctx.beginPath();
      ctx.arc(sx, sy, (i % 3 === 0 ? 2 : 1.2), 0, Math.PI * 2);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 255, 255, 0.85)' : 'rgba(180, 220, 255, 0.7)';
      ctx.shadowBlur = 4;
      ctx.shadowColor = '#fff';
      ctx.fill();
    }
  }
  ctx.restore();

  // Horizon Line
  if (horizonY > 0 && horizonY < h) {
    ctx.strokeStyle = 'rgba(78, 224, 138, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(w, horizonY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Ground shading
    const groundGrad = ctx.createLinearGradient(0, horizonY, 0, h);
    groundGrad.addColorStop(0, 'rgba(5, 10, 18, 0.5)');
    groundGrad.addColorStop(1, 'rgba(2, 5, 10, 0.95)');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, horizonY, w, h - horizonY);

    ctx.fillStyle = 'rgba(78, 224, 138, 0.7)';
    ctx.font = '10px monospace';
    ctx.fillText('地平線 (0°)', 12, horizonY - 6);
  }

  // Compass Cardinal Directions on Horizon
  const cardinals = [
    { deg: 0, label: '北 (N)' },
    { deg: 45, label: '北東 (NE)' },
    { deg: 90, label: '東 (E)' },
    { deg: 135, label: '南東 (SE)' },
    { deg: 180, label: '南 (S)' },
    { deg: 225, label: '南西 (SW)' },
    { deg: 270, label: '西 (W)' },
    { deg: 315, label: '北西 (NW)' },
  ];

  cardinals.forEach(({ deg, label }) => {
    const cDeltaAz = ((deg - arState.azimuth + 540) % 360) - 180;
    if (Math.abs(cDeltaAz) < 50) {
      const cx = w / 2 + (cDeltaAz / 50) * (w / 2);
      const cy = horizonY > 0 && horizonY < h ? horizonY : h - 30;
      ctx.fillStyle = deg % 90 === 0 ? '#4fd1e8' : 'rgba(238, 242, 248, 0.6)';
      ctx.font = deg % 90 === 0 ? 'bold 12px sans-serif' : '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, cx, cy + 18);
      ctx.beginPath();
      ctx.moveTo(cx, cy - 4);
      ctx.lineTo(cx, cy + 4);
      ctx.strokeStyle = '#4fd1e8';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  });

  // Pass Orbit Arc
  const pass = currentVisiblePasses[arState.passIndex];
  if (pass) {
    ctx.save();
    ctx.strokeStyle = 'rgba(232, 181, 79, 0.4)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();

    const samples = 20;
    let started = false;
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const curAz = pass.startAz + (pass.endAz - pass.startAz) * t;
      const curElev = 10 + Math.sin(t * Math.PI) * (pass.maxElev - 10);

      const pDeltaAz = ((curAz - arState.azimuth + 540) % 360) - 180;
      const pDeltaElev = curElev - arState.pitch;

      const px = w / 2 + (pDeltaAz / 50) * (w / 2);
      const py = h / 2 - (pDeltaElev / 40) * (h / 2);

      if (!started) {
        ctx.moveTo(px, py);
        started = true;
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
    ctx.restore();
  }
}

function loopAR() {
  if (!arState.active) return;
  updateARGuidance();
  renderARCanvas();
  arState.animId = requestAnimationFrame(loopAR);
}

function handleOrientation(e) {
  if (!arState.active || arState.manualMode) return;

  // Heading (Azimuth)
  let heading = 0;
  if (typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading)) {
    heading = e.webkitCompassHeading;
  } else if (e.alpha !== null && !isNaN(e.alpha)) {
    heading = (360 - e.alpha) % 360;
  }

  // Pitch (Elevation)
  let pitch = 45;
  if (e.beta !== null && !isNaN(e.beta)) {
    pitch = Math.max(-20, Math.min(90, 90 - e.beta));
  }

  arState.azimuth = Math.round(heading);
  arState.pitch = Math.round(pitch);
}

async function requestARSensorPermission() {
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res === 'granted') {
        if (els.arSensorPrompt) els.arSensorPrompt.hidden = true;
        arState.manualMode = false;
      } else {
        arState.manualMode = true;
      }
    }
  } catch (err) {
    console.warn('Orientation permission error:', err);
    arState.manualMode = true;
  }
}

async function startARCamera() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('お使いの環境はカメラアクセスに対応していません');
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
    arState.mediaStream = stream;
    if (els.arVideo) {
      els.arVideo.srcObject = stream;
      els.arVideo.hidden = false;
      els.arVideo.play();
    }
    arState.cameraActive = true;
    if (els.arCamBtn) els.arCamBtn.classList.add('active');
    if (els.arCamText) els.arCamText.textContent = '夜空HUD';
    if (els.arCanvas) els.arCanvas.style.opacity = '0.35'; // Keep HUD overlay visible over camera
  } catch (err) {
    console.warn('Camera failed:', err);
    alert('カメラの起動に失敗しました（夜空HUDモードで動作します）');
    stopARCamera();
  }
}

function stopARCamera() {
  if (arState.mediaStream) {
    arState.mediaStream.getTracks().forEach(t => t.stop());
    arState.mediaStream = null;
  }
  if (els.arVideo) {
    els.arVideo.srcObject = null;
    els.arVideo.hidden = true;
  }
  arState.cameraActive = false;
  if (els.arCamBtn) els.arCamBtn.classList.remove('active');
  if (els.arCamText) els.arCamText.textContent = 'AR実景';
  if (els.arCanvas) els.arCanvas.style.opacity = '1';
}

function renderARPassTabs() {
  if (!els.arPassTabs) return;
  els.arPassTabs.innerHTML = currentVisiblePasses.map((p, idx) => `
    <button class="ar-pass-tab ${arState.passIndex === idx ? 'active' : ''}" onclick="selectARPass(${idx})">
      #${idx + 1} ${p.dateStr} (${p.maxElev}°)
    </button>
  `).join('');
}

window.selectARPass = function(idx) {
  arState.passIndex = idx;
  renderARPassTabs();
  const pass = currentVisiblePasses[idx];
  if (els.arPassSummary && pass) {
    els.arPassSummary.textContent = `${pass.dateStr} 最大仰角 ${pass.maxElev}° (${pass.qualityLabel})`;
  }
};

window.openARNavigator = function(passIndex = 0) {
  if (!els.arNavModal) return;
  arState.active = true;
  arState.passIndex = passIndex;
  els.arNavModal.hidden = false;
  document.body.style.overflow = 'hidden';

  renderARPassTabs();
  selectARPass(passIndex);

  // Check iOS permission requirement
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    if (els.arSensorPrompt) els.arSensorPrompt.hidden = false;
  } else {
    if (els.arSensorPrompt) els.arSensorPrompt.hidden = true;
  }

  window.addEventListener('deviceorientationabsolute', handleOrientation, true);
  window.addEventListener('deviceorientation', handleOrientation, true);

  cancelAnimationFrame(arState.animId);
  loopAR();
};

window.closeARNavigator = function() {
  if (!els.arNavModal) return;
  arState.active = false;
  stopARCamera();
  els.arNavModal.hidden = true;
  document.body.style.overflow = '';
  window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
  window.removeEventListener('deviceorientation', handleOrientation, true);
  cancelAnimationFrame(arState.animId);
};

// Setup AR Touch / Mouse Drag for Manual Mode & Fallback
if (els.arViewport) {
  const onDragStart = (cx, cy) => {
    arState.dragStart = { x: cx, y: cy, az: arState.azimuth, pt: arState.pitch };
  };
  const onDragMove = (cx, cy) => {
    if (!arState.dragStart) return;
    const dx = cx - arState.dragStart.x;
    const dy = cy - arState.dragStart.y;
    arState.azimuth = Math.round((arState.dragStart.az - dx * 0.3 + 360) % 360);
    arState.pitch = Math.round(Math.max(-10, Math.min(90, arState.dragStart.pt + dy * 0.3)));
  };
  const onDragEnd = () => {
    arState.dragStart = null;
  };

  els.arViewport.addEventListener('mousedown', (e) => onDragStart(e.clientX, e.clientY));
  window.addEventListener('mousemove', (e) => onDragMove(e.clientX, e.clientY));
  window.addEventListener('mouseup', onDragEnd);

  els.arViewport.addEventListener('touchstart', (e) => {
    if (e.touches[0]) onDragStart(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  els.arViewport.addEventListener('touchmove', (e) => {
    if (e.touches[0]) onDragMove(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  els.arViewport.addEventListener('touchend', onDragEnd);
}

// AR UI Control Listeners
els.openArBtn?.addEventListener('click', () => openARNavigator(0));
els.arCloseBtn?.addEventListener('click', closeARNavigator);
els.arSensorPermBtn?.addEventListener('click', requestARSensorPermission);

els.arCamBtn?.addEventListener('click', () => {
  if (arState.cameraActive) {
    stopARCamera();
  } else {
    startARCamera();
  }
});

els.arSoundBtn?.addEventListener('click', () => {
  arState.soundEnabled = !arState.soundEnabled;
  if (els.arSoundBtn) {
    els.arSoundBtn.textContent = arState.soundEnabled ? '🔊' : '🔇';
  }
});

els.arHelpBtn?.addEventListener('click', () => {
  if (els.arHelpModalOverlay) els.arHelpModalOverlay.hidden = false;
});
els.arHelpModalClose?.addEventListener('click', () => {
  if (els.arHelpModalOverlay) els.arHelpModalOverlay.hidden = true;
});
els.arHelpConfirmBtn?.addEventListener('click', () => {
  if (els.arHelpModalOverlay) els.arHelpModalOverlay.hidden = true;
});

// Phase Selector
document.querySelectorAll('.ar-phase-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.ar-phase-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    arState.phase = btn.dataset.phase || 'peak';
    updateARGuidance();
  });
});

// Mode Toggle (Sensor vs Drag)
els.arModeToggle?.addEventListener('click', () => {
  arState.manualMode = !arState.manualMode;
  if (els.arModeToggle) {
    els.arModeToggle.textContent = arState.manualMode ? '👆 画面ドラッグ操作中' : '🧭 センサー連動中';
    els.arModeToggle.classList.toggle('manual', arState.manualMode);
  }
  if (els.arSnapBtn) {
    els.arSnapBtn.hidden = !arState.manualMode;
  }
});

els.arSnapBtn?.addEventListener('click', () => {
  const target = getARTargetCoords();
  arState.azimuth = target.az;
  arState.pitch = target.elev;
  updateARGuidance();
});

/* ---------------- 初期化 ---------------- */
els.refreshBtn?.addEventListener('click', loadISS);

loadISS();
loadCrew();
loadLaunches();
renderMeteors();
updateCelestialUI();
acquireLocation(true); // ページを開いたときに現在地を自動取得
initGalaxyCanvas(); // ゆっくり動く銀河キャンバスの初期化

setInterval(loadISS, 5000);
setInterval(updateCelestialUI, 60 * 1000); // 1分ごとに太陽・月情報を更新

