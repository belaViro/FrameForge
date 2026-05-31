import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function DashboardPage() {
  const totalEpisodes = await prisma.episode.count();
  const produced = await prisma.episode.count({ where: { status: "produced" } });
  const drafts = await prisma.episode.count({ where: { status: "draft" } });
  const scripted = await prisma.episode.count({ where: { status: "scripted" } });
  const imagesReady = await prisma.episode.count({ where: { status: "images_ready" } });
  const recentBuilds = await prisma.buildTask.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { episode: true },
  });

  const progress = totalEpisodes > 0 ? Math.round((produced / totalEpisodes) * 100) : 0;

  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">仪表盘</h2>
        <p className="text-sm text-slate-500 mt-1">AI 科普视频生产流水线概览</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="总集数" value={totalEpisodes} icon={<TotalIcon />} />
        <StatCard label="已制作" value={produced} icon={<CheckIcon />} accent="emerald" />
        <StatCard label="待配图" value={scripted + imagesReady} icon={<ImageIcon />} accent="amber" />
        <StatCard label="草稿" value={drafts} icon={<DraftIcon />} accent="slate" />
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6 animate-in" style={{ animationDelay: "0.1s" }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-slate-700">整体进度</span>
          <span className="text-sm font-semibold text-indigo-600">{progress}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-slate-400 mt-2">{produced} / {totalEpisodes} 集已完成制作</p>
      </div>

      {/* Recent Builds */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 animate-in" style={{ animationDelay: "0.2s" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">最近构建</h3>
          <Link href="/production" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
            查看全部 &rarr;
          </Link>
        </div>
        {recentBuilds.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-slate-400">暂无构建记录</p>
            <Link href="/episodes" className="text-sm text-indigo-600 hover:underline mt-2 inline-block">
              前往选题管理开始制作
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentBuilds.map((task) => (
              <div key={task.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-400 w-8">
                    {String(task.episode.number).padStart(2, "0")}
                  </span>
                  <span className="text-sm text-slate-700 font-medium">
                    {task.episode.title}
                  </span>
                </div>
                <StatusBadge status={task.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-6 flex gap-3 animate-in" style={{ animationDelay: "0.3s" }}>
        <Link
          href="/episodes"
          className="px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          管理选题
        </Link>
        <Link
          href="/settings"
          className="px-4 py-2.5 bg-white text-slate-700 text-sm font-medium rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          配置设置
        </Link>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, accent = "indigo" }: { label: string; value: number; icon: React.ReactNode; accent?: string }) {
  const accentMap: Record<string, string> = {
    indigo: "from-indigo-500/10 to-indigo-500/5 text-indigo-600",
    emerald: "from-emerald-500/10 to-emerald-500/5 text-emerald-600",
    amber: "from-amber-500/10 to-amber-500/5 text-amber-600",
    slate: "from-slate-500/10 to-slate-500/5 text-slate-600",
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 card-hover">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${accentMap[accent]} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; dot?: string }> = {
    queued: { bg: "bg-slate-100", text: "text-slate-600" },
    running: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
    completed: { bg: "bg-emerald-50", text: "text-emerald-700" },
    failed: { bg: "bg-red-50", text: "text-red-700" },
  };
  const c = config[status] || config.queued;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {c.dot && <span className={`w-1.5 h-1.5 rounded-full ${c.dot} pulse-dot`} />}
      {status === "completed" ? "完成" : status === "running" ? "进行中" : status === "failed" ? "失败" : "排队中"}
    </span>
  );
}

function TotalIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function DraftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
