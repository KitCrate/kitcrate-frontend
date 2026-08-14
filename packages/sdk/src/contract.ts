import { BASE_FEE, Contract, StrKey, TransactionBuilder, rpc, xdr } from "@stellar/stellar-sdk";
import {
  AccountSignatureRequirement,
  TransactionAuthError,
  requirementFromAccountEntry,
  transactionResultCode,
} from "./txResult";
import {
  addressToScVal,
  i128ToScVal,
  stringToScVal,
  u64ToScVal,
} from "./xdr";

export interface RentalEscrowConfig {
  contractId: string;
  rpcUrl: string;
  networkPassphrase: string;
}

export {
  TransactionAuthError,
  requirementFromAccountEntry,
  transactionResultCode,
} from "./txResult";
export type { AccountSignatureRequirement } from "./txResult";

export interface CreateAgreementParams {
  owner: string;
  renter: string;
  itemRef: string;
  rentalAmount: bigint;
  depositAmount: bigint;
  startTime: bigint;
  endTime: bigint;
  claimWindowSecs: number;
}

export class RentalEscrowTransactionRejectedError extends Error {
  constructor(public readonly status: string) {
    super(`RentalEscrow transaction was rejected before submission: ${status}`);
    this.name = "RentalEscrowTransactionRejectedError";
  }
}

/**
 * Typed client for the RentalEscrow Soroban contract. Every method here builds
 * and simulates an unsigned transaction and returns its XDR; the caller is
 * responsible for getting it signed by the connected wallet (see wallet.ts)
 * and passing the signed XDR to submit(). This client never signs or submits
 * on its own, so a transaction never leaves this SDK without the explicit
 * confirmation step the wallet signature represents.
 */
export class RentalEscrowClient {
  private readonly contract: Contract;
  private readonly server: rpc.Server;
  private readonly networkPassphrase: string;

  constructor(config: RentalEscrowConfig) {
    this.contract = new Contract(config.contractId);
    this.server = new rpc.Server(config.rpcUrl);
    this.networkPassphrase = config.networkPassphrase;
  }

  private async buildInvocation(
    sourceAddress: string,
    method: string,
    args: xdr.ScVal[],
  ): Promise<string> {
    const account = await this.server.getAccount(sourceAddress);
    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(this.contract.call(method, ...args))
      .setTimeout(60)
      .build();

    const prepared = await this.server.prepareTransaction(transaction);
    return prepared.toXDR();
  }

  async buildCreateAgreement(
    sourceAddress: string,
    params: CreateAgreementParams,
  ): Promise<string> {
    return this.buildInvocation(sourceAddress, "create_agreement", [
      addressToScVal(params.owner),
      addressToScVal(params.renter),
      stringToScVal(params.itemRef),
      i128ToScVal(params.rentalAmount),
      i128ToScVal(params.depositAmount),
      u64ToScVal(params.startTime),
      u64ToScVal(params.endTime),
      u64ToScVal(params.claimWindowSecs),
    ]);
  }

  async buildFundAgreement(renterAddress: string, agreementId: bigint): Promise<string> {
    return this.buildInvocation(renterAddress, "fund_agreement", [
      addressToScVal(renterAddress),
      u64ToScVal(agreementId),
    ]);
  }

  async buildStartRental(ownerAddress: string, agreementId: bigint): Promise<string> {
    return this.buildInvocation(ownerAddress, "start_rental", [
      addressToScVal(ownerAddress),
      u64ToScVal(agreementId),
    ]);
  }

  async buildRaiseClaim(
    ownerAddress: string,
    agreementId: bigint,
    claimAmount: bigint,
    evidenceRef: string,
  ): Promise<string> {
    return this.buildInvocation(ownerAddress, "raise_claim", [
      addressToScVal(ownerAddress),
      u64ToScVal(agreementId),
      i128ToScVal(claimAmount),
      stringToScVal(evidenceRef),
    ]);
  }

  /**
   * release_funds is permissionless once the claim window has passed, so the
   * source address here can be any connected wallet, not just the owner or renter.
   */
  async buildReleaseFunds(callerAddress: string, agreementId: bigint): Promise<string> {
    return this.buildInvocation(callerAddress, "release_funds", [u64ToScVal(agreementId)]);
  }

  async buildCancelAgreement(callerAddress: string, agreementId: bigint): Promise<string> {
    return this.buildInvocation(callerAddress, "cancel_agreement", [
      addressToScVal(callerAddress),
      u64ToScVal(agreementId),
    ]);
  }

  /**
   * Submits a wallet-signed transaction envelope and polls the RPC until the
   * transaction reaches a final status.
   */
  async submit(signedTxXdr: string): Promise<rpc.Api.GetTransactionResponse> {
    const transaction = TransactionBuilder.fromXDR(signedTxXdr, this.networkPassphrase);
    const sendResult = await this.server.sendTransaction(transaction);

   if (sendResult.status === "ERROR") {
      console.error("RentalEscrow sendTransaction rejected, full result:", sendResult);
      const resultCode = sendResult.errorResult
        ? transactionResultCode(sendResult.errorResult)
        : null;
      if (resultCode === "txBadAuth") {
        // The most common cause: the signing account is a multisig whose medium
        // threshold exceeds the single connected key's signature weight. The
        // transaction itself was built and signed correctly; the account just
        // needs more signature weight than the wallet provides.
        throw new TransactionAuthError(resultCode);
      }
      throw new RentalEscrowTransactionRejectedError(sendResult.status);
    }

    return this.server.pollTransaction(sendResult.hash);
  }

  /**
   * Reads the signing account's auth configuration to predict whether a single
   * wallet signature can authorize a Soroban invocation from it. A Soroban
   * invocation from an account requires total signature weight meeting the
   * account's MEDIUM threshold; when the connected key's weight falls short,
   * the network rejects the perfectly-built, perfectly-signed transaction with
   * txBadAuth. Returning this before prompting the wallet lets the UI explain
   * the multisig requirement instead of failing after a signature prompt.
   *
   * Returns null when the requirement cannot be determined (transient RPC
   * failure, account has no ledger entry); callers should treat null as
   * "assume the single signature is fine" and proceed.
   */
  async getAccountSignatureRequirement(
    address: string,
  ): Promise<AccountSignatureRequirement | null> {
    try {
      const publicKey = xdr.PublicKey.publicKeyTypeEd25519(
        StrKey.decodeEd25519PublicKey(address),
      );
      const key = xdr.LedgerKey.account(
        new xdr.LedgerKeyAccount({ accountId: publicKey }),
      );
      const result = await this.server.getLedgerEntries(key);
      const entry = result.entries?.[0];
      if (!entry) {
        // Fresh account with no ledger entry: defaults are threshold 0 and a
        // master weight of 1, so a single signature always suffices.
        return { mediumThreshold: 0, signerWeight: 1 };
      }
      return requirementFromAccountEntry(address, entry.val.account());
    } catch {
      return null;
    }
  }
}
