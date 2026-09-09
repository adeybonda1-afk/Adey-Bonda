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

async function enablePush() {
    alert("Step 1: Push setup started");
    const state = getPushState();
    if (!state.supported) {
        alert("Push notifications are not supported in this browser.");
        return false;
    }

    try {
        const perm = await Notification.requestPermission();
        updatePushUI(perm);

        if (perm !== "granted") {
            alert("Notification permission was not granted.");
            return false;
        }
        alert("Step 2: Notification permission granted");

        const swReg = await registerServiceWorker();
        alert("Step 3: Service worker registered");

        const messaging = await initMessaging();
        if (!messaging) {
            alert("Firebase Messaging is not available.");
            return false;
        }

        alert("Step 4: FCM registration started");

        // Promise wrapper to await asynchronous onRegistered callback completion
        const registrationSuccess = await new Promise((resolve, reject) => {
            let handled = false;

            onRegistered(messaging, async (installationId) => {
                if (handled) return;
                handled = true;
                alert("Step 5: Installation ID received");
                alert("Step 6: Calling /api/register-push");

                try {
                    const user = firebase.auth().currentUser;
                    if (!user) {
                        throw new Error("User not authenticated in Firebase Client");
                    }
                    const token = await user.getIdToken();

                    const response = await fetch("/api/register-push", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`
                        },
                        body: JSON.stringify({ installationId })
                    });

                    alert("Step 7: API response status: " + response.status);
                    const resData = await response.json().catch(() => ({}));
                    alert("Step 8: API response body: " + JSON.stringify(resData));

                    if (response.ok && resData.ok) {
                        resolve(true);
                    } else {
                        reject(new Error(resData.error || `Server error (${response.status})`));
                    }
                } catch (err) {
                    reject(err);
                }
            });

            register(messaging, {
                vapidKey: PUSH_CONFIG.vapidKey,
                serviceWorkerRegistration: swReg
            }).catch(reject);
        });

        return registrationSuccess;
    } catch (error) {
        console.error("Failed to enable push notifications:", error);
        alert("Push registration failed: " + (error?.message || error));
        return false;
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
