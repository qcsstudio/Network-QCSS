import { Calculator, Plus, RotateCcw, Trash2 } from "lucide-react";
import { initialParameterState, type ParameterField, type ParameterForm } from "@/lib/toolkit/parameter-inputs";
import styles from "./network-toolkit.module.css";

export type ParameterState = ReturnType<typeof initialParameterState>;
const unitNames: Record<string, string> = { ms: "milliseconds", "%": "percent", "Mbit/s": "megabits per second" };

export function ToolkitParameterForm({ form, state, busy, onChange, onSubmit, onCancel }: {
  form: ParameterForm; state: ParameterState; busy: boolean; onChange: (next: ParameterState) => void;
  onSubmit: (state: ParameterState) => void; onCancel: () => void;
}) {
  function update(next: ParameterState) { onChange(next); }
  function fieldView(field: ParameterField, value: string, set: (value: string) => void, prefix: string) {
    const help = `${form.id}-${prefix}-${field.key}-help`;
    return <label key={field.key}>{field.label}{field.unit ? ` (${field.unit})` : ""}
      {field.type === "select" ? <select aria-label={field.label} aria-describedby={help} value={value} onChange={event => set(event.target.value)}>{field.choices?.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select> : <input aria-label={field.label} type={field.type === "number" ? "number" : "text"} step="any" autoComplete="off" spellCheck={false} autoCapitalize="off" aria-describedby={help} value={value} onChange={event => set(event.target.value)} />}
      <small id={help}>{field.unit ? `Unit: ${unitNames[field.unit] || field.unit}. ` : ""}{field.meaning}</small>
    </label>;
  }
  return <form onSubmit={event => { event.preventDefault(); onSubmit(state); }} className={styles.parameterForm}>
    <h3>{form.title}</h3><p>{form.description}</p>
    <div className={styles.fields}>{form.fields.map(field => fieldView(field, state.values[field.key] || "", value => update({ ...state, values: { ...state.values, [field.key]: value } }), "values"))}</div>
    {form.groups.map(group => <section key={group.key} className={styles.parameterGroup}>
      <h4>{group.label}</h4>
      {state.rows[group.key]?.map((row, index) => <fieldset key={index}>
        <legend>{group.label} {index + 1}</legend>
        <div className={styles.fields}>{group.fields.map(field => fieldView(field, row[field.key] || "", value => update({ ...state, rows: { ...state.rows, [group.key]: state.rows[group.key].map((item, position) => position === index ? { ...item, [field.key]: value } : item) } }), `${group.key}-${index}`))}</div>
        <button type="button" className={styles.icon} title={`Remove ${group.label} ${index + 1}`} aria-label={`Remove ${group.label} ${index + 1}`} disabled={state.rows[group.key].length <= (group.minRows || 0)} onClick={() => update({ ...state, rows: { ...state.rows, [group.key]: state.rows[group.key].filter((_, position) => position !== index) } })}><Trash2 size={17} /></button>
      </fieldset>)}
      <button type="button" disabled={state.rows[group.key]?.length >= group.maxRows} onClick={() => update({ ...state, rows: { ...state.rows, [group.key]: [...(state.rows[group.key] || []), Object.fromEntries(group.fields.map(field => [field.key, field.initial || ""]))] } })}><Plus size={17} />Add {group.label.toLowerCase()}</button>
    </section>)}
    <div className={styles.run}><button type="submit" className={styles.primary} disabled={busy}><Calculator size={18} />{busy ? "Calculating..." : form.submitLabel}</button>{busy && <button type="button" onClick={onCancel}>Cancel calculation</button>}<button type="button" title="Reset parameters" aria-label="Reset parameters" className={styles.icon} onClick={() => update(initialParameterState(form.id))}><RotateCcw size={17} /></button><p>Entered values describe your model, not a live device measurement. No network test or configuration change is performed.</p></div>
  </form>;
}
