import { ScanForm } from '@/components/scan-form';

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative bg-white">
        <div className="mx-auto max-w-5xl px-6 py-24 sm:py-32 lg:py-40">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              Is Your Business Visible
              <br />
              <span className="text-indigo-600">to AI?</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600">
              ChatGPT, Perplexity, and Gemini are replacing Google for millions
              of searchers. Find out if they recommend your business — or your
              competitors.
            </p>
            <div className="mt-10 flex justify-center">
              <ScanForm />
            </div>
          </div>
        </div>
      </section>

      {/* What We Check */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-3xl font-bold text-gray-900">
            What We Check
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-gray-600">
            We query real AI platforms with searches your customers actually make
            and see if you show up.
          </p>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <CheckCard
              title="ChatGPT"
              description="The most popular AI assistant. We check if it recommends your business."
            />
            <CheckCard
              title="Perplexity"
              description="AI-powered search with source citations. We verify you're in the results."
            />
            <CheckCard
              title="Gemini"
              description="Google's AI. We check visibility across Google's AI-powered responses."
            />
            <CheckCard
              title="Source Analysis"
              description="We identify which websites AI trusts in your industry and location."
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-3xl font-bold text-gray-900">
            How It Works
          </h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            <StepCard
              step={1}
              title="Enter Your URL"
              description="We crawl your site to understand your business, category, and location."
            />
            <StepCard
              step={2}
              title="We Query AI Platforms"
              description="Real queries your customers would ask, sent to ChatGPT, Perplexity, and more."
            />
            <StepCard
              step={3}
              title="Get Your Score"
              description="See exactly where you stand: which platforms cite you, your ranking, and what to fix."
            />
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            Ready to Get Optimized?
          </h2>
          <p className="mt-4 text-gray-600">
            After your free scan, upgrade to continuous monitoring and AI
            optimization.
          </p>
          <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <p className="text-sm font-medium uppercase tracking-wide text-indigo-600">
              Starter Plan
            </p>
            <div className="mt-4 flex items-baseline justify-center gap-2">
              <span className="text-5xl font-bold text-gray-900">$299</span>
              <span className="text-gray-500">setup</span>
            </div>
            <p className="mt-2 text-gray-500">
              + $49/month for ongoing monitoring
            </p>
            <ul className="mt-8 space-y-3 text-left text-sm text-gray-600">
              <PricingItem text="AI-optimized llms.txt file generation" />
              <PricingItem text="JSON-LD schema markup for your site" />
              <PricingItem text="Monthly citation monitoring across 4 AI platforms" />
              <PricingItem text="Competitor tracking and alerts" />
              <PricingItem text="NAP consistency audit across 6 directories" />
              <PricingItem text="Monthly performance report via email" />
            </ul>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white py-8">
        <div className="mx-auto max-w-5xl px-6 text-center text-sm text-gray-500">
          GEO Platform — AI Visibility for Local Businesses
        </div>
      </footer>
    </div>
  );
}

function CheckCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg bg-white p-6 shadow-sm border border-gray-100">
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm text-gray-600">{description}</p>
    </div>
  );
}

function StepCard({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 font-bold text-lg">
        {step}
      </div>
      <h3 className="mt-4 font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm text-gray-600">{description}</p>
    </div>
  );
}

function PricingItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-3">
      <svg
        className="h-5 w-5 flex-shrink-0 text-indigo-500 mt-0.5"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
      {text}
    </li>
  );
}
