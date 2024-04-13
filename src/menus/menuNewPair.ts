/* eslint-disable space-before-function-paren */
import { Menu } from '@grammyjs/menu'

import {
  sendKeyboard,
  getStateCircle,
  onMenuOutdated,
  readCtx,
  writeCtx
} from '../utils/bot'
import { findNewTokens } from '../utils/solana'

export const menuNewPair = new Menu('menu-newpair', { onMenuOutdated }).dynamic(
  (ctx, range) => {
    range
      .text(
        () =>
          `🚫 Mint Disabled ${getStateCircle(
            readCtx(ctx, 'settings', 'mintDisabled')
          )}`,
        async (ctx) => {
          const mintDisabled = readCtx(ctx, 'settings', 'mintDisabled')
          writeCtx(ctx, 'settings', 'mintDisabled', !mintDisabled)
          await ctx.menu.update()
        }
      )
      .text(
        () =>
          `🔥 LP Burned ${getStateCircle(
            readCtx(ctx, 'settings', 'lpBurned')
          )}`,
        async (ctx) => {
          const lpBurned = readCtx(ctx, 'settings', 'lpBurned')
          writeCtx(ctx, 'settings', 'lpBurned', !lpBurned)
          await ctx.menu.update()
        }
      )
      .row()
      .text(
        () => `💵 Buy Amount ${readCtx(ctx, 'settings', 'minLiquidity')} SOL`,
        async (ctx) => {
          console.log('minLiquidity')
          sendKeyboard(
            ctx,
            'Set minimum liquidity (0) for disable',
            'minLiquidity'
          )
        }
      )
      .text(
        () =>
          `💰 Min Liquidity ${readCtx(ctx, 'settings', 'minLiquidity')} SOL`,
        async (ctx) => {
          console.log('minLiquidity')
          sendKeyboard(
            ctx,
            'Set minimum liquidity (0) for disable',
            'minLiquidity'
          )
        }
      )
      .row()
      .text(
        () => `📉 Slop Loss ${readCtx(ctx, 'settings', 'stopLossPercentage')}%`,
        async (ctx) => {
          sendKeyboard(ctx, 'Input stop loss percentage', 'stopLossPercentage')
        }
      )
      .text(
        () =>
          `📈 Take Profit ${readCtx(ctx, 'settings', 'takeProfitPercentage')}%`,
        async (ctx) => {
          sendKeyboard(
            ctx,
            'Input stop loss percentage',
            'takeProfitPercentage'
          )
        }
      )
      .row()
      .text('Start', async (ctx) => {
        await ctx.reply('Listening new pairs...')
        findNewTokens(ctx)
      })
      .row()
      .text('Back', async (ctx) => {
        await ctx.menu!.parent!.update()
      })
  }
)
