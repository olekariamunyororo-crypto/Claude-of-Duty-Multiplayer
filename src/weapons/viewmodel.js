import * as THREE from 'three';
import { Arm, HAND_POSES } from './hands.js';
import { buildClips, makeSampleResult } from './clips.js';
import { triCount, mergeAll } from './geometry.js';
import {
  Spring, Spring3, Noise1, clamp, clamp01, lerp, damp, smootherstep, wrapPi, TAU,
} from './mathx.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'XYZ');
const _m = new THREE.Matrix4();

function shapeMasks(geo, o) {
  const col = geo.getAttribute('color');
  if (!col) return geo;
  const a = col.array;
  const amp = [o.wearAmp ?? 1, o.grimeAmp ?? 1, o.aoAmp ?? 1];
  const exp = [o.wearExp ?? 1, o.grimeExp ?? 1, o.aoExp ?? 1];
  for (let i = 0; i < a.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = a[i + k];
      a[i + k] = Math.pow(Math.max(0, Math.min(1, v)), exp[k]) * amp[k];
    }
  }
  col.needsUpdate = true;
  return geo;
}

function handBasis(out, finger, back) {
  _v.set(-finger[0], -finger[1], -finger[2]).normalize();
  _v2.set(back[0], back[1], back[2]);
  _v2.addScaledVector(_v, -_v2.dot(_v));
  if (_v2.lengthSq() < 1e-8) _v2.set(0, 1, 0).addScaledVector(_v, -_v.y);
  _v2.normalize();
  _v3.crossVectors(_v2, _v).normalize();
  _m.makeBasis(_v3, _v2, _v);
  return out.setFromRotationMatrix(_m);
}

export class Viewmodel {
  constructor(ctx, mats) {
    this.ctx = ctx;
    this.mats = mats;
    this.rng = ctx.rng.fork();
    this.anchor = new THREE.Object3D();
    this.anchor.name = 'ow-viewmodel-anchor';
    this.rig = new THREE.Object3D();
    this.rig.name = 'ow-viewmodel-rig';
    this.anchor.add(this.rig);
    ctx.viewScene.add(this.anchor);

    const handMats = {
      glove: mats.get('glove'),
      pad: mats.get('glove_pad'),
      seam: mats.get('glove_seam'),
      sleeve: mats.get('sleeve'),
    };

    this.armR = new Arm(1, handMats, {
      scale: 1,
      shoulderX: 0.205,
      shoulderY: -0.2,
      shoulderZ: 0.06,
      pose: 'grip',
    });
    // Natural support arm: longer bones, lower/inboard shoulder, elbow hangs down-outboard
    this.armL = new Arm(-1, handMats, {
      scale: 1,
      upper: 0.40,
      fore: 0.36,
      shoulderX: 0.18,
      shoulderY: -0.28,
      shoulderZ: 0.04,
      pole: [-0.50, -0.94, 0.05],
      pose: 'clamp',
    });
    this.rig.add(this.armR.root);
    this.rig.add(this.armL.root);

    const bakeArms = this.mats.lib?.bakeMasks?.bind(this.mats.lib) ?? null;
    if (bakeArms) {
      this.armR.bakeSurfaceMasks(bakeArms, shapeMasks, this.rng);
      this.armL.bakeSurfaceMasks(bakeArms, shapeMasks, this.rng);
    }

    this.shoulderR = new THREE.Vector3(0.205, -0.2, 0.06);
    this.shoulderL = new THREE.Vector3(-0.18, -0.28, 0.04);

    this.reticle = new THREE.Object3D();
    this.reticle.name = 'ow-reticle';
    this.anchor.add(this.reticle);

    this.weapon = null;
    this.weaponId = null;
    this.triggerT = 0;
    this._handPos = new THREE.Vector3();
    this._handQuat = new THREE.Quaternion();
    this._handPosL = new THREE.Vector3();
    this._handQuatL = new THREE.Quaternion();
    this.clipResult = makeSampleResult();
    this.sway = new Spring3(18, 0.85);
    this.bob = new Spring3(14, 0.9);
    this.lag = new Spring3(12, 0.75);
    this.recoilPos = new Spring3(28, 0.55);
    this.recoilRot = new Spring3(32, 0.5);
    this.adsT = 0;
    this.drawT = 1;
  }

  setWeapon(w) {
    if (this.weapon) {
      this.rig.remove(this.weapon.group);
    }
    this.weapon = w;
    this.weaponId = w?.id ?? null;
    if (w) {
      this.rig.add(w.group);
      this.armR.setPose('grip');
      this.armL.setPose(w.lhandPose ?? (w.id === 'pistol' ? 'cup' : 'clamp'));
      try {
        this.armL.setPose('clamp');
        const gL = w.gripL;
        if (gL && w.model?.nodes?.handguard) {
          this._handPosL.fromArray(gL.pos);
          handBasis(this._handQuatL, gL.finger ?? [0.82, 0.5, -0.28], gL.back ?? [-0.5, 0.32, -0.8]);
          const contacts = this.armL.fitToCylinder(
            this._handPosL, this._handQuatL,
            new THREE.Vector3().fromArray(w.model.nodes.handguard.axis || [0, 0.075, 0]),
            new THREE.Vector3().fromArray(w.model.nodes.handguard.dir || [0, 0, 1]),
            w.model.nodes.handguard.r || 0.027,
            {}
          );
          this.armL.bakeContactAO(contacts || [], 0.012, 0.7);
        }
      } catch (e) { /* support fit is best-effort */ }
    }
  }

  update(dt, state) {
    if (!this.weapon) return;
    const w = this.weapon;
    const ads = state?.ads ?? 0;
    this.adsT = damp(this.adsT, ads, 12, dt);

    // Camera-follow anchor
    const cam = this.ctx.camera;
    if (cam) {
      this.anchor.position.copy(cam.position);
      this.anchor.quaternion.copy(cam.quaternion);
    }

    // Simple hip pose
    this.rig.position.set(0.04, -0.08, -0.28);
    this.rig.rotation.set(0.02, 0.04, 0);

    this._solveHands(w, this.clipResult);
  }

  _solveHands(w, res) {
    _q.copy(this.rig.quaternion).invert();
    _v.copy(this.shoulderR).sub(this.rig.position).applyQuaternion(_q);
    this.armR.shoulder.copy(_v);
    _v.copy(this.shoulderL).sub(this.rig.position).applyQuaternion(_q);
    this.armL.shoulder.copy(_v);

    const gR = w.gripR;
    if (gR) {
      this._handPos.fromArray(gR.pos);
      handBasis(this._handQuat, gR.finger ?? [0, -0.35, -0.94], gR.back ?? [0.95, 0.25, 0.18]);
      this.armR.solve(this._handPos, this._handQuat);
      this.armR.setTrigger(this.triggerT);
    }

    const gL = w.gripL;
    if (gL) {
      let pos = gL.pos;
      let finger = gL.finger ?? [0.82, 0.5, -0.28];
      let back = gL.back ?? [-0.5, 0.32, -0.8];
      let pose = w.lhandPose ?? (w.id === 'pistol' ? 'cup' : 'clamp');
      this._handPosL.set(pos[0], pos[1], pos[2]);
      handBasis(this._handQuatL, finger, back);
      if (pose !== this.armL.pose) this.armL.setPose(pose);
      this.armL.solve(this._handPosL, this._handQuatL);
    }
  }

  dispose() {
    this.armR.dispose();
    this.armL.dispose();
  }
}
