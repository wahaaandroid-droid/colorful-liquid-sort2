import { Game } from './Game.js';

const canvas = document.getElementById('c');
if (!canvas) {
  throw new Error('canvas #c not found');
}

new Game(canvas);
