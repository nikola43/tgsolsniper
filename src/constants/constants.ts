import { Commitment } from '@solana/web3.js'
import { retrieveEnvVariable } from '../utils/env'
import { logger } from '../utils/logger'

export const NETWORK = 'mainnet-beta'
export const COMMITMENT_LEVEL: Commitment = retrieveEnvVariable(
  'COMMITMENT_LEVEL',
  logger
) as Commitment
export const RPC_ENDPOINT = retrieveEnvVariable('RPC_ENDPOINT', logger)
export const RPC_WEBSOCKET_ENDPOINT = retrieveEnvVariable(
  'RPC_WEBSOCKET_ENDPOINT',
  logger
)
export const LOG_LEVEL = retrieveEnvVariable('LOG_LEVEL', logger)
export const CHECK_IF_MINT_IS_RENOUNCED =
  retrieveEnvVariable('CHECK_IF_MINT_IS_RENOUNCED', logger) === 'true'
export const USE_SNIPE_LIST =
  retrieveEnvVariable('USE_SNIPE_LIST', logger) === 'true'
export const SNIPE_LIST_REFRESH_INTERVAL = Number(
  retrieveEnvVariable('SNIPE_LIST_REFRESH_INTERVAL', logger)
)
export const AUTO_SELL = retrieveEnvVariable('AUTO_SELL', logger) === 'true'
export const MAX_SELL_RETRIES = Number(
  retrieveEnvVariable('MAX_SELL_RETRIES', logger)
)
export const AUTO_SELL_DELAY = Number(
  retrieveEnvVariable('AUTO_SELL_DELAY', logger)
)
export const PRIVATE_KEY = retrieveEnvVariable('PRIVATE_KEY', logger)
export const QUOTE_MINT = retrieveEnvVariable('QUOTE_MINT', logger)
export const QUOTE_AMOUNT = retrieveEnvVariable('QUOTE_AMOUNT', logger)
export const MIN_POOL_SIZE = retrieveEnvVariable('MIN_POOL_SIZE', logger)
export const PORT = retrieveEnvVariable('PORT', logger)
export const MAX_LENGTH = Number(
  retrieveEnvVariable('MAX_SNIPE_LENGTH', logger)
)
export const SELL_RETRIES_INTERVAL = Number(
  retrieveEnvVariable('SELL_RETRIES_INTERVAL', logger)
)

export const programID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
export const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
export const feeRecipient = "CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM";
export const EVENT_AUTH = "Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1";
