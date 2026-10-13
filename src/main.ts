import { App, setApp } from './app';
import { TitleScene } from './scenes/title';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const app = new App(canvas);
setApp(app);
canvas.focus();
app.start(new TitleScene());
(window as unknown as { __app: App }).__app = app;
