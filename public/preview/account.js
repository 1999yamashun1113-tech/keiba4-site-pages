const siteConfig = window.SITE_CONFIG || {};
const membershipConfig = siteConfig.membership || {
  enabled: false,
  apiBase: '',
  supportEmail: 'support@keibapicknavi.com',
};

const state = {
  checkoutSessionId: new URLSearchParams(window.location.search).get('session_id') || '',
};

const els = {
  notice: document.getElementById('accountNotice'),
  loggedOut: document.getElementById('accountLoggedOut'),
  passwordSetup: document.getElementById('accountPasswordSetup'),
  signedIn: document.getElementById('accountSignedIn'),
  loginForm: document.getElementById('loginForm'),
  loginEmail: document.getElementById('loginEmail'),
  loginPassword: document.getElementById('loginPassword'),
  setupForm: document.getElementById('passwordSetupForm'),
  setupEmail: document.getElementById('setupEmail'),
  setupPassword: document.getElementById('setupPassword'),
  startCheckoutButton: document.getElementById('startCheckoutButton'),
  openPortalButton: document.getElementById('openPortalButton'),
  logoutButton: document.getElementById('logoutButton'),
  statusText: document.getElementById('accountStatusText'),
  accountEmail: document.getElementById('accountEmail'),
  accountPlanStatus: document.getElementById('accountPlanStatus'),
  accountExpiresAt: document.getElementById('accountExpiresAt'),
};

function apiBase() {
  return String(membershipConfig.apiBase || '').replace(/\/$/, '');
}

function memberApi(path, { method = 'GET', body } = {}) {
  const options = {
    method,
    credentials: 'include',
    headers: { Accept: 'application/json' },
  };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  return fetch(`${apiBase()}${path}`, options).then(async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || `request failed: ${response.status}`);
    }
    return data;
  });
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

function showNotice(message, kind = 'info') {
  if (!message) {
    els.notice.hidden = true;
    els.notice.textContent = '';
    els.notice.dataset.kind = '';
    return;
  }
  els.notice.hidden = false;
  els.notice.textContent = message;
  els.notice.dataset.kind = kind;
}

function renderSignedOut() {
  els.loggedOut.hidden = false;
  els.passwordSetup.hidden = true;
  els.signedIn.hidden = true;
}

function renderPasswordSetup(email) {
  els.loggedOut.hidden = true;
  els.passwordSetup.hidden = false;
  els.signedIn.hidden = true;
  els.setupEmail.value = email || '';
}

function renderSignedIn(payload) {
  els.loggedOut.hidden = true;
  els.passwordSetup.hidden = true;
  els.signedIn.hidden = false;
  els.statusText.textContent = payload.hasAccess
    ? 'premium プランの閲覧権限があります。'
    : '契約状態は保存されています。必要に応じて Stripe 側でお支払い情報をご確認ください。';
  els.accountEmail.textContent = payload.email || '-';
  els.accountPlanStatus.textContent = payload.subscriptionStatus || '-';
  els.accountExpiresAt.textContent = formatTimestamp(payload.accessExpiresAt);
}

async function loadStatus() {
  const payload = await memberApi('/api/member/status');
  if (!payload.enabled) {
    renderSignedOut();
    showNotice(`会員機能はまだ設定中です。お問い合わせは ${membershipConfig.supportEmail} までお願いします。`);
    return;
  }
  if (!payload.signedIn) {
    renderSignedOut();
    return;
  }
  renderSignedIn(payload);
}

async function completeCheckout(password = '') {
  const payload = await memberApi('/api/member/complete-checkout', {
    method: 'POST',
    body: {
      session_id: state.checkoutSessionId,
      password,
    },
  });
  if (payload.passwordSetupRequired) {
    renderPasswordSetup(payload.email);
    return;
  }
  showNotice('購入内容を確認しました。premium プランをご利用いただけます。');
  renderSignedIn(payload);
  window.history.replaceState({}, '', '/account.html');
}

els.startCheckoutButton.addEventListener('click', async () => {
  try {
    showNotice('');
    els.startCheckoutButton.disabled = true;
    const payload = await memberApi('/api/member/create-checkout-session', {
      method: 'POST',
      body: { email: els.loginEmail.value.trim() || undefined },
    });
    if (!payload.checkoutUrl) {
      throw new Error('決済ページを作成できませんでした。');
    }
    window.location.href = payload.checkoutUrl;
  } catch (error) {
    showNotice(error.message, 'error');
  } finally {
    els.startCheckoutButton.disabled = false;
  }
});

els.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    showNotice('');
    const payload = await memberApi('/api/member/login', {
      method: 'POST',
      body: {
        email: els.loginEmail.value.trim(),
        password: els.loginPassword.value,
      },
    });
    renderSignedIn(payload);
  } catch (error) {
    showNotice(error.message, 'error');
  }
});

els.setupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    showNotice('');
    await completeCheckout(els.setupPassword.value);
  } catch (error) {
    showNotice(error.message, 'error');
  }
});

els.openPortalButton.addEventListener('click', async () => {
  try {
    showNotice('');
    const payload = await memberApi('/api/member/create-portal-session', { method: 'POST' });
    if (!payload.portalUrl) {
      throw new Error('Stripe の会員管理ページを開けませんでした。');
    }
    window.location.href = payload.portalUrl;
  } catch (error) {
    showNotice(error.message, 'error');
  }
});

els.logoutButton.addEventListener('click', async () => {
  try {
    showNotice('');
    await memberApi('/api/member/logout', { method: 'POST' });
    renderSignedOut();
  } catch (error) {
    showNotice(error.message, 'error');
  }
});

async function main() {
  try {
    if (new URLSearchParams(window.location.search).get('checkout') === 'cancelled') {
      showNotice('決済はキャンセルされました。', 'info');
    }
    if (state.checkoutSessionId) {
      await completeCheckout();
      return;
    }
    await loadStatus();
  } catch (error) {
    renderSignedOut();
    showNotice(error.message, 'error');
  }
}

main();
