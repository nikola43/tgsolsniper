import { menuMain, menuNewPair } from '../menus'
import { chatHistory } from '../state'

// export const deleteMessage = async (ctx: any, id: number) => {
//   ctx.api.ctx.api.deleteMessage(ctx.chat.id, id).catch(() => {})
// }

export const writeCtx = (ctx: any, key: string, value: any) => {
  ctx.session.settings[key] = value
}

export const readCtx = (ctx: any, key: string) => {
  return ctx.session.settings[key]
}

export const showWindow = async (
  ctx: any,
  text: string,
  menu: any,
  uiClass: string
) => {
  const message = ctx.update.message ?? ctx.update.callback_query.message

  if (
    ctx.session.temp.main &&
    ctx.session.temp.main.message_id !== message.message_id
  ) {
    if (!message.uiClass) {
      ctx.api.deleteMessage(ctx.chat.id, message.message_id).catch(() => {})
    } else {
      ctx.api.deleteMessage(ctx.chat.id, ctx.session.temp.main.message_id).catch(() => {})
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

export const resetPrompt = async (ctx: any) => {
  ctx.session.temp.prompt = undefined
}

export const showMain = async (ctx: any) => {
  const text = ['Welcome to solana bot\\!']
    .filter((item) => item !== undefined)
    .join('\n')

  await showWindow(ctx, text, menuMain, 'main')
  ctx.session.temp.main.uiClass = 'main'
}

export const getStateCircle = (value: boolean) => {
  return value ? '🟢' : '🔴'
}

export const onMenuOutdated = async (ctx: any) => {
  // ctx.session.settings.wallet = undefined
  // ctx.session.settings.recipient = undefined
  if (
    !ctx.session.temp.main ||
    ctx.session.temp.main.message_id !==
      ctx.update.callback_query.message.message_id
  ) {
    ctx.answerCallbackQuery().catch(() => {})
    ctx.session.temp.main = ctx.update.callback_query.message
    // ctx.api.ctx.api.deleteMessage(ctx.chat.id, ctx.update.callback_query.message.message_id).catch(() => {})
  }
  showMain(ctx)
}

// export const showMenu = async (ctx: any, menu: any, uiClass: string) => {
//   await showWindow(ctx, 'text', menu)
//   ctx.session.temp.main.uiClass = uiClass
// }

export const OnMessage = (ctx: any) => async () => {
  const prompt = ctx.session.temp.prompt
  console.log('prompt', prompt)
  if (prompt && prompt.dataType === 'stopLossPercentage') {
    const stopLossPercentage = ctx.update.message.text

    // if (stopLossPercentage === 'Cancel') {
    //   ctx.api.ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id).catch(() => {})
    //   return
    // }

    if (stopLossPercentage !== 'Cancel' && isNaN(stopLossPercentage)) {
      ctx.reply('Please input a number')
      return
    }

    if (stopLossPercentage < 0 || stopLossPercentage > 100) {
      const msg = await ctx.reply('Please input a number between 0 and 100')
      setTimeout(() => {
        ctx.api.ctx.api
          .deleteMessage(ctx.chat.id, ctx.message.message_id).catch(() => {})
          .catch(() => {})
        ctx.api.ctx.api
          .deleteMessage(ctx.chat.id, msg.message_id).catch(() => {})
          .catch(() => {})

        ctx.api.deleteMessage(ctx.chat.id, ctx.message.message_id).catch(() => {})
        ctx.api.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {})
      }, 3000)
      return
    }

    console.log('stopLossPercentage', stopLossPercentage)
    writeCtx(ctx, 'stopLossPercentage', stopLossPercentage)
    resetPrompt(ctx)
    ctx.api.deleteMessage(ctx.chat.id, prompt.message_id).catch(() => {})
    ctx.api.deleteMessage(ctx.chat.id, ctx.update.message.message_id).catch(() => {})

    await showWindow(ctx, 'text', menuNewPair, 'newpair')
  } else if (prompt && prompt.dataType === 'amount') {
    console.log('amount')
  } else if (prompt && prompt.dataType === 'recipient') {
    console.log('recipient')
  } else {
    ctx.api.deleteMessage(ctx.chat.id, ctx.update.message.message_id).catch(() => {})
  }
}
