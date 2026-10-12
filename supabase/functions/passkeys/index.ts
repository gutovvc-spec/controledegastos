import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticatorTransportFuture,
} from "npm:@simplewebauthn/server@13.1.2";

type Challenge = {
  id: string;
  challenge: string;
  flow: "registration" | "authentication";
  user_id: string | null;
  origin: string;
  rp_id: string;
  created_at: string;
};

type StoredCredential = {
  credential_id: string;
  user_id: string;
  public_key: string;
  counter: number;
  transports: AuthenticatorTransportFuture[];
};

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const rpName = "Controle de Gastos da Família";

function allowedOrigins(): Set<string> {
  return new Set(
    (Deno.env.get("WEBAUTHN_ORIGINS") ?? "")
      .split(",")
      .map((origin) => origin.trim().replace(/\/+$/, ""))
      .filter(Boolean),
  );
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => binary += String.fromCharCode(byte));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - base64.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function response(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Max-Age": "86400",
      "Content-Type": "application/json; charset=utf-8",
      "Vary": "Origin",
    },
  });
}

async function supabaseRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  const result = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await result.text();
  if (!result.ok) {
    console.error("Supabase request failed", path, result.status);
    throw new Error("A operação de autenticação não pôde ser concluída.");
  }
  return text ? JSON.parse(text) : null;
}

async function currentUser(request: Request): Promise<{ id: string; email: string }> {
  const authorization = request.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    throw new HttpError(401, "Entre com e-mail e senha antes de cadastrar uma passkey.");
  }

  const result = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  });
  if (!result.ok) {
    throw new HttpError(401, "Sua sessão expirou. Entre novamente para cadastrar uma passkey.");
  }
  const user = await result.json();
  if (!user.id || !user.email) throw new HttpError(401, "Não foi possível confirmar sua conta.");
  return { id: user.id, email: user.email };
}

async function clearExpiredChallenges(): Promise<void> {
  const before = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  await supabaseRequest(
    `/rest/v1/passkey_challenges?created_at=lt.${encodeURIComponent(before)}`,
    { method: "DELETE" },
  );
}

async function createChallenge(
  challenge: string,
  flow: Challenge["flow"],
  userId: string | null,
  origin: string,
  rpId: string,
): Promise<string> {
  await clearExpiredChallenges();
  const inserted = await supabaseRequest("/rest/v1/passkey_challenges?select=id", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      challenge,
      flow,
      user_id: userId,
      origin,
      rp_id: rpId,
    }),
  }) as Array<{ id: string }>;
  if (!inserted[0]?.id) throw new Error("Não foi possível iniciar a autenticação.");
  return inserted[0].id;
}

async function consumeChallenge(
  id: string,
  flow: Challenge["flow"],
  origin: string,
): Promise<Challenge> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new HttpError(400, "A solicitação de autenticação expirou. Tente novamente.");
  }
  const result = await supabaseRequest(
    `/rest/v1/passkey_challenges?id=eq.${id}&flow=eq.${flow}&origin=eq.${encodeURIComponent(origin)}&select=*`,
    { method: "DELETE", headers: { Prefer: "return=representation" } },
  ) as Challenge[];
  const challenge = result[0];
  if (!challenge || Date.now() - Date.parse(challenge.created_at) > 5 * 60 * 1000) {
    throw new HttpError(400, "A solicitação de autenticação expirou. Tente novamente.");
  }
  return challenge;
}

async function registrationOptions(
  request: Request,
  origin: string,
  rpId: string,
): Promise<unknown> {
  const user = await currentUser(request);
  const existing = await supabaseRequest(
    `/rest/v1/passkey_credentials?user_id=eq.${user.id}&select=credential_id`,
  ) as Array<{ credential_id: string }>;
  const options = await generateRegistrationOptions({
    rpName,
    rpID: rpId,
    userID: new TextEncoder().encode(user.id),
    userName: user.email,
    userDisplayName: user.email,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
    excludeCredentials: existing.map((credential) => ({ id: credential.credential_id })),
  });
  const challengeId = await createChallenge(options.challenge, "registration", user.id, origin, rpId);
  return { challengeId, options };
}

async function verifyRegistration(
  request: Request,
  body: Record<string, unknown>,
  origin: string,
): Promise<unknown> {
  const user = await currentUser(request);
  const challenge = await consumeChallenge(String(body.challengeId ?? ""), "registration", origin);
  if (challenge.user_id !== user.id) throw new HttpError(403, "A passkey não corresponde à conta atual.");
  let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
  try {
    verification = await verifyRegistrationResponse({
      response: body.credential as Parameters<typeof verifyRegistrationResponse>[0]["response"],
      expectedChallenge: challenge.challenge,
      expectedOrigin: challenge.origin,
      expectedRPID: challenge.rp_id,
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo) {
      throw new HttpError(400, "O dispositivo não confirmou o cadastro da passkey.");
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error("Passkey registration verification failed", error);
    throw new HttpError(400, "Não foi possível validar a passkey. Tente cadastrá-la novamente.");
  }
  const credential = verification.registrationInfo.credential;
  await supabaseRequest("/rest/v1/passkey_credentials", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      credential_id: credential.id,
      user_id: user.id,
      public_key: encodeBase64Url(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports ?? [],
    }),
  });
  return { ok: true };
}

async function authenticationOptions(origin: string, rpId: string): Promise<unknown> {
  const options = await generateAuthenticationOptions({
    rpID: rpId,
    allowCredentials: [],
    userVerification: "required",
  });
  const challengeId = await createChallenge(options.challenge, "authentication", null, origin, rpId);
  return { challengeId, options };
}

async function credentialById(credentialId: string): Promise<StoredCredential | null> {
  const result = await supabaseRequest(
    `/rest/v1/passkey_credentials?credential_id=eq.${encodeURIComponent(credentialId)}&select=*`,
  ) as StoredCredential[];
  return result[0] ?? null;
}

async function verifyAuthentication(
  body: Record<string, unknown>,
  origin: string,
): Promise<unknown> {
  const challenge = await consumeChallenge(String(body.challengeId ?? ""), "authentication", origin);
  const assertion = body.credential as { id?: string } | undefined;
  if (!assertion?.id) throw new HttpError(400, "A credencial enviada não é válida.");
  const stored = await credentialById(assertion.id);
  if (!stored) throw new HttpError(401, "Não foi possível autenticar com esta passkey.");

  let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.credential as Parameters<typeof verifyAuthenticationResponse>[0]["response"],
      expectedChallenge: challenge.challenge,
      expectedOrigin: challenge.origin,
      expectedRPID: challenge.rp_id,
      credential: {
        id: stored.credential_id,
        publicKey: decodeBase64Url(stored.public_key),
        counter: stored.counter,
        transports: stored.transports,
      },
      requireUserVerification: true,
    });
  } catch (error) {
    console.error("Passkey authentication verification failed", error);
    throw new HttpError(401, "Não foi possível autenticar com esta passkey.");
  }
  if (!verification.verified) throw new HttpError(401, "Não foi possível autenticar com esta passkey.");

  await supabaseRequest(
    `/rest/v1/passkey_credentials?credential_id=eq.${encodeURIComponent(stored.credential_id)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date().toISOString(),
      }),
    },
  );

  const account = await supabaseRequest(`/auth/v1/admin/users/${stored.user_id}`) as { email?: string };
  if (!account.email) throw new Error("Não foi possível identificar a conta associada à passkey.");
  const generated = await supabaseRequest("/auth/v1/admin/generate_link", {
    method: "POST",
    body: JSON.stringify({ type: "magiclink", email: account.email }),
  }) as { properties?: { email_otp?: string } };
  const otp = generated.properties?.email_otp;
  if (!otp) throw new Error("O Supabase não gerou a sessão de autenticação.");

  const sessionResponse = await fetch(`${supabaseUrl}/auth/v1/verify`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "magiclink", email: account.email, token: otp }),
  });
  const session = await sessionResponse.json();
  if (!sessionResponse.ok || !session.access_token) {
    console.error("Supabase passkey session exchange failed", sessionResponse.status);
    throw new Error("Não foi possível iniciar a sessão da conta.");
  }
  return { session, user: { email: account.email } };
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin") ?? "";
  const origins = allowedOrigins();
  if (!origin || !origins.has(origin)) {
    return new Response("Origem não permitida.", { status: 403 });
  }
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "authorization, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin",
      },
    });
  }
  if (request.method !== "POST") return response({ error: "Método não permitido." }, 405, origin);

  try {
    const rpId = new URL(origin).hostname;
    if (rpId !== "localhost" && (rpId.includes(":") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(rpId))) {
      throw new HttpError(400, "O domínio configurado não é válido para passkeys.");
    }
    const body = await request.json() as Record<string, unknown>;
    let result: unknown;
    switch (body.action) {
      case "registration-options":
        result = await registrationOptions(request, origin, rpId);
        break;
      case "registration-verify":
        result = await verifyRegistration(request, body, origin);
        break;
      case "authentication-options":
        result = await authenticationOptions(origin, rpId);
        break;
      case "authentication-verify":
        result = await verifyAuthentication(body, origin);
        break;
      default:
        throw new HttpError(400, "Ação de passkey desconhecida.");
    }
    return response(result, 200, origin);
  } catch (error) {
    if (error instanceof HttpError) return response({ error: error.message }, error.status, origin);
    console.error("Passkey function failed", error);
    return response({ error: "Não foi possível concluir a autenticação com passkey." }, 500, origin);
  }
});
