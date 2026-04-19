precision highp float;

#define MAX_LAYERS 8

varying vec3 vWorldPosition;
varying vec3 vObjectNormal;

uniform vec3 uAxisBottom;
uniform vec3 uAxisTop;
uniform float uRadius;
uniform float uSurfaceY;
uniform float uTSurface;
uniform float uTFloor;
uniform int uLayerCount;
uniform vec3 uColors[MAX_LAYERS];
uniform float uLayerEndT[MAX_LAYERS];
uniform vec3 uCameraPosition;
uniform vec3 uAmbient;
uniform vec3 uLightDir;
uniform vec3 uLightColor;

float saturate(float x) {
  return clamp(x, 0.0, 1.0);
}

void main() {
  vec3 p = vWorldPosition;
  vec3 axis = normalize(uAxisTop - uAxisBottom);
  float h = length(uAxisTop - uAxisBottom);
  float t = dot(p - uAxisBottom, axis) / max(h, 1e-4);
  vec3 radialVec = (p - uAxisBottom) - axis * dot(p - uAxisBottom, axis);
  float radial = length(radialVec);

  if (radial > uRadius - 1e-4) discard;
  if (t < 0.002 || t > 0.998) discard;
  if (p.y > uSurfaceY + 1e-4) discard;
  if (t < uTFloor) discard;
  if (t > uTSurface + 1e-4) discard;

  float span = max(uTSurface - uTFloor, 1e-4);
  float tn = (t - uTFloor) / span;
  vec3 baseColor = vec3(0.35, 0.55, 0.95);
  float layerW = 1.0 / float(max(uLayerCount, 1));
  for (int i = 0; i < MAX_LAYERS; i++) {
    if (i >= uLayerCount) break;
    float end = uLayerEndT[i];
    if (tn <= end + 1e-5) {
      baseColor = uColors[i];
      break;
    }
  }

  vec3 N = normalize(vObjectNormal);
  vec3 V = normalize(uCameraPosition - p);
  float NdotL = saturate(dot(N, normalize(-uLightDir)));
  float NdotV = saturate(dot(N, V));
  float fresnel = pow(1.0 - NdotV, 3.0);

  vec3 diffuse = baseColor * (uAmbient + uLightColor * NdotL);
  vec3 emissive = baseColor * 0.08;
  vec3 spec = uLightColor * pow(saturate(dot(reflect(normalize(uLightDir), N), V)), 48.0) * 0.35;

  float alpha = 0.78 + fresnel * 0.18;
  vec3 outRgb = diffuse + emissive + spec;
  gl_FragColor = vec4(outRgb, alpha);
}
