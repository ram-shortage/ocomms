/**
 * Generate SRI hashes for static assets.
 *
 * Run after build: npx tsx scripts/generate-sri.ts
 * Outputs sri-manifest.json with integrity hashes for JS/CSS files.
 *
 * Note: Next.js handles SRI for its own chunks when configured.
 * This script is for any additional static assets.
 */
import ssri from "ssri";
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, extname } from "path";

const BUILD_DIR = ".next/static";
const OUTPUT_FILE = "public/sri-manifest.json";

interface SRIManifest {
  generated: string;
  files: Record<string, string>;
}

function getFiles(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) {
    return files;
  }

  const items = readdirSync(dir);

  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      getFiles(fullPath, files);
    } else {
      const ext = extname(item).toLowerCase();
      if ([".js", ".css"].includes(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function generateSRI(): void {
  console.log("[SRI] Generating integrity hashes...");

  const manifest: SRIManifest = {
    generated: new Date().toISOString(),
    files: {},
  };

  try {
    if (!existsSync(BUILD_DIR)) {
      console.error(`[SRI] Build directory not found: ${BUILD_DIR}`);
      console.error("[SRI] Run 'npm run build' first.");
      process.exit(1);
    }

    const files = getFiles(BUILD_DIR);

    if (files.length === 0) {
      console.warn("[SRI] No JS/CSS files found in build directory");
      writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2));
      console.log(`[SRI] Empty manifest written to ${OUTPUT_FILE}`);
      return;
    }

    for (const file of files) {
      const content = readFileSync(file);
      const integrity = ssri.fromData(content, { algorithms: ["sha384"] });
      const relativePath = file.replace(BUILD_DIR, "/_next/static");

      manifest.files[relativePath] = integrity.toString();
      console.log(`[SRI] ${relativePath}: ${integrity.toString().slice(0, 30)}...`);
    }

    writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2));
    console.log(`[SRI] Manifest written to ${OUTPUT_FILE}`);
    console.log(`[SRI] Total files: ${Object.keys(manifest.files).length}`);
  } catch (error) {
    console.error("[SRI] Error:", error);
    process.exit(1);
  }
}

generateSRI();
