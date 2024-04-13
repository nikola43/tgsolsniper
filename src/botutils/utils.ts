import { chatHistory } from './chatHistory.js'
import { menuMain } from './menuMain.js'
import { menuNewPair } from './menuNewPair.js'

export const deleteMessage = async (ctx, id) => {
  ctx.api.deleteMessage(ctx, id).catch(() => {})
}

export const writeCtx = (ctx, key, value) => {
  ctx.session.settings[key] = value
}

export const readCtx = (ctx, key) => {
  return ctx.session.settings[key]
}

export const showWindow = async (ctx, text, menu) => {
  const message = ctx.update.message ?? ctx.update.callback_query.message
  if (
    ctx.session.temp.main &&
    ctx.session.temp.main.message_id !== message.message_id
  ) {
    if (!message.uiClass) {
      deleteMessage(ctx, message.message_id)
    } else {
      deleteMessage(ctx, ctx.session.temp.main.message_id)
      if (ctx.session.temp.main.from.id === message.from.id) {
        ctx.session.temp.main = message
      } else ctx.session.temp.main = undefined
      chatHistory.push([ctx.chat.id, message.message_id])
    }
  } else if (message.uiClass) {
    ctx.session.temp.main = message
  }
  if (ctx.session.temp.main) {
    await ctx.api
      .editMessageText(ctx.chat.id, ctx.session.temp.main.message_id, text, {
        reply_markup: menu,
        parse_mode: 'MarkdownV2'
      })
      .catch(() => {})
  } else {
    ctx.session.temp.main = await ctx
      .reply(text, { reply_markup: menu, parse_mode: 'MarkdownV2' })
      .catch(() => {})
  }
}

export const resetPrompt = async (ctx) => {
  ctx.session.temp.prompt = undefined
}

export const showMain = async (ctx) => {
  const text = ['Welcome to solana bot\\!']
    .filter((item) => item !== undefined)
    .join('\n')

  await showWindow(ctx, text, menuMain)
  ctx.session.temp.main.uiClass = 'main'
}

export const getStateCircle = (value) => {
  return value ? '🟢' : '🔴'
}

export const onMenuOutdated = async (ctx) => {
  // ctx.session.settings.wallet = undefined
  // ctx.session.settings.recipient = undefined
  if (
    !ctx.session.temp.main ||
    ctx.session.temp.main.message_id !==
      ctx.update.callback_query.message.message_id
  ) {
    ctx.answerCallbackQuery().catch(() => {})
    ctx.session.temp.main = ctx.update.callback_query.message
    // ctx.api.deleteMessage(ctx, ctx.update.callback_query.message.message_id).catch(() => {})
  }
  showMain(ctx)
}

export const showMenu = async (ctx, menu, uiClass) => {
  await showWindow(ctx, 'text', menu)
  ctx.session.temp.main.uiClass = uiClass
}

export const OnMessage = (ctx) => async () => {
  const prompt = ctx.session.temp.prompt
  if (prompt && prompt.dataType === 'stopLossPercentage') {
    const stopLossPercentage = ctx.update.message.text

    // if (stopLossPercentage === 'Cancel') {
    //   ctx.api.deleteMessage(ctx, ctx.message.message_id).catch(() => {})
    //   return
    // }

    if (stopLossPercentage !== 'Cancel' && isNaN(stopLossPercentage)) {
      ctx.reply('Please input a number')
      return
    }

    if (stopLossPercentage < 0 || stopLossPercentage > 100) {
      const msg = await ctx.reply('Please input a number between 0 and 100')
      setTimeout(() => {
        ctx.api.deleteMessage(ctx, ctx.message.message_id).catch(() => {})
        ctx.api.deleteMessage(ctx, msg.message_id).catch(() => {})

        deleteMessage(ctx, ctx.message.message_id)
        deleteMessage(ctx, msg.message_id)
      }, 3000)
      return
    }

    console.log('stopLossPercentage', stopLossPercentage)
    writeCtx(ctx, 'stopLossPercentage', stopLossPercentage)
    resetPrompt(ctx)
    deleteMessage(ctx, prompt.message_id)
    deleteMessage(ctx, ctx.update.message.message_id)

    await showWindow(ctx, 'text', menuNewPair)
  } else if (prompt && prompt.dataType === 'amount') {
    console.log('amount')
  } else if (prompt && prompt.dataType === 'recipient') {
    console.log('recipient')
  } else {
    deleteMessage(ctx, ctx.update.message.message_id)
  }
}
