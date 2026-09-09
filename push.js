import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  getMessaging,
  isSupported,
  onMessage,
  onRegistered,
  register
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-messaging.js";
import { PUSH_VAPID_KEY, FIREBASE_PUSH_CONFIG } from "./push-config.js";

const pushApp = initializeApp(FIREBASE_PUSH_CONFIG, "push-notifications");
let messagingPromise = null;
let listenersInstalled = false;
let registrationPromise = null;

async function getMessagingInstance() {
  if (!messagingPromise) {
    messagingPromise = (async () => {
      if (!(await isSupported())) {
        throw new Error("FCM web push is not supported in this browser.");
      }
      return getMessaging(pushApp);
    })();
  }
  return messagingPromise;
}

function showPushError(message) {
  const text = String(message || "Push notification setup failed.");
  console.error(text);
  try { alert("🔔 Push notification error\n\n" + text); } catch (_) {}
}

function createEnableButton(role) {
  const old = document.getElementById("pushEnableBanner");
  if (old) old.remove();

  const banner = document.createElement("div");
  banner.id = "pushEnableBanner";
  banner.style.cssText = `
    position: fixed;
    left: 14px;
    right: 14px;
    bottom: 86px;
    z-index: 99999;
    background: #0b2a3b;
    color: #fff;
    border-radius: 18px;
    padding: 14px 16px;
    box-shadow: 0 12px 35px rgba(0,0,0,.25);
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  `;
  banner.innerHTML = `
    <div style="font-size:24px;line-height:1">🔔</div>
    <div style="flex:1;min-width:0">
      <div style="font-weight:800;font-size:14px">Turn on notifications</div>
      <div style="opacity:.82;font-size:12px;margin-top:3px">
        ${role === "owner" ? "Get a notification when a customer orders or sends a message." : "Get important updates about your orders and messages."}
      </div>
    </div>
    <button id="pushEnableBtn" style="border:0;border-radius:12px;padding:10px 13px;font-weight:800;cursor:pointer;background:#fff;color:#0b2a3b">Enable</button>
    <button id="pushCloseBtn" aria-label="Close" style="border:0;background:transparent;color:#fff;font-size:20px;cursor:pointer;padding:4px">×</button>
  `;
  document.body.appendChild(banner);

  document.getElementById("pushCloseBtn")?.addEventListener("click", () => banner.remove());
  document.getElementById("pushEnableBtn")?.addEventListener("click", async () => {
    const button = document.getElementById("pushEnableBtn");
    if (button) {
      button.disabled = true;
      button.textContent = "...";
    }
    const result = await enablePush(role);
    if (result?.ok) {
      banner.remove();
      try { alert("✅ Push notifications are enabled successfully."); } catch (_) {}
    } else if (button) {
      button.disabled = false;
      button.textContent = "Try again";
      showPushError(result?.reason || "Push notification setup failed.");
    }
  });
}

async function getServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service workers are not supported in this browser.");
  }
  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
    scope: "/",
    updateViaCache: "none"
  });
  await registration.update().catch(() => {});
  return registration;
}

async function sendRegistration(role, installationId, credential) {
  const endpoint = role === "owner" ? "/api/register-owner-push" : "/api/register-push";
  const headers = { "Content-Type": "application/json" };
  if (credential) headers.Authorization = `Bearer ${credential}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ installationId })
  });

  const text = await response.text().catch(() => "");
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (_) {}

  if (!response.ok) {
    const detail = body?.error || text || `HTTP ${response.status}`;
    throw new Error(`Registration failed (${response.status}): ${detail}`);
  }
  return body || { ok: true };
}

function installMessageListener(role) {
  if (listenersInstalled) return;
  listenersInstalled = true;
  getMessagingInstance().then((messaging) => {
    onMessage(messaging, (payload) => {
      const data = payload?.data || {};
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      const title = data.title || "Adey Bonda";
      const body = data.body || "You have a new notification.";
      const url = data.url || "home.html";
      try {
        const notification = new Notification(title, {
          body,
          icon: "Image/Icon.jpg",
          badge: "Image/Icon.jpg",
          tag: data.tag || data.type || "adey-bonda",
          renotify: true,
          data: { url }
        });
        notification.onclick = () => {
          window.focus();
          window.location.href = url;
          notification.close();
        };
      } catch (error) {
        showPushError(error?.message || "Foreground notification could not be shown.");
      }
    });
  }).catch(showPushError);
}

async function registerAndStore(role, messaging, serviceWorkerRegistration, credential) {
  if (registrationPromise) return registrationPromise;

  registrationPromise = new Promise(async (resolve, reject) => {
    let unsubscribe = null;
    let finished = false;
    const timeout = setTimeout(() => {
      if (finished) return;
      finished = true;
      try { unsubscribe?.(); } catch (_) {}
      reject(new Error("FCM registration finished, but the Firebase Installation ID was not received. Please try again."));
    }, 20000);

    try {
      unsubscribe = onRegistered(messaging, async (installationId) => {
        if (finished) return;
        try {
          const result = await sendRegistration(role, installationId, credential);
          finished = true;
          clearTimeout(timeout);
          try { unsubscribe?.(); } catch (_) {}
          localStorage.setItem(
            role === "owner" ? "ownerPushInstallationId" : "customerPushInstallationId",
            installationId
          );
          resolve({ ...result, installationId });
        } catch (error) {
          if (finished) return;
          finished = true;
          clearTimeout(timeout);
          try { unsubscribe?.(); } catch (_) {}
          reject(error);
        }
      });

      await register(messaging, {
        vapidKey: PUSH_VAPID_KEY,
        serviceWorkerRegistration
      });
    } catch (error) {
      if (!finished) {
        finished = true;
        clearTimeout(timeout);
        try { unsubscribe?.(); } catch (_) {}
        reject(error);
      }
    }
  });

  try {
    return await registrationPromise;
  } finally {
    registrationPromise = null;
  }
}

async function enablePush(role, credentialOverride = null) {
  try {
    if (!PUSH_VAPID_KEY || PUSH_VAPID_KEY.includes("PASTE_YOUR_PUBLIC")) {
      throw new Error("The public VAPID key is missing from push-config.js.");
    }
    if (!("Notification" in window)) throw new Error("Notifications are not supported in this browser.");
    if (Notification.permission === "denied") {
      throw new Error("Notifications are blocked. Enable notifications for this site in the browser settings.");
    }

    const permission = Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, reason: "Notification permission was not granted." };

    const serviceWorkerRegistration = await getServiceWorker();
    const messaging = await getMessagingInstance();

    let credential = credentialOverride;
    if (role === "customer" && !credential) {
      const user = window.__adeyBondaCurrentUser;
      if (!user) throw new Error("Customer account is not ready yet. Please try again.");
      credential = await user.getIdToken(true);
    }

    installMessageListener(role);
    return await registerAndStore(role, messaging, serviceWorkerRegistration, credential);
  } catch (error) {
    return { ok: false, reason: error?.message || String(error) };
  }
}

export async function setupCustomerPush(user) {
  window.__adeyBondaCurrentUser = user;
  if (!user || !("Notification" in window)) return;
  try {
    if (Notification.permission === "granted") {
      const result = await enablePush("customer");
      if (!result.ok) showPushError(result.reason);
    } else if (Notification.permission === "default") {
      createEnableButton("customer");
    }
  } catch (error) {
    showPushError(error?.message || "Customer push initialization failed.");
  }
}

export async function setupOwnerPush() {
  if (!("Notification" in window)) return;
  try {
    if (Notification.permission === "granted") {
      const result = await enablePush("owner");
      if (!result.ok) showPushError(result.reason);
    } else if (Notification.permission === "default") {
      createEnableButton("owner");
    }
  } catch (error) {
    showPushError(error?.message || "Owner push initialization failed.");
  }
}

export async function notifyOwner(event, payload, firebaseUser) {
  if (!firebaseUser) return { ok: false, reason: "no-user" };
  const token = await firebaseUser.getIdToken(true);
  const response = await fetch("/api/notify-owner", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ event, ...payload })
  });
  const text = await response.text().catch(() => "");
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (_) {}
  if (!response.ok) throw new Error(`Owner notification request failed (${response.status}): ${body?.error || text || "Unknown error"}`);
  return body || { ok: true };
}

export async function notifyUser(userId, event, payload) {
  const response = await fetch("/api/notify-user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, event, ...payload })
  });
  const text = await response.text().catch(() => "");
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (_) {}
  if (!response.ok) throw new Error(`Customer notification request failed (${response.status}): ${body?.error || text || "Unknown error"}`);
  return body || { ok: true };
}

export { enablePush };
