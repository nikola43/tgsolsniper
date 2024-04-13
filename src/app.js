/* eslint-disable space-before-function-paren */
import 'dotenv/config'
import { Bot, GrammyError, MemorySessionStorage } from 'grammy'
import { menuMain, menuNewPair } from './menus/index'
import { defaultSession } from './state'
import { deleteMessage, resetPrompt, showMain, OnMessage } from './utils'
import { existsSync, readFileSync, writeFileSync } from 'fs'

export class FileSessionStorage extends MemorySessionStorage {
  static load(key) {
    const fname = `./storage/${key}.json`
    if (existsSync(fname)) return JSON.parse(readFileSync(fname).toString())
    return undefined
  }

  static store(key, value) {
    const fname = `./storage/${key}.json`
    writeFileSync(fname, JSON.stringify(value))
  }

  write(key, value) {
    this.storage.set(key, value)
    FileSessionStorage.store(key, value)
  }

  read(key) {
    const value = this.storage.get(key)
    if (value === undefined) return FileSessionStorage.load(key)
    return value
  }
}

const fileSession = async (ctx, next) => {
  const key = ctx.chat?.id.toString()
  await defaultSession(ctx, next)
  ctx.session.update = () => {
    FileSessionStorage.store(key, ctx.session.history)
  }
}

const bot = new Bot(process.env.BOT_TOKEN)
bot.use(fileSession)
bot.use((ctx, next) => {
  if (ctx.session.temp.timeout) clearTimeout(ctx.session.temp.timeout)
  ctx.session.temp.timeout = setTimeout(() => {
    if (ctx.session.settings.wallet) {
      // ctx.session.settings.wallet = undefined
      // ctx.session.settings.recipient = undefined
      if (ctx.session.temp.prompt) {
        deleteMessage(ctx, ctx.session.temp.prompt.message_id)
        resetPrompt(ctx)
      }
      showMain(ctx)
    }
  }, 3600 * 1000)
  return next()
})
bot.use(menuNewPair)
bot.use(menuMain)

bot.start({
  onStart: (botInfo) => {
    console.log(`Bot ${botInfo.username} is up and running!`)
  }
})

bot.catch((err) => {
  const ctx = err.ctx
  console.error(`Error while handling update ${ctx.update.update_id}:`)
  const e = err.error
  if (e instanceof GrammyError) {
    console.error('Error in request:', e.description)
  } else {
    console.error('Unknown error:', e)
  }
})

// bot.command('start', async (ctx) => {
//   if (ctx.session.temp.main) {
//     if (ctx.session.temp.main.message_id) {
//       ctx.api
//         .deleteMessage(ctx, ctx.session.temp.main.message_id)
//         .catch(() => {})
//       deleteMessage(ctx, ctx.session.temp.main.message_id)
//     }
//     ctx.session.temp.main = undefined
//   }
//   showMain(ctx)
// })

bot.on('message', OnMessage)
