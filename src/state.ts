import { session } from 'grammy'
import { FileSessionStorage } from './classes/FileSessionStorage'
import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import {
  MIN_POOL_SIZE,
  QUOTE_AMOUNT,
  RPC_ENDPOINT,
  RPC_WEBSOCKET_ENDPOINT
} from './constants'
import { LiquidityPoolKeys, Token, TokenAmount } from '@raydium-io/raydium-sdk'
import { SnipeType } from './types'
import { MinimalMarketLayoutV3 } from './market'
export const chatHistory: any[] = []

export interface MinimalTokenAccountData {
  mint: PublicKey
  address: PublicKey
  poolKeys?: LiquidityPoolKeys
  market?: MinimalMarketLayoutV3
  buyPricePerToken?: number // Optional property to store the buy price per token
}

interface Settings {
  stopLossPercentage: number
  takeProfitPercentage: number
  mintDisabled: boolean
  minLiquidity: number
  buyAmount: string
  lpBurned: boolean
}

export interface SessionData {
  settings: Settings
  history: {
    pending: any[]
    transactions: any[]
  }
  main: {
    uiClass: string
  }
  solana: {
    wallet: Keypair | undefined
    quoteToken: Token | undefined
    quoteTokenAssociatedAddress: PublicKey | undefined
    quoteAmount: TokenAmount | undefined
    quoteMinPoolSizeAmount: TokenAmount | undefined
    snipeList: SnipeType[]
  }
  temp: {
    mixers: any
    monitors: any
    main?: {
      message_id: number
    },
    prompt?: {
      dataType: string
      message_id: number
    }
  }
}

export const initSettings = (): Settings => {
  return {
    lpBurned: false,
    stopLossPercentage: 10,
    takeProfitPercentage: 50,
    mintDisabled: true,
    minLiquidity: 1,
    buyAmount: '0.01'
  }
}

export const defaultSession = session({
  // @ts-ignore
  type: 'multi',
  settings: {
    initial: initSettings
  },
  history: {
    initial: () => ({
      pending: [],
      transactions: []
    }),
    storage: new FileSessionStorage()
  },
  temp: {
    initial: () => ({
      mixers: {},
      monitors: {}
    })
  },
  main: {
    initial: () => ({
      uiClass: 'main'
    })
  },
  solana: {
    initial: () => ({
      uiClass: 'main'
    }),
    wallet: undefined,
    quoteToken: undefined,
    quoteTokenAssociatedAddress: undefined,
    quoteAmount: undefined,
    quoteMinPoolSizeAmount: undefined,
    snipeList: []
  }
})

export const fileSession = async (ctx: any, next: any) => {
  const key = ctx.chat?.id.toString()
  await defaultSession(ctx, next)
  ctx.session.update = () => {
    FileSessionStorage.store(key, ctx.session.history)
  }
}

export const existingTokenAccounts: Map<string, MinimalTokenAccountData> =
  new Map<string, MinimalTokenAccountData>()

export const solanaData = {
  wallet: new Keypair(),
  quoteToken: Token.WSOL,
  quoteAmount: new TokenAmount(Token.WSOL, QUOTE_AMOUNT, false),
  quoteMinPoolSizeAmount: new TokenAmount(Token.WSOL, MIN_POOL_SIZE, false),
  quoteTokenAssociatedAddress: new PublicKey(
    'So11111111111111111111111111111111111111112'
  )
}

export const snipeList = <SnipeType[]>[]
export const existingLiquidityPools: Set<string> = new Set<string>()
export const knownTokens = new Set<string>()
export const connection = new Connection(RPC_ENDPOINT, {
  wsEndpoint: RPC_WEBSOCKET_ENDPOINT
})

/*


export const initSettings = () => {
  return {
    stopLossPercentage: 10,
    mintDisabled: true,
    minLiquidity: true,
    amount: '0.01'
  }
}

export const defaultSession = session({
  // type: 'multi',
  // settings: {
  //   initial: initSettings
  // },
  // history: {
  //   initial: () => ({
  //     pending: [],
  //     transactions: []
  //   }),
  //   storage: new FileSessionStorage()
  // },
  // temp: {
  //   initial: () => ({
  //     mixers: {},
  //     monitors: {}
  //   })
  // }
})

*/
