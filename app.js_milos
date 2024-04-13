const {
  Bot,
  session,
  GrammyError,
  Keyboard,
  MemorySessionStorage
} = require('grammy')
const { Menu } = require('@grammyjs/menu')
const { Worker } = require('node:worker_threads')
// const { conversations, createConversation } = require("@grammyjs/conversations")
// const { hydrate, hydrateContext } = require("@grammyjs/hydrate")
const { ethers } = require('ethers')
// const { freeStorage } = require("@grammyjs/storage-free")
const { CHAINS, CHAIN_SEPOLIA, CHAIN_BASE_SEPOLIA } = require('./config')
const { existsSync, readFileSync, writeFileSync } = require('node:fs')
require('dotenv').config()

const isTestnet = process.argv[2] == 'testnet'
const chatHistory = []

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
    srcChainId: CHAIN_SEPOLIA,
    dstChainId: CHAIN_BASE_SEPOLIA,
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

const formatElasped = (time) => {
  // const secs = Math.floor((Date.now() - time) / 1000)
  // return secs
  const mins = Math.floor((Date.now() - time) / 60000)
  if (!mins) return undefined
  if (mins < 60) return `${mins} minute${mins == 1 ? '' : 's'}`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours == 1 ? '' : 's'}`
  const days = Math.floor(hours / 24)
  return `${days} day${days == 1 ? '' : 's'}`
}

const escapeMarkdown = (text) => {
  return text.replace(/([\.\+\-\|\(\)\#\_\[\]\~\=\{\}\,\!\`])/g, '\\$1')
}

const showWindow = async (ctx, text, menu) => {
  const message = ctx.update.message ?? ctx.update.callback_query.message
  if (
    ctx.session.temp.main &&
    ctx.session.temp.main.message_id != message.message_id
  ) {
    if (!message.uiClass)
      ctx.api.deleteMessage(ctx.chat.id, message.message_id).catch(() => {})
    else {
      ctx.api
        .deleteMessage(ctx.chat.id, ctx.session.temp.main.message_id)
        .catch(() => {})
      if (ctx.session.temp.main.from.id == message.from.id)
        ctx.session.temp.main = message
      else ctx.session.temp.main = undefined
      chatHistory.push([ctx.chat.id, message.message_id])
    }
  } else if (message.uiClass) {
    ctx.session.temp.main = message
  }
  if (ctx.session.temp.main)
    await ctx.api
      .editMessageText(ctx.chat.id, ctx.session.temp.main.message_id, text, {
        reply_markup: menu,
        parse_mode: 'MarkdownV2'
      })
      .catch(() => {})
  else
    ctx.session.temp.main = await ctx
      .reply(text, { reply_markup: menu, parse_mode: 'MarkdownV2' })
      .catch(() => {})
}

const showMain = async (ctx) => {
  const text = [
    '🙌 Welcome CCIP Bridge\\!',
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

const showTransfer = async (ctx) => {
  if (ctx.session.settings.wallet) {
    const {
      id,
      srcChainId,
      dstChainId,
      token,
      amount,
      recipient,
      sentAt,
      state
    } =
      ctx.session.settings.tx && ctx.session.settings.tx.id
        ? ctx.session.settings.tx
        : ctx.session.settings
    const elapsed = !!sentAt && formatElasped(sentAt)
    const text = [
      '💼 Transfer',
      '',
      srcChainId
        ? `✅ Source Chain: ${CHAINS[srcChainId].name}`
        : '❌ Source Chain: Not set',
      dstChainId
        ? `✅ Destination Chain: ${CHAINS[dstChainId].name}`
        : '❌ Source Chain: Not set',
      token && srcChainId && dstChainId
        ? `✅ Token: ${token}`
        : '❌ Token: Not set',
      amount ? `✅ Amount: ${amount}` : '❌ Amount: Not set',
      recipient ? `✅ Recipient: ${recipient}` : '❌ Recipient: Not set',
      '',
      id
        ? `${
            state == 2
              ? '🟢 Success'
              : state == 3
              ? '🔴 Failed'
              : `🟡 Waiting for finality (${
                  elapsed ? `${elapsed} ago` : 'just before'
                })`
          }`
        : ctx.session.settings.tx
        ? '⚪ Preparing transaction'
        : undefined
    ]
      .filter((item) => item !== undefined)
      .join('\n')

    await showWindow(ctx, escapeMarkdown(text), menuTransfer)

    if (id && state == 1 && ctx.session.temp.main.uiClass != 'transfer') {
      threadReceive(ctx, id)
    }
    if (id) ctx.session.temp.main.uiId = id
    else if (ctx.session.temp.main.uiClass != 'transfer')
      ctx.session.temp.main.uiId = Date.now()
    ctx.session.temp.main.uiClass = 'transfer'
  } else showMain(ctx)
}

const showTransactions = async (ctx) => {
  // const { pending, transactions } = ctx.session.history
  if (ctx.session.settings.wallet) {
    const text = '💼 Transactions'
    await showWindow(ctx, text, menuTransactions)
    ctx.session.temp.main.uiClass = 'transactions'
    ctx.session.history.pending.map((tx) => threadReceive(ctx, tx.id))
  } else showMain(ctx)
}

const showError = async (ctx, message) => {
  ctx
    .reply(['🔸'.repeat(20), '', message, '', '🔸'.repeat(20)].join('\n'))
    .then((msg) => {
      chatHistory.push([ctx.chat.id, msg.message_id])
      setTimeout(
        () =>
          bot.api.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {}),
        5 * 1000
      )
    })
}

const showMessage = async (ctx, message) => {
  ctx.reply(`🏆 ${message}`).then((msg) => {
    chatHistory.push([ctx.chat.id, msg.message_id])
    setTimeout(
      () => bot.api.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {}),
      5 * 1000
    )
  })
}

const threadSend = async (ctx) => {
  const id = ctx.session.temp.main.uiId
  const {
    wallet,
    srcChainId,
    dstChainId,
    token: symbol,
    amount,
    recipient
  } = ctx.session.settings
  const srcChain = CHAINS[srcChainId]
  const dstChain = CHAINS[dstChainId]
  const token = srcChain.tokens.find((t) => t.symbol == symbol)

  const worker = new Worker('./workers/mixer', {
    workerData: {
      id,
      privateKey: wallet.privateKey,
      srcChainId,
      dstChainId,
      srcChain,
      dstChain,
      token,
      amount,
      recipient
    }
  })
  worker.on('message', async (message) => {
    const { id, event, data } = message
    if (event == 'exit') {
      ctx.session.settings.tx = undefined
    } else if (event == 'error') {
      ctx.session.settings.tx = undefined
      showError(ctx, data)
      if (
        ctx.session.temp.main.uiId == id &&
        ctx.session.temp.main.uiClass == 'transfer'
      ) {
        showTransfer(ctx)
      }
    } else if (event == 'done') {
      ctx.session.history.pending.push(data)
      ctx.session.settings.tx = data
      ctx.session.update()
      if (
        ctx.session.temp.main.uiId == id &&
        ctx.session.temp.main.uiClass == 'transfer'
      ) {
        showTransfer(ctx)
        threadReceive(ctx, data.id)
      } else showMessage(ctx, 'Successfully committed')
    }
    ctx.session.temp.mixers[id] = undefined
    worker.terminate()
  })
  // worker.on('exit', () => {
  // })
  ctx.session.temp.mixers[id] = worker
}

const threadReceive = async (ctx, id) => {
  if (ctx.session.temp.monitors[id]) {
    ctx.session.temp.monitors[id].terminate()
  }
  const tx = ctx.session.history.pending.find((tx) => tx.id == id)
  if (!tx || tx.state == 2) return
  const { dstChainId } = tx
  const dstChain = CHAINS[dstChainId]
  const worker = new Worker('./workers/monitor', {
    workerData: {
      id,
      dstChain,
      sentAt: tx.sentAt
    }
  })
  worker.on('message', (message) => {
    const { id, event, data } = message
    if (event == 'exit') {
    } else if (event == 'error') {
      showError(ctx, data)
    } else if (event == 'done') {
      tx.state = 2
      const { pending, transactions } = ctx.session.history
      pending.splice(pending.indexOf(tx), 1)
      transactions.push(tx)
      ctx.session.update()
      if (
        ctx.session.temp.main.uiId == id &&
        ctx.session.temp.main.uiClass == 'transfer'
      )
        showTransfer(ctx)
      else if (ctx.session.temp.main.uiClass == 'transactions')
        showTransactions(ctx)
      else showMessage(ctx, 'Successfully committed')
    } else if (event == 'update') {
      // console.log('update elapsed', id, ctx.session.temp.main.uiId, ctx.session.temp.main.uiClass)
      if (
        ctx.session.temp.main.uiId == id &&
        ctx.session.temp.main.uiClass == 'transfer'
      )
        showTransfer(ctx)
      else if (ctx.session.temp.main.uiClass == 'transactions')
        showTransactions(ctx)
      return
    }
    ctx.session.temp.monitors[id] = undefined
    worker.terminate()
  })
  worker.on('exit', () => {})
  ctx.session.temp.monitors[id] = worker
}

const handleMix = async (ctx) => {
  const {
    wallet,
    srcChainId,
    dstChainId,
    token: symbol,
    amount,
    recipient
  } = ctx.session.settings
  if (!wallet) showMain(ctx)
  else if (!srcChainId) showError(ctx, 'Source chain has not been set')
  else if (!dstChainId) showError(ctx, 'Destination chain has not been set')
  else if (!symbol) showError(ctx, 'Token has not been selected')
  else if (!amount)
    showError(ctx, 'Amount of token to transfer has not been inputed')
  else if (!recipient)
    showError(ctx, 'Receiver to be transferred has not been inputed')
  else {
    try {
      ctx.session.settings.tx = { state: 0 }
      await showTransfer(ctx)

      threadSend(ctx)
    } catch (ex) {
      console.log(ex)
    }
  }
}

const onMenuOutdated = async (ctx) => {
  ctx.session.settings.wallet = undefined
  ctx.session.settings.recipient = undefined
  if (
    !ctx.session.temp.main ||
    ctx.session.temp.main.message_id !=
      ctx.update.callback_query.message.message_id
  ) {
    ctx.answerCallbackQuery().catch(() => {})
    ctx.session.temp.main = ctx.update.callback_query.message
    // ctx.api.deleteMessage(ctx.chat.id, ctx.update.callback_query.message.message_id).catch(() => {})
  }
  showMain(ctx)
}

const menuMain = new Menu('menu-main', { onMenuOutdated }).dynamic(
  (ctx, range) => {
    if (!ctx.session.settings.wallet) {
      range.text(
        ctx.session.temp.prompt &&
          ctx.session.temp.prompt.dataType == 'private-key'
          ? '🔌 Connecting...'
          : '🔌 Connect Wallet',
        async (ctx) => {
          // ctx.session.settings.wallet = new ethers.Wallet(process.env.DEPLOYER_KEY)
          // showMain(ctx)
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
          chatHistory.push([ctx.chat.id, prompt.message_id])
        }
      )
    } else {
      range
        .text('📝 New Transfer', menuTransfer, (ctx) => {
          ctx.session.settings.tx = undefined
          showTransfer(ctx)
        })
        .text('📋 Transaction history', menuTransactions, showTransactions)
        .row()
        .text('🛠️ Settings', async (ctx) => {})
        .row()
        .text('🔌 Disconnect', async (ctx) => {
          ctx.session.settings.wallet = undefined
          ctx.session.settings.recipient = undefined
          showMain(ctx)
        })
    }
  }
)

const menuTransactions = new Menu('menu-transactions', { onMenuOutdated })
  .dynamic((ctx, range) => {
    const { pending, transactions } = ctx.session.history
    const offset = ctx.session.settings.offset ?? 0
    const size = 5
    const txs = [
      ...pending.sort((tx1, tx2) => tx2.sentAt - tx1.sentAt),
      ...transactions.sort((tx1, tx2) => tx2.sentAt - tx1.sentAt)
    ]
    for (const tx of txs.slice(offset, offset + size)) {
      range
        .text(
          [
            tx.state == 1
              ? `🟡    ${tx.amount} ${tx.token}`
              : `${tx.state == 2 ? '🟢' : '🔴'}    ${tx.amount} ${tx.token}`,
            `${CHAINS[tx.srcChainId].name} -> ${CHAINS[tx.dstChainId].name}`,
            tx.state == 1
              ? `${formatElasped(tx.sentAt)} ago`
              : new Date(tx.sentAt).toLocaleString()
          ].join('   |   '),
          menuTransfer,
          (ctx) => {
            ctx.session.settings.tx = tx
            ctx.session.settings.back = 'history'
            showTransfer(ctx)
          }
        )
        .row()
    }
    if (txs.length > size) {
      const last = txs.length - (txs.length % size)
      range
        .text('⏮', (ctx) => {
          ctx.session.settings.offset = 0
          ctx.menu.update()
        })
        .text('◀️', (ctx) => {
          ctx.session.settings.offset = Math.max(0, offset - 5)
          ctx.menu.update()
        })
        .text(
          `${offset + 1} - ${Math.min(offset + 5, txs.length)} / ${txs.length}`
        )
        .text('▶️', (ctx) => {
          ctx.session.settings.offset = Math.min(last, Number(offset) + 5)
          ctx.menu.update()
        })
        .text('⏭', (ctx) => {
          ctx.session.settings.offset = last
          ctx.menu.update()
        })
    }
  })
  .row()
  .text('🔙 Back', showMain)

const menuTransfer = new Menu('menu-transfer', { onMenuOutdated })
  .dynamic((ctx, range) => {
    const { wallet, srcChainId, dstChainId, token, amount, recipient, tx } =
      ctx.session.settings
    if (!tx) {
      range
        .text('Source   <------------------->   Destination', () => {})
        .row()
        .submenu(() => {
          if (!srcChainId) return `🔴 Source chain`
          return `🟢 ${CHAINS[srcChainId].name}`
        }, 'submenu-source-chains')
        .submenu(() => {
          if (!dstChainId) return `🔴 Destination chain`
          return `🟢 ${CHAINS[dstChainId].name}`
        }, 'submenu-destination-chains')
        .row()
        .text('-------------   Token   -------------', () => {})
        .row()
        .dynamic((ctx, range) => {
          if (!srcChainId || !dstChainId) return
          let count = 1
          for (const symbol of CHAINS[srcChainId].supports[dstChainId]) {
            range.text(`${token == symbol ? '🟡' : '⚪'} ${symbol}`, (ctx) => {
              ctx.session.settings.token = symbol
              showTransfer(ctx)
            })
            if (count % 4 == 0) range.row()
            count++
          }
        })
        .row()
        .text(
          (ctx) =>
            ctx.session.temp.prompt &&
            ctx.session.temp.prompt.dataType == 'amount'
              ? '💲 Amount inputing...'
              : '💲 Amount',
          async (ctx) => {
            const keyboard = new Keyboard()
              .text('0.1')
              .text('0.5')
              .text('1')
              .text('5')
              .row()
              .text('100')
              .text('500')
              .text('1000')
              .text('5000')
              .row()
              .text('Cancel')
              .placeholder('Amount')
              .oneTime()
            await ctx.menu.update()
            const prompt = await ctx.reply('Input amount to transfer', {
              reply_markup: keyboard
            })
            prompt.dataType = 'amount'
            ctx.session.temp.prompt = prompt
            chatHistory.push([ctx.chat.id, prompt.message_id])
          }
        )
        .text(
          (ctx) =>
            ctx.session.temp.prompt &&
            ctx.session.temp.prompt.dataType == 'recipient'
              ? '💰 Recipient inputing...'
              : '💰 Recipient',
          async (ctx) => {
            const keyboard = new Keyboard()
              .text(wallet.address)
              .row()
              .text('Cancel')
              .placeholder('Recipient')
              .oneTime()
            await ctx.menu.update()
            const prompt = await ctx.reply(
              'Input recipient address to transfer',
              { reply_markup: keyboard }
            )
            prompt.dataType = 'recipient'
            ctx.session.temp.prompt = prompt
            chatHistory.push([ctx.chat.id, prompt.message_id])
          }
        )
        .row()
        .text('➡️ Start Mix', handleMix)
    }
  })
  .row()
  .text('🔙 Back', menuTransactions, (ctx) => {
    if (ctx.session.settings.back == 'history') {
      ctx.session.settings.back = undefined
      showTransactions(ctx)
    } else showMain(ctx)
  })
// .row()
// .dynamic((ctx, range) => {
//     if(ctx.session.settings.tx)
//         range.text('🔄 Restart', (ctx) => {})
// })

const menuSrcChains = new Menu('submenu-source-chains', { onMenuOutdated })
  .dynamic((ctx, range) => {
    let count = 1
    for (const id in CHAINS) {
      if (!!CHAINS[id].testnet != isTestnet) continue
      range.text(
        `${ctx.session.settings.srcChainId == id ? '🟡' : '⚪'} ${
          CHAINS[id].name
        }`,
        (ctx) => {
          if (ctx.session.settings.dstChainId == id)
            ctx.session.settings.dstChainId = ctx.session.settings.srcChainId
          ctx.session.settings.srcChainId = id
          if (
            ctx.session.settings.dstChainId &&
            ctx.session.settings.token &&
            !CHAINS[id].supports[ctx.session.settings.dstChainId].includes(
              ctx.session.settings.token
            )
          ) {
            ctx.session.settings.token =
              CHAINS[id].supports[ctx.session.settings.dstChainId][0]
          }
          showTransfer(ctx)
        }
      )
      if (count % 2 == 0) range.row()
      count++
    }
  })
  .row()
  .back('🔙 Back')
const menuDstChains = new Menu('submenu-destination-chains', { onMenuOutdated })
  .dynamic((ctx, range) => {
    let count = 1
    for (const id in CHAINS) {
      if (!!CHAINS[id].testnet != isTestnet) continue
      if (id != ctx.session.settings.srcChainId) {
        range.text(
          `${ctx.session.settings.dstChainId == id ? '🟡' : '⚪'} ${
            CHAINS[id].name
          }`,
          (ctx) => {
            ctx.session.settings.dstChainId = id
            if (
              ctx.session.settings.srcChainId &&
              ctx.session.settings.token &&
              !CHAINS[ctx.session.settings.srcChainId].supports[id].includes(
                ctx.session.settings.token
              )
            ) {
              ctx.session.settings.token =
                CHAINS[ctx.session.settings.srcChainId].supports[id][0]
            }
            showTransfer(ctx)
          }
        )
        if (count % 2 == 0) range.row()
        count++
      }
    }
  })
  .row()
  .back('🔙 Back')

menuTransfer.register(menuSrcChains)
menuTransfer.register(menuDstChains)

const bot = new Bot(process.env.BOT_TOKEN)

bot.use(fileSession)
// bot.use(hydrate())
// bot.use(hydrateContext())
// composer.use(conversations())
// composer.use(createConversation(inputPrivateKey, "input-private-key"))
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
bot.use(menuMain)
bot.use(menuTransfer)
bot.use(menuTransactions)

bot.command('start', async (ctx) => {
  ctx.api
    .deleteMessage(ctx.chat.id, ctx.update.message.message_id)
    .catch(() => {})
  if (ctx.session.temp.main) {
    if (ctx.session.temp.main.message_id)
      ctx.api
        .deleteMessage(ctx.chat.id, ctx.session.temp.main.message_id)
        .catch(() => {})
    ctx.session.temp.main = undefined
  }
  showMain(ctx)
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

bot.on('message', async (ctx) => {
  const prompt = ctx.session.temp.prompt
  if (prompt && prompt.dataType == 'private-key') {
    const pkey = ctx.update.message.text
    if (/^(0x)?[\da-fA-F]{64}$/.test(pkey)) {
      const wallet = new ethers.Wallet(pkey)
      ctx.session.settings.wallet = wallet
      ctx.session.settings.recipient = wallet.address
    }
    ctx.session.temp.prompt = undefined
    ctx.api.deleteMessage(ctx.chat.id, prompt.message_id).catch(() => {})
    ctx.api
      .deleteMessage(ctx.chat.id, ctx.update.message.message_id)
      .catch(() => {})
    showMain(ctx)
  } else if (prompt && prompt.dataType == 'amount') {
    const amount = ctx.update.message.text
    if (Number(amount)) {
      ctx.session.settings.amount = amount
    }
    ctx.session.temp.prompt = undefined
    ctx.api.deleteMessage(ctx.chat.id, prompt.message_id).catch(() => {})
    ctx.api
      .deleteMessage(ctx.chat.id, ctx.update.message.message_id)
      .catch(() => {})
    showTransfer(ctx)
  } else if (prompt && prompt.dataType == 'recipient') {
    const recipient = ctx.update.message.text
    if (/^0x[\da-fA-F]{40}$/.test(recipient)) {
      ctx.session.settings.recipient = recipient
    }
    ctx.session.temp.prompt = undefined
    ctx.api.deleteMessage(ctx.chat.id, prompt.message_id).catch(() => {})
    ctx.api
      .deleteMessage(ctx.chat.id, ctx.update.message.message_id)
      .catch(() => {})
    showTransfer(ctx)
  } else {
    ctx.api
      .deleteMessage(ctx.chat.id, ctx.update.message.message_id)
      .catch(() => {})
  }
})

// bot.on('callback_query', async (ctx) => {
//     if(!ctx.session.temp.main) {
//         ctx.answerCallbackQuery()
//         ctx.api.deleteMessage(ctx.chat.id, ctx.update.callback_query.message.message_id)
//         ctx.session.temp.main = await ctx.reply('Welcome!', { reply_markup: menuMain })
//     }
// })

bot.start({
  onStart: (botInfo) => {
    // bot.api.setMyCommands([
    //     { command: "menu", description: "Show main menu" },
    //     { command: "social", description: "Open social tracker" },
    // ]);
    //     ctx.api.deleteMessage(ctx.chat.id, ctx.update.message.message_id).catch(() => {})
    //     if(ctx.session.temp.main)
    //         ctx.api.deleteMessage(ctx.chat.id, ctx.session.temp.main.message_id).catch(() => {})
    //     ctx.session.temp.main = await ctx.reply('Welcome!', { reply_markup: menuMain })
    // }
  }
})

process.once('SIGINT', async () => {
  // for(const [cid, mid] of chatHistory) {
  //     bot.api.deleteMessage(cid, mid).catch(() => {})
  // }
  bot.stop('SIGINT')
})
process.once('SIGTERM', async () => {
  // for(const [cid, mid] of chatHistory) {
  //     bot.api.deleteMessage(cid, mid).catch(() => {})
  // }
  bot.stop('SIGTERM')
})
