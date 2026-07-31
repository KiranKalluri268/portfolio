import NavBar from '@/components/NavBar1';
import Hero from '@/components/hero';
import AboutSection from '@/components/AboutSection';
import ProjectsSection from '@/components/projects';
import ExperienceTimeline from '@/components/ExperienceTimeline';
import SkillsCarousel from '@/components/SkillsCarousel';
import ContactSection from '@/components/Contact';
import LoadingScreen from '@/components/LoadingScreen';
import ErrorBoundary from '@/components/ErrorBoundary';
import SkipLink from '@/components/SkipLink';
import SceneIndicator from '@/components/SceneIndicator';
import NavigationControls from '@/components/NavigationControls';
import SceneWrapper from '@/components/SceneWrapper';
import { getHomepageProjects } from '@/lib/content/projects';
import { getSkillsByCategory } from '@/lib/content/skills';
import { getTimelineExperiences } from '@/lib/content/experience';

export default function Home() {
  const projects = getHomepageProjects();
  const skillGroups = getSkillsByCategory();
  const experiences = getTimelineExperiences();

  return (
    <>
      <ErrorBoundary>
        <LoadingScreen />
      </ErrorBoundary>

      <div id="portfolio-content">
        <SkipLink href="#main-content">Skip to main content</SkipLink>
        <SkipLink href="#about">Skip to about</SkipLink>
        <SkipLink href="#projects">Skip to projects</SkipLink>
        <SkipLink href="#experience">Skip to experience</SkipLink>
        <SkipLink href="#skills">Skip to skills</SkipLink>
        <SkipLink href="#contact">Skip to contact</SkipLink>

        <ErrorBoundary>
          <NavBar />
        </ErrorBoundary>

        <ErrorBoundary>
          <SceneIndicator />
        </ErrorBoundary>

        <ErrorBoundary>
          <NavigationControls />
        </ErrorBoundary>

        <main id="main-content" aria-label="Main content">
          <SceneWrapper index={0}>
            <ErrorBoundary>
              <Hero />
            </ErrorBoundary>
          </SceneWrapper>
          <SceneWrapper index={1}>
            <ErrorBoundary>
              <AboutSection />
            </ErrorBoundary>
          </SceneWrapper>
          <SceneWrapper index={2}>
            <ErrorBoundary>
              <ProjectsSection projects={projects} />
            </ErrorBoundary>
          </SceneWrapper>
          <SceneWrapper index={3}>
            <ErrorBoundary>
              <ExperienceTimeline experiences={experiences} />
            </ErrorBoundary>
          </SceneWrapper>
          <SceneWrapper index={4}>
            <ErrorBoundary>
              <SkillsCarousel groups={skillGroups} />
            </ErrorBoundary>
          </SceneWrapper>
          <SceneWrapper index={5}>
            <ErrorBoundary>
              <ContactSection />
            </ErrorBoundary>
          </SceneWrapper>
        </main>
      </div>
    </>
  );
}
