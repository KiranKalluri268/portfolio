import type { Metadata } from "next";
import { Foldit, Tektur } from "next/font/google";
import "./globals.css";
import "lenis/dist/lenis.css";
import BlackholeEffect from '@/background/BlackholeEffect';
import StarsBackground from "@/background/StarsBackground";
import { AudioProvider } from "@/context/AudioContextProvider";
import { SmoothScrollProvider } from "@/context/SmoothScrollContext";
import NavBar from "@/components/NavBar1";

const SITE_URL = "https://saikirankalluri.vercel.app";
const SITE_NAME = "Saikiran Kalluri";
const SITE_DESCRIPTION =
  "Portfolio of Saikiran Kalluri, a software engineer building full-stack, AI-assisted, cloud, and developer-focused products.";

const foldit = Foldit({
  variable: "--font-foldit",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "700"],
});

const tektur = Tektur({
  variable: "--font-tektur",
  subsets: ["latin"],
  display: 'swap',
  weight: ["400", "500", "600", "700"],
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
    <html lang="en" className={`${foldit.variable} ${tektur.variable}`}>
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

                {/* Your main content */}
                <div className="relative z-10">
                  {children}
                </div>
              </AudioProvider>
        </SmoothScrollProvider>
      </body>
    </html>
  );
}
