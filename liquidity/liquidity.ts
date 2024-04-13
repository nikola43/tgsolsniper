import { Commitment, Connection, PublicKey } from '@solana/web3.js';
import {
  Liquidity,
  LiquidityPoolKeys,
  Market,
  TokenAccount,
  SPL_ACCOUNT_LAYOUT,
  publicKey,
  struct,
  MAINNET_PROGRAM_ID,
  LiquidityStateV4,
  MARKET_STATE_LAYOUT_V3,
  LiquidityPoolKeysV4,
  jsonInfo2PoolKeys
} from '@raydium-io/raydium-sdk';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { COMMITMENT_LEVEL } from '../constants';
import { MinimalMarketLayoutV3 } from '../market';

export const RAYDIUM_LIQUIDITY_PROGRAM_ID_V4 = MAINNET_PROGRAM_ID.AmmV4;
export const OPENBOOK_PROGRAM_ID = MAINNET_PROGRAM_ID.OPENBOOK_MARKET;

export const MINIMAL_MARKET_STATE_LAYOUT_V3 = struct([
  publicKey('eventQueue'),
  publicKey('bids'),
  publicKey('asks'),
]);

export function createPoolKeys(
  id: PublicKey,
  accountData: LiquidityStateV4,
  minimalMarketLayoutV3: MinimalMarketLayoutV3,
): LiquidityPoolKeys {
  return {
    id,
    baseMint: accountData.baseMint,
    quoteMint: accountData.quoteMint,
    lpMint: accountData.lpMint,
    baseDecimals: accountData.baseDecimal.toNumber(),
    quoteDecimals: accountData.quoteDecimal.toNumber(),
    lpDecimals: 5,
    version: 4,
    programId: RAYDIUM_LIQUIDITY_PROGRAM_ID_V4,
    authority: Liquidity.getAssociatedAuthority({
      programId: RAYDIUM_LIQUIDITY_PROGRAM_ID_V4,
    }).publicKey,
    openOrders: accountData.openOrders,
    targetOrders: accountData.targetOrders,
    baseVault: accountData.baseVault,
    quoteVault: accountData.quoteVault,
    marketVersion: 3,
    marketProgramId: accountData.marketProgramId,
    marketId: accountData.marketId,
    marketAuthority: Market.getAssociatedAuthority({
      programId: accountData.marketProgramId,
      marketId: accountData.marketId,
    }).publicKey,
    marketBaseVault: accountData.baseVault,
    marketQuoteVault: accountData.quoteVault,
    marketBids: minimalMarketLayoutV3.bids,
    marketAsks: minimalMarketLayoutV3.asks,
    marketEventQueue: minimalMarketLayoutV3.eventQueue,
    withdrawQueue: accountData.withdrawQueue,
    lpVault: accountData.lpVault,
    lookupTableAccount: PublicKey.default,
  };
}

export async function getTokenAccounts(
  connection: Connection,
  owner: PublicKey,
  commitment?: Commitment,
) {
  const tokenResp = await connection.getTokenAccountsByOwner(
    owner,
    {
      programId: TOKEN_PROGRAM_ID,
    },
    commitment,
  );

  const accounts: TokenAccount[] = [];
  for (const { pubkey, account } of tokenResp.value) {
    accounts.push({
      pubkey,
      programId: account.owner,
      accountInfo: SPL_ACCOUNT_LAYOUT.decode(account.data),
    });
  }

  return accounts;
}

export async function getRaydiumPoolKey(poolState: LiquidityStateV4, connection: Connection): Promise<LiquidityPoolKeysV4> {
  const associatedPoolKeys = await Liquidity.getAssociatedPoolKeys({
    version: 4,
    marketVersion: 3,
    baseMint: poolState.baseMint,
    quoteMint: poolState.quoteMint,
    baseDecimals: poolState.baseDecimal.toNumber(),
    quoteDecimals: poolState.quoteDecimal.toNumber(),
    marketId: new PublicKey(poolState.marketId),
    programId: MAINNET_PROGRAM_ID.AmmV4,
    marketProgramId: MAINNET_PROGRAM_ID.OPENBOOK_MARKET,
  });

  const marketAccount = await connection.getAccountInfo(poolState.marketId, COMMITMENT_LEVEL);
  if (marketAccount === null) throw Error(' get market info error')
  const marketInfo = MARKET_STATE_LAYOUT_V3.decode(marketAccount.data)

  const  targetPoolInfo  = {   
    id: associatedPoolKeys.id.toString(),
  baseMint: associatedPoolKeys.baseMint.toString(),
  quoteMint: associatedPoolKeys.quoteMint.toString(),
  lpMint: associatedPoolKeys.lpMint.toString(),
  baseDecimals: associatedPoolKeys.baseDecimals,
  quoteDecimals: associatedPoolKeys.quoteDecimals,
  lpDecimals: associatedPoolKeys.lpDecimals,
  version: 4,
  programId: associatedPoolKeys.programId.toString(),
  authority: associatedPoolKeys.authority.toString(),
  openOrders: associatedPoolKeys.openOrders.toString(),
  targetOrders: associatedPoolKeys.targetOrders.toString(),
  baseVault: associatedPoolKeys.baseVault.toString(),
  quoteVault: associatedPoolKeys.quoteVault.toString(),
  withdrawQueue: associatedPoolKeys.withdrawQueue.toString(),
  lpVault: associatedPoolKeys.lpVault.toString(),
  marketVersion: 3,
  marketProgramId: associatedPoolKeys.marketProgramId.toString(),
  marketId: associatedPoolKeys.marketId.toString(),
  marketAuthority: associatedPoolKeys.marketAuthority.toString(),
  marketBaseVault: marketInfo.baseVault.toBase58(),
  marketQuoteVault: marketInfo.quoteVault.toString(),
  marketBids: marketInfo.bids.toString(),
  marketAsks: marketInfo.asks.toString(),
  marketEventQueue: marketInfo.eventQueue.toString(),
  lookupTableAccount: PublicKey.default.toString(),
};

  return jsonInfo2PoolKeys(targetPoolInfo) as LiquidityPoolKeys;;
}

export async function getRaydiumPoolKeyV2(poolState: LiquidityStateV4, connection: Connection): Promise<LiquidityPoolKeysV4> {
  const associatedPoolKeys = await Liquidity.getAssociatedPoolKeys({
    version: 4,
    marketVersion: 3,
    baseMint: poolState.baseMint,
    quoteMint: poolState.quoteMint,
    baseDecimals: poolState.baseDecimal.toNumber(),
    quoteDecimals: poolState.quoteDecimal.toNumber(),
    marketId: new PublicKey(poolState.marketId),
    programId: MAINNET_PROGRAM_ID.AmmV4,
    marketProgramId: MAINNET_PROGRAM_ID.OPENBOOK_MARKET,
  });

  const marketAccount = await connection.getAccountInfo(poolState.marketId, COMMITMENT_LEVEL);
  if (marketAccount === null) throw Error(' get market info error')
  const marketInfo = MARKET_STATE_LAYOUT_V3.decode(marketAccount.data)

  const  targetPoolInfo  = {   
    id: associatedPoolKeys.id.toString(),
  baseMint: associatedPoolKeys.baseMint.toString(),
  quoteMint: associatedPoolKeys.quoteMint.toString(),
  lpMint: associatedPoolKeys.lpMint.toString(),
  baseDecimals: associatedPoolKeys.baseDecimals,
  quoteDecimals: associatedPoolKeys.quoteDecimals,
  lpDecimals: associatedPoolKeys.lpDecimals,
  version: 4,
  programId: associatedPoolKeys.programId.toString(),
  authority: associatedPoolKeys.authority.toString(),
  openOrders: associatedPoolKeys.openOrders.toString(),
  targetOrders: associatedPoolKeys.targetOrders.toString(),
  baseVault: associatedPoolKeys.baseVault.toString(),
  quoteVault: associatedPoolKeys.quoteVault.toString(),
  withdrawQueue: associatedPoolKeys.withdrawQueue.toString(),
  lpVault: associatedPoolKeys.lpVault.toString(),
  marketVersion: 3,
  marketProgramId: associatedPoolKeys.marketProgramId.toString(),
  marketId: associatedPoolKeys.marketId.toString(),
  marketAuthority: associatedPoolKeys.marketAuthority.toString(),
  marketBaseVault: marketInfo.baseVault.toBase58(),
  marketQuoteVault: marketInfo.quoteVault.toString(),
  marketBids: marketInfo.bids.toString(),
  marketAsks: marketInfo.asks.toString(),
  marketEventQueue: marketInfo.eventQueue.toString(),
  lookupTableAccount: PublicKey.default.toString(),
};

  return jsonInfo2PoolKeys(targetPoolInfo) as LiquidityPoolKeys;;
}