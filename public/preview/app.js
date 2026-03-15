const state = {
  mode: 'public',
  selectedRaceKey: null,
  payloads: null,
};

const siteConfig = window.KEIBA4_SITE_CONFIG || {
  mode: 'server',
  dataBase: '/api/site-payload',
  premiumEnabled: true,
  showSourcePath: true,
};

const els = {
  raceDate: document.getElementById('raceDate'),
  generatedAt: document.getElementById('generatedAt'),
  raceCount: document.getElementById('raceCount'),
  summaryCardPublic: document.getElementById('summaryCardPublic'),
  summaryCardPremium: document.getElementById('summaryCardPremium'),
  publicPickTotal: document.getElementById('publicPickTotal'),
  premiumPickTotal: document.getElementById('premiumPickTotal'),
  ticketRaceCount: document.getElementById('ticketRaceCount'),
  modePublic: document.getElementById('modePublic'),
  modePremium: document.getElementById('modePremium'),
  refreshButton: document.getElementById('refreshButton'),
  statusText: document.getElementById('statusText'),
  featuredPickCard: document.getElementById('featuredPickCard'),
  featuredTicketCard: document.getElementById('featuredTicketCard'),
  raceNav: document.getElementById('raceNav'),
  raceDetail: document.getElementById('raceDetail'),
  sourcePath: document.getElementById('sourcePath'),
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

function formatRaceLabel(race) {
  const raceNum = race.meta?.race_num ? `R${race.meta.race_num}` : race.race_key;
  const start = race.meta?.start_time ? `${race.meta.start_time.slice(0, 2)}:${race.meta.start_time.slice(2, 4)}` : 'time ?';
  return { title: raceNum, meta: start };
}

function getRaceByKey(payload, raceKey) {
  if (!payload) {
    return null;
  }
  return payload.races.find((race) => race.race_key === raceKey) || null;
}

function renderSummary(summary, publicPayload, premiumPayload) {
  const publicPickTotal = publicPayload.races.reduce((sum, race) => sum + race.picks.length, 0);
  const premiumBase = premiumPayload || publicPayload;
  const premiumPickTotal = premiumBase.races.reduce((sum, race) => sum + race.picks.length, 0);
  const ticketRaceCount = publicPayload.races.filter((race) => race.tickets.length > 0).length;

  els.raceDate.textContent = summary.race_date || '-';
  els.generatedAt.textContent = formatTimestamp(summary.generated_at_utc);
  els.raceCount.textContent = String(summary.public_race_count || 0);
  els.publicPickTotal.textContent = String(publicPickTotal);
  els.premiumPickTotal.textContent = siteConfig.premiumEnabled ? String(premiumPickTotal) : 'hidden';
  els.ticketRaceCount.textContent = String(ticketRaceCount);
  els.summaryCardPremium.hidden = !siteConfig.premiumEnabled;
  els.modePremium.hidden = !siteConfig.premiumEnabled;
  els.sourcePath.textContent = siteConfig.showSourcePath ? summary.resolved_dir || '-' : 'not published';
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
      <p class="eyebrow">featured pick</p>
      <h2>${escapeHtml(featuredPick.horse_name || `馬番 ${featuredPick.horse_num}`)}</h2>
      <p class="feature-copy">
        ${escapeHtml(`R${featuredPick.race_num}`)}
        ${featuredPick.race_name ? ` ${escapeHtml(featuredPick.race_name)}` : ''}
      </p>
      <p class="feature-copy">score ${formatNumber(featuredPick.pred_score, 3)} / place odds ${formatNumber(featuredPick.odds_place, 1)}</p>
    `;
  }

  if (featuredTicket) {
    els.featuredTicketCard.innerHTML = `
      <p class="eyebrow">featured ticket</p>
      <h2>${escapeHtml(featuredTicket.combo)}</h2>
      <p class="feature-copy">R${escapeHtml(featuredTicket.race_num)} / ${escapeHtml(featuredTicket.bet_type)}</p>
      <p class="feature-copy">EV ${formatNumber(featuredTicket.ev_est, 2)} / odds ${formatNumber(featuredTicket.est_odds, 1)}</p>
    `;
  } else {
    els.featuredTicketCard.innerHTML = `
      <p class="eyebrow">featured ticket</p>
      <h2>ticket unavailable</h2>
      <p class="feature-copy">現在の payload では ticket 提案がありません。公開候補のみを確認できます。</p>
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
    ['race key', race.race_key],
    ['start', race.meta?.start_time ? `${race.meta.start_time.slice(0, 2)}:${race.meta.start_time.slice(2, 4)}` : '-'],
    ['distance', race.meta?.distance ? `${race.meta.distance}m` : '-'],
    ['track', race.meta?.track_type ?? '-'],
    ['headcount', race.meta?.headcount ?? '-'],
    ['premium diff', comparisonRace ? `+${Math.max(comparisonRace.picks.length - race.picks.length, 0)} picks` : '-'],
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
      <div><span class="pick-cell-muted">score</span><br />${formatNumber(pick.pred_score, 3)}</div>
      <div><span class="pick-cell-muted">ev</span><br />${formatNumber(pick.pred_ev_place, 3)}</div>
      <div><span class="pick-cell-muted">win</span><br />${formatNumber(pick.odds_win, 1)}</div>
      <div><span class="pick-cell-muted">place</span><br />${formatNumber(pick.odds_place, 1)}</div>
    </div>
  `;
}

function renderTickets(tickets) {
  if (!tickets.length) {
    return '<div class="empty-state">このレースには ticket 提案がありません。</div>';
  }
  return `
    <div class="ticket-list">
      ${tickets
        .map(
          (ticket) => `
            <article class="ticket-card">
              <small>${ticket.bet_type}</small>
              <strong>${ticket.combo}</strong>
              <p>${ticket.strategy ? escapeHtml(ticket.strategy) : 'public release ticket'}</p>
              <div class="ticket-metrics">
                <span>ev ${formatNumber(ticket.ev_est, 2)}</span>
                <span>odds ${formatNumber(ticket.est_odds, 1)}</span>
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
      ? 'public release 用の表示です。premium データや内部パスは公開していません。'
      : state.mode === 'public'
      ? `public payload を表示中。premium では ${Math.max((comparisonRace?.picks.length || 0) - race.picks.length, 0)} 件の追加 pick が見えます。`
      : `premium payload を表示中。public と同じ race 順のまま、より深い pick を確認できます。`;

  els.raceDetail.innerHTML = `
    <div class="fade-in">
      <div class="detail-head">
        <div>
          <p class="eyebrow">${state.mode} payload</p>
          <h2>${title}</h2>
          <p class="detail-subline">${modeNote}</p>
        </div>
        <div class="mode-note">${race.is_major_race ? 'major race' : 'standard race'}</div>
      </div>

      <div class="detail-tags">${renderMetaPills(race, comparisonRace)}</div>

      <div class="section-split">
        <section class="picks-section">
          <h3>picks</h3>
          <div class="picks-table">
            <div class="table-head">
              <span>rank</span>
              <span>horse</span>
              <span>score</span>
              <span>ev</span>
              <span>win</span>
              <span>place</span>
            </div>
            ${race.picks.map(renderPickRow).join('')}
          </div>
        </section>

        <section class="ticket-section">
          <h3>tickets</h3>
          ${renderTickets(race.tickets)}
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
    els.statusText.textContent = 'loading payload...';
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
    els.statusText.textContent = 'payload ready';
  } catch (error) {
    els.statusText.textContent = 'payload unavailable';
    els.raceDetail.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  } finally {
    els.refreshButton.disabled = false;
  }
}

els.modePublic.addEventListener('click', () => setMode('public'));
els.modePremium.addEventListener('click', () => setMode('premium'));
els.refreshButton.addEventListener('click', () => load());

load();
refreshTimer = window.setInterval(load, 60_000);
