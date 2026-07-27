"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

type OptionalConsent = {
  analytics: boolean;
  marketing: boolean;
};

const deniedConsent: OptionalConsent = { analytics: false, marketing: false };

function readOptionalConsent(): OptionalConsent {
  const stored = window.localStorage.getItem("network-qcss-consent");
  if (!stored) return deniedConsent;

  try {
    const parsed = JSON.parse(stored) as Partial<OptionalConsent>;
    return { analytics: Boolean(parsed.analytics), marketing: Boolean(parsed.marketing) };
  } catch {
    return deniedConsent;
  }
}

export function MarketingScripts() {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  const [consent, setConsent] = useState<OptionalConsent>(deniedConsent);

  useEffect(() => {
    const syncConsent = () => setConsent(readOptionalConsent());
    syncConsent();
    window.addEventListener("qcs-consent-change", syncConsent);
    return () => window.removeEventListener("qcs-consent-change", syncConsent);
  }, []);

  const loadGoogleContainer = Boolean(gtmId && (consent.analytics || consent.marketing));
  const loadDirectAnalytics = Boolean(!gtmId && gaId && consent.analytics);

  return (
    <>
      <Script
        id="consent-mode-default"
        strategy="afterInteractive"
      >
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){window.dataLayer.push(arguments);}
          gtag('consent', 'default', {
            ad_storage: 'denied',
            analytics_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            functionality_storage: 'granted',
            security_storage: 'granted'
          });
        `}
      </Script>

      {loadGoogleContainer ? (
        <Script id="google-tag-manager" strategy="afterInteractive">
          {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${gtmId}');
          `}
        </Script>
      ) : null}

      {loadDirectAnalytics ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){window.dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaId}', { send_page_view: true });
            `}
          </Script>
        </>
      ) : null}

    </>
  );
}
