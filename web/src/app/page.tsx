import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function DashboardPage() {
  const totalEpisodes = await prisma.episode.count();
  const produced = await prisma.episode.count({ where: { status: "produced" } });
  const drafts = await prisma.episode.count({ where: { status: "draft" } });
  const recentBuilds = await prisma.buildTask.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { episode: true },
  });

  return (
    <div className="max-w-5xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">仪表盘</h2>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="总集数" value={totalEpisodes} />
        <StatCard label="已制作" value={produced} color="text-green-600" />
        <StatCard label="草稿" value={drafts} color="text-orange-500" />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">最近构建</h3>
          <Link href="/production" className="text-sm text-blue-600 hover:underline">
            查看全部
          </Link>
        </div>
        {recentBuilds.length === 0 ? (
          <p className="text-sm text-gray-500">暂无构建记录</p>
        ) : (
          <div className="space-y-2">
            {recentBuilds.map((task) => (
              <div key={task.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-700">
                  EP{String(task.episode.number).padStart(2, "0")} {task.episode.title}
                </span>
                <StatusBadge status={task.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex gap-3">
        <Link
          href="/episodes"
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
        >
          管理选题
        </Link>
      </div>
    </div>
  );
}

function StatCard({ label, value, color = "text-gray-900" }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    queued: "bg-gray-100 text-gray-600",
    running: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status] || styles.queued}`}>
      {status}
    </span>
  );
}
