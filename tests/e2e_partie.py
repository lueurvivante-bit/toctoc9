import time, json, random
from playwright.sync_api import sync_playwright
URL='http://127.0.0.1:8787/'
errs=[]; frames={'hote':[],'invite':[]}
def mk(b,prof):
    c=b.new_context(viewport={'width':420,'height':860})
    p=c.new_page(); p.on('pageerror',lambda e:errs.append(prof+': '+str(e)))
    p.on('console',lambda m: errs.append(prof+' console: '+m.text) if m.type=='error' else None)
    p.on('websocket',lambda ws: ws.on('framereceived',lambda f: frames[prof].append(f if isinstance(f,str) else f.decode())))
    p.goto(URL+'?profil='+prof+'&accueil=1'); return p
with sync_playwright() as pw:
    b=pw.chromium.launch()
    h=mk(b,'hote'); j=mk(b,'invite')
    h.click('#create'); h.fill('#hostName','Jonathan'); h.click('[data-avatar="fox"]'); h.click('#toConfig')
    h.click('[data-st="n"][data-d="1"]'); h.click('[data-st="b"][data-d="1"]')  # 3 joueurs dont 1 bot
    h.click('#doCreate'); h.wait_for_selector('#codeBox'); code=h.inner_text('#codeBox').strip()
    j.click('#join'); j.fill('#jName','Eleve'); j.fill('#jCode',code); time.sleep(0.6); j.click('[data-avatar="cat"]'); j.click('#doJoin')
    h.wait_for_selector('#launch'); time.sleep(0.3); h.click('#launch')
    for p in (h,j): p.wait_for_selector('#peekDone',timeout=8000)
    for p in (h,j): p.locator('[data-peek]').first.click(); time.sleep(0.2); p.click('#peekDone')
    hostuid=h.evaluate("()=>uid"); guestuid=j.evaluate("()=>uid")
    t_end=time.time()+150; rounds=0; actions=0
    while time.time()<t_end:
        done=False
        for p in (h,j):
            if p.locator('#newRound, [id*="newround" i], #again').count():
                pass
        ph=h.evaluate("()=>gstate&&gstate.phase")
        if ph in ('reveal','over'):
            rounds+=1; print('fin de manche', ph, h.evaluate("()=>gstate.verdict")); break
        for p in (h,j):
            try:
                if p.locator('#figSkip').count(): p.click('#figSkip',timeout=1000); actions+=1
                elif p.locator('#draw:not([disabled])').count():
                    p.click('#draw',timeout=1000); p.wait_for_selector('#discard',timeout=4000)
                    if random.random()<0.5: p.click('#discard',timeout=1000)
                    else:
                        p.locator('[data-mine]').nth(random.randint(0,3)).click(timeout=1000)
                    actions+=1
                elif p.locator('#toc:not([disabled])').count() and random.random()<0.15:
                    p.click('#toc',timeout=1000); actions+=1
            except Exception as e: pass
        time.sleep(0.25)
    print('actions',actions)
    # Fuite : l'invité a-t-il reçu une carte de l'hôte hors révélation ?
    leak=0
    for f in frames['invite']:
        m=json.loads(f)
        if m.get('t')!='view': continue
        d=m['d']
        s=json.dumps(d)
        if 'engine' in s or '"deck"' in s: leak+=1
        st=d.get('state') or {}
        if st.get('phase') in ('turn','peek') and st.get('reveal'): leak+=1
    print('messages invité',len(frames['invite']),'fuites',leak)
    print('erreurs',errs[:8])
    h.screenshot(path='/tmp/claude-0/e2e/host_end.png')
    b.close()
