import * as THREE from 'three';
import { GlassTube } from './GlassTube.js';
import { fillSolvedAndShuffle } from './levelGen.js';

const SEG_PAD_X = 0.55;

/**
 * 1 ステージ分のチューブ列（Z 位置にグループで配置）
 */
export class StageSegment {
  /**
   * @param {{
   *   envMap: THREE.Texture | null;
   *   worldZ: number;
   *   capacity: number;
   *   colorCount: number;
   *   emptyCount: number;
   *   shuffleSteps: number;
   *   riseFromBelow?: boolean;
   * }} opts
   */
  constructor(opts) {
    this.group = new THREE.Group();
    this.group.position.set(0, 0, opts.worldZ);
    this.worldZ = opts.worldZ;
    this.tubes = [];

    const tubeCount = opts.colorCount + opts.emptyCount;
    const spacing = Math.min(1.02, (8.2 - SEG_PAD_X * 2) / Math.max(1, tubeCount - 1));
    const radius = Math.min(0.34, 3.5 / Math.max(6, tubeCount));
    const height = 1.38 + opts.capacity * 0.068;

    const startX = -((tubeCount - 1) / 2) * spacing;
    for (let i = 0; i < tubeCount; i++) {
      const g = new GlassTube({
        radius,
        height,
        capacity: opts.capacity,
        envMap: opts.envMap,
      });
      g.position.set(startX + i * spacing, 0, 0);
      const targetY = 0.78;
      if (opts.riseFromBelow) {
        g.setBaseY(-2.85);
        g.userData.startBaseY = -2.85;
      } else {
        g.setBaseY(targetY);
        g.userData.startBaseY = targetY;
      }
      g.userData.glass = g;
      g.userData.segment = this;
      g.userData.targetBaseY = targetY;
      this.group.add(g);
      this.tubes.push(g);
    }

    fillSolvedAndShuffle(this.tubes, opts.colorCount, opts.capacity, opts.shuffleSteps);
  }

  dispose() {
    for (const t of this.tubes) {
      this.group.remove(t);
      t.dispose();
    }
    this.tubes = [];
    if (this.group.parent) this.group.parent.remove(this.group);
  }
}

export const SEGMENT_DEPTH = 14;
