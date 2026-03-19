import { Card } from '@/components/ui/card';

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-1 text-gray-500">
        Welcome to your AI visibility dashboard.
      </p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <p className="text-sm font-medium text-gray-500">Visibility Score</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">--</p>
          <p className="mt-1 text-xs text-gray-400">Coming soon</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-gray-500">Queries Tracked</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">--</p>
          <p className="mt-1 text-xs text-gray-400">Coming soon</p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-gray-500">AI Platforms</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">--</p>
          <p className="mt-1 text-xs text-gray-400">Coming soon</p>
        </Card>
      </div>

      <Card className="mt-8">
        <div className="text-center py-12">
          <h2 className="text-lg font-semibold text-gray-900">
            Your dashboard is being set up
          </h2>
          <p className="mt-2 text-gray-500 max-w-md mx-auto">
            Once your account setup is complete, you will see your AI visibility
            score, citation tracking, competitor analysis, and more here.
          </p>
        </div>
      </Card>
    </div>
  );
}
