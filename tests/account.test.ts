import { beforeEach, describe, expect, it, vi } from 'vitest';

/** 노드 테스트용 localStorage */
class MemStorage {
  m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, String(v));
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();
  vi.restoreAllMocks();
});

describe('이 기기 전용 계정 (Firebase 설정 없음)', () => {
  it('가입 → 로그인 → 잘못된 비밀번호·중복 아이디·형식 오류', async () => {
    const { AccountStore } = await import('../src/core/account');
    const a = new AccountStore();
    expect(a.backend).toBe('local');
    await expect(a.signUp('ab', '123456')).rejects.toThrow('아이디는');
    await expect(a.signUp('hero01', '123')).rejects.toThrow('비밀번호는');
    const r = await a.signUp('Hero01', 'secret1');
    expect(r.session.id).toBe('hero01');
    await expect(a.signUp('hero01', 'other12')).rejects.toThrow('이미 있는 아이디');
    a.signOut();
    await expect(a.signIn('hero01', 'wrong!!')).rejects.toThrow('틀렸다');
    await expect(a.signIn('nobody', 'secret1')).rejects.toThrow('틀렸다');
    expect((await a.signIn('hero01', 'secret1')).id).toBe('hero01');
    // 비밀번호는 평문으로 저장하지 않는다
    expect(localStorage.getItem('pact_accounts_v1')).not.toContain('secret1');
  });

  it('계정별 기록 분리, 자동 로그인 유지', async () => {
    const { AccountStore } = await import('../src/core/account');
    const a = new AccountStore();
    await a.signUp('alpha', 'pw1234');
    a.write({ stones: 111 });
    a.signOut();
    await a.signUp('bravo', 'pw1234');
    expect(await a.load()).toBeNull();
    a.write({ stones: 222 });
    a.signOut();
    await a.signIn('alpha', 'pw1234');
    expect(await a.load()).toEqual({ stones: 111 });
    // 새로고침 = 새 인스턴스에서 지난 로그인 복원
    const b = new AccountStore();
    expect((await b.restore())?.id).toBe('alpha');
    expect(await b.load()).toEqual({ stones: 111 });
    b.signOut();
    expect(await new AccountStore().restore()).toBeNull();
  });

  it('계정 이전의 기존 기록은 첫 가입 계정으로 옮겨진다 (한 번만)', async () => {
    const { AccountStore } = await import('../src/core/account');
    localStorage.setItem('pact_save_v1', JSON.stringify({ stones: 999 }));
    const a = new AccountStore();
    const r = await a.signUp('first', 'pw1234');
    expect(r.imported).toBe(true);
    expect(await a.load()).toEqual({ stones: 999 });
    a.signOut();
    const r2 = await a.signUp('second', 'pw1234');
    expect(r2.imported).toBe(false);
    expect(await a.load()).toBeNull();
  });
});

describe('온라인 계정 (Firebase REST, fetch 모의)', () => {
  it('가입은 가짜 이메일로 Auth에, 기록은 Firestore saves/{uid}에', async () => {
    const { FIREBASE } = await import('../src/data/firebase');
    FIREBASE.apiKey = 'KEY';
    FIREBASE.projectId = 'proj';
    const docs = new Map<string, string>();
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url.split('?')[0]}`);
      const json = (o: unknown, status = 200): Response => new Response(JSON.stringify(o), { status });
      if (url.includes('accounts:signUp')) {
        const b = JSON.parse(String(init!.body));
        expect(b.email).toBe('hero01@pact-of-the-fallen.game');
        return json({ idToken: 'T1', refreshToken: 'R1', expiresIn: '3600', localId: 'UID1' });
      }
      if (url.includes('accounts:signInWithPassword')) {
        const b = JSON.parse(String(init!.body));
        if (b.password !== 'secret1') return json({ error: { message: 'INVALID_LOGIN_CREDENTIALS' } }, 400);
        return json({ idToken: 'T2', refreshToken: 'R2', expiresIn: '3600', localId: 'UID1' });
      }
      if (url.includes('/documents/saves/')) {
        expect((init?.headers as Record<string, string>).Authorization).toMatch(/^Bearer T/);
        const uid = url.split('/').pop()!;
        if (init?.method === 'PATCH') {
          docs.set(uid, String(init.body));
          return json({});
        }
        return docs.has(uid) ? new Response(docs.get(uid)!, { status: 200 }) : json({ error: {} }, 404);
      }
      return json({}, 500);
    });
    vi.useFakeTimers();
    const { AccountStore } = await import('../src/core/account');
    const a = new AccountStore();
    expect(a.backend).toBe('firebase');
    await a.signUp('hero01', 'secret1');
    a.write({ stones: 5 });
    await vi.advanceTimersByTimeAsync(2100);
    expect(docs.has('UID1')).toBe(true);
    // 다른 기기(로컬 캐시 없음)에서 로그인 → 클라우드 기록
    (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();
    const b = new AccountStore();
    await expect(b.signIn('hero01', 'nope123')).rejects.toThrow('틀렸다');
    await b.signIn('hero01', 'secret1');
    expect(await b.load()).toEqual({ stones: 5 });
    expect(calls.some((c) => c.startsWith('PATCH'))).toBe(true);
    vi.useRealTimers();
    FIREBASE.apiKey = '';
    FIREBASE.projectId = '';
  });
});

describe('런 이어하기 저장', () => {
  it('RunState 직렬화 → 복원 시 진행 상태와 난수가 같다', async () => {
    const { newSave, sanitize } = await import('../src/game/save');
    const { RunState } = await import('../src/game/run');
    const { snapRun, restoreRun } = await import('../src/game/runsave');
    const s = newSave();
    s.chars.rina = { lv: 3, aw: 0, count: 1 };
    s.loadout.chars = ['kael', 'rina'];
    const run = new RunState(s, 42);
    run.relics.push('r1');
    run.gold = 321;
    run.hp = 77;
    run.cur = 2;
    const entry = run.rng.state;
    run.rng.next();
    const snap = snapRun(run, { rngEntry: entry, template: 'c_hall', cleared: true, bossDown: false, used: [true, false] });
    // 저장 데이터에 넣었다 꺼내도 유지
    const s2 = sanitize(JSON.parse(JSON.stringify({ ...s, run: snap })));
    expect(s2.run).not.toBeNull();
    const back = restoreRun(s2, s2.run!);
    expect(back.gold).toBe(321);
    expect(back.hp).toBe(77);
    expect(back.relics).toEqual(['r1']);
    expect(back.cur).toBe(2);
    expect(back.nodes.length).toBe(run.nodes.length);
    expect(back.rng.state).toBe(entry);
    expect(s2.run!.room).toEqual({ cleared: true, bossDown: false, used: [true, false] });
    // 손상된 런 기록은 버린다
    expect(sanitize({ ...s, run: { v: 1, data: {} } }).run).toBeNull();
  });
});
