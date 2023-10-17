import puppeteer from 'puppeteer'
import dotenv from 'dotenv'
import TelegramBot from 'node-telegram-bot-api'
import cron from 'node-cron'

dotenv.config()

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true })

const chatIds = process.env.CHAT_IDS.split(',')

bot.on('message', async (msg) => {
  if (msg.text.startsWith('/')) return

  const chatId = String(msg.chat.id)
  const isAuthorized = chatIds.includes(chatId)

  console.log(`Received ${isAuthorized ? 'authorized' : 'unauthorized'} message from ${chatId}: ${msg.text}`)

  if (!isAuthorized) {
    await bot.sendMessage(chatId, 'Acceso no autorizado.')
    return
  }

  await bot.sendMessage(chatId, 'Usá los comandos.')
})

bot.onText(/\/start/, async (msg) => {
  const chatId = String(msg.chat.id)

  const isAuthorized = chatIds.includes(chatId)

  const from = `#${chatId} - ${msg.from.first_name} ${msg.from.last_name} (${msg.from.username})`
  const log = `Received ${isAuthorized ? 'authorized' : 'unauthorized'} /start command from ${from}`

  if (!isAuthorized) {
    await bot.sendMessage(chatId, 'Bienvenido! Para usar el bot es necesario que estés en la lista..')
    await bot.sendMessage(process.env.ADMIN_CHAT_ID, log)
    return
  }

  await bot.sendMessage(chatId, 'Bienvenido!')

  try {
    const nextHoliday = await getNextHoliday()
    await bot.sendMessage(chatId, nextHoliday)
  } catch (error) {
    await bot.sendMessage(chatId, 'Hubo un error, comunicate con el administrador.')
    console.log(error)
  }
})

bot.onText(/\/feriado/, async (msg) => {
  const chatId = String(msg.chat.id)

  const isAuthorized = chatIds.includes(chatId)

  console.log(`Received ${isAuthorized ? 'authorized' : 'unauthorized'} /feriado command from #${chatId}`)

  if (!isAuthorized) {
    await bot.sendMessage(chatId, 'Acceso no autorizado.')
    return
  }

  try {
    const nextHoliday = await getNextHoliday()
    await bot.sendMessage(chatId, nextHoliday)
  } catch (error) {
    await bot.sendMessage(chatId, 'Hubo un error, comunicate con el administrador.')
    console.log(error)
  }
})

cron.schedule('0 12 * * 3', async () => {
  console.log('Running cron...')

  try {
    const nextHoliday = await getNextHoliday()

    for (const chatId of chatIds) {
      await bot.sendMessage(chatId, nextHoliday)
    }
  } catch (error) {
    await bot.sendMessage(chatId, 'Hubo un error al ejecutar el CRON.')
    console.log('Error running cron:')
    console.error(error)
  }
})

async function getNextHoliday() {
  const TWO_MINUTES = 2 * 60 * 1000

  let browser

  try {
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })

    const page = await browser.newPage()

    await page.setViewport({ width: 1920, height: 1080 })

    page.setDefaultNavigationTimeout(TWO_MINUTES)

    await page.goto(`${process.env.WEB_URL}-${new Date().getFullYear()}`)

    const element = await page.$$("#js-hoynoes > div > div")
    const children = await element[0].$$(':scope > *')

    let texts = []

    for (const child of children) {
      const text = await child.evaluate(c => c.textContent)
      texts.push(text)
    }

    const countdown = texts.slice(0, texts.length - 1).join(' ').trim();
    const reason = texts[texts.length - 1];

    return `${countdown}: ${reason}`
  } catch (error) {
    console.log(error)
  } finally {
    await browser?.close()
  }
}
