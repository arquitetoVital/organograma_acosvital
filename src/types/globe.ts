export interface GlobePoint {
  id: number;
  lat: number;
  lon: number;
  label: string;
}

export interface Star {
  x: number;
  y: number;
  r: number;
  b: number;
  spd: number;
  c: number; // 0=blue-white, 0.5=white, 1=warm-yellow
}
