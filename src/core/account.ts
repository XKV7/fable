import { FIREBASE, firebaseEnabled } from '../data/firebase';

/**
 * 게임 전용 계정 (아이디 + 비밀번호).
 * - Firebase 설정이 있으면 Firebase Authentication(이메일/비밀번호) + Firestore에 REST API로 저장한다. SDK는 쓰지 않는다.
 *   아이디는 내부적으로 `아이디@pact-of-the-fallen.game` 형식의 가짜 이메일로 바뀐다(메일은 보내지 않는다).
 * - 설정이 없으면 같은 흐름으로 이 브라우저의 localStorage에만 계정을 만든다(비밀번호는 PBKDF2 해시로만 보관).
 * 어느 쪽이든 계정별 기록은 로컬에도 캐시해 오프라인·새로고침에서도 바로 불러온다.
 */

export type Backend = 'local' | 'firebase';

export interface Session {
  id: string;
  kind: Backend;
  uid?: string;
  idToken?: string;
  refreshToken?: string;
  exp?: number; // idToken 만료 시각 (ms)
}

interface Stored {
  save: unknown;
  updated: number;
}

const SESSION_KEY = 'pact_session_v1';
const ACCOUNTS_KEY = 'pact_accounts_v1';
const LEGACY_SAVE_KEY = 'pact_save_v1';
const LEGACY_CLAIM_KEY = 'pact_save_v1_claimed';
const EMAIL_DOMAIN = 'pact-of-the-fallen.game';

export const ID_RULE = '영문 소문자·숫자·_ 4~16자';
export const PW_RULE = '6자 이상';

export function validateId(id: string): string | null {
  return /^[a-z0-9_]{4,16}$/.test(id) ? null : `아이디는 ${ID_RULE}`;
}
export function validatePw(pw: string): string | null {
  return pw.length >= 6 && pw.length <= 64 ? null : `비밀번호는 ${PW_RULE}`;
}

const ls = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string): boolean {
    try {
      localStorage.setItem(k, v);
      return true;
    } catch {
      return false;
    }
  },
  del(k: string): void {
    try {
      localStorage.removeItem(k);
    } catch {
      /* 무시 */
    }
  },
};

const cacheKey = (s: Session): string => `pact_data_v1:${s.kind === 'firebase' ? 'fb' : 'local'}:${s.id}`;

// ───────────── 비밀번호 해시 (로컬 계정) ─────────────
const hex = (b: ArrayBuffer | Uint8Array): string => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

export async function hashPassword(pw: string, salt: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const key = await subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
    const bits = await subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100_000, hash: 'SHA-256' }, key, 256);
    return 'pbkdf2:' + hex(bits);
  }
  // 보안 컨텍스트가 아닌 환경(http 사설망 등) 대비: 단순 반복 해시
  let h = 2166136261;
  const s = salt + ':' + pw;
  for (let r = 0; r < 5000; r++) for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return 'fnv:' + h.toString(16);
}

function randomSalt(): string {
  const a = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') crypto.getRandomValues(a);
  else for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
  return hex(a);
}

// ───────────── Firebase REST ─────────────
export class AccountError extends Error {}

const FB_MSG: Record<string, string> = {
  EMAIL_EXISTS: '이미 있는 아이디다',
  EMAIL_NOT_FOUND: '아이디 또는 비밀번호가 틀렸다',
  INVALID_PASSWORD: '아이디 또는 비밀번호가 틀렸다',
  INVALID_LOGIN_CREDENTIALS: '아이디 또는 비밀번호가 틀렸다',
  USER_DISABLED: '사용이 중지된 계정이다',
  TOO_MANY_ATTEMPTS_TRY_LATER: '시도가 너무 많다. 잠시 후 다시 시도하자',
  OPERATION_NOT_ALLOWED: 'Firebase에서 이메일/비밀번호 로그인이 꺼져 있다',
  CONFIGURATION_NOT_FOUND: 'Firebase 인증 설정을 찾을 수 없다',
};

async function fbPost(url: string, body: unknown, form = false): Promise<Record<string, string>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' },
      body: form ? (body as string) : JSON.stringify(body),
    });
  } catch {
    throw new AccountError('서버에 연결할 수 없다 (인터넷 연결 확인)');
  }
  const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } } & Record<string, string>;
  if (!res.ok) {
    const code = (j.error?.message ?? '').split(' ')[0].split(':')[0];
    throw new AccountError(FB_MSG[code] ?? (code.startsWith('WEAK_PASSWORD') ? `비밀번호는 ${PW_RULE}` : `로그인 오류 (${code || res.status})`));
  }
  return j;
}

const authUrl = (op: string): string => `https://identitytoolkit.googleapis.com/v1/accounts:${op}?key=${FIREBASE.apiKey}`;
const docUrl = (uid: string): string => `https://firestore.googleapis.com/v1/projects/${FIREBASE.projectId}/databases/(default)/documents/saves/${uid}`;

function fbSession(id: string, j: Record<string, string>): Session {
  return { id, kind: 'firebase', uid: j.localId ?? j.user_id, idToken: j.idToken ?? j.id_token, refreshToken: j.refreshToken ?? j.refresh_token, exp: Date.now() + (Number(j.expiresIn ?? j.expires_in) || 3600) * 1000 };
}

// ───────────── 계정 저장소 ─────────────
export class AccountStore {
  session: Session | null = null;
  /** 클라우드 저장 상태 (화면 표시용) */
  cloud: 'off' | 'ok' | 'saving' | 'error' = 'off';
  private pending: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  get backend(): Backend {
    return firebaseEnabled() ? 'firebase' : 'local';
  }

  /** 지난 로그인 유지 */
  async restore(): Promise<Session | null> {
    const raw = ls.get(SESSION_KEY);
    if (!raw) return null;
    try {
      const s = JSON.parse(raw) as Session;
      if (s.kind !== this.backend || !s.id) return null;
      if (s.kind === 'local' && !this.localAccounts()[s.id]) return null;
      this.session = s;
      if (s.kind === 'firebase') {
        this.cloud = 'ok';
        await this.fresh().catch(() => undefined); // 오프라인이면 캐시로 계속
      }
      return s;
    } catch {
      return null;
    }
  }

  private localAccounts(): Record<string, { salt: string; hash: string; created: number }> {
    try {
      return JSON.parse(ls.get(ACCOUNTS_KEY) ?? '{}');
    } catch {
      return {};
    }
  }

  async signUp(id: string, pw: string): Promise<{ session: Session; imported: boolean }> {
    id = id.trim().toLowerCase();
    const bad = validateId(id) ?? validatePw(pw);
    if (bad) throw new AccountError(bad);
    let s: Session;
    if (this.backend === 'firebase') {
      s = fbSession(id, await fbPost(authUrl('signUp'), { email: `${id}@${EMAIL_DOMAIN}`, password: pw, returnSecureToken: true }));
    } else {
      const acc = this.localAccounts();
      if (acc[id]) throw new AccountError('이미 있는 아이디다');
      const salt = randomSalt();
      acc[id] = { salt, hash: await hashPassword(pw, salt), created: Date.now() };
      if (!ls.set(ACCOUNTS_KEY, JSON.stringify(acc))) throw new AccountError('이 브라우저에 저장할 수 없다 (저장소 차단)');
      s = { id, kind: 'local' };
    }
    this.begin(s);
    // 계정이 생기기 전에 이 기기에서 하던 기록이 있으면 첫 계정으로 옮긴다
    let imported = false;
    const legacy = ls.get(LEGACY_SAVE_KEY);
    if (legacy && !ls.get(LEGACY_CLAIM_KEY)) {
      ls.set(LEGACY_CLAIM_KEY, id);
      try {
        this.write(JSON.parse(legacy));
        imported = true;
      } catch {
        /* 손상된 옛 기록은 무시 */
      }
    }
    return { session: s, imported };
  }

  async signIn(id: string, pw: string): Promise<Session> {
    id = id.trim().toLowerCase();
    if (!id || !pw) throw new AccountError('아이디와 비밀번호를 입력하자');
    let s: Session;
    if (this.backend === 'firebase') {
      s = fbSession(id, await fbPost(authUrl('signInWithPassword'), { email: `${id}@${EMAIL_DOMAIN}`, password: pw, returnSecureToken: true }));
    } else {
      const a = this.localAccounts()[id];
      if (!a || (await hashPassword(pw, a.salt)) !== a.hash) throw new AccountError('아이디 또는 비밀번호가 틀렸다');
      s = { id, kind: 'local' };
    }
    this.begin(s);
    return s;
  }

  private begin(s: Session): void {
    this.session = s;
    this.cloud = s.kind === 'firebase' ? 'ok' : 'off';
    ls.set(SESSION_KEY, JSON.stringify(s));
  }

  signOut(): void {
    this.flush();
    this.session = null;
    this.cloud = 'off';
    ls.del(SESSION_KEY);
  }

  private async fresh(): Promise<Session> {
    const s = this.session!;
    if (s.kind !== 'firebase') return s;
    if (s.idToken && (s.exp ?? 0) > Date.now() + 60_000) return s;
    const j = await fbPost(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE.apiKey}`, `grant_type=refresh_token&refresh_token=${encodeURIComponent(s.refreshToken ?? '')}`, true);
    const n = fbSession(s.id, j);
    n.uid = n.uid ?? s.uid;
    this.session = n;
    ls.set(SESSION_KEY, JSON.stringify(n));
    return n;
  }

  private readCache(): Stored | null {
    if (!this.session) return null;
    try {
      const r = JSON.parse(ls.get(cacheKey(this.session)) ?? 'null') as Stored | null;
      return r && typeof r.updated === 'number' ? r : null;
    } catch {
      return null;
    }
  }

  /** 계정 기록 불러오기 (로컬 캐시와 클라우드 중 더 최근 것). 없으면 null */
  async load(): Promise<unknown | null> {
    if (!this.session) return null;
    const local = this.readCache();
    if (this.session.kind !== 'firebase') return local?.save ?? null;
    try {
      const s = await this.fresh();
      const res = await fetch(docUrl(s.uid!), { headers: { Authorization: `Bearer ${s.idToken}` } });
      if (res.status === 404) return local?.save ?? null;
      if (!res.ok) throw new Error(String(res.status));
      const j = (await res.json()) as { fields?: { data?: { stringValue?: string }; updated?: { integerValue?: string } } };
      const updated = Number(j.fields?.updated?.integerValue ?? 0);
      const data = j.fields?.data?.stringValue;
      this.cloud = 'ok';
      if (data && (!local || updated >= local.updated)) {
        ls.set(cacheKey(this.session), JSON.stringify({ save: JSON.parse(data), updated }));
        return JSON.parse(data);
      }
      if (local) this.queue(JSON.stringify(local.save)); // 로컬이 더 최근이면 올려 둔다
      return local?.save ?? null;
    } catch {
      this.cloud = 'error';
      return local?.save ?? null;
    }
  }

  /** 기록 저장: 로컬 캐시는 즉시, 클라우드는 2초 모아서 */
  write(save: unknown): boolean {
    if (!this.session) return false;
    const json = JSON.stringify(save);
    const ok = ls.set(cacheKey(this.session), `{"save":${json},"updated":${Date.now()}}`);
    if (this.session.kind === 'firebase') this.queue(json);
    return ok;
  }

  private queue(json: string): void {
    this.pending = json;
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.push();
    }, 2000);
  }

  private async push(keepalive = false): Promise<void> {
    const json = this.pending;
    if (!json || this.session?.kind !== 'firebase') return;
    this.pending = null;
    this.cloud = 'saving';
    try {
      const s = keepalive ? this.session : await this.fresh();
      const body = JSON.stringify({ fields: { id: { stringValue: s.id }, data: { stringValue: json }, updated: { integerValue: String(Date.now()) } } });
      const res = await fetch(docUrl(s.uid!), { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.idToken}` }, body, keepalive: keepalive && body.length < 60_000 });
      if (!res.ok) throw new Error(String(res.status));
      this.cloud = 'ok';
    } catch {
      this.cloud = 'error';
      if (!this.pending) this.pending = json; // 다음 저장 때 다시 시도
    }
  }

  /** 페이지를 닫을 때 남은 저장을 바로 보낸다 */
  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.pending) void this.push(true);
  }
}

export const accounts = new AccountStore();
