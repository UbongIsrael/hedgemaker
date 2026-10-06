"""Generate the selected palette sheet, tokens, preview, and contrast report."""
from pathlib import Path
import html
import json
import math

ROOT = Path(__file__).resolve().parent
COLORS = {
    'green': ('Banknote green', '#0B493A', 'Primary brand / main action', '#FFFFFF'),
    'paper': ('Naira paper', '#F4F1E8', 'Default canvas', '#111E26'),
    'ink': ('Engraved ink', '#111E26', 'Headlines / numbers / body', '#F4F1E8'),
    'blue': ('Trust blue', '#2563EB', 'Links / selection / focus', '#FFFFFF'),
    'lime': ('Electric lime', '#DAFF01', 'Small signature highlights', '#111E26'),
    'clay': ('Heritage clay', '#B9472F', 'Editorial / pattern accent', '#FFFFFF'),
    'mint': ('Soft mint', '#DCEEE4', 'Supporting green surface', '#0B493A'),
    'burgundy': ('Heritage burgundy', '#701C2D', 'Supporting artwork only', '#FFFFFF'),
}
UTILITY = {
    'surface': '#FFFFFF', 'text-muted': '#53645E', 'line': '#D4DBD4',
    'control-border': '#71857A', 'blue-tint': '#F0F4FF',
    'green-hover': '#07392D', 'blue-hover': '#174DCA',
    'success': '#16734F', 'danger': '#B42332',
}

def luminance(value):
    rgb = [int(value[i:i+2], 16) / 255 for i in (1, 3, 5)]
    linear = [c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in rgb]
    return sum(c*w for c, w in zip(linear, [.2126, .7152, .0722]))

def contrast(a, b):
    low, high = sorted([luminance(a), luminance(b)])
    return (high+.05)/(low+.05)

parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1560" viewBox="0 0 1440 1560" role="img" aria-labelledby="title desc">',
         '<title id="title">HedgeMaker — naira-inspired brand palette</title>',
         '<desc id="desc">Selected palette with green as primary, paper and ink neutrals, blue functional accent, lime and clay signature accents, mint and burgundy support, and original banknote-inspired line studies.</desc>']

def rect(x, y, w, h, fill, radius=0, extra=''):
    parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="{fill}" {extra}/>')

def text(x, y, value, size=24, fill='#111E26', weight=400, font='DejaVu Sans', extra=''):
    parts.append(f'<text x="{x}" y="{y}" font-family="{font}" font-size="{size}" font-weight="{weight}" fill="{fill}" {extra}>{html.escape(value)}</text>')

def path(d, color, width=1, opacity=1):
    parts.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{width}" opacity="{opacity}"/>')

def rosette(cx, cy, radius, color, opacity=.5):
    # Original parametric ornament, never traced from a currency image.
    for ring in range(16):
        points=[]
        for j in range(721):
            t=j*math.pi/360
            r=radius*(.58+ring*.022)+radius*.095*math.sin(12*t+ring*.16)
            points.append((cx+r*math.cos(t), cy+r*math.sin(t)))
        d='M '+' L '.join(f'{x:.2f},{y:.2f}' for x,y in points)+' Z'
        path(d, color, .8, opacity)

rect(0, 0, 1440, 1560, '#F4F1E8')
text(64, 65, 'HEDGEMAKER   /   BRAND STUDY 01', 18, '#53645E', 500, extra='letter-spacing="2"')
text(64, 151, 'Naira roots. A modern signal.', 59, weight=600)
text(64, 202, 'Banknote depth + trust blue + electric lime + warm heritage red.', 23, '#53645E')

# Dominant anchor has twice the area of each neutral.
for key,x,w in [('green',64,632),('paper',720,312),('ink',1056,320)]:
    name,color,role,fg=COLORS[key]
    rect(x,250,w,242,color,10, 'stroke="#D4DBD4" stroke-width="1"' if key=='paper' else '')
    text(x+24,286,'PRIMARY BRAND' if key=='green' else 'NEUTRAL',14,fg,500,extra='letter-spacing="1.5"')
    text(x+24,350,name,30,fg,600)
    text(x+24,388,color,26,fg,font='DejaVu Sans Mono')
    text(x+24,456, 'Main action / brand field' if key=='green' else ('Canvas / white space' if key=='paper' else 'Type / financial data'),18,fg)

for key,x in [('blue',64),('lime',508),('clay',952)]:
    name,color,role,fg=COLORS[key]
    rect(x,516,424,190,color,10)
    text(x+24,555,name,29,fg,600)
    text(x+24,599,color,25,fg,font='DejaVu Sans Mono')
    text(x+24,669,role,18,fg)

for key,x in [('mint',64),('burgundy',740)]:
    name,color,role,fg=COLORS[key]
    rect(x,736,64,64,color,6)
    text(x+83,761,f'{name}  {color}',21,weight=600)
    text(x+83,793,role,18,'#53645E')

text(64,861,'HOW THE COLORS WORK TOGETHER',18,'#53645E',500,extra='letter-spacing="1.5"')
rect(64,886,844,306,'#0B493A',12)
parts.append('<defs><clipPath id="brand"><rect x="64" y="886" width="844" height="306" rx="12"/></clipPath></defs><g clip-path="url(#brand)">')
rosette(758,1040,172,'#DCEEE4',.38)
text(676,1080,'₦',126,'#DAFF01',600)
parts.append('</g>')
text(96,933,'NAIRA-INSPIRED BRAND FIELD',15,'#DCEEE4',500,extra='letter-spacing="1"')
text(96,995,'Local character.',38,'#F4F1E8',600)
text(96,1044,'Clear direction.',38,'#F4F1E8',600)
rect(96,1116,157,38,'#DAFF01',3)
text(110,1142,'SIGNATURE DETAIL',13,'#111E26',600)
rect(932,886,444,306,'#FFFFFF',12)
text(964,930,'INTERFACE COLOR STUDY',15,'#53645E',500)
text(964,979,'Clean surfaces.',29,weight=600)
text(964,1016,'Readable actions.',29,weight=600)
rect(964,1043,242,54,'#0B493A',6)
text(985,1078,'Primary action',21,'#FFFFFF',500)
text(964,1152,'Trust blue for links',21,'#2563EB',500,extra='text-decoration="underline"')

text(64,1250,'ORIGINAL PATTERN STUDIES',18,'#53645E',500,extra='letter-spacing="1.5"')
for x,bg in [(64,'#DCEEE4'),(508,'#F4F1E8'),(952,'#701C2D')]:
    rect(x,1275,424,170,bg,6,'stroke="#D4DBD4" stroke-width="1"' if x==508 else '')
parts.append('<defs><clipPath id="patterns"><rect x="64" y="1275" width="424" height="170" rx="6"/><rect x="508" y="1275" width="424" height="170" rx="6"/><rect x="952" y="1275" width="424" height="170" rx="6"/></clipPath></defs><g clip-path="url(#patterns)">')
rosette(276,1360,128,'#0B493A',.65)
for i in range(30):
    coords=[]
    for j in range(91):
        x=508+j*4.72;y=1260+i*7+16*math.sin(j*.11+i*.095)
        coords.append((x,y))
    path('M '+' L '.join(f'{x:.1f},{y:.1f}' for x,y in coords),'#B9472F',.75,.7)
for x in range(935,1400,48):
    for y in range(1250,1490,48):
        path(f'M {x},{y+24} l 24,-24 l 24,24 l -24,24 Z','#F4F1E8',1.2,.72)
        path(f'M {x+12},{y+24} l 12,-12 l 12,12 l -12,12 Z','#B9472F',2,.9)
parts.append('</g>')
text(64,1481,'01  Engraved rosette',19,weight=500)
text(508,1481,'02  Woven line field',19,weight=500)
text(952,1481,'03  Warm geometric repeat',19,weight=500)
text(64,1532,'Selected palette. See design.md for the chosen wordmark, website typefaces, and color usage rules.',16,'#53645E')
parts.append('</svg>')
svg='\n'.join(parts)
(ROOT/'palette.svg').write_text(svg)

tokens={key:{'name':v[0],'hex':v[1],'role':v[2],'onColor':v[3]} for key,v in COLORS.items()}
(ROOT/'palette.json').write_text(json.dumps({'status':'final selected brand palette','brand':tokens,'utility':UTILITY},indent=2)+'\n')
css=['/* Selected brand tokens. Reference only; not imported by the application yet. */',':root {']
css += [f'  --brand-{k}: {v[1]};' for k,v in COLORS.items()]
css += [f'  --color-{k}: {v};' for k,v in UTILITY.items()]
css += ['}','']
(ROOT/'palette.css').write_text('\n'.join(css))

pairs=[('Ink / paper','ink','paper'),('Muted text / paper','text-muted','paper'),
       ('White / green','surface','green'),('Lime / green','lime','green'),
       ('Ink / lime','ink','lime'),('Blue / paper','blue','paper'),
       ('White / blue','surface','blue'),('Clay / paper','clay','paper'),
       ('White / clay','surface','clay'),('Green / mint','green','mint'),
       ('Paper / burgundy','paper','burgundy'),('Blue / blue tint','blue','blue-tint'),
       ('Success / paper','success','paper'),('Danger / paper','danger','paper'),
       ('Control border / paper','control-border','paper'),('Decorative line / paper','line','paper')]
all_colors={k:v[1] for k,v in COLORS.items()}|UTILITY
report=[]
for label,fg,bg in pairs:
    ratio=contrast(all_colors[fg],all_colors[bg])
    report.append({'pair':label,'foreground':all_colors[fg],'background':all_colors[bg],
                   'ratio':round(ratio,4),'normalTextAA':ratio>=4.5,'largeTextAndNonTextAA':ratio>=3})
(ROOT/'contrast.json').write_text(json.dumps(report,indent=2)+'\n')

buttons=''.join(f'<button type="button" data-hex="{v[1]}" style="--swatch:{v[1]}"><span class="dot"></span><span>{v[0]}<small>{v[1]} · Copy hex</small></span></button>' for v in COLORS.values())
preview='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HedgeMaker — selected palette</title>
<style>*{box-sizing:border-box}body{margin:0;background:#F4F1E8;color:#111E26;font-family:system-ui,sans-serif}main{max-width:1480px;margin:auto;padding:20px}img{display:block;width:100%;height:auto}.copy{padding:24px 3%;border-top:1px solid #D4DBD4}h1{font-size:22px;font-weight:600}p{line-height:1.5;color:#53645E}.swatches{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}button{display:flex;gap:12px;align-items:center;text-align:left;border:1px solid #71857A;border-radius:6px;padding:14px;background:#fff;color:#111E26;font:inherit;cursor:pointer}button:hover{background:#DCEEE4}button:focus-visible,a:focus-visible{outline:3px solid #2563EB;outline-offset:3px}.dot{width:30px;height:30px;flex-shrink:0;border-radius:50%;background:var(--swatch);border:1px solid #71857A}small{display:block;color:#53645E;margin-top:4px;font:12px monospace}a{color:#2563EB}#status{min-height:24px;color:#0B493A}@media(max-width:780px){main{padding:8px}.swatches{grid-template-columns:repeat(2,minmax(0,1fr))}button{padding:10px;font-size:14px}}@media(max-width:430px){.swatches{grid-template-columns:1fr}}</style>
<main><img src="palette.svg" alt="HedgeMaker naira-inspired palette sheet: green primary, paper and ink neutrals, blue, lime and clay accents, mint and burgundy support; three original decorative patterns."><section class="copy"><h1>Explore the palette</h1><p>Select a color to copy its hex value. This is the selected HedgeMaker palette. Color roles and usage rules are in design.md.</p><div class="swatches">'''+buttons+'''</div><p id="status" role="status" aria-live="polite"></p><p><a href="palette.png" download>Download palette image</a> · <a href="palette.svg" download>Download vector sheet</a> · <a href="palette.json" download>Download tokens</a> · <a href="../../design.md">Read design notes</a></p></section></main>
<script>document.querySelectorAll('[data-hex]').forEach(button=>button.addEventListener('click',async()=>{const hex=button.dataset.hex;const status=document.getElementById('status');try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(hex)}else{const input=document.createElement('textarea');input.value=hex;input.setAttribute('aria-label','Color hex value');document.body.append(input);input.select();const copied=document.execCommand('copy');input.remove();if(!copied)throw Error('copy unavailable')}status.textContent=`Copied ${hex}`;}catch{status.textContent=`Color: ${hex}. Select and copy this value.`}}));</script></html>'''
(ROOT/'palette-preview.html').write_text(preview)
print('Wrote palette.svg, palette.json, palette.css, contrast.json, palette-preview.html')
for entry in report:
    print(f"{entry['pair']}: {entry['ratio']:.2f}:1")
