// js/leaderboard.js — Step 6
import { supabase } from './supabaseClient.js';

export async function loadLeaderboard() {
  const container = document.getElementById('leaderboard-list');
  container.innerHTML = '<p class="muted">Loading...</p>';

  // Fetch all teams sorted by score DESC, then created_at ASC (tie-break)
  const { data: teams, error } = await supabase
    .from('teams')
    .select('id, name, score, created_at')
    .order('score', { ascending: false })
    .order('created_at', { ascending: true });

  if (error || !teams?.length) {
    container.innerHTML = '<p class="muted">No teams yet.</p>';
    return;
  }

  const rows = await Promise.all(teams.map(async (team, i) => {
    const { count: memberCount } = await supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', team.id);

    const { count: solveCount } = await supabase
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', team.id)
      .eq('is_correct', true);

    const rank       = i + 1;
    const medalClass = rank === 1 ? 'g1' : rank === 2 ? 'g2' : rank === 3 ? 'g3' : '';
    const medal      = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;

    return `
      <div class="lbrow">
        <div class="lbrank ${medalClass}">${medal}</div>
        <div>
          <div class="lbname">${escHtml(team.name)}</div>
          <div class="lbsub">${memberCount ?? 0} member${memberCount === 1 ? '' : 's'} · ${solveCount ?? 0} solved</div>
        </div>
        <div class="lbscore">${team.score} pts</div>
      </div>`;
  }));

  container.innerHTML = rows.join('');
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
