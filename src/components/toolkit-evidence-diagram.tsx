import { ArrowDown, ArrowRight, Network } from "lucide-react";
import type { ToolkitResult } from "@/lib/toolkit/types";
import styles from "./network-toolkit.module.css";

export function ToolkitEvidenceDiagram({ visual }: { visual: NonNullable<ToolkitResult["visual"]> }) {
  if (!visual.items.length) return null;
  return <section className={styles.rawDiagram} aria-label={visual.title}>
    <h3><Network size={20} aria-hidden="true" />{visual.title}</h3>
    <p>{visual.caption}</p>
    <ol className={styles.rawDiagramRows}>{visual.items.map((item, index) => <li key={index}>
      <span className={styles.rawRecord}>{item.label}</span>
      <dl className={styles.rawDiagramSteps} style={{ gridTemplateColumns: `repeat(${item.steps.length}, minmax(0, 1fr))` }}>
        {item.steps.map((step, stepIndex) => <div key={stepIndex}>
          <dt>{step.label}</dt><dd>{step.value}</dd>
          {visual.flow && stepIndex < item.steps.length - 1 && <span className={styles.rawArrow} aria-hidden="true"><ArrowRight size={20} /><ArrowDown size={20} /></span>}
        </div>)}
      </dl>
    </li>)}</ol>
  </section>;
}
