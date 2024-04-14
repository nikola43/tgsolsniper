import {
  LIQUIDITY_STATE_LAYOUT_V4,
  Liquidity,
  LiquidityPoolKeysV4,
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
  NETWORK,
  PRIVATE_KEY,
  QUOTE_AMOUNT,
  QUOTE_MINT,
  USE_SNIPE_LIST
} from '../constants'
import {
  RAYDIUM_LIQUIDITY_PROGRAM_ID_V4,
  OPENBOOK_PROGRAM_ID,
  getTokenAccounts,
  getRaydiumPoolKey
} from '../liquidity'
import {
  MinimalTokenAccountData,
  buyList,
  connection,
  existingLiquidityPools,
  existingTokenAccounts,
  knownTokens,
  snipeList,
  solanaData
} from '../state'
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction
} from '@solana/web3.js'

import { logger } from './logger'
import { MintLayout } from '../types'
import { getTokenMetadata } from '../metadata'
import {
  AccountLayout,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync
} from '@solana/spl-token'
import { MinimalMarketLayoutV3, getMinimalMarketV3 } from '../market'
import RaydiumSwap from '../classes/RaydiumSwap'
import { id } from 'ethers'

function isTokenKnown(tokenMint: PublicKey): boolean {
  return knownTokens.has(tokenMint.toString())
}

function addTokenToList(tokenMint: PublicKey): void {
  knownTokens.add(tokenMint.toString())
}

export async function init(): Promise<void> {
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

  solanaData.raydiumSwap = new RaydiumSwap(connection, PRIVATE_KEY)
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

const abreviateAddress = (str: string) => {
  return str.slice(0, 4) + '...' + str.slice(str.length - 4)
}

export async function processRaydiumPool(
  ctx: any,
  id: PublicKey,
  poolState: LiquidityStateV4
) {
  // if (!shouldBuy(poolState.baseMint.toString())) {
  //   return;
  // }

  const poolSize = new TokenAmount(
    solanaData.quoteToken,
    poolState.swapQuoteInAmount,
    true
  )
  logger.info(
    `Processing pool: ${id.toString()} with ${poolSize.toFixed()} ${
      solanaData.quoteToken.symbol
    } in liquidity`
  )

  console.log({
    poolState
  })

  // if (!quoteMinPoolSizeAmount.isZero()) {

  if (poolSize.lt(solanaData.quoteMinPoolSizeAmount)) {
    logger.warn(
      {
        mint: poolState.baseMint,
        pooled: `${poolSize.toFixed()} ${solanaData.quoteToken.symbol}`
      },
      `Skipping pool, smaller than ${solanaData.quoteMinPoolSizeAmount.toFixed()} ${
        solanaData.quoteToken.symbol
      }`,
      `Swap quote in amount: ${poolSize.toFixed()}`
    )
    return
  }

  // if (CHECK_IF_MINT_IS_RENOUNCED) {
  //   const mintOption = await checkMintable(poolState.baseMint);

  //   if (mintOption !== true) {
  //     logger.warn({ mint: poolState.baseMint }, 'Skipping, owner can mint tokens!');
  //     return;
  //   }
  // }

  try {
    //let poolInfo = await raydiumSwap.findRaydiumPoolInfo(poolState.baseMint.toBase58(), poolState.quoteMint.toBase58());
    //let poolInfo = await formatAmmKeysById(id.toBase58(), connection);
    const poolKeys = await getRaydiumPoolKey(poolState, connection)

    console.log({
      poolState,
      poolKeys
    })

    //await buy(id, poolState, poolInfo!);
    await buy(
      ctx,
      solanaData.wallet,
      id,
      solanaData.quoteTokenAssociatedAddress,
      solanaData.quoteAmount,
      poolState,
      poolKeys
    )
    const tokenMetadata = await getTokenMetadata(poolState.baseMint, connection)
    ctx.reply(
      'New token: ' +
        tokenMetadata?.symbol +
        ' ' +
        abreviateAddress(poolState.baseMint.toBase58())
    )
  } catch (e) {
    console.log(e)
    //logger.debug(e);
    // logger.error({ mint: poolState.baseMint }, `Failed to process market`);
  }
}

/*
async function processRaydiumPool(
  ctx: any,
  poolId: PublicKey,
  poolState: LiquidityStateV4
) {
  console.log('New token detected in pool', poolState.baseMint.toString())
  const baseMint = poolState.baseMint

  const tokenMetadata = await getTokenMetadata(baseMint, connection)
  ctx.reply(
    'New token: ' +
      tokenMetadata?.symbol +
      ' ' +
      abreviateAddress(baseMint.toBase58())
  )
  const isNewBaseToken = !isTokenKnown(poolState.baseMint)
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

  const poolCreationTime = parseInt(poolState.poolOpenTime.toString()) // Adjusted to poolOpenTime
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

  // if (!solanaData.quoteMinPoolSizeAmount.isZero()) {
  //   const poolSize = new TokenAmount(
  //     solanaData.quoteToken,
  //     poolState.swapQuoteInAmount,
  //     true
  //   )
  //   logger.info(
  //     `Processing pool: ${poolId.toString()} with ${poolSize.toFixed()} ${
  //       solanaData.quoteToken.symbol
  //     } in liquidity`
  //   )

  //   if (poolSize.lt(solanaData.quoteMinPoolSizeAmount)) {
  //     logger.warn(
  //       {
  //         mint: poolState.baseMint,
  //         pooled: `${poolSize.toFixed()} ${solanaData.quoteToken.symbol}`
  //       },
  //       `Skipping pool, smaller than ${solanaData.quoteMinPoolSizeAmount.toFixed()} ${
  //         solanaData.quoteToken.symbol
  //       }`,
  //       `Swap quote in amount: ${poolSize.toFixed()}`
  //     )
  //     return
  //   }
  // }

  // if (CHECK_IF_MINT_IS_RENOUNCED) {
  //   const mintOption = await checkMintable(poolState.baseMint)

  //   if (mintOption !== true) {
  //     logger.warn(
  //       { mint: poolState.baseMint },
  //       'Skipping, owner can mint tokens!'
  //     )
  //     return
  //   }
  // }

  if (isNewBaseToken) {
    console.log(
      `New base token detected in pool ${poolId.toString()}: ${poolState.baseMint.toString()}`
    )
    addTokenToList(poolState.baseMint)

    // snipeList.push({
    //   poolId,
    //   poolState: poolData
    // })

    try {
      //let poolInfo = await raydiumSwap.findRaydiumPoolInfo(poolState.baseMint.toBase58(), poolState.quoteMint.toBase58());
      //let poolInfo = await formatAmmKeysById(id.toBase58(), connection);
      const poolKeys = await getRaydiumPoolKey(poolState, connection)

      console.log({
        wallet: solanaData.wallet,
        poolId,
        quoteTokenAssociatedAddress: solanaData.quoteTokenAssociatedAddress,
        quoteAmount: solanaData.quoteAmount,
        poolState,
        poolKeys
      })

      await buy(
        ctx,
        solanaData.wallet,
        poolId,
        solanaData.quoteTokenAssociatedAddress,
        solanaData.quoteAmount,
        poolState,
        poolKeys
      )
      //  await buy(ctx, id, poolState, poolInfo!)
    } catch (e) {
      console.log(e)
      //logger.debug(e);
      // logger.error({ mint: poolState.baseMint }, `Failed to process market`);
    }
  }
}
*/

export async function findNewTokens(ctx: any) {
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
        const _ = processRaydiumPool(ctx, poolId, poolState)
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

function saveTokenAccount(mint: PublicKey, accountData: MinimalMarketLayoutV3) {
  const ata = getAssociatedTokenAddressSync(mint, solanaData.wallet.publicKey)
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

async function getTokenAmountAfterBuy(mint: PublicKey): Promise<number> {
  let tokenAmountAfterBuy = 0
  logger.info({ mint: mint.toString() }, 'Checking token accounts after buy...')
  const tokenAccountsAfterBuy = await connection.getTokenAccountsByOwner(
    solanaData.wallet.publicKey,
    { mint }
  )
  console.log('tokenAccountsAfterBuy', tokenAccountsAfterBuy)
  if (tokenAccountsAfterBuy.value.length > 0) {
    const accountInfoAfterBuy = tokenAccountsAfterBuy.value[0].account.data
    const decodedDataAfterBuy = AccountLayout.decode(accountInfoAfterBuy)
    tokenAmountAfterBuy = Number(decodedDataAfterBuy.amount)
  }
  return tokenAmountAfterBuy
}

async function buy(
  ctx: any,
  wallet: Keypair,
  accountId: PublicKey,
  quoteTokenAssociatedAddress: PublicKey,
  quoteAmount: TokenAmount,
  accountData: LiquidityStateV4,
  poolKeys: LiquidityPoolKeysV4
): Promise<void> {
  try {
    let tokenAccount = existingTokenAccounts.get(
      accountData.baseMint.toString()
    )

    if (!tokenAccount) {
      // it's possible that we didn't have time to fetch open book data
      const market = await getMinimalMarketV3(
        connection,
        accountData.marketId,
        COMMITMENT_LEVEL
      )
      tokenAccount = saveTokenAccount(accountData.baseMint, market)
    }

    //tokenAccount.poolKeys = createPoolKeys(accountId, accountData, tokenAccount.market!);
    tokenAccount.poolKeys = poolKeys
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
    transaction.sign([wallet, ...innerTransaction.signers])
    // const tx = await connection.sendTransaction(transaction)
    // const endDate = new Date()
    // const diff = endDate.getTime() - initDate.getTime()
    // console.log(`Time to buy: ${diff} ms`)
    // console.log('initDate', initDate)
    // console.log('endDate', endDate)

    // const simRes = await solanaData.raydiumSwap.simulateVersionedTransaction(
    //   transaction as VersionedTransaction
    // )

    // const logs = simRes.value!.logs
    // console.log('simRes', simRes)

    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
      {
        preflightCommitment: COMMITMENT_LEVEL
      }
    )

    if (signature && signature.length > 0) {
      const confirmation = await connection.confirmTransaction(
        {
          signature,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
          blockhash: latestBlockhash.blockhash
        },
        COMMITMENT_LEVEL
      )
      if (!confirmation.value.err) {
        logger.info(
          {
            mint: accountData.baseMint,
            signature,
            url: `https://solscan.io/tx/${signature}`
          },
          `Confirmed buy tx`
        )
      } else {
        logger.debug(confirmation.value.err)
        logger.info(
          { mint: accountData.baseMint, signature },
          `Error confirming buy tx`
        )
      }

      let tokenAmountAfterBuy = await getTokenAmountAfterBuy(
        accountData.baseMint
      )
      console.log('tokenAmountAfterBuy', tokenAmountAfterBuy)

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

      await ctx.reply(
        'Bought token: ' +
          accountData.baseMint.toBase58() +
          ' at price: ' +
          buyPricePerToken +
          ' ' +
          `https://solscan.io/tx/${signature}`
      )
    } else {
      logger.error(
        { mint: accountData.baseMint },
        'Buy transaction failed to confirm after maximum retries and timeout.'
      )
    }

    // if (logs && logs.length > 0) {
    //   await ctx.reply('Simulated transaction: ' + logs[logs.length - 1])
    // }

    // const signature = await connection.sendRawTransaction(transaction.serialize(), {
    //   preflightCommitment: COMMITMENT_LEVEL,
    // });
    // logger.info({ mint: accountData.baseMint, signature }, `Sent buy tx`);
    // const confirmation = await connection.confirmTransaction(
    //   {
    //     signature,
    //     lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    //     blockhash: latestBlockhash.blockhash,
    //   },
    //   COMMITMENT_LEVEL,
    // );
    // if (!confirmation.value.err) {
    //   logger.info(
    //     {
    //       mint: accountData.baseMint,
    //       signature,
    //       url: `https://solscan.io/tx/${signature}?cluster=${NETWORK}`,
    //     },
    //     `Confirmed buy tx`,
    //   );
    // } else {
    //   logger.debug(confirmation.value.err);
    //   logger.info({ mint: accountData.baseMint, signature }, `Error confirming buy tx`);
    // }
  } catch (e) {
    console.log(e)
    logger.error({ mint: accountData.baseMint }, `Failed to buy token`)
  }
}
