import sys, json
from PIL import Image, ImageDraw
sheet = Image.open(sys.argv[1]); fr = json.load(open(sys.argv[2])); out = sys.argv[3]
rows = [
  ['stride0','stride1','stride2','stride3','stride4','stride5','stride6','stride7'],
  ['run0','run0_1','run1','run1_2','run2','run2_3','run3','run3_0'],
  ['walk0','walk0_1','walk1','walk1_2','walk2','walk2_3','walk3','walk3_4','walk4'],
  ['attack0','attack0_1','attack1','attack1_2','attack2','attack2_3','attack3'],
  ['attack3','attack4','attack4_5','attack5','cast0','cast0_1','cast1'],
  ['hit1','hit_die','die0','die0_1','die1','die1_2','die2','die2_3','die3'],
  ['idle0','crouch','fall','run1','jump','run2','dash'],
]
S, CW, CH = 4, 100, 74
img = Image.new('RGB', (CW * 9 * S, CH * len(rows) * S), (58, 52, 80)); d = ImageDraw.Draw(img)
for r, row in enumerate(rows):
    for c, n in enumerate(row):
        f = fr[n]; t = sheet.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h']))
        x0 = c * CW + CW // 2 - f['ax']; y0 = r * CH + 70 - f['ay']
        img.paste(t.resize((f['w'] * S, f['h'] * S), Image.NEAREST), (x0 * S, y0 * S), t.resize((f['w'] * S, f['h'] * S), Image.NEAREST))
        gen = '_' in n or n.startswith('stride') or n in ('crouch', 'fall', 'jump', 'dash')
        d.rectangle([c * CW * S + 4, (r * CH + 71) * S, (c + 1) * CW * S - 4, (r * CH + 72) * S], fill=(255, 210, 80) if gen else (120, 110, 150))
img.save(out)
