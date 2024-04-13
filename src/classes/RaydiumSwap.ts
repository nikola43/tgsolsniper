import { Connection, PublicKey, Keypair, Transaction, VersionedTransaction, TransactionMessage } from '@solana/web3.js'
import {
  Liquidity,
  LiquidityPoolKeys,
  jsonInfo2PoolKeys,
  LiquidityPoolJsonInfo,
  TokenAccount,
  Token,
  TokenAmount,
  TOKEN_PROGRAM_ID,
  Percent,
  SPL_ACCOUNT_LAYOUT,
  LIQUIDITY_STATE_LAYOUT_V4,
  MARKET_STATE_LAYOUT_V3,
  Market,
  ComputeBudgetConfig,
} from '@raydium-io/raydium-sdk'
import { Wallet } from '@coral-xyz/anchor'
import bs58 from 'bs58'
import fs from 'fs'
import axios from 'axios';

interface SolanaFeeInfo {
  min: number;
  max: number;
  avg: number;
  priorityTx: number;
  nonVotes: number;
  priorityRatio: number;
  avgCuPerBlock: number;
  blockspaceUsageRatio: number;
}
type SolanaFeeInfoJson = {
  '1': SolanaFeeInfo;
  '5': SolanaFeeInfo;
  '15': SolanaFeeInfo;
};

/**
 * Class representing a Raydium Swap operation.
 */
class RaydiumSwap {
  static RAYDIUM_V4_PROGRAM_ID = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'

  allPoolKeysJson: LiquidityPoolJsonInfo[]
  connection: Connection
  wallet: Wallet

  /**
 * Create a RaydiumSwap instance.
 * @param {string} RPC_URL - The RPC URL for connecting to the Solana blockchain.
 * @param {string} WALLET_PRIVATE_KEY - The private key of the wallet in base58 format.
 */
  constructor(connection: Connection, WALLET_PRIVATE_KEY: string) {
    this.allPoolKeysJson = []
    this.connection = connection
    this.wallet = new Wallet(Keypair.fromSecretKey(Uint8Array.from(bs58.decode(WALLET_PRIVATE_KEY))))
  }

  async getProgramAccounts(baseMint: string, quoteMint: string) {
    const layout = LIQUIDITY_STATE_LAYOUT_V4

    return this.connection.getProgramAccounts(new PublicKey(RaydiumSwap.RAYDIUM_V4_PROGRAM_ID), {
      filters: [
        { dataSize: layout.span },
        {
          memcmp: {
            offset: layout.offsetOf('baseMint'),
            bytes: new PublicKey(baseMint).toBase58(),
          },
        },
        {
          memcmp: {
            offset: layout.offsetOf('quoteMint'),
            bytes: new PublicKey(quoteMint).toBase58(),
          },
        },
      ],
    })
  }

  async findRaydiumPoolInfo(baseMint: string, quoteMint: string): Promise<LiquidityPoolKeys | undefined> {
    const layout = LIQUIDITY_STATE_LAYOUT_V4

    const programData = await this.getProgramAccounts(baseMint, quoteMint)

    const collectedPoolResults = programData
      .map((info) => ({
        id: new PublicKey(info.pubkey),
        version: 4,
        programId: new PublicKey(RaydiumSwap.RAYDIUM_V4_PROGRAM_ID),
        ...layout.decode(info.account.data),
      }))
      .flat()

    const pool = collectedPoolResults[0]

    if (!pool) return undefined

    const market = await this.connection.getAccountInfo(pool.marketId).then((item) => ({
      programId: item!.owner,
      ...MARKET_STATE_LAYOUT_V3.decode(item!.data),
    }))

    const authority = Liquidity.getAssociatedAuthority({
      programId: new PublicKey(RaydiumSwap.RAYDIUM_V4_PROGRAM_ID),
    }).publicKey

    const marketProgramId = market.programId

    const poolKeys = {
      id: pool.id,
      baseMint: pool.baseMint,
      quoteMint: pool.quoteMint,
      lpMint: pool.lpMint,
      baseDecimals: Number.parseInt(pool.baseDecimal.toString()),
      quoteDecimals: Number.parseInt(pool.quoteDecimal.toString()),
      lpDecimals: Number.parseInt(pool.baseDecimal.toString()),
      version: pool.version,
      programId: pool.programId,
      openOrders: pool.openOrders,
      targetOrders: pool.targetOrders,
      baseVault: pool.baseVault,
      quoteVault: pool.quoteVault,
      marketVersion: 3,
      authority: authority,
      marketProgramId,
      marketId: market.ownAddress,
      marketAuthority: Market.getAssociatedAuthority({
        programId: marketProgramId,
        marketId: market.ownAddress,
      }).publicKey,
      marketBaseVault: market.baseVault,
      marketQuoteVault: market.quoteVault,
      marketBids: market.bids,
      marketAsks: market.asks,
      marketEventQueue: market.eventQueue,
      withdrawQueue: pool.withdrawQueue,
      lpVault: pool.lpVault,
      lookupTableAccount: PublicKey.default,
    } as LiquidityPoolKeys

    return poolKeys
  }

  /**
  * Loads all the pool keys available from a JSON configuration file.
  * @async
  * @returns {Promise<void>}
  */
  async loadPoolKeys(liquidityFile: string) {
    // measure time
    const initDate = new Date()
    var liquidityJsonResp = JSON.parse(fs.readFileSync('./mainnet.json', 'utf8'));
    // measure time
    const liquidityJson = (await liquidityJsonResp) as { official: any; unOfficial: any }
    const allPoolKeysJson = [...(liquidityJson?.official ?? []), ...(liquidityJson?.unOfficial ?? [])]
    console.log('Time to fetch liquidity file:', new Date().getTime() - initDate.getTime(), 'ms')
    this.allPoolKeysJson = allPoolKeysJson
  }

  /*
  async loadPoolKeys(liquidityFile: string) {
    // measure time
    const initDate = new Date()
    const liquidityJsonResp = await fetch(liquidityFile);
    // measure time
  
    if (!liquidityJsonResp.ok) return
    const liquidityJson = (await liquidityJsonResp.json()) as { official: any; unOfficial: any }
    const allPoolKeysJson = [...(liquidityJson?.official ?? []), ...(liquidityJson?.unOfficial ?? [])]
    console.log('Time to fetch liquidity file:', new Date().getTime() - initDate.getTime(), 'ms')
    this.allPoolKeysJson = allPoolKeysJson
  }
  */

  /**
 * Finds pool information for the given token pair.
 * @param {string} mintA - The mint address of the first token.
 * @param {string} mintB - The mint address of the second token.
 * @returns {LiquidityPoolKeys | null} The liquidity pool keys if found, otherwise null.
 */
  findPoolInfoForTokens(mintA: string, mintB: string) {
    const poolData = this.allPoolKeysJson.find(
      (i) => (i.baseMint === mintA && i.quoteMint === mintB) || (i.baseMint === mintB && i.quoteMint === mintA)
    )

    if (!poolData) return null

    return jsonInfo2PoolKeys(poolData) as LiquidityPoolKeys
  }

  /**
 * Retrieves token accounts owned by the wallet.
 * @async
 * @returns {Promise<TokenAccount[]>} An array of token accounts.
 */
  async getOwnerTokenAccounts() {
    const walletTokenAccount = await this.connection.getTokenAccountsByOwner(this.wallet.publicKey, {
      programId: TOKEN_PROGRAM_ID,
    })

    return walletTokenAccount.value.map((i) => ({
      pubkey: i.pubkey,
      programId: i.account.owner,
      accountInfo: SPL_ACCOUNT_LAYOUT.decode(i.account.data),
    }))
  }

  //  async  getComputeBudgetConfigHigh(): Promise<ComputeBudgetConfig | undefined> {

  //   const response = await axios.get<SolanaFeeInfoJson>('https://solanacompass.com/api/fees');
  //   const json = response.data;
  //   const { avg } = json?.[15] ?? {};
  //   if (!avg) return undefined; // fetch error
  //   return {
  //     units: sell_remove_fees,
  //     microLamports: Math.min(Math.ceil((avg * 1000000) / 600000), 25000),
  //   } as ComputeBudgetConfig;
  // }

   async  getComputeBudgetConfig(): Promise<ComputeBudgetConfig | undefined> {
    const response = await axios.get<SolanaFeeInfoJson>('https://solanacompass.com/api/fees');
    const json = response.data;
    const { avg } = json?.[15] ?? {};
    if (!avg) return undefined; // fetch error
    return {
      units: 600000,
      microLamports: Math.min(Math.ceil((avg * 1000000) / 600000), 25000),
    } as ComputeBudgetConfig;
}

  async getSwapTransactionV2(
    toToken: string,
    amount: number,
    poolKeys: LiquidityPoolKeys,
    maxLamports: number = 100000,
    useVersionedTransaction = true,
    fixedSide: 'in' | 'out' = 'in',
    slippage: number = 5
  ): Promise<Transaction | VersionedTransaction> {
    const directionIn = poolKeys.quoteMint.toString() == toToken
    const { minAmountOut, amountIn } = await this.calcAmountOutV2(poolKeys, amount, slippage, directionIn)

    const userTokenAccounts = await this.getOwnerTokenAccounts()
    const swapTransaction = await Liquidity.makeSwapInstructionSimple({
      connection: this.connection,
      makeTxVersion: useVersionedTransaction ? 0 : 1,
      poolKeys: {
        ...poolKeys,
      },
      userKeys: {
        tokenAccounts: userTokenAccounts,
        owner: this.wallet.publicKey,
      },
      amountIn: amountIn,
      amountOut: minAmountOut,
      fixedSide: fixedSide,
      config: {
        bypassAssociatedCheck: false,
      },
      // computeBudgetConfig: {
      //   microLamports: maxLamports,
      // },
      computeBudgetConfig: await this.getComputeBudgetConfig(),
    })

    const recentBlockhashForSwap = await this.connection.getLatestBlockhash()
    const instructions = swapTransaction.innerTransactions[0].instructions.filter(Boolean)

    if (useVersionedTransaction) {
      const versionedTransaction = new VersionedTransaction(
        new TransactionMessage({
          payerKey: this.wallet.publicKey,
          recentBlockhash: recentBlockhashForSwap.blockhash,
          instructions: instructions,
        }).compileToV0Message()
      )

      versionedTransaction.sign([this.wallet.payer])

      return versionedTransaction
    }

    const legacyTransaction = new Transaction({
      blockhash: recentBlockhashForSwap.blockhash,
      lastValidBlockHeight: recentBlockhashForSwap.lastValidBlockHeight,
      feePayer: this.wallet.publicKey,
    })

    legacyTransaction.add(...instructions)

    return legacyTransaction
  }

  /**
 * Builds a swap transaction.
 * @async
 * @param {string} toToken - The mint address of the token to receive.
 * @param {number} amount - The amount of the token to swap.
 * @param {LiquidityPoolKeys} poolKeys - The liquidity pool keys.
 * @param {number} [maxLamports=100000] - The maximum lamports to use for transaction fees.
 * @param {boolean} [useVersionedTransaction=true] - Whether to use a versioned transaction.
 * @param {'in' | 'out'} [fixedSide='in'] - The fixed side of the swap ('in' or 'out').
 * @returns {Promise<Transaction | VersionedTransaction>} The constructed swap transaction.
 */
  async getSwapTransaction(
    toToken: string,
    // fromToken: string,
    amount: number,
    poolKeys: LiquidityPoolKeys,
    maxLamports: number = 100000,
    useVersionedTransaction = true,
    fixedSide: 'in' | 'out' = 'in'
  ): Promise<Transaction | VersionedTransaction> {
    //console.log({ poolKeys });
    const directionIn = poolKeys.quoteMint.toString() == toToken
    const { minAmountOut, amountIn } = await this.calcAmountOut(poolKeys, amount, directionIn)
    console.log({ minAmountOut, amountIn });
    const userTokenAccounts = await this.getOwnerTokenAccounts()
    const swapTransaction = await Liquidity.makeSwapInstructionSimple({
      connection: this.connection,
      makeTxVersion: useVersionedTransaction ? 0 : 1,
      poolKeys: {
        ...poolKeys,
      },
      userKeys: {
        tokenAccounts: userTokenAccounts,
        owner: this.wallet.publicKey,
      },
      amountIn: amountIn,
      amountOut: minAmountOut,
      fixedSide: fixedSide,
      config: {
        bypassAssociatedCheck: false,
      },
      computeBudgetConfig: {
        microLamports: maxLamports,
      },
    })

    const recentBlockhashForSwap = await this.connection.getLatestBlockhash()
    const instructions = swapTransaction.innerTransactions[0].instructions.filter(Boolean)

    if (useVersionedTransaction) {
      const versionedTransaction = new VersionedTransaction(
        new TransactionMessage({
          payerKey: this.wallet.publicKey,
          recentBlockhash: recentBlockhashForSwap.blockhash,
          instructions: instructions,
        }).compileToV0Message()
      )

      versionedTransaction.sign([this.wallet.payer])

      return versionedTransaction
    }

    const legacyTransaction = new Transaction({
      blockhash: recentBlockhashForSwap.blockhash,
      lastValidBlockHeight: recentBlockhashForSwap.lastValidBlockHeight,
      feePayer: this.wallet.publicKey,
    })

    legacyTransaction.add(...instructions)

    return legacyTransaction
  }

  /**
 * Sends a legacy transaction.
 * @async
 * @param {Transaction} tx - The transaction to send.
 * @returns {Promise<string>} The transaction ID.
 */
  async sendLegacyTransaction(tx: Transaction, maxRetries?: number) {
    const txid = await this.connection.sendTransaction(tx, [this.wallet.payer], {
      skipPreflight: true,
      maxRetries: maxRetries,
    })

    return txid
  }

  /**
 * Sends a versioned transaction.
 * @async
 * @param {VersionedTransaction} tx - The versioned transaction to send.
 * @returns {Promise<string>} The transaction ID.
 */
  async sendVersionedTransaction(tx: VersionedTransaction, maxRetries?: number) {
    const txid = await this.connection.sendTransaction(tx, {
      skipPreflight: true,
      maxRetries: maxRetries,
    })

    return txid
  }

  /**
    * Simulates a versioned transaction.
    * @async
    * @param {VersionedTransaction} tx - The versioned transaction to simulate.
    * @returns {Promise<any>} The simulation result.
    */
  async simulateLegacyTransaction(tx: Transaction) {
    const txid = await this.connection.simulateTransaction(tx, [this.wallet.payer])

    return txid
  }

  /**
 * Simulates a versioned transaction.
 * @async
 * @param {VersionedTransaction} tx - The versioned transaction to simulate.
 * @returns {Promise<any>} The simulation result.
 */
  async simulateVersionedTransaction(tx: VersionedTransaction) {
    const txid = await this.connection.simulateTransaction(tx)

    return txid
  }

  /**
 * Gets a token account by owner and mint address.
 * @param {PublicKey} mint - The mint address of the token.
 * @returns {TokenAccount} The token account.
 */
  getTokenAccountByOwnerAndMint(mint: PublicKey) {
    return {
      programId: TOKEN_PROGRAM_ID,
      pubkey: PublicKey.default,
      accountInfo: {
        mint: mint,
        amount: 0,
      },
    } as unknown as TokenAccount
  }

  async calcAmountOutV2(
    poolKeys: LiquidityPoolKeys,
    rawAmountIn: number,
    slippage: number = 5,
    swapInDirection: boolean
  ) {
    const poolInfo = await Liquidity.fetchInfo({ connection: this.connection, poolKeys })

    let currencyInMint = poolKeys.baseMint
    let currencyInDecimals = poolInfo.baseDecimals
    let currencyOutMint = poolKeys.quoteMint
    let currencyOutDecimals = poolInfo.quoteDecimals

    if (!swapInDirection) {
      currencyInMint = poolKeys.quoteMint
      currencyInDecimals = poolInfo.quoteDecimals
      currencyOutMint = poolKeys.baseMint
      currencyOutDecimals = poolInfo.baseDecimals
    }

    const currencyIn = new Token(TOKEN_PROGRAM_ID, currencyInMint, currencyInDecimals)
    const amountIn = new TokenAmount(currencyIn, rawAmountIn, false)
    const currencyOut = new Token(TOKEN_PROGRAM_ID, currencyOutMint, currencyOutDecimals)
    const slippageX = new Percent(slippage, 100) // 5% slippage

    const { amountOut, minAmountOut, currentPrice, executionPrice, priceImpact, fee } = Liquidity.computeAmountOut({
      poolKeys,
      poolInfo,
      amountIn,
      currencyOut,
      slippage: slippageX,
    })

    return {
      amountIn,
      amountOut,
      minAmountOut,
      currentPrice,
      executionPrice,
      priceImpact,
      fee,
    }
  
}

  /**
 * Calculates the amount out for a swap.
 * @async
 * @param {LiquidityPoolKeys} poolKeys - The liquidity pool keys.
 * @param {number} rawAmountIn - The raw amount of the input token.
 * @param {boolean} swapInDirection - The direction of the swap (true for in, false for out).
 * @returns {Promise<Object>} The swap calculation result.
 */
  async calcAmountOut(poolKeys: LiquidityPoolKeys, rawAmountIn: number, swapInDirection: boolean) {
    const poolInfo = await Liquidity.fetchInfo({ connection: this.connection, poolKeys })

    let currencyInMint = poolKeys.baseMint
    let currencyInDecimals = poolInfo.baseDecimals
    let currencyOutMint = poolKeys.quoteMint
    let currencyOutDecimals = poolInfo.quoteDecimals

    if (!swapInDirection) {
      currencyInMint = poolKeys.quoteMint
      currencyInDecimals = poolInfo.quoteDecimals
      currencyOutMint = poolKeys.baseMint
      currencyOutDecimals = poolInfo.baseDecimals
    }

    const currencyIn = new Token(TOKEN_PROGRAM_ID, currencyInMint, currencyInDecimals)
    const amountIn = new TokenAmount(currencyIn, rawAmountIn, false)
    const currencyOut = new Token(TOKEN_PROGRAM_ID, currencyOutMint, currencyOutDecimals)
    const slippage = new Percent(45, 100) // 5% slippage

    const { amountOut, minAmountOut, currentPrice, executionPrice, priceImpact, fee } = Liquidity.computeAmountOut({
      poolKeys,
      poolInfo,
      amountIn,
      currencyOut,
      slippage,
    })

    return {
      amountIn,
      amountOut,
      minAmountOut,
      currentPrice,
      executionPrice,
      priceImpact,
      fee,
    }
  }
}

export default RaydiumSwap
