import {
  LIQUIDITY_STATE_LAYOUT_V4,
  LiquidityStateV4,
  TOKEN_PROGRAM_ID,
  Token,
  TokenAmount
} from '@raydium-io/raydium-sdk'
import bs58 from 'bs58'
import {
  AUTO_SELL,
  AUTO_SELL_DELAY,
  CHECK_IF_MINT_IS_RENOUNCED,
  COMMITMENT_LEVEL,
  LOG_LEVEL,
  MIN_POOL_SIZE,
  PRIVATE_KEY,
  QUOTE_AMOUNT,
  QUOTE_MINT,
  USE_SNIPE_LIST
} from '../constants'
import {
  RAYDIUM_LIQUIDITY_PROGRAM_ID_V4,
  OPENBOOK_PROGRAM_ID,
  getTokenAccounts
} from '../liquidity'
import {
  MinimalTokenAccountData,
  connection,
  existingLiquidityPools,
  existingTokenAccounts,
  knownTokens,
  snipeList,
  solanaData
} from '../state'
import { Keypair, PublicKey } from '@solana/web3.js'

import { logger } from './logger'
import { MintLayout } from '../types'

function isTokenKnown(tokenMint: PublicKey): boolean {
  return knownTokens.has(tokenMint.toString())
}

function addTokenToList(tokenMint: PublicKey): void {
  knownTokens.add(tokenMint.toString())
}

async function init(): Promise<void> {
  logger.level = LOG_LEVEL
  // get wallet
  solanaData.wallet = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY))
  logger.info(`Wallet Address: ${solanaData.wallet.publicKey}`)

  // get quote mint and amount
  switch (QUOTE_MINT) {
    case 'WSOL': {
      solanaData.quoteToken = Token.WSOL
      solanaData.quoteAmount = new TokenAmount(Token.WSOL, QUOTE_AMOUNT, false)
      solanaData.quoteMinPoolSizeAmount = new TokenAmount(
        solanaData.quoteToken,
        MIN_POOL_SIZE,
        false
      )
      break
    }
    case 'USDC': {
      solanaData.quoteToken = new Token(
        TOKEN_PROGRAM_ID,
        new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
        6,
        'USDC',
        'USDC'
      )
      solanaData.quoteAmount = new TokenAmount(
        solanaData.quoteToken,
        QUOTE_AMOUNT,
        false
      )
      solanaData.quoteMinPoolSizeAmount = new TokenAmount(
        solanaData.quoteToken,
        MIN_POOL_SIZE,
        false
      )
      break
    }
    default: {
      throw new Error(
        `Unsupported quote mint "${QUOTE_MINT}". Supported values are USDC and WSOL`
      )
    }
  }

  logger.info(`Snipe list: ${USE_SNIPE_LIST}`)
  logger.info(`Check mint renounced: ${CHECK_IF_MINT_IS_RENOUNCED}`)
  logger.info(
    `Min pool size: ${
      solanaData.quoteMinPoolSizeAmount.isZero()
        ? 'false'
        : solanaData.quoteMinPoolSizeAmount.toFixed()
    } ${solanaData.quoteToken.symbol}`
  )
  logger.info(
    `Buy amount: ${solanaData.quoteAmount.toFixed()} ${
      solanaData.quoteToken.symbol
    }`
  )
  logger.info(`Auto sell: ${AUTO_SELL}`)
  logger.info(
    `Sell delay: ${AUTO_SELL_DELAY === 0 ? 'false' : AUTO_SELL_DELAY}`
  )

  // check existing wallet for associated token account of quote mint
  const tokenAccounts = await getTokenAccounts(
    connection,
    solanaData.wallet.publicKey,
    COMMITMENT_LEVEL
  )

  for (const ta of tokenAccounts) {
    existingTokenAccounts.set(ta.accountInfo.mint.toString(), <
      MinimalTokenAccountData
    >{
      mint: ta.accountInfo.mint,
      address: ta.pubkey
    })
  }

  const tokenAccount = tokenAccounts.find(
    (acc) =>
      acc.accountInfo.mint.toString() === solanaData.quoteToken.mint.toString()
  )!

  if (!tokenAccount) {
    throw new Error(
      `No ${solanaData.quoteToken.symbol} token account found in wallet: ${solanaData.wallet.publicKey}`
    )
  }
  solanaData.quoteTokenAssociatedAddress = tokenAccount.pubkey
}

export async function checkMintable(
  vault: PublicKey
): Promise<boolean | undefined> {
  try {
    let { data } = (await connection.getAccountInfo(vault)) || {}
    if (!data) {
      return
    }
    const deserialize = MintLayout.decode(data)
    return deserialize.mintAuthorityOption === 0
  } catch (e) {
    logger.debug(e)
    logger.error({ mint: vault }, `Failed to check if mint is renounced`)
  }
}

async function processRaydiumPool(
  poolId: PublicKey,
  poolData: LiquidityStateV4
) {
  console.log('New token detected in pool', poolData.baseMint.toString())
  const isNewBaseToken = !isTokenKnown(poolData.baseMint)
  //const isNewQuoteToken = !isTokenKnown(poolData.quoteMint);
  //console.log({ base: poolData.baseMint, quote: poolData.quoteMint });

  // if (isNewBaseToken) {
  //   console.log(
  //     `New base token detected in pool ${poolId.toString()}: ${poolData.baseMint.toString()}`
  //   );
  //   addTokenToList(poolData.baseMint);
  // }

  // if (isNewQuoteToken) {
  //   console.log(
  //     `New quote token detected in pool ${poolId.toString()}: ${poolData.quoteMint.toString()}`
  //   );
  //   addTokenToList(poolData.quoteMint);
  // }

  const poolCreationTime = parseInt(poolData.poolOpenTime.toString()) // Adjusted to poolOpenTime
  const currentTime = Math.floor(Date.now() / 1000) // Current time in seconds
  const timeSinceCreation = currentTime - poolCreationTime // Time difference in seconds

  // if (timeSinceCreation > 20) {
  //   logger.info(
  //     `Skipping pool ${poolId.toString()}: Not listed in the last 20 seconds. Time since creation: ${timeSinceCreation} seconds.`
  //   );
  //   return;
  // }

  // if (!shouldBuy(poolData.baseMint.toString())) {
  //   return;
  // }

  if (!solanaData.quoteMinPoolSizeAmount.isZero()) {
    const poolSize = new TokenAmount(
      solanaData.quoteToken,
      poolData.swapQuoteInAmount,
      true
    )
    logger.info(
      `Processing pool: ${poolId.toString()} with ${poolSize.toFixed()} ${
        solanaData.quoteToken.symbol
      } in liquidity`
    )

    if (poolSize.lt(solanaData.quoteMinPoolSizeAmount)) {
      logger.warn(
        {
          mint: poolData.baseMint,
          pooled: `${poolSize.toFixed()} ${solanaData.quoteToken.symbol}`
        },
        `Skipping pool, smaller than ${solanaData.quoteMinPoolSizeAmount.toFixed()} ${
          solanaData.quoteToken.symbol
        }`,
        `Swap quote in amount: ${poolSize.toFixed()}`
      )
      return
    }
  }

  if (CHECK_IF_MINT_IS_RENOUNCED) {
    const mintOption = await checkMintable(poolData.baseMint)

    if (mintOption !== true) {
      logger.warn(
        { mint: poolData.baseMint },
        'Skipping, owner can mint tokens!'
      )
      return
    }
  }

  if (isNewBaseToken) {
    console.log(
      `New base token detected in pool ${poolId.toString()}: ${poolData.baseMint.toString()}`
    )
    addTokenToList(poolData.baseMint)

    snipeList.push({
      poolId,
      poolState: poolData
    })
  }
}

export async function findNewTokens(ctc: any) {
  let initDate = new Date()
  const runTimestamp = Math.floor(new Date().getTime() / 1000)
  const raydiumSubscriptionId = connection.onProgramAccountChange(
    RAYDIUM_LIQUIDITY_PROGRAM_ID_V4,
    async (updatedAccountInfo) => {
      // console.log('New token detected in pool')
      initDate = new Date()
      const key = updatedAccountInfo.accountId.toString()
      const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(
        updatedAccountInfo.accountInfo.data
      )
      const poolOpenTime = parseInt(poolState.poolOpenTime.toString())
      const existing = existingLiquidityPools.has(key)
      const poolId = updatedAccountInfo.accountId
      if (poolOpenTime > runTimestamp && !existing) {
        existingLiquidityPools.add(key)
        const _ = processRaydiumPool(poolId, poolState)
      }
    },
    COMMITMENT_LEVEL,
    [
      { dataSize: LIQUIDITY_STATE_LAYOUT_V4.span },
      {
        memcmp: {
          offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('quoteMint'),
          bytes: solanaData.quoteToken.mint.toBase58()
        }
      },
      {
        memcmp: {
          offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('marketProgramId'),
          bytes: OPENBOOK_PROGRAM_ID.toBase58()
        }
      },
      {
        memcmp: {
          offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf('status'),
          bytes: bs58.encode([6, 0, 0, 0, 0, 0, 0, 0])
        }
      }
    ]
  )
}
