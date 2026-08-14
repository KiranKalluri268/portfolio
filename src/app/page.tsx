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
import NavigationHint from '@/components/NavigationHint';
import SceneWrapper from '@/components/SceneWrapper';
import SectionLink from '@/components/SectionLink';
import { getHomepageProjects } from '@/lib/content/projects';
import { getProjectOrigin, getSkillsForProject } from '@/lib/content/relationships';
import { getSkillsByCategory } from '@/lib/content/skills';
import { getAllRecommendations, getTimelineExperiences } from '@/lib/content/experience';

export default function Home() {
  const projects = getHomepageProjects();
  // The carousel draws the same card the projects page does, so it needs the
  // same three things: the project, its skill marks and where it came from.
  const projectEntries = projects.map((project) => ({
    project,
    skills: getSkillsForProject(project),
    origin: getProjectOrigin(project) as string,
  }));
  const skillGroups = getSkillsByCategory();
  const experiences = getTimelineExperiences();
  const recommendations = getAllRecommendations();

  return (
    <>
      <ErrorBoundary>
        <LoadingScreen />
      </ErrorBoundary>

      <div id="portfolio-content">
        <SkipLink href="#main-content">Skip to main content</SkipLink>
        <SkipLink href="#about">Skip to about</SkipLink>
        <SkipLink href="#experience">Skip to experience</SkipLink>
        <SkipLink href="#projects">Skip to projects</SkipLink>
        <SkipLink href="#skills">Skip to skills</SkipLink>
        <SkipLink href="#contact">Skip to contact</SkipLink>

        {/* Honours ?section= on arrival, once the entry screen has let go. */}
        <SectionLink />

        <ErrorBoundary>
          <SceneIndicator />
        </ErrorBoundary>

        <ErrorBoundary>
          <NavigationControls />
        </ErrorBoundary>

        <ErrorBoundary>
          <NavigationHint projectCount={projects.length} />
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
              <ExperienceTimeline experiences={experiences} />
            </ErrorBoundary>
          </SceneWrapper>
          <SceneWrapper index={3}>
            <ErrorBoundary>
              <ProjectsSection entries={projectEntries} />
            </ErrorBoundary>
          </SceneWrapper>
          <SceneWrapper index={4}>
            <ErrorBoundary>
              <SkillsCarousel groups={skillGroups} />
            </ErrorBoundary>
          </SceneWrapper>
          <SceneWrapper index={5}>
            <ErrorBoundary>
              <ContactSection recommendations={recommendations} />
            </ErrorBoundary>
          </SceneWrapper>
        </main>
      </div>
    </>
  );
}
