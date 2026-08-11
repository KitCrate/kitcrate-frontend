import { RentalEscrowClient } from "@kitcrate/sdk";

const contractId = process.env.NEXT_PUBLIC_CONTRACT_ID;
const rpcUrl = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL;
const networkPassphrase = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE;

export const rentalEscrowClient =
  contractId && rpcUrl && networkPassphrase
    ? new RentalEscrowClient({ contractId, rpcUrl, networkPassphrase })
    : null;

export function requireRentalEscrowClient(): RentalEscrowClient {
  if (!rentalEscrowClient) {
    throw new Error(
      "The RentalEscrow contract is not configured. Set NEXT_PUBLIC_CONTRACT_ID, " +
        "NEXT_PUBLIC_SOROBAN_RPC_URL, and NEXT_PUBLIC_NETWORK_PASSPHRASE.",
    );
  }
  return rentalEscrowClient;
}
