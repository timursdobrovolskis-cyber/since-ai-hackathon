// Hidden-line drawing, shared by the engine room and the moving pump so both draw exactly the same lines.
//
// A scene is rendered once into a buffer that stores each pixel's surface direction, the line weight of its part and
// its depth. An edge shader then draws a line wherever the depth jumps (outlines) or the surface folds (creases).
// Lines behind other parts never appear, because only the nearest surface is in the buffer.
//
// Parts get their weight from `weighted(w)`, 0 to 1. A weight of exactly 1 marks the focus part (Pump 8), which keeps
// full strength when the rest is dimmed.
import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** A surface that draws its outline at `weight`. Stored as the buffer's alpha. */
export const weighted = (weight: number) =>
  new THREE.MeshNormalMaterial({ opacity: weight, blending: THREE.NoBlending, side: THREE.DoubleSide });

/** Reads "PMSH" from tools/build_pump_edges.mjs and gives the mesh creased normals, so its folds draw as lines. */
export function parsePumpMesh(buf: ArrayBuffer) {
  const view = new DataView(buf);
  const vertices = view.getUint32(4, true);
  const indexCount = view.getUint32(8, true);
  const ints = new Int16Array(buf, 12, vertices * 3);
  const pos = new Float32Array(ints.length);
  for (let i = 0; i < ints.length; i++) pos[i] = ints[i] / 32767;
  const start = 12 + vertices * 6;
  const index = vertices > 65535 ? new Uint32Array(buf, start, indexCount) : new Uint16Array(buf.slice(start, start + indexCount * 2));
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(index, 1));
  return toCreasedNormals(g, THREE.MathUtils.degToRad(35));
}

const fragmentShader = /* glsl */ `
  #include <packing>
  uniform sampler2D tNormal;
  uniform sampler2D tDepth;
  uniform vec2 texel;
  uniform float cameraNear;
  uniform float cameraFar;
  uniform vec3 ink;
  uniform vec3 lineColor;
  uniform float strength;
  uniform float focusStrength;
  uniform float opacity;
  uniform vec2 fade;
  uniform bool clearBackground;
  varying vec2 vUv;

  float viewDepth(vec2 uv) {
    return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, cameraNear, cameraFar);
  }

  void main() {
    vec4 c = texture2D(tNormal, vUv);
    float d = viewDepth(vUv);
    vec3 n = c.xyz * 2.0 - 1.0;
    float depthEdge = 0.0;
    float foldEdge = 0.0;
    float weight = c.a;
    vec2 offs[4];
    offs[0] = vec2(texel.x, 0.0);
    offs[1] = vec2(-texel.x, 0.0);
    offs[2] = vec2(0.0, texel.y);
    offs[3] = vec2(0.0, -texel.y);
    for (int i = 0; i < 4; i++) {
      vec2 uv = vUv + offs[i];
      vec4 ci = texture2D(tNormal, uv);
      float di = viewDepth(uv);
      // Outlines: a jump in depth, relative to how far away the surface is, so it works at any scale.
      depthEdge = max(depthEdge, smoothstep(0.012, 0.035, abs(di - d) / min(d, di)));
      // Folds: neighbours facing different ways on the same surface.
      if (ci.a > 0.0 && c.a > 0.0) foldEdge = max(foldEdge, smoothstep(0.18, 0.45, 1.0 - dot(n, ci.xyz * 2.0 - 1.0)));
      // The nearer part of an outline decides how bright it draws.
      weight = (di < d || c.a == 0.0) ? max(weight, ci.a) : weight;
    }
    // Everything except the focus part can be dimmed.
    float dim = weight > 0.995 ? focusStrength : strength;
    float near = 1.0 - smoothstep(fade.x, fade.y, min(d, cameraFar));
    float line = clamp(max(depthEdge, foldEdge) * weight * mix(0.3, 1.0, near) * dim, 0.0, 1.0) * opacity;
    if (clearBackground) gl_FragColor = vec4(lineColor * line, line);
    else gl_FragColor = vec4(mix(ink, lineColor, line), 1.0);
  }
`;

export type LineRenderer = ReturnType<typeof createLineRenderer>;

/**
 * `clearBackground` true draws lines on a transparent canvas, so the page shows behind them. False fills with ink.
 * Colours are display values (0 to 1 sRGB): the shader writes straight to the screen with no colour conversion.
 */
export function createLineRenderer(renderer: THREE.WebGLRenderer, opts: { clearBackground: boolean; near: number; far: number }) {
  const buffer = new THREE.WebGLRenderTarget(1, 1, {
    depthTexture: new THREE.DepthTexture(1, 1),
    magFilter: THREE.NearestFilter,
    minFilter: THREE.NearestFilter,
  });
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tNormal: { value: buffer.texture },
      tDepth: { value: buffer.depthTexture },
      texel: { value: new THREE.Vector2() },
      cameraNear: { value: opts.near },
      cameraFar: { value: opts.far },
      ink: { value: new THREE.Vector3(11 / 255, 16 / 255, 20 / 255) },
      lineColor: { value: new THREE.Vector3(1, 1, 1) },
      strength: { value: 1 },
      focusStrength: { value: 1 },
      opacity: { value: 1 },
      // Distance where lines start and finish fading. Far away by default, so nothing fades.
      fade: { value: new THREE.Vector2(1000, 2000) },
      clearBackground: { value: opts.clearBackground },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
    transparent: opts.clearBackground,
    blending: opts.clearBackground ? THREE.NoBlending : THREE.NormalBlending,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const inkClear = new THREE.Color().setRGB(11 / 255, 16 / 255, 20 / 255, THREE.SRGBColorSpace);

  return {
    uniforms: material.uniforms as {
      lineColor: { value: THREE.Vector3 };
      strength: { value: number };
      focusStrength: { value: number };
      opacity: { value: number };
      fade: { value: THREE.Vector2 };
    },
    setSize(width: number, height: number, pixelRatio: number) {
      const w = Math.max(1, Math.round(width * pixelRatio));
      const h = Math.max(1, Math.round(height * pixelRatio));
      buffer.setSize(w, h);
      material.uniforms.texel.value.set(1 / w, 1 / h);
    },
    render(scene: THREE.Scene, camera: THREE.Camera) {
      renderer.autoClear = false;
      renderer.setRenderTarget(buffer);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      if (opts.clearBackground) renderer.setClearColor(0x000000, 0);
      else renderer.setClearColor(inkClear, 1);
      renderer.clear();
      renderer.render(quadScene, quadCamera);
    },
    dispose() {
      buffer.depthTexture?.dispose();
      buffer.dispose();
      material.dispose();
      quad.geometry.dispose();
    },
  };
}
