import * as THREE from 'three';

let cachedSoftwareGl: boolean | null = null;

/**
 * Probes WebGL2 renderer string once per session to detect software rasterizers
 * (SwiftShader, llvmpipe, softpipe) without exhausting WebGL contexts across modal mounts.
 */
export function isSoftwareGlEnvironment(): boolean {
  if (cachedSoftwareGl !== null) {
    return cachedSoftwareGl;
  }
  try {
    const canvas = document.createElement('canvas');
    const probe = canvas.getContext('webgl2');
    if (!probe) {
      cachedSoftwareGl = true;
      return true;
    }
    const ext = probe.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
    const gpu = String(probe.getParameter(param) || '');
    probe.getExtension('WEBGL_lose_context')?.loseContext();
    cachedSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    cachedSoftwareGl = true;
  }
  return cachedSoftwareGl;
}

const MATERIAL_TEXTURE_KEYS = [
  'map',
  'alphaMap',
  'aoMap',
  'bumpMap',
  'displacementMap',
  'emissiveMap',
  'envMap',
  'lightMap',
  'metalnessMap',
  'normalMap',
  'roughnessMap',
  'specularMap',
] as const;

function disposeMaterialAndTextures(mat: THREE.Material) {
  const record = mat as unknown as Record<string, unknown>;
  for (const key of MATERIAL_TEXTURE_KEYS) {
    const tex = record[key];
    if (tex instanceof THREE.Texture && !tex.userData?.isSharedCache) {
      tex.dispose();
    }
  }
  mat.dispose();
}

/**
 * Recursively disposes geometries, materials, and per-instance textures
 * (preserving shared cached textures marked with `userData.isSharedCache = true`).
 */
export function disposeObjectTree(root: THREE.Object3D | null | undefined) {
  if (!root) return;
  root.traverse((child) => {
    const withGeo = child as THREE.Mesh;
    if (withGeo.geometry) {
      withGeo.geometry.dispose();
    }
    const withMat = child as THREE.Mesh | THREE.Sprite | THREE.Points | THREE.Line;
    if (withMat.material) {
      if (Array.isArray(withMat.material)) {
        withMat.material.forEach(disposeMaterialAndTextures);
      } else {
        disposeMaterialAndTextures(withMat.material);
      }
    }
  });
}
