// js/app.js — entry point
import { initUI } from './ui.js';
import { initAuth } from './auth.js';
import { loadLeaderboard } from './leaderboard.js';

document.addEventListener('DOMContentLoaded', () => {
  initUI();
  initAuth();

  // Load leaderboard whenever the tab is clicked
  document.querySelector('.tab[data-pg="leaderboard"]').addEventListener('click', () => {
    loadLeaderboard();
  });
});