const channelId = process.env.LINE_MINIAPP_CHANNEL_ID!;

type VerifyResponse = {
  sub?: string;
  error?: string;
};

export async function verifyLiffIdToken(idToken: string): Promise<string | null> {
  const response = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
  });

  const data = (await response.json()) as VerifyResponse;

  if (!response.ok || !data.sub) {
    return null;
  }

  return data.sub;
}
