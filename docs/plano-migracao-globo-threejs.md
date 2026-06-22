# Plano de migração — GlobeCanvas 2D → Three.js (híbrido fotográfico)

> **Objetivo:** substituir o motor de render do globo (canvas 2D + projeção `d3-geo`)
> por uma cena **Three.js** com texturas reais da NASA (Blue Marble + bump + specular +
> nuvens), **mantendo toda a camada de dados e interação** (marcadores de clientes,
> "voar até", rótulos, hit-test, temas hub/vital).
>
> **Modo escolhido:** híbrido — visual fotográfico **E** paridade total de interação.

---

## Princípio diretor

**Não reescrever o componente. Substituir o motor.**

O `GlobeCanvas` continua exportando a mesma interface e renderizando o mesmo JSX de
overlay. Só o miolo — o `draw()` 2D + projeção d3 — vira uma cena Three.js. Tudo que é
React/DOM (painéis, tooltip, botões, stats, fullscreen) **fica idêntico**, apenas
reconectando os handlers à câmera 3D.

Isso garante que `GlobePanel`, `ClientesView`, `UnidadesView` e `GlobeSidebar`
**não mudam uma linha**.

### Contrato externo a preservar (não pode quebrar)

Props do componente:

```ts
interface Props {
  points: GlobePoint[];
  theme?: 'hub' | 'vital';
  onPointClick?: (group: DotGroup) => void;
  focusTarget?: { lat: number; lon: number; nonce: number } | null;
  focusedId?: number | null;
  hideInfoOverlays?: boolean;
}
```

Overlay DOM/React que permanece intacto: `titleOverlay`, `controlPanel`
(fullscreen, auto-rotate, reset, export PNG, zoom +/−, % de zoom), `tooltip`,
`sideText`, `statsBar`.

---

## 1. Dependências e assets

```bash
npm i three
npm i -D @types/three
```

- `+~600 KB` no bundle (tree-shakeable; usando só core + `OrbitControls` +
  `CSS2DRenderer` fica menor).
- Continua carregado via `dynamic(() => import(...), { ssr: false })` no consumidor.

### Texturas

Em `public/world-data/textures/` (carregar via `TextureLoader`, todas com fallback):

| Asset | Fonte | Uso |
|---|---|---|
| `earth-blue-marble-8k.jpg` (ou 4k p/ mobile) | NASA Visible Earth | `material.map` |
| `earth-bump.jpg` | NASA topo/elevation | `material.bumpMap` |
| `earth-specular.jpg` (oceanos) | NASA water mask | `material.specularMap` (brilho só na água) |
| `earth-clouds.png` (alpha) | NASA cloud composite | esfera de nuvens |
| `earth-night.jpg` (lights) | NASA Black Marble | emissive no lado noturno (fase 2, opcional) |

> ⚠️ **Licença/assets:** as texturas NASA são domínio público, mas confirme a origem
> exata e **versione os arquivos** (não hotlink). Servir 8k pesa — use `4k` como padrão
> e 8k sob demanda.

---

## 2. Nova arquitetura de arquivos

```
src/components/Globe/
  GlobeCanvas.tsx          ← mantém JSX/overlay; troca o miolo por hook
  three/
    useGlobeScene.ts       ← cria scene, camera, renderer, controls, RAF loop
    GlobeMesh.ts           ← esfera terra + nuvens + atmosfera (fresnel shader)
    Markers.ts             ← pinos de clientes (hub/vital) como sprites/instanced
    Labels.ts              ← rótulos país/cidade via CSS2DRenderer
    geoToVector.ts         ← lat/lon → Vector3 (substitui proj())
    dayNight.ts            ← posiciona DirectionalLight pelo subsolar point
    flyTo.ts               ← anima quaternion/câmera (substitui o lerp atual)
```

---

## 3. Mapa de migração — cada recurso atual → equivalente 3D

Nada some; cada item tem destino.

| Recurso atual (2D) | Equivalente Three.js | Risco |
|---|---|---|
| `geoOrthographic` + `proj()` | esfera real + câmera perspectiva; `geoToVector(lat,lon,R)` | baixo |
| Rotação/inércia/auto-rotate | `OrbitControls` (`autoRotate`, `enableDamping`) — *de graça* | baixo |
| Zoom (wheel/pinch) | `OrbitControls` dolly + `minDistance`/`maxDistance` | baixo |
| Oceano + biomas procedurais | **textura Blue Marble** (substitui tudo isso) | baixo ✅ ganho |
| Day/night terminator (offscreen blur) | `DirectionalLight` no subsolar point + `earth-night` emissive | médio |
| Atmosfera/limbo/halo (gradientes) | shader de **fresnel** numa esfera externa (backside) | médio |
| Sea glint / specular sheen | `specularMap` + `shininess` do `MeshPhongMaterial` | baixo ✅ |
| Nuvens | 2ª esfera `R*1.01`, `transparent`, rotação lenta própria | baixo |
| Estrelas | `Points` com `BufferGeometry` (ou skybox) | baixo |
| **Marcadores clientes (vital)** | `Sprite`/`InstancedMesh` em `geoToVector`; ocultar no hemisfério oculto via `dot(normal, camera)` | **médio-alto** |
| Anéis pulsantes / badges de grupo | sprite animado (shader) ou `CSS2DObject` para badge | médio |
| Arcs (hub) + partículas | `QuadraticBezierCurve3` na superfície + `Points` animados | médio |
| **Hit-test de clique** | `Raycaster` contra os sprites de marcadores | médio |
| Double-click "centralizar" | `Raycaster` na esfera → ponto → `flyTo` | baixo |
| **"Voar até" (`focusTarget`)** | animar alvo do `OrbitControls` + posição via slerp de quaternion | médio |
| **Rótulos país/cidade c/ colisão** | `CSS2DRenderer` + occlusion por profundidade; colisão recalculada em screen-space | **alto** ⚠️ |
| Fronteiras/estados/coastlines vetoriais | a textura já mostra a geografia; manter só fronteiras *políticas* como `Line` do GeoJSON se quiser | alto / **cortar** |
| Foco/dim (`focusedId`) | baixar opacidade dos outros sprites | baixo |
| Export PNG | `renderer.domElement.toDataURL()` (precisa `preserveDrawingBuffer:true`) | baixo |
| Fullscreen / controles / stats / tooltip | **inalterado** (DOM) | nenhum |
| `prefers-reduced-motion` | desliga `controls.autoRotate` | baixo |

### Os dois pontos quentes (onde mora o esforço real do "híbrido")

1. **Rótulos com colisão** — hoje há detecção sofisticada com `measureText` +
   occupied boxes + prioridade por rank. Em 3D, o caminho limpo é `CSS2DRenderer`
   (rótulos viram divs HTML posicionadas), mas a lógica de colisão/prioridade precisa
   ser reimplementada em screen-space, e o occlusion (esconder rótulo do outro lado do
   globo) tem que ser manual.
2. **Marcadores + raycasting** — reprojetar os grupos de proximidade, anéis pulsantes e
   badges como objetos 3D, e religar `onPointClick`/hover/tooltip ao `Raycaster`.

---

## 4. Implementação faseada

Cada fase entrega algo testável no preview antes de seguir.

- **Fase 0 — Spike isolado** (`/globe-lab`, sem tocar no atual): esfera + Blue Marble +
  bump + specular + nuvens + atmosfera fresnel + `OrbitControls` + estrelas. Valida o
  "uau" fotográfico e o peso do bundle/textura. **Decisão go/no-go aqui.**
- **Fase 1 — Paridade de navegação:** day/night light, auto-rotate, zoom limits,
  reduced-motion, export PNG, reset/fullscreen religados aos botões existentes.
- **Fase 2 — Marcadores + interação:** `geoToVector`, sprites vital/hub, occlusion por
  hemisfério, `Raycaster` para clique/hover, tooltip, `focusedId` dim, `focusTarget`
  fly-to, double-click centralizar.
- **Fase 3 — Rótulos:** `CSS2DRenderer` para país/cidade com colisão e fade por zoom;
  badges de contagem.
- **Fase 4 — Extras hub:** arcs 3D + partículas animadas.
- **Fase 5 — Troca:** renomear, apagar o `draw()` 2D, remover `d3-geo`/`topojson` se
  nada mais usar (checar uso em outros pontos do projeto antes).

---

## 5. Riscos e decisões em aberto

- **Estilo cartográfico vs. fotográfico:** sobre o Blue Marble, fronteiras políticas e
  rótulos densos competem visualmente. Recomendado: **fronteiras políticas opcionais**
  (toggle) e rótulos mais discretos. Escolha de design, não técnica.
- **Performance mobile:** textura 8k + 2 esferas + nuvens pode travar em celular fraco.
  Mitigar com textura 4k/2k responsiva e `pixelRatio` limitado.
- **Bundle:** `three` é grande; manter `dynamic`/`ssr:false` e importar só o necessário.
- **`d3-geo` ainda é útil** para `geoInterpolate` (arcs) e cálculo do subsolar — pode
  valer manter a lib mesmo no 3D, só largando `geoPath`/projeção.

---

## 6. Estimativa de esforço

| Fase | Esforço |
|---|---|
| 0–1 (esfera fotográfica navegável) | ~0,5–1 dia |
| 2 (marcadores + interação) | ~1 dia |
| 3 (rótulos com colisão) | ~1 dia |
| 4–5 (arcs + limpeza) | ~0,5 dia |
| **Total paridade híbrida** | **~3–3,5 dias** |

A **Fase 0** entrega ~80% do impacto visual em poucas horas e é descartável se não
convencer — é o melhor ponto de validação antes de comprometer o resto.

---

## Próximo passo recomendado

Começar pela **Fase 0** (spike isolado em `/globe-lab`, sem tocar no globo de produção)
para ver o resultado fotográfico real antes de seguir — é o passo de menor risco e maior
sinal.
