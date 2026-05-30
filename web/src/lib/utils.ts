import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const WORKER_URL = process.env.WORKER_URL || "http://localhost:8787";

export const PROJECT_ROOT = process.env.PROJECT_ROOT || "D:/财富密码/视频号/静态图片科普视频";
