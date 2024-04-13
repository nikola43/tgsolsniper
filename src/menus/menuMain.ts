/* eslint-disable space-before-function-paren */
import { Menu } from '@grammyjs/menu'
import { onMenuOutdated, showWindow } from '../utils/bot'
import { menuNewPair } from './menuNewPair'

export const menuMain = new Menu('menu-main', { onMenuOutdated }).dynamic(
  (ctx, range) => {
    range
      .text('Buy New Pair', async () => {
        /// await showMenu(ctx, menuNewPair, 'newpair')
        showWindow(ctx, 'text', menuNewPair, 'newpair')
        ctx.session.temp.main.uiClass = 'newpair'

        //await showMenu(ctx, menuNewPair, 'newpair')
      })
      .row()
      .text('B', (ctx) => ctx.reply('You pressed B!'))
  }
)
