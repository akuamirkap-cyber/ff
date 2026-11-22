import { Euler, Quaternion, Vector3 } from "three";
import type { DiverPose } from "./residents";

const pi = Math.PI,
  mix = (a: number, b: number, k: number) => a + (b - a) * k;
const euler = new Euler(),
  zAxis = new Vector3(0, 0, 1),
  forward = new Vector3(0, 0, -1);
const a = new Vector3(),
  c = new Vector3(),
  q = new Quaternion();
const center = new Vector3(0, 0.44, 0),
  neck = new Vector3(0, 0.612, 0);
const rightShoulder = new Vector3(0.155, 0.54, 0),
  palmInArm = new Vector3(0.182 - 0.155, 0.334 - 0.54, -0.03);

function skeleton() {
  return {
    body: new Quaternion(),
    head: new Quaternion(),
    weapon: new Quaternion(),
    world: new Quaternion(),
    rootOffset: new Vector3(),
    grip: new Vector3(),
    support: new Vector3(),
    muzzle: new Vector3(),
    barrel: new Vector3(),
    lamp: new Vector3(),
    light: new Vector3(),
    hipL: 0,
    hipR: 0,
    finL: 0,
    finR: 0,
    armLX: 0,
    armLZ: 0,
    armRX: 0,
    armRZ: 0,
    roll: 0,
  };
}
const poses = new WeakMap<DiverPose, ReturnType<typeof skeleton>>();

// A single rig supplies the renderer, the light sockets, and both ends of the tether.
// All positions returned here are in world coordinates with positive Y upwards.
export function crewPose(d: DiverPose) {
  let p = poses.get(d);
  if (!p) {
    p = skeleton();
    poses.set(d, p);
  }
  const amp = d.stroke,
    k = d.kick,
    scale = d.baseScale * d.depth * d.presence;
  const lean =
    mix(-1.02 - amp * 0.36, -0.69, d.head) + Math.cos(k * 2) * 0.027 * amp;
  p.roll = -d.pitch * d.dir;
  p.body.setFromEuler(euler.set(lean, d.yaw, Math.sin(k) * 0.075 * amp, "YXZ"));
  p.world.setFromAxisAngle(zAxis, p.roll).multiply(p.body);
  p.rootOffset
    .copy(center)
    .applyQuaternion(p.body)
    .multiplyScalar(-d.baseScale);
  p.head.setFromEuler(
    euler.set(
      -lean * 0.83 + Math.sin(k * 0.37) * 0.045,
      -d.dir * (0.24 + d.head * 0.34),
      0,
      "XYZ",
    ),
  );
  const push = Math.sin(k),
    opposite = -push;
  p.hipL = push * (0.12 + 0.44 * amp);
  p.hipR = opposite * (0.12 + 0.44 * amp);
  p.finL = -0.96 + Math.cos(k - 0.36) * (0.13 + 0.34 * amp);
  p.finR = -0.96 - Math.cos(k - 0.36) * (0.13 + 0.34 * amp);
  p.armLX = -0.22 + Math.sin(k * 0.5) * (0.12 + 0.23 * amp);
  p.armLZ = -0.24 - 0.13 * Math.cos(k * 0.5);
  p.armRX = mix(-0.22 - Math.sin(k * 0.5) * 0.24, 2.35, d.wave);
  p.armRZ = mix(
    0.26 + 0.11 * Math.cos(k * 0.5),
    0.49 + Math.sin(k * 2.6) * 0.32,
    d.wave,
  );

  const worldPoint = (v: Vector3) =>
    v
      .sub(center)
      .applyQuaternion(p.world)
      .multiplyScalar(scale)
      .add(c.set(d.x, -d.y, 0));
  p.grip.copy(rightShoulder);
  // Iterate the actual mitten pivot to align the held prop without lengthening either arm.
  for (let i = 0; i < 4; i++) {
    const hand = worldPoint(a.copy(p.grip));
    const angle =
      Math.atan2(-d.aimY - hand.y, Math.abs(d.aimX - hand.x)) * d.dir;
    q.setFromEuler(euler.set(0, -d.dir * pi * 0.5, angle, "ZYX"));
    p.weapon.copy(p.world).invert().multiply(q);
    p.grip.copy(palmInArm).applyQuaternion(p.weapon).add(rightShoulder);
  }
  p.barrel.copy(forward).applyQuaternion(q).normalize();
  worldPoint(
    p.muzzle.set(0, 0.023, -0.373).applyQuaternion(p.weapon).add(p.grip),
  );
  worldPoint(
    p.lamp
      .set(0, 0.343 * 1.47, -0.078 * 1.47)
      .applyQuaternion(p.head)
      .add(neck),
  );
  p.light
    .copy(forward)
    .applyQuaternion(p.head)
    .applyQuaternion(p.world)
    .normalize();
  return p;
}

export function subYaw(dir: number, time: number, i: number) {
  return -dir * (Math.PI * 0.635 + Math.sin(time * 0.075 + i) * 0.055);
}

export const subLens = (side: number) =>
  new Vector3(side * 0.56, -0.34, -1.986);
export function subLightDirection(side: number, t: number) {
  return new Vector3(
    side * 0.035 + Math.sin(t * 0.13) * 0.07,
    -0.12 + Math.sin(t * 0.21 + side * 0.24) * 0.07,
    -1,
  ).normalize();
}
