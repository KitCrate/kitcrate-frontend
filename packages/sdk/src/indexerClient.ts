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

/**
 * Raw agreement row as served by kitcrate-backend's /agreements endpoints,
 * which return database rows verbatim (snake_case columns from the
 * `agreements` table). Numeric/BIGINT columns arrive as strings over JSON
 * (node-postgres serializes NUMERIC and BIGINT as strings), so mapAgreement()
 * is responsible for any coercion. Columns the frontend does not use
 * (created_ledger, updated_ledger) are intentionally omitted here.
 */
interface AgreementRow {
  id: string | number;
  owner: string;
  renter: string;
  item_ref: string;
  rental_amount: string | number;
  deposit_amount: string | number;
  start_time: string | number;
  end_time: string | number;
  claim_window_secs: string | number;
  status: AgreementStatus;
  created_at: string | number;
  updated_at: string;
}

/**
 * Raw agreement-event row as served by GET /agreements/:id/events, which
 * selects ledger_seq, event_index, topic, data and processed_at. There is no
 * dedicated event id, tx hash, or agreement_id in that projection.
 */
interface AgreementEventRow {
  ledger_seq: string | number;
  event_index: string | number;
  topic: string;
  data: Record<string, unknown>;
  processed_at: string;
}

export interface AgreementFilters {
  owner?: string;
  renter?: string;
  status?: AgreementStatus;
}

/**
 * Listing shape the frontend consumes. The kitcrate-backend repo owns the
 * `listings` schema and serves raw database rows (snake_case), so responses do
 * not arrive in this shape, mapListing() bridges the backend row (ListingRow)
 * to this type. `category` has no backend column yet and is a frontend-only
 * concept (see mapListing).
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
  /**
   * True when an agreement in an "occupied" state (Funded, Active, Disputed,
   * or Resolved) currently exists against this listing, i.e. money has moved
   * and the item is committed. Computed server-side by the indexer; the item
   * frees up again (back to false) once that agreement is Cancelled or
   * Completed. Used to hide committed items from the "Available now" browse
   * list while keeping the detail page reachable.
   */
  currentlyBooked: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Raw listing row as served by kitcrate-backend's /listings endpoints
 * (snake_case columns from the `listings` table). daily_rate and deposit are
 * NUMERIC and arrive as strings over JSON; photo_urls may be absent on rows
 * predating the column default. There is no category column. `currently_booked`
 * is a computed boolean the backend adds to each row (not a stored column).
 */
interface ListingRow {
  id: string;
  owner: string;
  title: string;
  description: string;
  photo_urls?: string[] | null;
  location: string;
  daily_rate: string | number;
  deposit: string | number;
  currently_booked?: boolean;
  created_at: string;
  updated_at: string;
}

// `currentlyBooked` is a read-only field the backend computes; it is never
// part of a create/update payload.
export type CreateListingInput = Omit<
  Listing,
  "id" | "currentlyBooked" | "createdAt" | "updatedAt"
>;
export type UpdateListingInput = Partial<CreateListingInput>;

/**
 * The three listing-mutation actions the indexer's SEP-53 challenge
 * system recognizes (kitcrate-backend's auth/message.ts). Each challenge
 * is single-use and bound to exactly one of these plus a specific
 * listing id, so it can never be replayed against a different mutation.
 */
export type ListingAuthAction = "create_listing" | "update_listing" | "delete_listing";

/**
 * A one-shot SEP-53 challenge issued by POST /auth/challenge, ready to be
 * signed by the wallet that controls the claimed address.
 */
export interface ListingChallenge {
  nonce: string;
  message: string;
  expiresAt: string;
}

/**
 * Proves control of `address` for exactly one listing mutation. `sign` is
 * injected by the caller (see wallet.ts's signMessage, wrapping
 * Freighter's SEP-53 support) rather than hardcoded here, mirroring how
 * RentalEscrowClient never signs transactions itself (see contract.ts) —
 * IndexerClient builds and transmits, the caller's wallet signs.
 */
export interface ListingSigner {
  address: string;
  sign: (message: string) => Promise<string>;
}

export interface ListingFilters {
  ownerAddress?: string;
  category?: string;
}

export class IndexerApiError extends Error {
  // Explicit fields + assignment, not TS constructor parameter properties:
  // Node's native (strip-only) TypeScript execution — used by this
  // package's `node --test test/*.test.ts` — cannot transform parameter
  // properties, only erase type annotations, so that shorthand fails at
  // module load with ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX under that runner.
  readonly status: number;
  readonly path: string;

  constructor(message: string, status: number, path: string) {
    super(message);
    this.name = "IndexerApiError";
    this.status = status;
    this.path = path;
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

  /**
   * The indexer always answers JSON, so an HTML response means the request
   * never reached it: the base URL is wrong or points at a server that
   * serves pages (e.g. the frontend itself), or the indexer is down and a
   * proxy/dev server answered instead. Surface that as one clear message
   * rather than leaking raw HTML into error text.
   */
  private unreachableError(status: number, path: string): IndexerApiError {
    return new IndexerApiError(
      "Could not reach the indexer service. Check that it's running and NEXT_PUBLIC_INDEXER_API_URL is set correctly.",
      status,
      path,
    );
  }

  private isHtmlBody(body: string): boolean {
    const trimmed = body.trimStart();
    return (
      trimmed.startsWith("<!doctype html") ||
      trimmed.startsWith("<html") ||
      /<title[^>]*>/i.test(trimmed)
    );
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

    if ((response.headers.get("content-type") ?? "").includes("text/html")) {
      throw this.unreachableError(response.status, path);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      if (this.isHtmlBody(body)) {
        throw this.unreachableError(response.status, path);
      }
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

  /**
   * Translate a raw backend listing row into the Listing shape the frontend
   * uses. The backend serves database rows verbatim, so field names differ
   * (owner -> ownerAddress, daily_rate -> dailyRentalAmount, etc.) and the
   * NUMERIC amounts are coerced to strings.
   *
   * `category` is not currently persisted (the backend has no category
   * column), so it defaults to "Other" on read.
   */
  private mapListing(row: ListingRow): Listing {
    return {
      id: row.id,
      ownerAddress: row.owner,
      title: row.title,
      description: row.description,
      category: "Other",
      dailyRentalAmount: String(row.daily_rate),
      depositAmount: String(row.deposit),
      imageUrls: row.photo_urls ?? [],
      location: row.location,
      currentlyBooked: row.currently_booked ?? false,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Translate a raw backend agreement row into the Agreement shape the
   * frontend uses (item_ref -> itemRef, rental_amount -> rentalAmount, and so
   * on). claim_window_secs is coerced to a number because the UI does
   * arithmetic on it; the BIGINT id/time columns are kept as strings.
   *
   * `contractId` has no backend column: agreements are keyed by their numeric
   * on-chain `id` and no separate contract id is persisted, so it defaults to
   * "" here (nothing in the app currently reads it).
   */
  private mapAgreement(row: AgreementRow): Agreement {
    return {
      id: String(row.id),
      contractId: "",
      owner: row.owner,
      renter: row.renter,
      itemRef: row.item_ref,
      rentalAmount: String(row.rental_amount),
      depositAmount: String(row.deposit_amount),
      startTime: String(row.start_time),
      endTime: String(row.end_time),
      claimWindowSecs: Number(row.claim_window_secs),
      status: row.status,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  /**
   * Translate a raw agreement-event row into the AgreementEvent shape. The
   * events endpoint exposes no dedicated event id or tx hash, so `id` is
   * synthesized from (ledger_seq, event_index) for a stable React key,
   * `txHash` defaults to "", and `agreementId` (the request path param, not
   * part of the row projection) defaults to "". `type` carries the raw event
   * topic and `createdAt` comes from processed_at.
   */
  private mapAgreementEvent(row: AgreementEventRow): AgreementEvent {
    return {
      id: `${row.ledger_seq}-${row.event_index}`,
      agreementId: "",
      type: row.topic as AgreementStatus,
      txHash: "",
      createdAt: String(row.processed_at),
      data: row.data,
    };
  }

  async getAgreement(id: string): Promise<Agreement> {
    const row = await this.request<AgreementRow>(`/agreements/${id}`);
    return this.mapAgreement(row);
  }

  async listAgreements(filters: AgreementFilters = {}): Promise<Agreement[]> {
    const query = this.buildQuery({
      owner: filters.owner,
      renter: filters.renter,
      status: filters.status,
    });
    const rows = await this.request<AgreementRow[]>(`/agreements${query}`);
    return rows.map((row) => this.mapAgreement(row));
  }

  async getAgreementEvents(id: string): Promise<AgreementEvent[]> {
    const rows = await this.request<AgreementEventRow[]>(`/agreements/${id}/events`);
    return rows.map((row) => this.mapAgreementEvent(row));
  }

  async listListings(filters: ListingFilters = {}): Promise<Listing[]> {
    // The backend filters listings by the `owner` query param only (see
    // kitcrate-backend listings.ts). There is no category column yet, so a
    // category filter cannot be honored server-side and is not sent.
    const query = this.buildQuery({
      owner: filters.ownerAddress,
    });
    const rows = await this.request<ListingRow[]>(`/listings${query}`);
    return rows.map((row) => this.mapListing(row));
  }

  async getListing(id: string): Promise<Listing> {
    const row = await this.request<ListingRow>(`/listings/${id}`);
    return this.mapListing(row);
  }

  /**
   * Requests a one-shot SEP-53 challenge for `signer.address` to perform
   * `action` on `listingId`. Exposed directly (not only as a private
   * helper) so a caller that wants to prompt the wallet ahead of time —
   * for example to show a distinct "confirm in your wallet" UI state
   * before the network request that consumes it — can do so.
   */
  async requestListingChallenge(
    signer: Pick<ListingSigner, "address">,
    action: ListingAuthAction,
    listingId: string,
  ): Promise<ListingChallenge> {
    return this.request<ListingChallenge>("/auth/challenge", {
      method: "POST",
      body: JSON.stringify({ address: signer.address, action, listingId }),
    });
  }

  /** Requests a challenge, has the signer sign it, and returns the three
   * headers the listings routes require. A fresh challenge is requested
   * for every call — challenges are single-use, so headers built here can
   * never be reused for a second request. */
  private async listingAuthHeaders(
    signer: ListingSigner,
    action: ListingAuthAction,
    listingId: string,
  ): Promise<Record<string, string>> {
    const challenge = await this.requestListingChallenge(signer, action, listingId);
    const signature = await signer.sign(challenge.message);
    return {
      "X-Kitcrate-Address": signer.address,
      "X-Kitcrate-Nonce": challenge.nonce,
      "X-Kitcrate-Signature": signature,
    };
  }

  async createListing(input: CreateListingInput, signer: ListingSigner): Promise<Listing> {
    const id = crypto.randomUUID();
    const payload = {
      id,
      owner: input.ownerAddress,
      title: input.title,
      description: input.description,
      photo_urls: input.imageUrls,
      location: input.location,
      daily_rate: Number(input.dailyRentalAmount),
      deposit: Number(input.depositAmount),
    };
    const headers = await this.listingAuthHeaders(signer, "create_listing", id);
    const row = await this.request<ListingRow>("/listings", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    return this.mapListing(row);
  }

  async updateListing(
    id: string,
    input: UpdateListingInput,
    signer: ListingSigner,
  ): Promise<Listing> {
    // The backend exposes PUT /listings/:id (a full replace), not PATCH, and
    // it reads the same snake_case columns with numeric daily_rate/deposit as
    // the POST route. So the outbound body needs the same field-name
    // translation createListing() already does. Note: because the backend PUT
    // is a full replace, it requires owner/title/location/daily_rate/deposit to
    // all be present, a partial input will be rejected server-side with 400.
    const payload: Record<string, unknown> = {};
    if (input.ownerAddress !== undefined) payload.owner = input.ownerAddress;
    if (input.title !== undefined) payload.title = input.title;
    if (input.description !== undefined) payload.description = input.description;
    if (input.imageUrls !== undefined) payload.photo_urls = input.imageUrls;
    if (input.location !== undefined) payload.location = input.location;
    if (input.dailyRentalAmount !== undefined)
      payload.daily_rate = Number(input.dailyRentalAmount);
    if (input.depositAmount !== undefined) payload.deposit = Number(input.depositAmount);
    // category is intentionally not sent: the backend has no category column.
    const headers = await this.listingAuthHeaders(signer, "update_listing", id);
    const row = await this.request<ListingRow>(`/listings/${id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
    });
    return this.mapListing(row);
  }

  async deleteListing(id: string, signer: ListingSigner): Promise<void> {
    const headers = await this.listingAuthHeaders(signer, "delete_listing", id);
    await this.request<void>(`/listings/${id}`, { method: "DELETE", headers });
  }
}
