/* eslint-disable space-before-function-paren */
import 'dotenv/config'
import { Bot, Context, GrammyError, SessionFlavor } from 'grammy'

import { menuMain, menuNewPair } from './menus'
import { fileSession } from './state'
import { resetPrompt, showMain, showWindow, writeCtx } from './utils/bot'

// @ts-ignore
type MyContext = Context & SessionFlavor<SessionData>
const bot = new Bot<MyContext>(process.env.BOT_TOKEN!)
bot.use(fileSession)
bot.use((ctx, next) => {
  console.log('ctx.session', ctx.session)
  if (ctx.session.temp.timeout) {
    clearTimeout(ctx.session.temp.timeout)
  }
  ctx.session.temp.timeout = setTimeout(() => {
    if (ctx.session.settings.wallet) {
      // ctx.session.settings.wallet = undefined
      // ctx.session.settings.recipient = undefined
      if (ctx.session.temp.prompt) {
        ctx.api.deleteMessage(ctx.chat!.id, ctx.session.temp.prompt.message_id)
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

bot.command('start', async (ctx) => {
  console.log('start', ctx.session)
  if (ctx.session.temp.main) {
    if (ctx.session.temp.main.message_id) {
      ctx.api
        .deleteMessage(ctx.chat.id, ctx.session.temp.main.message_id)
        .catch(() => {})
      ctx.api
        .deleteMessage(ctx.chat.id, ctx.session.temp.main.message_id)
        .catch(() => {})
    }
    ctx.session.temp.main = undefined
  }
  showMain(ctx)
})

bot.on('message', async (ctx) => {
  const prompt = ctx.session.temp.prompt
  if (prompt && prompt.dataType === 'stopLossPercentage') {
    const text = ctx.update.message.text
    if (!text) {
      return
    }

    if (text === 'Cancel') {
      console.log('Cancel')
      resetPrompt(ctx)
      //ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id).catch(() => {})
      //ctx.api.deleteMessage(ctx.chat.id, ctx.update.message.message_id)
      return
    }

    const textNumber = Number(text)
    if (isNaN(textNumber)) {
      ctx.reply('Please input a number')
      return
    }

    if (textNumber < 0 || textNumber > 100) {
      const msg = await ctx.reply('Please input a number  between 0 and 100')
      setTimeout(() => {
        ctx.api
          .deleteMessage(ctx.chat.id, ctx.message.message_id)
          .catch(() => {})
        ctx.api.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {})
      }, 3000)
      return
    }

    console.log('stopLossPercentage: ', textNumber)
    writeCtx(ctx, 'settings', 'stopLossPercentage', textNumber)
    resetPrompt(ctx)
    ctx.api.deleteMessage(ctx.chat.id, prompt.message_id).catch(() => {})
    ctx.api
      .deleteMessage(ctx.chat.id, ctx.update.message.message_id)
      .catch(() => {})

    await showWindow(ctx, 'text', menuNewPair, 'newpair')
  } else if (prompt && prompt.dataType === 'minLiquidity') {
    const text = ctx.update.message.text
    if (!text) {
      return
    }

    if (text === 'Cancel') {
      console.log('Cancel')
      resetPrompt(ctx)
      //ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id).catch(() => {})
      //ctx.api.deleteMessage(ctx.chat.id, ctx.update.message.message_id)
      return
    }

    const minLiquidity = Number(text)
    if (isNaN(minLiquidity)) {
      ctx.reply('Please input a number')
      return
    }

    if (minLiquidity < 0) {
      const msg = await ctx.reply(
        'Please input a number should be greater than 0'
      )
      setTimeout(() => {
        ctx.api
          .deleteMessage(ctx.chat.id, ctx.message.message_id)
          .catch(() => {})
        ctx.api.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {})
      }, 3000)
      return
    }

    console.log('minLiquidity: ', minLiquidity)
    writeCtx(ctx, 'settings', 'minLiquidity', minLiquidity)
    resetPrompt(ctx)
    ctx.api.deleteMessage(ctx.chat.id, prompt.message_id).catch(() => {})
    ctx.api
      .deleteMessage(ctx.chat.id, ctx.update.message.message_id)
      .catch(() => {})

    await showWindow(ctx, 'text', menuNewPair, 'newpair')
  } else if (prompt && prompt.dataType === 'recipient') {
  } else {
    ctx.api
      .deleteMessage(ctx.chat.id, ctx.update.message.message_id)
      .catch(() => {})
  }
})
