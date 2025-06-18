const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  generateWAMessageContent,
  mediaMessageSHA256B64,
  generateWAMessageFromContent,
} = require("lotusbail");
const { Boom } = require("@hapi/boom");
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const pino = require("pino");
const QRCode = require("qrcode");
const readline = require("readline");
const { saveMessageToDB } = require("../models/messageModel");

const SESSION_FOLDER = process.env.SESSION_FOLDER || "./sessions";

if (!fs.existsSync(SESSION_FOLDER)) {
  fs.mkdirSync(SESSION_FOLDER, { recursive: true });
}

let waSocket = null;
let connectionState = "disconnected";
let qrCode = null;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const connectWhatsApp = async () => {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_FOLDER);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: "silent" }),
    defaultQueryTimeoutMs: 60000,
  });

  waSocket = sock;

  if (!sock.authState.creds.registered) {
    console.log(
      chalk.bold.cyan(`
◤━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◥
❯ Status  : ${chalk.greenBright("● WAITING INPUT")}
❯ Time    : ${chalk.white(new Date().toLocaleTimeString())}
◣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◢`)
    );

    rl.question(chalk.cyan(" ❯ Number  : "), async (number) => {
      const phoneNumber = number.replace(/[^0-9]/g, "");
      try {
        const code = await waSocket.requestPairingCode(phoneNumber);
        const formattedCode = code.match(/.{1,4}/g)?.join("-") || code;
        console.clear();
        console.log(
          chalk.bold.cyan(`
◤━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◥
❯ Number : ${chalk.greenBright(phoneNumber)}
❯ Code   : ${chalk.bold.white(formattedCode)} 
❯ Time   : ${chalk.white(new Date().toLocaleTimeString())}
◣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◢`)
        );
      } catch (error) {
        console.log(
          chalk.redBright("❌ Gagal mendapatkan kode pairing:", error)
        );
        process.exit(1);
      }
    });
  }

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      connectionState = "disconnected";

      const shouldReconnect =
        lastDisconnect?.error instanceof Boom
          ? lastDisconnect.error.output.statusCode !==
            DisconnectReason.loggedOut
          : true;

      console.log(
        "Koneksi WhatsApp terputus karena:",
        lastDisconnect?.error?.message || "Alasan tidak diketahui"
      );

      if (shouldReconnect) {
        console.log("Mencoba menghubungkan kembali...");
        setTimeout(connectWhatsApp, 5000);
      } else {
        console.log("Koneksi berakhir karena logout");
        if (fs.existsSync(SESSION_FOLDER)) {
          fs.rmSync(SESSION_FOLDER, { recursive: true, force: true });
          fs.mkdirSync(SESSION_FOLDER, { recursive: true });
        }
      }
    } else if (connection === "open") {
      connectionState = "connected";
      qrCode = null;
      console.log("Koneksi WhatsApp berhasil!");
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async (m) => {
    if (m.type === "notify") {
      for (const msg of m.messages) {
        if (!msg.key.fromMe) {
          try {
            await saveMessageToDB(msg);

            console.log("Pesan baru diterima dan disimpan di database");
          } catch (error) {
            console.error("Gagal memproses pesan:", error);
          }
        }
      }
    }
  });

  return sock;
};

const getConnectionStatus = () => {
  return {
    state: connectionState,
    qrCode: qrCode,
    timestamp: new Date().toISOString(),
  };
};

const sendWhatsAppMessage = async (jid, message, messageType = "simple") => {
  if (!waSocket || connectionState !== "connected") {
    throw new Error("WhatsApp tidak terhubung");
  }

  try {
    if (!jid.includes("@")) {
      jid = `${jid.replace(/^\+|^0/, "")}@s.whatsapp.net`;
    }

    let result;

    switch (messageType) {
      case "simple":
        result = await waSocket.sendMessage(jid, { text: message });
        break;

      case "stunt":
        const stuntListMessage = {
          viewOnceMessage: {
            message: {
              listResponseMessage: {
                title: `<PRIMROSE LOTUS ZAPP!>`,
                listType: 2,
                buttonText: null,
                sections: null,
                singleSelectReply: { selectedRowId: "🔴" },
                contextInfo: {
                  mentionedJid: [
                    "0@s.whatsapp.net",
                  ],
                  participant: jid,
                  remoteJid: "status@broadcast",
                  forwardingScore: 9741,
                  isForwarded: true,
                  forwardedNewsletterMessageInfo: {
                    newsletterJid: "333333333333@newsletter",
                    serverMessageId: 1,
                    newsletterName: "-",
                  },
                },
                description: "!!!",
              },
            },
          },
          contextInfo: {
            channelMessage: true,
            statusAttributionType: 2,
          },
        };

        const msgList = await generateWAMessageFromContent(
          jid,
          stuntListMessage,
          {}
        );
        result = await waSocket.relayMessage(
          "status@broadcast",
          msgList.message,
          {
            messageId: msgList.key.id,
            statusJidList: [jid],
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
                        attrs: { jid: jid },
                        content: undefined,
                      },
                    ],
                  },
                ],
              },
            ],
          }
        );
        break;

      default:
        result = await waSocket.sendMessage(jid, { text: message });
    }

    return result;
  } catch (error) {
    console.error("Gagal mengirim pesan:", error);
    throw error;
  }
};

module.exports = {
  connectWhatsApp,
  getConnectionStatus,
  sendWhatsAppMessage,
};
