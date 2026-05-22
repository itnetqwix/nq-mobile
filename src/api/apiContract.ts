/**
 * Shared API contract derived from `config/apiRoutes.ts`.
 * Use for typed paths, OpenAPI export, and cross-platform parity with web/backend.
 */
import { API_ROUTES } from "../config/apiRoutes";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiOperation = {
  operationId: string;
  method: HttpMethod;
  path: string;
  tag: string;
  /** Path includes `:id` style params */
  pathTemplate: string;
};

type RouteLeaf = string | ((...args: never[]) => string);

function isRouteFunction(v: unknown): v is (...args: never[]) => string {
  return typeof v === "function";
}

function inferMethod(key: string, path: string): HttpMethod {
  const k = key.toLowerCase();
  const p = path.toLowerCase();
  if (
    k.startsWith("get") ||
    k === "me" ||
    k === "list" ||
    k.endsWith("status") ||
    p.includes("/get-") ||
    p.includes("booking-list") ||
    p.includes("scheduled-meetings") ||
    p.includes("/friends") ||
    p.includes("friend-requests") ||
    p.includes("/notifications") ||
    p.includes("/storage") ||
    p.includes("/balance") ||
    p.includes("/ledger") ||
    p.includes("/config") ||
    p.includes("/earnings") ||
    p.includes("/profile") ||
    p.includes("/master-data") ||
    p.includes("chat-conversations") ||
    p.includes("chat-policy")
  ) {
    return "GET";
  }
  if (k.startsWith("delete") || p.includes("/delete-")) return "DELETE";
  if (k.startsWith("update") || k.includes("revoke") || k.includes("preference")) return "PUT";
  if (k.startsWith("patch")) return "PATCH";
  return "POST";
}

function toOperationId(tag: string, key: string): string {
  return `${tag}_${key}`.replace(/[^a-zA-Z0-9_]/g, "_");
}

function flattenRoutes(
  group: Record<string, RouteLeaf>,
  tag: string,
  out: ApiOperation[]
): void {
  for (const [key, value] of Object.entries(group)) {
    if (isRouteFunction(value)) {
      const fn = value as (id: string) => string;
      const sample = fn("sampleId");
      const pathTemplate = sample.replace("sampleId", "{id}");
      out.push({
        operationId: toOperationId(tag, key),
        method: inferMethod(key, pathTemplate),
        path: pathTemplate,
        pathTemplate,
        tag,
      });
    } else if (typeof value === "string") {
      out.push({
        operationId: toOperationId(tag, key),
        method: inferMethod(key, value),
        path: value,
        pathTemplate: value,
        tag,
      });
    }
  }
}

const _operations: ApiOperation[] = [];
for (const [tag, routes] of Object.entries(API_ROUTES)) {
  flattenRoutes(routes as Record<string, RouteLeaf>, tag, _operations);
}

/** All REST operations in stable sort order. */
export const API_OPERATIONS: readonly ApiOperation[] = Object.freeze(
  [..._operations].sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method))
);

export type ApiOperationId = (typeof API_OPERATIONS)[number]["operationId"];

const byId = new Map<string, ApiOperation>(
  API_OPERATIONS.map((op) => [op.operationId, op])
);

export function getApiOperation(operationId: ApiOperationId | string): ApiOperation | undefined {
  return byId.get(operationId);
}

/** Resolve path for a static operation (non-function routes only). */
export function pathFor(operationId: ApiOperationId | string): string {
  const op = getApiOperation(operationId);
  if (!op) throw new Error(`Unknown API operation: ${operationId}`);
  return op.path;
}

/** OpenAPI 3.1 document (paths only — schemas added incrementally). */
export function buildOpenApiDocument(apiBaseUrl = "https://api-netqwix.com"): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const op of API_OPERATIONS) {
    if (!paths[op.path]) paths[op.path] = {};
    paths[op.path][op.method.toLowerCase()] = {
      operationId: op.operationId,
      tags: [op.tag],
      summary: op.operationId.replace(/_/g, " "),
      responses: {
        "200": { description: "Success" },
        "401": { description: "Unauthorized" },
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "NetQwix Mobile API",
      version: "1.0.0",
      description:
        "Generated from `src/config/apiRoutes.ts`. Regenerate: `npm run sync:api-contract`.",
    },
    servers: [{ url: apiBaseUrl }],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
    security: [{ bearerAuth: [] }],
  };
}

/** Contract version — bump when apiRoutes.ts changes materially. */
export const API_CONTRACT_VERSION = "2026-05-22";
