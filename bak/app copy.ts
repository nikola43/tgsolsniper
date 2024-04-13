import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction
} from '@solana/web3.js'
import {
  OPENBOOK_PROGRAM_ID,
  RAYDIUM_LIQUIDITY_PROGRAM_ID_V4,
  createPoolKeys,
  getTokenAccounts
} from '../src/liquidity'
import {
  AUTO_SELL,
  AUTO_SELL_DELAY,
  CHECK_IF_MINT_IS_RENOUNCED,
  COMMITMENT_LEVEL,
  LOG_LEVEL,
  MAX_LENGTH,
  MIN_POOL_SIZE,
  PRIVATE_KEY,
  QUOTE_AMOUNT,
  QUOTE_MINT,
  RPC_ENDPOINT,
  RPC_WEBSOCKET_ENDPOINT,
  SELL_RETRIES_INTERVAL,
  SNIPE_LIST_REFRESH_INTERVAL,
  USE_SNIPE_LIST
} from '../src/constants/constants'
import {
  LIQUIDITY_STATE_LAYOUT_V4,
  Liquidity,
  LiquidityPoolKeys,
  LiquidityStateV4,
  TOKEN_PROGRAM_ID,
  Token,
  TokenAmount
} from '@raydium-io/raydium-sdk'
import { MintLayout, SnipeType } from '../src/types'
import { MinimalMarketLayoutV3, getMinimalMarketV3 } from '../src/market'
import { logger } from '../src/utils'
import bs58 from 'bs58'
import {
  AccountLayout,
  createAssociatedTokenAccountIdempotentInstruction,
  createCloseAccountInstruction,
  getAssociatedTokenAddressSync
} from '@solana/spl-token'

const INSTRUCTION_NAME = 'initialize2'
const BURN_IXN = 'Burn'

const existingLiquidityPools: Set<string> = new Set<string>()

const connection = new Connection(RPC_ENDPOINT, {
  wsEndpoint: RPC_WEBSOCKET_ENDPOINT
})

export interface MinimalTokenAccountData {
  mint: PublicKey
  address: PublicKey
  poolKeys?: LiquidityPoolKeys
  market?: MinimalMarketLayoutV3
  buyPricePerToken?: number // Optional property to store the buy price per token
}

const existingTokenAccounts: Map<string, MinimalTokenAccountData> = new Map<
  string,
  MinimalTokenAccountData
>()

let wallet: Keypair
let quoteToken: Token
let quoteTokenAssociatedAddress: PublicKey
let quoteAmount: TokenAmount
let quoteMinPoolSizeAmount: TokenAmount

let snipeList = <SnipeType[]>[]
let buyList: {
  baseMint: PublicKey
  buyPricePerToken: number
  poolId: PublicKey
}[] = []

const knownTokens = new Set<string>()

async function init(): Promise<void> {
  logger.level = LOG_LEVEL
  // get wallet
  wallet = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY))
  logger.info(`Wallet Address: ${wallet.publicKey}`)

  // get quote mint and amount
  switch (QUOTE_MINT) {
    case 'WSOL': {
      quoteToken = Token.WSOL
      quoteAmount = new TokenAmount(Token.WSOL, QUOTE_AMOUNT, false)
      quoteMinPoolSizeAmount = new TokenAmount(quoteToken, MIN_POOL_SIZE, false)
      break
    }
    case 'USDC': {
      quoteToken = new Token(
        TOKEN_PROGRAM_ID,
        new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
        6,
        'USDC',
        'USDC'
      )
      quoteAmount = new TokenAmount(quoteToken, QUOTE_AMOUNT, false)
      quoteMinPoolSizeAmount = new TokenAmount(quoteToken, MIN_POOL_SIZE, false)
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
      quoteMinPoolSizeAmount.isZero()
        ? 'false'
        : quoteMinPoolSizeAmount.toFixed()
    } ${quoteToken.symbol}`
  )
  logger.info(`Buy amount: ${quoteAmount.toFixed()} ${quoteToken.symbol}`)
  logger.info(`Auto sell: ${AUTO_SELL}`)
  logger.info(
    `Sell delay: ${AUTO_SELL_DELAY === 0 ? 'false' : AUTO_SELL_DELAY}`
  )

  // check existing wallet for associated token account of quote mint
  const tokenAccounts = await getTokenAccounts(
    connection,
    wallet.publicKey,
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
    (acc) => acc.accountInfo.mint.toString() === quoteToken.mint.toString()
  )!

  if (!tokenAccount) {
    throw new Error(
      `No ${quoteToken.symbol} token account found in wallet: ${wallet.publicKey}`
    )
  }
  quoteTokenAssociatedAddress = tokenAccount.pubkey
}

function isTokenKnown(tokenMint: PublicKey): boolean {
  return knownTokens.has(tokenMint.toString())
}

// Function to add a new token to the list of known tokens
function addTokenToList(tokenMint: PublicKey): void {
  knownTokens.add(tokenMint.toString())
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

// function shouldBuy(key: string): boolean {
//   for (const snipe of snipeList) {
//     if (snipe.poolState.baseMint.toBase58() === key) return false;
//   }
//   return true;
// }

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

  if (!quoteMinPoolSizeAmount.isZero()) {
    const poolSize = new TokenAmount(
      quoteToken,
      poolData.swapQuoteInAmount,
      true
    )
    logger.info(
      `Processing pool: ${poolId.toString()} with ${poolSize.toFixed()} ${
        quoteToken.symbol
      } in liquidity`
    )

    if (poolSize.lt(quoteMinPoolSizeAmount)) {
      logger.warn(
        {
          mint: poolData.baseMint,
          pooled: `${poolSize.toFixed()} ${quoteToken.symbol}`
        },
        `Skipping pool, smaller than ${quoteMinPoolSizeAmount.toFixed()} ${
          quoteToken.symbol
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

async function startConnection(
  programAddress: PublicKey,
  searchInstruction: string,
  callBackFunction: Function
): Promise<void> {
  console.log('Monitoring logs for program:', programAddress.toString())
  connection.onLogs(
    programAddress,
    ({ logs, err, signature }) => {
      if (err) return
      if (logs && logs.some((log) => log.includes(searchInstruction))) {
        // console.log(
        //   `Signature for ${searchInstruction}:`,
        //   `https://explorer.solana.com/tx/${signature}`
        // );
        callBackFunction(signature)
      }
    },
    'finalized'
  )
}

async function fetchRaydiumMints(txId: string) {
  try {
    const tx = await connection.getParsedTransaction(txId, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed'
    })

    //@ts-ignore
    const accounts = (tx?.transaction.message.instructions).find(
      (ix) =>
        ix.programId.toBase58() === RAYDIUM_LIQUIDITY_PROGRAM_ID_V4.toBase58()
      // @ts-ignore
    ).accounts as PublicKey[]

    if (!accounts) {
      console.log('No accounts found in the transaction.')
      return
    }

    const poolId = accounts[4]

    const info = await connection.getAccountInfo(poolId)
    if (!!info) {
      const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(info.data)
      const _ = processRaydiumPool(poolId, poolState)
    }
  } catch {
    console.log('Error fetching transaction:', txId)
    return
  }
}

async function listenBurn(txId: string) {
  try {
    const tx = await connection.getParsedTransaction(txId, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed'
    })
    const innerInstructions = tx?.meta?.innerInstructions
    if (!!innerInstructions) {
      for (const ixn of innerInstructions) {
        for (const instruction of ixn.instructions) {
          // @ts-ignore
          if (
            // @ts-ignore
            !!instruction?.parsed &&
            // @ts-ignore
            instruction?.parsed?.type === 'burn' &&
            instruction.programId.equals(TOKEN_PROGRAM_ID)
          ) {
            // @ts-ignore
            const mint = instruction.parsed.info.mint
            for (const sniper of snipeList) {
              if (sniper.poolState.lpMint.toBase58() === mint) {
                // buy here
                buy(sniper.poolId, sniper.poolState)
              }
            }
          }
        }
      }
    }
  } catch {
    console.log('Error fetching transaction:', txId)
    return
  }
}

function saveTokenAccount(mint: PublicKey, accountData: MinimalMarketLayoutV3) {
  const ata = getAssociatedTokenAddressSync(mint, wallet.publicKey)
  const tokenAccount = <MinimalTokenAccountData>{
    address: ata,
    mint: mint,
    market: <MinimalMarketLayoutV3>{
      bids: accountData.bids,
      asks: accountData.asks,
      eventQueue: accountData.eventQueue
    }
  }
  existingTokenAccounts.set(mint.toString(), tokenAccount)
  return tokenAccount
}

async function findNewTokensV2() {
  startConnection(
    RAYDIUM_LIQUIDITY_PROGRAM_ID_V4,
    INSTRUCTION_NAME,
    fetchRaydiumMints
  ).catch(console.error)
}

async function findNewTokens() {
  let initDate = new Date()
  const runTimestamp = Math.floor(new Date().getTime() / 1000)
  const raydiumSubscriptionId = connection.onProgramAccountChange(
    RAYDIUM_LIQUIDITY_PROGRAM_ID_V4,
    async (updatedAccountInfo) => {
      initDate = new Date()
      const key = updatedAccountInfo.accountId.toString()
      const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(
        updatedAccountInfo.accountInfo.data
      )
      const poolOpenTime = parseInt(poolState.poolOpenTime.toString())
      const existing = existingLiquidityPools.has(key)
      const poolId = updatedAccountInfo.accountId
      // console.log({
      //   runTimestamp,
      //   key,
      //   poolOpenTime,
      //   existing,
      //   poolId
      // })

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
          bytes: quoteToken.mint.toBase58()
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

async function getTokenAmountAfterBuy(mint: PublicKey): Promise<number> {
  let tokenAmountAfterBuy = 0
  logger.info({ mint: mint.toString() }, 'Checking token accounts after buy...')
  const tokenAccountsAfterBuy = await connection.getTokenAccountsByOwner(
    wallet.publicKey,
    { mint }
  )
  if (tokenAccountsAfterBuy.value.length > 0) {
    const accountInfoAfterBuy = tokenAccountsAfterBuy.value[0].account.data
    const decodedDataAfterBuy = AccountLayout.decode(accountInfoAfterBuy)
    tokenAmountAfterBuy = Number(decodedDataAfterBuy.amount)
  }
  return tokenAmountAfterBuy
}

async function buy(
  accountId: PublicKey,
  accountData: LiquidityStateV4
): Promise<void> {
  try {
    let tokenAccount = existingTokenAccounts.get(
      accountData.baseMint.toString()
    )

    if (!tokenAccount) {
      logger.info(
        { mint: accountData.baseMint.toString() },
        'Fetching market data for new token account.'
      )
      const market = await getMinimalMarketV3(
        connection,
        accountData.marketId,
        COMMITMENT_LEVEL
      )
      tokenAccount = saveTokenAccount(accountData.baseMint, market)
    }

    tokenAccount.poolKeys = createPoolKeys(
      accountId,
      accountData,
      tokenAccount.market!
    )

    logger.info(
      { mint: accountData.baseMint.toString() },
      'Preparing buy transaction...'
    )
    const { innerTransaction } = Liquidity.makeSwapFixedInInstruction(
      {
        poolKeys: tokenAccount.poolKeys,
        userKeys: {
          tokenAccountIn: quoteTokenAssociatedAddress,
          tokenAccountOut: tokenAccount.address,
          owner: wallet.publicKey
        },
        amountIn: quoteAmount.raw,
        minAmountOut: 0
      },
      tokenAccount.poolKeys.version
    )

    const latestBlockhash = await connection.getLatestBlockhash({
      commitment: COMMITMENT_LEVEL
    })
    const messageV0 = new TransactionMessage({
      payerKey: wallet.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 421197 }),
        ComputeBudgetProgram.setComputeUnitLimit({ units: 101337 }),
        createAssociatedTokenAccountIdempotentInstruction(
          wallet.publicKey,
          tokenAccount.address,
          wallet.publicKey,
          accountData.baseMint
        ),
        ...innerTransaction.instructions
      ]
    }).compileToV0Message()

    const transaction = new VersionedTransaction(messageV0)
    transaction.sign([wallet])
    const tx = await connection.sendTransaction(transaction)

    if (!!tx) {
      let tokenAmountAfterBuy = await getTokenAmountAfterBuy(
        accountData.baseMint
      )

      const quoteAmountNumber = Number(quoteAmount.raw.toString())
      const buyPricePerToken =
        tokenAmountAfterBuy > 0 ? quoteAmountNumber / tokenAmountAfterBuy : 0
      logger.info(
        { mint: accountData.baseMint, buyPricePerToken },
        'Buy price per token calculated and logged.'
      )
      buyList.push({
        baseMint: accountData.baseMint,
        buyPricePerToken,
        poolId: accountId
      })
      if (tokenAccount) {
        tokenAccount.buyPricePerToken = buyPricePerToken
        existingTokenAccounts.set(accountData.baseMint.toString(), tokenAccount)
      }
    } else {
      logger.error(
        { mint: accountData.baseMint },
        'Buy transaction failed to confirm after maximum retries and timeout.'
      )
    }
  } catch (e) {
    logger.error(
      { mint: accountData.baseMint, error: e },
      'Exception during buy operation.'
    )
  } finally {
    logger.info('Pool fetching resumed after buy operation.')
  }
}

function removeBuyList(mint: PublicKey) {
  const index = buyList.findIndex((item) => item.baseMint.equals(mint))
  if (index !== -1) {
    buyList.splice(index, 1)
  }
}

async function sell(mint: PublicKey) {
  const mintStr = mint.toString()

  logger.info({ mint: mintStr }, 'Attempting to sell token...')
  try {
    const tokenAccount = existingTokenAccounts.get(mintStr)
    if (!tokenAccount || !tokenAccount.poolKeys) {
      logger.warn(
        { mint: mintStr },
        'Cannot sell: Token account missing or pool keys missing.'
      )
      return
    }

    const tokenAccounts = await connection.getTokenAccountsByOwner(
      wallet.publicKey,
      { mint }
    )
    if (tokenAccounts.value.length === 0) {
      logger.warn(
        { mint: mintStr },
        'Token account not found. Waiting for 2 seconds before retrying...'
      )
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }

    const tokenAccountInfo = tokenAccounts.value[0]
    const tokenAccountData = AccountLayout.decode(tokenAccountInfo.account.data)
    const tokenAccountBalance = Number(tokenAccountData.amount)

    if (tokenAccountBalance === 0) {
      logger.info(
        { mint: mintStr },
        'Token account balance is zero. Token has already been sold.'
      )
      removeBuyList(mint)
      return
    }
    logger.info({ mint: mintStr }, `Selling attempt`)

    const { innerTransaction } = Liquidity.makeSwapFixedInInstruction(
      {
        poolKeys: tokenAccount.poolKeys,
        userKeys: {
          tokenAccountOut: quoteTokenAssociatedAddress,
          tokenAccountIn: tokenAccount.address,
          owner: wallet.publicKey
        },
        amountIn: tokenAccountBalance,
        minAmountOut: 0
      },
      tokenAccount.poolKeys.version
    )

    const latestBlockhash = await connection.getLatestBlockhash({
      commitment: COMMITMENT_LEVEL
    })
    const messageV0 = new TransactionMessage({
      payerKey: wallet.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 421197 }),
        ComputeBudgetProgram.setComputeUnitLimit({ units: 101337 }),
        ...innerTransaction.instructions,
        createCloseAccountInstruction(
          tokenAccount.address,
          wallet.publicKey,
          wallet.publicKey
        )
      ]
    }).compileToV0Message()

    const transaction = new VersionedTransaction(messageV0)
    transaction.sign([wallet])

    logger.info(
      {
        mint: mintStr,
        amountIn: tokenAccountBalance.toString(),
        transactionSize: transaction.serialize().length,
        feePayer: wallet.publicKey.toBase58()
      },
      'Sell transaction details'
    )
    const tx = await connection.sendTransaction(transaction)
    if (!!tx) {
      const index = buyList.findIndex((item) => item.baseMint.equals(mint))
      if (index !== -1) {
        buyList.splice(index, 1)
      }
    }
  } catch (e) {
    logger.debug(e)
  }
}

async function autoSell() {
  setInterval(async () => {
    for await (const token of buyList) {
      const info = await connection.getAccountInfo(token.poolId)
      if (!!info) {
        const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(info.data)
        const price = poolState.swapQuoteOutAmount / poolState.swapQuoteInAmount
        if (price > (1 + 0.5) * token.buyPricePerToken) {
          sell(token.baseMint)
        }
      }
    }
  }, SELL_RETRIES_INTERVAL)
}

const runBot = async () => {
  await init()
  findNewTokensV2()
  // startConnection(RAYDIUM_LIQUIDITY_PROGRAM_ID_V4, BURN_IXN, listenBurn).catch(
  //   console.error
  // );
  autoSell()
}

runBot()
