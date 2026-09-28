// Remembers which customer account is signed in on this phone (pointer only; data lives in the database).
const KEY = "du_customer_token";

export function getCustomerSession(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setCustomerSession(token: string) {
  try {
    window.localStorage.setItem(KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearCustomerSession() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
