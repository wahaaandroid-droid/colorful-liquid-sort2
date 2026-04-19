import { Game } from './Game.js';

function boot() {
  const canvas = document.getElementById('c');
  if (!canvas) {
    throw new Error('canvas #c not found');
  }
  try {
    new Game(canvas);
  } catch (err) {
    console.error(err);
    const st = document.getElementById('status');
    if (st) {
      st.textContent =
        err instanceof Error ? `初期化エラー: ${err.message}` : '初期化に失敗しました。コンソールを確認してください。';
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
