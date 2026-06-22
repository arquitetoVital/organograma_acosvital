import * as THREE from 'three';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * Converte lat/lon (graus) → posição na esfera de raio R.
 *
 * A fórmula casa exatamente com o mapeamento UV padrão da `SphereGeometry`
 * do three.js para uma textura equiretangular (borda esquerda = lon −180,
 * centro = lon 0, topo = polo norte). Assim os marcadores caem precisamente
 * sobre a geografia da textura `earth-day`.
 */
export function geoToVector(
  lat: number,
  lon: number,
  radius = 1,
  target = new THREE.Vector3(),
): THREE.Vector3 {
  const phi = (lon + 180) * DEG2RAD;   // azimute em torno de +Y
  const theta = (90 - lat) * DEG2RAD;  // ângulo polar a partir de +Y
  const sinT = Math.sin(theta);
  target.set(
    -radius * Math.cos(phi) * sinT,
    radius * Math.cos(theta),
    radius * Math.sin(phi) * sinT,
  );
  return target;
}

/** Inverso de {@link geoToVector}: vetor (qualquer raio) → { lat, lon } em graus. */
export function vectorToGeo(v: THREE.Vector3): { lat: number; lon: number } {
  const n = v.clone().normalize();
  const lat = 90 - Math.acos(THREE.MathUtils.clamp(n.y, -1, 1)) * RAD2DEG;
  let lon = Math.atan2(n.z, -n.x) * RAD2DEG - 180;
  // normaliza para [-180, 180]
  lon = ((lon + 180) % 360 + 360) % 360 - 180;
  return { lat, lon };
}

/**
 * Ponto subsolar (lat/lon onde o Sol está a pino) calculado pelo relógio UTC.
 * Mesma matemática do globo 2D — direciona a luz que cria o terminador dia/noite.
 */
export function subsolarPoint(now = new Date()): { lat: number; lon: number } {
  const doy =
    (now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 1)) / 86_400_000;
  const lat = -23.43659 * Math.cos((2 * Math.PI * (doy + 10)) / 365);
  const utcH =
    now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  const lon = (((12 - utcH) * 15 + 540) % 360) - 180;
  return { lat, lon };
}
