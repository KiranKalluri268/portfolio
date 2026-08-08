"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";

export const SECTION_IDS = ["hero", "about", "experience", "projects", "skills", "contact"] as const;
export type SectionId = (typeof SECTION_IDS)[number];

interface ScrollActionsContextValue {
  lenis: Lenis | null;
  scrollToSection: (section: SectionId) => void;
  toggleProjectsEndpoint: () => void;
  scrollNext: () => void;
  scrollPrev: () => void;
}

const ScrollActionsContext = createContext<ScrollActionsContextValue | undefined>(undefined);
const ActiveSectionContext = createContext<SectionId | undefined>(undefined);

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const [activeSection, setActiveSection] = useState<SectionId>("hero");
  const activeSectionRef = useRef<SectionId>("hero");
  const [lenis, setLenis] = useState<Lenis | null>(null);
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const instance = new Lenis({
      autoRaf: false,
      anchors: true,
      smoothWheel: !reduceMotion,
      // A finite ease reaches the target cleanly. Lerp mode ends with a
      // sub-pixel snap that horizontal ScrollTrigger motion can amplify.
      lerp: reduceMotion ? 1 : 0,
      duration: reduceMotion ? undefined : 0.8,
      easing: (progress: number) => 1 - Math.pow(1 - progress, 4),
      syncTouch: false,
      wheelMultiplier: 0.9,
    });
    lenisRef.current = instance;
    // The browser-only Lenis instance must be published after it is created.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLenis(instance);

    const activateSection = (section: SectionId) => {
      if (activeSectionRef.current === section) return;
      activeSectionRef.current = section;
      setActiveSection(section);
    };

    const detectActiveSection = () => {
      const viewportCenter = window.innerHeight / 2;
      const visibleSection = SECTION_IDS.find((id) => {
        const element = document.getElementById(id);
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        return rect.top <= viewportCenter && rect.bottom > viewportCenter;
      });
      if (visibleSection) activateSection(visibleSection);
    };

    const updateScrollTrigger = () => {
      ScrollTrigger.update();
      detectActiveSection();
    };
    const updateLenis = (time: number) => instance.raf(time * 1000);
    instance.on("scroll", updateScrollTrigger);
    gsap.ticker.add(updateLenis);
    gsap.ticker.lagSmoothing(0);

    const initialDetectionFrame = requestAnimationFrame(updateScrollTrigger);
    window.addEventListener("resize", detectActiveSection, { passive: true });
    ScrollTrigger.addEventListener("refresh", detectActiveSection);

    return () => {
      cancelAnimationFrame(initialDetectionFrame);
      window.removeEventListener("resize", detectActiveSection);
      ScrollTrigger.removeEventListener("refresh", detectActiveSection);
      gsap.ticker.remove(updateLenis);
      instance.off("scroll", updateScrollTrigger);
      instance.destroy();
      lenisRef.current = null;
      setLenis(null);
    };
  }, []);

  const scrollToSection = useCallback((section: SectionId) => {
    // A section can nominate a different landing point than its own top — the
    // contact section opens with recommendations, but the dot should take you
    // to the form. Active-section detection still uses the whole section, so
    // the dot stays lit while the lead-in is on screen.
    const element =
      document.querySelector<HTMLElement>(`[data-scroll-target="${section}"]`) ??
      document.getElementById(section);
    if (!element) return;
    if (lenisRef.current) lenisRef.current.scrollTo(element, { duration: 1.15 });
    else element.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const toggleProjectsEndpoint = useCallback(() => {
    const projectsTrigger = ScrollTrigger.getById("projects-horizontal-pin");
    if (!projectsTrigger) {
      scrollToSection("projects");
      return;
    }

    // Keep the destination just inside the pin so Projects remains the active
    // scene at both ends. From the middle, continue toward the opposite half.
    const pinInset = 2;
    const destination = projectsTrigger.progress < 0.5
      ? projectsTrigger.end - pinInset
      : projectsTrigger.start + pinInset;

    if (lenisRef.current) {
      lenisRef.current.scrollTo(destination, { duration: 1.15 });
    } else {
      window.scrollTo({ top: destination, behavior: "smooth" });
    }
  }, [scrollToSection]);

  const scrollNext = useCallback(() => {
    const projectsTrigger = ScrollTrigger.getById("projects-horizontal-pin");
    if (activeSectionRef.current === "projects" && projectsTrigger) {
      const range = projectsTrigger.end - projectsTrigger.start;
      const steps = Math.max(1, Math.round(range / window.innerHeight));
      const currentStep = Math.round(projectsTrigger.progress * steps);

      if (currentStep < steps) {
        const destination = projectsTrigger.start + ((currentStep + 1) / steps) * range;
        if (lenisRef.current) lenisRef.current.scrollTo(destination, { duration: 0.8 });
        else window.scrollTo({ top: destination, behavior: "smooth" });
        return;
      }
    }

    const index = SECTION_IDS.indexOf(activeSectionRef.current);
    scrollToSection(SECTION_IDS[Math.min(index + 1, SECTION_IDS.length - 1)]);
  }, [scrollToSection]);

  const scrollPrev = useCallback(() => {
    const projectsTrigger = ScrollTrigger.getById("projects-horizontal-pin");
    if (activeSectionRef.current === "projects" && projectsTrigger) {
      const range = projectsTrigger.end - projectsTrigger.start;
      const steps = Math.max(1, Math.round(range / window.innerHeight));
      const currentStep = Math.round(projectsTrigger.progress * steps);

      if (currentStep > 0) {
        const destination = projectsTrigger.start + ((currentStep - 1) / steps) * range;
        if (lenisRef.current) lenisRef.current.scrollTo(destination, { duration: 0.8 });
        else window.scrollTo({ top: destination, behavior: "smooth" });
        return;
      }
    }

    const index = SECTION_IDS.indexOf(activeSectionRef.current);
    scrollToSection(SECTION_IDS[Math.max(index - 1, 0)]);
  }, [scrollToSection]);

  const actions = useMemo(
    () => ({ lenis, scrollToSection, toggleProjectsEndpoint, scrollNext, scrollPrev }),
    [lenis, scrollToSection, toggleProjectsEndpoint, scrollNext, scrollPrev],
  );

  return (
    <ScrollActionsContext.Provider value={actions}>
      <ActiveSectionContext.Provider value={activeSection}>
        {children}
      </ActiveSectionContext.Provider>
    </ScrollActionsContext.Provider>
  );
}

export function useScrollActions() {
  const context = useContext(ScrollActionsContext);
  if (!context) throw new Error("useScrollActions must be used within SmoothScrollProvider");
  return context;
}

export function useActiveSection() {
  const context = useContext(ActiveSectionContext);
  if (!context) throw new Error("useActiveSection must be used within SmoothScrollProvider");
  return context;
}

export function useSmoothScroll() {
  return { activeSection: useActiveSection(), ...useScrollActions() };
}
