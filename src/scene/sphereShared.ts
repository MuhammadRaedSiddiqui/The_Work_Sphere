import * as THREE from "three";
import { CONNECTOR_LINE_OPACITY } from "../constants";
import { buildConnectorPairs, cardSlots, SPHERE_RADIUS } from "./layout";

export const HERO_OUTSIDE_TARGET_FRACTION = 0.70;
export const SPECIMEN_OUTSIDE_TARGET_FRACTION = 0.72;
export const OUTSIDE_FOG_NEAR_MULTIPLIER = 0.75;
export const OUTSIDE_FOG_FAR_MULTIPLIER = 1.85;
export const SPHERE_IDLE_SPEED = 0.045;
export const SPHERE_MOMENTUM_DECAY = 2.6;
export const SPHERE_IDLE_RESUME_EPSILON = 0.01;
export const SPHERE_DRAG_TO_RADIANS = 0.005;

const tangentHelper = new THREE.Object3D();
const worldUp = new THREE.Vector3(0, 1, 0);
const tangentDirection = new THREE.Vector3();

export function solveOutsideCameraDistance(fovDegrees: number, targetFraction = HERO_OUTSIDE_TARGET_FRACTION): number {
  const halfTan = Math.tan((fovDegrees * Math.PI) / 360);
  return halfTan > 1e-6 ? SPHERE_RADIUS / (targetFraction * halfTan) : SPHERE_RADIUS * 2.5;
}

export function outsideFogDistances(distance: number) {
  return { near: distance * OUTSIDE_FOG_NEAR_MULTIPLIER, far: distance * OUTSIDE_FOG_FAR_MULTIPLIER };
}

export function tangentQuaternion(outwardPosition: THREE.Vector3, target = new THREE.Quaternion()): THREE.Quaternion {
  tangentDirection.copy(outwardPosition).normalize();
  if (Math.abs(tangentDirection.y) > 0.999) tangentDirection.x += 0.001;
  tangentDirection.normalize();
  tangentHelper.position.copy(outwardPosition);
  tangentHelper.up.copy(worldUp);
  tangentHelper.lookAt(tangentHelper.position.clone().add(tangentDirection));
  return target.copy(tangentHelper.quaternion);
}

export function createSphereCardMaterial(map: THREE.Texture | null) {
  return new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map,
    transparent: true,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
    fog: true,
  });
}

export function createSphereConnectorLines(opacity = CONNECTOR_LINE_OPACITY) {
  const pairs = buildConnectorPairs();
  const basePositions = new Float32Array(pairs.length * 6);
  pairs.forEach(([a, b], index) => basePositions.set([...cardSlots[a].position, ...cardSlots[b].position], index * 6));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(basePositions), 3));
  const material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity, depthWrite: false, depthTest: false, fog: true });
  const lines = new THREE.LineSegments(geometry, material);
  lines.renderOrder = -1;
  return { lines, pairs, basePositions };
}

export function outsidePointerDelta(dx: number, dy: number) {
  return { dx: -dx, dy: -dy };
}
