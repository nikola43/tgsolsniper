import {
  Bot,
  session,
  GrammyError,
  Keyboard,
  MemorySessionStorage,
  Context,
} from "grammy";
import "dotenv/config";
import { Menu } from "@grammyjs/menu";
import {
  type Conversation,
  type ConversationFlavor,
  conversations,
  createConversation,
} from "@grammyjs/conversations";

//import { BuyNewPairMenu, MainMenu } from "./menus";

const sessionStorage = new MemorySessionStorage();
sessionStorage.write("mintDisabled", false);
sessionStorage.write("minLiquidity", false);
sessionStorage.write("stopLossPercentage", 10);
// const sessionWare = session({
//   storage: sessionStorage,
//   initial: () => ({
//     mintDisabled: false,
//   }),
// });

export const getStateCircle = (value: boolean) => {
  return value ? "🟢" : "🔴";
};

function readString(key: string) {
  return sessionStorage.read(key) as string;
}

function readBoolean(key: string) {
  return sessionStorage.read(key) as boolean;
}

function readNumber(key: string) {
  return sessionStorage.read(key) as number;
}

// type MyContext = Context & ConversationFlavor;
// type MyConversation = Conversation<MyContext>;
// get mintDisabled from session

// async function readUserInput(conversation: MyConversation, ctx: MyContext) {
//   await ctx.reply("How many favorite movies do you have?");
//   const count = await conversation.form.number();
//   await ctx.reply(`You have ${count} favorite movies!`);
// }

export const BuyNewPairMenuV2 = new Menu("BuyNewPairMenu").dynamic(
  (ctx, range) => {
    range.text("Source   <------------------->   Destination", () => {}).row();
  }
);

export const BuyNewPairMenu = new Menu("BuyNewPairMenu")
  .text(
    () => `${getStateCircle(readBoolean("mintDisabled"))} Check mint disabled`,
    async (ctx) => {
      const isMintDisabled = sessionStorage.read("mintDisabled") as boolean;
      sessionStorage.write("mintDisabled", !isMintDisabled);
      await ctx.menu.update({
        immediate: true,
      });
    }
  )
  .text(
    () =>
      `${getStateCircle(
        sessionStorage.read("minLiquidity") as boolean
      )} Check min liquidity`,
    async (ctx) => {
      const isMintDisabled = sessionStorage.read("minLiquidity") as boolean;
      sessionStorage.write("minLiquidity", !isMintDisabled);
      await ctx.menu.update({
        immediate: true,
      });
    }
  )
  .row()
  .text(
    () => `Slop Loss ${readNumber("stopLossPercentage")}%`,
    async (ctx) => {
      const stopLossPercentage = readNumber("stopLossPercentage");

      const keyboard = new Keyboard()
        .text("Cancel")
        .placeholder("Amount")
        .oneTime()


      const prompt = await ctx.reply("Input amount to transfer", {
        reply_markup: keyboard,
      });
      await ctx.menu.update();
    }
  )

export const MainMenu = new Menu("MainMenu")
  .text("Buy New Pair", async (ctx) => {
    await ctx.reply("Check out this menu:", { reply_markup: BuyNewPairMenu });
  })
  .row()
  .text("B", (ctx) => ctx.reply("You pressed B!"));

const bot = new Bot(process.env.BOT_TOKEN!);

// Make it interactive.
bot.use(BuyNewPairMenu);
bot.use(MainMenu);

bot.start({
  onStart: (botInfo) => {
    console.log(`Bot ${botInfo.username} is up and running!`);
  },
});

bot.command("start", async (ctx) => {
  await ctx.reply(
    "Hello, I am a bot that can remember your name. What is your name?"
  );
  await ctx.reply("Check out this menu:", { reply_markup: MainMenu });
  //ctx.session.step = 'ask_name'
});
