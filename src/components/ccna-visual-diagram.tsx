import type { CcnaVisualStory } from "@/lib/ccna-visual-story";

// Plain SVG diagram symbols also render in social images without a React DOM dependency.
const symbols = {
  computer: "M5 7H55V42H5ZM30 42V53M17 53H43",
  switch: "M3 17H57V43H3ZM10 26H18V35H10ZM26 26H34V35H26ZM42 26H50V35H42Z",
  router: "M5 20H55V46H5ZM14 20V6M46 20V6M18 33H42M18 33L24 27M42 33L36 39",
  server: "M7 3H53V19H7ZM7 23H53V39H7ZM7 43H53V59H7ZM14 11H20M14 31H20M14 51H20",
  packet: "M5 12H55V48H5ZM5 12L30 33L55 12",
  address: "M3 8H27V26H3ZM33 8H57V26H33ZM3 34H27V52H3ZM33 34H57V52H33Z",
  record: "M12 3H39L51 15V57H12ZM39 3V15H51M20 27H43M20 36H43M20 45H35",
  cloud: "M16 45C0 45 0 24 16 22C17 3 45 4 47 23C62 24 63 45 47 45Z",
  boundary: "M14 3V57M46 3V57M14 14H46M14 30H46M14 46H46"
};

export function wrapVisualLabel(text: string, limit: number) {
  const lines: string[] = [];
  const words = text.split(/\s+/).filter(Boolean).flatMap((word) => word.match(new RegExp(`.{1,${limit}}`, "g")) || []);
  for (const word of words) {
    const last = lines.at(-1);
    if (last && last.length + word.length + 1 <= limit) lines[lines.length - 1] += ` ${word}`;
    else lines.push(word);
  }
  return lines;
}

export function ccnaDiagramGeometry(story: CcnaVisualStory, compact = false) {
  const vertical = compact || story.layout === "layers";
  const width = vertical ? 320 : 1080;
  const height = vertical ? story.nodes.length * 250 : story.layout === "comparison" ? 650 : 340;
  const nodes = story.nodes.map((node, index) => ({
    ...node,
    x: vertical ? 140 : story.layout === "comparison" ? 270 + (index % 2) * 540 : (width / story.nodes.length) * (index + 0.5),
    y: vertical ? 70 + index * 250 : story.layout === "comparison" ? 90 + Math.floor(index / 2) * 300 : 110
  }));
  return { width, height, nodes };
}

export function CcnaVisualDiagram({ story, stageIndex = 0, compact = false, width, height, includeLabels = true }: { story: CcnaVisualStory; stageIndex?: number; compact?: boolean; width?: number; height?: number; includeLabels?: boolean }) {
  const geometry = ccnaDiagramGeometry(story, compact);
  const stage = story.stages[stageIndex] || story.stages[0];
  return <svg width={width || geometry.width} height={height || geometry.height} viewBox={`0 0 ${geometry.width} ${geometry.height}`} role="img" aria-label={story.altText} xmlns="http://www.w3.org/2000/svg">
    {includeLabels ? <title>{story.altText}</title> : null}
    {story.connections.map((edge) => {
      const from = geometry.nodes.find((node) => node.id === edge.from);
      const to = geometry.nodes.find((node) => node.id === edge.to);
      if (!from || !to) return null;
      const active = stage.activeConnections.includes(edge.id);
      const reversed = stage.direction === "reverse";
      const start = reversed ? to : from;
      const end = reversed ? from : to;
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const distance = Math.hypot(dx, dy);
      const ux = dx / distance;
      const uy = dy / distance;
      // Vertical links use a side lane so they never cross a node's text labels.
      const vertical = Math.abs(dx) < 1;
      const sideLane = geometry.width === 320 ? 150 : 170;
      const sx = vertical ? start.x + sideLane : start.x + ux * 64;
      const sy = vertical ? start.y : start.y + uy * 64;
      const ex = vertical ? end.x + sideLane : end.x - ux * 64;
      const ey = vertical ? end.y : end.y - uy * 64;
      const color = active ? (reversed ? "#b03363" : "#087b7e") : "#b7c4ca";
      return <g key={edge.id}>
        <path d={vertical ? `M ${start.x + 58} ${sy} H ${sx} V ${ey} H ${end.x + 58}` : `M ${sx} ${sy} L ${ex} ${ey}`} fill="none" stroke={color} strokeWidth={active ? 5 : 3} strokeDasharray={active ? undefined : "7 8"} />
        {active && stage.direction !== "none" ? vertical
          ? <polygon points={`${ex},${(sy + ey) / 2 + uy * 15} ${ex - 10},${(sy + ey) / 2 - uy * 9} ${ex + 10},${(sy + ey) / 2 - uy * 9}`} fill={color} />
          : <polygon points={`${ex},${ey} ${ex - ux * 18 - uy * 10},${ey - uy * 18 + ux * 10} ${ex - ux * 18 + uy * 10},${ey - uy * 18 - ux * 10}`} fill={color} /> : null}
      </g>;
    })}
    {geometry.nodes.map((node) => {
      const active = stage.activeNodes.includes(node.id);
      const label = wrapVisualLabel(node.label, 17);
      return <g key={node.id}>
        <rect x={node.x - 53} y={node.y - 53} width={106} height={106} rx={8} fill={active ? "#e5f3f0" : "#f2f4f7"} stroke={active ? "#087b7e" : "#b7c4ca"} strokeWidth={active ? 3 : 2} />
        <path d={symbols[node.kind]} transform={`translate(${node.x - 30} ${node.y - 30})`} fill="none" stroke={active ? "#08666a" : "#596674"} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        {includeLabels ? label.map((line, index) => <text key={index} x={node.x} y={node.y + 91 + index * 33} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize={28} fontWeight={700} fill="#182332">{line}</text>) : null}
        {includeLabels ? wrapVisualLabel(node.detail, 20).map((line, index) => <text key={index} x={node.x} y={node.y + 91 + label.length * 33 + index * 26} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize={21} fill="#425564">{line}</text>) : null}
      </g>;
    })}
  </svg>;
}
