import { campaignRequestSchema, sendAssetDelivery } from "../src/digital_asset_campaign.js";
import { emailClientFromEnvironment } from "../src/infrai_email.js";

const recipient = process.env.DEMO_EMAIL_TO;
if (!recipient) throw new Error("DEMO_EMAIL_TO is required");

const campaign = campaignRequestSchema.parse({
  campaignId: "spring-brush-pack",
  subscriber: { id: "customer-1042", email: recipient, name: "Store customer" },
  asset: { title: "Spring Brush Pack", downloadUrl: "https://store.example/downloads/demo-token" },
});

const receipt = await sendAssetDelivery(campaign, emailClientFromEnvironment());
console.log(JSON.stringify(receipt, null, 2));
