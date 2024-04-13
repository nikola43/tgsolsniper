/* eslint-disable space-before-function-paren */
import { Menu } from '@grammyjs/menu'

import {
  buildKeyboard,
  getStateCircle,
  onMenuOutdated,
  readCtx,
  writeCtx
} from '../utils/botutils'

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
        () =>
          `${getStateCircle(
            Number(readCtx(ctx, 'minLiquidity')) !== 0
          )} Minimum liquidity ${readCtx(ctx, 'minLiquidity')} SOL`,
        async (ctx) => {
          console.log('minLiquidity')
          buildKeyboard(
            ctx,
            'Set minimum liquidity (0) for disable',
            'minLiquidity'
          )
        }
      )
      .row()
      .text(
        () => `Slop Loss ${readCtx(ctx, 'stopLossPercentage')}%`,
        async (ctx) => {
          buildKeyboard(ctx, 'Input stop loss percentage', 'stopLossPercentage')
          //   const keyboard = new Keyboard()
          //     .text('Cancel')
          //     .placeholder(
          //       'eg, 10% (if price drops 10% from the buy price, sell it)'
          //     )
          //     .oneTime()
          //   // await ctx.menu.update()
          //   const prompt = await ctx.reply('Input stop loss percentage', {
          //     reply_markup: keyboard
          //   })
          //   prompt.dataType = 'stopLossPercentage'
          //   ctx.session.temp.prompt = prompt
          // }
        }
      )
      .row()
      .text('Back', async (ctx) => {
        await ctx.menu!.parent!.update()
      })
  }
)
