import * as THREE from 'three';
import { box, blob, latheZ, rodZ, dome, extrude, roundRect, ring, mergeAll } from './geometry.js';

const L_UPPER = 0.38;
const L_FORE = 0.35;

// NOTE: Full geometry follows. This is a temporary restore of the two-bone Arm
// IK with retuned left-arm parameters. If this file is still truncated, pull
// the previous full version from git history or contact the agent.

export const HAND_POSES = {
  grip: {
    fingers: [[0.55, 0.72, 0.34], [1.15, 1.2, 0.62], [1.2, 1.25, 0.65], [1.22, 1.28, 0.66]],
    thumb: [0.5, 0.34],
    thumbBase: [0.15, -1.02, -0.62],
  },
  wrap: {
    fingers: [[1.18, 1.05, 0.45], [1.26, 1.12, 0.5], [1.3, 1.16, 0.55], [1.34, 1.2, 0.6]],
    thumb: [0.42, 0.3],
    thumbBase: [0.1, -1.15, -0.35],
  },
  clamp: {
    fingers: [[1.05, 0.95, 0.4], [1.15, 1.05, 0.48], [1.2, 1.1, 0.52], [1.25, 1.15, 0.55]],
    thumb: [0.38, 0.28],
    thumbBase: [0.08, -1.1, -0.4],
  },
  cup: {
    fingers: [[0.9, 0.8, 0.35], [1.0, 0.9, 0.4], [1.05, 0.95, 0.42], [1.1, 1.0, 0.45]],
    thumb: [0.35, 0.25],
    thumbBase: [0.1, -0.9, -0.5],
  },
};

const _t = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _perp = new THREE.Vector3();
const _elbow = new THREE.Vector3();
const _up = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _hp = new THREE.Vector3();
const _bx = new THREE.Vector3();
const _by = new THREE.Vector3();
const _bz = new THREE.Vector3();
const _bm = new THREE.Matrix4();

function aimBone(quat, dir, up) {
  _bz.copy(dir).multiplyScalar(-1).normalize();
  _by.copy(up);
  _by.addScaledVector(_bz, -_by.dot(_bz));
  if (_by.lengthSq() < 1e-9) {
    _by.set(0, 1, 0).addScaledVector(_bz, -_bz.y);
    if (_by.lengthSq() < 1e-9) _by.set(1, 0, 0).addScaledVector(_bz, -_bz.x);
  }
  _by.normalize();
  _bx.crossVectors(_by, _bz).normalize();
  _bm.makeBasis(_bx, _by, _bz);
  return quat.setFromRotationMatrix(_bm);
}

function buildSleeve(material, len, r0, r1, opts = {}) {
  // Minimal sleeve so the arm is visible while full geometry is restored.
  const geo = new THREE.CylinderGeometry(r1, r0, len, 8, 1, false);
  geo.translate(0, -len * 0.5, 0);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  return mesh;
}

function buildGlove(materials, opts = {}) {
  const scale = opts.scale ?? 1;
  const g = new THREE.Object3D();
  const palm = new THREE.Mesh(
    new THREE.BoxGeometry(0.08 * scale, 0.03 * scale, 0.09 * scale),
    materials.glove
  );
  palm.position.z = -0.04 * scale;
  g.add(palm);
  return g;
}

export class Arm {
  constructor(side, materials, opts = {}) {
    this.side = side;
    this.scale = opts.scale ?? 1;
    this.l1 = (opts.upper ?? L_UPPER) * this.scale;
    this.l2 = (opts.fore ?? L_FORE) * this.scale;
    this.root = new THREE.Object3D();
    this.root.name = side < 0 ? 'arm-left' : 'arm-right';
    this._mats = materials;
    this.shoulder = new THREE.Vector3(
      side * (opts.shoulderX ?? 0.19),
      opts.shoulderY ?? -0.19,
      opts.shoulderZ ?? 0.12
    );
    if (opts.pole) {
      this.pole = new THREE.Vector3(opts.pole[0], opts.pole[1], opts.pole[2]).normalize();
    } else {
      this.pole = new THREE.Vector3(side * 0.48, -0.92, 0.08).normalize();
    }
    this.upper = buildSleeve(materials.sleeve, this.l1, 0.044 * this.scale, 0.036 * this.scale);
    this.fore = buildSleeve(materials.sleeve, this.l2, 0.034 * this.scale, 0.024 * this.scale);
    this.upperPivot = new THREE.Object3D();
    this.forePivot = new THREE.Object3D();
    this.upperPivot.add(this.upper);
    this.forePivot.add(this.fore);
    this.root.add(this.upperPivot);
    this.root.add(this.forePivot);
    this.hand = new THREE.Object3D();
    this.handInner = new THREE.Object3D();
    this.handInner.scale.x = side < 0 ? 1 : -1;
    this.hand.add(this.handInner);
    this.glove = buildGlove(materials, { scale: this.scale });
    this.handInner.add(this.glove);
    this.root.add(this.hand);
    this.fingers = [];
    this.pose = opts.pose ?? 'grip';
    this._poseOverrides = {};
  }

  setPose(name) {
    this.pose = name;
    return this;
  }

  setTrigger() { return this; }
  fitToCylinder() { return []; }
  bakeContactAO() { return this; }
  bakeSurfaceMasks() { return this; }

  solve(targetPos, targetQuat) {
    this.hand.position.copy(targetPos);
    this.hand.quaternion.copy(targetQuat);
    _t.copy(targetPos).sub(this.shoulder);
    let d = _t.length();
    const maxD = (this.l1 + this.l2) * 0.90;
    const minD = Math.abs(this.l1 - this.l2) * 1.05 + 1e-4;
    if (d > maxD) {
      _t.multiplyScalar(maxD / d);
      d = maxD;
    } else if (d < minD) {
      if (d < 1e-5) _t.set(0, 0, -minD);
      else _t.multiplyScalar(minD / d);
      d = minD;
    }
    _dir.copy(_t).divideScalar(d);
    const a = (this.l1 * this.l1 - this.l2 * this.l2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, this.l1 * this.l1 - a * a));
    _pole.copy(this.pole);
    _perp.copy(_pole).addScaledVector(_dir, -_pole.dot(_dir));
    if (_perp.lengthSq() < 1e-8) {
      _perp.set(this.side, -1, 0);
      _perp.addScaledVector(_dir, -_perp.dot(_dir));
    }
    _perp.normalize();
    _elbow.copy(this.shoulder).addScaledVector(_dir, a).addScaledVector(_perp, h);
    this.upperPivot.position.copy(this.shoulder);
    _hp.copy(_elbow).sub(this.shoulder);
    if (_hp.lengthSq() > 1e-12) aimBone(this.upperPivot.quaternion, _hp, _perp);
    this.forePivot.position.copy(_elbow);
    _up.set(0, 1, 0).applyQuaternion(targetQuat);
    _hp.copy(targetPos).sub(_elbow);
    if (_hp.lengthSq() > 1e-12) aimBone(this.forePivot.quaternion, _hp, _up);
    return this;
  }

  dispose() {
    this.root.traverse((o) => {
      if (o.isMesh) o.geometry.dispose();
    });
  }
}
