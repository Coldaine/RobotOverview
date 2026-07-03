'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Terminal, Unit, NetKind } from '@/data/types';
import type { ActiveSet, TraceSet, TwinLayout, ViewMode } from '@/lib/twin';
import { Module } from './Module';
import { Port } from './Port';
import { Wire } from './Wire';

interface CanvasProps {
  layout: TwinLayout;
  mode: ViewMode;
  units: Unit[];
  terminals: Terminal[];
  active: ActiveSet;
  highlight: TraceSet | null;
  dimOthers: boolean;
  selectedNetId: string | null;
  layerEnabled: Set<NetKind>;
  hoveredModule: string | null;
  reducedMotion: boolean;
  interactive: boolean;
  onHoverTerminal: (id: string | null) => void;
  onHoverNet: (id: string | null) => void;
  onHoverModule: (id: string | null) => void;
  onSelectNet: (id: string) => void;
  onSelectTerminal: (id: string) => void;
}

const MIN_K = 0.6;
const MAX_K = 4;

export function TwinCanvas(props: CanvasProps) {
  const { layout, mode, units, terminals, active, highlight, dimOthers, selectedNetId, layerEnabled, hoveredModule, reducedMotion, interactive } = props;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [t, setT] = useState({ x: 0, y: 0, k: 1 });
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  // Reset the camera whenever the layout changes shape.
  useEffect(() => {
    setT({ x: 0, y: 0, k: 1 });
  }, [mode]);

  const viewScale = useCallback(() => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { scale: 1, offX: 0, offY: 0, rect: null as DOMRect | null };
    const scale = Math.min(rect.width / layout.width, rect.height / layout.height);
    return {
      scale,
      offX: (rect.width - layout.width * scale) / 2,
      offY: (rect.height - layout.height * scale) / 2,
      rect,
    };
  }, [layout.width, layout.height]);

  const toView = useCallback(
    (clientX: number, clientY: number) => {
      const { scale, offX, offY, rect } = viewScale();
      if (!rect) return { vx: 0, vy: 0 };
      return { vx: (clientX - rect.left - offX) / scale, vy: (clientY - rect.top - offY) / scale };
    },
    [viewScale],
  );

  const onWheel = (e: React.WheelEvent) => {
    if (!interactive) return;
    e.preventDefault();
    const { vx, vy } = toView(e.clientX, e.clientY);
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setT((prev) => {
      const k2 = Math.max(MIN_K, Math.min(MAX_K, prev.k * factor));
      const wx = (vx - prev.x) / prev.k;
      const wy = (vy - prev.y) / prev.k;
      return { k: k2, x: vx - wx * k2, y: vy - wy * k2 };
    });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    if (e.target !== e.currentTarget) return; // only drag from the background
    drag.current = { x: e.clientX, y: e.clientY, tx: t.x, ty: t.y };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const { scale } = viewScale();
    setT((prev) => ({
      ...prev,
      x: drag.current!.tx + (e.clientX - drag.current!.x) / scale,
      y: drag.current!.ty + (e.clientY - drag.current!.y) / scale,
    }));
  };

  const endDrag = (e: React.PointerEvent) => {
    if (drag.current) {
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch {
        /* pointer already released */
      }
      drag.current = null;
    }
  };

  const moduleInTrace = (unitId: string): boolean => {
    if (!highlight) return false;
    return terminals.some((term) => term.unitId === unitId && highlight.terminalIds.has(term.id));
  };

  // Visible world region for the minimap viewport box.
  const visW = layout.width / t.k;
  const visH = layout.height / t.k;
  const visX = -t.x / t.k;
  const visY = -t.y / t.k;

  return (
    <div className="relative h-full w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        preserveAspectRatio="xMidYMid meet"
        className={interactive ? 'h-full w-full touch-none select-none' : 'pointer-events-none h-full w-full'}
        style={{ cursor: interactive ? (drag.current ? 'grabbing' : 'grab') : 'default' }}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        {/* background drag surface */}
        <rect x={0} y={0} width={layout.width} height={layout.height} fill="transparent" />

        <g transform={`translate(${t.x} ${t.y}) scale(${t.k})`}>
          {/* wires under the cards */}
          {layout.wires.map((w) => (
            <Wire
              key={w.netId}
              wire={w}
              state={{
                active: active.netIds.has(w.netId),
                inTrace: highlight?.netIds.has(w.netId) ?? false,
                dimmed: dimOthers && !(highlight?.netIds.has(w.netId) ?? false),
                layerOn: layerEnabled.has(w.kind),
                selected: selectedNetId === w.netId,
                reducedMotion,
              }}
              onHover={props.onHoverNet}
              onSelect={props.onSelectNet}
            />
          ))}

          {/* module cards */}
          {layout.modules.map((m) => (
            <Module
              key={m.unitId}
              module={m}
              unit={units.find((u) => u.id === m.unitId)}
              mode={mode}
              hovered={hoveredModule === m.unitId || moduleInTrace(m.unitId)}
              dimmed={dimOthers && hoveredModule !== m.unitId && !moduleInTrace(m.unitId)}
              isCore={m.unitId === 'driver-board'}
              reducedMotion={reducedMotion}
              onHover={props.onHoverModule}
            />
          ))}

          {/* ports on top */}
          {layout.ports.map((p) => {
            const inTrace = highlight?.terminalIds.has(p.terminalId) ?? false;
            return (
              <Port
                key={p.key}
                port={p}
                terminal={terminals.find((term) => term.id === p.terminalId)}
                state={{
                  active: active.terminalIds.has(p.terminalId),
                  inTrace,
                  dimmed: dimOthers && !inTrace,
                  selected: false,
                  reducedMotion,
                }}
                showLabel={inTrace || hoveredModule === terminals.find((term) => term.id === p.terminalId)?.unitId}
                onHover={props.onHoverTerminal}
                onSelect={props.onSelectTerminal}
              />
            );
          })}
        </g>
      </svg>

      {interactive && t.k > 1.01 && (
        <div className="pointer-events-none absolute bottom-3 right-3 rounded-md border border-rim/70 bg-hull/80 p-1.5 backdrop-blur-sm">
          <svg width={130} height={130 * (layout.height / layout.width)} viewBox={`0 0 ${layout.width} ${layout.height}`} className="block">
            {layout.modules.map((m) => (
              <rect key={m.unitId} x={m.x} y={m.y} width={m.w} height={m.h} rx={8} fill="var(--color-panel-2)" stroke="var(--color-rim)" strokeWidth={2} />
            ))}
            <rect x={visX} y={visY} width={visW} height={visH} fill="var(--color-cyan)" fillOpacity={0.12} stroke="var(--color-cyan)" strokeWidth={3} />
          </svg>
        </div>
      )}
    </div>
  );
}
