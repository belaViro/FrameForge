import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { EpisodeEditor } from "@/components/episode-editor";

export default async function EpisodeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const episodeId = parseInt(id);
  if (isNaN(episodeId)) notFound();

  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: {
      scenes: { orderBy: { order: "asc" } },
      ttsConfig: true,
      videoConfig: true,
      builds: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  if (!episode) notFound();

  return <EpisodeEditor episode={episode} />;
}
