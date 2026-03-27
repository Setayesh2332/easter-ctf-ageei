// js/auth.js — signup, login, logout (Step 5)
import { supabase } from './supabaseClient.js';
import { showPage, setLoggedInUI, setLoggedOutUI, showMsg, hideMsg } from './ui.js';
import { loadChallenges } from './challenges.js';

let signupMode = 'create'; // 'create' | 'join' | 'solo'
let pendingPlayer = null;  // holds step 1 data while user is on step 2

export function initAuth() {

  // ── Restore session on page load ──
  const session = JSON.parse(localStorage.getItem('ctf_session'));
  if (session) {
    setLoggedInUI(session.playerName);
    loadChallenges(session.teamId);
    showPage('challenges');
  } else {
    setLoggedOutUI();
  }

  // ── SIGNUP STEP 1 ──
  document.getElementById('s1-btn').addEventListener('click', async () => {
    const name  = document.getElementById('s1-name').value.trim();
    const email = document.getElementById('s1-email').value.trim();
    const pass  = document.getElementById('s1-pass').value;
    hideMsg('s1-err');

    if (!name || !email || !pass) return showMsg('s1-err', 'Please fill in all fields.');
    if (pass.length < 6)          return showMsg('s1-err', 'Password must be at least 6 characters.');

    // Check email not already taken
    const { data: existing } = await supabase
      .from('players')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) return showMsg('s1-err', 'An account with this email already exists.');

    pendingPlayer = { name, email, password: pass };

    document.getElementById('s1').classList.add('gone');
    document.getElementById('s2').classList.remove('gone');
    document.getElementById('sp1').classList.remove('on');
    document.getElementById('sp2').classList.add('on');
  });

  // ── TEAM MODE SELECTOR ──
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      signupMode = btn.dataset.mode;
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      ['create', 'join', 'solo'].forEach(m => {
        document.getElementById('f-' + m).classList.add('gone');
      });
      document.getElementById('f-' + signupMode).classList.remove('gone');
    });
  });

  // ── SIGNUP STEP 2 ──
  document.getElementById('s2-btn').addEventListener('click', async () => {
    hideMsg('s2-err');
    setLoading('s2-btn', true);
    try {
      if (signupMode === 'create')    await handleCreateTeam();
      else if (signupMode === 'join') await handleJoinTeam();
      else                            await handleSolo();
    } catch (e) {
      showMsg('s2-err', 'Something went wrong. Please try again.');
      console.error(e);
    }
    setLoading('s2-btn', false);
  });

  // ── LOGIN ──
  document.getElementById('login-btn').addEventListener('click', async () => {
    const email = document.getElementById('l-email').value.trim();
    const pass  = document.getElementById('l-pass').value;
    hideMsg('login-err');

    if (!email || !pass) return showMsg('login-err', 'Please fill in all fields.');

    setLoading('login-btn', true);

    const { data: player } = await supabase
      .from('players')
      .select('id, name, team_id, password')
      .eq('email', email)
      .single();

    if (!player) {
      showMsg('login-err', 'No account found with that email.');
      setLoading('login-btn', false);
      return;
    }

    if (player.password !== pass) {
      showMsg('login-err', 'Incorrect password.');
      setLoading('login-btn', false);
      return;
    }

    saveSession(player.id, player.name, player.team_id);
    setLoggedInUI(player.name);
    loadChallenges(player.team_id);
    showPage('challenges');
    setLoading('login-btn', false);
  });

  // ── LOGOUT ──
  document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('ctf_session');
    setLoggedOutUI();
    resetSignupSteps();
    showPage('home');
  });
}

// ─────────────────────────────────────────────
// TEAM HANDLERS
// ─────────────────────────────────────────────

async function handleCreateTeam() {
  const tname = document.getElementById('s2-tname').value.trim();
  if (!tname) return showMsg('s2-err', 'Enter a team name.');

  const { data: existing } = await supabase
    .from('teams')
    .select('id')
    .eq('name', tname)
    .single();

  if (existing) return showMsg('s2-err', 'That team name is already taken.');

  const joinCode = await generateUniqueCode();

  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .insert({ name: tname, join_code: joinCode, score: 0 })
    .select()
    .single();

  if (teamErr) throw teamErr;

  const player = await insertPlayer(team.id);
  saveSession(player.id, player.name, team.id);
  setLoggedInUI(player.name);
  showStep3(`Team "${tname}" created!`, 'Share the join code with your teammates (max 3 total).', joinCode);
}

async function handleJoinTeam() {
  const code = document.getElementById('s2-code').value.trim();
  if (code.length !== 4) return showMsg('s2-err', 'Enter a valid 4-digit join code.');

  const { data: team } = await supabase
    .from('teams')
    .select('id, name')
    .eq('join_code', code)
    .single();

  if (!team) return showMsg('s2-err', 'No team found with that code.');

  const { count } = await supabase
    .from('players')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', team.id);

  if (count >= 3) return showMsg('s2-err', 'This team is already full (max 3 players).');

  const player = await insertPlayer(team.id);
  saveSession(player.id, player.name, team.id);
  setLoggedInUI(player.name);
  showStep3(`You joined "${team.name}"!`, "You're all set. Time to hunt.");
}

async function handleSolo() {
  const soloName = `${pendingPlayer.name}'s team`;
  const joinCode = await generateUniqueCode();

  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .insert({ name: soloName, join_code: joinCode, score: 0 })
    .select()
    .single();

  if (teamErr) throw teamErr;

  const player = await insertPlayer(team.id);
  saveSession(player.id, player.name, team.id);
  setLoggedInUI(player.name);
  showStep3('Solo mode activated!', "You're hunting alone. Good luck. 🥚");
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

async function insertPlayer(teamId) {
  const { data: player, error } = await supabase
    .from('players')
    .insert({
      name:     pendingPlayer.name,
      email:    pendingPlayer.email,
      password: pendingPlayer.password,
      team_id:  teamId,
    })
    .select()
    .single();

  if (error) throw error;
  return player;
}

async function generateUniqueCode() {
  let code, exists;
  do {
    code = Math.floor(1000 + Math.random() * 9000).toString();
    const { data } = await supabase
      .from('teams')
      .select('id')
      .eq('join_code', code)
      .single();
    exists = !!data;
  } while (exists);
  return code;
}

function saveSession(playerId, playerName, teamId) {
  localStorage.setItem('ctf_session', JSON.stringify({ playerId, playerName, teamId }));
}

function showStep3(title, sub, code = null) {
  document.getElementById('s2').classList.add('gone');
  document.getElementById('s3').classList.remove('gone');
  document.getElementById('sp2').classList.remove('on');
  document.getElementById('sp3').classList.add('on');
  document.getElementById('s3-title').textContent = title;
  document.getElementById('s3-sub').textContent   = sub;
  if (code) {
    document.getElementById('s3-code').textContent = code;
    document.getElementById('s3-codebox').classList.remove('gone');
  }
}

function resetSignupSteps() {
  document.getElementById('s1').classList.remove('gone');
  document.getElementById('s2').classList.add('gone');
  document.getElementById('s3').classList.add('gone');
  document.getElementById('sp1').classList.add('on');
  document.getElementById('sp2').classList.remove('on');
  document.getElementById('sp3').classList.remove('on');
  document.getElementById('s3-codebox').classList.add('gone');
  pendingPlayer = null;
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled    = loading;
  btn.textContent = loading
    ? 'Please wait...'
    : btnId === 'login-btn' ? 'Log in' : 'Finish signup';
}