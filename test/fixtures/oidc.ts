// GitHub Actions の OIDC のトークンの代わり。テストの中で作った鍵で署名し、JWKS の取得を差し替える。
// /internal/checks/ と /internal/macos-checks/ の受け口のテストで使う。
import { HttpResponse, http } from 'msw';
import { beforeEach } from 'vitest';
import { ACTIONS_JWKS_URL, clearJwksCache, EXPECTED_REPOSITORY } from '../../src/checks/oidc';
import { network } from '../setup';

export const encode = (value: unknown) =>
  btoa(typeof value === 'string' ? value : JSON.stringify(value))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const encodeBytes = (buffer: ArrayBuffer) => encode(String.fromCharCode(...new Uint8Array(buffer)));

let keyPair: CryptoKeyPair;
let otherKeyPair: CryptoKeyPair;

// other が true なら、公開していない鍵で署名する。
export async function sign(claims: Record<string, unknown>, other = false, kid = 'test-key'): Promise<string> {
  const head = encode({ alg: 'RS256', typ: 'JWT', kid });
  const body = encode(claims);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    (other ? otherKeyPair : keyPair).privateKey,
    new TextEncoder().encode(`${head}.${body}`),
  );
  return `${head}.${body}.${encodeBytes(signature)}`;
}

// 公開鍵を HMAC の秘密鍵とみなして署名したトークン。RS256 と HS256 の取り違えを突く攻撃の形。
export async function signHs256WithPublicKey(claims: Record<string, unknown>): Promise<string> {
  const head = encode({ alg: 'HS256', typ: 'JWT', kid: 'test-key' });
  const body = encode(claims);
  const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const key = await crypto.subtle.importKey('raw', spki, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${encodeBytes(signature)}`;
}

export const workflowRef = (file: string, ref = 'refs/heads/main') =>
  `${EXPECTED_REPOSITORY}/.github/workflows/${file}@${ref}`;

// 受け付けるべきトークンのクレーム。job_workflow_ref だけを経路ごとに替える。
export const validClaims = (jobWorkflowRef: string) => ({
  iss: 'https://token.actions.githubusercontent.com',
  aud: 'audio-soko-kun',
  repository: EXPECTED_REPOSITORY,
  job_workflow_ref: jobWorkflowRef,
  ref: 'refs/heads/main',
  exp: Math.floor(Date.now() / 1000) + 300,
});

async function generate(): Promise<CryptoKeyPair> {
  return (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
}

// 各テストの前に、JWKS の取得をテストの鍵の公開鍵に差し替える。
export function installActionsJwks(): void {
  beforeEach(async () => {
    clearJwksCache();
    keyPair ??= await generate();
    otherKeyPair ??= await generate();
    const jwk = (await crypto.subtle.exportKey('jwk', keyPair.publicKey)) as JsonWebKey;
    network.use(
      http.get(ACTIONS_JWKS_URL, () => HttpResponse.json({ keys: [{ ...jwk, kid: 'test-key', alg: 'RS256' }] })),
    );
  });
}
