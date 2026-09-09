function getFirebaseAdmin() {
  // Load inside the request so dependency/runtime errors are returned as JSON
  // instead of killing the Vercel function during module initialization.
  const { cert, getApps, initializeApp } = require("firebase-admin/app");
  const { getAuth } = require("firebase-admin/auth");
  const { getDatabase } = require("firebase-admin/database");
  const { getMessaging } = require("firebase-admin/messaging");
  return { cert, getApps, initializeApp, getAuth, getDatabase, getMessaging };
}

function getAdminApp() {
  const { cert, getApps, initializeApp } = getFirebaseAdmin();
  if (getApps().length) return getApps()[0];

  const projectId = "adey-bonda";
  const clientEmail = "firebase-adminsdk-fbsvc@adey-bonda.iam.gserviceaccount.com";
  let privateKey = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDKTsgDhbVQ/f7y
ICMkJRuZQGNcYrmbQ2mcbweRF6Pb2AYUOfinKdCUhuXvq2V0AIa2FHE1DO/owe48
KZGLkZah4bDTNVxMgSaH6xmMip7fSed2XzsL6FH18hETmvxLvJrltwrBprQKdWIB
xfQUNrz2HjfmFsx7u+tX5/sOq7FqZcf6ZfAwwsApFbcKBV5a8h7YRdqeOsqO/F
4VJTm0sc9BjZs/38n8L/5CKkvMlnEzxg0XURbjhJPKk0pS2MMCOagOsp0974VfG7
Ue+aVOTyRyICb8yV4f9VNgfrd7yCgvpifU3JGH1qOgknpVlG3W7xfBVXgTq7nPU1
LLteBuo/AgMBAAECggEALkcSMtgRr2rCuIFIeJqycv6LHBWLTqx/iqTNTs/hEEec
sGDIc/i5OViYXZhP91atehY4BUIl2REPnZyGqi4ODo7Rg6b3q5p5hWrup7sH95zw
wR+sop8srH2IkXsJDowgxL53yFzMSoPC6blEonNo6riD4fLCKOXGQpAS2nrE7s
DxlAn5gGBTcMylJ0zlao6KdS7BZtBLtsHaEqbq50iDJsJrk0l4Ko1dEBy/jWK94f
fZ4c36jLdgqaO5dnlLqCVBaMAGe4C6KJE8YVNOJydR5Qh/onOXBvz4V/TU0isXgt
k2PNZgMVMw0jIpcV/gn0TiIbJHYZIplL7DaDNzG0cQKBgQD4giEzxprMOhQh6W4/
gagHl0My8Cz7upsqWRQx7DfoAYjW7OjBK4/1La4+ABnh6q0C1znF7Nab0LTYoALn
/+rYAFbzeQjHyh8g+ZQZwQs7ziVNmg4eI/gPi950FzTqshmC/xI56tYHFziuzfZF
X4SNwZVWrLMf0zz1rZe7uJnY8QKBgQDQaBjmgx56YE/Jl/Le6D8RTHPEMwVnavAw
Y+zhBOKgu6fWo+58fZr4ZJMV2VTn1R962bIk42IidGFAb5WbS2VoCoukh5WXWXnE
pyakSQYvrQ3da0gJsNq+NL8+DuBq0Px5z+F4tQmjFmvUTBH9tfr6v7hGfcVKxPOH
Y4sjZFl2LwKBgQCLJ4MkFQA1gAgp/SapFRdcOM1+RpNJ2nJswjjWw6mCluljQIIN
OTGBXzUErtXPdbOvtYk6VabO1Y2PB/rYoquEjJwj9hB+n6XSty7BRSHfOU4WKD/j
jMypF+9XHm+ZRGWYvvAb0m5KxiwNZnOS4Su+nTncsRQUrBqkj7I5geNUYQKBgQCy
bc2T3gLEJ51oLc3khtcoSlp7SmuABZCq/YKbjQEzODcUj7npn+iEbid392C4NEIF
fkkFSCCG+zkgX+io0r55ez3fma27rQGSGsH8ugCv5OwP/H/qvB4r5yEtUrNVAKSI
7jBOlkEv/kxHsPFeVOYStP5ia9/0ifcunU1M+eeWRQKBgDH91dJG+ZiTxBcKbt3Q
FG7dbtfIOtLHnhxPCpQWyM7HXueEh3sPfgwHTu0ywhGNMCcHCYYKFSTVvCWG/lH+
/7Pozepm+7vWHb50nJ6KVgSjAfwjVjteH4XUdPUbBXnbFP9J3r89NFpHfXIcSv86
Ul9zO51Oa8/o5SbE+VeHK4+B
-----END PRIVATE KEY-----`;
  const databaseURL = "https://adey-bonda-default-rtdb.firebaseio.com/";

  privateKey = privateKey.replace(/^['"]|['"]$/g, "").replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey || !databaseURL) {
    throw new Error("Missing Firebase Admin environment variables: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_DATABASE_URL");
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    databaseURL
  });
}

function adminServices() {
  const { getAuth, getDatabase, getMessaging } = getFirebaseAdmin();
  const app = getAdminApp();
  return {
    app,
    auth: getAuth(app),
    db: getDatabase(app),
    messaging: getMessaging(app)
  };
}

function sendJson(res, status, body) {
  return res.status(status).json(body);
}

function getBearer(req) {
  const header = req.headers?.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

function hashId(value) {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

async function sendDataMessage(messaging, fids, payload) {
  const uniqueFids = [...new Set((fids || []).filter(Boolean).map(String))];
  if (uniqueFids.length === 0) return { attempted: 0, success: 0, failure: 0, invalidFids: [] };

  let success = 0;
  let failure = 0;
  const invalidFids = [];

  for (let i = 0; i < uniqueFids.length; i += 500) {
    const batch = uniqueFids.slice(i, i + 500);
    const settled = await Promise.allSettled(batch.map((fid) => messaging.send({
      fid,
      data: {
        title: String(payload.title || "Adey Bonda"),
        body: String(payload.body || "You have a new notification."),
        type: String(payload.type || "general"),
        url: String(payload.url || "home.html"),
        tag: String(payload.tag || payload.type || "adey-bonda")
      },
      webpush: {
        headers: { Urgency: "high", TTL: "2419200" }
      }
    })));

    settled.forEach((result, index) => {
      if (result.status === "fulfilled") {
        success += 1;
        return;
      }
      failure += 1;
      const code = String(result.reason?.code || "");
      if (code.includes("registration-token-not-registered") || code.includes("invalid-registration-token")) {
        invalidFids.push(batch[index]);
      }
      console.error("FCM send failed:", code, result.reason?.message || result.reason);
    });
  }

  return { attempted: uniqueFids.length, success, failure, invalidFids };
}

module.exports = { adminServices, getBearer, hashId, sendDataMessage, sendJson };
