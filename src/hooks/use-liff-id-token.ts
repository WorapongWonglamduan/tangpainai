"use client";

import { useEffect, useState } from "react";
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

  return { idToken, error };
}
