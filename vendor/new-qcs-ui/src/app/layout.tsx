import Script from "next/script";
import type { Metadata, Viewport } from "next";
import "../styles/index.scss";
import { PolicyProvider } from "@/context/policyContext";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.qcsstudio.com"),
  title: {
    default: "QuantumCrafters | AI Growth, Automation & Marketing",
    template: "%s | QuantumCrafters",
  },
  description:
    "QuantumCrafters helps brands scale with agentic AI, automation, web/app engineering, and performance marketing built for measurable ROI.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "QuantumCrafters | AI Growth, Automation & Marketing",
    description:
      "Agentic AI systems, automation, and growth marketing services designed to improve revenue, efficiency, and decision quality.",
    url: "https://www.qcsstudio.com/",
    siteName: "QuantumCrafters",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "QuantumCrafters | AI Growth, Automation & Marketing",
    description:
      "Scale faster with AI systems, automation, and performance marketing from QuantumCrafters.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0b1120",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <link rel="icon" href="/assets/img/Images/favicon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700;900&family=Kanit:wght@400;500;600;700&display=swap"
        />
        <Script
          id="microsoft-clarity"
          strategy="lazyOnload"
          dangerouslySetInnerHTML={{
            __html: `
              (function(c,l,a,r,i,t,y){
                  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "tjdh7hfz98");
            `,
          }}
        />
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-TGNFYNFQQ2" strategy="lazyOnload" />
        <Script id="google-analytics" strategy="lazyOnload">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-TGNFYNFQQ2');
          `}
        </Script>
         <Script
          id="organization-schema"
          type="application/ld+json"
          strategy="lazyOnload"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "QuantumCrafters",
              "url": "https://www.qcsstudio.com/",
              "logo": "https://www.qcsstudio.com/assets/img/Images/favicon.png",
              "description":
                "AI-powered growth partner offering agentic AI development, web/app engineering, automation, analytics, and marketing solutions to help businesses scale.",
              "telephone": "+917719607776",
              "email": "info@qcsstudio.com",
              "address": {
                "@type": "PostalAddress",
                "streetAddress":
                  "D266 (C) 203, Second Floor Ram Hari Tower, Phase 8B, Industrial Area, Sector 74",
                "addressLocality": "Mohali",
                "addressRegion": "Punjab",
                "postalCode": "160055",
                "addressCountry": "IN",
              },
              "sameAs": [
                "https://www.linkedin.com/company/quantumcrafters-studio",
                "https://www.facebook.com/quantumcraftersstudio",
                "https://www.instagram.com/quantumcraftersstudio",
              ],
              "founder": {
                "@type": "Person",
                "name": "Ravi K. Sankhyan",
              },
            }),
          }}
        />
      </head>

      <body suppressHydrationWarning={true}>
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          // strategy="afterInteractive"
          strategy="lazyOnload"
        />
        <PolicyProvider>

          {children}
        </PolicyProvider>
      </body>
    </html>
  );
}
