import {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers,
    jidDecode
} from '@whiskeysockets/baileys'
import pino from 'pino'
import fs from 'fs'
import { Boom } from '@hapi/boom'
import chalk from 'chalk'
import NodeCache from 'node-cache'
import 'dotenv/config'
import qrcode from 'qrcode-terminal'

const logger = pino({ level: 'silent' })
const msgRetryCounterCache = new NodeCache()
const sessionDir = './session'

// Bot Config
const owner = ['256706106326@s.whatsapp.net'] // Your number with country code
const botname = 'TRAILER ❄️ RANKS'
const prefix = '.'
const mode = 'private'

if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true })

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
    const { version, isLatest } = await fetchLatestBaileysVersion()
    console.log(chalk.green(`Using WA v${version.join('.')}, isLatest: ${isLatest}`))

    const sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        msgRetryCounterCache,
        generateHighQualityLinkPreview: true,
        browser: Browsers.macOS('Desktop'),
        getMessage: async (key) => {
            return { conversation: 'TRAILER RANKS BOT' }
        }
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update
        if (qr) {
            console.log(chalk.yellow('Scan this QR with WhatsApp:'))
            qrcode.generate(qr, { small: true })
        }
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode!== DisconnectReason.loggedOut
            console.log(chalk.red('Connection closed: '), lastDisconnect.error, ', reconnecting: ', shouldReconnect)
            if (shouldReconnect) startBot()
        } else if (connection === 'open') {
            console.log(chalk.green('✅ Bot connected as TRAILER ❄️ RANKS'))
            sock.sendMessage(owner[0], { text: `*${botname}* Connected Successfully ✅\n*Prefix:* ${prefix}\n*Mode:* ${mode}\n*Version:* v6.2.0` })
        }
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0]
        if (!m.message || m.key.fromMe) return
        
        const messageType = Object.keys(m.message)[0]
        const body = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || ''
        const from = m.key.remoteJid
        const isGroup = from.endsWith('@g.us')
        const sender = isGroup? m.key.participant : from
        
        if (!body.startsWith(prefix)) return
        const args = body.slice(prefix.length).trim().split(/ +/)
        const command = args.shift().toLowerCase()

        // OWNER ONLY check for private mode
        if (mode === 'private' &&!owner.includes(sender)) return

        console.log(chalk.cyan(`[CMD] ${command} from ${sender}`))

        // BASIC MENU COMMAND
        if (command === 'menu' || command === 'help') {
            const menu = `┏❏ *TRAILER ❄️ RANKS*
┃ *Owner:* Raider🍁
┃ *Prefix:* ${prefix}
┃ *Mode:* ${mode}
┃ *Version:* v6.2.0
┃ *Speed:* ${new Date() - m.messageTimestamp * 1000}ms
┃ *Uptime:* ${runtime(process.uptime())}
┗❏

┏❏ *OWNER*
┃ ➤ ${prefix}addsudo
┃ ➤ ${prefix}mode
┃ ➤ ${prefix}restart
┗❏

┏❏ *GENERAL*
┃ ➤ ${prefix}ping
┃ ➤ ${prefix}alive
┃ ➤ ${prefix}owner
┗❏

Type ${prefix}ping to test bot`
            await sock.sendMessage(from, { text: menu }, { quoted: m })
        }

        if (command === 'ping') {
            const start = new Date().getTime()
            await sock.sendMessage(from, { text: '*Testing speed...*' }, { quoted: m })
            const end = new Date().getTime()
            await sock.sendMessage(from, { text: `*Pong!* 🏓\n*Speed:* ${end - start}ms` }, { quoted: m })
        }

        if (command === 'alive') {
            await sock.sendMessage(from, { 
                text: `*${botname}* is Active ✅\n*Owner:* Raider🍁\n*Number:* 256706106326\n*Mode:* ${mode}`,
            }, { quoted: m })
        }

        if (command === 'owner') {
            await sock.sendMessage(from, { 
                text: `*Bot Owner:* Raider🍁\n*WhatsApp:* wa.me/256706106326`
            }, { quoted: m })
        }

    })
}

function runtime(seconds) {
    seconds = Number(seconds)
    var d = Math.floor(seconds / (3600 * 24))
    var h = Math.floor(seconds % (3600 * 24) / 3600)
    var m = Math.floor(seconds % 3600 / 60)
    var s = Math.floor(seconds % 60)
    var dDisplay = d > 0? d + (d == 1? " day, " : " days, ") : ""
    var hDisplay = h > 0? h + (h == 1? " hour, " : " hours, ") : ""
    var mDisplay = m > 0? m + (m == 1? " minute, " : " minutes, ") : ""
    var sDisplay = s > 0? s + (s == 1? " second" : " seconds") : ""
    return dDisplay + hDisplay + mDisplay + sDisplay
}

startBot()
