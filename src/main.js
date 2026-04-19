import { Game } from './Game.js';

function boot() {
  const canvas = document.getElementById('c');
  if (!canvas) {
    throw new Error('canvas #c not found');
  }
  new Game(canvas);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
