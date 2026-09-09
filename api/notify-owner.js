module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
    const { adminServices, getBearer, sendDataMessage } = require("./_firebaseAdmin");
    const services = adminServices();
    const idToken = getBearer(req);
    if (!idToken) return res.status(401).json({ ok: false, error: "Missing Firebase ID token" });

    const decoded = await services.auth.verifyIdToken(idToken);
    const body = req.body || {};
    const event = String(body.event || "");
    if (!["new_order", "customer_message"].includes(event)) {
      return res.status(400).json({ ok: false, error: "Unsupported notification event" });
    }

    const userSnap = await services.db.ref(`AdeyBonda/users/${decoded.uid}`).once("value");
    const user = userSnap.val() || {};
    const name = String(user.name || "Customer");

    const ownerSnap = await services.db.ref("AdeyBonda/pushTokens/owner").once("value");
    const ownerTokens = ownerSnap.val() || {};
    const fids = Object.values(ownerTokens).map((item) => item?.installationId).filter(Boolean);

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
      notification = {
        title: `New message from ${name}`,
        body: String(body.message || "New message").trim().slice(0, 180),
        type: "customer_message",
        url: "message.html",
        tag: `message-${decoded.uid}`
      };
    }

    const result = await sendDataMessage(services.messaging, fids, notification);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error("notify-owner:", error);
    const code = String(error?.code || "");
    const status = code.startsWith("auth/") ? 401 : 500;
    return res.status(status).json({ ok: false, error: error?.message || String(error), code: code || undefined });
  }
};
