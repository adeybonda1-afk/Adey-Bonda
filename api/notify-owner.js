const { adminServices, getBearer, sendDataMessage, sendJson } = require("./_firebaseAdmin");

module.exports = async (req, res) => {
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "Method not allowed" });

  try {
    const services = adminServices();
    const idToken = getBearer(req);
    if (!idToken) return sendJson(res, 401, { ok: false, error: "Missing Firebase ID token" });

    const decoded = await services.auth.verifyIdToken(idToken);
    const body = req.body || {};
    const event = String(body.event || "");

    if (!['new_order', 'customer_message'].includes(event)) {
      return sendJson(res, 400, { ok: false, error: "Unsupported notification event" });
    }

    const userSnap = await services.db.ref(`AdeyBonda/users/${decoded.uid}`).once("value");
    const user = userSnap.val() || {};
    const name = String(user.name || "Customer");

    const ownerSnap = await services.db.ref("AdeyBonda/pushTokens/owner").once("value");
    const ownerTokens = ownerSnap.val() || {};
    const fids = Object.values(ownerTokens)
      .map((item) => item?.installationId)
      .filter(Boolean);

    let notification;
    if (event === "new_order") {
      const productName = String(body.productName || "a product");
      const quantity = Number(body.quantity) || 1;
      const orderId = String(body.orderId || "");
      notification = {
        title: "New order 🛍️",
        body: `${name} ordered ${quantity} × ${productName}`,
        type: "new_order",
        url: "home.html",
        tag: `order-${orderId || Date.now()}`
      };
    } else {
      const message = String(body.message || "New message").trim();
      notification = {
        title: `New message from ${name}`,
        body: message.slice(0, 180),
        type: "customer_message",
        url: "message.html",
        tag: `message-${decoded.uid}`
      };
    }

    const result = await sendDataMessage(services.messaging, fids, notification);
    return sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    console.error("notify-owner:", error);
    if (String(error.code || '').includes('auth/argument-error') || String(error.code || '').includes('auth/id-token')) {
      return sendJson(res, 401, { ok: false, error: "Invalid Firebase ID token" });
    }
    return sendJson(res, 500, { ok: false, error: "Failed to send owner notification" });
  }
};
