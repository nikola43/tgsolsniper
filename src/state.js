import { session } from 'grammy'
import { FileSessionStorage } from './classes/FileSessionStorage'

const chatHistory = []

const initSettings = () => {
  return {
    stopLossPercentage: 10,
    mintDisabled: true,
    minLiquidity: true,
    amount: '0.01'
  }
}

const defaultSession = session({
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

export { defaultSession, initSetting, chatHistory }
