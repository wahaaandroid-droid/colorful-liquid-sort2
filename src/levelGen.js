import * as THREE from 'three';
import { applyPour, canPourAmount, listValidPours } from './pourRules.js';

export const PALETTE = [
  0xff4458, 0x33dd88, 0x4488ff, 0xffcc33, 0xee44ff, 0x44eecc, 0xff8844, 0x8888ff, 0x66ff66, 0xff66aa,
  0x66ccff, 0xccaa66,
];

/**
 * クリア回数に応じた難易度（層＝capacity、本数、色数）
 * @param {number} clearCount 累計クリア（次ステージ生成時に渡す）
 */
export function difficultyParams(clearCount) {
  const colorCount = THREE.MathUtils.clamp(4 + Math.floor(clearCount / 2), 4, 8);
  const capacity = THREE.MathUtils.clamp(4 + Math.floor(clearCount / 3), 4, 8);
  const emptyCount = THREE.MathUtils.clamp(2 + Math.floor(clearCount / 5), 2, 5);
  const tubeCount = colorCount + emptyCount;
  const shuffleSteps = 20 + clearCount * 5 + colorCount * 6 + capacity * 4;
  return { colorCount, capacity, emptyCount, tubeCount, shuffleSteps };
}

/**
 * 完成状態を作り、有効な注ぎを繰り返してシャッフル（必ず解ける）
 * @param {import('./GlassTube.js').GlassTube[]} tubes 長さ >= colorCount + emptyCount
 */
export function fillSolvedAndShuffle(tubes, colorCount, capacity, shuffleSteps, rng = Math.random) {
  const palette = PALETTE.slice(0, colorCount);
  for (let i = 0; i < tubes.length; i++) tubes[i].layers = [];
  for (let c = 0; c < colorCount; c++) {
    const col = new THREE.Color(palette[c]);
    tubes[c].layers = [{ color: col, amount: capacity }];
  }
  for (let s = 0; s < shuffleSteps; s++) {
    const pairs = listValidPours(tubes);
    if (pairs.length === 0) break;
    const pick = pairs[Math.floor(rng() * pairs.length)];
    const [i, j] = pick;
    const amt = canPourAmount(tubes[i], tubes[j]);
    if (amt > 0) applyPour(tubes[i], tubes[j], amt);
  }
}
