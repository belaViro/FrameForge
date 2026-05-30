import { prisma } from "@/lib/prisma";
import Link from "next/link";

const seasonNames: Record<number, string> = {
  1: "AI 是怎么想的",
  2: "智能体的诞生",
  3: "AI 应用全景",
  4: "技术深水区",
  5: "未来与思考",
};

const statusLabels: Record<string, { label: string; style: string }> = {
  draft: { label: "草稿", style: "bg-gray-100 text-gray-600" },
  scripted: { label: "已写稿", style: "bg-yellow-100 text-yellow-700" },
  images_ready: { label: "图片就绪", style: "bg-purple-100 text-purple-700" },
  produced: { label: "已制作", style: "bg-green-100 text-green-700" },
  published: { label: "已发布", style: "bg-blue-100 text-blue-700" },
};

export default async function EpisodesPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const params = await searchParams;
  const seasonFilter = params.season ? parseInt(params.season) : undefined;

  const episodes = await prisma.episode.findMany({
    where: seasonFilter ? { season: seasonFilter } : undefined,
    orderBy: { number: "asc" },
  });

  const seasons = [1, 2, 3, 4, 5];

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">选题管理</h2>
        <Link
          href="/episodes/new"
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
        >
          新建选题
        </Link>
      </div>

      <div className="flex gap-2 mb-4">
        <Link
          href="/episodes"
          className={`px-3 py-1.5 text-sm rounded-md ${!seasonFilter ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
        >
          全部
        </Link>
        {seasons.map((s) => (
          <Link
            key={s}
            href={`/episodes?season=${s}`}
            className={`px-3 py-1.5 text-sm rounded-md ${seasonFilter === s ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
          >
            S{s}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">集数</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">标题</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">季</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">状态</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">钩子</th>
            </tr>
          </thead>
          <tbody>
            {episodes.map((ep) => {
              const st = statusLabels[ep.status] || statusLabels.draft;
              return (
                <tr key={ep.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-gray-500">
                    {String(ep.number).padStart(2, "0")}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/episodes/${ep.id}`} className="text-blue-600 hover:underline font-medium">
                      {ep.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">S{ep.season}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${st.style}`}>
                      {st.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 truncate max-w-[200px]">{ep.hook}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
