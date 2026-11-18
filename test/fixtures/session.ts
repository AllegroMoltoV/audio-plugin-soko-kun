// サインイン済みの利用者の MCP のアクセストークン。GitHub の OAuth の往復を省き、認可サーバーに直接グラントを作らせる。
// トークンの発行は本物の /oauth/token で行うため、/mcp の側の検証は本番と同じ経路を通る。
import { env, SELF } from 'cloudflare:test';
import { type AuthProps, authorizationServer } from '../../src/auth';

const ORIGIN = 'http://localhost:8787';
const REDIRECT = 'http://localhost:3333/callback';

const encode = (text: string) => btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function signIn(user: {
  githubUserId: number;
  githubLogin: string;
  githubToken: string;
}): Promise<string> {
  const oauth = authorizationServer(env).getOAuthApi(env);
  const client = await oauth.createClient({
    redirectUris: [REDIRECT],
    tokenEndpointAuthMethod: 'none',
    clientName: 'test',
  });
  const verifier = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const challenge = encode(
    String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))),
  );
  const authorize = new URL(`${ORIGIN}/authorize`);
  authorize.search = new URLSearchParams({
    response_type: 'code',
    client_id: client.clientId,
    redirect_uri: REDIRECT,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    resource: `${ORIGIN}/mcp`,
    state: 'test',
  }).toString();
  const request = await oauth.parseAuthRequest(new Request(authorize));
  const { redirectTo } = await oauth.completeAuthorization({
    request,
    userId: String(user.githubUserId),
    metadata: {},
    scope: request.scope,
    props: { ...user, githubRefreshToken: null } satisfies AuthProps,
  });
  const code = new URL(redirectTo).searchParams.get('code') ?? '';
  const response = await SELF.fetch(`${ORIGIN}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT,
      client_id: client.clientId,
      code_verifier: verifier,
      resource: `${ORIGIN}/mcp`,
    }).toString(),
  });
  const token = (await response.json()) as { access_token?: string };
  if (!token.access_token) throw new Error(`token: ${response.status} ${JSON.stringify(token)}`);
  return token.access_token;
}
