const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getDatabase } = require("firebase-admin/database");
const { getMessaging } = require("firebase-admin/messaging");

function getAdminApp() {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const databaseURL = process.env.FIREBASE_DATABASE_URL;

  if (!projectId || !clientEmail || !privateKey || !databaseURL) {
    throw new Error("Missing Firebase Admin environment variables.");
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    databaseURL
  });
}

function adminServices() {
  const app = getAdminApp();
  return {
    app,
    auth: getAuth(app),
    db: getDatabase(app),
    messaging: getMessaging(app)
  };
}

function sendJson(res, status, body) {
  res.status(status).json(body);
}

function getBearer(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

function hashId(value) {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

async function sendDataMessage(messaging, fids, payload) {
  const uniqueFids = [...new Set(fids.filter(Boolean))];
  if (uniqueFids.length === 0) return { attempted: 0, success: 0, failure: 0 };

  const messages = uniqueFids.map((fid) => ({
    fid,
    data: {
      title: String(payload.title || "Adey Bonda"),
      body: String(payload.body || "You have a new notification."),
      type: String(payload.type || "general"),
      url: String(payload.url || "home.html"),
      tag: String(payload.tag || payload.type || "adey-bonda")
    },
    webpush: {
      headers: {
        Urgency: "high",
        TTL: "2419200"
      }
    }
  }));

  let success = 0;
  let failure = 0;
  const invalidFids = [];
  const settled = await Promise.allSettled(messages.map((message) => messaging.send(message)));

  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      success += 1;
      return;
    }
    failure += 1;
    const code = result.reason?.code || "";
    if (code.includes("registration-token-not-registered") || code.includes("invalid-registration-token")) {
      invalidFids.push(uniqueFids[index]);
    }
    console.error("FCM send failed:", code, result.reason?.message || result.reason);
  });

  return { attempted: uniqueFids.length, success, failure, invalidFids };
}

module.exports = { adminServices, getBearer, hashId, sendDataMessage, sendJson };
