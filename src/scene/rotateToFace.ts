import { FOCUS_PITCH_LIMIT, FOCUS_PITCH_SCALE, FOCUS_ROTATION_EPSILON, FOCUS_ROTATION_LERP } from "../constants";
import type { CardSlot } from "./layout";

export type FaceRotation = { yaw: number; pitch: number };

/** Returns the nearest target orientation that places a slot at the front. */
export function rotateToFaceCard(slot: Pick<CardSlot, "phi" | "theta">, currentYaw: number): FaceRotation {
  return {
    yaw: unwrapAngleNear(-slot.phi, currentYaw),
    pitch: Math.max(-FOCUS_PITCH_LIMIT, Math.min(FOCUS_PITCH_LIMIT, -slot.theta * FOCUS_PITCH_SCALE)),
  };
}

export function stepFaceRotation(current: FaceRotation, target: FaceRotation): FaceRotation {
  const yaw = stepAngle(current.yaw, target.yaw);
  const pitch = stepAngle(current.pitch, target.pitch);
  return { yaw, pitch };
}

export function unwrapAngleNear(target: number, current: number) {
  const turn = Math.PI * 2;
  while (target - current > Math.PI) target -= turn;
  while (target - current < -Math.PI) target += turn;
  return target;
}

function stepAngle(current: number, target: number) {
  if (Math.abs(target - current) <= FOCUS_ROTATION_EPSILON) return target;
  return current + (target - current) * FOCUS_ROTATION_LERP;
}
