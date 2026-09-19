/**
 * Browser-side push registration. Runs only in the browser, on a user tap.
 */
const appId = import.meta.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID"] as
  | string
  | undefined;
const vapidKey = import.meta.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY"] as
  | string
  | undefined;

const firebaseConfig = {
  apiKey: import.meta.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY"] as
    | string
    | undefined,
  projectId: import.meta.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID"] as
    | string
    | undefined,
  appId,
  messagingSenderId: appId?.split(":")[1] ?? "",
};

export type PushResult =
  | { status: "registered"; token: string }
  | { status: "not-configured" | "unsupported" | "open-in-new-tab" | "denied" };

export function pushClientReady(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      appId &&
      vapidKey &&
      firebaseConfig.messagingSenderId,
  );
}

export async function enablePush(): Promise<PushResult> {
  if (!pushClientReady()) return { status: "not-configured" };

  const { initializeApp, getApps } = await import("firebase/app");
  const { getMessaging, getToken, isSupported } = await import("firebase/messaging");

  if (!("Notification" in window) || !(await isSupported())) return { status: "unsupported" };
  if (window.top !== window.self) return { status: "open-in-new-tab" };

  const permission =
    Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return { status: "denied" };

  const query = new URLSearchParams({
    apiKey: firebaseConfig.apiKey!,
    projectId: firebaseConfig.projectId!,
    appId: appId!,
    messagingSenderId: firebaseConfig.messagingSenderId,
  }).toString();

  const registration = await navigator.serviceWorker.register(
    `/firebase-messaging-sw.js?${query}`,
  );
  const app = getApps()[0] ?? initializeApp(firebaseConfig);
  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey: vapidKey!, serviceWorkerRegistration: registration });
  return token ? { status: "registered", token } : { status: "denied" };
}
