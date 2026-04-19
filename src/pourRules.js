import * as THREE from 'three';

export function canPourAmount(src, dst) {
  if (src === dst) return 0;
  if (src.totalAmount() <= 0) return 0;
  const space = dst.spaceLeft();
  if (space <= 0) return 0;
  if (src.liquidStack.length === 0) return 0;
  const topSeg = src.liquidStack[src.liquidStack.length - 1];
  if (dst.totalAmount() > 0) {
    const dTop = dst.liquidStack[dst.liquidStack.length - 1];
    if (!dTop.color.equals(topSeg.color)) return 0;
  }
  const pourable = topSeg.amount;
  return Math.min(space, pourable);
}

export function applyPour(src, dst, amount) {
  if (amount <= 0) return;
  if (src.liquidStack.length === 0) return;
  const topSeg = src.liquidStack[src.liquidStack.length - 1];
  const c = topSeg.color.clone();
  const take = Math.min(amount, topSeg.amount);
  topSeg.amount -= take;
  if (topSeg.amount <= 1e-6) src.liquidStack.pop();
  const last = dst.liquidStack.length ? dst.liquidStack[dst.liquidStack.length - 1] : null;
  if (last && last.color.equals(c)) {
    last.amount += take;
  } else {
    dst.liquidStack.push({ color: c, amount: take });
  }
}

export function isTubeSorted(tube) {
  if (tube.totalAmount() === 0) return true;
  if (tube.liquidStack.length !== 1) return false;
  return tube.liquidStack[0].amount >= tube.capacity - 1e-6;
}

/** @param {import('./GlassTube.js').GlassTube[]} tubes */
export function listValidPours(tubes) {
  const out = [];
  for (let i = 0; i < tubes.length; i++) {
    for (let j = 0; j < tubes.length; j++) {
      if (i === j) continue;
      const amt = canPourAmount(tubes[i], tubes[j]);
      if (amt > 0) out.push([i, j, amt]);
    }
  }
  return out;
}
