import { AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, ShaderMaterial, type Vector3 } from "three";

type Linear = [number, number, number];
/** A saber's glow and its white-hot centre, as linear colours. */
export const SABER_RED: Linear = [1, .07, .035], SABER_RED_CORE: Linear = [1, .78, .72];

/** Blade glow: a quad turned about the blade axis to face the camera, shaded as a
 * white-hot core inside a red falloff with rounded ends. */
export function bladeGlow(start: Vector3, end: Vector3, radius: number, tint: Linear = SABER_RED, core: Linear = SABER_RED_CORE) {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute([-1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 1, 0], 3));
  geometry.setIndex([0, 1, 2, 1, 3, 2]);
  const material = new ShaderMaterial({
    uniforms: { bladeStart: { value: start }, bladeEnd: { value: end }, radius: { value: radius }, intensity: { value: 1 }, tint: { value: new Color(...tint) }, core: { value: new Color(...core) } },
    vertexShader: /* glsl */ `
      uniform vec3 bladeStart;
      uniform vec3 bladeEnd;
      uniform float radius;
      varying vec2 vLocal;
      varying float vLength;
      varying float vRadius;
      void main() {
        vec3 a = (modelMatrix * vec4(bladeStart, 1.0)).xyz;
        vec3 b = (modelMatrix * vec4(bladeEnd, 1.0)).xyz;
        float r = radius * length(modelMatrix[0].xyz);
        vec3 axis = b - a;
        float len = length(axis);
        vec3 dir = axis / len;
        float along = mix(-r, len + r, position.y);
        vec3 p = a + dir * along;
        vec3 side = normalize(cross(dir, cameraPosition - p));
        p += side * position.x * r;
        vLocal = vec2(position.x * r, along);
        vLength = len;
        vRadius = r;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float intensity;
      uniform vec3 tint;
      uniform vec3 core;
      varying vec2 vLocal;
      varying float vLength;
      varying float vRadius;
      void main() {
        float t = clamp(vLocal.y, 0.0, vLength);
        float d = length(vec2(vLocal.x, vLocal.y - t)) / vRadius;
        float centre = 1.0 - smoothstep(.08, .16, d);
        float glow = (exp(-d * d * 14.0) * .85 + exp(-d * 4.5) * .22) * (1.0 - smoothstep(.75, 1.0, d));
        vec3 colour = tint * glow * 1.35 + core * centre * .9;
        gl_FragColor = vec4(colour * intensity, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  });
  return { geometry, material };
}

