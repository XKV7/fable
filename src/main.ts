import { App, setApp } from './app';
import { accounts } from './core/account';
import { BootScene } from './scenes/auth';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const app = new App(canvas);
setApp(app);
canvas.focus();
app.start(new BootScene());
(window as unknown as { __app: App }).__app = app;

/**
 * 새 버전이 배포되면 화면별 조각 파일(gacha-xxxx.js 등) 이름이 바뀌고 예전 파일은 지워진다.
 * 그 전에 열어 둔 페이지는 거점 시설(가챠·도감…)이나 영웅 그림을 불러오지 못해 아무 반응이 없었다.
 * → 조각 파일을 못 불러오면 기록을 저장하고 새로고침 (30초 안에 또 실패하면 반복하지 않고 안내만)
 */
let reloading = false;
function reloadForUpdate(): void {
  if (reloading) return;
  try {
    const last = Number(sessionStorage.getItem('pact_reload_at') ?? 0);
    if (Date.now() - last < 30_000) {
      app.toast('파일을 불러오지 못했다 — 잠시 후 새로고침해 주세요', '#ff9090');
      return;
    }
    sessionStorage.setItem('pact_reload_at', String(Date.now()));
  } catch {
    /* 저장소를 못 쓰면 그냥 새로고침 */
  }
  reloading = true;
  app.toast('새 버전이 나와 새로고침한다… (기록은 저장됨)', '#a0ffd0');
  app.persist();
  accounts.flush();
  setTimeout(() => location.reload(), 700);
}
// (preventDefault 하지 않음: 불러오기는 그대로 실패시켜 화면 전환 코드가 반쯤 실행되지 않게)
window.addEventListener('vite:preloadError', () => reloadForUpdate());
window.addEventListener('unhandledrejection', (e) => {
  const r = e.reason as { message?: string } | undefined;
  const msg = String(r?.message ?? r ?? '');
  if (/dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(msg)) {
    e.preventDefault();
    reloadForUpdate();
  }
});
