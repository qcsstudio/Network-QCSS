export function automatedAdvisoriesEnabled(env:NodeJS.ProcessEnv=process.env){return env.QCS_REVIEWED_ADVISORIES_ENABLED==='1';}
export function hasAutomatedAdvisoryOwnership(value:unknown){
  const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
  const v=object(value),trace=object(v.editorialTrace),meta=object(v.metadata);
  return v.createdBy==='reviewed-advisory-worker'||typeof object(trace.automatedAdvisory).releaseId==='string'||typeof object(meta.automatedAdvisory).releaseId==='string';
}
