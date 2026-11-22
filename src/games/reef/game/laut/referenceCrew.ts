import * as T from "three";
import type { PEntityBuilt } from "../penyelam/meshes.js";
import { entityGeometry, type Palette } from "./geometry";
import { litMaterial } from "./glsl";

export const CREW = [
  { name: "Captain Ashford", suit: [0.76, 0.51, 0.12], badge: 0.11 },
  { name: "Nathaniel", suit: [0.21, 0.36, 0.5], badge: 0.56 },
  { name: "Beatrice", suit: [0.6, 0.25, 0.16], badge: 0.03 },
] as const;

// The exterior pilot is PENYELAM's submarine part 5, not a newly sculpted head.
// The dry uniform shares the 0.68 figure scale encoded by addWindowDiver.
export function pilotStation(
  ship: PEntityBuilt,
  diver: PEntityBuilt,
  pal: Palette,
  instruments: PEntityBuilt,
) {
  const station = new T.Group(),
    material = litMaterial({ fog: 0.01 });
  const neck = new T.Vector3(0, -0.05, -2.02),
    pilot = new T.Group();
  pilot.position.copy(neck);
  pilot.name = "Captain Ashford";
  const signature = entityGeometry(ship, (_m, p) => p === 5, pal);
  signature.translate(-neck.x, -neck.y, -neck.z);
  const head = new T.Mesh(signature, material);
  head.name = "PENYELAM:submarine/part-5";
  pilot.add(head);
  station.add(pilot);
  const figure = new T.Group();
  figure.scale.setScalar(0.68);
  figure.position.set(0, neck.y - 0.612 * 0.68, neck.z);
  figure.name = "PENYELAM:dry-uniform";
  figure.add(
    new T.Mesh(
      entityGeometry(diver, (_m, p) => p === 0 || p === 4 || p === 5, pal),
      material,
    ),
  );
  const arms = [0, 1].map((k) => {
    const x = k ? 0.145 : -0.145,
      y = 0.545;
    const geom = entityGeometry(diver, (_m, p) => p === k + 2, pal).translate(
      -x,
      -y,
      0,
    );
    const m = new T.Mesh(geom, material);
    m.position.set(x, y, 0);
    figure.add(m);
    return m;
  });
  station.add(figure);
  const wheelMesh = entityGeometry(
    instruments,
    (_m, p) => p === 1,
    (m) =>
      m === 22
        ? [0.31, 0.17, 0.082, 0.05, 0.2]
        : [0.76, 0.58, 0.25, 0.055, 0.8],
  );
  wheelMesh.translate(0, 0.315, 0.315);
  const wheel = new T.Mesh(wheelMesh, material);
  wheel.name = "PENYELAM:bridge/8-spoke-helm";
  wheel.scale.setScalar(0.68);
  wheel.position.set(0, -0.168, -2.16);
  station.add(wheel);
  const lining=litMaterial({fog:.012});lining.side=T.DoubleSide;
  const lowerBridge=new T.Mesh(entityGeometry(instruments,(m,p,z,y)=>p===0&&z<.16&&y<-.18&&(m===20||m===22),m=>m===22?[.24,.135,.076,.02,.14]:[.27,.235,.155,.035,.72]),lining);
  lowerBridge.name="PENYELAM:bridge/deck-and-tub";
  lowerBridge.scale.set(.85,.85,.86);lowerBridge.position.set(0,-.075,-1.79);station.add(lowerBridge);
  const bulkhead = new T.Mesh(
    new T.CircleGeometry(0.626, 36),
    new T.MeshBasicMaterial({ color: 0x354037, side: T.DoubleSide }),
  );
  bulkhead.position.set(0, 0.018, -1.855);
  station.add(bulkhead);
  const restBounds = new T.Box3().setFromBufferAttribute(
    signature.getAttribute("position") as T.BufferAttribute,
  );
  pilot.userData.reference = {
    part: 5,
    scale: 1,
    source: "buildSubmarineMesh",
    headBounds: restBounds.getSize(new T.Vector3()).toArray(),
  };
  function animate(t: number, dir: number) {
    const turn = Math.sin(t * 0.38) * 0.27;
    pilot.position.set(
      neck.x + 0.01 * Math.cos(t * 1.5),
      neck.y + 0.014 * Math.sin(t * 2.2),
      neck.z,
    );
    pilot.rotation.y = dir * (0.37 + 0.1 * Math.sin(t * 0.48));
    wheel.rotation.z = turn;
    arms.forEach((m, i) => {
      const side = i ? 1 : -1;
      m.rotation.set(
        1.06 + side * turn * 0.3,
        0,
        -side * 0.3 + turn * 0.08,
        "ZXY",
      );
    });
  }
  animate(0, 1);
  return { station, pilot, wheel, arms, animate };
}
