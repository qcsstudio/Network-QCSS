import { useId } from "react";
import { Binary, Cloud, FileText, Mail, Monitor, Network, Router, Server, SquareDashed } from "lucide-react";
import type { CcnaVisualStory } from "@/lib/ccna-visual-story";

const icons = { computer: Monitor, switch: Network, router: Router, server: Server, packet: Mail, address: Binary, record: FileText, cloud: Cloud, boundary: SquareDashed };
const ink = "#182332";
const muted = "#425564";
const forward = "#08777b";
const reverse = "#a32b59";
type Point = { x: number; y: number };

function labelLines(text: string, budget: number) {
  const lines: string[] = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = lines.at(-1);
    if (last && last.length + word.length + 1 <= budget) lines[lines.length - 1] += ` ${word}`;
    else lines.push(word);
  }
  return lines;
}

// Rank declared directed edges, not array adjacency. Parallel paths share a rank.
// Cyclic models keep their authored order and route edges outside the label area.
function graphRanks(story: CcnaVisualStory) {
  const rank = new Map(story.nodes.map(node => [node.id, 0]));
  const degree = new Map(story.nodes.map(node => [node.id, 0]));
  for (const edge of story.connections) degree.set(edge.to, (degree.get(edge.to) || 0) + 1);
  const queue = story.nodes.filter(node => degree.get(node.id) === 0).map(node => node.id);
  let visited = 0;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const id = queue[cursor];
    visited++;
    for (const edge of story.connections.filter(edge => edge.from === id)) {
      rank.set(edge.to, Math.max(rank.get(edge.to) || 0, (rank.get(id) || 0) + 1));
      degree.set(edge.to, (degree.get(edge.to) || 0) - 1);
      if (degree.get(edge.to) === 0) queue.push(edge.to);
    }
  }
  if (visited !== story.nodes.length) story.nodes.forEach((node, index) => rank.set(node.id, index));
  return rank;
}

export function ccnaWebsiteDiagramGeometry(story: CcnaVisualStory, compact = false) {
  const evidence = story.connections.length === 0;
  const vertical = compact || story.layout === "layers";
  if (evidence) {
    const columns = vertical ? 1 : 2;
    const width = columns * 320;
    return { evidence, vertical, width, height: Math.ceil(story.nodes.length / columns) * 144 + 16,
      nodes: story.nodes.map((node, index) => ({ ...node, rank: Math.floor(index / columns), x: (index % columns) * 320 + 16, y: Math.floor(index / columns) * 144 + 16, textWidth: 216 })) };
  }
  const ranks = graphRanks(story);
  let groups = Array.from({ length: Math.max(...ranks.values()) + 1 }, (_, rank) => story.nodes.filter(node => ranks.get(node.id) === rank));
  // Very wide fan-outs use outside lanes in the narrow view, never tiny labels.
  if (vertical && groups.some(group => group.length > 2)) {
    groups = story.nodes.map(node => [node]);
    story.nodes.forEach((node, index) => ranks.set(node.id, index));
  }
  const maxGroup = Math.max(...groups.map(group => group.length));
  const width = vertical ? 320 : groups.length * 220;
  const height = (vertical ? groups.length : maxGroup) * 220 + 48;
  const positions = new Map<string, Point & { textWidth: number }>();
  groups.forEach((group, rank) => group.forEach((node, index) => positions.set(node.id, vertical
    ? { x: (index + 0.5) * width / group.length, y: 80 + rank * 220, textWidth: group.length === 1 ? 238 : 132 }
    : { x: 110 + rank * 220, y: 80 + ((maxGroup - group.length) / 2 + index) * 220, textWidth: 190 })));
  return { evidence, vertical, width, height, nodes: story.nodes.map(node => ({ ...node, rank: ranks.get(node.id)!, ...positions.get(node.id)! })) };
}

function connectionPath(from: Point & { rank: number }, to: Point & { rank: number }, vertical: boolean, width: number, index: number) {
  if (vertical) {
    const anchor = from.x !== width / 2 ? from.x : to.x;
    const side = anchor < width / 2 ? -1 : 1;
    const lane = side < 0 ? 4 + index * 1.5 : width - 4 - index * 1.5;
    return `M ${from.x + side * 34} ${from.y} H ${lane} V ${to.y} H ${to.x + side * 34}`;
  }
  const direction = Math.sign(to.x - from.x) || 1;
  const start = from.x + direction * 34;
  const end = to.x - direction * 34;
  if (Math.abs(to.rank - from.rank) !== 1) {
    const lane = 12 + index * 5;
    return `M ${start} ${from.y} H ${from.x + direction * 104} V ${lane} H ${to.x - direction * 104} V ${to.y} H ${end}`;
  }
  const middle = (from.x + to.x) / 2;
  return `M ${start} ${from.y} H ${middle} V ${to.y} H ${end}`;
}

function DiagramText({ text, x, y, width, fontSize, lineHeight, bold = false, centered = true }: {
  text: string; x: number; y: number; width: number; fontSize: number; lineHeight: number; bold?: boolean; centered?: boolean;
}) {
  const budget = Math.floor(width / (fontSize * 0.61));
  const lines = labelLines(text, budget);
  return <text x={x} y={y} textAnchor={centered ? "middle" : "start"} fontFamily="Arial, sans-serif" fontSize={fontSize} fontWeight={bold ? 700 : 400} fill={bold ? ink : muted} data-label={text}>
    {lines.map((line, index) => <tspan key={index} x={x} dy={index ? lineHeight : 0} textLength={line.length > budget ? width : undefined} lengthAdjust="spacingAndGlyphs">{line}{index < lines.length - 1 ? " " : ""}</tspan>)}
  </text>;
}

/** Website-only rendering. The default/social diagram and its helpers stay untouched. */
export function CcnaWebsiteVisualDiagram({ story, stageIndex = 0, compact = false }: { story: CcnaVisualStory; stageIndex?: number; compact?: boolean }) {
  const id = useId().replace(/:/g, "");
  const geometry = ccnaWebsiteDiagramGeometry(story, compact);
  const stage = story.stages[stageIndex] || story.stages[0];
  const color = stage.direction === "reverse" ? reverse : forward;
  return <svg viewBox={`0 0 ${geometry.width} ${geometry.height}`} width={geometry.width} height={geometry.height} role="img" aria-label={story.altText} aria-describedby={`${id}-scope`} data-website-diagram={geometry.evidence ? "evidence" : "graph"} data-direction={stage.direction} xmlns="http://www.w3.org/2000/svg">
    <title>{story.altText}</title><desc id={`${id}-scope`}>{story.boundary}</desc>
    {!geometry.evidence ? <defs><marker id={`${id}-arrow`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M 0 0 L 8 4 L 0 8 Z" fill={color} /></marker></defs> : null}
    {story.connections.map((edge, index) => {
      const from = geometry.nodes.find(node => node.id === edge.from);
      const to = geometry.nodes.find(node => node.id === edge.to);
      if (!from || !to) return null;
      const active = stage.activeConnections.includes(edge.id);
      const [start, end] = stage.direction === "reverse" ? [to, from] : [from, to];
      return <path key={edge.id} data-connection={edge.id} data-from={edge.from} data-to={edge.to} data-active={active} data-arrow-to={active && stage.direction !== "none" ? end.id : undefined}
        d={connectionPath(start, end, geometry.vertical, geometry.width, index)} fill="none" stroke={active ? color : "#71828c"} strokeWidth={active ? 3 : 1.5} strokeDasharray={active ? undefined : "5 5"} strokeLinejoin="round" markerEnd={active && stage.direction !== "none" ? `url(#${id}-arrow)` : undefined} />;
    })}
    {geometry.nodes.map(node => {
      const active = stage.activeNodes.includes(node.id);
      const Icon = icons[node.kind];
      const labelSize = geometry.evidence || geometry.vertical ? 18 : 24;
      const detailSize = geometry.evidence || geometry.vertical ? 16 : 22;
      const labelCount = labelLines(node.label, Math.floor(node.textWidth / (labelSize * 0.61))).length;
      const x = geometry.evidence ? node.x + 60 : node.x;
      const y = geometry.evidence ? node.y + 35 : node.y + 62;
      return <g key={node.id} data-node={node.id} data-kind={node.kind} data-active={active} data-rank={node.rank} data-x={node.x} data-y={node.y}>
        <title>{`${node.label}: ${node.detail}`}</title>
        {geometry.evidence ? <rect x={node.x} y={node.y} width={288} height={128} rx={6} fill={active ? "#edf7f5" : "#ffffff"} stroke={active ? color : "#9cabb2"} strokeWidth={active ? 2 : 1} />
          : <rect x={node.x - 32} y={node.y - 29} width={64} height={58} rx={node.kind === "boundary" ? 0 : 6} fill={active ? "#edf7f5" : "#ffffff"} stroke={active ? color : "#71828c"} strokeWidth={active ? 2.5 : 1.5} strokeDasharray={node.kind === "boundary" ? "4 3" : undefined} />}
        <Icon x={geometry.evidence ? node.x + 16 : node.x - 21} y={geometry.evidence ? node.y + 17 : node.y - 21} width={geometry.evidence ? 28 : 42} height={geometry.evidence ? 28 : 42} strokeWidth={1.6} color={active ? color : muted} aria-hidden="true" />
        <DiagramText text={node.label} x={x} y={y} width={node.textWidth} fontSize={labelSize} lineHeight={24} bold centered={!geometry.evidence} />
        <DiagramText text={node.detail} x={x} y={y + labelCount * 24 + 4} width={node.textWidth} fontSize={detailSize} lineHeight={22} centered={!geometry.evidence} />
      </g>;
    })}
  </svg>;
}
