import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { requireAuth } from "@/lib/api/v1/_shared/auth-middleware";
import { fromZodError } from "@/lib/api/v1/_shared/error-envelope";
import { ProblemJsonSchema } from "@/lib/api/v1/schemas/_common";
import { ioLogsHandler } from "./handlers";

export const ioLogsRouter = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) return fromZodError(result.error, new URL(c.req.url).pathname);
  },
});

const security: Array<Record<string, string[]>> = [
  { cookieAuth: [] },
  { bearerAuth: [] },
  { apiKeyAuth: [] },
];

const IoLogItemSchema = z.object({
  id: z.number(),
  requestId: z.number(),
  requestBody: z.record(z.string(), z.unknown()).nullable(),
  responseBody: z.string().nullable(),
  createdAt: z.string(),
  model: z.string().nullable(),
  originalModel: z.string().nullable(),
  statusCode: z.number().nullable(),
});

const IoLogListResponseSchema = z.object({
  items: z.array(IoLogItemSchema),
  pageInfo: z.object({
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  }),
});

const IoLogListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

ioLogsRouter.openapi(
  createRoute({
    method: "get",
    path: "/io-logs",
    middleware: requireAuth("admin"),
    tags: ["I/O Logs"],
    summary: "List request I/O logs",
    description: "Returns paginated request/response body logs. Requires ENABLE_IO_BODY_LOGGING=true.",
    "x-required-access": "admin",
    security,
    request: { query: IoLogListQuerySchema },
    responses: {
      200: {
        description: "I/O log page.",
        content: { "application/json": { schema: IoLogListResponseSchema } },
      },
      400: {
        description: "Invalid request.",
        content: { "application/problem+json": { schema: ProblemJsonSchema } },
      },
      401: {
        description: "Authentication required.",
        content: { "application/problem+json": { schema: ProblemJsonSchema } },
      },
      403: {
        description: "Admin access required.",
        content: { "application/problem+json": { schema: ProblemJsonSchema } },
      },
    },
  }),
  ioLogsHandler as never
);
