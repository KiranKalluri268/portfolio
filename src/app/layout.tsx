import type { Metadata } from "next";
import {
  Tektur,
  Noto_Sans_Devanagari,
  Noto_Sans_Tamil,
  Noto_Sans_Kannada,
  Noto_Sans_Telugu,
} from "next/font/google";
import "./globals.css";
import "lenis/dist/lenis.css";
import BlackholeEffect from '@/background/BlackholeEffect';
import StarsBackground from "@/background/StarsBackground";
import { AudioProvider } from "@/context/AudioContextProvider";
import { SmoothScrollProvider } from "@/context/SmoothScrollContext";
import NavBar from "@/components/NavBar1";
import EntryCurtain from "@/components/EntryCurtain";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const SITE_URL = "https://saikirankalluri.dev";
const SITE_NAME = "Saikiran Kalluri";
const SITE_DESCRIPTION =
  "Portfolio of Saikiran Kalluri, a software engineer building full-stack, AI-assisted, cloud, and developer-focused products.";

const tektur = Tektur({
  variable: "--font-tektur",
  // The entry greeting says hello in Russian, Greek, Vietnamese, Turkish and
  // Polish before it reaches the Indian scripts. Tektur covers all five itself,
  // so they are set in the site's own face rather than a Noto fallback - and
  // each subset is its own file behind a unicode-range, so a visitor only
  // fetches the ones their greeting actually needs.
  subsets: ["latin", "latin-ext", "cyrillic", "greek", "vietnamese"],
  display: 'swap',
  weight: ["400", "500", "600", "700"],
});

/* The entry greeting says hello in four Indian scripts, and Tektur covers none
   of them. Without a face named for each the sequence renders in whatever the
   visitor happens to have installed, or in tofu on a machine with no Indic
   fonts at all, and the fly-through then pushes through a box instead of a
   letter. Each is subset to its own script at the one weight the greeting
   uses. */
const notoDevanagari = Noto_Sans_Devanagari({
  variable: "--font-greeting-devanagari",
  subsets: ["devanagari"],
  display: "swap",
  weight: ["700"],
});

const notoTamil = Noto_Sans_Tamil({
  variable: "--font-greeting-tamil",
  subsets: ["tamil"],
  display: "swap",
  weight: ["700"],
});

const notoKannada = Noto_Sans_Kannada({
  variable: "--font-greeting-kannada",
  subsets: ["kannada"],
  display: "swap",
  weight: ["700"],
});

const notoTelugu = Noto_Sans_Telugu({
  variable: "--font-greeting-telugu",
  subsets: ["telugu"],
  display: "swap",
  weight: ["700"],
});


export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Saikiran Kalluri | Software Engineer",
    template: "%s | Saikiran Kalluri",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  keywords: [
    "Saikiran Kalluri",
    "Sai Kiran Kalluri",
    "software engineer",
    "full-stack developer",
    "React developer",
    "Next.js developer",
    "Node.js developer",
    "AWS developer",
    "AI engineer",
    "portfolio",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "/",
    siteName: SITE_NAME,
    title: "Saikiran Kalluri | Software Engineer",
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Saikiran Kalluri — Software Engineer",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Saikiran Kalluri | Software Engineer",
    description: SITE_DESCRIPTION,
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: "3EakCwstiUdkMkdhG4C9U2iG3xAVbQnaDxh9ButJ7yM",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Sai Kiran Kalluri",
  "alternateName": ["Kiran Kalluri", "Sai Kiran", "Saikiran Kalluri"],
  "url": SITE_URL,
  "jobTitle": "Software Engineer Intern",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Telangana",
    "addressCountry": "India"
  },
  "knowsAbout": ["AWS", "React", "Next.js", "Node.js", "Java", "Python", "C++", "MERN Stack", "DevOps", "Git", "GitHub", "Docker", "Linux", "CI/CD"],
  "worksFor": {
    "@type": "Organization",
    "name": "Aude.ai"
  },
  "image": {
    "@type": "ImageObject",
    "url": `${SITE_URL}/images/kiran_passphoto.jpg`,
    "width": 390,
    "height": 510
  },
  "sameAs": [
    "https://www.linkedin.com/in/saikiran-kalluri",
    "https://github.com/KiranKalluri268",
    "https://www.instagram.com/kiran_kalluri__08",
    "https://www.facebook.com/saikiran.88s",
    "https://x.com/KiranKalluri_08"
  ]
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${tektur.variable} ${notoDevanagari.variable} ${notoTamil.variable} ${notoKannada.variable} ${notoTelugu.variable}`}>
      <body className="relative bg-black">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <SmoothScrollProvider>
              <AudioProvider>
                <StarsBackground />

                {/* Blackhole: Interactive gravity field */}
                <BlackholeEffect />

                {/* The header is a fixture of the site, not of the home page:
                    every other route used to have a single back button and no
                    way to reach anything else. */}
                <NavBar />

                {/* Stands in for LoadingScreen's own backdrop until its portal
                    is ready - see EntryCurtain for why the gap is real. */}
                <EntryCurtain />

                {/* Your main content */}
                <div className="relative z-10">
                  {children}
                </div>

                {/* Nothing measured this site once it shipped: every frame time
                    and load figure in its history was taken by hand, on one
                    machine, before deploy. These are the two that need no
                    account and no key on Vercel — page views and referrers,
                    and real Core Web Vitals from real devices. Neither sets a
                    cookie or collects anything that identifies a visitor.
                    Error reporting is still missing and needs a service
                    chosen; see STATUS.md. */}
                <Analytics />
                <SpeedInsights />
              </AudioProvider>
        </SmoothScrollProvider>
      </body>
    </html>
  );
}
