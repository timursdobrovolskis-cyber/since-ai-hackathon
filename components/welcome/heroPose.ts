// Shared by the realistic engine room and the line-work pump, so the hand-off between them lines up exactly.
import * as THREE from "three";

export const FOV = 30;
export const CAMERA_Z = 16;
/** Longest side of the pump model. The build tool scales it to span -1 to 1. */
export const MODEL_LENGTH = 2;

export function halfSize(aspect: number) {
  const halfH = CAMERA_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  return { halfH, halfW: halfH * aspect };
}

/** Fit the pump to a share of the screen width, capped by a share of its height. */
export const fitPump = (halfW: number, halfH: number, share: number, heightShare: number) =>
  Math.min((share * 2 * halfW) / MODEL_LENGTH, (heightShare * 2 * halfH) / MODEL_LENGTH);

/** The line-work pump's first pose, where the engine room hands over: scale, position and rotation. */
export function heroStart(halfW: number, halfH: number) {
  return { scale: fitPump(halfW, halfH, 1.25, 1.1), y: -halfH * 0.02, rotation: new THREE.Euler(0.38, -0.62, 0) };
}

/**
 * The same view as a camera in the pump's own space. The line-work canvas keeps its camera still and moves the pump;
 * scaling a scene about the camera does not change the picture, so this rigid camera sees exactly the same pump.
 */
export function heroCamera(halfW: number, halfH: number) {
  const { scale, y, rotation } = heroStart(halfW, halfH);
  const inverse = new THREE.Quaternion().setFromEuler(rotation).invert();
  const position = new THREE.Vector3(0, -y, CAMERA_Z).divideScalar(scale).applyQuaternion(inverse);
  return { position, quaternion: inverse };
}
