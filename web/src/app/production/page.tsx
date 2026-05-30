import { prisma } from "@/lib/prisma";

export default async function ProductionPage() {
  const tasks = await prisma.buildTask.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { episode: true },
  });

  return (
    <div className="max-w-5xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">生产队列</h2>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {tasks.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">暂无构建任务</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">集数</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">标题</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">状态</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">阶段</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">进度</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">时间</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-b border-gray-100">
                  <td className="px-4 py-3 font-mono text-gray-500">
                    EP{String(task.episode.number).padStart(2, "0")}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{task.episode.title}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={task.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-500">{task.stage || "-"}</td>
                  <td className="px-4 py-3">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${task.progress * 100}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(task.createdAt).toLocaleString("zh-CN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
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
