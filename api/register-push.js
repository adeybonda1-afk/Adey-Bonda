const { adminServices, getBearer, hashId, sendJson } = require("./_firebaseAdmin");

module.exports = async (req, res) => {
  // Wrap require in try-catch to capture cold-start initialization failures gracefully
  let _admin;
  try {
    _admin = require("./_firebaseAdmin");
  } catch (importErr) {
    res.setHeader("Content-Type", "application/json");
    return res.status(500).json({
      ok: false,
      error: "Failed to initialize Firebase Admin SDK module: " + (importErr?.message || String(importErr))
    });
  }

  const { adminServices, getBearer, hashId, sendJson } = _admin;

  if (req.method !== "POST") {
    return sendJson(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const { auth, db } = adminServices();
    const idToken = getBearer(req);

    if (!idToken) {
      return sendJson(res, 401, { ok: false, error: "Missing Firebase ID token" });
    }

    const decoded = await auth.verifyIdToken(idToken);
    const installationId = String(req.body?.installationId || "").trim();

    if (!installationId) {
      return sendJson(res, 400, { ok: false, error: "Missing installationId" });
    }

    const key = hashId(installationId);

    await db.ref(
      `AdeyBonda/pushTokens/customers/${decoded.uid}/${key}`
    ).set({
      installationId,
      updatedAt: Date.now(),
      platform: "web"
    });

    return sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error("register-push:", error);
    return sendJson(res, 500, {
      ok: false,
      error: error?.message || String(error)
    });
  }
};

