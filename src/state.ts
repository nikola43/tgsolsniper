import { session } from 'grammy'
import { FileSessionStorage } from './classes/FileSessionStorage'
export const chatHistory: any[] = []

interface Settings {
  stopLossPercentage: number
  mintDisabled: boolean
  minLiquidity: boolean
  amount: string
}

export const initSettings = (): Settings => {
  return {
    stopLossPercentage: 10,
    mintDisabled: true,
    minLiquidity: true,
    amount: '0.01'
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
  }
})

export const fileSession = async (ctx: any, next: any) => {
  const key = ctx.chat?.id.toString()
  await defaultSession(ctx, next)
  ctx.session.update = () => {
    FileSessionStorage.store(key, ctx.session.history)
  }
}

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
