import { IndexerClient } from "@kitcrate/sdk";

const baseUrl = process.env.NEXT_PUBLIC_INDEXER_API_URL;

export const indexerClient = baseUrl ? new IndexerClient({ baseUrl }) : null;

export function requireIndexerClient(): IndexerClient {
  if (!indexerClient) {
    throw new Error(
      "NEXT_PUBLIC_INDEXER_API_URL is not configured. Set it to the kitcrate-backend indexer URL.",
    );
  }
  return indexerClient;
}
