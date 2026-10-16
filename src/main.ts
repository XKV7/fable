import { App, setApp } from './app';
import { BootScene } from './scenes/auth';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const app = new App(canvas);
setApp(app);
canvas.focus();
app.start(new BootScene());
(window as unknown as { __app: App }).__app = app;
