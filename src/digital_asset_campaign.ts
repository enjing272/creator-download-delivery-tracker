import { z } from "zod";
import type { DeliveryEvent, InfraiEmailClient } from "./infrai_email.js";

export const campaignRequestSchema = z.object({
  campaignId: z.string().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/),
  subscriber: z.object({
    id: z.string().min(1).max(80),
    email: z.string().email(),
    name: z.string().min(1).max(100),
  }),
  asset: z.object({
    title: z.string().min(1).max(160),
    downloadUrl: z.string().url(),
  }),
});

export type CampaignRequest = z.infer<typeof campaignRequestSchema>;
export type SubscriberState = "active" | "engaged" | "paused";
export type CampaignReceipt = {
  campaignId: string;
  subscriberId: string;
  messageId: string;
  subscriberState: SubscriberState;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] ?? character);
}

export function renderDownloadEmail(input: CampaignRequest): string {
  return `<p>Hi ${escapeHtml(input.subscriber.name)},</p>`
    + `<p>Your copy of <strong>${escapeHtml(input.asset.title)}</strong> is ready.</p>`
    + `<p><a href="${escapeHtml(input.asset.downloadUrl)}">Download your purchase</a></p>`;
}

export function decideSubscriberState(events: DeliveryEvent[]): SubscriberState {
  const kinds = new Set(events.map((event) => event.type.toLowerCase()));
  if (kinds.has("bounced")) return "paused";
  if (kinds.has("opened")) return "engaged";
  return "active";
}

export async function sendAssetDelivery(
  input: CampaignRequest,
  client: Pick<InfraiEmailClient, "send">,
): Promise<CampaignReceipt> {
  const parsed = campaignRequestSchema.parse(input);
  const sent = await client.send({
    to: parsed.subscriber.email,
    subject: `Your ${parsed.asset.title} download`,
    html: renderDownloadEmail(parsed),
  }, `${parsed.campaignId}:${parsed.subscriber.id}`);
  return {
    campaignId: parsed.campaignId,
    subscriberId: parsed.subscriber.id,
    messageId: sent.message_id,
    subscriberState: "active",
  };
}

export async function refreshDelivery(
  receipt: CampaignReceipt,
  client: Pick<InfraiEmailClient, "listEvents">,
): Promise<CampaignReceipt> {
  const events = await client.listEvents(receipt.messageId);
  return { ...receipt, subscriberState: decideSubscriberState(events) };
}
