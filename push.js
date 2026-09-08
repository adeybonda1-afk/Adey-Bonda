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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
      <div style="font-weight:800;font-size:14px">Turn on notifications A</div>
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
    try {
      const result = await enablePush(role);
      if (result?.ok) {
        banner.remove();
      } else if (button) {
        button.disabled = false;
        button.textContent = "Try again";
      }
    } catch (error) {
      console.error("Push enable error:", error);
      if (button) {
        button.disabled = false;
        button.textContent = "Try again";
      }
    }
  });
}

async function getServiceWorker() {
  if (!("serviceWorker" in navigator)) throw new Error("Service workers are not supported.");
  return navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
}

async function sendRegistration(role, installationId, credential) {
  const endpoint = role === "owner" ? "/api/register-owner-push" : "/api/register-push";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${credential}`
    },
    body: JSON.stringify({ installationId })
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Registration failed (${response.status}): ${text}`);
  }
  return response.json().catch(() => ({ ok: true }));
}

async function enablePush(role, credentialOverride = null) {
  try {
    if (!PUSH_VAPID_KEY || PUSH_VAPID_KEY.includes("PASTE_YOUR_PUBLIC")) {
      console.warn("Push notifications: add the public VAPID key to push-config.js first.");
      return { ok: false, reason: "missing-vapid-key" };
    }

    if (!("Notification" in window)) throw new Error("Notifications are not supported in this browser.");
    if (Notification.permission === "denied") {
      console.warn("Notifications are blocked. Enable them in the browser/site settings.");
      return { ok: false, reason: "denied" };
    }

    const supported = await isSupported();
    if (!supported) throw new Error("FCM web push is not supported in this browser.");

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, reason: "permission" };

    const serviceWorkerRegistration = await getServiceWorker();
    const messaging = getMessaging(pushApp);

    let credential = credentialOverride;
    if (!credential) {
      if (role === "customer") {
        // Firebase Auth is owned by the calling page; get the current user from the global Firebase Auth instance if provided.
        const user = window.__adeyBondaCurrentUser;
        if (!user) throw new Error("Customer account is not ready yet.");
        credential = await user.getIdToken();
      } else {
        credential = localStorage.getItem("ownerAccessToken");
        if (!credential) throw new Error("Owner session is missing. Please sign in again.");
      }
    }

    onRegistered(messaging, async (installationId) => {
      try {
        await sendRegistration(role, installationId, credential);
        localStorage.setItem(role === "owner" ? "ownerPushInstallationId" : "customerPushInstallationId", installationId);
        console.log("FCM installation registered:", installationId);
      } catch (error) {
        alert("Could not store FCM installation ID:", error);
      }
    });

    onMessage(messaging, (payload) => {
      const data = payload?.data || {};
      if (Notification.permission !== "granted") return;
      const title = data.title || "Adey Bonda";
      const body = data.body || "You have a new notification.";
      const url = data.url || (role === "owner" ? "home.html" : "home.html");
      try {
        const notification = new Notification(title, {
          body,
          icon: "Image/Icon.jpg",
          badge: "Image/Icon.jpg",
          tag: data.tag || data.type || "adey-bonda",
          data: { url }
        });
        notification.onclick = () => {
          window.focus();
          window.location.href = url;
          notification.close();
        };
      } catch (error) {
        alert("Foreground notification could not be shown:", error);
      }
    });

    await register(messaging, {
      vapidKey: PUSH_VAPID_KEY,
      serviceWorkerRegistration
    });

    return { ok: true };
  } catch (error) {
    alert("Push setup failed:", error);
    return { ok: false, reason: error.message };
  }
}

export async function setupCustomerPush(user) {
  window.__adeyBondaCurrentUser = user;
  if (!user) return;

  try {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      await enablePush("customer");
    } else if (Notification.permission === "default") {
      createEnableButton("customer");
    }
  } catch (error) {
    alert("Customer push initialization failed:", error);
  }
}

export async function setupOwnerPush() {
  try {
    if (!("Notification" in window)) return;
    if (!localStorage.getItem("ownerAccessToken")) return;
    if (Notification.permission === "granted") {
      await enablePush("owner");
    } else if (Notification.permission === "default") {
      createEnableButton("owner");
    }
  } catch (error) {
    alert("Owner push initialization failed:", error);
  }
}

export async function notifyOwner(event, payload, firebaseUser) {
  if (!firebaseUser) return { ok: false, reason: "no-user" };
  const token = await firebaseUser.getIdToken();
  const response = await fetch("/api/notify-owner", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ event, ...payload })
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Owner notification request failed (${response.status}): ${text}`);
  }
  return response.json();
}

export async function notifyUser(userId, event, payload) {
  const token = localStorage.getItem("ownerAccessToken");
  if (!token) throw new Error("Owner session is missing.");
  const response = await fetch("/api/notify-user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ userId, event, ...payload })
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Customer notification request failed (${response.status}): ${text}`);
  }
  return response.json();
}

export { enablePush };
