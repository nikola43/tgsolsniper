/* eslint-disable space-before-function-paren */
import { Menu } from '@grammyjs/menu'
import 'dotenv/config'
import {
  Bot,
  Keyboard,
  MemorySessionStorage,
  session,
  GrammyError
} from 'grammy'
import { existsSync, readFileSync, writeFileSync } from 'fs'

class FileSessionStorage extends MemorySessionStorage {
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

const initSettings = () => {
  return {
    srcChainId: 1,
    dstChainId: 1,
    token: 'ETH',
    amount: '0.01',
    recipient: undefined
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

const fileSession = async (ctx, next) => {
  const key = ctx.chat?.id.toString()
  await defaultSession(ctx, next)
  ctx.session.update = () => {
    FileSessionStorage.store(key, ctx.session.history)
  }
}

// import { BuyNewPairMenu, MainMenu } from "./menus";

const sessionStorage = new MemorySessionStorage()
sessionStorage.write('mintDisabled', false)
sessionStorage.write('minLiquidity', false)
sessionStorage.write('stopLossPercentage', 10)
// const sessionWare = session({
//   storage: sessionStorage,
//   initial: () => ({
//     mintDisabled: false,
//   }),
// });
const chatHistory = []

const showWindow = async (ctx, text, menu) => {
  const message = ctx.update.message ?? ctx.update.callback_query.message
  if (
    ctx.session.temp.main &&
    ctx.session.temp.main.message_id !== message.message_id
  ) {
    if (!message.uiClass) {
      ctx.api.deleteMessage(ctx.chat.id, message.message_id).catch(() => {})
    } else {
      ctx.api
        .deleteMessage(ctx.chat.id, ctx.session.temp.main.message_id)
        .catch(() => {})
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

const showMain = async (ctx) => {
  const text = [
    'Welcome to solana bot\\!',
    '',
    ctx.session.settings.wallet
      ? `💰 \`${ctx.session.settings.wallet.address}\``
      : undefined
  ]
    .filter((item) => item !== undefined)
    .join('\n')

  await showWindow(ctx, text, menuMain)
  ctx.session.temp.main.uiClass = 'main'
}

const onMenuOutdated = async (ctx) => {
  ctx.session.settings.wallet = undefined
  ctx.session.settings.recipient = undefined
  if (
    !ctx.session.temp.main ||
    ctx.session.temp.main.message_id !==
      ctx.update.callback_query.message.message_id
  ) {
    ctx.answerCallbackQuery().catch(() => {})
    ctx.session.temp.main = ctx.update.callback_query.message
    // ctx.api.deleteMessage(ctx.chat.id, ctx.update.callback_query.message.message_id).catch(() => {})
  }
  showMain(ctx)
}

export const getStateCircle = (value) => {
  return value ? '🟢' : '🔴'
}

function readValue(key) {
  return sessionStorage.read(key)
}

// type MyContext = Context & ConversationFlavor;
// type MyConversation = Conversation<MyContext>;
// get mintDisabled from session

// async function readUserInput(conversation: MyConversation, ctx: MyContext) {
//   await ctx.reply("How many favorite movies do you have?");
//   const count = await conversation.form.number();
//   await ctx.reply(`You have ${count} favorite movies!`);
// }

export const BuyNewPairMenuV2 = new Menu('BuyNewPairMenu').dynamic(
  (ctx, range) => {
    range.text('Source   <------------------->   Destination', () => {}).row()
  }
)

export const BuyNewPairMenu = new Menu('BuyNewPairMenu')
  .text(
    () => `${getStateCircle(readValue('mintDisabled'))} Check mint disabled`,
    async (ctx) => {
      const isMintDisabled = sessionStorage.read('mintDisabled')
      sessionStorage.write('mintDisabled', !isMintDisabled)
      await ctx.menu.update({
        immediate: true
      })
    }
  )
  .text(
    () =>
      `${getStateCircle(
        sessionStorage.read('minLiquidity')
      )} Check min liquidity`,
    async (ctx) => {
      const isMintDisabled = sessionStorage.read('minLiquidity')
      sessionStorage.write('minLiquidity', !isMintDisabled)
      await ctx.menu.update({
        immediate: true
      })
    }
  )
  .row()
  .text(
    () => `Slop Loss ${readValue('stopLossPercentage')}%`,
    async (ctx) => {
      const stopLossPercentage = readValue('stopLossPercentage')
      console.log('stopLossPercentage', stopLossPercentage)

      const keyboard = new Keyboard()
        .text('Cancel', (ctx) => {
          ctx.session.temp.prompt = undefined
          ctx.api
            .deleteMessage(ctx.chat.id, ctx.update.message.message_id)
            .catch(() => {})
        })
        .placeholder(
          'Private key (eg, 0x008e099f4163810b4567186c0d8dd847eb75f01a1c527edcf684ebf019986a81)'
        )
        .oneTime()
      await ctx.menu.update()
      const prompt = await ctx.reply('Input private key to connect', {
        reply_markup: keyboard
      })
      prompt.dataType = 'private-key'
      ctx.session.temp.prompt = prompt
    }
  )

const menuMain = new Menu('menu-main', { onMenuOutdated })
  .text('Buy New Pair', async (ctx) => {
    await ctx.reply('Check out this menu:', {
      reply_markup: BuyNewPairMenu
    })
  })
  .row()
  .text('B', (ctx) => ctx.reply('You pressed B!'))

const bot = new Bot(process.env.BOT_TOKEN)
bot.use(fileSession)
bot.use((ctx, next) => {
  if (ctx.session.temp.timeout) clearTimeout(ctx.session.temp.timeout)
  ctx.session.temp.timeout = setTimeout(() => {
    if (ctx.session.settings.wallet) {
      ctx.session.settings.wallet = undefined
      ctx.session.settings.recipient = undefined
      if (ctx.session.temp.prompt) {
        ctx.api.deleteMessage(ctx.chat.id, ctx.session.temp.prompt.message_id)
        ctx.session.temp.prompt = undefined
      }
      showMain(ctx)
    }
  }, 3600 * 1000)
  return next()
})
bot.use(BuyNewPairMenu)
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
  ctx.api
    .deleteMessage(ctx.chat.id, ctx.update.message.message_id)
    .catch(() => {})
  if (ctx.session.temp.main) {
    if (ctx.session.temp.main.message_id) {
      ctx.api
        .deleteMessage(ctx.chat.id, ctx.session.temp.main.message_id)
        .catch(() => {})
    }
    ctx.session.temp.main = undefined
  }
  showMain(ctx)
})
