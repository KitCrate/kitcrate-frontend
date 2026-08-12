import { BASE_FEE, Contract, TransactionBuilder, rpc, xdr } from "@stellar/stellar-sdk";
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
      throw new RentalEscrowTransactionRejectedError(sendResult.status);
    }

    return this.server.pollTransaction(sendResult.hash);
  }
}
