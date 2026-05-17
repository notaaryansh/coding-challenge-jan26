import { Suspense } from "react";
import { NavTabs } from "@/components/nav-tabs";
import { InitOverlay } from "@/components/init-overlay";
import { StartButton } from "@/components/start-button";
import { getInitStatus } from "@/lib/init-status";
import { getDashboardData } from "./loader";
import { TestMatchPanel } from "./test-match-panel";

export const dynamic = "force-dynamic";

// =============================================================================
// ⚠️  DISCLAIMER
// =============================================================================
// This dashboard is SCAFFOLDING ONLY. Feel free to:
// - Completely redesign the layout and components
// - Remove any sections that don't fit your vision
// - Add entirely new metrics and visualizations
// - Change the styling, colors, and theme
//
// BE CREATIVE! This is just a starting point to get you going.
// =============================================================================

// =============================================================================
// TYPES
// =============================================================================

// These are example types - define your own based on your solution!
export interface MatchMetrics {
  totalApples: number;
  totalOranges: number;
  totalMatches: number;
  successRate: number;
}

// =============================================================================
// SERVER DATA LOADING
// =============================================================================

async function DashboardContent() {
  const data = await getDashboardData();

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {/*
        ⚠️ EXAMPLE METRICS - Replace with your own!
        Think about what metrics actually demonstrate your system is working well.
        These are just placeholders to show the pattern.
      */}
      <MetricCard
        title="Total Apples"
        value={data.metrics.totalApples}
        icon="🍎"
        description="Apples in the system"
      />
      <MetricCard
        title="Total Oranges"
        value={data.metrics.totalOranges}
        icon="🍊"
        description="Oranges in the system"
      />
      <MetricCard
        title="Total Matches"
        value={data.metrics.totalMatches}
        icon="🍐"
        description="Successful pear-ings"
      />
      <MetricCard
        title="Success Rate"
        value={`${data.metrics.successRate}%`}
        icon="📊"
        description="Match success rate"
      />
    </div>
  );
}

// =============================================================================
// COMPONENTS
// =============================================================================

// ⚠️ These components are examples - build your own or modify as needed!

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: string;
  description: string;
}

function MetricCard({ title, value, icon, description }: MetricCardProps) {
  return (
    <div className="metric-card">
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        <span className="text-xs uppercase tracking-wide text-muted">
          {title}
        </span>
      </div>
      <div className="mt-4">
        <p className="text-3xl font-bold">{value}</p>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
    </div>
  );
}

function MetricCardSkeleton() {
  return (
    <div className="metric-card animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-8 rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
      <div className="mt-4">
        <div className="h-8 w-24 rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="mt-2 h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <MetricCardSkeleton key={i} />
      ))}
    </div>
  );
}

// =============================================================================
// PAGE
// =============================================================================

export default async function DashboardPage() {
  const initStatus = await getInitStatus();
  return (
    <div className="min-h-screen">
      <InitOverlay status={initStatus} />
      {/* Header - Feel free to redesign! */}
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                🍎 Matchmaking Dashboard 🍊
              </h1>
              <p className="mt-1 text-sm text-muted">
                Creating perfect pears, one match at a time
              </p>
            </div>
            <div className="flex items-center gap-4">
              <StartButton />
              <NavTabs />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Metrics Section */}
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold">Overview Metrics</h2>
          <Suspense fallback={<DashboardSkeleton />}>
            <DashboardContent />
          </Suspense>
        </section>

        {/* Visualization Section */}
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold">
            Matchmaking Visualization
          </h2>
          <div className="card min-h-[400px]">
            <TestMatchPanel />
          </div>
        </section>

      </main>
    </div>
  );
}
