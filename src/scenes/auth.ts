import { app, type Scene } from '../app';
import { audio } from '../core/audio';
import { accounts, AccountError, ID_RULE, PW_RULE } from '../core/account';
import { text } from '../gfx/renderer';
import { TitleScene } from './title';

/** 로그인 직후: 계정 기록을 불러와 타이틀로 */
export async function enterGame(imported = false): Promise<void> {
  const raw = await accounts.load();
  app.login(raw);
  if (imported) app.toast('이 기기에 있던 기존 기록을 이 계정으로 옮겼다', '#a0ffd0');
  if (app.save.run) app.toast('진행 중인 런이 있다 — 「런 이어하기」로 계속할 수 있다', '#ffe0a0');
  if (raw) app.persist(); // 새 계정은 첫 저장 전까지 "시작하기"(인트로부터)
  app.go(new TitleScene());
}

/** 시작: 지난 로그인이 있으면 자동 로그인, 없으면 로그인 화면 */
export class BootScene implements Scene {
  t = 0;
  enter(): void {
    void (async () => {
      const s = await accounts.restore();
      if (s) await enterGame();
      else app.go(new AuthScene(), false);
    })();
  }
  update(): void {
    this.t++;
  }
  world(g: CanvasRenderingContext2D): void {
    g.fillStyle = '#07060b';
    g.fillRect(0, 0, 480, 270);
  }
  ui(g: CanvasRenderingContext2D): void {
    if (this.t > 20) text(g, '불러오는 중…', 240, 130, { size: 8, align: 'center', color: '#8a8098' });
  }
}

const CSS = `
.pact-auth{position:fixed;left:50%;top:50%;transform:translate(-50%,-38%);width:min(340px,86vw);padding:22px 22px 18px;box-sizing:border-box;
  background:rgba(14,10,24,.94);border:2px solid #6a4aa0;box-shadow:0 0 0 2px #0a0810,0 10px 40px rgba(0,0,0,.6);color:#e0d8f0;
  font-family:"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",sans-serif;z-index:10}
.pact-auth .tabs{display:flex;gap:6px;margin-bottom:14px}
.pact-auth .tabs button{flex:1;padding:8px 0;background:#1a1428;color:#a8a0c0;border:1px solid #3a2e52;font:inherit;font-size:14px;cursor:pointer}
.pact-auth .tabs button.on{background:#3a2a5a;color:#ffe0a0;border-color:#c0a060}
.pact-auth label{display:block;font-size:12px;color:#a8a0c0;margin:10px 0 4px}
.pact-auth input{width:100%;box-sizing:border-box;padding:9px 10px;background:#0a0812;color:#fff;border:1px solid #4a3a6a;font:inherit;font-size:15px;outline:none}
.pact-auth input:focus{border-color:#ffe0a0}
.pact-auth .go{width:100%;margin-top:16px;padding:10px 0;background:#c0a060;color:#1a1020;border:0;font:inherit;font-size:15px;font-weight:700;cursor:pointer}
.pact-auth .go:disabled{opacity:.5;cursor:default}
.pact-auth .err{min-height:18px;margin-top:10px;font-size:12px;color:#ff8090}
.pact-auth .mode{margin-top:6px;font-size:11px;color:#6a6078;text-align:center}
`;

/** 로그인 / 회원가입 화면 (게임 전용 아이디). 입력칸은 캔버스 위에 띄운 HTML 폼 */
export class AuthScene implements Scene {
  t = 0;
  private root: HTMLDivElement | null = null;
  private mode: 'login' | 'signup' = 'login';
  private busy = false;

  enter(): void {
    audio.playMusic('title');
    if (!document.getElementById('pact-auth-css')) {
      const st = document.createElement('style');
      st.id = 'pact-auth-css';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    const d = document.createElement('div');
    d.className = 'pact-auth';
    d.innerHTML = `
      <div class="tabs"><button type="button" data-m="login">로그인</button><button type="button" data-m="signup">회원가입</button></div>
      <form>
        <label>아이디 <span style="color:#6a6078">(${ID_RULE})</span></label>
        <input name="id" autocomplete="username" maxlength="16" spellcheck="false" autocapitalize="off">
        <label>비밀번호 <span style="color:#6a6078">(${PW_RULE})</span></label>
        <input name="pw" type="password" autocomplete="current-password" maxlength="64">
        <div class="pw2"><label>비밀번호 확인</label><input name="pw2" type="password" autocomplete="new-password" maxlength="64"></div>
        <button class="go" type="submit"></button>
        <div class="err"></div>
      </form>
      <div class="mode">${accounts.backend === 'firebase' ? '온라인 계정 — 어느 기기에서든 같은 아이디로 이어서 플레이' : '이 기기 전용 계정 — 기록은 이 브라우저에 저장된다'}</div>`;
    document.body.appendChild(d);
    this.root = d;
    d.querySelectorAll<HTMLButtonElement>('.tabs button').forEach((b) => (b.onclick = () => this.setMode(b.dataset.m as 'login' | 'signup')));
    d.querySelector('form')!.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.submit();
    });
    this.setMode('login');
    setTimeout(() => this.field('id').focus(), 50);
  }

  leave(): void {
    this.root?.remove();
    this.root = null;
  }

  private field(n: string): HTMLInputElement {
    return this.root!.querySelector(`input[name=${n}]`) as HTMLInputElement;
  }

  private setMode(m: 'login' | 'signup'): void {
    this.mode = m;
    const d = this.root!;
    d.querySelectorAll<HTMLButtonElement>('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.m === m));
    (d.querySelector('.pw2') as HTMLDivElement).style.display = m === 'signup' ? '' : 'none';
    (d.querySelector('.go') as HTMLButtonElement).textContent = m === 'signup' ? '계정 만들기' : '로그인';
    this.field('pw').autocomplete = m === 'signup' ? 'new-password' : 'current-password';
    this.error('');
  }

  private error(msg: string): void {
    if (this.root) (this.root.querySelector('.err') as HTMLDivElement).textContent = msg;
  }

  private async submit(): Promise<void> {
    if (this.busy) return;
    const id = this.field('id').value.trim().toLowerCase();
    const pw = this.field('pw').value;
    if (this.mode === 'signup' && pw !== this.field('pw2').value) {
      this.error('비밀번호 확인이 다르다');
      return;
    }
    this.busy = true;
    const btn = this.root!.querySelector('.go') as HTMLButtonElement;
    btn.disabled = true;
    this.error('');
    try {
      if (this.mode === 'signup') {
        const r = await accounts.signUp(id, pw);
        audio.play('confirm');
        this.leave();
        await enterGame(r.imported);
      } else {
        await accounts.signIn(id, pw);
        audio.play('confirm');
        this.leave();
        await enterGame();
      }
    } catch (e) {
      audio.play('error');
      this.error(e instanceof AccountError ? e.message : '알 수 없는 오류');
      btn.disabled = false;
    } finally {
      this.busy = false;
    }
  }

  update(): void {
    this.t++;
  }

  world(g: CanvasRenderingContext2D): void {
    g.fillStyle = '#07060b';
    g.fillRect(0, 0, 480, 270);
    for (let i = 0; i < 70; i++) {
      const x = (i * 97) % 480;
      const y = (i * 53 + this.t * 0.15 * (1 + (i % 3))) % 270;
      g.fillStyle = i % 5 ? 'rgba(158,240,255,0.3)' : 'rgba(255,208,112,0.35)';
      g.fillRect(x, 270 - y, 1, 1);
    }
  }

  ui(g: CanvasRenderingContext2D): void {
    text(g, '망자의 계약', 240, 22, { size: 26, align: 'center', color: '#ffd070', bold: true, shadow: '#5a2a10' });
    text(g, 'PACT  OF  THE  FALLEN', 240, 56, { size: 7, align: 'center', color: '#c0a0ff' });
  }
}
