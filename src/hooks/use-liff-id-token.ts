"use client";

import { useCallback, useEffect, useState } from "react";
import { liff } from "@line/liff";

export function useLiffIdToken() {
  const [idToken, setIdToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const configResponse = await fetch("/api/config/liff");
        const { liffId } = (await configResponse.json()) as { liffId: string | null };

        if (!liffId) {
          setError("ไม่พบการตั้งค่า LIFF ID บนเซิร์ฟเวอร์");
          return;
        }

        await liff.init({ liffId });

        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        // liff.isLoggedIn() only reflects LIFF's own session state — it stays
        // true even after the cached ID token's JWT `exp` has passed, since
        // the SDK never re-checks or refreshes it (a known LIFF SDK gap).
        // Left unchecked, an expired token gets sent to the API forever,
        // which always answers "invalid id token" with no way to recover.
        // Decoding it ourselves and forcing a fresh login on expiry is the
        // only way out of that stuck state.
        const decoded = liff.getDecodedIDToken();
        const isExpired = !decoded?.exp || decoded.exp * 1000 <= Date.now();

        if (isExpired) {
          liff.logout();
          liff.login();
          return;
        }

        const token = liff.getIDToken();
        if (!token) {
          setError("ไม่สามารถยืนยันตัวตนผ่าน LINE ได้ ลองเปิดใหม่อีกครั้ง");
          return;
        }

        setIdToken(token);
      } catch {
        setError("เกิดข้อผิดพลาด ลองเปิดหน้านี้ใหม่อีกครั้ง");
      }
    }

    init();
  }, []);

  // Called when the server itself rejects the token (401) even though our
  // own exp check above passed — e.g. the token expired in the few seconds
  // between that check and the API call, or the server and this check
  // disagree for any other reason. Without this, a stale idToken sits in
  // state forever and every "retry" just resends the same rejected token.
  const reauthenticate = useCallback(() => {
    setIdToken(null);
    liff.logout();
    liff.login();
  }, []);

  return { idToken, error, reauthenticate };
}
