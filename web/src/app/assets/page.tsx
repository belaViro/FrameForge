import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const FILE_ROOT = process.cwd();

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

export default function AssetsPage() {
  const imageExts = [".png", ".jpg", ".jpeg", ".gif"];
  const dirs = ["AI智能体5分钟图片", "参考风格图片", "封面", "out", "build_ai_agent_video"];

  return (
    <div className="max-w-5xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">素材浏览</h2>

      <div className="space-y-6">
        {dirs.map((dir) => {
          const fullDir = path.join(FILE_ROOT, dir);
          const files = listDir(fullDir);
          if (files.length === 0) return null;

          return (
            <section key={dir} className="bg-white rounded-lg border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">{dir}/</h3>
              <div className="grid grid-cols-4 gap-3">
                {files
                  .filter((f) => f.type === "file")
                  .map((f) => (
                    <div key={f.name} className="border border-gray-200 rounded-md overflow-hidden">
                      {imageExts.includes(f.ext) ? (
                        <img
                          src={`/api/files/${dir}/${f.name}`}
                          alt={f.name}
                          className="w-full h-32 object-cover"
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
