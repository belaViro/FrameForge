import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const FILE_ROOT = process.cwd();
const STORAGE_ROOT = path.join(FILE_ROOT, "storage");

interface FileItem {
  name: string;
  type: "file" | "dir";
  size: number;
  ext: string;
}

function listDir(dirPath: string): FileItem[] {
  try {
    const entries = readdirSync(dirPath);
    return entries
      .filter((name) => !name.startsWith(".") && name !== "__pycache__" && name !== "node_modules")
      .map((name) => {
        const fullPath = path.join(dirPath, name);
        const s = statSync(fullPath);
        return {
          name,
          type: s.isDirectory() ? "dir" as const : "file" as const,
          size: s.size,
          ext: path.extname(name).toLowerCase(),
        };
      })
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  } catch {
    return [];
  }
}

function discoverImageDirs(): { label: string; relativePath: string }[] {
  const imagesRoot = path.join(STORAGE_ROOT, "images");
  const dirs: { label: string; relativePath: string }[] = [];

  try {
    const entries = readdirSync(imagesRoot);
    for (const name of entries) {
      const full = path.join(imagesRoot, name);
      try {
        if (statSync(full).isDirectory()) {
          dirs.push({ label: `images/${name}`, relativePath: `storage/images/${name}` });
        }
      } catch { /* skip */ }
    }
  } catch { /* no images dir */ }

  // Also include output directory
  const outputDir = path.join(STORAGE_ROOT, "output");
  try {
    if (statSync(outputDir).isDirectory()) {
      dirs.push({ label: "output", relativePath: "storage/output" });
    }
  } catch { /* no output dir */ }

  return dirs;
}

export default function AssetsPage() {
  const imageExts = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
  const videoExts = [".mp4"];
  const dirs = discoverImageDirs();

  if (dirs.length === 0) {
    return (
      <div className="max-w-5xl">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">素材浏览</h2>
        <p className="text-sm text-slate-400">暂无素材，生成图片或构建视频后会在此显示</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">素材浏览</h2>

      <div className="space-y-6">
        {dirs.map(({ label, relativePath }) => {
          const fullDir = path.join(FILE_ROOT, relativePath);
          const files = listDir(fullDir);
          const mediaFiles = files.filter(
            (f) => f.type === "file" && (imageExts.includes(f.ext) || videoExts.includes(f.ext))
          );
          if (mediaFiles.length === 0) return null;

          return (
            <section key={relativePath} className="bg-white rounded-lg border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-1">{label}/</h3>
              <p className="text-xs text-slate-400 mb-3">{mediaFiles.length} 个文件</p>
              <div className="grid grid-cols-4 gap-3">
                {mediaFiles.map((f) => (
                  <div key={f.name} className="border border-gray-200 rounded-md overflow-hidden">
                    {imageExts.includes(f.ext) ? (
                      <img
                        src={`/api/files/${relativePath}/${f.name}`}
                        alt={f.name}
                        className="w-full h-32 object-cover"
                      />
                    ) : videoExts.includes(f.ext) ? (
                      <video
                        src={`/api/files/${relativePath}/${f.name}`}
                        className="w-full h-32 object-cover"
                        muted
                      />
                    ) : (
                      <div className="w-full h-32 bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                        {f.ext || "file"}
                      </div>
                    )}
                    <p className="px-2 py-1 text-xs text-gray-600 truncate">{f.name}</p>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
