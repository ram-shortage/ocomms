import { build } from "esbuild";

await build({
  entryPoints: ["src/server/index.ts"],
  outfile: "dist-server/index.js",
  bundle: true,
  platform: "node",
  target: "node22",
  minify: true,
  sourcemap: true,
  external: [
    "next",         // Must be copied separately
    "sharp",        // Native addon
    "lightningcss", // Native addon
  ],
});

console.log("Server bundled to dist-server/index.js");
