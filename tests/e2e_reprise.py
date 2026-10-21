import time
from playwright.sync_api import sync_playwright
URL='http://127.0.0.1:8787/'
errs=[]
def mk(b,prof,q='&accueil=1'):
    c=b.new_context(viewport={'width':420,'height':860})
    p=c.new_page(); p.on('pageerror',lambda e:errs.append(prof+': '+str(e)))
    p.goto(URL+'?profil='+prof+q); return c,p
with sync_playwright() as pw:
    b=pw.chromium.launch()
    hc,h=mk(b,'h2'); jc,j=mk(b,'j2')
    h.click('#create'); h.fill('#hostName','Hote'); h.click('[data-avatar="fox"]'); h.click('#toConfig'); h.click('#doCreate')
    h.wait_for_selector('#codeBox'); code=h.inner_text('#codeBox').strip()
    j.click('#join'); j.fill('#jName','Invite'); j.fill('#jCode',code); time.sleep(0.6); j.click('[data-avatar="cat"]'); j.click('#doJoin')
    h.wait_for_selector('#launch'); time.sleep(0.3); h.click('#launch')
    for p in (h,j): p.wait_for_selector('#peekDone'); p.locator('[data-peek]').first.click(); time.sleep(0.2); p.click('#peekDone')
    for p in (h,j): p.wait_for_selector('#draw')
    # 1) l'invité recharge la page en pleine partie
    j.reload(); j.wait_for_selector('#draw',timeout=8000); print('reprise après rechargement : OK', j.evaluate("()=>gstate.phase"))
    hand=j.evaluate("()=>JSON.stringify(myHand)"); print('main revue après reprise', hand[:60])
    # 2) l'hôte ferme son onglet : l'invité devient organisateur, le jeu continue
    cur=h.evaluate("()=>gstate.order[gstate.turnIndex]"); hu=h.evaluate("()=>uid")
    hc.close(); t=time.time()
    j.wait_for_function("()=>isHost===true",timeout=20000); print('invité devient organisateur après %.1fs'%(time.time()-t))
    t=time.time(); j.wait_for_function("()=>gstate.order[gstate.turnIndex]===uid || gstate.turnNumber>0",timeout=20000)
    print('le jeu avance sans l\'hôte (tour', j.evaluate("()=>gstate.turnNumber"),')')
    print('erreurs',errs[:5]); b.close()
