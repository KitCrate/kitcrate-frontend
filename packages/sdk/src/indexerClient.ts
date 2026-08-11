export type AgreementStatus =
  | "Created"
  | "Funded"
  | "Active"
  | "Disputed"
  | "Resolved"
  | "Completed"
  | "Cancelled";

export interface Agreement {
  id: string;
  contractId: string;
  owner: string;
  renter: string;
  itemRef: string;
  rentalAmount: string;
  depositAmount: string;
  startTime: string;
  endTime: string;
  claimWindowSecs: number;
  status: AgreementStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AgreementEvent {
  id: string;
  agreementId: string;
  type: AgreementStatus;
  txHash: string;
  createdAt: string;
  data?: Record<string, unknown>;
}

export interface AgreementFilters {
  owner?: string;
  renter?: string;
  status?: AgreementStatus;
}

/**
 * Listing shape and paths are provisional. The kitcrate-backend repo owns the
 * listings schema, confirm field names and endpoint paths against its current
 * implementation before relying on this in production.
 */
export interface Listing {
  id: string;
  ownerAddress: string;
  title: string;
  description: string;
  category: string;
  dailyRentalAmount: string;
  depositAmount: string;
  imageUrls: string[];
  location: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateListingInput = Omit<Listing, "id" | "createdAt" | "updatedAt">;
export type UpdateListingInput = Partial<CreateListingInput>;

export interface ListingFilters {
  ownerAddress?: string;
  category?: string;
}

export class IndexerApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly path: string,
  ) {
    super(message);
    this.name = "IndexerApiError";
  }
}

export interface IndexerClientConfig {
  baseUrl: string;
}

export class IndexerClient {
  private readonly baseUrl: string;

  constructor(config: IndexerClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new IndexerApiError(
        body || `Indexer API request failed with status ${response.status}.`,
        response.status,
        path,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  private buildQuery(params: Record<string, string | undefined>): string {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) search.set(key, value);
    }
    const query = search.toString();
    return query ? `?${query}` : "";
  }

  async getAgreement(id: string): Promise<Agreement> {
    return this.request<Agreement>(`/agreements/${id}`);
  }

  async listAgreements(filters: AgreementFilters = {}): Promise<Agreement[]> {
    const query = this.buildQuery({
      owner: filters.owner,
      renter: filters.renter,
      status: filters.status,
    });
    return this.request<Agreement[]>(`/agreements${query}`);
  }

  async getAgreementEvents(id: string): Promise<AgreementEvent[]> {
    return this.request<AgreementEvent[]>(`/agreements/${id}/events`);
  }

  async listListings(filters: ListingFilters = {}): Promise<Listing[]> {
    const query = this.buildQuery({
      ownerAddress: filters.ownerAddress,
      category: filters.category,
    });
    return this.request<Listing[]>(`/listings${query}`);
  }

  async getListing(id: string): Promise<Listing> {
    return this.request<Listing>(`/listings/${id}`);
  }

  async createListing(input: CreateListingInput): Promise<Listing> {
    return this.request<Listing>("/listings", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async updateListing(id: string, input: UpdateListingInput): Promise<Listing> {
    return this.request<Listing>(`/listings/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  async deleteListing(id: string): Promise<void> {
    await this.request<void>(`/listings/${id}`, { method: "DELETE" });
  }
}
