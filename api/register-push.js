module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
    const { adminServices, getBearer, hashId } = require("./_firebaseAdmin");
    const idToken = getBearer(req);
    if (!idToken) return res.status(401).json({ ok: false, error: "Missing Firebase ID token" });

    const installationId = String(req.body?.installationId || "").trim();
    if (!installationId) return res.status(400).json({ ok: false, error: "Missing installationId" });

    const { auth, db } = adminServices();
    const decoded = await auth.verifyIdToken(idToken);
    const key = hashId(installationId);
    await db.ref(`AdeyBonda/pushTokens/customers/${decoded.uid}/${key}`).set({
      installationId,
      updatedAt: Date.now(),
      platform: "web"
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("register-push:", error);
    const code = String(error?.code || "");
    const status = code.startsWith("auth/") ? 401 : 500;
    return res.status(status).json({ ok: false, error: error?.message || String(error), code: code || undefined });
  }
};
