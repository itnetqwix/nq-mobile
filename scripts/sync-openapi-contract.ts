import fs from "fs";
import path from "path";
import { API_CONTRACT_VERSION, API_OPERATIONS, buildOpenApiDocument } from "../src/api/apiContract";

const outDir = path.join(__dirname, "..", "docs");
const outFile = path.join(outDir, "openapi.mobile.json");

fs.mkdirSync(outDir, { recursive: true });

const doc = buildOpenApiDocument();
const payload = {
  contractVersion: API_CONTRACT_VERSION,
  operationCount: API_OPERATIONS.length,
  ...doc,
};

fs.writeFileSync(outFile, JSON.stringify(payload, null, 2));
console.log(`Wrote ${outFile} (${API_OPERATIONS.length} operations)`);
