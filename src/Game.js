import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { gsap } from 'gsap';
import { GlassTube, PourStream } from './GlassTube.js';
import { AudioSynth } from './AudioSynth.js';
import { canPourAmount, applyPour, isTubeSorted } from './pourRules.js';
import { difficultyParams } from './levelGen.js';
import { StageSegment, SEGMENT_DEPTH } from './StageSegment.js';

const CAM_Z_OFFSET = 8.4;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.audio = new AudioSynth();
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.45;
    this.renderer.shadowMap.enabled = false;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x101520);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
    this._lookZ = 0;
    this._fitRendererToCanvas();
    this._applyCamera();

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.envMap = null;
    this._setupEnvironment();

    this.ambient = new THREE.AmbientLight(0xffffff, 0.62);
    this.scene.add(this.ambient);
    const hemi = new THREE.HemisphereLight(0xd8e6ff, 0x1e2430, 0.72);
    hemi.position.set(0, 1, 0);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff5ee, 1.55);
    key.position.set(3.5, 10, 4);
    key.castShadow = false;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xdde6ff, 0.65);
    rim.position.set(-5, 6, -6);
    this.scene.add(rim);

    this.runway = new THREE.Mesh(
      new THREE.PlaneGeometry(56, 56),
      new THREE.MeshBasicMaterial({ color: 0x2a3344 }),
    );
    this.runway.rotation.x = -Math.PI / 2;
    this.runway.position.set(0, 0.002, 0);
    this.scene.add(this.runway);

    this.clearCount = 0;
    /** @type {StageSegment | null} */
    this.activeSegment = null;
    /** @type {GlassTube[]} */
    this.tubes = [];
    this._spawnInitialSegment();

    this.stream = new PourStream();
    this.scene.add(this.stream);

    this.selected = null;
    this._pouring = false;
    this._stageBusy = false;
    /** @type {GlassTube[] | null} */
    this._risingTubes = null;
    /** @type {GlassTube | null} */
    this._pourA = null;
    /** @type {GlassTube | null} */
    this._pourB = null;

    this._onPointer = this._onPointer.bind(this);
    this._onResize = this._onResize.bind(this);
    window.addEventListener('pointerdown', this._onPointer);
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this._onResize);
    }
    this._onResize();

    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(() => this._onResize());
      this._resizeObserver.observe(this.canvas);
    }

    requestAnimationFrame(() => {
      this._onResize();
    });

    this._clock = new THREE.Clock();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);

    this._setStatus('同色をまとめてください');
  }

  _applyCamera() {
    const lz = this._lookZ;
    this.camera.position.set(0, 3.6, lz + CAM_Z_OFFSET);
    this.camera.lookAt(0, 1.15, lz);
  }

  _setupEnvironment() {
    this.envMap = null;
    this.scene.environment = null;
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      pmrem.compileEquirectangularShader();
      const env = new RoomEnvironment();
      const rt = pmrem.fromScene(env, 0.04);
      this.envMap = rt.texture;
      /* シーン全体の IBL は暗く潰れやすいので、ガラス等の material.envMap のみ利用 */
      this.scene.environment = null;
      pmrem.dispose();
      env.dispose();
    } catch (err) {
      console.warn('[Game] PMREM / RoomEnvironment failed; using fallback lighting.', err);
      this.envMap = null;
      this.scene.environment = null;
    }
  }

  _spawnInitialSegment() {
    const p = difficultyParams(0);
    this.activeSegment = new StageSegment({
      envMap: this.envMap,
      worldZ: 0,
      capacity: p.capacity,
      colorCount: p.colorCount,
      emptyCount: p.emptyCount,
      shuffleSteps: p.shuffleSteps,
      riseFromBelow: false,
    });
    this.scene.add(this.activeSegment.group);
    this.tubes = this.activeSegment.tubes;
  }

  _fitRendererToCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const vv = window.visualViewport;
    const vw = Math.max(2, Math.floor(vv?.width ?? window.innerWidth));
    const vh = Math.max(2, Math.floor(vv?.height ?? window.innerHeight));
    let w = Math.floor(rect.width);
    let h = Math.floor(rect.height);
    /* レイアウト未確定・親高さ 0 などで極小になるのを防ぐ */
    if (w < 64 || h < 64) {
      w = Math.max(vw, Math.floor(window.innerWidth));
      h = Math.max(vh, Math.floor(window.innerHeight));
    }
    w = Math.max(2, w);
    h = Math.max(2, h);
    this.renderer.setSize(w, h, false);
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  dispose() {
    window.removeEventListener('pointerdown', this._onPointer);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('orientationchange', this._onResize);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this._onResize);
    }
    this._resizeObserver?.disconnect();
    if (this.activeSegment) {
      this.activeSegment.dispose();
      this.activeSegment = null;
    }
    this.tubes = [];
    this.runway.geometry.dispose();
    this.runway.material.dispose();
    this.scene.remove(this.runway);
    this.stream.dispose();
    this.renderer.dispose();
  }

  _onResize() {
    this._fitRendererToCanvas();
  }

  _setStatus(t) {
    const el = document.getElementById('status');
    if (el) el.textContent = t;
  }

  _startStageTransition() {
    if (!this.activeSegment || this._stageBusy) return;
    this._stageBusy = true;
    if (this.selected) {
      this.selected.setLift(0);
      this.selected = null;
    }

    this.clearCount++;
    const oldSeg = this.activeSegment;
    const nextZ = oldSeg.worldZ + SEGMENT_DEPTH;
    const p = difficultyParams(this.clearCount);
    const nextSeg = new StageSegment({
      envMap: this.envMap,
      worldZ: nextZ,
      capacity: p.capacity,
      colorCount: p.colorCount,
      emptyCount: p.emptyCount,
      shuffleSteps: p.shuffleSteps,
      riseFromBelow: true,
    });
    this.scene.add(nextSeg.group);
    this._risingTubes = nextSeg.tubes;

    const lookTarget = nextZ;
    const camObj = { lookZ: this._lookZ };
    const tl = gsap.timeline({
      defaults: { ease: 'power2.inOut' },
      onComplete: () => {
        oldSeg.dispose();
        this.activeSegment = nextSeg;
        this.tubes = nextSeg.tubes;
        this._risingTubes = null;
        this._stageBusy = false;
        this._setStatus(`セグメント ${this.clearCount + 1} — 色 ${p.colorCount} / 層 ${p.capacity}`);
      },
    });

    tl.to(
      camObj,
      {
        lookZ: lookTarget,
        duration: 1.12,
        onUpdate: () => {
          this._lookZ = camObj.lookZ;
          this._applyCamera();
        },
      },
      0,
    );

    for (const t of nextSeg.tubes) {
      const y0 = t.userData.startBaseY ?? -2.85;
      const y1 = t.userData.targetBaseY ?? 0.78;
      const o = { v: y0 };
      tl.to(
        o,
        {
          v: y1,
          duration: 1.05,
          ease: 'power2.out',
          onUpdate: () => t.setBaseY(o.v),
        },
        0.04,
      );
    }
  }

  _onPointer(ev) {
    this.audio.resume();
    if (this._stageBusy) return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.tubes, true);
    if (hits.length === 0) return;
    let obj = hits[0].object;
    while (obj && !obj.userData.glass) obj = obj.parent;
    const glass = obj?.userData.glass;
    if (!glass || this._pouring) return;

    if (!this.selected) {
      this.selected = glass;
      glass.setLift(0.22);
      this.audio.playSelect();
      this._setStatus('注ぎ先を選んでください');
      return;
    }
    if (glass === this.selected) {
      this.selected.setLift(0);
      this.selected = null;
      this._setStatus('選択解除');
      return;
    }

    const src = this.selected;
    const dst = glass;
    const amt = canPourAmount(src, dst);
    if (amt <= 0) {
      this.audio.playSelect();
      this._setStatus('ここには注げません');
      return;
    }

    const pourColor = src.topColor()?.clone();
    if (!pourColor) return;

    this._pouring = true;
    this._pourA = src;
    this._pourB = dst;
    const srcStart = src.totalAmount();
    const dstStart = dst.totalAmount();
    const srcEnd = srcStart - amt;
    const dstEnd = dstStart + amt;

    const tilt = Math.sign(dst.position.x - src.position.x) * 0.62;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const mid = new THREE.Vector3();
    src.localToWorld(a.set(0, src.height * 0.42, 0));
    dst.localToWorld(b.set(0, dst.height * 0.42, 0));
    mid.copy(a).lerp(b, 0.5).add(new THREE.Vector3(0, -0.55, 0));
    this.stream.setArc(a, b, mid);

    const pourSound = this.audio.startPour();

    const prog = { t: 0 };
    const srcTilt = { z: 0 };
    const dstTilt = { z: 0 };
    const tl = gsap.timeline({
      defaults: { ease: 'power2.inOut' },
      onComplete: () => {
        pourSound.stop();
        this.stream.hide();
        src.setTiltZ(0);
        dst.setTiltZ(0);
        applyPour(src, dst, amt);
        src.updateLiquidShader(this.camera);
        dst.updateLiquidShader(this.camera);
        this.selected.setLift(0);
        this.selected = null;
        this._pouring = false;
        this._pourA = null;
        this._pourB = null;
        if (this._checkClear()) {
          this.audio.playClear();
          this._setStatus('クリア — 次のエリアへ');
          this._startStageTransition();
        } else {
          this._setStatus(`セグメント ${this.clearCount + 1}`);
        }
      },
    });

    tl.to(
      srcTilt,
      {
        z: tilt,
        duration: 0.22,
        ease: 'power2.out',
        onUpdate: () => src.setTiltZ(srcTilt.z),
      },
      0,
    );
    tl.to(
      dstTilt,
      {
        z: -tilt * 0.38,
        duration: 0.22,
        ease: 'power2.out',
        onUpdate: () => dst.setTiltZ(dstTilt.z),
      },
      0,
    );
    tl.to(
      prog,
      {
        t: 1,
        duration: 0.58,
        ease: 'power1.inOut',
        onUpdate: () => {
          const p = prog.t;
          const sVis = THREE.MathUtils.lerp(srcStart, srcEnd, p);
          const dVis = THREE.MathUtils.lerp(dstStart, dstEnd, p);
          src.updateLiquidShaderWithTotal(this.camera, sVis, null);
          dst.updateLiquidShaderWithTotal(this.camera, dVis, { pourColor });
        },
      },
      0.08,
    );
    tl.to(srcTilt, { z: 0, duration: 0.24, onUpdate: () => src.setTiltZ(srcTilt.z) }, '>-0.02');
    tl.to(dstTilt, { z: 0, duration: 0.24, onUpdate: () => dst.setTiltZ(dstTilt.z) }, '<');
  }

  _checkClear() {
    return this.tubes.every(isTubeSorted);
  }

  _loop() {
    requestAnimationFrame(this._loop);
    this._clock.getDelta();
    const skip = (t) => this._pouring && (t === this._pourA || t === this._pourB);
    for (const t of this.tubes) {
      if (skip(t)) continue;
      t.updateLiquidShader(this.camera);
    }
    if (this._risingTubes) {
      for (const t of this._risingTubes) {
        if (skip(t)) continue;
        t.updateLiquidShader(this.camera);
      }
    }
    this.renderer.render(this.scene, this.camera);
  }
}
