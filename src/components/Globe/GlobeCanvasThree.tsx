'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { GlobePoint } from '@/types/globe';
import { GlobeScene, type DotGroup, type GlobeTheme } from './three/GlobeScene';
import styles from './GlobeCanvas.module.css';

export type { DotGroup, GlobeTheme };

interface Props {
  points: GlobePoint[];
  theme?: GlobeTheme;
  onPointClick?: (group: DotGroup) => void;
  focusTarget?: { lat: number; lon: number; nonce: number } | null;
  focusedId?: number | null;
  hideInfoOverlays?: boolean;
}

const ZOOM_MIN_PCT = 40;
const ZOOM_MAX_PCT = 320;

export default function GlobeCanvasThree({
  points,
  theme = 'hub',
  onPointClick,
  focusTarget,
  focusedId,
  hideInfoOverlays,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GlobeScene | null>(null);
  const onPointClickRef = useRef(onPointClick);
  useEffect(() => { onPointClickRef.current = onPointClick; }, [onPointClick]);

  const [mounted, setMounted] = useState(false);
  const [zoomPct, setZoomPct] = useState(100);
  const [autoRotate, setAutoRotate] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; count: number; city: string } | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // ── cria a cena uma vez ──
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const scene = new GlobeScene(host, {
      onZoom: setZoomPct,
      onHover: setTooltip,
      onPointClick: (g) => onPointClickRef.current?.(g),
    });
    sceneRef.current = scene;
    scene.loadCities();

    const ro = new ResizeObserver(() => scene.resize());
    ro.observe(host);

    // acessibilidade: respeita prefers-reduced-motion
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const applyRM = () => { if (mq?.matches) { scene.setAutoRotate(false); setAutoRotate(false); } };
    applyRM();
    mq?.addEventListener?.('change', applyRM);

    return () => {
      ro.disconnect();
      mq?.removeEventListener?.('change', applyRM);
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  // ── sincroniza dados / tema / foco ──
  useEffect(() => { sceneRef.current?.setData(points, theme); }, [points, theme]);
  useEffect(() => { sceneRef.current?.setFocusedId(focusedId ?? null); }, [focusedId]);

  // ── "voar até" um ponto ──
  useEffect(() => {
    if (!focusTarget) return;
    sceneRef.current?.flyTo(focusTarget.lat, focusTarget.lon, { zoomIn: true, highlight: true });
    setAutoRotate(false);
  }, [focusTarget]);

  // ── fullscreen tracking ──
  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  const toggleAutoRotate = useCallback(() => {
    const on = sceneRef.current?.toggleAutoRotate() ?? false;
    setAutoRotate(on);
  }, []);

  const resetView = useCallback(() => {
    sceneRef.current?.resetView();
    sceneRef.current?.setAutoRotate(true);
    setAutoRotate(true);
  }, []);

  const exportPNG = useCallback(() => {
    const url = sceneRef.current?.exportPNG();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `globo-acosvital-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }, []);

  const displayPoints = mounted ? points.length : 0;

  return (
    <div className={styles.wrapper}>
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Tooltip — hover de marcador (vital) */}
      {tooltip && (
        <div className={styles.tooltip} style={{ left: tooltip.x, top: tooltip.y }}>
          {tooltip.city && <div className={styles.tooltipCity}>{tooltip.city}</div>}
          <div>
            <span className={styles.tooltipCount}>{tooltip.count}</span>{' '}
            cliente{tooltip.count !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {mounted && (
        <>
          <div className={styles.titleOverlay}>
            <div className={styles.titleTag}>
              {theme === 'vital' ? 'Aços Vital · Clientes' : 'Aços Hub · Visualização'}
            </div>
            <div className={styles.titleMain}>
              {theme === 'vital' ? 'Mapa de\nClientes' : 'Globo\nInterativo'}
            </div>
            <div className={styles.titleHint}>Arraste · Scroll · Dia/noite em tempo real</div>
          </div>

          <div className={styles.controlPanel}>
            <button
              className={`${styles.panelBtn} ${isFullscreen ? styles.panelBtnActive : ''}`}
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Sair do modo tela cheia' : 'Tela cheia'}
            >
              {isFullscreen ? (
                <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M5.5 0a.5.5 0 0 1 .5.5v4A1.5 1.5 0 0 1 4.5 6h-4a.5.5 0 0 1 0-1H4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5zm5 0a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h3.5a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 10 4.5v-4a.5.5 0 0 1 .5-.5zM0 10.5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 6 11.5v4a.5.5 0 0 1-1 0V12a.5.5 0 0 0-.5-.5H.5a.5.5 0 0 1-.5-.5zm10 1a1.5 1.5 0 0 1 1.5-1.5h4a.5.5 0 0 1 0 1H12a.5.5 0 0 0-.5.5v3.5a.5.5 0 0 1-1 0v-3.5z"/>
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M1.5 1h4a.5.5 0 0 1 0 1H2v3.5a.5.5 0 0 1-1 0V1.5A.5.5 0 0 1 1.5 1zm9 0h4a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V2h-3.5a.5.5 0 0 1 0-1zm-9 9a.5.5 0 0 1 .5.5V14h3.5a.5.5 0 0 1 0 1H1.5a.5.5 0 0 1-.5-.5v-4a.5.5 0 0 1 .5-.5zm13 0a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5H11a.5.5 0 0 1 0-1h3.5v-3.5a.5.5 0 0 1 .5-.5z"/>
                </svg>
              )}
            </button>

            <div className={styles.panelDivider} />

            <button
              className={`${styles.panelBtn} ${autoRotate ? styles.panelBtnActive : ''}`}
              onClick={toggleAutoRotate}
              title={autoRotate ? 'Pausar rotação automática' : 'Retomar rotação automática'}
            >
              {autoRotate ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="3" y="2" width="4" height="12" rx="1"/>
                  <rect x="9" y="2" width="4" height="12" rx="1"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4 2.5l10 5.5-10 5.5V2.5z"/>
                </svg>
              )}
            </button>

            <button className={styles.panelBtn} onClick={resetView} title="Resetar para posição inicial">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
              </svg>
            </button>

            <button className={styles.panelBtn} onClick={exportPNG} title="Exportar como PNG">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 11.5L4.5 8H7V3h2v5h2.5L8 11.5zM2 13.5h12V15H2v-1.5z"/>
              </svg>
            </button>

            <div className={styles.panelDivider} />

            <button
              className={styles.panelBtn}
              onClick={() => sceneRef.current?.zoomBy(1.25)}
              disabled={zoomPct >= ZOOM_MAX_PCT}
              title="Zoom in"
            >+</button>

            <div className={styles.panelZoomPct}>{zoomPct}%</div>

            <button
              className={styles.panelBtn}
              onClick={() => sceneRef.current?.zoomBy(0.8)}
              disabled={zoomPct <= ZOOM_MIN_PCT}
              title="Zoom out"
            >−</button>
          </div>

          {theme === 'vital' && !hideInfoOverlays && (
            <div className={`${styles.sideText} ${zoomPct > 100 ? styles.sideTextHidden : ''}`}>
              <div className={styles.sideTextTitle}>ONDE JÁ ESTAMOS</div>
              <div className={styles.sideTextBody}>
                Nosso futuro é crescer com propósito, inovação e excelência,
                construindo caminhos cada vez maiores e levando nossa visão mais
                longe a cada conquista.
              </div>
            </div>
          )}

          {theme === 'vital' && !hideInfoOverlays && (
            <div className={styles.statsBar}>
              <div className={styles.statItem}>
                <div className={`${styles.statValue} ${styles.statValuePoints}`}>{displayPoints}</div>
                <div className={styles.statLabel}>Clientes</div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
