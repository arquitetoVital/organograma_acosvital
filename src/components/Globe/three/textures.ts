import * as THREE from 'three';

/**
 * Texturas do planeta. As reais (NASA/Blue-Marble derivadas) ficam em
 * `public/world-data/textures/`. Se algum arquivo faltar, geramos uma textura
 * equiretangular procedural a partir do GeoJSON já usado pelo app — assim o
 * globo nunca quebra (a "fallback" exigida pelo plano de migração).
 */

const BASE = '/world-data/textures';

export interface EarthTextures {
  day: THREE.Texture;
  normal: THREE.Texture | null;
  specular: THREE.Texture | null;
  clouds: THREE.Texture | null;
  /** true quando o mapa de cor veio de arquivo real (não do fallback). */
  photographic: boolean;
}

function loadOne(url: string, colorSpace: THREE.ColorSpace): Promise<THREE.Texture | null> {
  return new Promise((resolve) => {
    new THREE.TextureLoader().load(
      url,
      (tex) => {
        tex.colorSpace = colorSpace;
        tex.anisotropy = 8;
        resolve(tex);
      },
      undefined,
      () => resolve(null),
    );
  });
}

// ── Fallback procedural ───────────────────────────────────────────────────
// Pinta continentes do countries-110m.json numa projeção equiretangular.
// Reaproveita a paleta de biomas do globo 2D para parecer "Terra de verdade".

function biomeColor(lon: number, lat: number): string {
  if (lat > 70 || lat < -62) return '#dce9fb';            // gelo polar
  if (lat > 58) return '#163420';                          // boreal/taiga
  const arid =
    (lon >= -17 && lon <= 25 && lat >= 14 && lat <= 34) ||
    (lon >= 25 && lon <= 60 && lat >= 12 && lat <= 36) ||
    (lon >= 113 && lon <= 150 && lat >= -40 && lat <= -16) ||
    (lon >= -76 && lon <= -66 && lat >= -30 && lat <= -14);
  if (arid) return '#bc9858';                              // deserto
  const tropical =
    (lon >= -80 && lon <= -44 && lat >= -14 && lat <= 7) ||
    (lon >= 14 && lon <= 32 && lat >= -8 && lat <= 6) ||
    (lon >= 95 && lon <= 145 && lat >= -10 && lat <= 15);
  if (tropical) return '#0f4814';                          // floresta tropical
  return '#1c4119';                                        // temperado
}

async function proceduralEarth(): Promise<{ day: THREE.Texture; specular: THREE.Texture }> {
  const W = 2048;
  const H = 1024;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;

  // oceano (gradiente vertical sutil)
  const oc = ctx.createLinearGradient(0, 0, 0, H);
  oc.addColorStop(0, '#0a1a30');
  oc.addColorStop(0.5, '#122848');
  oc.addColorStop(1, '#0a1a30');
  ctx.fillStyle = oc;
  ctx.fillRect(0, 0, W, H);

  // máscara especular: oceano branco (brilha), terra preta (fosca)
  const spec = document.createElement('canvas');
  spec.width = W;
  spec.height = H;
  const sctx = spec.getContext('2d')!;
  sctx.fillStyle = '#ffffff';
  sctx.fillRect(0, 0, W, H);

  const lonToX = (lon: number) => ((lon + 180) / 360) * W;
  const latToY = (lat: number) => ((90 - lat) / 180) * H;

  try {
    const [d3geo, topo] = await Promise.all([import('d3-geo'), import('topojson-client')]);
    const data = await (await fetch('/world-data/countries-110m.json')).json();
    const fc = topo.feature(data, data.objects.countries) as unknown as {
      features: GeoJSON.Feature[];
    };

    const proj = d3geo
      .geoEquirectangular()
      .scale(W / (2 * Math.PI))
      .translate([W / 2, H / 2]);
    const pathDay = d3geo.geoPath(proj, ctx);
    const pathSpec = d3geo.geoPath(proj, sctx);

    for (const feat of fc.features) {
      const [clon, clat] = d3geo.geoCentroid(feat as never);
      ctx.beginPath();
      pathDay(feat as never);
      ctx.fillStyle = biomeColor(clon, clat);
      ctx.fill();
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.stroke();

      sctx.beginPath();
      pathSpec(feat as never);
      sctx.fillStyle = '#000000';
      sctx.fill();
    }
    void lonToX;
    void latToY;
  } catch {
    // sem GeoJSON: deixa só oceano — ainda renderiza um planeta plausível
  }

  const day = new THREE.CanvasTexture(cv);
  day.colorSpace = THREE.SRGBColorSpace;
  day.anisotropy = 8;
  const specular = new THREE.CanvasTexture(spec);
  specular.colorSpace = THREE.NoColorSpace;
  return { day, specular };
}

export async function loadEarthTextures(): Promise<EarthTextures> {
  const [day, normal, specular, clouds] = await Promise.all([
    loadOne(`${BASE}/earth-day-2k.jpg`, THREE.SRGBColorSpace),
    loadOne(`${BASE}/earth-normal-2k.jpg`, THREE.NoColorSpace),
    loadOne(`${BASE}/earth-specular-2k.jpg`, THREE.NoColorSpace),
    loadOne(`${BASE}/earth-clouds-1k.png`, THREE.SRGBColorSpace),
  ]);

  if (day) {
    return { day, normal, specular, clouds, photographic: true };
  }

  // Fallback: nenhuma textura real — gera tudo a partir do GeoJSON.
  const proc = await proceduralEarth();
  return { day: proc.day, normal: null, specular: proc.specular, clouds, photographic: false };
}
