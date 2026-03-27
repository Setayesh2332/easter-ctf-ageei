// js/ui.js — page navigation & nav state

export function showPage(pageId) {
  document.querySelectorAll('.pg').forEach(p => p.classList.remove('on'));
  document.querySelectorAll('.tab[data-pg]').forEach(t => t.classList.remove('on'));
  const target = document.getElementById('pg-' + pageId);
  if (target) target.classList.add('on');
  const tab = document.querySelector(`.tab[data-pg="${pageId}"]`);
  if (tab) tab.classList.add('on');
}

export function setLoggedInUI(playerName) {
  document.querySelector('[data-pg="signup"]').classList.add('gone');
  document.querySelector('[data-pg="login"]').classList.add('gone');
  document.querySelector('[data-pg="challenges"]').classList.remove('gone');
  document.querySelector('[data-pg="leaderboard"]').classList.remove('gone');
  document.getElementById('logout-btn').classList.remove('gone');
}

export function setLoggedOutUI() {
  document.querySelector('[data-pg="signup"]').classList.remove('gone');
  document.querySelector('[data-pg="login"]').classList.remove('gone');
  document.querySelector('[data-pg="challenges"]').classList.add('gone');
  document.querySelector('[data-pg="leaderboard"]').classList.add('gone');
  document.getElementById('logout-btn').classList.add('gone');
}

export function showMsg(id, text, type = 'err') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = `msg ${type}`;
  el.style.display = 'block';
}

export function hideMsg(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

export function initUI() {
  // Nav tab clicks
  document.querySelectorAll('.tab[data-pg]').forEach(tab => {
    tab.addEventListener('click', () => showPage(tab.dataset.pg));
  });

  // data-goto links (hero buttons + auth switch links)
  document.querySelectorAll('[data-goto]').forEach(el => {
    el.addEventListener('click', () => showPage(el.dataset.goto));
  });
}