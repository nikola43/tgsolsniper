import { Connection, PublicKey } from '@solana/web3.js'
import { RPC_ENDPOINT, RPC_WEBSOCKET_ENDPOINT } from './constants'

const connection = new Connection(RPC_ENDPOINT, {
  wsEndpoint: RPC_WEBSOCKET_ENDPOINT
})

const burnIxnName = 'Burn'

export async function trackLp() {
  connection.onLogs(
    new PublicKey('5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1'),
    ({ logs, err, signature }) => {
      if (err) return
      if (logs && logs.some((log) => log.includes(burnIxnName))) {
        console.log(
          "Signature for 'initialize2':",
          `https://explorer.solana.com/tx/${signature}`
        )
      }
    },
    'finalized'
  )
}
