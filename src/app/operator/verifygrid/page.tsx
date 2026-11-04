import type {Metadata} from "next";
import Image from "next/image";
import {ShieldCheck,LogOut,KeyRound,FileCheck2,Clock3} from "lucide-react";
import {VerifyGridAccessGate} from "@/components/verifygrid-access-gate";
import {VerifyGridControlPanel} from "@/components/verifygrid-control-panel";
import {VerifyGridOnboardingQueue} from "@/components/verifygrid-onboarding-queue";
import {VerifyGridSecurityBar} from "@/components/verifygrid-security-bar";
import {getVerifyGridParentIdentity} from "@/lib/verifygrid-identity";
import {verifyGridSSOConfig} from "@/lib/verifygrid-identity-domain";
import {getVerifyGridAccessState} from "@/lib/verifygrid-operator-auth";
import {getVerifyGridPortfolio} from "@/lib/verifygrid";
import styles from "./identity.module.css";

export const metadata:Metadata={title:"VerifyGrid Operator Console",robots:{index:false,follow:false}};
export const dynamic="force-dynamic";
async function loadPortfolio() {
  const portfolio=await getVerifyGridPortfolio();
  return {portfolio,evaluatedAt:Date.now()};
}
export default async function VerifyGridOperatorPage({searchParams}:{searchParams:Promise<{error?:string}>}) {
  const {error}=await searchParams;
  let configured=false;
  try {configured=Boolean(verifyGridSSOConfig());} catch {}
  const identity=configured ? await getVerifyGridParentIdentity() : null;
  const signedIn=identity?.provider === "entra";
  const access=signedIn ? await getVerifyGridAccessState(identity.email) : null;
  const snapshot=access?.state === "unlocked" ? await loadPortfolio() : null;
  return <main className={`admin-page ${styles.shell}`}>
    <header className={styles.header}>
      <Image alt="QuantumCrafters Studio Pvt. Ltd." className={styles.brand} height={56} src="/brand/quantumcrafters-logo.png" width={250} />
      <h1 className={styles.title}><span>QCS VerifyGrid</span>Operator console</h1>
      {signedIn ? <form action="/api/verifygrid/identity/logout" method="post"><button className="button secondary compact-button"><LogOut aria-hidden="true" size={16}/> Sign out of VerifyGrid</button></form> : null}
    </header>
    {!signedIn ? <div className={styles.entry}>
      <section className={styles.intro} aria-label="Access requirements">
        <div><div className={styles.seal}><ShieldCheck aria-hidden="true" size={29}/></div><h2>Scoped security.<br/>Verified access.</h2><p>Your workspace for client assurance, evidence and authorized testing.</p></div>
        <ol className={styles.steps}>
          <li><ShieldCheck aria-hidden="true" size={18}/><div><strong>Assigned work identity</strong><span>Sign in through your organization&apos;s Microsoft account.</span></div></li>
          <li><KeyRound aria-hidden="true" size={18}/><div><strong>Verified passkey</strong><span>Confirm your identity before client information is available.</span></div></li>
          <li><FileCheck2 aria-hidden="true" size={18}/><div><strong>Approved client scope</strong><span>Every action remains bound to your role and the engagement&apos;s authority.</span></div></li>
        </ol>
      </section>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Operator identity</p><h2>Sign in to VerifyGrid</h2>
        <p className={styles.description}>Continue with your assigned work account. VerifyGrid will then ask for your passkey.</p>
        {configured ? <form action="/api/verifygrid/identity/start" method="post"><button className={styles.button}><ShieldCheck aria-hidden="true" size={18}/> Continue with Microsoft</button></form>
          : <p className={styles.notice} role="status"><Clock3 aria-hidden="true" size={18}/><span>Operator sign-in is awaiting configuration. Contact the platform owner for access.</span></p>}
        {error ? <p className={styles.error} role="alert">Sign-in could not be completed. Confirm your assigned access and try again.</p> : null}
        <p className={styles.footnote}>Console access does not authorize testing. Client approval and the exact engagement scope are required for every assessment.</p>
      </section>
    </div> : <section className={styles.workspace}>
      {access?.state === "unlocked" && snapshot ? <>
        <VerifyGridSecurityBar access={access}/><VerifyGridOnboardingQueue/>
        <VerifyGridControlPanel access={access.operator} evaluatedAt={snapshot.evaluatedAt} initialPortfolio={snapshot.portfolio}/>
      </> : access ? <VerifyGridAccessGate access={access} email={identity.email}/> : null}
    </section>}
  </main>;
}
