import * as THREE from 'three';
import liquidVert from './shaders/liquid.vert?raw';
import liquidFrag from './shaders/liquid.frag?raw';

const MAX_LAYERS = 8;
const dummyVec3 = new THREE.Vector3();
const _axisBottom = new THREE.Vector3();
const _axisTop = new THREE.Vector3();

/**
 * 円柱グラス + ShaderMaterial 液体（液面は世界 Y でクリップ）
 */
export class GlassTube extends THREE.Group {
  /**
   * @param {{ radius: number; height: number; capacity: number; envMap?: THREE.Texture }} opts
   */
  constructor(opts) {
    super();
    this.radius = opts.radius;
    this.height = opts.height;
    this.capacity = opts.capacity;
    this.envMap = opts.envMap ?? null;

    /** @type {{ color: THREE.Color; amount: number }[]} 下から上 */
    this.layers = [];

    this._baseY = 0;
    this._lift = 0;
    this._tiltZ = 0;

    const glassGeo = new THREE.CylinderGeometry(
      this.radius,
      this.radius * 0.92,
      this.height,
      48,
      1,
      false,
    );
    const glassMat = this.envMap
      ? new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          metalness: 0,
          roughness: 0.08,
          transmission: 1,
          thickness: this.radius * 0.45,
          ior: 1.45,
          transparent: true,
          opacity: 0.35,
          envMap: this.envMap,
          envMapIntensity: 1.1,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      : new THREE.MeshPhysicalMaterial({
          color: 0xe8f2ff,
          metalness: 0.02,
          roughness: 0.18,
          transmission: 0.35,
          thickness: this.radius * 0.35,
          ior: 1.45,
          transparent: true,
          opacity: 0.55,
          envMap: null,
          envMapIntensity: 0,
          clearcoat: 0.35,
          clearcoatRoughness: 0.2,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
    this.glassMesh = new THREE.Mesh(glassGeo, glassMat);
    this.glassMesh.castShadow = true;
    this.glassMesh.receiveShadow = true;
    this.add(this.glassMesh);

    const liquidGeo = new THREE.CylinderGeometry(
      this.radius * 0.88,
      this.radius * 0.84,
      this.height * 0.96,
      64,
      1,
      true,
    );
    const layerColors = [];
    const layerEnds = [];
    for (let i = 0; i < MAX_LAYERS; i++) {
      layerColors.push(new THREE.Vector3(0.2, 0.45, 0.95));
      layerEnds.push(1);
    }
    this.liquidUniforms = {
      uAxisBottom: { value: new THREE.Vector3() },
      uAxisTop: { value: new THREE.Vector3() },
      uRadius: { value: this.radius * 0.88 },
      uSurfaceY: { value: 0 },
      uTSurface: { value: 0 },
      uTFloor: { value: 0 },
      uLayerCount: { value: 0 },
      uColors: { value: layerColors },
      uLayerEndT: { value: layerEnds },
      uCameraPosition: { value: new THREE.Vector3() },
      uAmbient: { value: new THREE.Vector3(0.12, 0.14, 0.18) },
      uLightDir: { value: new THREE.Vector3(0.35, 1, 0.25).normalize() },
      uLightColor: { value: new THREE.Vector3(1, 0.98, 0.94) },
    };
    const liquidMat = new THREE.ShaderMaterial({
      uniforms: this.liquidUniforms,
      vertexShader: liquidVert,
      fragmentShader: liquidFrag,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: true,
    });
    this.liquidMesh = new THREE.Mesh(liquidGeo, liquidMat);
    this.liquidMesh.renderOrder = 1;
    this.add(this.liquidMesh);

    const rimGeo = new THREE.TorusGeometry(this.radius * 1.01, this.radius * 0.035, 12, 48);
    const rimMat = this.envMap
      ? new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          metalness: 0.9,
          roughness: 0.2,
          envMap: this.envMap,
          envMapIntensity: 1,
        })
      : new THREE.MeshPhysicalMaterial({
          color: 0xdde8ff,
          metalness: 0.65,
          roughness: 0.28,
          envMap: null,
          envMapIntensity: 0,
        });
    this.rimMesh = new THREE.Mesh(rimGeo, rimMat);
    this.rimMesh.rotation.x = Math.PI / 2;
    this.rimMesh.position.y = this.height / 2;
    this.add(this.rimMesh);

    this.glassMesh.position.y = 0;
    this.liquidMesh.position.y = 0;
  }

  dispose() {
    this.glassMesh.geometry.dispose();
    this.glassMesh.material.dispose();
    this.liquidMesh.geometry.dispose();
    this.liquidMesh.material.dispose();
    this.rimMesh.geometry.dispose();
    this.rimMesh.material.dispose();
  }

  /** 現在の液体ユニット合計 */
  totalAmount() {
    let s = 0;
    for (const L of this.layers) s += L.amount;
    return s;
  }

  /** 空き容量 */
  spaceLeft() {
    return Math.max(0, this.capacity - this.totalAmount());
  }

  /** 一番上の層の色（無ければ null） */
  topColor() {
    if (this.layers.length === 0) return null;
    return this.layers[this.layers.length - 1].color.clone();
  }

  /** 一番上から連続する同色の量 */
  topRunAmount() {
    if (this.layers.length === 0) return 0;
    const c = this.layers[this.layers.length - 1].color.getHex();
    let a = 0;
    for (let i = this.layers.length - 1; i >= 0; i--) {
      if (this.layers[i].color.getHex() !== c) break;
      a += this.layers[i].amount;
    }
    return a;
  }

  setLift(offset) {
    this._lift = offset;
    this._applyPose();
  }

  setTiltZ(rad) {
    this._tiltZ = rad;
    this._applyPose();
  }

  setBaseY(y) {
    this._baseY = y;
    this._applyPose();
  }

  _applyPose() {
    this.position.y = this._baseY + this._lift;
    this.rotation.z = this._tiltZ;
  }

  /** @param {THREE.Camera} camera */
  updateLiquidShader(camera) {
    this.updateMatrixWorld(true);
    const h = this.height * 0.96;
    const half = h / 2;
    _axisBottom.set(0, -half, 0);
    _axisTop.set(0, half, 0);
    this.localToWorld(_axisBottom);
    this.localToWorld(_axisTop);

    this.liquidUniforms.uAxisBottom.value.copy(_axisBottom);
    this.liquidUniforms.uAxisTop.value.copy(_axisTop);
    this.liquidUniforms.uCameraPosition.value.setFromMatrixPosition(camera.matrixWorld);

    const total = this.totalAmount();
    const cap = Math.max(this.capacity, 1e-4);
    const fillT = total / cap;
    const innerHalf = h / 2;

    if (total < 1e-6) {
      this.liquidUniforms.uTSurface.value = 0;
      this.liquidUniforms.uTFloor.value = 0;
      this.liquidUniforms.uSurfaceY.value = -1e6;
      this.liquidUniforms.uLayerCount.value = 0;
      return;
    }

    dummyVec3.copy(_axisBottom).lerp(_axisTop, fillT);
    this.liquidUniforms.uTSurface.value = fillT;
    this.liquidUniforms.uTFloor.value = 0;
    this.liquidUniforms.uSurfaceY.value = dummyVec3.y;

    const uColors = this.liquidUniforms.uColors.value;
    const uEnds = this.liquidUniforms.uLayerEndT.value;
    let acc = 0;
    const n = Math.min(this.layers.length, MAX_LAYERS);
    this.liquidUniforms.uLayerCount.value = n;
    for (let i = 0; i < MAX_LAYERS; i++) {
      if (i < n) {
        const L = this.layers[i];
        acc += L.amount / Math.max(total, 1e-4);
        uColors[i].set(L.color.r, L.color.g, L.color.b);
        uEnds[i] = acc;
      } else {
        uEnds[i] = 1;
      }
    }
  }

  /**
   * 注ぎアニメーション用に液面を一時的に上書き（t と world Y）
   */
  /**
   * @param {number} visualTotal
   * @param {{ pourColor?: THREE.Color } | null} pour 注ぎ先で液量が増えるときの色
   */
  updateLiquidShaderWithTotal(camera, visualTotal, pour = null) {
    const tmp = this._buildDisplayLayers(visualTotal, pour);
    const prev = this.layers;
    this.layers = tmp;
    this.updateLiquidShader(camera);
    this.layers = prev;
  }

  /**
   * @param {number} visualTotal
   * @param {{ pourColor?: THREE.Color } | null} pour
   */
  _buildDisplayLayers(visualTotal, pour) {
    const cap = Math.max(this.capacity, 1e-4);
    const vt = THREE.MathUtils.clamp(visualTotal, 0, cap);
    const out = [];
    let acc = 0;
    for (let i = 0; i < this.layers.length; i++) {
      const L = this.layers[i];
      const next = acc + L.amount;
      if (next <= vt + 1e-6) {
        out.push({ color: L.color.clone(), amount: L.amount });
        acc = next;
        continue;
      }
      const remain = vt - acc;
      if (remain > 1e-6) {
        out.push({ color: L.color.clone(), amount: remain });
        acc = vt;
      }
      break;
    }
    if (acc + 1e-6 < vt && pour?.pourColor) {
      const need = vt - acc;
      const last = out[out.length - 1];
      if (last && last.color.getHex() === pour.pourColor.getHex()) {
        last.amount += need;
      } else {
        out.push({ color: pour.pourColor.clone(), amount: need });
      }
      acc = vt;
    }
    return out;
  }
}

/**
 * 放物線状の液体ストリーム（細いチューブメッシュ）
 */
export class PourStream extends THREE.Group {
  constructor() {
    super();
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xa8d8ff,
      metalness: 0,
      roughness: 0.25,
      transparent: true,
      opacity: 0.85,
      emissive: 0x224466,
      emissiveIntensity: 0.35,
      depthWrite: false,
    });
    this.material = mat;
    this.mesh = null;
    this.visible = false;
  }

  /**
   * @param {THREE.Vector3} a 世界座標
   * @param {THREE.Vector3} b
   * @param {THREE.Vector3} mid 制御点
   */
  setArc(a, b, mid) {
    if (this.mesh) {
      this.remove(this.mesh);
      this.mesh.geometry.dispose();
    }
    const curve = new THREE.QuadraticBezierCurve3(a.clone(), mid.clone(), b.clone());
    const geo = new THREE.TubeGeometry(curve, 24, 0.045, 8, false);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.add(this.mesh);
    this.visible = true;
  }

  hide() {
    this.visible = false;
    if (this.mesh) {
      this.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
  }

  dispose() {
    this.hide();
    this.material.dispose();
  }
}
