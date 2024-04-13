/* eslint-disable space-before-function-paren */
import 'dotenv/config'
import { Bot, GrammyError } from 'grammy'
import FileSessionStorage from './classes/FileSessionStorage'
import { menuMain, menuNewPair } from './menus/menuMain'
import { defaultSession } from './state'
import { deleteMessage, resetPrompt, showMain, OnMessage } from './utils'

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
