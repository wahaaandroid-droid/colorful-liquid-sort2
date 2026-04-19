import * as THREE from 'three';

export function canPourAmount(src, dst) {
  if (src === dst) return 0;
  if (src.totalAmount() <= 0) return 0;
  const space = dst.spaceLeft();
  if (space <= 0) return 0;
  const top = src.topColor();
  if (!top) return 0;
  if (dst.totalAmount() > 0 && dst.topColor().getHex() !== top.getHex()) return 0;
  return Math.min(space, src.topRunAmount());
}

export function applyPour(src, dst, amount) {
  if (amount <= 0) return;
  const c = src.topColor()?.clone();
  if (!c) return;
  let rem = amount;
  while (rem > 1e-6 && src.liquidStack.length > 0) {
    const top = src.liquidStack[src.liquidStack.length - 1];
    const take = Math.min(top.amount, rem);
    top.amount -= take;
    rem -= take;
    if (top.amount <= 1e-6) src.liquidStack.pop();
  }
  const last = dst.liquidStack[dst.liquidStack.length - 1];
  if (last && last.color.getHex() === c.getHex()) {
    last.amount += amount;
  } else {
    dst.liquidStack.push({ color: c, amount });
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
