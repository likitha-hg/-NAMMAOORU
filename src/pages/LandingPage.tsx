import React, { useState } from 'react';
import {
  ArrowRight,
  Building2,
  Camera,
  CheckCircle2,
  GitBranch,
  Handshake,
  MapPin,
  Menu,
  Play,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import {
  ExplainerVideoModal,
  ProblemIllustration,
  ProblemIllustrationType,
} from '../components/landing/LandingVisuals';
import { BengaluruGoogleMap } from '../components/map/BengaluruGoogleMap';
import { StatusIndicator } from '../components/ui/StatusIndicator';
import { BENGALURU_NEIGHBOURHOODS, ROLE_METADATA } from '../data/mockData';
import { useCivic } from '../context/CivicContext';
import { ReportStatus, UserRole } from '../types/civic';

const IMAGES = {
  hero: '/src/assets/images/hero_bengaluru_neighbourhood_1795769479747.jpg',
  explainerPoster: '/src/assets/images/explainer_bengaluru_video_1795770193299.jpg',
  howCommunity: '/src/assets/images/how_community_coordination_1795770192753.jpg',
  howVerification: '/src/assets/images/how_citizen_verification_1795770193773.jpg',
  cleanupDrive: '/src/assets/images/community_cleanup_drive_1795770193811.jpg',
  treePlanting: '/src/assets/images/bengaluru_community_action_1795769480761.jpg',
  lakeRestoration: '/src/assets/images/community_lake_restoration_1795770195206.jpg',
  wasteAwareness: '/src/assets/images/community_segregation_awareness_1795770195881.jpg',
  beforeDrain: '/src/assets/images/verification_before_drain_1795770196006.jpg',
  afterDrain: '/src/assets/images/bengaluru_street_resolution_1795769481980.jpg',
};

const PROBLEM_CARDS: {
  id: ProblemIllustrationType;
  title: string;
  description: string;
}[] = [
  {
    id: 'roads',
    title: 'Roads & Potholes',
    description:
      'Report damaged asphalt, sunken manholes, and hazardous junction potholes affecting daily commuters.',
  },
  {
    id: 'drainage',
    title: 'Water & Drainage',
    description:
      'Flag blocked stormwater grates, overflowing drains, and pipeline leaks before monsoon waterlogging worsens.',
  },
  {
    id: 'waste',
    title: 'Waste & Sanitation',
    description:
      'Highlight recurring garbage blackspots, overflowing street bins, and missed ward collection points.',
  },
  {
    id: 'footpaths',
    title: 'Footpaths & Public Safety',
    description:
      'Identify broken walkway slabs, exposed cables, and pedestrian obstructions around schools and bus stops.',
  },
  {
    id: 'streetlights',
    title: 'Streetlights & Electricity',
    description:
      'Log dark residential lanes, non-functional LED poles, and flickering feeder lines after sunset.',
  },
  {
    id: 'public-spaces',
    title: 'Damaged Public Spaces',
    description:
      'Document broken park benches, neglected playgrounds, and neighbourhood green corners needing care.',
  },
];

const WORKFLOW_STEPS: {
  number: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    number: '01',
    title: 'Citizens Report Neighbourhood Problems',
    description:
      'Residents report local issues through photos, voice recordings or short text descriptions in supported languages.',
    icon: <Camera className="h-5 w-5 text-[#14532D]" aria-hidden="true" />,
  },
  {
    number: '02',
    title: 'Gemini AI Understands and Classifies the Issue',
    description:
      'AI assists in understanding the report, identifying its category, extracting available information and asking relevant follow-up questions.',
    icon: <Sparkles className="h-5 w-5 text-[#14532D]" aria-hidden="true" />,
  },
  {
    number: '03',
    title: 'Platform Identifies Departments and Community Partners',
    description:
      'Issues are matched with the appropriate department configuration and potential NGOs or community organisations.',
    icon: <GitBranch className="h-5 w-5 text-[#14532D]" aria-hidden="true" />,
  },
  {
    number: '04',
    title: 'Citizens, Departments and NGOs Coordinate Action',
    description:
      'Participants coordinate progress while keeping community activities distinct from official government responsibilities.',
    icon: <Handshake className="h-5 w-5 text-[#14532D]" aria-hidden="true" />,
  },
  {
    number: '05',
    title: 'Resolution Evidence Is Shared and Citizens Verify',
    description:
      'Evidence is recorded and citizens can confirm the reported resolution or dispute it if the issue remains unresolved.',
    icon: <CheckCircle2 className="h-5 w-5 text-[#14532D]" aria-hidden="true" />,
  },
];

const ROLE_CARDS: {
  role: UserRole;
  icon: React.ReactNode;
  highlights: string[];
  cta: string;
}[] = [
  {
    role: UserRole.CITIZEN,
    icon: <Users className="h-5 w-5 text-[#14532D]" aria-hidden="true" />,
    highlights: [
      'Report local issues through photo, voice or text.',
      'Track civic report progress.',
      'Review and verify reported resolutions.',
      'Discover neighbourhood community activities.',
    ],
    cta: 'Open Citizen Portal',
  },
  {
    role: UserRole.GOVERNMENT,
    icon: <Building2 className="h-5 w-5 text-[#14532D]" aria-hidden="true" />,
    highlights: [
      'Review incoming civic reports.',
      'Triage and assign issues.',
      'Update official resolution status.',
      'Review supporting evidence and report history.',
    ],
    cta: 'Open Department Portal',
  },
  {
    role: UserRole.NGO,
    icon: <Handshake className="h-5 w-5 text-[#14532D]" aria-hidden="true" />,
    highlights: [
      'Discover neighbourhood needs.',
      'Find suitable community initiatives.',
      'Accept and coordinate volunteer activities.',
      'Record community activity progress separately from official government resolution.',
    ],
    cta: 'Open NGO / Organisation Portal',
  },
  {
    role: UserRole.ADMIN,
    icon: <ShieldCheck className="h-5 w-5 text-[#14532D]" aria-hidden="true" />,
    highlights: [
      'Manage users and organisational partners.',
      'Configure issue categories and department mappings.',
      'Oversee platform activity.',
      'Review neighbourhood trends and analytics.',
    ],
    cta: 'Open Administrator Portal',
  },
];

const COMMUNITY_ACTIVITIES: {
  title: string;
  description: string;
  location: string;
  image: string;
  alt: string;
}[] = [
  {
    title: 'Neighbourhood Clean-up Drives',
    description:
      'Residents and youth volunteers clearing leaf litter and dry waste along residential lanes and service corners.',
    location: 'Indiranagar & Malleshwaram',
    image: IMAGES.cleanupDrive,
    alt: 'Bengaluru residents and youth volunteers sweeping a tree-lined residential street during a morning clean-up drive',
  },
  {
    title: 'Tree Planting',
    description:
      'Planting native shade saplings along parks and avenues with resident watering and tree-guard stewardship.',
    location: 'Koramangala & Jayanagar',
    image: IMAGES.treePlanting,
    alt: 'Bengaluru community volunteers planting a native sapling along a sunny park perimeter',
  },
  {
    title: 'Lake Restoration',
    description:
      'Volunteer shoreline care, invasive weed clearing, and wetland biodiversity walks around Bengaluru urban lakes.',
    location: 'Kundalahalli & Allalasandra Lakes',
    image: IMAGES.lakeRestoration,
    alt: 'Volunteers restoring wetland vegetation along the shoreline of a Bengaluru urban lake at sunrise',
  },
  {
    title: 'Waste Segregation and Awareness',
    description:
      'Door-to-door wet and dry waste sorting workshops with households, apartment associations, and street vendors.',
    location: 'Hoysala Layout & HSR Layout',
    image: IMAGES.wasteAwareness,
    alt: 'Community educators demonstrating green wet-waste and blue dry-waste segregation bins to Bengaluru residents',
  },
];

export const LandingPage: React.FC = () => {
  const { allMapReports, openRoleLogin, openSignInPage, openReportDetail } = useCivic();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [explainerOpen, setExplainerOpen] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [compareMode, setCompareMode] = useState<'side-by-side' | 'before' | 'after'>('side-by-side');

  const [pulseCategory, setPulseCategory] = useState<string>('All');
  const [pulseNeighbourhood, setPulseNeighbourhood] = useState<string>('ALL');
  const [selectedMarkerId, setSelectedMarkerId] = useState<string>('');

  const markImageFailed = (key: string) => {
    setFailedImages((prev) => ({ ...prev, [key]: true }));
  };

  const scrollToSection = (id: string) => {
    setMobileNavOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const previewCategories = [
    'All',
    'Water & Drainage',
    'Roads & Potholes',
    'Waste & Sanitation',
    'Footpaths & Safety',
    'Streetlights & Power',
  ];

  const previewReports = allMapReports.filter((r) => {
    const matchCategory = pulseCategory === 'All' || r.category === pulseCategory;
    const matchNeighbourhood =
      pulseNeighbourhood === 'ALL' || r.neighbourhood === pulseNeighbourhood;
    return matchCategory && matchNeighbourhood;
  });

  const selectedMapReport =
    previewReports.find((r) => r.id === selectedMarkerId) ?? null;

  const activePreviewReport = selectedMapReport ?? previewReports[0] ?? null;

  const handleOpenReportOnFullMap = (reportId: string) => {
    openRoleLogin(UserRole.CITIZEN, 'map');
    openReportDetail(reportId);
  };

  return (
    <div className="min-h-screen bg-white text-[#1C2420] flex flex-col">
      {/* 3. Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-[#E2E8E4] bg-white/95 backdrop-blur-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-4">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="font-display text-xl font-bold tracking-tight text-[#14532D] whitespace-nowrap shrink-0"
          >
            NAMMAOORU
          </a>

          <nav
            className="hidden lg:flex items-center gap-7 text-sm font-medium text-[#526058]"
            aria-label="Primary landing navigation"
          >
            <a
              href="#roles"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('roles');
              }}
              className="hover:text-[#14532D] transition-colors whitespace-nowrap shrink-0"
            >
              Explore Roles
            </a>
            <a
              href="#how-it-works"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('how-it-works');
              }}
              className="hover:text-[#14532D] transition-colors whitespace-nowrap shrink-0"
            >
              How It Works
            </a>
            <a
              href="#pulse-preview"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('pulse-preview');
              }}
              className="hover:text-[#14532D] transition-colors whitespace-nowrap shrink-0"
            >
              Neighbourhood Pulse
            </a>
            <button
              type="button"
              onClick={() => openRoleLogin(UserRole.CITIZEN, 'map')}
              className="hover:text-[#14532D] transition-colors whitespace-nowrap shrink-0"
            >
              Bengaluru Map
            </button>
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => openSignInPage(UserRole.CITIZEN, 'dashboard')}
              className="hidden sm:inline-flex items-center rounded-lg border border-[#E2E8E4] bg-white px-3.5 py-2 text-sm font-medium text-[#1C2420] transition-colors hover:bg-[#F6F8F7] hover:text-[#14532D] whitespace-nowrap shrink-0"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => openRoleLogin(UserRole.CITIZEN, 'dashboard')}
              className="inline-flex items-center gap-2 rounded-lg bg-[#14532D] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#166534] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14532D]"
            >
              <span>Enter Citizen Portal</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#E2E8E4] text-[#1C2420] hover:bg-[#F6F8F7] lg:hidden"
              aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileNavOpen}
            >
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer Menu */}
        {mobileNavOpen && (
          <nav
            className="border-t border-[#E2E8E4] bg-white px-6 py-4 space-y-2 lg:hidden"
            aria-label="Mobile landing navigation"
          >
            <button
              type="button"
              onClick={() => scrollToSection('roles')}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-[#29322D] hover:bg-[#EDF5F0] hover:text-[#14532D]"
            >
              Explore Roles
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('how-it-works')}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-[#29322D] hover:bg-[#EDF5F0] hover:text-[#14532D]"
            >
              How It Works
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('pulse-preview')}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-[#29322D] hover:bg-[#EDF5F0] hover:text-[#14532D]"
            >
              Neighbourhood Pulse
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileNavOpen(false);
                openRoleLogin(UserRole.CITIZEN, 'map');
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-[#29322D] hover:bg-[#EDF5F0] hover:text-[#14532D]"
            >
              Bengaluru Map
            </button>
          </nav>
        )}
      </header>

      <main id="top" className="flex-1">
        {/* 4. Hero Section */}
        <section className="border-b border-[#E2E8E4] bg-[#EDF5F0]">
          <div className="mx-auto max-w-7xl px-6 py-12 lg:py-16">
            <div className="grid grid-cols-1 items-stretch gap-10 lg:grid-cols-12">
              <div className="lg:col-span-6 flex flex-col justify-center space-y-5">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#14532D]">
                  <span>NAMMAOORU</span>
                  <span aria-hidden="true">·</span>
                  <span>NAMMA JAVABDARI</span>
                  <span aria-hidden="true">·</span>
                  <span>Bengaluru Civic Pilot</span>
                </div>

                <h1 className="font-display text-[clamp(2.25rem,4vw,3.5rem)] font-bold tracking-tight text-[#1C2420] leading-[1.1] [text-wrap:balance]">
                  Our City. Our Responsibility.
                </h1>

                <p className="text-base sm:text-lg font-medium leading-relaxed text-[#29322D] max-w-xl">
                  Making neighbourhood problems visible, connecting people to action, and building stronger communities.
                </p>

                <p className="text-sm sm:text-base leading-relaxed text-[#526058] max-w-xl">
                  Not just a complaint collector. NAMMAOORU connects citizens, government departments, NGOs and community organisations to understand local issues, coordinate action, show evidence, and learn from outcomes.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => openRoleLogin(UserRole.CITIZEN, 'dashboard')}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#14532D] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#166534] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14532D]"
                  >
                    <span>Open Citizen Portal</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToSection('how-it-works')}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#CFE3D5] bg-white px-5 py-3 text-sm font-semibold text-[#14532D] transition-colors hover:bg-[#F6F8F7] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14532D]"
                  >
                    <span>See How It Works</span>
                  </button>
                </div>

                {/* Small supporting indicators (clean inline text) */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[#CFE3D5] pt-4 text-xs font-medium text-[#526058]">
                  <span>Bengaluru Pilot</span>
                  <span aria-hidden="true">·</span>
                  <span>Multilingual Interface</span>
                  <span aria-hidden="true">·</span>
                  <span>Citizen-Centred Reporting</span>
                  <span aria-hidden="true">·</span>
                  <span>Expandable Across India</span>
                </div>
              </div>

              <div className="lg:col-span-6 flex">
                <figure className="relative w-full overflow-hidden rounded-2xl border border-[#CFE3D5] bg-[#DCEEE4] min-h-[290px] lg:min-h-[440px]">
                  {!failedImages.hero ? (
                    <img
                      src={IMAGES.hero}
                      alt="Residents and community volunteers tending roadside planters along a leafy Bengaluru neighbourhood street"
                      className="h-full w-full object-cover"
                      loading="eager"
                      referrerPolicy="no-referrer"
                      onError={() => markImageFailed('hero')}
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center">
                      <MapPin className="h-10 w-10 text-[#14532D]" aria-hidden="true" />
                      <p className="mt-3 font-display text-base font-semibold text-[#14532D]">
                        Bengaluru Neighbourhood Pilot
                      </p>
                      <p className="mt-1 max-w-xs text-xs text-[#29322D]">
                        Residents, municipal crews, and local volunteers working together on street care.
                      </p>
                    </div>
                  )}
                  <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-5 py-4 text-white">
                    <p className="text-sm font-semibold">
                      Bengaluru Neighbourhood Pilot – Community &amp; Civic Action
                    </p>
                  </figcaption>
                </figure>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Civic Problems Section */}
        <section id="problems" className="mx-auto max-w-7xl px-6 py-14 lg:py-16">
          <div className="max-w-2xl space-y-2 mb-8">
            <p className="text-xs font-semibold text-[#14532D]">Neighbourhood Issue Coverage</p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#1C2420] [text-wrap:balance]">
              Every Neighbourhood Has Problems. Every Citizen Can Help.
            </h2>
            <p className="text-sm sm:text-base text-[#526058]">
              From monsoon drain blockages to broken footpaths, NAMMAOORU gives everyday street problems clear visibility and structured follow-through.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PROBLEM_CARDS.map((card) => (
              <div
                key={card.id}
                className="overflow-hidden rounded-xl border border-[#E2E8E4] bg-white flex flex-col transition-colors hover:border-[#14532D]/50"
              >
                <div className="aspect-[16/9] w-full overflow-hidden border-b border-[#E2E8E4]">
                  <ProblemIllustration type={card.id} />
                </div>
                <div className="p-5 space-y-1.5 flex-1">
                  <h3 className="font-display text-base font-semibold text-[#1C2420]">
                    {card.title}
                  </h3>
                  <p className="text-sm text-[#526058] leading-relaxed">{card.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 6. How NAMMAOORU Works */}
        <section
          id="how-it-works"
          className="border-y border-[#E2E8E4] bg-[#F6F8F7] py-14 lg:py-16"
        >
          <div className="mx-auto max-w-7xl px-6 space-y-10">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div className="max-w-3xl space-y-2">
                <p className="text-xs font-semibold text-[#14532D]">Five-Step Civic Workflow</p>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#1C2420]">
                  How NAMMAOORU Works
                </h2>
                <p className="text-sm sm:text-base text-[#526058] leading-relaxed">
                  From a resident noticing a street problem to verified resolution and shared learning — five connected steps that keep communities and departments aligned.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openRoleLogin(UserRole.CITIZEN, 'report')}
                className="inline-flex items-center gap-2 self-start lg:self-auto rounded-lg border border-[#CFE3D5] bg-white px-4 py-2.5 text-sm font-semibold text-[#14532D] transition-colors hover:bg-[#EDF5F0] whitespace-nowrap"
              >
                <span>Report an Issue</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Connected 5-Step Progression Timeline */}
            <div className="rounded-2xl border border-[#E2E8E4] bg-white p-6 lg:p-8">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 lg:gap-4">
                {WORKFLOW_STEPS.map((step, index) => (
                  <div key={step.number} className="relative flex flex-col">
                    {/* Step Node + Connector Line */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#CFE3D5] bg-[#EDF5F0]">
                        {step.icon}
                      </div>
                      <span className="font-mono text-xs font-semibold text-[#14532D] tabular-nums whitespace-nowrap">
                        Step {step.number}
                      </span>
                      {index < WORKFLOW_STEPS.length - 1 && (
                        <div
                          className="hidden lg:flex flex-1 items-center"
                          aria-hidden="true"
                        >
                          <div className="h-px w-full bg-[#CFE3D5]" />
                          <ArrowRight className="h-3.5 w-3.5 text-[#14532D] shrink-0 -ml-1" />
                        </div>
                      )}
                    </div>

                    <h3 className="font-display text-base font-semibold text-[#1C2420] leading-snug">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm text-[#526058] leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Two Supporting Visual Panels + Dedicated Explainer Video Panel */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch">
              {/* Explainer Video Panel (6 cols) */}
              <div className="lg:col-span-6 overflow-hidden rounded-xl border border-[#E2E8E4] bg-white flex flex-col">
                <div className="relative aspect-[16/9] w-full bg-[#0B2E19] overflow-hidden">
                  {!failedImages.explainerPoster ? (
                    <img
                      src={IMAGES.explainerPoster}
                      alt="Bengaluru residents, municipal officer, and volunteers reviewing a neighbourhood map together"
                      className="h-full w-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={() => markImageFailed('explainerPoster')}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#14532D] p-6 text-center text-white text-sm">
                      NAMMAOORU Bengaluru Civic Walkthrough Poster
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/35 flex flex-col items-center justify-center p-4">
                    <button
                      type="button"
                      onClick={() => setExplainerOpen(true)}
                      aria-label="Play NAMMAOORU platform walkthrough preview"
                      className="group flex h-16 w-16 items-center justify-center rounded-full border-2 border-white bg-[#14532D]/95 text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                    >
                      <Play className="h-7 w-7 translate-x-0.5" aria-hidden="true" />
                    </button>
                    <span className="mt-3 rounded-lg bg-black/65 px-3 py-1 text-xs font-medium text-white">
                      Watch 2-Minute Workflow Walkthrough (Preview)
                    </span>
                  </div>
                </div>
                <div className="p-5 space-y-1.5 flex-1 flex flex-col justify-center">
                  <h3 className="font-display text-base font-semibold text-[#1C2420]">
                    See How Reporting Connects Neighbourhoods and Departments
                  </h3>
                  <p className="text-sm text-[#526058]">
                    Walkthrough placeholder ready for a recorded Bengaluru pilot video, illustrating how reports move from street capture to citizen verification.
                  </p>
                </div>
              </div>

              {/* Two Supporting Visual Panels stacked (6 cols) */}
              <div className="lg:col-span-6 flex flex-col gap-5 justify-between">
                <div className="flex-1 overflow-hidden rounded-xl border border-[#E2E8E4] bg-white flex flex-col sm:flex-row">
                  <div className="sm:w-52 shrink-0 bg-[#EDF5F0]">
                    {!failedImages.howCommunity ? (
                      <img
                        src={IMAGES.howCommunity}
                        alt="Bengaluru volunteers and municipal staff coordinating beside a Kannada ward notice board"
                        className="h-44 sm:h-full w-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={() => markImageFailed('howCommunity')}
                      />
                    ) : (
                      <div className="flex h-44 sm:h-full w-full items-center justify-center p-4 text-center text-xs text-[#14532D]">
                        Community &amp; NGO coordination visual
                      </div>
                    )}
                  </div>
                  <div className="p-5 flex flex-col justify-center space-y-1.5">
                    <p className="text-xs font-semibold text-[#14532D]">Supporting Panel</p>
                    <h3 className="font-display text-base font-semibold text-[#1C2420]">
                      Community &amp; NGO Action
                    </h3>
                    <p className="text-sm text-[#526058] leading-relaxed">
                      Local volunteer groups coordinate clean-ups and awareness alongside ward teams, tracked independently from official municipal repair tickets.
                    </p>
                  </div>
                </div>

                <div className="flex-1 overflow-hidden rounded-xl border border-[#E2E8E4] bg-white flex flex-col sm:flex-row">
                  <div className="sm:w-52 shrink-0 bg-[#EDF5F0]">
                    {!failedImages.howVerification ? (
                      <img
                        src={IMAGES.howVerification}
                        alt="Bengaluru resident photographing a newly repaired street kerb and drain grate for citizen verification"
                        className="h-44 sm:h-full w-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={() => markImageFailed('howVerification')}
                      />
                    ) : (
                      <div className="flex h-44 sm:h-full w-full items-center justify-center p-4 text-center text-xs text-[#14532D]">
                        Citizen verification evidence visual
                      </div>
                    )}
                  </div>
                  <div className="p-5 flex flex-col justify-center space-y-1.5">
                    <p className="text-xs font-semibold text-[#14532D]">Supporting Panel</p>
                    <h3 className="font-display text-base font-semibold text-[#1C2420]">
                      Evidence &amp; Citizen Verification
                    </h3>
                    <p className="text-sm text-[#526058] leading-relaxed">
                      Residents inspect repaired sites, share street-level evidence, and confirm whether the reported fix truly resolved the problem.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Explore All Four Civic Roles */}
        <section id="roles" className="mx-auto max-w-7xl px-6 py-14 lg:py-16">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-semibold text-[#14532D]">Role-Based Portal Access</p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#1C2420]">
                One Platform. Four Civic Perspectives.
              </h2>
              <p className="text-sm sm:text-base text-[#526058]">
                Explore any of the four civic workspaces directly across Bengaluru neighbourhoods.
              </p>
            </div>
            <p className="text-xs font-medium text-[#14532D] whitespace-nowrap">
              All four portals unlocked for preview
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {ROLE_CARDS.map((card) => {
              const meta = ROLE_METADATA[card.role];
              return (
                <div
                  key={card.role}
                  className="flex flex-col justify-between rounded-xl border border-[#E2E8E4] bg-white p-6 transition-all hover:border-[#14532D]/60 hover:shadow-sm"
                >
                  <div className="space-y-4">
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#CFE3D5] bg-[#EDF5F0]">
                        {card.icon}
                      </div>
                      <div>
                        <h3 className="font-display text-lg font-semibold text-[#1C2420]">
                          {meta.label}
                        </h3>
                        <p className="text-xs text-[#526058]">
                          Direct unlocked portal access · Optional sign-in available
                        </p>
                      </div>
                    </div>

                    <ul className="space-y-2 border-t border-[#E2E8E4] pt-4 text-sm text-[#29322D]">
                      {card.highlights.map((item) => (
                        <li key={item} className="flex items-start gap-2.5">
                          <CheckCircle2
                            className="mt-0.5 h-4 w-4 shrink-0 text-[#166534]"
                            aria-hidden="true"
                          />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6 pt-2">
                    <button
                      type="button"
                      onClick={() => openRoleLogin(card.role, 'dashboard')}
                      className="inline-flex w-full items-center justify-between rounded-lg border border-[#E2E8E4] bg-[#F6F8F7] px-4 py-2.5 text-sm font-semibold text-[#14532D] transition-colors hover:bg-[#14532D] hover:text-white hover:border-[#14532D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14532D]"
                    >
                      <span>{card.cta}</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 8. Neighbourhood Pulse & Live Bengaluru Map Section */}
        <section
          id="pulse-preview"
          className="border-y border-[#E2E8E4] bg-[#F6F8F7] py-14 lg:py-16"
        >
          <div className="mx-auto max-w-7xl px-6">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
              <div className="max-w-2xl space-y-2">
                <p className="text-xs font-semibold text-[#14532D]">
                  Interactive Bengaluru Google Map · Pilot Demonstration Data
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#1C2420]">
                  Neighbourhood Pulse &amp; Bengaluru Map
                </h2>
                <p className="text-sm sm:text-base text-[#526058]">
                  Explore civic issues pinned across Bengaluru neighbourhoods, filter by category or ward, and inspect resolution status directly on the map.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => openRoleLogin(UserRole.CITIZEN, 'map')}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#14532D] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#166534] whitespace-nowrap"
                >
                  <span>Open Full Map</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => openRoleLogin(UserRole.CITIZEN, 'pulse')}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8E4] bg-white px-4 py-2.5 text-sm font-semibold text-[#1C2420] transition-colors hover:bg-[#EDF5F0] hover:text-[#14532D] whitespace-nowrap"
                >
                  <span>Explore Neighbourhood Pulse</span>
                </button>
              </div>
            </div>

            {/* Category & Neighbourhood Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div
                className="flex flex-wrap items-center gap-2"
                role="group"
                aria-label="Filter Bengaluru map by issue category"
              >
                {previewCategories.map((cat) => {
                  const active = pulseCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setPulseCategory(cat);
                        setSelectedMarkerId('');
                      }}
                      className={`rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                        active
                          ? 'border-[#14532D] bg-[#14532D] text-white'
                          : 'border-[#E2E8E4] bg-white text-[#29322D] hover:border-[#14532D]/50'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <label
                  htmlFor="landing-map-neighbourhood"
                  className="text-xs font-medium text-[#526058] whitespace-nowrap"
                >
                  Neighbourhood:
                </label>
                <select
                  id="landing-map-neighbourhood"
                  value={pulseNeighbourhood}
                  onChange={(e) => {
                    setPulseNeighbourhood(e.target.value);
                    setSelectedMarkerId('');
                  }}
                  className="rounded-lg border border-[#E2E8E4] bg-white px-3 py-2 text-xs font-medium text-[#1C2420] focus:border-[#14532D] focus:outline-none"
                >
                  <option value="ALL">All Bengaluru Wards</option>
                  {BENGALURU_NEIGHBOURHOODS.map((ward) => (
                    <option key={ward} value={ward}>
                      {ward}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch">
              {/* Interactive Bengaluru Google Map */}
              <div className="lg:col-span-7 rounded-xl border border-[#E2E8E4] bg-white overflow-hidden flex flex-col">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8E4] bg-white px-4 py-3 text-xs">
                  <span className="font-semibold text-[#14532D]">
                    Interactive Bengaluru Map · Pilot Demonstration Markers
                  </span>
                  <span className="text-[#526058] tabular-nums">
                    Showing {previewReports.length} {previewReports.length === 1 ? 'marker' : 'markers'}
                  </span>
                </div>

                <BengaluruGoogleMap
                  reports={previewReports}
                  selectedReport={selectedMapReport}
                  activeNeighbourhoodFilter={pulseNeighbourhood}
                  onSelectReport={(reportId) => setSelectedMarkerId(reportId)}
                  onOpenReportModal={handleOpenReportOnFullMap}
                  embedded
                />

                <div className="border-t border-[#E2E8E4] bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[#526058]">
                  <div className="flex flex-wrap items-center gap-3.5">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#166534]" aria-hidden="true" />
                      Submitted
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#B45309]" aria-hidden="true" />
                      In Progress
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#C2410C]" aria-hidden="true" />
                      Awaiting Verification
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#14532D]" aria-hidden="true" />
                      Verified
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#B91C1C]" aria-hidden="true" />
                      Disputed
                    </span>
                  </div>
                  <span>Click any pin to inspect</span>
                </div>
              </div>

              {/* Selected Report Summary + Civic Reports List */}
              <div className="lg:col-span-5 flex flex-col justify-between gap-4">
                {activePreviewReport ? (
                  <div className="rounded-xl border border-[#CFE3D5] bg-[#EDF5F0] p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-[#14532D] tabular-nums">
                        {activePreviewReport.id} ·{' '}
                        {activePreviewReport.isSampleDemo ? 'Sample Report' : 'Citizen Report'}
                      </span>
                      <StatusIndicator status={activePreviewReport.status} compact />
                    </div>
                    <h3 className="font-display text-base font-semibold text-[#1C2420]">
                      {activePreviewReport.title}
                    </h3>
                    <p className="text-sm text-[#29322D] leading-relaxed">
                      {activePreviewReport.description}
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#CFE3D5] pt-3 text-xs text-[#526058]">
                      <span>
                        {activePreviewReport.category} · {activePreviewReport.neighbourhood}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenReportOnFullMap(activePreviewReport.id)}
                        className="font-semibold text-[#14532D] hover:underline whitespace-nowrap"
                      >
                        Open Full Report
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#E2E8E4] bg-white p-5 space-y-3">
                    <h3 className="font-display text-base font-semibold text-[#1C2420]">
                      No markers match the selected filters
                    </h3>
                    <p className="text-sm text-[#526058]">
                      Try selecting another issue category or switching back to all Bengaluru wards.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setPulseCategory('All');
                        setPulseNeighbourhood('ALL');
                        setSelectedMarkerId('');
                      }}
                      className="rounded-lg border border-[#CFE3D5] bg-[#EDF5F0] px-3.5 py-2 text-xs font-semibold text-[#14532D] hover:bg-[#DCEEE4]"
                    >
                      Reset Map Filters
                    </button>
                  </div>
                )}

                <div className="rounded-xl border border-[#E2E8E4] bg-white p-5 space-y-3 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-sm font-semibold text-[#1C2420]">
                      Mapped Civic Reports
                    </h3>
                    <span className="text-xs text-[#526058]">
                      Click to focus on map
                    </span>
                  </div>

                  {previewReports.length > 0 ? (
                    <div className="divide-y divide-[#E2E8E4]">
                      {previewReports.slice(0, 5).map((rep) => (
                        <button
                          key={rep.id}
                          type="button"
                          onClick={() => setSelectedMarkerId(rep.id)}
                          className={`flex w-full items-center justify-between gap-3 py-2.5 text-left transition-colors hover:text-[#14532D] ${
                            activePreviewReport?.id === rep.id
                              ? 'text-[#14532D] font-semibold'
                              : 'text-[#29322D]'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-sm truncate">{rep.title}</p>
                            <p className="text-xs text-[#526058]">
                              {rep.category} · {rep.neighbourhood}
                            </p>
                          </div>
                          <StatusIndicator status={rep.status} compact />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="py-4 text-xs text-[#526058]">
                      No civic reports found for this filter combination.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 9. Community Action Section */}
        <section id="community-action" className="mx-auto max-w-7xl px-6 py-14 lg:py-16">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-8">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-semibold text-[#14532D]">
                Independent Volunteer &amp; NGO Stewardship
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#1C2420] [text-wrap:balance]">
                Stronger Communities Start With Collective Action.
              </h2>
              <p className="text-sm sm:text-base text-[#526058] leading-relaxed">
                Not every neighbourhood improvement requires a government repair ticket. Community organisations and volunteers can also coordinate meaningful local initiatives.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openRoleLogin(UserRole.NGO, 'community')}
              className="inline-flex items-center gap-2 self-start lg:self-auto rounded-lg border border-[#E2E8E4] bg-white px-4 py-2.5 text-sm font-semibold text-[#14532D] hover:bg-[#EDF5F0] whitespace-nowrap"
            >
              <span>Organisation Login</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {COMMUNITY_ACTIVITIES.map((act) => (
              <div
                key={act.title}
                className="overflow-hidden rounded-xl border border-[#E2E8E4] bg-white flex flex-col"
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-[#EDF5F0]">
                  {!failedImages[act.title] ? (
                    <img
                      src={act.image}
                      alt={act.alt}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={() => markImageFailed(act.title)}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center p-4 text-center text-xs text-[#14532D]">
                      {act.title}
                    </div>
                  )}
                </div>
                <div className="p-5 space-y-2 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-[#14532D]">{act.location}</p>
                    <h3 className="font-display text-base font-semibold text-[#1C2420]">
                      {act.title}
                    </h3>
                    <p className="text-sm text-[#526058] leading-relaxed">{act.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-[#CFE3D5] bg-[#EDF5F0] px-5 py-3.5 text-sm text-[#29322D]">
            <strong className="font-semibold text-[#14532D]">Clear Accountability Boundary: </strong>
            NGO activities and official government issue resolution are tracked separately. Completing a volunteer clean-up drive never automatically marks a civic complaint as resolved.
          </div>
        </section>

        {/* 10. Accountability & Verification Section */}
        <section
          id="accountability"
          className="border-y border-[#E2E8E4] bg-[#F6F8F7] py-14 lg:py-16"
        >
          <div className="mx-auto max-w-7xl px-6 space-y-8">
            <div className="max-w-3xl space-y-2">
              <p className="text-xs font-semibold text-[#14532D]">Closed-Loop Civic Trust</p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#1C2420] [text-wrap:balance]">
                A Report Isn&apos;t Complete Until the Outcome Is Verified.
              </h2>
              <p className="text-sm sm:text-base text-[#526058] leading-relaxed">
                From initial submission and department acknowledgement to on-site before-and-after evidence, citizens hold the final word on whether a problem is truly resolved or needs reopening.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
              {/* Before-and-After Comparison Panel (7 cols) */}
              <div className="lg:col-span-7 rounded-2xl border border-[#E2E8E4] bg-white p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-base font-semibold text-[#1C2420]">
                      Before &amp; After Street Evidence (Sample Demonstration)
                    </h3>
                    <p className="text-xs text-[#526058]">
                      Indiranagar 12th Main corner drain clearance &amp; footpath repair
                    </p>
                  </div>
                  <div
                    className="flex items-center gap-1 rounded-lg bg-[#F6F8F7] p-1 border border-[#E2E8E4]"
                    role="group"
                    aria-label="Before and after view mode"
                  >
                    {(
                      [
                        { key: 'side-by-side', label: 'Side by Side' },
                        { key: 'before', label: 'Before' },
                        { key: 'after', label: 'After' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setCompareMode(opt.key)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                          compareMode === opt.key
                            ? 'bg-white text-[#14532D] shadow-xs'
                            : 'text-[#526058] hover:text-[#1C2420]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div
                  className={`grid gap-4 ${
                    compareMode === 'side-by-side' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
                  }`}
                >
                  {(compareMode === 'side-by-side' || compareMode === 'before') && (
                    <figure className="overflow-hidden rounded-xl border border-[#E2E8E4] bg-[#F6F8F7]">
                      <div className="aspect-[4/3] w-full overflow-hidden">
                        {!failedImages.beforeDrain ? (
                          <img
                            src={IMAGES.beforeDrain}
                            alt="Clogged stormwater drain grate with dry leaves and cracked footpath kerb before repair"
                            className="h-full w-full object-cover"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={() => markImageFailed('beforeDrain')}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center p-4 text-xs text-[#526058]">
                            Before repair sample view
                          </div>
                        )}
                      </div>
                      <figcaption className="border-t border-[#E2E8E4] bg-white px-3.5 py-2.5 text-xs">
                        <span className="font-semibold text-[#991B1B]">Before · Reported State: </span>
                        <span className="text-[#526058]">
                          Silt &amp; leaf blockage causing water stagnation at street corner.
                        </span>
                      </figcaption>
                    </figure>
                  )}

                  {(compareMode === 'side-by-side' || compareMode === 'after') && (
                    <figure className="overflow-hidden rounded-xl border border-[#CFE3D5] bg-[#EDF5F0]">
                      <div className="aspect-[4/3] w-full overflow-hidden">
                        {!failedImages.afterDrain ? (
                          <img
                            src={IMAGES.afterDrain}
                            alt="Cleared corner stormwater drain grate and neat repaired concrete footpath slabs"
                            className="h-full w-full object-cover"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={() => markImageFailed('afterDrain')}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center p-4 text-xs text-[#14532D]">
                            After repair verified view
                          </div>
                        )}
                      </div>
                      <figcaption className="border-t border-[#CFE3D5] bg-white px-3.5 py-2.5 text-xs">
                        <span className="font-semibold text-[#14532D]">After · Citizen Verified: </span>
                        <span className="text-[#526058]">
                          Grate desilted, kerb stones reset, and flow confirmed on site.
                        </span>
                      </figcaption>
                    </figure>
                  )}
                </div>
              </div>

              {/* Distinct Lifecycle States (5 cols) */}
              <div className="lg:col-span-5 rounded-2xl border border-[#E2E8E4] bg-white p-6 space-y-4">
                <h3 className="font-display text-base font-semibold text-[#1C2420]">
                  Transparent Verification States
                </h3>
                <p className="text-sm text-[#526058]">
                  Every civic report moves through explicit, auditable status milestones—never closed silently or through unrelated NGO drives:
                </p>

                <ul className="divide-y divide-[#E2E8E4] text-sm">
                  <li className="py-3 first:pt-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <StatusIndicator status={ReportStatus.IN_PROGRESS} compact />
                      <span className="text-xs text-[#526058]">Active / In Progress</span>
                    </div>
                    <p className="text-xs text-[#526058]">
                      Department acknowledged the report and assigned a field team on site.
                    </p>
                  </li>
                  <li className="py-3 space-y-1">
                    <StatusIndicator status={ReportStatus.RESOLUTION_REPORTED} compact />
                    <p className="text-xs text-[#526058]">
                      Repair crew uploaded completion notes and before/after evidence.
                    </p>
                  </li>
                  <li className="py-3 space-y-1">
                    <StatusIndicator status={ReportStatus.AWAITING_VERIFICATION} compact />
                    <p className="text-xs text-[#526058]">
                      Residents are invited to inspect the site and confirm the fix.
                    </p>
                  </li>
                  <li className="py-3 space-y-1">
                    <StatusIndicator status={ReportStatus.CITIZEN_VERIFIED} compact />
                    <p className="text-xs text-[#526058]">
                      Citizen confirmed the resolution holds up; report closes transparently.
                    </p>
                  </li>
                  <li className="py-3 last:pb-0 space-y-1">
                    <StatusIndicator status={ReportStatus.DISPUTED_REOPENED} compact />
                    <p className="text-xs text-[#526058]">
                      If the issue persists, residents dispute and reopen it for further action.
                    </p>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 11. Final Call-to-Action Section */}
        <section className="bg-[#14532D] text-white">
          <div className="mx-auto max-w-7xl px-6 py-14 lg:py-16">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              <div className="max-w-2xl space-y-3">
                <p className="text-xs font-semibold text-[#BBF7D0]">
                  NAMMAOORU · NAMMA JAVABDARI
                </p>
                <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight [text-wrap:balance]">
                  Your Neighbourhood. Your Voice. Your Responsibility.
                </h2>
                <p className="text-sm sm:text-base text-white/90 leading-relaxed">
                  Be part of a connected community where people understand local problems, coordinate meaningful action and build more accountable neighbourhoods.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => openRoleLogin(UserRole.CITIZEN, 'dashboard')}
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-[#14532D] transition-colors hover:bg-[#EDF5F0] whitespace-nowrap"
                >
                  <span>Citizen Login</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('roles')}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/40 bg-transparent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 whitespace-nowrap"
                >
                  <span>Choose Your Role Login</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 12. Footer */}
      <footer className="border-t border-[#E2E8E4] bg-white px-6 py-10">
        <div className="mx-auto max-w-7xl space-y-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
            <div className="max-w-md space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="font-display text-lg font-bold tracking-tight text-[#14532D]">
                  NAMMAOORU
                </span>
                <span className="text-xs font-medium text-[#526058]">· NAMMA JAVABDARI</span>
              </div>
              <p className="text-sm font-medium text-[#1C2420]">Our City. Our Responsibility.</p>
              <p className="text-xs text-[#526058] leading-relaxed">
                Making neighbourhood problems visible, connecting citizens, municipal departments, and NGOs to coordinate action, verify evidence, and learn from outcomes.
              </p>
            </div>

            <nav
              className="flex flex-wrap items-center gap-x-7 gap-y-3 text-sm font-medium text-[#526058]"
              aria-label="Footer navigation"
            >
              <a
                href="#roles"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection('roles');
                }}
                className="hover:text-[#14532D] transition-colors whitespace-nowrap"
              >
                Explore Roles
              </a>
              <a
                href="#how-it-works"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection('how-it-works');
                }}
                className="hover:text-[#14532D] transition-colors whitespace-nowrap"
              >
                How It Works
              </a>
              <a
                href="#pulse-preview"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection('pulse-preview');
                }}
                className="hover:text-[#14532D] transition-colors whitespace-nowrap"
              >
                Neighbourhood Pulse
              </a>
              <button
                type="button"
                onClick={() => openRoleLogin(UserRole.CITIZEN, 'map')}
                className="hover:text-[#14532D] transition-colors whitespace-nowrap"
              >
                Bengaluru Map
              </button>
            </nav>
          </div>

          <div className="border-t border-[#E2E8E4] pt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-[#526058]">
            <span>
              NAMMAOORU – Bengaluru Civic Intelligence &amp; Community Action Platform.
            </span>
            <span>
              Role-verified authentication and Firestore security rules protect all portal workspaces.
            </span>
          </div>
        </div>
      </footer>

      {/* Explainer Video Modal */}
      <ExplainerVideoModal
        open={explainerOpen}
        onClose={() => setExplainerOpen(false)}
        posterSrc={IMAGES.explainerPoster}
        onTryReporting={() => openRoleLogin(UserRole.CITIZEN, 'report')}
      />
    </div>
  );
};
