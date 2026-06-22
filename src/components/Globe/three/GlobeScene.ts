import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { geoToVector, vectorToGeo, subsolarPoint } from './geo';
import { loadEarthTextures } from './textures';
import { COUNTRY_LABELS } from '@/data/countryNames';
import type { GlobePoint } from '@/types/globe';

export type GlobeTheme = 'hub' | 'vital';

/** Grupo de pontos por proximidade — projetado para a tela a cada frame. */
export interface DotGroup {
  sx: number;
  sy: number;
  ids: number[];
  lat: number;
  lon: number;
}

interface CityProps { name: string; capital: boolean; pop: number; rank: number }
interface CityFeature { properties: CityProps; geometry: { coordinates: [number, number] } }

export interface SceneCallbacks {
  onZoom?: (pct: number) => void;
  onHover?: (t: { x: number; y: number; count: number; city: string } | null) => void;
  onPointClick?: (g: DotGroup) => void;
  onReady?: (photographic: boolean) => void;
}

const R = 1;                    // raio da Terra em unidades de cena
const DEFAULT_DIST = 3.0;       // distância inicial da câmera (≈ 100% de zoom)
const MIN_DIST = 1.14;
const MAX_DIST = 6.0;
const MAX_HUB_ARCS = 40;
const TAU = Math.PI * 2;
const DEG2RAD = Math.PI / 180;

// Vista inicial: centrada no Brasil (maioria dos pontos do dataset).
const HOME = { lat: -10, lon: -52 };

function slerpUnit(a: THREE.Vector3, b: THREE.Vector3, t: number, out: THREE.Vector3): THREE.Vector3 {
  const dot = THREE.MathUtils.clamp(a.dot(b), -1, 1);
  const omega = Math.acos(dot);
  if (omega < 1e-4) return out.copy(a);
  const so = Math.sin(omega);
  return out
    .copy(a)
    .multiplyScalar(Math.sin((1 - t) * omega) / so)
    .addScaledVector(b, Math.sin(t * omega) / so);
}

export class GlobeScene {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private raycaster = new THREE.Raycaster();
  private labelCanvas: HTMLCanvasElement;
  private lctx: CanvasRenderingContext2D;

  private sun = new THREE.DirectionalLight(0xfff4e6, 2.4);
  private ambient = new THREE.AmbientLight(0x5a6a8c, 0.8);
  private earth!: THREE.Mesh;
  private clouds: THREE.Mesh | null = null;
  private atmosphere!: THREE.Mesh;
  private stars!: THREE.Points;

  private cb: SceneCallbacks;
  private theme: GlobeTheme = 'hub';
  private points: GlobePoint[] = [];
  private focusedId: number | null = null;
  private autoRotate = true;

  // dados pré-computados
  private groups: { lat: number; lon: number; ids: number[] }[] = [];
  private hubArcs: { i: number; j: number; seed: number }[] = [];
  private cities: CityFeature[] = [];

  // estado do frame / interação
  private visibleGroups: DotGroup[] = [];
  private raf = 0;
  private timer = 0;
  private _err = false;
  private _rendered = false;
  private lastT = 0;
  private clock = 0;
  private ready = false;
  private destroyed = false;
  private lastZoomPct = -1;
  private introStart = 0;

  // animação "voar até" / reset
  private fly: {
    fromDir: THREE.Vector3;
    toDir: THREE.Vector3;
    fromDist: number;
    toDist: number;
    t: number;
    dur: number;
  } | null = null;
  private highlight: { lat: number; lon: number; until: number } | null = null;

  // reutilizáveis (sem alocação por frame)
  private _v = new THREE.Vector3();
  private _w = new THREE.Vector3();
  private _a = new THREE.Vector3();
  private _b = new THREE.Vector3();
  private _ndc = new THREE.Vector2();

  // estado de ponteiro
  private downX = 0;
  private downY = 0;
  private downMoved = 0;

  constructor(container: HTMLElement, cb: SceneCallbacks = {}) {
    this.container = container;
    this.cb = cb;

    const W = container.clientWidth || 800;
    const H = container.clientHeight || 600;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // ── renderer ──
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true, // necessário p/ export PNG
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(W, H);
    this.renderer.setClearColor(0x02030a, 1);
    const gl = this.renderer.domElement;
    gl.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    container.appendChild(gl);

    // ── overlay 2D (marcadores, arcos, rótulos) ──
    this.labelCanvas = document.createElement('canvas');
    this.labelCanvas.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    container.appendChild(this.labelCanvas);
    this.lctx = this.labelCanvas.getContext('2d')!;

    // ── câmera ──
    this.camera = new THREE.PerspectiveCamera(42, W / H, 0.01, 100);
    geoToVector(HOME.lat, HOME.lon, DEFAULT_DIST, this.camera.position);

    // ── controles ──
    this.controls = new OrbitControls(this.camera, gl);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = MIN_DIST;
    this.controls.maxDistance = MAX_DIST;
    this.controls.rotateSpeed = 0.55;
    this.controls.zoomSpeed = 0.8;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.32;
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
    this.controls.target.set(0, 0, 0);
    this.controls.update();

    // ── luzes ──
    this.scene.add(this.ambient);
    this.scene.add(this.sun);
    this.updateSun();

    // ── geometria ──
    this.buildStars();
    this.buildAtmosphere();
    this.buildEarth(); // assíncrono (texturas)

    // ── eventos ──
    this.attach();
    this.resize();

    this.loop = this.loop.bind(this);
    this.schedule();
  }

  // ── construção da cena ──────────────────────────────────────────────────

  private buildEarth() {
    // esfera-base imediata enquanto as texturas carregam
    const geo = new THREE.SphereGeometry(R, 96, 64);
    const mat = new THREE.MeshPhongMaterial({ color: 0x12233f, shininess: 12 });
    this.earth = new THREE.Mesh(geo, mat);
    this.scene.add(this.earth);

    loadEarthTextures()
      .then((tex) => {
        if (this.destroyed) return;
        mat.map = tex.day;
        mat.color.set(0xffffff);
        if (tex.normal) {
          mat.normalMap = tex.normal;
          mat.normalScale.set(0.8, 0.8);
        }
        if (tex.specular) {
          mat.specularMap = tex.specular;
          mat.specular.set(0x335577);
          mat.shininess = 18;
        }
        mat.needsUpdate = true;

        if (tex.clouds) {
          const cMat = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            alphaMap: tex.clouds,
            transparent: true,
            depthWrite: false,
            opacity: 0.85,
          });
          this.clouds = new THREE.Mesh(new THREE.SphereGeometry(R * 1.012, 96, 64), cMat);
          this.scene.add(this.clouds);
        }
        this.ready = true;
        this.cb.onReady?.(tex.photographic);
      })
      .catch(() => {
        this.ready = true;
        this.cb.onReady?.(false);
      });
  }

  private buildAtmosphere() {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0x3a86ff) } },
      vertexShader: `
        varying vec3 vN;
        varying vec3 vP;
        void main() {
          vN = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vP = mv.xyz;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor;
        varying vec3 vN;
        varying vec3 vP;
        void main() {
          vec3 viewDir = normalize(-vP);
          float fres = pow(1.0 - abs(dot(viewDir, vN)), 3.2);
          gl_FragColor = vec4(uColor, fres * 0.9);
        }`,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    this.atmosphere = new THREE.Mesh(new THREE.SphereGeometry(R * 1.16, 64, 48), mat);
    this.scene.add(this.atmosphere);
  }

  private buildStars() {
    const N = 1800;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    let seed = 1337;
    const rng = () => {
      const s = Math.sin(seed++ * 127.1) * 43758.5453;
      return s - Math.floor(s);
    };
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      // distribuição uniforme numa esfera distante
      const u = rng() * 2 - 1;
      const th = rng() * TAU;
      const r = 60;
      const sq = Math.sqrt(1 - u * u);
      pos[i * 3] = r * sq * Math.cos(th);
      pos[i * 3 + 1] = r * u;
      pos[i * 3 + 2] = r * sq * Math.sin(th);
      const temp = rng();
      c.setHSL(temp < 0.3 ? 0.6 : temp < 0.7 ? 0.58 : 0.1, 0.4, 0.6 + rng() * 0.3);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({
      size: 0.18,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    this.stars = new THREE.Points(g, m);
    this.scene.add(this.stars);
  }

  private updateSun() {
    const { lat, lon } = subsolarPoint();
    geoToVector(lat, lon, 10, this.sun.position);
  }

  // ── dados ─────────────────────────────────────────────────────────────────

  setData(points: GlobePoint[], theme: GlobeTheme) {
    this.theme = theme;
    this.points = points;

    // grupos por proximidade (4 casas decimais) — igual ao globo 2D
    const map = new Map<string, { lat: number; lon: number; ids: number[] }>();
    for (const p of points) {
      const key = `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`;
      const g = map.get(key);
      if (g) g.ids.push(p.id);
      else map.set(key, { lat: p.lat, lon: p.lon, ids: [p.id] });
    }
    this.groups = Array.from(map.values());

    // pares de arco (tema hub) limitados a MAX_HUB_ARCS
    const pairs: typeof this.hubArcs = [];
    outer: for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        pairs.push({ i, j, seed: ((points[i].id * 3 + points[j].id * 7) % 97) * 0.01 });
        if (pairs.length >= MAX_HUB_ARCS) break outer;
      }
    }
    this.hubArcs = pairs;
  }

  setTheme(theme: GlobeTheme) {
    if (this.theme !== theme) this.setData(this.points, theme);
  }

  setFocusedId(id: number | null) {
    this.focusedId = id;
  }

  async loadCities() {
    try {
      const data = (await (await fetch('/world-data/cities.json')).json()) as {
        features: CityFeature[];
      };
      this.cities = [...data.features].sort(
        (a, b) => a.properties.rank - b.properties.rank || b.properties.pop - a.properties.pop,
      );
    } catch {
      this.cities = [];
    }
  }

  // ── ações públicas (botões / props) ────────────────────────────────────────

  flyTo(lat: number, lon: number, opts: { zoomIn?: boolean; highlight?: boolean } = {}) {
    const dist = this.camDist();
    const toDist = opts.zoomIn ? Math.min(dist, DEFAULT_DIST * 0.55) : dist;
    this.fly = {
      fromDir: this.camera.position.clone().normalize(),
      toDir: geoToVector(lat, lon, 1).normalize(),
      fromDist: dist,
      toDist,
      t: 0,
      dur: 1100,
    };
    if (opts.highlight) this.highlight = { lat, lon, until: this.clock + 4200 };
    this.setAutoRotate(false);
  }

  resetView() {
    this.fly = {
      fromDir: this.camera.position.clone().normalize(),
      toDir: geoToVector(HOME.lat, HOME.lon, 1).normalize(),
      fromDist: this.camDist(),
      toDist: DEFAULT_DIST,
      t: 0,
      dur: 1000,
    };
    this.highlight = null;
  }

  setAutoRotate(on: boolean) {
    this.autoRotate = on;
    this.controls.autoRotate = on;
  }

  toggleAutoRotate(): boolean {
    this.setAutoRotate(!this.autoRotate);
    return this.autoRotate;
  }

  zoomBy(factor: number) {
    const dist = THREE.MathUtils.clamp(this.camDist() / factor, MIN_DIST, MAX_DIST);
    this.camera.position.setLength(dist);
    this.controls.update();
  }

  exportPNG(): string {
    // compõe WebGL + overlay 2D num canvas temporário
    const w = this.renderer.domElement.width;
    const h = this.renderer.domElement.height;
    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    const tctx = tmp.getContext('2d')!;
    this.renderer.render(this.scene, this.camera); // garante buffer atual
    tctx.drawImage(this.renderer.domElement, 0, 0, w, h);
    tctx.drawImage(this.labelCanvas, 0, 0, w, h);
    return tmp.toDataURL('image/png');
  }

  // ── loop / render ───────────────────────────────────────────────────────

  private camDist() {
    return this.camera.position.length();
  }

  /** Zoom equivalente ao globo 2D: raio aparente da Terra ÷ raio-base (min*0.41). */
  private zoomMetric(W: number, H: number) {
    const dist = this.camDist();
    const ang = Math.asin(Math.min(1, R / dist));
    const radiusPx = (ang / (this.camera.fov * DEG2RAD * 0.5)) * (H / 2);
    return radiusPx / (Math.min(W, H) * 0.41);
  }

  private loop(now: number) {
    if (this.destroyed) return;
    try {
      this.frame(now);
    } catch (e) {
      if (!this._err) {
        this._err = true;
        console.error('[GS] loop error', e);
      }
    }
    this.schedule();
  }

  /**
   * Agenda o próximo frame. Quando a aba está oculta o navegador pausa o
   * requestAnimationFrame; caímos para setTimeout (≈1fps) para a cena não
   * congelar — volta ao rAF de 60fps assim que a aba fica visível.
   */
  private schedule() {
    if (this.destroyed) return;
    if (typeof document !== 'undefined' && document.hidden) {
      this.timer = window.setTimeout(() => this.loop(performance.now()), 200);
    } else {
      this.raf = requestAnimationFrame(this.loop);
    }
  }

  private frame(now: number) {
    const dt = this.lastT ? Math.min(now - this.lastT, 100) : 16.7;
    this.lastT = now;
    this.clock += dt;

    // animação fly-to
    if (this.fly) {
      this.fly.t += dt / this.fly.dur;
      const k = this.fly.t >= 1 ? 1 : 1 - Math.pow(1 - this.fly.t, 3); // ease-out cubic
      slerpUnit(this.fly.fromDir, this.fly.toDir, k, this._v);
      const d = this.fly.fromDist + (this.fly.toDist - this.fly.fromDist) * k;
      this.camera.position.copy(this._v).multiplyScalar(d);
      if (this.fly.t >= 1) this.fly = null;
    }

    this.controls.update();
    if (this.clouds) this.clouds.rotation.y += (dt / 1000) * 0.006;
    if (this.stars) this.stars.rotation.y += (dt / 1000) * 0.002;

    // intro: fade-in suave de opacidade do globo
    if (this.ready && this.introStart === 0) this.introStart = now;

    this.renderer.render(this.scene, this.camera);
    this._rendered = true;
    this.drawOverlay();

    // reporta zoom
    const pct = Math.round(this.zoomMetric(this.labelCanvas.clientWidth, this.labelCanvas.clientHeight) * 100);
    if (pct !== this.lastZoomPct) {
      this.lastZoomPct = pct;
      this.cb.onZoom?.(pct);
    }
  }

  /** Projeta um ponto geográfico para px de tela; null se oculto pelo globo. */
  private projectGeo(lat: number, lon: number, W: number, H: number): { sx: number; sy: number; fade: number } | null {
    geoToVector(lat, lon, R, this._w);
    const camDist = this.camDist();
    const dotCP = this._w.dot(this.camera.position);
    if (dotCP <= R * R) return null; // hemisfério oculto
    const cosAng = dotCP / (R * camDist);
    const horizon = R / camDist;
    const fade = THREE.MathUtils.clamp((cosAng - horizon) / (1 - horizon), 0, 1);
    this._v.copy(this._w).project(this.camera);
    if (this._v.z > 1) return null;
    return { sx: (this._v.x * 0.5 + 0.5) * W, sy: (-this._v.y * 0.5 + 0.5) * H, fade };
  }

  private drawOverlay() {
    const ctx = this.lctx;
    const W = this.labelCanvas.clientWidth;
    const H = this.labelCanvas.clientHeight;
    if (!W || !H) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const z = this.zoomMetric(W, H);
    const t = this.clock / 1000;

    this.drawLabels(ctx, W, H, z);
    if (this.theme === 'hub') this.drawHubArcs(ctx, W, H, t);
    this.drawMarkers(ctx, W, H, t);
    this.drawHighlight(ctx, W, H, t);
  }

  // ── rótulos país/cidade ─────────────────────────────────────────────────

  private drawLabels(ctx: CanvasRenderingContext2D, W: number, H: number, z: number) {
    const occupied: [number, number, number, number][] = [];
    const PAD = 3;
    const overlaps = (x: number, y: number, w: number, h: number) => {
      for (const [ox, oy, ow, oh] of occupied) {
        if (x - PAD < ox + ow && x + w + PAD > ox && y - PAD < oy + oh && y + h + PAD > oy) return true;
      }
      return false;
    };

    // países
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const TIER_MIN: Record<number, number> = { 1: 0.6, 2: 0.8, 3: 1.2, 4: 1.7 };
    const TIER_SCALE: Record<number, number> = { 1: 1.15, 2: 0.95, 3: 0.78, 4: 0.64 };
    const baseFont = Math.max(8, Math.min(15, 11 * z));
    for (const c of COUNTRY_LABELS) {
      const tier = c.tier ?? 2;
      if (z < TIER_MIN[tier]) continue;
      const p = this.projectGeo(c.lat, c.lon, W, H);
      if (!p || p.fade < 0.16) continue;
      const fs = Math.max(6, Math.round(baseFont * TIER_SCALE[tier]));
      ctx.font = `500 ${fs}px "Fira Sans",system-ui,sans-serif`;
      const w = ctx.measureText(c.name).width;
      if (overlaps(p.sx - w / 2, p.sy - fs / 2, w, fs)) continue;
      occupied.push([p.sx - w / 2, p.sy - fs / 2, w, fs]);
      ctx.globalAlpha = p.fade * 0.85;
      ctx.lineWidth = Math.max(2, fs * 0.28);
      ctx.strokeStyle = 'rgba(2,6,20,0.95)';
      ctx.strokeText(c.name, p.sx, p.sy);
      ctx.fillStyle = '#a8ccff';
      ctx.fillText(c.name, p.sx, p.sy);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // cidades (densidade cresce com zoom) — só a partir de z>=1
    if (this.cities.length === 0 || z < 1) return;
    const maxRank = z < 1.3 ? 1 : z < 1.8 ? 3 : z < 2.3 ? 5 : z < 2.8 ? 7 : 10;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const cityBase = Math.max(8, Math.min(13, 7 + z * 1.8));
    for (const f of this.cities) {
      const { rank, capital, name } = f.properties;
      if (rank > maxRank) continue;
      const [lon, lat] = f.geometry.coordinates;
      const p = this.projectGeo(lat, lon, W, H);
      if (!p || p.fade < 0.12) continue;
      const dotR = capital ? 3 : 1.8;
      ctx.globalAlpha = p.fade * 0.92;
      if (capital) {
        ctx.save();
        ctx.translate(p.sx, p.sy);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#ffd73c';
        ctx.fillRect(-dotR, -dotR, dotR * 2, dotR * 2);
        ctx.restore();
      } else {
        ctx.fillStyle = '#c8e1ff';
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, dotR, 0, TAU);
        ctx.fill();
      }
      const minZ = rank <= 1 ? 1 : rank <= 3 ? 1.5 : rank <= 5 ? 2.1 : 2.7;
      if (z < minZ || p.fade < 0.2) continue;
      const fs = Math.max(7, Math.round(cityBase * (capital ? 1 : 0.9)));
      ctx.font = `${capital ? 600 : 400} ${fs}px "Fira Sans",system-ui,sans-serif`;
      const w = ctx.measureText(name).width;
      const lx = p.sx + dotR + 3;
      const ly = p.sy - fs / 2;
      if (overlaps(lx, ly, w, fs)) continue;
      occupied.push([lx, ly, w, fs]);
      ctx.globalAlpha = p.fade * 0.9;
      ctx.lineWidth = Math.max(2, fs * 0.28);
      ctx.strokeStyle = 'rgb(4,10,35)';
      ctx.strokeText(name, lx, p.sy);
      ctx.fillStyle = capital ? '#fff082' : '#bcdcff';
      ctx.fillText(name, lx, p.sy);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── arcos (tema hub) ──────────────────────────────────────────────────────

  private drawHubArcs(ctx: CanvasRenderingContext2D, W: number, H: number, t: number) {
    const pts = this.points;
    for (const { i, j, seed } of this.hubArcs) {
      if (i >= pts.length || j >= pts.length) continue;
      geoToVector(pts[i].lat, pts[i].lon, R, this._a).normalize();
      geoToVector(pts[j].lat, pts[j].lon, R, this._b).normalize();

      // polilinha do grande círculo
      const SEG = 28;
      ctx.beginPath();
      let started = false;
      let anyVisible = false;
      for (let s = 0; s <= SEG; s++) {
        slerpUnit(this._a, this._b, s / SEG, this._v);
        const { lat, lon } = vectorToGeo(this._v);
        const p = this.projectGeo(lat, lon, W, H);
        if (!p) { started = false; continue; }
        anyVisible = true;
        if (!started) { ctx.moveTo(p.sx, p.sy); started = true; }
        else ctx.lineTo(p.sx, p.sy);
      }
      if (!anyVisible) continue;
      ctx.strokeStyle = 'rgba(220,110,28,0.18)';
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,160,48,0.85)';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // partículas ao longo do arco
      for (let p = 0; p < 3; p++) {
        const spd = 0.22 + p * 0.12 + seed * 0.07;
        const off = p * 0.33 + seed * 0.5;
        const k = ((t * spd + off) % 1 + 1) % 1;
        slerpUnit(this._a, this._b, k, this._v);
        const { lat, lon } = vectorToGeo(this._v);
        const pp = this.projectGeo(lat, lon, W, H);
        if (!pp) continue;
        const sz = p === 0 ? 5 : p === 1 ? 3.5 : 2.4;
        const al = (p === 0 ? 1 : p === 1 ? 0.6 : 0.35) * pp.fade;
        const g = ctx.createRadialGradient(pp.sx, pp.sy, 0, pp.sx, pp.sy, sz * 2.4);
        g.addColorStop(0, `rgba(255,242,165,${al})`);
        g.addColorStop(0.4, `rgba(255,145,38,${al * 0.7})`);
        g.addColorStop(1, 'rgba(194,65,12,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(pp.sx, pp.sy, sz * 2.4, 0, TAU);
        ctx.fill();
      }
    }
  }

  // ── marcadores ────────────────────────────────────────────────────────────

  private drawMarkers(ctx: CanvasRenderingContext2D, W: number, H: number, t: number) {
    const pts = this.points;
    if (pts.length === 0) return;

    if (this.theme === 'vital') {
      const vis: DotGroup[] = [];
      for (const g of this.groups) {
        const p = this.projectGeo(g.lat, g.lon, W, H);
        if (!p || p.fade < 0.08) continue;
        vis.push({ sx: p.sx, sy: p.sy, ids: g.ids, lat: g.lat, lon: g.lon });
      }
      this.visibleGroups = vis;
      const dim = this.focusedId != null;
      const bulk = dim ? 0.12 : 1;

      if (!dim) {
        for (let ring = 0; ring < 2; ring++) {
          const ph = (t * 1.1 + ring * 0.5) % 1;
          const rad = ph * 20 + 4;
          ctx.globalAlpha = (1 - ph) * 0.42;
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (const g of vis) {
            ctx.moveTo(g.sx + rad, g.sy);
            ctx.arc(g.sx, g.sy, rad, 0, TAU);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      ctx.globalAlpha = bulk;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      for (const g of vis) { ctx.moveTo(g.sx + 5, g.sy); ctx.arc(g.sx, g.sy, 5, 0, TAU); }
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      for (const g of vis) { ctx.moveTo(g.sx + 2, g.sy); ctx.arc(g.sx, g.sy, 2, 0, TAU); }
      ctx.fill();
      ctx.globalAlpha = 1;

      // badges de contagem
      if (vis.some((g) => g.ids.length > 1)) {
        ctx.save();
        ctx.globalAlpha = bulk;
        ctx.font = 'bold 8px "Fira Sans",system-ui,sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const g of vis) {
          if (g.ids.length <= 1) continue;
          const bx = g.sx + 7, by = g.sy - 7;
          ctx.fillStyle = '#7f1d1d';
          ctx.beginPath();
          ctx.arc(bx, by, 7, 0, TAU);
          ctx.fill();
          ctx.strokeStyle = '#fca5a5';
          ctx.lineWidth = 0.8;
          ctx.stroke();
          ctx.fillStyle = '#fef2f2';
          ctx.fillText(g.ids.length > 99 ? '99+' : String(g.ids.length), bx, by);
        }
        ctx.restore();
      }

      // empresa em foco realçada por cima
      if (dim) {
        const fg = vis.find((g) => g.ids.includes(this.focusedId!));
        if (fg) {
          ctx.beginPath(); ctx.arc(fg.sx, fg.sy, 7, 0, TAU); ctx.fillStyle = '#ef4444'; ctx.fill();
          ctx.beginPath(); ctx.arc(fg.sx, fg.sy, 2.8, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
        }
      }
      return;
    }

    // ── tema hub: pinos + rótulos ──
    const visHub: { pt: GlobePoint; sx: number; sy: number; fade: number }[] = [];
    for (const pt of pts) {
      const p = this.projectGeo(pt.lat, pt.lon, W, H);
      if (!p || p.fade < 0.04) continue;
      visHub.push({ pt, sx: p.sx, sy: p.sy, fade: p.fade });
    }
    // (vital usa visibleGroups; hub não precisa de hit-test de grupo)
    this.visibleGroups = [];

    for (const { sx, sy, fade } of visHub) {
      for (let r = 0; r < 3; r++) {
        const ph = (t * 1.25 + r * 0.42) % 1;
        ctx.globalAlpha = (1 - ph) * 0.6 * fade;
        ctx.strokeStyle = 'rgb(194,65,12)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sx, sy, ph * 30 + 3, 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = fade;
      const og = ctx.createRadialGradient(sx, sy, 0, sx, sy, 24);
      og.addColorStop(0, 'rgba(255,125,42,0.9)');
      og.addColorStop(0.3, 'rgba(194,65,12,0.45)');
      og.addColorStop(1, 'rgba(194,65,12,0)');
      ctx.fillStyle = og;
      ctx.beginPath(); ctx.arc(sx, sy, 24, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(sx, sy, 5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ff7043';
      ctx.beginPath(); ctx.arc(sx, sy, 3, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // rótulos dos pinos (prioridade aos mais centrais)
    const occ: [number, number, number, number][] = [];
    const overlaps = (x: number, y: number, w: number, h: number) => {
      for (const [ox, oy, ow, oh] of occ) {
        if (x - 4 < ox + ow && x + w + 4 > ox && y - 4 < oy + oh && y + h + 4 > oy) return true;
      }
      return false;
    };
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '700 13px "Fira Sans",system-ui,sans-serif';
    for (const { pt, sx, sy, fade } of [...visHub].sort((a, b) => b.fade - a.fade)) {
      if (fade < 0.3) continue;
      const w = ctx.measureText(pt.label).width;
      const lx = sx + 14, ly = sy - 14;
      if (overlaps(lx, ly, w, 20)) continue;
      occ.push([lx, ly, w, 20]);
      ctx.globalAlpha = fade;
      ctx.shadowColor = 'rgba(2,6,23,0.98)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(pt.label, lx, sy - 4);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private drawHighlight(ctx: CanvasRenderingContext2D, W: number, H: number, t: number) {
    const hl = this.highlight;
    if (!hl || this.clock > hl.until) return;
    const p = this.projectGeo(hl.lat, hl.lon, W, H);
    if (!p) return;
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.85 + i / 3) % 1;
      ctx.globalAlpha = (1 - ph) * 0.75;
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, 9 + ph * 50, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(p.sx, p.sy, 11, 0, TAU);
    ctx.fillStyle = 'rgba(253,224,71,0.22)'; ctx.fill();
    ctx.strokeStyle = '#fde047'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(p.sx, p.sy, 4, 0, TAU);
    ctx.fillStyle = '#fff'; ctx.fill();
  }

  // ── interação ─────────────────────────────────────────────────────────────

  private findHitGroup(clientX: number, clientY: number): DotGroup | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const HIT = 18;
    let best: DotGroup | null = null;
    let bestD = Infinity;
    for (const g of this.visibleGroups) {
      const d = Math.hypot(mx - g.sx, my - g.sy);
      if (d < HIT && d < bestD) { bestD = d; best = g; }
    }
    return best;
  }

  private onPointerDown = (e: PointerEvent) => {
    this.downX = e.clientX;
    this.downY = e.clientY;
    this.downMoved = 0;
    this.cb.onHover?.(null);
  };

  private onPointerMove = (e: PointerEvent) => {
    const movedNow = Math.hypot(e.clientX - this.downX, e.clientY - this.downY);
    if (e.buttons) { this.downMoved = Math.max(this.downMoved, movedNow); return; }
    const gl = this.renderer.domElement;
    if (this.theme !== 'vital') { gl.style.cursor = 'grab'; return; }
    const hit = this.findHitGroup(e.clientX, e.clientY);
    gl.style.cursor = hit ? 'pointer' : 'grab';
    if (hit) {
      let nearest = '';
      let minD = Infinity;
      for (const c of this.cities) {
        const [cl, ca] = c.geometry.coordinates;
        const d = (cl - hit.lon) ** 2 + (ca - hit.lat) ** 2;
        if (d < minD) { minD = d; nearest = c.properties.name; }
      }
      const rect = gl.getBoundingClientRect();
      this.cb.onHover?.({ x: rect.left + hit.sx, y: rect.top + hit.sy, count: hit.ids.length, city: nearest });
    } else {
      this.cb.onHover?.(null);
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    const moved = Math.hypot(e.clientX - this.downX, e.clientY - this.downY);
    if (moved < 6 && this.theme === 'vital') {
      const hit = this.findHitGroup(e.clientX, e.clientY);
      if (hit) this.cb.onPointClick?.(hit);
    }
  };

  private onDblClick = (e: MouseEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this._ndc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this._ndc, this.camera);
    const hit = this.raycaster.intersectObject(this.earth, false)[0];
    if (hit) {
      const { lat, lon } = vectorToGeo(hit.point);
      this.flyTo(lat, lon, { zoomIn: false });
    }
  };

  private attach() {
    const gl = this.renderer.domElement;
    gl.addEventListener('pointerdown', this.onPointerDown);
    gl.addEventListener('dblclick', this.onDblClick);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
  }

  resize() {
    const W = this.container.clientWidth;
    const H = this.container.clientHeight;
    if (!W || !H) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.camera.aspect = W / H;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(W, H);
    this.labelCanvas.width = Math.round(W * dpr);
    this.labelCanvas.height = Math.round(H * dpr);
    this.labelCanvas.style.width = `${W}px`;
    this.labelCanvas.style.height = `${H}px`;
  }

  dispose() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    clearTimeout(this.timer);
    const gl = this.renderer.domElement;
    gl.removeEventListener('pointerdown', this.onPointerDown);
    gl.removeEventListener('dblclick', this.onDblClick);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.controls.dispose();
    this.scene.traverse((o) => {
      const any = o as unknown as { geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[] };
      any.geometry?.dispose?.();
      const m = any.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m?.dispose?.();
    });
    this.renderer.dispose();
    gl.remove();
    this.labelCanvas.remove();
  }
}
