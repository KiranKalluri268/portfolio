import type { Metadata } from "next";
import Link from "next/link";
import faq from "@/data/faq.json";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers to the questions recruiters usually have when they read Saikiran Kalluri's portfolio.",
  alternates: {
    canonical: "/faq",
  },
  openGraph: {
    title: "FAQ | Saikiran Kalluri",
    description: "Answers to the questions recruiters usually have when they read Saikiran Kalluri's portfolio.",
    url: "/faq",
  },
};

export default function FaqPage() {
  return (
    <main className="relative z-10 min-h-[100svh] overflow-hidden px-4 pt-24 pb-8 text-white sm:px-6 sm:pt-28 sm:pb-12 lg:px-10">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-14 sm:mb-20">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.28em] text-accent-soft">Questions I get</p>
          <h1 className="text-4xl font-bold leading-none tracking-tight sm:text-6xl">
            FAQ
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-gray-300 sm:text-lg">
            The questions recruiters tend to have after reading through my projects and experience —
            answered directly, rather than left for a screening call.
          </p>
        </header>

        <section className="space-y-4 sm:space-y-5" aria-label="Frequently asked questions">
          {faq.map((item) => (
            <article
              key={item.question}
              className="rounded-3xl border border-white/10 bg-black/60 p-6 backdrop-blur-md sm:p-8"
            >
              <h2 className="text-lg font-bold leading-snug sm:text-xl">{item.question}</h2>
              <p className="mt-4 leading-relaxed text-gray-300 sm:text-base">{item.answer}</p>
            </article>
          ))}
        </section>

        <section className="mt-12 rounded-3xl border border-white/10 bg-black/60 px-6 py-10 text-center backdrop-blur-md sm:px-10 sm:py-14">
          <h2 className="text-2xl font-bold sm:text-3xl">Still have a question?</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-gray-300 sm:text-base">
            Reach out directly, or take a look at my résumé and projects for more detail.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/#contact" className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-accent-tint focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-soft">
              Contact me
            </Link>
            <Link href="/resume" className="rounded-full border border-white/20 bg-black/45 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:border-accent-soft/60 hover:text-accent-soft focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-soft">
              View résumé
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
