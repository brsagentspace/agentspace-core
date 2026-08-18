/**
 * @file MemoryMapCanvas.tsx
 * @description GPU force-graph canvas for the Agent Memory Map (cosmos.gl).
 *
 * Follows the OfficeCanvas pattern: the imperative engine lives inside a
 * useEffect and is destroyed on unmount. Points are clustered per owning
 * agent, colored by agent, sized by degree. Search/agent filters only
 * recompute point colors — the GPU keeps positions.
 *
 * @module components/memory
 */

import { useEffect, useMemo, useRef } from 'react';
import { Graph } from '@cosmos.gl/graph';
import type { MemoryGraphData } from '../../services/memory/MemoryStore';
import { agentColor } from '../../services/memory/MemoryStore';

const SPACE = 4096;

interface MemoryMapCanvasProps {
  data: MemoryGraphData;
  agentFilter: string | null;
  searchQuery: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Hide memories ingested after this epoch-ms (null = show all). */
  timeCutoff: number | null;
  /** Bump nonce to glide the camera to a node (detail-panel link nav). */
  focusTarget: { id: string; nonce: number } | null;
}

/** How many high-degree nodes get an HTML overlay label. */
const LABEL_COUNT = 22;
/** Labels appear once the camera is closer than this zoom level. */
const LABEL_MIN_ZOOM = 0.85;

/** rgba 0-1 floats from #rrggbb. */
function hexToRgba(hex: string, alpha: number): [number, number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255, alpha];
}

export function MemoryMapCanvas({ data, agentFilter, searchQuery, selectedId, onSelect, timeCutoff, focusTarget }: MemoryMapCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const labelHostRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const firstRecolorRef = useRef(true);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  // ── Static graph arrays, derived once per dataset ─────────────────────────
  const prepared = useMemo(() => {
    const agentIds = Object.keys(data.agents);
    const idToIndex = new Map<string, number>();
    data.nodes.forEach((n, i) => idToIndex.set(n.id, i));

    const degree = new Array<number>(data.nodes.length).fill(0);
    const linkPairs: number[] = [];
    data.relations.forEach(r => {
      const s = idToIndex.get(r.sourceId);
      const t = idToIndex.get(r.targetId);
      if (s === undefined || t === undefined) return;
      linkPairs.push(s, t);
      degree[s]++;
      degree[t]++;
    });

    // Cluster anchors on a circle around space center
    const cx = SPACE / 2;
    const cy = SPACE / 2;
    const radius = SPACE * 0.28;
    const anchor = (ai: number): [number, number] => [
      cx + radius * Math.cos((ai / agentIds.length) * Math.PI * 2),
      cy + radius * Math.sin((ai / agentIds.length) * Math.PI * 2),
    ];

    const positions = new Float32Array(data.nodes.length * 2);
    const clusters: number[] = new Array(data.nodes.length);
    const baseColors = new Float32Array(data.nodes.length * 4);
    const sizes = new Float32Array(data.nodes.length);
    const ingestion = data.nodes.map(n => Date.parse(n.timestamps.ingestionTime));
    const memTimes = data.nodes
      .map((n, i) => (n.type === 'Agent' ? NaN : ingestion[i]))
      .filter(t => !Number.isNaN(t));
    const tMin = Math.min(...memTimes);
    const tMax = Math.max(...memTimes);

    data.nodes.forEach((n, i) => {
      const owner = (n.type === 'Agent' ? n.id : (n.attributes.agentId as string)) ?? agentIds[0];
      const ai = Math.max(0, agentIds.indexOf(owner));
      const [ax, ay] = anchor(ai);
      // deterministic jitter from index so layouts are stable across reloads
      const golden = i * 2.399963;
      const r = 60 + (i % 97) * 4;
      positions[i * 2] = ax + Math.cos(golden) * r;
      positions[i * 2 + 1] = ay + Math.sin(golden) * r;
      clusters[i] = ai;

      const isAgent = n.type === 'Agent';
      // Fresh memories glow, old ones fade toward the background.
      const recency = tMax > tMin ? (ingestion[i] - tMin) / (tMax - tMin) : 1;
      const [cr, cg, cb, ca] = isAgent
        ? hexToRgba('#f8f8fb', 1)
        : hexToRgba(agentColor(agentIds, owner), 0.45 + 0.5 * recency);
      baseColors.set([cr, cg, cb, ca], i * 4);
      sizes[i] = isAgent ? 22 : 3.5 + Math.log2(1 + degree[i]) * 2.4;
    });

    // Label candidates: agent anchors + highest-degree memories.
    const labelIndices = data.nodes
      .map((_, i) => i)
      .sort((a, b) => (data.nodes[a].type === 'Agent' ? 1e9 : degree[a]) < (data.nodes[b].type === 'Agent' ? 1e9 : degree[b]) ? 1 : -1)
      .slice(0, LABEL_COUNT);

    return {
      agentIds, idToIndex,
      positions, clusters, baseColors, sizes,
      links: new Float32Array(linkPairs),
      nodes: data.nodes,
      ingestion, labelIndices,
    };
  }, [data]);

  // ── Engine lifecycle ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!hostRef.current) return;

    const graph = new Graph(hostRef.current, {
      backgroundColor: [0, 0, 0, 0], // CSS background shows through
      spaceSize: SPACE,
      simulationGravity: 0.22,
      simulationCenter: 0.2,
      simulationRepulsion: 1.7,
      simulationLinkSpring: 0.35,
      simulationLinkDistance: 16,
      simulationCluster: 0.12,
      simulationFriction: 0.88,
      simulationDecay: 6000,
      linkOpacity: 0.14,
      linkWidthScale: 0.7,
      linkColorInterpolateFromEndpoints: true,
      pointSizeScale: 1.2,
      scalePointsOnZoom: true,
      enableDrag: false,
      renderHoveredPointRing: true,
      hoveredPointRingColor: '#8b5cf6',
      hoveredPointCursor: 'pointer',
      fitViewOnInit: false, // we drive fitView ourselves (timer + simulation end)
      pointSamplingDistance: 40,
      onClick: (index) => {
        onSelectRef.current(index === undefined ? null : prepared.nodes[index].id);
      },
      onSimulationEnd: () => {
        // Re-frame once the layout has cooled down and contracted.
        graphRef.current?.fitView(500, 0.12);
      },
    });

    graph.setPointPositions(prepared.positions);
    graph.setPointColors(prepared.baseColors);
    graph.setPointSizes(prepared.sizes);
    graph.setLinks(prepared.links);
    graph.setPointClusters(prepared.clusters);
    graph.render();
    graph.start(1);
    // Early fit while the simulation is still spreading the clusters;
    // onSimulationEnd does the final framing.
    const fitTimer = window.setTimeout(() => graph.fitView(600, 0.1), 900);

    graphRef.current = graph;
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__memGraph = graph;
    }

    // ── LOD labels: HTML overlay, repositioned on a light RAF loop ─────────
    const labelHost = labelHostRef.current;
    const labelEls: HTMLDivElement[] = [];
    if (labelHost) {
      labelHost.innerHTML = '';
      prepared.labelIndices.forEach(() => {
        const el = document.createElement('div');
        el.className = 'memory-node-label';
        labelHost.appendChild(el);
        labelEls.push(el);
      });
    }
    let raf = 0;
    let frame = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!labelHost || frame++ % 3 !== 0) return;
      const zoom = graph.getZoomLevel();
      const showAll = zoom >= LABEL_MIN_ZOOM;
      const pos = graph.getPointPositions();
      const w = labelHost.clientWidth;
      const h = labelHost.clientHeight;
      prepared.labelIndices.forEach((idx, li) => {
        const el = labelEls[li];
        const node = prepared.nodes[idx];
        const isSelected = node.id === selectedIdRef.current;
        const isAgent = node.type === 'Agent';
        if ((!showAll && !isSelected && !isAgent) || pos[idx * 2] === undefined) {
          el.style.display = 'none';
          return;
        }
        const [x, y] = graph.spaceToScreenPosition([pos[idx * 2], pos[idx * 2 + 1]]);
        if (x < -40 || x > w + 40 || y < 0 || y > h) {
          el.style.display = 'none';
          return;
        }
        el.textContent = node.name.length > 26 ? `${node.name.slice(0, 26)}…` : node.name;
        el.style.display = 'block';
        el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y + 8)}px) translateX(-50%)`;
        el.classList.toggle('selected', isSelected);
        el.classList.toggle('agent', isAgent);
      });
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      if (labelHost) labelHost.innerHTML = '';
      window.clearTimeout(fitTimer);
      graphRef.current = null;
      graph.destroy();
    };
  }, [prepared]);

  // ── Detail-panel link navigation: glide the camera to the node ────────────
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !focusTarget) return;
    const idx = prepared.idToIndex.get(focusTarget.id);
    if (idx !== undefined) graph.zoomToPointByIndex(idx, 700);
  }, [prepared, focusTarget]);

  // ── Filter / search / selection → recolor only ────────────────────────────
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    const q = searchQuery.trim().toLowerCase();
    // Nothing to dim or highlight — restore base colors, but never touch the
    // engine on the initial mount (it would cancel the pending fitView).
    if (q === '' && agentFilter === null && selectedId === null && timeCutoff === null) {
      if (!firstRecolorRef.current) {
        graph.setPointColors(prepared.baseColors);
        graph.render();
      }
      firstRecolorRef.current = false;
      return;
    }
    firstRecolorRef.current = false;
    const colors = new Float32Array(prepared.baseColors);

    prepared.nodes.forEach((n, i) => {
      const isAgent = n.type === 'Agent';
      const owner = isAgent ? n.id : (n.attributes.agentId as string);
      const agentPass = agentFilter === null || owner === agentFilter;
      const queryPass = q === '' ||
        n.name.toLowerCase().includes(q) ||
        n.summary.toLowerCase().includes(q);
      const timePass = isAgent || timeCutoff === null || prepared.ingestion[i] <= timeCutoff;
      const pass = agentPass && queryPass && timePass;

      if (!pass) colors[i * 4 + 3] = timePass ? 0.05 : 0.02;
      if (n.id === selectedId) {
        colors.set([1, 1, 1, 1], i * 4);
      }
    });

    graph.setPointColors(colors);
    graph.render();
  }, [prepared, agentFilter, searchQuery, selectedId, timeCutoff]);

  return (
    <>
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
      <div ref={labelHostRef} className="memory-label-host" />
    </>
  );
}
