import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ZodError, z } from "zod";
import { campaignRequestSchema, refreshDelivery, sendAssetDelivery } from "./digital_asset_campaign.js";
import { emailClientFromEnvironment, InfraiError } from "./infrai_email.js";

const refreshSchema = z.object({
  campaignId: z.string().min(1),
  subscriberId: z.string().min(1),
  messageId: z.string().min(1),
  subscriberState: z.enum(["active", "engaged", "paused"]),
});

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function clientStatus(error: InfraiError): number {
  return error.status >= 400 && error.status < 500 ? error.status : 502;
}

const client = emailClientFromEnvironment();
const port = Number(process.env.PORT ?? 3000);

createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/campaigns/deliver") {
      const input = campaignRequestSchema.parse(await readJson(request));
      json(response, 202, await sendAssetDelivery(input, client));
      return;
    }
    if (request.method === "POST" && request.url === "/campaigns/refresh") {
      const receipt = refreshSchema.parse(await readJson(request));
      json(response, 200, await refreshDelivery(receipt, client));
      return;
    }
    json(response, 404, { error: "route_not_found" });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      json(response, 400, { error: "invalid_request" });
      return;
    }
    if (error instanceof InfraiError) {
      json(response, clientStatus(error), { error: error.code, detail: error.detail });
      return;
    }
    console.error(error);
    json(response, 502, { error: "delivery_request_failed" });
  }
}).listen(port, () => console.log(`creator delivery service listening on http://localhost:${port}`));
