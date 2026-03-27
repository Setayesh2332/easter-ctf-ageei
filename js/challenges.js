// js/challenges.js — Step 6
import { supabase } from './supabaseClient.js';

let allChallenges  = [];
let solvedIds      = new Set();
let currentTeamId  = null;
let currentPlayerId = null;
let openChallenge  = null;

// ─────────────────────────────────────────────
// MAIN ENTRY
// ─────────────────────────────────────────────
export async function loadChallenges(teamId) {
  currentTeamId = teamId;
  const session = JSON.parse(localStorage.getItem('ctf_session'));
  currentPlayerId = session?.playerId ?? null;

  const { data: challenges, error } = await supabase
    .from('challenges')
    .select('*')
    .order('points', { ascending: true });

  if (error) {
    document.getElementById('challenges-grid').innerHTML =
      '<p class="muted">Failed to load challenges.</p>';
    return;
  }

  allChallenges = challenges;

  const { data: submissions } = await supabase
    .from('submissions')
    .select('challenge_id')
    .eq('team_id', teamId)
    .eq('is_correct', true);

  solvedIds = new Set((submissions ?? []).map(s => s.challenge_id));

  renderGrid();
  initModal();
}

// ─────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────
function renderGrid() {
  const grid    = document.getElementById('challenges-grid');
  const counter = document.getElementById('solve-count');

  if (!allChallenges.length) {
    grid.innerHTML = '<p class="muted">No challenges found. Add some in Supabase!</p>';
    return;
  }

  counter.textContent = `${solvedIds.size} / ${allChallenges.length} solved`;

  grid.innerHTML = allChallenges.map(ch => {
    const solved = solvedIds.has(ch.id);
    return `
      <div class="ecard ${solved ? 'solved' : ''}" data-id="${ch.id}">
        <div class="eicon">${ch.emoji || '🥚'}</div>
        <h3>${escHtml(ch.title)}</h3>
        <p>${escHtml(ch.description)}</p>
        <div class="efoot">
          <span class="pts">${ch.points} pts</span>
          ${solved
            ? '<span class="solved-tag">Solved</span>'
            : `<span class="diff">${diffLabel(ch.points)}</span>`}
        </div>
      </div>`;
  }).join('');

  grid.querySelectorAll('.ecard').forEach(card => {
    card.addEventListener('click', () => {
      const ch = allChallenges.find(c => c.id === card.dataset.id);
      if (ch) openModal(ch);
    });
  });
}

// ─────────────────────────────────────────────
// MODAL
// ─────────────────────────────────────────────
function initModal() {
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('modal-submit').addEventListener('click', handleSubmit);
  document.getElementById('m-ans').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSubmit();
  });
}

function openModal(ch) {
  openChallenge = ch;
  const solved  = solvedIds.has(ch.id);

  document.getElementById('m-icon').textContent  = ch.emoji || '🥚';
  document.getElementById('m-title').textContent = ch.title;
  document.getElementById('m-desc').textContent  = ch.description;
  document.getElementById('m-pts').textContent   = `${ch.points} pts`;
  document.getElementById('m-ans').value         = '';

  hideEl('m-ok');
  hideEl('m-err');

  if (solved) {
    showEl('m-ok');
    document.getElementById('m-ok').textContent = '✓ Your team already solved this one!';
    hideEl('m-input-wrap');
    hideEl('modal-submit');
  } else {
    showEl('m-input-wrap');
    showEl('modal-submit');
  }

  document.getElementById('overlay').classList.remove('gone');
  document.getElementById('m-ans').focus();
}

function closeModal() {
  document.getElementById('overlay').classList.add('gone');
  openChallenge = null;
}

// ─────────────────────────────────────────────
// SUBMISSION
// ─────────────────────────────────────────────
async function handleSubmit() {
  if (!openChallenge) return;

  const answer  = document.getElementById('m-ans').value.trim().toLowerCase();
  const correct = openChallenge.answer.trim().toLowerCase();

  hideEl('m-ok');
  hideEl('m-err');

  if (!answer) return;

  const isCorrect = answer === correct;

  await supabase.from('submissions').insert({
    player_id:    currentPlayerId,
    team_id:      currentTeamId,
    challenge_id: openChallenge.id,
    is_correct:   isCorrect,
  });

  if (isCorrect) {
    const { data: team } = await supabase
      .from('teams')
      .select('score')
      .eq('id', currentTeamId)
      .single();

    await supabase
      .from('teams')
      .update({ score: (team?.score ?? 0) + openChallenge.points })
      .eq('id', currentTeamId);

    solvedIds.add(openChallenge.id);

    showEl('m-ok');
    document.getElementById('m-ok').textContent = `✓ Correct! +${openChallenge.points} points added to your team.`;
    hideEl('m-input-wrap');
    hideEl('modal-submit');

    renderGrid();
  } else {
    showEl('m-err');
    document.getElementById('m-err').textContent = '✗ Wrong answer. Try again.';
  }
}

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────
function diffLabel(pts) {
  if (pts <= 50)  return 'Easy';
  if (pts <= 100) return 'Medium';
  return 'Hard';
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showEl(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('gone'); el.style.display = ''; }
}

function hideEl(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('gone');
}