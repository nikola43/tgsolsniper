/* eslint-disable space-before-function-paren */
import { Menu } from '@grammyjs/menu'
import {
  deleteMessage,
  getStateCircle,
  readCtx,
  resetPrompt,
  writeCtx,
  onMenuOutdated
} from './utils'

export const menuNewPair = new Menu('menu-newpair', { onMenuOutdated }).dynamic(
  (ctx, range) => {
    range
      .text(
        () =>
          `${getStateCircle(readCtx(ctx, 'mintDisabled'))} Check mint disabled`,
        async (ctx) => {
          const mintDisabled = readCtx(ctx, 'mintDisabled')
          writeCtx(ctx, 'mintDisabled', !mintDisabled)
          await ctx.menu.update()
        }
      )
      .text(
        () => 'Check min liquidity',
        async (ctx) => {
          console.log('minLiquidity')
        }
      )
      .row()
      .text(
        () => `Slop Loss ${readCtx(ctx, 'stopLossPercentage')}%`,
        async (ctx) => {
          const keyboard = new Keyboard()
            .text('Cancel', (ctx) => {
              resetPrompt(ctx)
              deleteMessage(ctx, ctx.update.message.message_id)
            })
            .placeholder(
              'eg, 10% (if price drops 10% from the buy price, sell it)'
            )
            .oneTime()
          // await ctx.menu.update()
          const prompt = await ctx.reply('Input stop loss percentage', {
            reply_markup: keyboard
          })
          prompt.dataType = 'stopLossPercentage'
          ctx.session.temp.prompt = prompt
        }
      )
  }
)
