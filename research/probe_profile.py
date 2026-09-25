import json, math, urllib.request, urllib.parse
d = json.load(open('r331.json'))['elements']
rel = next(e for e in d if e['type'] == 'relation')
ways = {e['id']: [(p['lat'], p['lon']) for p in e['geometry']] for e in d if e['type'] == 'way'}
order = [m['ref'] for m in rel['members'] if m['type'] == 'way']
print('tags:', {k: rel['tags'][k] for k in ('ref','from','to','cai_scale') if k in rel['tags']})
print('ways nella relazione:', len(order))

# concatena le way nell'ordine della relazione, girandole quando serve
line = list(ways[order[0]])
if len(order) > 1:
    nxt = ways[order[1]]
    if line[0] in (nxt[0], nxt[-1]): line.reverse()
gaps = 0
for wid in order[1:]:
    w = ways[wid]
    if line[-1] == w[0]: line += w[1:]
    elif line[-1] == w[-1]: line += list(reversed(w))[1:]
    else:
        gaps += 1; line += w
print('punti:', len(line), '| salti tra way non collegate:', gaps)

def hav(a, b):
    R = 6371000; la1, lo1, la2, lo2 = map(math.radians, (*a, *b))
    h = math.sin((la2-la1)/2)**2 + math.cos(la1)*math.cos(la2)*math.sin((lo2-lo1)/2)**2
    return 2*R*math.asin(math.sqrt(h))

# ricampiona ogni ~50 m
pts, acc = [line[0]], 0
for a, b in zip(line, line[1:]):
    acc += hav(a, b)
    if acc >= 50: pts.append(b); acc = 0
if pts[-1] != line[-1]: pts.append(line[-1])
dist = sum(hav(a, b) for a, b in zip(line, line[1:]))
print(f'lunghezza: {dist/1000:.2f} km, campioni: {len(pts)}')

ele = []
for i in range(0, len(pts), 100):
    chunk = pts[i:i+100]
    q = urllib.parse.urlencode({'latitude': ','.join(f'{p[0]:.5f}' for p in chunk), 'longitude': ','.join(f'{p[1]:.5f}' for p in chunk)})
    ele += json.load(urllib.request.urlopen('https://api.open-meteo.com/v1/elevation?' + q, timeout=30))['elevation']
up = sum(max(0, b-a) for a, b in zip(ele, ele[1:])); down = sum(max(0, a-b) for a, b in zip(ele, ele[1:]))
print(f'quota partenza {ele[0]:.0f} m, arrivo {ele[-1]:.0f} m, max {max(ele):.0f} m')
print(f'dislivello + {up:.0f} m / - {down:.0f} m')
