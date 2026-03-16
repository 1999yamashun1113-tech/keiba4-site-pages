const state = {
  mode: 'public',
  selectedRaceKey: null,
  payloads: null,
};

const siteConfig = window.SITE_CONFIG || {
  mode: 'server',
  dataBase: '/api/site-payload',
  premiumEnabled: true,
  showSourcePath: false,
};

const els = {
  heroProof: document.getElementById('heroProof'),
  proofHeadline: document.getElementById('proofHeadline'),
  proofNote: document.getElementById('proofNote'),
  proofGrid: document.getElementById('proofGrid'),
  raceDate: document.getElementById('raceDate'),
  generatedAt: document.getElementById('generatedAt'),
  raceCount: document.getElementById('raceCount'),
  summaryCardPublic: document.getElementById('summaryCardPublic'),
  summaryCardPremium: document.getElementById('summaryCardPremium'),
  publicPickTotal: document.getElementById('publicPickTotal'),
  premiumPickTotal: document.getElementById('premiumPickTotal'),
  ticketTotal: document.getElementById('ticketTotal'),
  modeSwitch: document.getElementById('modeSwitch'),
  modePublic: document.getElementById('modePublic'),
  modePremium: document.getElementById('modePremium'),
  refreshButton: document.getElementById('refreshButton'),
  statusText: document.getElementById('statusText'),
  featuredPickCard: document.getElementById('featuredPickCard'),
  featuredTicketCard: document.getElementById('featuredTicketCard'),
  raceNav: document.getElementById('raceNav'),
  raceDetail: document.getElementById('raceDetail'),
  lastRefreshAt: document.getElementById('lastRefreshAt'),
  chipTemplate: document.getElementById('raceChipTemplate'),
};

let refreshTimer = null;

function api(path) {
  return fetch(path, { headers: { Accept: 'application/json' } }).then(async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data && data.message ? data.message : `request failed: ${response.status}`;
      throw new Error(message);
    }
    return data;
  });
}

function dataPath(kind) {
  if (siteConfig.mode === 'static') {
    return `${siteConfig.dataBase}/${kind}.json`;
  }
  const serverNames = {
    public_payload: 'public',
    premium_payload: 'premium',
    summary: 'summary',
    run_info: 'run-info',
  };
  return `${siteConfig.dataBase}/${serverNames[kind] || kind}`;
}

function formatTimestamp(value) {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  }).format(date);
}

function formatRaceDate(value) {
  const token = String(value || '').trim();
  if (!/^\d{8}$/.test(token)) {
    return value || '-';
  }
  return `${token.slice(0, 4)}/${token.slice(4, 6)}/${token.slice(6, 8)}`;
}

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-';
  }
  return Number(value).toFixed(digits);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function betTypeLabel(betType) {
  const labels = {
    wide: 'ワイド',
    sanrenpuku: '三連複',
  };
  return labels[betType] || betType || '-';
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-';
  }
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function parseTicketCombo(ticket) {
  const combo = String(ticket?.combo || '').trim();
  if (!combo) {
    return [];
  }
  if (combo.includes('-') || combo.includes(' ') || combo.includes('/')) {
    return Array.from(combo.matchAll(/\d+/g), (match) => Number(match[0])).filter((horseNum) => horseNum > 0);
  }
  if (/^\d+$/.test(combo)) {
    const expectedCount = { wide: 2, sanrenpuku: 3 }[ticket?.bet_type] || 0;
    if (expectedCount > 0 && combo.length === expectedCount * 2) {
      const vals = [];
      for (let idx = 0; idx < combo.length; idx += 2) {
        vals.push(Number(combo.slice(idx, idx + 2)));
      }
      return vals.filter((horseNum) => horseNum > 0);
    }
  }
  return [];
}

function ticketHorses(ticket, racePicks = []) {
  if (Array.isArray(ticket?.horses) && ticket.horses.length) {
    return ticket.horses;
  }
  const nameMap = new Map((racePicks || []).map((pick) => [pick.horse_num, pick.horse_name]));
  return parseTicketCombo(ticket).map((horseNum) => {
    const horse = { horse_num: horseNum };
    const horseName = nameMap.get(horseNum);
    if (horseName) {
      horse.horse_name = horseName;
    }
    return horse;
  });
}

function ticketHorseLabel(ticket, racePicks = []) {
  const horses = ticketHorses(ticket, racePicks);
  if (!horses.length) {
    return ticket.combo || '-';
  }
  return horses
    .map((horse) => horse.horse_name || `馬番 ${horse.horse_num}`)
    .join(' × ');
}

function ticketHorseMeta(ticket, racePicks = []) {
  const horses = ticketHorses(ticket, racePicks);
  if (!horses.length) {
    return ticket.combo || '-';
  }
  return horses
    .map((horse) => (horse.horse_name ? `${horse.horse_num} ${horse.horse_name}` : `馬番 ${horse.horse_num}`))
    .join(' / ');
}

function formatRaceLabel(race) {
  const raceNum = race.meta?.race_num ? `R${race.meta.race_num}` : race.race_key;
  const start = race.meta?.start_time ? `${race.meta.start_time.slice(0, 2)}:${race.meta.start_time.slice(2, 4)}` : '時刻未定';
  return { title: raceNum, meta: start };
}

function getRaceByKey(payload, raceKey) {
  if (!payload) {
    return null;
  }
  return payload.races.find((race) => race.race_key === raceKey) || null;
}

function renderMarketingProof() {
  const proof = siteConfig.marketingProof;
  if (!proof || !Array.isArray(proof.strategies) || !proof.strategies.length) {
    els.heroProof.hidden = true;
    return;
  }
  els.heroProof.hidden = false;
  els.proofHeadline.textContent = proof.headline || '検証実績';
  els.proofNote.textContent = proof.note || '';
  els.proofGrid.innerHTML = proof.strategies
    .map(
      (strategy) => `
        <article class="proof-card">
          <span class="proof-label">${escapeHtml(strategy.label || betTypeLabel(strategy.betType))}</span>
          <strong>${escapeHtml(formatPercent(strategy.roi))}</strong>
          <p>${escapeHtml(proof.validationLabel || '')} / ${escapeHtml(String(strategy.ticketCount || 0))}件</p>
        </article>
      `,
    )
    .join('');
}

function renderSummary(summary, publicPayload, premiumPayload) {
  const publicPickTotal = publicPayload.races.reduce((sum, race) => sum + race.picks.length, 0);
  const premiumBase = premiumPayload || publicPayload;
  const premiumPickTotal = premiumBase.races.reduce((sum, race) => sum + race.picks.length, 0);
  const ticketTotal = publicPayload.races.reduce((sum, race) => sum + race.tickets.length, 0);

  els.raceDate.textContent = formatRaceDate(summary.race_date);
  els.generatedAt.textContent = formatTimestamp(summary.generated_at_utc);
  els.raceCount.textContent = String(summary.public_race_count || 0);
  els.publicPickTotal.textContent = String(publicPickTotal);
  els.premiumPickTotal.textContent = siteConfig.premiumEnabled ? String(premiumPickTotal) : 'hidden';
  els.ticketTotal.textContent = String(ticketTotal);
  els.summaryCardPremium.hidden = !siteConfig.premiumEnabled;
  els.modeSwitch.hidden = !siteConfig.premiumEnabled;
  els.modePremium.hidden = !siteConfig.premiumEnabled;
  els.lastRefreshAt.textContent = new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Tokyo',
  }).format(new Date());
}

function topPickFrom(payload) {
  const picks = payload.races.flatMap((race) =>
    race.picks.map((pick) => ({
      ...pick,
      race_key: race.race_key,
      race_num: race.meta?.race_num || race.race_key,
      race_name: race.meta?.race_name || '',
    })),
  );
  picks.sort((left, right) => Number(right.pred_score) - Number(left.pred_score));
  return picks[0] || null;
}

function topTicketFrom(payload) {
  const tickets = payload.races.flatMap((race) =>
    race.tickets.map((ticket) => ({
      ...ticket,
      race_key: race.race_key,
      race_num: race.meta?.race_num || race.race_key,
      race_name: race.meta?.race_name || '',
      race_picks: race.picks,
    })),
  );
  tickets.sort((left, right) => Number(right.ev_est) - Number(left.ev_est));
  return tickets[0] || null;
}

function renderFeaturedCards() {
  if (!state.payloads) {
    return;
  }
  const current = state.payloads[state.mode] || state.payloads.public;
  const featuredPick = topPickFrom(current);
  const featuredTicket = topTicketFrom(state.payloads.public);

  if (featuredPick) {
    els.featuredPickCard.innerHTML = `
      <p class="eyebrow">注目馬</p>
      <h2>${escapeHtml(featuredPick.horse_name || `馬番 ${featuredPick.horse_num}`)}</h2>
      <p class="feature-copy">
        ${escapeHtml(`R${featuredPick.race_num}`)}
        ${featuredPick.race_name ? ` ${escapeHtml(featuredPick.race_name)}` : ''}
      </p>
      <p class="feature-copy">注目度 ${formatNumber(featuredPick.pred_score, 3)} / 複勝オッズ ${formatNumber(featuredPick.odds_place, 1)}</p>
    `;
  }

  if (featuredTicket) {
    els.featuredTicketCard.innerHTML = `
      <p class="eyebrow">注目馬券</p>
      <h2>${escapeHtml(ticketHorseLabel(featuredTicket, featuredTicket.race_picks))}</h2>
      <p class="feature-copy">R${escapeHtml(featuredTicket.race_num)} / ${escapeHtml(betTypeLabel(featuredTicket.bet_type))}</p>
      <p class="feature-copy">${escapeHtml(ticketHorseMeta(featuredTicket, featuredTicket.race_picks))}</p>
      <p class="feature-copy">期待値 ${formatNumber(featuredTicket.ev_est, 2)} / 想定オッズ ${formatNumber(featuredTicket.est_odds, 1)}</p>
    `;
  } else {
    els.featuredTicketCard.innerHTML = `
      <p class="eyebrow">注目馬券</p>
      <h2>公開中の候補はありません</h2>
      <p class="feature-copy">現在の公開データでは、馬券候補の表示対象がありません。</p>
    `;
  }
}

function renderRaceNav() {
  const payload = state.payloads[state.mode] || state.payloads.public;
  els.raceNav.innerHTML = '';

  payload.races.forEach((race) => {
    const node = els.chipTemplate.content.firstElementChild.cloneNode(true);
    const label = formatRaceLabel(race);
    node.querySelector('.race-chip-num').textContent = label.title;
    node.querySelector('.race-chip-meta').textContent = label.meta;
    if (race.race_key === state.selectedRaceKey) {
      node.classList.add('is-active');
    }
    node.addEventListener('click', () => {
      state.selectedRaceKey = race.race_key;
      renderRaceNav();
      renderRaceDetail();
    });
    els.raceNav.appendChild(node);
  });
}

function renderMetaPills(race, comparisonRace) {
  const pills = [
    ['レースID', race.race_key],
    ['発走', race.meta?.start_time ? `${race.meta.start_time.slice(0, 2)}:${race.meta.start_time.slice(2, 4)}` : '-'],
    ['距離', race.meta?.distance ? `${race.meta.distance}m` : '-'],
    ['コース', race.meta?.track_type ?? '-'],
    ['頭数', race.meta?.headcount ?? '-'],
  ];

  return pills
    .map(
      ([label, value]) => `
        <article class="meta-pill">
          <span class="meta-label">${label}</span>
          <strong class="meta-value">${value}</strong>
        </article>
      `,
    )
    .join('');
}

function renderPickRow(pick) {
  return `
    <div class="pick-row">
      <div><span class="rank-badge">${pick.rank}</span></div>
      <div>
        <div class="horse-main">${pick.horse_name || 'horse name unavailable'}</div>
        <div class="horse-sub">馬番 ${pick.horse_num}</div>
      </div>
      <div><span class="pick-cell-muted">注目度</span><br />${formatNumber(pick.pred_score, 3)}</div>
      <div><span class="pick-cell-muted">期待値</span><br />${formatNumber(pick.pred_ev_place, 3)}</div>
      <div><span class="pick-cell-muted">単勝</span><br />${formatNumber(pick.odds_win, 1)}</div>
      <div><span class="pick-cell-muted">複勝</span><br />${formatNumber(pick.odds_place, 1)}</div>
    </div>
  `;
}

function renderTickets(tickets, racePicks = []) {
  if (!tickets.length) {
    return '<div class="empty-state">このレースでは公開中の馬券候補がありません。</div>';
  }
  return `
    <div class="ticket-list">
      ${tickets
        .map(
          (ticket) => `
            <article class="ticket-card">
              <small>${escapeHtml(betTypeLabel(ticket.bet_type))}</small>
              <strong>${escapeHtml(ticketHorseLabel(ticket, racePicks))}</strong>
              <p>${escapeHtml(ticketHorseMeta(ticket, racePicks))}</p>
              <div class="ticket-metrics">
                <span>期待値 ${formatNumber(ticket.ev_est, 2)}</span>
                <span>想定オッズ ${formatNumber(ticket.est_odds, 1)}</span>
              </div>
            </article>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderRaceDetail() {
  const payload = state.payloads[state.mode] || state.payloads.public;
  const comparisonPayload = state.mode === 'public' ? state.payloads.premium : state.payloads.public;
  const race = getRaceByKey(payload, state.selectedRaceKey);
  const comparisonRace = getRaceByKey(comparisonPayload, state.selectedRaceKey);

  if (!race) {
    els.raceDetail.innerHTML = '<div class="empty-state">選択中のレースを読み込めませんでした。</div>';
    return;
  }

  const raceNum = race.meta?.race_num ? `R${race.meta.race_num}` : race.race_key;
  const title = race.meta?.race_name ? `${raceNum} ${race.meta.race_name}` : raceNum;
  const modeNote =
    !siteConfig.premiumEnabled
      ? '無料版の表示です。公開している注目馬と馬券候補を確認できます。'
      : state.mode === 'public'
      ? `無料版を表示中です。premiumプランでは ${Math.max((comparisonRace?.picks.length || 0) - race.picks.length, 0)} 頭ぶん多く注目馬を確認できます。`
      : 'premiumプランを表示中です。無料版より詳しい注目馬を確認できます。';

  els.raceDetail.innerHTML = `
    <div class="fade-in">
      <div class="detail-head">
        <div>
          <p class="eyebrow">${state.mode === 'public' ? '無料版' : 'premiumプラン'}</p>
          <h2>${title}</h2>
          <p class="detail-subline">${modeNote}</p>
        </div>
        <div class="mode-note">${race.is_major_race ? '注目レース' : '通常レース'}</div>
      </div>

      <div class="detail-tags">${renderMetaPills(race, comparisonRace)}</div>

      <div class="section-split">
        <section class="picks-section">
          <h3>注目馬</h3>
          <div class="picks-table">
            <div class="table-head">
              <span>順位</span>
              <span>馬名</span>
              <span>注目度</span>
              <span>期待値</span>
              <span>単勝</span>
              <span>複勝</span>
            </div>
            ${race.picks.map(renderPickRow).join('')}
          </div>
        </section>

        <section class="ticket-section">
          <h3>馬券候補</h3>
          ${renderTickets(race.tickets, race.picks)}
        </section>
      </div>
    </div>
  `;
}

function setMode(mode) {
  state.mode = siteConfig.premiumEnabled ? mode : 'public';
  els.modePublic.classList.toggle('is-active', state.mode === 'public');
  els.modePremium.classList.toggle('is-active', siteConfig.premiumEnabled && state.mode === 'premium');
  if (!state.payloads) {
    return;
  }
  renderFeaturedCards();
  renderRaceNav();
  renderRaceDetail();
}

async function load() {
  try {
    els.refreshButton.disabled = true;
    els.statusText.textContent = 'データを読み込み中です';
    const requests = [
      api(dataPath('public_payload')),
      api(dataPath('summary')),
    ];
    if (siteConfig.premiumEnabled) {
      requests.splice(1, 0, api(dataPath('premium_payload')));
    }
    const responses = await Promise.all(requests);
    const publicPayload = responses[0];
    const premiumPayload = siteConfig.premiumEnabled ? responses[1] : null;
    const summary = siteConfig.premiumEnabled ? responses[2] : responses[1];

    state.payloads = { public: publicPayload, premium: premiumPayload, summary };
    if (!state.selectedRaceKey || !publicPayload.races.some((race) => race.race_key === state.selectedRaceKey)) {
      state.selectedRaceKey = publicPayload.races[0]?.race_key || null;
    }

    renderSummary(summary, publicPayload, premiumPayload);
    renderFeaturedCards();
    renderRaceNav();
    renderRaceDetail();
    els.statusText.textContent = '最新データを表示しています';
  } catch (error) {
    els.statusText.textContent = 'データを取得できませんでした';
    els.raceDetail.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  } finally {
    els.refreshButton.disabled = false;
  }
}

els.modePublic.addEventListener('click', () => setMode('public'));
els.modePremium.addEventListener('click', () => setMode('premium'));
els.refreshButton.addEventListener('click', () => load());

renderMarketingProof();
load();
refreshTimer = window.setInterval(load, 60_000);
