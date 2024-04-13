/* eslint-disable space-before-function-paren */
import { Menu } from '@grammyjs/menu'
import { onMenuOutdated, showMenu } from '../botutils/utils'

const menuMain = new Menu('menu-main', { onMenuOutdated }).dynamic(
  (ctx, range) => {
    range
      .text('Buy New Pair', () => showMenu())
      .row()
      .text('B', (ctx) => ctx.reply('You pressed B!'))
  }
)
