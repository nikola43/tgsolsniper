import { Connection, PublicKey } from "@solana/web3.js";
import { RAYDIUM_LIQUIDITY_PROGRAM_ID_V4 } from "./liquidity";
import { COMMITMENT_LEVEL } from "./constants";


const RPC_ENDPOINT = "https://solana-mainnet.core.chainstack.com/444a9722c51931fbf1f90e396ce78229"
const RPC_WEBSOCKET_ENDPOINT = "wss://api.mainnet-beta.solana.com"

export const connection = new Connection(RPC_ENDPOINT, {
  wsEndpoint: RPC_WEBSOCKET_ENDPOINT
})

const searchInstruction = "initialize2";
const pumpProgramId = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");

async function startConnection(
  programAddress: PublicKey,
  searchInstruction: string,
  callBackFunction: Function
): Promise<void> {
  console.log("Monitoring logs for program:", programAddress.toString());
  connection.onLogs(
    programAddress,
    ({ logs, err, signature }) => {
      if (err) return;
      console.log("Logs found:", logs);
      // if (logs && logs.some((log) => log.includes(searchInstruction))) {
      if (logs) {
        console.log(
          `Signature for ${searchInstruction}:`,
          `https://solscan.io/tx/${signature}`
        );
        callBackFunction(signature);
      }
    },
    "finalized"
  );
}

async function fetchPumpPairs(txId: string) {
  try {
    const tx = await connection.getParsedTransaction(txId, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });

    //@ts-ignore
    const accounts = (tx?.transaction.message.instructions).find(
      (ix) =>
        ix.programId.toBase58() === pumpProgramId.toBase58()
      // @ts-ignore
    ).accounts as PublicKey[];

    if (!accounts) {
      console.log("No accounts found in the transaction.");
      return;
    }

    // console.log("Accounts found:", accounts);
  } catch (error) {
    console.error(error);
  }
}

async function findNewTokens() {
  connection.onProgramAccountChange(
    pumpProgramId,
    async (updatedAccountInfo) => {
      const key = updatedAccountInfo.accountId.toString()
      console.log("New token found:", key);
    }, COMMITMENT_LEVEL)
}

async function findNewTokensV2() {
  startConnection(
    pumpProgramId,
    searchInstruction,
    fetchPumpPairs
  ).catch(console.error);
}

async function main() {
 
}

main().catch(console.error);