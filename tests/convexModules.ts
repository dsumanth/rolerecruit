import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const convexDir = path.join(projectRoot, "convex");
const genDir = path.join(convexDir, "_generated");

function buildModule(fullPath: string): () => Promise<any> {
  return async () => await import(fullPath);
}

export const modules: Record<string, () => Promise<any>> = {
  "schema.ts": buildModule(path.join(convexDir, "schema.ts")),
  "schools.ts": buildModule(path.join(convexDir, "schools.ts")),
  "users.ts": buildModule(path.join(convexDir, "users.ts")),
  "auth.config.ts": buildModule(path.join(convexDir, "auth.config.ts")),
  "_generated/server.js": buildModule(path.join(genDir, "server.js")),
  "_generated/api.js": buildModule(path.join(genDir, "api.js")),
  "_generated/dataModel.d.ts": buildModule(path.join(genDir, "dataModel.d.ts")),
};
