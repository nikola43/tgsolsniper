Strategy 1 is good but need to set tP and sl as preset on all new pairs once criteria is met

Strategy two should be make it a manual sniper you put contract address and you set sniper

Staretgy 3 should be you put link of telegram channels and it scrapes contract address and you put min liq and mc to snipe

So let me explain how bot works

Bot listen new pairs on raydium, check token have min liquidity for example 10 sol, check mint is disabled and if both checks are true, add token to "posible buy token list" when token burn LP then buy token and set stop loss and take profit

        () => `Slop Loss ${readCtx(ctx, 'stopLossPercentage')}%`,
        async (ctx) => {
          const keyboard = new Keyboard()
            .text('Cancel', (ctx) => {
              resetPrompt(ctx)
              ctx.api.deleteMessage(ctx.chat.id, ctx.update.message.message_id)
            })
            .placeholder(







              // bot.use(

// session({
// type: 'multi',
// // @ts-ignore
// foo: {
// // these are also the default values
// storage: new MemorySessionStorage(),
// initial: () => undefined,
// getSessionKey: (ctx: any) => ctx.chat?.id.toString()
// },
// bar: {
// initial: () => ({ prop: 0 }),
// storage: freeStorage(bot.token)
// },
// baz: {}
// })
// )

/\*
bot.use(
session({
initial,
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
)

\*/
