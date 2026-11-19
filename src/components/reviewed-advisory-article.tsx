import Link from 'next/link';
import {ExternalLink,ShieldCheck} from 'lucide-react';
import {StructuredData} from './structured-data';
import {guideAsset,type ReviewedEnvelope} from '@/lib/reviewed-advisory-domain';
import styles from './reviewed-advisory-article.module.css';

export function ReviewedDiagram({release,id,alt}:{release:ReviewedEnvelope;id:string;alt:string}){
 const file=(layout:string,extension:string)=>guideAsset(release,`graphics/${id.toLowerCase()}-${layout}.${extension}`);
 return <figure className={styles.diagram}><picture>
  <source media="(prefers-reduced-motion: reduce) and (max-width: 640px)" srcSet={file('mobile','png')}/>
  <source media="(prefers-reduced-motion: reduce)" srcSet={file('desktop','png')}/>
  <source media="(max-width: 640px)" srcSet={file('mobile','svg')}/>
  {/* External, reviewed SVGs remain images, not injected markup. */}
  <img alt={alt} src={file('desktop','svg')} width={2600} height={1462} loading="lazy"/>
 </picture><figcaption>{alt}</figcaption></figure>;
}
export function ReviewedAdvisoryArticle({release,publishedAt,modifiedAt,canonical}:{release:ReviewedEnvelope;publishedAt:string;modifiedAt:string;canonical:string}){
 const g=release.guide,overview=g.graphics.find(x=>x.id==='overview')||g.graphics[0];
 return <main className={`purpose-intelligence ${styles.page}`}>
  <StructuredData data={{'@context':'https://schema.org','@type':'TechArticle',headline:g.title,description:g.description,datePublished:publishedAt,dateModified:modifiedAt,mainEntityOfPage:canonical,author:{'@type':'Organization',name:'QuantumCrafters Studio Private Limited',url:'https://www.qcsstudio.com'},citation:g.sources.map(s=>s.url)}}/>
  <article data-reviewed-release={release.releaseId} data-reviewed-candidate={release.candidateSha256}>
   <header className={styles.header}><Link href="/security-advisories" className="text-link">Security Advisory Desk</Link><p className="eyebrow">Cisco / Node.js / Operational guidance</p><h1>{g.title}</h1><p>{g.description}</p><p className={styles.meta}>QCS published {new Date(publishedAt).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata'})} · Updated {new Date(modifiedAt).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata'})}</p></header>
   <div className={styles.layout}>
    <nav className={styles.outline} aria-label="In this advisory"><strong>In this advisory</strong><a href="#direct-answer">Direct answer</a><a href="#terms">Key terms</a><a href="#vulnerabilities">The four vulnerabilities</a>{g.sections.map((s,i)=><a key={s.heading} href={`#guide-${i}`}>{s.heading}</a>)}<a href="#checks">Read-only checks</a><a href="#sources">Vendor references</a></nav>
    <div className={styles.body}>
     <section id="direct-answer"><p className="eyebrow">In plain language</p><h2>What this means for your network</h2><p>{g.answer}</p><ul>{g.takeaways.map(x=><li key={x}>{x}</li>)}</ul></section>
     {overview?<ReviewedDiagram release={release} {...overview}/>:null}
     <section id="terms"><h2>Key terms, explained</h2><dl>{g.definitions.map(d=><div key={d.term}><dt>{d.term}</dt><dd>{d.definition}</dd></div>)}</dl></section>
     <section id="vulnerabilities"><h2>Understand the four vulnerabilities</h2>{g.vulnerabilities.map(v=><section key={v.id} className={styles.cve}><p className="eyebrow">{v.id}</p><h3>{v.title}</h3><p>{v.vendorExplanation}</p><p>{v.context}</p><p><strong>Next action: </strong>{v.recommendation}</p>{g.graphics.find(x=>x.id.toLowerCase()===v.id.toLowerCase())?<ReviewedDiagram release={release} {...g.graphics.find(x=>x.id.toLowerCase()===v.id.toLowerCase())!}/>:null}<p><a href={v.contextUrl} target="_blank" rel="noreferrer">Technical context <ExternalLink size={14} aria-hidden="true"/></a> · <a href={v.originalDisclosureUrl} target="_blank" rel="noreferrer">Original disclosure</a> · <a href={v.ciscoAdvisoryUrl} target="_blank" rel="noreferrer">Cisco advisory</a></p></section>)}</section>
     {g.sections.map((s,i)=><section id={`guide-${i}`} key={s.heading}><h2>{s.heading}</h2>{s.body.split(/\n\s*\n/).map((p,j)=><p key={j}>{p}</p>)}{s.bullets?.length?<ul>{s.bullets.map(b=><li key={b}>{b}</li>)}</ul>:null}{s.sourceUrls?.map(url=><a className={styles.reference} key={url} href={url} target="_blank" rel="noreferrer">{new URL(url).hostname} reference <ExternalLink size={14} aria-hidden="true"/></a>)}</section>)}
     <section id="checks"><h2>Read-only checks and what they prove</h2>{g.readOnlyChecks.map(c=><div key={c.command} className={styles.check}><pre><code>{c.command}</code></pre><p>{c.meaning}</p><p><strong>Scope: </strong>{c.scope}</p></div>)}</section>
     <section><h2>Operational checklist</h2><ol>{g.checklist.map(x=><li key={x}>{x}</li>)}</ol></section>
     <section><h2>Common questions</h2>{g.questions.map(q=><details key={q.question}><summary>{q.question}</summary><p>{q.answer}</p>{q.sourceUrls?.map(url=><a className={styles.reference} href={url} key={url} target="_blank" rel="noreferrer">Vendor reference</a>)}</details>)}</section>
     <section><h2>Scope and limitations</h2><p>{g.technicalScope}</p><ul>{g.limitations.map(x=><li key={x}>{x}</li>)}</ul></section>
     <section id="sources"><h2><ShieldCheck size={24} aria-hidden="true"/> Original vendor and vulnerability references</h2><ol>{g.sources.map(s=><li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.label} <ExternalLink size={14} aria-hidden="true"/></a></li>)}</ol></section>
     <footer className={styles.footer}><p>{g.byline}</p><Link href="/#contact" className="button primary">Discuss your environment</Link></footer>
    </div>
   </div>
  </article>
 </main>;
}
