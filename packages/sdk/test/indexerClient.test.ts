/**
 * Regression coverage for IndexerClient's listing-mutation auth flow: every
 * write (createListing/updateListing/deleteListing) must first request a
 * SEP-53 challenge from the indexer, have the injected signer sign it, and
 * only then send the actual mutation with the resulting headers attached.
 * These tests run against a mocked global fetch (no network, no real
 * indexer), asserting on exactly what was sent — this is the "does the SDK
 * build the request kitcrate-backend's auth middleware expects" half of the
 * contract; kitcrate-backend's own route-level tests
 * (indexer/test/listings-auth.test.ts) prove the other half.
 *
 *   node --test test/*.test.ts
 */
import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { IndexerClient, type ListingSigner } from "../src/indexerClient.ts";

interface RecordedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

const requests: RecordedRequest[] = [];
let responses: unknown[] = [];
const originalFetch = globalThis.fetch;

function headerRecordFrom(init?: RequestInit): Record<string, string> {
  const headers: Record<string, string> = {};
  const raw = init?.headers as Record<string, string> | undefined;
  if (raw) {
    for (const [key, value] of Object.entries(raw)) headers[key.toLowerCase()] = value;
  }
  return headers;
}

/// Queues canned JSON responses (consumed in order, one per fetch call) and
/// records every request made so assertions can inspect method/headers/body.
function mockFetch(...queue: { status: number; body: unknown }[]): void {
  responses = [...queue];
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    requests.push({
      url,
      method: init?.method ?? "GET",
      headers: headerRecordFrom(init),
      body: init?.body ? JSON.parse(init.body as string) : undefined,
    });
    const next = responses.shift();
    if (!next) throw new Error(`mockFetch: no more queued responses for ${url}`);
    return new Response(next.body === undefined ? null : JSON.stringify(next.body), {
      status: next.status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

beforeEach(() => {
  requests.length = 0;
  responses = [];
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function testSigner(address: string, signedMessages: string[]): ListingSigner {
  return {
    address,
    sign: async (message: string) => {
      signedMessages.push(message);
      return `sig-for:${message.length}`;
    },
  };
}

const OWNER = "GBXFXNDLV4LSWA4VB7YIL5GBD7BVNR22SGBTDKMO2SBZZHDXSKZYCP7L";

test("createListing requests a create_listing challenge, signs it, then POSTs with the resulting headers", async () => {
  const signedMessages: string[] = [];
  const signer = testSigner(OWNER, signedMessages);
  mockFetch(
    { status: 201, body: { nonce: "n1", message: "sign-me", expiresAt: "2026-01-01T00:00:00Z" } },
    {
      status: 201,
      body: {
        id: "listing-1",
        owner: OWNER,
        title: "Drill",
        description: "",
        photo_urls: [],
        location: "Portland, OR",
        daily_rate: "10",
        deposit: "20",
        currently_booked: false,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    },
  );

  const client = new IndexerClient({ baseUrl: "http://indexer.test" });
  const listing = await client.createListing(
    {
      ownerAddress: OWNER,
      title: "Drill",
      description: "",
      dailyRentalAmount: "10.00",
      depositAmount: "20.00",
      imageUrls: [],
      location: "Portland, OR",
    },
    signer,
  );

  assert.equal(requests.length, 2);
  const [challengeReq, createReq] = requests;

  assert.equal(challengeReq?.url, "http://indexer.test/auth/challenge");
  assert.equal(challengeReq?.method, "POST");
  assert.equal((challengeReq?.body as { action: string }).action, "create_listing");
  assert.equal((challengeReq?.body as { address: string }).address, OWNER);
  // The listing id used to request the challenge must be the exact same id
  // sent in the actual create body (see createReq below) — otherwise the
  // indexer's atomic (address, action, listing_id) match would reject it.
  const challengedListingId = (challengeReq?.body as { listingId: string }).listingId;

  assert.equal(createReq?.url, "http://indexer.test/listings");
  assert.equal(createReq?.method, "POST");
  assert.equal((createReq?.body as { id: string }).id, challengedListingId);
  assert.equal((createReq?.body as { owner: string }).owner, OWNER);
  assert.equal(createReq?.headers["x-kitcrate-address"], OWNER);
  assert.equal(createReq?.headers["x-kitcrate-nonce"], "n1");
  assert.equal(createReq?.headers["x-kitcrate-signature"], "sig-for:7"); // "sign-me".length

  // The signer was asked to sign the exact message the challenge returned,
  // not something reconstructed client-side.
  assert.deepEqual(signedMessages, ["sign-me"]);

  // Response mapping applied: ownerAddress (camelCase) is present, proving
  // the raw ListingRow went through mapListing() rather than being
  // returned as-is (a prior version of this method skipped mapping).
  assert.equal(listing.ownerAddress, OWNER);
  assert.equal(listing.dailyRentalAmount, "10");
});

test("updateListing requests an update_listing challenge scoped to the target id", async () => {
  const signedMessages: string[] = [];
  const signer = testSigner(OWNER, signedMessages);
  mockFetch(
    { status: 201, body: { nonce: "n2", message: "update-me", expiresAt: "2026-01-01T00:00:00Z" } },
    {
      status: 200,
      body: {
        id: "listing-9",
        owner: OWNER,
        title: "New title",
        description: "",
        photo_urls: [],
        location: "Portland, OR",
        daily_rate: "15",
        deposit: "20",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    },
  );

  const client = new IndexerClient({ baseUrl: "http://indexer.test" });
  const listing = await client.updateListing("listing-9", { title: "New title" }, signer);

  const [challengeReq, updateReq] = requests;
  assert.equal((challengeReq?.body as { action: string }).action, "update_listing");
  assert.equal((challengeReq?.body as { listingId: string }).listingId, "listing-9");
  assert.equal(updateReq?.url, "http://indexer.test/listings/listing-9");
  assert.equal(updateReq?.method, "PUT");
  assert.equal(updateReq?.headers["x-kitcrate-nonce"], "n2");
  assert.equal(listing.title, "New title");
});

test("deleteListing requests a delete_listing challenge scoped to the target id and sends no body", async () => {
  const signedMessages: string[] = [];
  const signer = testSigner(OWNER, signedMessages);
  mockFetch(
    { status: 201, body: { nonce: "n3", message: "delete-me", expiresAt: "2026-01-01T00:00:00Z" } },
    { status: 204, body: undefined },
  );

  const client = new IndexerClient({ baseUrl: "http://indexer.test" });
  await client.deleteListing("listing-9", signer);

  const [challengeReq, deleteReq] = requests;
  assert.equal((challengeReq?.body as { action: string }).action, "delete_listing");
  assert.equal(deleteReq?.url, "http://indexer.test/listings/listing-9");
  assert.equal(deleteReq?.method, "DELETE");
  assert.equal(deleteReq?.headers["x-kitcrate-signature"], "sig-for:9"); // "delete-me".length
});

test("each mutation requests a fresh challenge (never reuses one across calls)", async () => {
  const signedMessages: string[] = [];
  const signer = testSigner(OWNER, signedMessages);
  mockFetch(
    { status: 201, body: { nonce: "a", message: "msg-a", expiresAt: "2026-01-01T00:00:00Z" } },
    { status: 200, body: { id: "x", owner: OWNER, title: "t", description: "", photo_urls: [], location: "l", daily_rate: "1", deposit: "1", created_at: "", updated_at: "" } },
    { status: 201, body: { nonce: "b", message: "msg-b", expiresAt: "2026-01-01T00:00:00Z" } },
    { status: 200, body: { id: "x", owner: OWNER, title: "t2", description: "", photo_urls: [], location: "l", daily_rate: "1", deposit: "1", created_at: "", updated_at: "" } },
  );

  const client = new IndexerClient({ baseUrl: "http://indexer.test" });
  await client.updateListing("x", { title: "t" }, signer);
  await client.updateListing("x", { title: "t2" }, signer);

  assert.deepEqual(signedMessages, ["msg-a", "msg-b"]);
  // requests: [0]=challenge a, [1]=first PUT, [2]=challenge b, [3]=second PUT.
  assert.equal(requests[1]?.headers["x-kitcrate-nonce"], "a");
  assert.equal(requests[3]?.headers["x-kitcrate-nonce"], "b");
});
