import assert from "node:assert/strict";
import test from "node:test";
import { decideSubscriberState, refreshDelivery, type CampaignReceipt } from "../src/digital_asset_campaign.js";

test("a bounce pauses the subscriber even when an open was recorded", async () => {
  const receipt: CampaignReceipt = {
    campaignId: "launch-12",
    subscriberId: "customer-9",
    messageId: "message-44",
    subscriberState: "active",
  };
  const client = {
    async listEvents(messageId: string) {
      assert.equal(messageId, "message-44");
      return [{ type: "opened" }, { type: "bounced" }];
    },
  };

  const updated = await refreshDelivery(receipt, client);
  assert.equal(updated.subscriberState, "paused");
  assert.equal(decideSubscriberState([{ type: "opened" }]), "engaged");
  assert.equal(decideSubscriberState([]), "active");
});
