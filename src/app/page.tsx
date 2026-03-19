import { Hero } from '@/components/hero';

export default function Home() {
  return (
    <div className="flex flex-col">
      <Hero />

      {/* What we check */}
      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="text-xs font-medium tracking-wider uppercase text-gray-400 mb-10 sm:mb-12 font-[family-name:var(--font-mono)]">
            What we check
          </h2>
          <div className="grid sm:grid-cols-2 gap-x-12 gap-y-8">
            <CheckItem
              title="ChatGPT"
              description="The most popular AI assistant. We check if it recommends your business."
            />
            <CheckItem
              title="Perplexity"
              description="AI-powered search with source citations. We verify you appear in results."
            />
            <CheckItem
              title="Google Gemini"
              description="Google's AI. We check visibility across AI-powered responses."
            />
            <CheckItem
              title="Source analysis"
              description="We identify which websites AI trusts in your industry and location."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-[#FAFAF8] py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="text-xs font-medium tracking-wider uppercase text-gray-400 mb-10 sm:mb-12 font-[family-name:var(--font-mono)]">
            How it works
          </h2>
          <div className="space-y-10">
            <Step
              number="01"
              title="Enter your URL"
              description="We crawl your site to understand your business, category, and location."
            />
            <Step
              number="02"
              title="We query AI platforms"
              description="Real queries your customers would ask, sent to ChatGPT, Perplexity, and Gemini."
            />
            <Step
              number="03"
              title="Get your visibility score"
              description="See which platforms mention you, your ranking, and exactly what to fix."
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="text-xs font-medium tracking-wider uppercase text-gray-400 mb-10 sm:mb-12 font-[family-name:var(--font-mono)]">
            Pricing
          </h2>
          <div className="rounded-xl border border-gray-200 p-6 sm:p-8 max-w-lg">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-bold text-gray-950 tracking-tight tabular-nums">$299</span>
              <span className="text-gray-400 text-sm">one-time setup</span>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              + $49/month for ongoing monitoring &amp; optimization
            </p>
            <ul className="space-y-2.5 text-sm text-gray-600">
              <PricingItem text="AI-optimized llms.txt generation" />
              <PricingItem text="JSON-LD schema markup" />
              <PricingItem text="Monthly citation monitoring" />
              <PricingItem text="Competitor tracking & alerts" />
              <PricingItem text="NAP consistency audit" />
              <PricingItem text="Monthly performance reports" />
            </ul>
          </div>
          <p className="text-xs text-gray-400 mt-4">
            Free scan included — no signup required to try.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-[#FAFAF8] py-8 sm:py-10">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 text-xs text-gray-400">
          GEO Platform — AI Visibility for Local Businesses
        </div>
      </footer>
    </div>
  );
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex gap-5">
      <span className="text-xs text-gray-300 tabular-nums pt-0.5 font-[family-name:var(--font-mono)]">
        {number}
      </span>
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">{title}</h3>
        <p className="text-base text-gray-500 leading-relaxed max-w-[50ch]">{description}</p>
      </div>
    </div>
  );
}

function CheckItem({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="text-lg font-bold text-gray-900 mb-1">{title}</h3>
      <p className="text-base text-gray-500 leading-relaxed">{description}</p>
    </div>
  );
}

function PricingItem({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-2.5">
      <span className="w-1 h-1 rounded-full bg-gray-400 flex-shrink-0" />
      {text}
    </li>
  );
}
