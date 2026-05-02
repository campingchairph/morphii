// ══════════════════════════════════════════════
// GITHUB ASSET LOADER
// Base: campingchairph/morphii/main/assets/avatar/
// ══════════════════════════════════════════════
const GITHUB_BASE = 'https://raw.githubusercontent.com/campingchairph/morphii/main/assets/avatar/';
const MANIFEST_URL = GITHUB_BASE + 'manifest.json';
const loadedImages = {}; // cache: url -> HTMLImageElement

function preloadImage(url){
  if(loadedImages[url]) return Promise.resolve(loadedImages[url]);
  return new Promise(resolve=>{
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = ()=>{ loadedImages[url]=img; resolve(img); };
    img.onerror = ()=>resolve(null); // fallback to CSS drawing
    img.src = url;
  });
}

function drawImageLayer(ctx, url, x, y, w, h){
  const img = loadedImages[url];
  if(!img) return false;
  ctx.drawImage(img, x, y, w, h);
  return true;
}

// Fetch manifest and update CATS with real image URLs
async function loadAssetManifest(){
  try {
    const res = await fetch(MANIFEST_URL);
    if(!res.ok) return; // no manifest yet — use CSS fallback
    const manifest = await res.json();
    // Merge into CATS — add url to each item
    const catMap = {
      hair:'hair', eyes:'eyes', mouth:'mouth', face:'face',
      skin:'skin', outfit:'outfit', stickers:'sticker', patterns:'pattern'
    };
    const preloads = [];
    for(const [key, catKey] of Object.entries(catMap)){
      if(!manifest[key] || !CATS[catKey]) continue;
      manifest[key].forEach((item, i)=>{
        if(CATS[catKey].items[i]){
          CATS[catKey].items[i].url = item?.url || null;
          if(item?.url) preloads.push(preloadImage(item.url));
        }
      });
    }
    await Promise.all(preloads);
    console.log('Morphii assets loaded from GitHub');
    if(typeof drawPin === 'function') drawPin();
  } catch(e){
    console.log('No manifest found — using CSS drawing');
  }
}

// ═══════════════════════════════════════════
// SCREEN TRANSITIONS
// ═══════════════════════════════════════════
function goToBuilder(){
  clearInterval(landingAnimTimer); // stop landing animation loop
  document.getElementById('landing-screen').classList.add('hidden');
  document.getElementById('builder-screen').classList.add('active');
  setTimeout(()=>{ drawPin(); renderGrid('assetGrid',S.cat||'bg'); renderGrid('mobAssetGrid',S.cat||'bg'); },150);
  resetIdle();
}
function goToLanding(){
  document.getElementById('builder-screen').classList.remove('active');
  document.getElementById('landing-screen').classList.remove('hidden');
  startLandingAnim(); // restart 15s loop only when on landing
}

// ═══════════════════════════════════════════
// LANDING: swatch + icon interactions
// ═══════════════════════════════════════════
document.querySelectorAll('.swatch').forEach(s=>{
  s.addEventListener('click',e=>{
    e.stopPropagation();
    document.querySelectorAll('.swatch').forEach(x=>x.classList.remove('active'));
    s.classList.add('active');
  });
});
document.querySelectorAll('.card-icon').forEach(ic=>{
  ic.addEventListener('click',e=>{
    e.stopPropagation();
    document.querySelectorAll('.card-icon').forEach(x=>x.classList.remove('active'));
    ic.classList.add('active');
  });
});

// ═══════════════════════════════════════════
// LANDING CARD AUTO-ANIMATION (every 30s)
// cycles through: highlight each category icon,
// then cycles background swatches
// ═══════════════════════════════════════════
const CARD_ICONS = ['👤','👔','👓','🎨','😊'];
const SWATCH_COLORS = ['#FF6FAE','#3a7cc8','#FFFF00','#E875B0','#87CEEB'];
const BG_DEMOS = [
  ['#FFD6E0','#FFEFBA'],['#B8F0D8','#D4F5FF'],['#E8D5FF','#FFD6F0'],
  ['#FFD6A5','#FFEFBA'],['#C9E8FF','#E0F4FF'],['#FFFACD','#FFF0B3'],
];

let animFrame = 0;
let landingAnimTimer = null;

function runLandingAnim(){
  const icons = document.querySelectorAll('.card-icon');
  const swatches = document.querySelectorAll('.swatch');
  const avatarWrap = document.querySelector('.card-avatar-wrap');

  // Step 1-5: highlight each icon in sequence
  icons.forEach((ic,i)=>{
    setTimeout(()=>{
      icons.forEach(x=>x.classList.remove('active'));
      ic.classList.add('active');
      // change avatar body color per icon
      const av = document.querySelector('.av-body');
      const av_head = document.querySelector('.av-head');
      if(av && av_head){
        const colors = ['#87CEEB','#3a7cc8','#FF6FAE','#FFD166','#06D6A0'];
        const hairColors = ['#2a4a8a','#3D2B1F','#8B0000','#1a1a2e','#2d5a27'];
        av.style.background = colors[i];
        document.querySelector('.av-hair').style.background = hairColors[i];
      }
    }, i * 800);
  });

  // Step 6-11: cycle background swatches with glow
  BG_DEMOS.forEach((grad,i)=>{
    setTimeout(()=>{
      swatches.forEach(x=>x.classList.remove('active'));
      // update the nth swatch style temporarily
      if(swatches[i % swatches.length]){
        swatches[i % swatches.length].classList.add('active');
        swatches[i % swatches.length].style.background = `linear-gradient(135deg, ${grad[0]}, ${grad[1]})`;
      }
      if(avatarWrap){
        avatarWrap.style.background = `linear-gradient(135deg, ${grad[0]}cc, ${grad[1]}cc)`;
      }
    }, 5*800 + i * 700);
  });

  // Step 12: reset
  setTimeout(()=>{
    icons.forEach((x,i)=>{ x.classList.remove('active'); if(i===0)x.classList.add('active'); });
    swatches.forEach((x,i)=>{
      x.classList.remove('active');
      x.style.background = SWATCH_COLORS[i]||'';
      if(i===0)x.classList.add('active');
    });
    if(avatarWrap) avatarWrap.style.background = '';
  }, 5*800 + 6*700 + 400);
}

function restartHeroAnims(){
  // Elements to re-animate
  const els = [
    ...document.querySelectorAll('.hero-title .big'),
    document.querySelector('.hero-sub'),
    document.querySelector('.hero-btns'),
    document.querySelector('.badge-pill'),
    document.querySelector('.hero-right'),
  ].filter(Boolean);

  els.forEach(el=>{
    el.style.animation='none';
    el.style.opacity='0';
  });
  // Force reflow then re-apply
  void document.querySelector('.hero-title')?.offsetWidth;
  setTimeout(()=>{
    const titles = document.querySelectorAll('.hero-title .big');
    titles.forEach((el,i)=>{
      el.style.animation='';
      el.style.opacity='';
      el.style.animationName='titleDrop';
      el.style.animationDuration='0.7s';
      el.style.animationDelay=(i*0.15)+'s';
      el.style.animationFillMode='both';
      el.style.animationTimingFunction='cubic-bezier(0.22,1,0.36,1)';
    });
    const sub = document.querySelector('.hero-sub');
    if(sub){ sub.style.animation='fadeUp 0.6s 0.4s both'; }
    const btns = document.querySelector('.hero-btns');
    if(btns){ btns.style.animation='fadeUp 0.6s 0.55s both'; }
    const badge = document.querySelector('.badge-pill');
    if(badge){ badge.style.animation=''; setTimeout(()=>{ badge.style.animation='badgePop 3s ease-in-out infinite'; },100); }
    const card = document.querySelector('.hero-right');
    if(card){ card.style.animation='cardSlide 0.8s 0.2s cubic-bezier(0.22,1,0.36,1) both'; }
  }, 50);
}

function startLandingAnim(){
  clearInterval(landingAnimTimer);
  runLandingAnim();
  restartHeroAnims();
  landingAnimTimer = setInterval(()=>{
    runLandingAnim();
    restartHeroAnims();
  }, 15000);
}

// ═══════════════════════════════════════════
// IDLE TIMER (builder → auto return to landing)
// ═══════════════════════════════════════════
let idleTimer;
function resetIdle(){
  clearTimeout(idleTimer);
  const onBuilder = document.getElementById('builder-screen').classList.contains('active');
  const delay = onBuilder ? 300000 : 300000; // 5min always, landing anim handles its own loop
  idleTimer = setTimeout(()=>{
    if(document.getElementById('builder-screen').classList.contains('active')){
      goToLanding();
    }
  }, delay);
}
document.addEventListener('click', resetIdle);
document.addEventListener('touchstart', resetIdle);
document.addEventListener('mousemove', resetIdle);

// ═══════════════════════════════════════════
// BUILDER DATA & FUNCTIONS
// ═══════════════════════════════════════════
const CATS={
  bg:{title:'BACKGROUND',items:[
    {label:'Sky Blue',grad:['#87CEEB','#B0E2FF']},
    {label:'Candy',grad:['#FFD6E0','#FFEFBA']},
    {label:'Mint',grad:['#B8F0D8','#D4F5FF']},
    {label:'Lavender',grad:['#E8D5FF','#FFD6F0']},
    {label:'Peach',grad:['#FFD6A5','#FFEFBA']},
    {label:'Lemon',grad:['#FFFACD','#FFF0B3']},
    {label:'Rose',grad:['#FFD6D6','#FFE8E8']},
    {label:'Seafoam',grad:['#B8EDD8','#D8F5EC']},
    {label:'Lilac',grad:['#DDD0FF','#EEE8FF']},
    {label:'Sunrise',grad:['#FFE0B2','#FFCCBC']},
    {label:'Arctic',grad:['#E0F7FA','#B2EBF2']},
    {label:'Blush',grad:['#FCE4EC','#F8BBD0']},
    {label:'Sunset',grad:['#FF9A9E','#FECFEF']},
    {label:'Ocean',grad:['#2193B0','#6DD5FA']},
    {label:'Forest',grad:['#A8E063','#C8F08C']},
    {label:'Grape',grad:['#E0AAFF','#C77DFF']},
    {label:'Coral',grad:['#FF9A76','#FFE0C8']},
    {label:'Aurora',grad:['#A0F0C0','#92FEE0']},
    {label:'Dusk',grad:['#FFD580','#FFE9AA']},
    {label:'Berry',grad:['#FF758C','#FFB3C1']},
    {label:'Dreamy',   grad4:['#FFB3C6','#FFFACD','#E8D5FF','#C8F0E0']},
    {label:'Sunset 4', grad4:['#FFD6A5','#FFB3C6','#FFF0B3','#FECFEF']},
    {label:'Ocean 4',  grad4:['#B3E5FF','#E8D5FF','#B3C6FF','#C8F5EC']},
    {label:'Spring 4', grad4:['#C8F0E0','#FFFACD','#D4F5FF','#FFB3C6']},
    {label:'Twilight', grad4:['#E0AAFF','#FFB3C6','#B3C6FF','#C8F0E0']},
    {label:'Sherbet',  grad4:['#FF9A9E','#FFD166','#87CEEB','#C8F0D8']},
    {label:'Fairy',    grad4:['#EED5FF','#FFD6E0','#FFFACD','#D4F5FF']},
    {label:'Lullaby',  grad4:['#E8D5FF','#B3E5FF','#FFD6E0','#FFFACD']},
  ]},
  skin:{title:'SKIN TONE',items:[
    {label:'Fair',color:'#FDDBB4'},{label:'Light',color:'#F0C27F'},
    {label:'Golden',color:'#E8A96A'},{label:'Tan',color:'#C68642'},
    {label:'Brown',color:'#8D5524'},{label:'Deep',color:'#4A2810'},
    {label:'Rosy',color:'#FFECD2'},{label:'Warm',color:'#FFB347'},
  ]},
  face:{title:'FACE SHAPE',items:[
    {label:'Round',shape:'round'},{label:'Oval',shape:'oval'},
    {label:'Square',shape:'square'},{label:'Heart',shape:'heart'},
    {label:'Diamond',shape:'diamond'},
  ]},
  eyes:{title:'EYES',items:[
    {label:'Classic',type:'normal'},{label:'Wide',type:'wide'},
    {label:'Sleepy',type:'sleepy'},{label:'Star',type:'star'},
    {label:'Heart',type:'heart'},
  ]},
  mouth:{title:'MOUTH',items:[
    {label:'Smile',type:'smile'},{label:'Grin',type:'grin'},
    {label:'Smirk',type:'smirk'},{label:'Open',type:'open'},
    {label:'Wink',type:'wink'},
  ]},
  hair:{title:'HAIR',items:[
    {label:'None',type:'none'},{label:'Short',type:'short'},
    {label:'Long',type:'long'},{label:'Curly',type:'curly'},
    {label:'Bun',type:'bun'},{label:'Spiky',type:'spiky'},
  ]},
  pattern:{title:'PATTERN',items:[
    {label:'None',    type:'none'},
    // sticker scatter backgrounds (30% opacity scattered over entire pin)
    {label:'❤ Hearts', type:'scatter_hearts'},
    {label:'⭐ Stars',  type:'scatter_stars'},
    {label:'🌸 Flowers',type:'scatter_flowers'},
    {label:'✦ Gems',   type:'scatter_gems'},
    {label:'🍰 Sweets', type:'scatter_food'},
    {label:'Dots',    type:'dots'},
    {label:'Confetti',type:'confetti'},
    {label:'Stars',   type:'stars'},
    {label:'Hearts',  type:'hearts'},
    {label:'Stripes', type:'stripes'},
    {label:'Checks',  type:'checks'},
    {label:'Bubbles', type:'bubbles'},
    {label:'Flowers', type:'flowers'},
    {label:'Zigzag',  type:'zigzag'},
  ]},
  sticker:{title:'STICKERS',items:[
    {label:'None',type:'none',emoji:'—'},
    // hearts
    {label:'💗',emoji:'💗',type:'heart1'},{label:'💕',emoji:'💕',type:'heart2'},{label:'🩷',emoji:'🩷',type:'heart3'},{label:'❤️',emoji:'❤️',type:'heart4'},
    // stars
    {label:'⭐',emoji:'⭐',type:'star1'},{label:'✨',emoji:'✨',type:'star2'},{label:'🌟',emoji:'🌟',type:'star3'},{label:'💫',emoji:'💫',type:'star4'},
    // flowers
    {label:'🌸',emoji:'🌸',type:'fl1'},{label:'🌺',emoji:'🌺',type:'fl2'},{label:'🌼',emoji:'🌼',type:'fl3'},{label:'🌷',emoji:'🌷',type:'fl4'},
    // food
    {label:'🍰',emoji:'🍰',type:'fd1'},{label:'🍭',emoji:'🍭',type:'fd2'},{label:'🧁',emoji:'🧁',type:'fd3'},{label:'🍬',emoji:'🍬',type:'fd4'},
    // school
    {label:'📚',emoji:'📚',type:'sc1'},{label:'🎓',emoji:'🎓',type:'sc2'},{label:'✏️',emoji:'✏️',type:'sc3'},{label:'🔬',emoji:'🔬',type:'sc4'},
    // fun
    {label:'🌈',emoji:'🌈',type:'fn1'},{label:'🎉',emoji:'🎉',type:'fn2'},{label:'🏆',emoji:'🏆',type:'fn3'},{label:'🎨',emoji:'🎨',type:'fn4'},
    // sparkle shapes
    {label:'✦',emoji:'✦',type:'sp1'},{label:'✧',emoji:'✧',type:'sp2'},{label:'◆',emoji:'◆',type:'sp3'},{label:'●',emoji:'●',type:'sp4'},
    // nature
    {label:'🦋',emoji:'🦋',type:'nt1'},{label:'🌙',emoji:'🌙',type:'nt2'},{label:'☁️',emoji:'☁️',type:'nt3'},{label:'❄️',emoji:'❄️',type:'nt4'},
  ]},
  outfit:{title:'PROFESSION',items:[
    {label:'Casual',type:'tshirt',color:'#FF5E5B'},
    {label:'Doctor',type:'doctor',color:'#E8F4FD'},
    {label:'Engineer',type:'engineer',color:'#FFD166'},
    {label:'Teacher',type:'teacher',color:'#06D6A0'},
    {label:'Chef',type:'chef',color:'#FFFFFF'},
    {label:'Astronaut',type:'astronaut',color:'#C0C0C0'},
    {label:'Business',type:'businessman',color:'#2C3E50'},
    {label:'Police',type:'police',color:'#1A3A5C'},
  ]}
};
const S={bg:0,skin:0,face:0,eyes:0,mouth:0,hair:0,outfit:0,pattern:0,cat:'bg'};
let placedStickers=[];
let holderColor='#87CEEB';
let showHolder=true;
let selectedStickerEmojis=new Set(); // checked stickers in panel
let dragSt=null; // currently dragged sticker {idx,offX,offY}

function setCat(cat,el){
  S.cat=cat;
  document.querySelectorAll('#catBtns .cat-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('assetTitle').textContent=CATS[cat].title;
  if(cat==='sticker'){renderStickerUI('assetGrid');}
  else if(cat==='pattern'){renderPatternUI('assetGrid');}
  else{renderGrid('assetGrid',cat);}
}
function setMobCat(cat,el){
  S.cat=cat;
  document.querySelectorAll('#mobCats .mob-cat-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('mobPopTitle').textContent=CATS[cat].title;
  if(cat==='sticker'){renderStickerUI('mobAssetGrid');}
  else if(cat==='pattern'){renderPatternUI('mobAssetGrid');}
  else{renderGrid('mobAssetGrid',cat);}
  document.getElementById('mobPopup').classList.add('open');
}
function closePop(e){if(e.target===document.getElementById('mobPopup'))document.getElementById('mobPopup').classList.remove('open');}
function syncI(f,v){document.getElementById(f==='prof'?'profInput':'nameInput').value=v;drawPin();}
function handleApprove(){
  showCelebration();
}

function showCelebration(){
  // Remove existing if any
  const old=document.getElementById('celebOverlay');
  if(old)old.remove();

  const overlay=document.createElement('div');
  overlay.id='celebOverlay';
  overlay.style.cssText=`
    position:fixed;inset:0;z-index:9999;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    background:rgba(11,46,78,0.72);backdrop-filter:blur(6px);
    animation:celebFadeIn 0.4s ease both;
  `;

  // Main card
  const card=document.createElement('div');
  card.style.cssText=`
    background:white;border-radius:32px;padding:40px 48px;text-align:center;
    max-width:480px;width:90%;
    box-shadow:0 32px 80px rgba(0,0,0,0.35);
    animation:celebPop 0.5s cubic-bezier(0.22,1,0.36,1) 0.1s both;
    position:relative;overflow:hidden;
  `;

  card.innerHTML=`
    <div style="font-size:64px;margin-bottom:8px;animation:spinIn 0.6s 0.3s both">🏆</div>
    <div style="font-family:'Fredoka One',cursive;font-size:13px;letter-spacing:3px;color:#FF6FAE;text-transform:uppercase;margin-bottom:8px;">Achievement Unlocked</div>
    <h1 style="font-family:'Fredoka One',cursive;font-size:clamp(28px,5vw,40px);color:#0B2E4E;line-height:1.1;margin-bottom:12px;">
      You just made<br>your future <span style="color:#FF6FAE">official!</span> ✨
    </h1>
    <p style="font-family:'Nunito',sans-serif;font-weight:800;font-size:15px;color:#888;margin-bottom:28px;line-height:1.5;">
      Your pin is being sent to print.<br>Go collect it and wear it with pride! 📌
    </p>
    <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
      <button onclick="document.getElementById('celebOverlay').remove()" style="padding:13px 28px;background:#FFFF00;color:#0B2E4E;border:none;border-radius:50px;font-family:'Fredoka One',cursive;font-size:17px;cursor:pointer;box-shadow:0 5px 0 #B8B800;">
        🎨 Make Another
      </button>
      <button onclick="document.getElementById('celebOverlay').remove();goToLanding();" style="padding:13px 28px;background:#0B2E4E;color:white;border:none;border-radius:50px;font-family:'Fredoka One',cursive;font-size:17px;cursor:pointer;box-shadow:0 5px 0 #071929;">
        🏠 Done!
      </button>
    </div>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  // Inject celebration CSS if not present
  if(!document.getElementById('celebCSS')){
    const s=document.createElement('style');
    s.id='celebCSS';
    s.textContent=`
      @keyframes celebFadeIn{from{opacity:0}to{opacity:1}}
      @keyframes celebPop{from{opacity:0;transform:scale(0.6) translateY(40px)}to{opacity:1;transform:scale(1) translateY(0)}}
      @keyframes spinIn{from{opacity:0;transform:rotate(-180deg) scale(0)}to{opacity:1;transform:rotate(0) scale(1)}}
      @keyframes confettiFly{
        0%{transform:translate(0,0) rotate(0deg);opacity:1;}
        100%{transform:translate(var(--tx),var(--ty)) rotate(var(--tr));opacity:0;}
      }
    `;
    document.head.appendChild(s);
  }

  // Confetti burst
  const colors=['#FF6FAE','#FFFF00','#4DC8F0','#A29BFE','#55EFC4','#FD79A8','#FDCB6E','#FF5E5B'];
  const shapes=['■','●','▲','★','♦'];
  for(let i=0;i<80;i++){
    const p=document.createElement('div');
    const tx=(Math.random()-0.5)*window.innerWidth*1.4;
    const ty=-(Math.random()*window.innerHeight*1.2+200);
    const tr=(Math.random()-0.5)*720;
    p.style.cssText=`
      position:fixed;
      left:${Math.random()*100}vw;
      top:60%;
      font-size:${8+Math.random()*14}px;
      color:${colors[Math.floor(Math.random()*colors.length)]};
      --tx:${tx}px;--ty:${ty}px;--tr:${tr}deg;
      animation:confettiFly ${0.7+Math.random()*1.2}s ${Math.random()*0.4}s ease-out both;
      pointer-events:none;z-index:10000;
      font-family:serif;
    `;
    p.textContent=shapes[Math.floor(Math.random()*shapes.length)];
    document.body.appendChild(p);
    setTimeout(()=>p.remove(), 2500);
  }
}

// ══════════════════════════════════════════════
// NEW FREE-DRAG STICKER SYSTEM
// ══════════════════════════════════════════════

function renderStickerUI(gridId){
  const grid=document.getElementById(gridId);
  if(!grid)return;
  const titleEl=document.getElementById(gridId==='assetGrid'?'assetTitle':'mobPopTitle');
  if(titleEl)titleEl.textContent='STICKERS';
  grid.innerHTML='';

  // Grid of stickers to check/uncheck
  CATS.sticker.items.filter(it=>it.type!=='none').forEach(item=>{
    const card=document.createElement('div');
    const sel=selectedStickerEmojis.has(item.emoji);
    const atMax = selectedStickerEmojis.size>=8;
    const disabled = !sel && atMax;
    card.className='asset-card'+(sel?' active':'')+(disabled?' disabled':'');
    if(disabled) card.style.opacity='0.35';
    card.style.fontSize='24px';
    card.style.display='flex';card.style.alignItems='center';card.style.justifyContent='center';
    card.textContent=item.emoji;
    card.title=item.label;
    card.onclick=()=>{
      if(selectedStickerEmojis.has(item.emoji)){
        selectedStickerEmojis.delete(item.emoji);
      } else if(selectedStickerEmojis.size < 8){
        selectedStickerEmojis.add(item.emoji);
      }
      renderStickerUI(gridId);
      const other=gridId==='assetGrid'?'mobAssetGrid':'assetGrid';
      renderStickerUI(other);
    };
    grid.appendChild(card);
  });

  // Place button
  if(selectedStickerEmojis.size>0){
    const wrap=document.createElement('div');
    wrap.style.cssText='grid-column:1/-1;margin-top:8px;';
    const btn=document.createElement('button');
    const cnt=Math.min(selectedStickerEmojis.size,8);
    btn.textContent='✨ Place '+cnt+' Sticker'+(cnt!==1?'s':'')+' (max 8)';
    btn.style.cssText="width:100%;padding:10px;background:var(--yellow);color:var(--navy);border:none;border-radius:12px;font-family:'Fredoka One',cursive;font-size:14px;cursor:pointer;box-shadow:0 4px 0 #B8B800;";
    btn.onclick=()=>openStickerPlacer();
    wrap.appendChild(btn);
    grid.appendChild(wrap);
  }
}

// ── Sticker Placer Overlay ──
function openStickerPlacer(){
  if(selectedStickerEmojis.size===0)return;
  const overlay=document.getElementById('stickerPlacer');
  if(!overlay)return;
  overlay.style.display='flex';
  setTimeout(initStickerDrag,50);
  // Randomly place selected stickers
  const toPlace=[...selectedStickerEmojis].slice(0,8);
  const newStickers=toPlace.map(emoji=>({
    emoji,
    x: CX + (Math.random()-0.5)*(R*1.2),
    y: CY + (Math.random()-0.5)*(R*1.2),
    size: 20+Math.floor(Math.random()*14),
    rot: (Math.random()-0.5)*0.8,
    id: Date.now()+Math.random()
  }));
  newStickers.forEach(s=>{ if(placedStickers.length<8) placedStickers.push(s); });
  selectedStickerEmojis.clear();
  renderStickerUI('assetGrid');
  renderStickerUI('mobAssetGrid');
  renderStickerPlacer();
}

function renderStickerPlacer(){
  const oc=document.getElementById('stickerPlacerCanvas');
  if(!oc)return;
  const oCtx=oc.getContext('2d');
  oCtx.clearRect(0,0,320,320);

  // Draw pin at 60% opacity as guide
  const pinC=document.getElementById('pinCanvas');
  if(pinC){
    oCtx.save();
    oCtx.globalAlpha=0.6;
    oCtx.drawImage(pinC,0,0);
    oCtx.restore();
  }

  // Draw stickers at full opacity + handles
  placedStickers.forEach((st,i)=>{
    oCtx.save();
    oCtx.font=st.size+'px serif';
    oCtx.textAlign='center';oCtx.textBaseline='middle';
    oCtx.translate(st.x,st.y);
    oCtx.rotate(st.rot);
    oCtx.fillText(st.emoji,0,0);
    // Handle ring
    oCtx.strokeStyle='rgba(255,255,0,0.7)';
    oCtx.lineWidth=1.5;
    oCtx.setLineDash([3,2]);
    oCtx.beginPath();oCtx.arc(0,0,st.size*0.7,0,Math.PI*2);oCtx.stroke();
    oCtx.setLineDash([]);
    // Delete X
    oCtx.fillStyle='rgba(255,94,91,0.9)';
    oCtx.font='bold 10px sans-serif';
    oCtx.textAlign='right';oCtx.textBaseline='top';
    oCtx.fillText('✕',st.size*0.7,-(st.size*0.7));
    oCtx.restore();
  });
}

// Drag in placer overlay
function initStickerDrag(){
  const oc=document.getElementById('stickerPlacerCanvas');
  if(!oc)return;
  // Always re-init (remove old listeners by cloning)
  const fresh=oc.cloneNode(true);
  oc.parentNode.replaceChild(fresh,oc);
  const canvas=document.getElementById('stickerPlacerCanvas');

  function getPos(e){
    const r=canvas.getBoundingClientRect();
    const scx=canvas.width/r.width; // e.g. 320/300 = 1.067
    const scy=canvas.height/r.height;
    const src=e.touches?e.touches[0]:e;
    return{x:(src.clientX-r.left)*scx, y:(src.clientY-r.top)*scy};
  }
  function startDrag(e){
    const{x,y}=getPos(e);
    dragSt=null;
    for(let i=placedStickers.length-1;i>=0;i--){
      const st=placedStickers[i];
      const dx=x-st.x,dy=y-st.y;
      const hit=st.size;
      if(dx*dx+dy*dy<hit*hit){
        // Delete zone: small circle top-right of sticker
        const delX=st.x+st.size*0.65,delY=st.y-st.size*0.65;
        if((x-delX)**2+(y-delY)**2<144){
          placedStickers.splice(i,1);
          renderStickerPlacer();drawPin();return;
        }
        dragSt={idx:i,offX:dx,offY:dy};
        break;
      }
    }
    e.preventDefault();
  }
  function moveDrag(e){
    if(!dragSt)return;
    const{x,y}=getPos(e);
    placedStickers[dragSt.idx].x=x-dragSt.offX;
    placedStickers[dragSt.idx].y=y-dragSt.offY;
    renderStickerPlacer();
    // debounced drawPin for perf
    clearTimeout(canvas._drawTimer);
    canvas._drawTimer=setTimeout(drawPin,50);
    e.preventDefault();
  }
  function endDrag(e){
    if(dragSt){drawPin();renderStickerPlacer();}
    dragSt=null;
  }
  canvas.addEventListener('mousedown',startDrag);
  canvas.addEventListener('mousemove',moveDrag);
  canvas.addEventListener('mouseup',endDrag);
  canvas.addEventListener('mouseleave',endDrag);
  canvas.addEventListener('touchstart',startDrag,{passive:false});
  canvas.addEventListener('touchmove',moveDrag,{passive:false});
  canvas.addEventListener('touchend',endDrag,{passive:false});
}

function closeStickerPlacer(){
  document.getElementById('stickerPlacer').style.display='none';
  // Sync selected set from placed stickers so panel shows correct checked state
  selectedStickerEmojis.clear();
  placedStickers.forEach(s=>selectedStickerEmojis.add(s.emoji));
  renderStickerUI('assetGrid');
  renderStickerUI('mobAssetGrid');
  drawPin();
}

// ══ STICKER BACKGROUND PATTERN — scattered at 30% opacity ══
// (handled in drawPattern — sticker type scatters emoji at random positions/rotations)


// ══════════════════════════════════════════════
// CORE ENGINE — Canvas constants + drawing fns
// ══════════════════════════════════════════════
const R=160,CX=160,CY=160;

// ── Mini preview helpers ──
function drawMini(canvas,cat,item){
  const ctx=canvas.getContext('2d'),cx=28,cy=28;
  const bg=CATS.bg.items[S.bg];
  const g=ctx.createLinearGradient(0,0,56,56);
  if(bg.grad4){const[tl,tr,bl,br]=bg.grad4;g.addColorStop(0,tl);g.addColorStop(0.5,tr);g.addColorStop(1,br);}
  else{g.addColorStop(0,bg.grad[0]);g.addColorStop(1,bg.grad[1]);}
  ctx.save();ctx.beginPath();ctx.arc(28,28,27,0,Math.PI*2);ctx.clip();
  ctx.fillStyle=g;ctx.fillRect(0,0,56,56);
  const sk=CATS.skin.items[S.skin].color;
  if(cat==='skin'){ctx.fillStyle=item.color;ctx.beginPath();ctx.arc(cx,cy,18,0,Math.PI*2);ctx.fill();}
  else if(cat==='face'){ctx.fillStyle=sk;mF(ctx,cx,cy,item.shape);}
  else if(cat==='eyes'){ctx.fillStyle=sk;ctx.beginPath();ctx.arc(cx,cy+2,16,0,Math.PI*2);ctx.fill();mE(ctx,cx,cy-1,item.type);}
  else if(cat==='mouth'){ctx.fillStyle=sk;ctx.beginPath();ctx.arc(cx,cy+2,16,0,Math.PI*2);ctx.fill();mE(ctx,cx,cy-3,'normal');mM(ctx,cx,cy+7,item.type);}
  else if(cat==='hair'){ctx.fillStyle=sk;ctx.beginPath();ctx.arc(cx,cy+2,16,0,Math.PI*2);ctx.fill();mH(ctx,cx,cy+2,item.type);}
  else if(cat==='pattern'){drawPatternMini(ctx,cx,cy,item.type);}
  else if(cat==='sticker'){const em={none:'⬜'};ctx.font='22px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(item.emoji||'🌸',cx,cy);}
  else if(cat==='outfit'){ctx.fillStyle=sk;ctx.beginPath();ctx.arc(cx,cy-4,13,0,Math.PI*2);ctx.fill();ctx.fillStyle=item.color||'#FF5E5B';ctx.beginPath();ctx.roundRect(cx-13,cy+11,26,18,[3]);ctx.fill();}
  ctx.restore();
}
function mF(ctx,cx,cy,s){ctx.beginPath();if(s==='round')ctx.arc(cx,cy,16,0,Math.PI*2);else if(s==='oval')ctx.ellipse(cx,cy,12,18,0,0,Math.PI*2);else if(s==='square')ctx.roundRect(cx-14,cy-14,28,28,4);else if(s==='heart'){ctx.arc(cx-7,cy-4,9,Math.PI,0);ctx.arc(cx+7,cy-4,9,Math.PI,0);ctx.lineTo(cx,cy+14);ctx.closePath();}else{ctx.moveTo(cx,cy-18);ctx.lineTo(cx+14,cy);ctx.lineTo(cx,cy+18);ctx.lineTo(cx-14,cy);ctx.closePath();}ctx.fill();}
function mE(ctx,cx,cy,t){if(t==='sleepy'){ctx.strokeStyle='#0D1B2A';ctx.lineWidth=1.5;[cx-6,cx+6].forEach(x=>{ctx.beginPath();ctx.arc(x,cy+1,4,Math.PI,0);ctx.stroke();});return;}if(t==='star'){ctx.fillStyle='#FFD166';mStar(ctx,cx-6,cy,3,6,5);mStar(ctx,cx+6,cy,3,6,5);return;}if(t==='heart'){ctx.fillStyle='#FF5E5B';ctx.font='10px serif';ctx.textAlign='center';ctx.fillText('♥',cx-6,cy+4);ctx.fillText('♥',cx+6,cy+4);return;}const r=t==='wide'?6:4;[cx-6,cx+6].forEach(x=>{ctx.fillStyle='white';ctx.beginPath();ctx.arc(x,cy,r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#0D1B2A';ctx.beginPath();ctx.arc(x+1,cy+1,r-2,0,Math.PI*2);ctx.fill();});}
function mM(ctx,cx,cy,t){ctx.strokeStyle='#0D1B2A';ctx.lineWidth=1.5;ctx.lineCap='round';if(t==='smile'){ctx.beginPath();ctx.arc(cx,cy,7,0.2,Math.PI-0.2);ctx.stroke();}else if(t==='grin'){ctx.fillStyle='#FF8FA3';ctx.beginPath();ctx.arc(cx,cy,8,0.1,Math.PI-0.1);ctx.closePath();ctx.fill();ctx.stroke();}else if(t==='smirk'){ctx.beginPath();ctx.moveTo(cx-5,cy+1);ctx.quadraticCurveTo(cx+3,cy-1,cx+7,cy-2);ctx.stroke();}else if(t==='open'){ctx.fillStyle='#8B0000';ctx.beginPath();ctx.ellipse(cx,cy,6,4,0,0,Math.PI*2);ctx.fill();}else{ctx.beginPath();ctx.arc(cx,cy,7,0.2,Math.PI-0.2);ctx.stroke();}}
function mH(ctx,cx,cy,t){if(t==='none')return;ctx.fillStyle='#3D2B1F';if(t==='short'){ctx.beginPath();ctx.arc(cx,cy-2,16,Math.PI,0);ctx.fill();}else if(t==='long'){ctx.beginPath();ctx.arc(cx,cy-2,16,Math.PI,0);ctx.fill();ctx.fillRect(cx-15,cy-2,6,22);ctx.fillRect(cx+9,cy-2,6,22);}else if(t==='curly'){ctx.beginPath();ctx.arc(cx,cy-2,16,Math.PI,0);ctx.fill();[-10,-2,6].forEach(dx=>{ctx.beginPath();ctx.arc(cx+dx,cy-16,6,0,Math.PI*2);ctx.fill();});}else if(t==='bun'){ctx.beginPath();ctx.arc(cx,cy-2,16,Math.PI,0);ctx.fill();ctx.beginPath();ctx.arc(cx,cy-20,8,0,Math.PI*2);ctx.fill();}else{ctx.beginPath();ctx.arc(cx,cy-2,16,Math.PI,0);ctx.fill();for(let i=0;i<4;i++){const a=Math.PI+(i/3)*Math.PI;ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*16,cy-2+Math.sin(a)*16);ctx.lineTo(cx+Math.cos(a-0.25)*10,cy-2+Math.sin(a-0.25)*10);ctx.lineTo(cx+Math.cos(a+0.25)*10,cy-2+Math.sin(a+0.25)*10);ctx.closePath();ctx.fill();}}}
function mStar(ctx,cx,cy,ir,or,n){let r=(Math.PI/2)*3,s=Math.PI/n;ctx.beginPath();ctx.moveTo(cx,cy-or);for(let i=0;i<n;i++){ctx.lineTo(cx+Math.cos(r)*or,cy+Math.sin(r)*or);r+=s;ctx.lineTo(cx+Math.cos(r)*ir,cy+Math.sin(r)*ir);r+=s;}ctx.closePath();ctx.fill();}

// ── Pattern system ──
function renderPatternUI(gridId){
  const grid=document.getElementById(gridId);if(!grid)return;
  const t=document.getElementById(gridId==='assetGrid'?'assetTitle':'mobPopTitle');
  if(t)t.textContent='PATTERN';
  grid.innerHTML='';
  CATS.pattern.items.forEach((item,i)=>{
    const card=document.createElement('div');
    card.className='asset-card'+(S.pattern===i?' active':'');
    card.onclick=()=>{S.pattern=i;renderPatternUI(gridId);const o=gridId==='assetGrid'?'mobAssetGrid':'assetGrid';renderPatternUI(o);drawPin();};
    const c2=document.createElement('canvas');c2.width=56;c2.height=56;
    const ctx2=c2.getContext('2d');
    ctx2.save();ctx2.beginPath();ctx2.arc(28,28,27,0,Math.PI*2);ctx2.clip();
    ctx2.fillStyle='#E8F4FD';ctx2.fillRect(0,0,56,56);
    drawPatternMini(ctx2,28,28,item.type);ctx2.restore();
    card.appendChild(c2);
    const lbl=document.createElement('div');lbl.className='asset-lbl';lbl.textContent=item.label;
    card.appendChild(lbl);grid.appendChild(card);
  });
}
function drawPatternMini(ctx,cx,cy,type){
  if(type==='none'){ctx.fillStyle='rgba(0,0,0,0.08)';ctx.font='18px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('✕',cx,cy);return;}
  ctx.save();const scale=56/320;ctx.translate(cx-28,cy-28);ctx.scale(scale,scale);
  drawPattern(ctx,type,true);ctx.restore();
}
function drawPattern(ctx,type,mini=false){
  const size=320,alpha=mini?1:0.22;
  ctx.save();ctx.globalAlpha=alpha;
  if(type==='dots'){ctx.fillStyle='rgba(255,255,255,0.9)';const sp=22;for(let x=sp/2;x<size;x+=sp)for(let y=sp/2;y<size;y+=sp){ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);ctx.fill();}}
  else if(type==='confetti'){const cols=['#FF6FAE','#FFFF00','#4DC8F0','#A29BFE','#FF5E5B','#55EFC4'];const seed=[{x:20,y:25,r:4,c:0},{x:55,y:10,r:3,c:1},{x:90,y:40,r:4,c:2},{x:130,y:18,r:3,c:3},{x:160,y:50,r:4,c:4},{x:200,y:15,r:3,c:5},{x:240,y:38,r:4,c:0},{x:275,y:12,r:3,c:1},{x:305,y:45,r:4,c:2},{x:30,y:80,r:3,c:3},{x:70,y:95,r:4,c:4},{x:110,y:70,r:3,c:5},{x:150,y:100,r:4,c:0},{x:190,y:75,r:3,c:1},{x:230,y:90,r:4,c:2},{x:270,y:65,r:3,c:3},{x:10,y:150,r:4,c:4},{x:50,y:130,r:3,c:5},{x:95,y:160,r:4,c:0},{x:140,y:135,r:3,c:1},{x:180,y:155,r:4,c:2},{x:220,y:125,r:3,c:3},{x:260,y:150,r:4,c:4},{x:300,y:130,r:3,c:5}];seed.forEach(({x,y,r,c})=>{ctx.fillStyle=cols[c];ctx.fillRect(x-r,y-r,r*2,r*1.2);});}
  else if(type==='stars'){ctx.fillStyle='rgba(255,220,50,0.85)';const pts=[[30,30],[80,15],[140,35],[200,12],[265,30],[15,90],[60,80],[120,100],[180,82],[240,95],[35,160],[90,145],[155,165],[210,148],[45,225],[100,210],[160,228],[218,212],[30,280],[85,268],[150,285],[215,272]];pts.forEach(([x,y])=>{ctx.beginPath();for(let i=0;i<5;i++){const a=i*Math.PI*2/5-Math.PI/2;const b=a+Math.PI/5;ctx.lineTo(x+Math.cos(a)*7,y+Math.sin(a)*7);ctx.lineTo(x+Math.cos(b)*3,y+Math.sin(b)*3);}ctx.closePath();ctx.fill();});}
  else if(type==='hearts'){ctx.fillStyle='rgba(255,111,174,0.7)';ctx.font='18px serif';ctx.textAlign='center';ctx.textBaseline='middle';const pts=[[30,30],[90,15],[155,35],[220,12],[285,28],[15,85],[70,100],[135,80],[200,95],[265,82],[30,155],[85,140],[150,162],[215,145],[278,158],[20,215],[75,228],[140,210],[205,225],[270,212],[30,275],[88,260],[153,278],[218,262]];pts.forEach(([x,y])=>ctx.fillText('♥',x,y));}
  else if(type==='stripes'){ctx.fillStyle='rgba(255,255,255,0.45)';for(let i=0;i<320;i+=28){ctx.fillRect(i,0,14,320);}}
  else if(type==='checks'){const sz=28;for(let x=0;x<320;x+=sz)for(let y=0;y<320;y+=sz){if(Math.floor(x/sz+y/sz)%2===0){ctx.fillStyle='rgba(255,255,255,0.3)';ctx.fillRect(x,y,sz,sz);}}}
  else if(type==='bubbles'){ctx.strokeStyle='rgba(255,255,255,0.55)';ctx.lineWidth=2;ctx.fillStyle='rgba(255,255,255,0.1)';const bs=[[25,25,18],[80,12,12],[145,30,20],[210,8,14],[280,22,16],[15,88,14],[65,75,18],[130,95,12],[195,78,16],[258,90,18],[30,158,16],[88,142,20],[155,165,14],[218,148,18],[20,222,18],[75,208,14],[140,228,16],[202,215,20],[30,280,14],[85,268,18],[150,285,12],[215,272,16]];bs.forEach(([x,y,r])=>{ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.stroke();});}
  else if(type==='flowers'){ctx.font='20px serif';ctx.textAlign='center';ctx.textBaseline='middle';const pts=[[30,30],[95,12],[165,32],[238,14],[12,88],[72,102],[142,82],[208,98],[20,162],[78,145],[148,168],[215,150],[30,228],[88,212],[155,232],[18,290],[76,275],[145,292]];const fl=['🌸','🌺','🌼','🌷','🌸'];pts.forEach(([x,y],i)=>ctx.fillText(fl[i%fl.length],x,y));}
  else if(type==='zigzag'){ctx.strokeStyle='rgba(255,255,255,0.45)';ctx.lineWidth=2.5;ctx.lineJoin='round';for(let y=16;y<320;y+=28){ctx.beginPath();for(let x=0;x<=320;x+=20){ctx.lineTo(x,y+(x%40===0?8:-8));}ctx.stroke();}}
  else if(type.startsWith('scatter_')){
    const scatterMap={scatter_hearts:['💗','💕','❤️','🩷'],scatter_stars:['⭐','✨','🌟','💫'],scatter_flowers:['🌸','🌺','🌼','🌷'],scatter_gems:['✦','✧','◆','●'],scatter_food:['🍰','🍭','🧁','🍬']};
    const emojis=scatterMap[type]||['⭐'];
    ctx.font='20px serif';ctx.textAlign='center';ctx.textBaseline='middle';
    const seed=type.charCodeAt(type.length-1)*7;
    for(let i=0;i<28;i++){const px=((seed*17+i*137)%280)+20;const py=((seed*31+i*89)%280)+20;const rot=((seed*13+i*53)%100)/100*Math.PI*2;ctx.save();ctx.translate(px,py);ctx.rotate(rot);ctx.fillText(emojis[i%emojis.length],0,0);ctx.restore();}
  }
  ctx.restore();
}

// ── renderGrid ──
function renderGrid(id,cat){
  const grid=document.getElementById(id);if(!grid)return;
  grid.innerHTML='';
  CATS[cat].items.forEach((item,i)=>{
    const card=document.createElement('div');
    card.className='asset-card'+(S[cat]===i?' active':'');
    card.onclick=()=>{S[cat]=i;renderGrid('assetGrid',cat);renderGrid('mobAssetGrid',cat);drawPin();};
    if(cat==='bg'){
      const sw=document.createElement('div');sw.className='bg-swatch';
      if(item.grad4){const[tl,tr,bl,br]=item.grad4;sw.style.background=`conic-gradient(from 45deg,${tl},${tr},${br},${bl},${tl})`;}
      else{sw.style.background=`linear-gradient(135deg,${item.grad[0]},${item.grad[1]})`;}
      card.appendChild(sw);
    } else {
      const c=document.createElement('canvas');c.width=56;c.height=56;
      card.appendChild(c);drawMini(c,cat,item);
    }
    const lbl=document.createElement('div');lbl.className='asset-lbl';lbl.textContent=item.label;
    card.appendChild(lbl);grid.appendChild(card);
  });
}

// ── Main drawPin ──
function drawPin(forPrint){
  const canvas=document.getElementById('pinCanvas');if(!canvas)return;
  const ctx=canvas.getContext('2d');
  ctx.clearRect(0,0,320,320);

  // ── LAYER 1: bg + pattern + avatar (clipped to circle) ──
  ctx.save();
  ctx.beginPath();ctx.arc(CX,CY,R,0,Math.PI*2);ctx.clip();
  const bi=CATS.bg.items[S.bg];
  const g=ctx.createLinearGradient(0,0,320,320);
  if(bi.grad4){const[tl,tr,bl,br]=bi.grad4;g.addColorStop(0,tl);g.addColorStop(0.33,tr);g.addColorStop(0.66,br);g.addColorStop(1,bl);}
  else{g.addColorStop(0,bi.grad[0]);g.addColorStop(1,bi.grad[1]);}
  ctx.fillStyle=g;ctx.fillRect(0,0,320,320);
  ctx.fillStyle='rgba(0,0,0,0.03)';
  for(let x=10;x<320;x+=20)for(let y=10;y<320;y+=20){ctx.beginPath();ctx.arc(x,y,1.5,0,Math.PI*2);ctx.fill();}
  if(S.pattern>0&&CATS.pattern){drawPattern(ctx,CATS.pattern.items[S.pattern].type);}
  const sk=CATS.skin.items[S.skin].color;
  const fs2=CATS.face.items[S.face].shape;
  ctx.fillStyle=sk;ctx.beginPath();
  if(fs2==='round')ctx.arc(CX,CY+10,74,0,Math.PI*2);
  else if(fs2==='oval')ctx.ellipse(CX,CY+10,58,82,0,0,Math.PI*2);
  else if(fs2==='square')ctx.roundRect(CX-64,CY-54,128,128,16);
  else if(fs2==='heart'){ctx.arc(CX-30,CY-20,40,Math.PI,0);ctx.arc(CX+30,CY-20,40,Math.PI,0);ctx.lineTo(CX,CY+82);ctx.closePath();}
  else{ctx.moveTo(CX,CY-84);ctx.lineTo(CX+64,CY+10);ctx.lineTo(CX,CY+92);ctx.lineTo(CX-64,CY+10);ctx.closePath();}
  ctx.fill();
  ctx.fillStyle='rgba(255,150,150,0.28)';
  ctx.beginPath();ctx.ellipse(CX-46,CY+24,17,10,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(CX+46,CY+24,17,10,0,0,Math.PI*2);ctx.fill();
  const oi=CATS.outfit.items[S.outfit];
  // Use PNG asset if available, else CSS fallback
  const hairItem=CATS.hair.items[S.hair];
  const eyeItem=CATS.eyes.items[S.eyes];
  const mouthItem=CATS.mouth.items[S.mouth];
  if(!hairItem?.url || !drawImageLayer(ctx,hairItem.url,0,0,320,320)) dHair(ctx);
  if(!eyeItem?.url  || !drawImageLayer(ctx,eyeItem.url,0,0,320,320))  dEyes(ctx);
  if(!mouthItem?.url|| !drawImageLayer(ctx,mouthItem.url,0,0,320,320))dMouth(ctx);
  if(!oi?.url       || !drawImageLayer(ctx,oi.url,0,0,320,320))       dOutfit(ctx,oi.type,oi.color);
  ctx.restore();

  // ── LAYER 2: placed stickers (clipped, above avatar) ──
  if(placedStickers.length>0){
    ctx.save();
    ctx.beginPath();ctx.arc(CX,CY,R,0,Math.PI*2);ctx.clip();
    placedStickers.forEach(st=>{
      ctx.save();ctx.font=st.size+'px serif';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.translate(st.x,st.y);ctx.rotate(st.rot);ctx.fillText(st.emoji,0,0);ctx.restore();
    });
    ctx.restore();
  }

  // ── LAYER 3: 3D shine (clipped, above stickers, under text) ──
  if(!forPrint){
    ctx.save();
    ctx.beginPath();ctx.arc(CX,CY,R,0,Math.PI*2);ctx.clip();
    const sRing=ctx.createRadialGradient(CX,CY+20,R*0.6,CX,CY,R);
    sRing.addColorStop(0,'rgba(0,0,0,0)');sRing.addColorStop(0.82,'rgba(0,0,0,0)');sRing.addColorStop(1,'rgba(0,0,0,0.22)');
    ctx.fillStyle=sRing;ctx.fillRect(0,0,320,320);
    const gl=ctx.createLinearGradient(CX-R*0.5,CY-R*0.8,CX+R*0.1,CY-R*0.1);
    gl.addColorStop(0,'rgba(255,255,255,0.45)');gl.addColorStop(0.5,'rgba(255,255,255,0.14)');gl.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=gl;ctx.beginPath();ctx.ellipse(CX-R*0.22,CY-R*0.36,R*0.54,R*0.28,-0.6,0,Math.PI*2);ctx.fill();
    const sp=ctx.createRadialGradient(CX-R*0.38,CY-R*0.42,0,CX-R*0.38,CY-R*0.42,R*0.22);
    sp.addColorStop(0,'rgba(255,255,255,0.65)');sp.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=sp;ctx.beginPath();ctx.arc(CX-R*0.38,CY-R*0.42,R*0.22,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }

  // ── LAYER 4: arc texts (no clip, always on top) ──
  const profTxt=(document.getElementById('profInput')||{value:'Future Doctor'}).value||'Future Doctor';
  const nameTxt=(document.getElementById('nameInput')||{value:'Alex Rivera'}).value||'Alex Rivera';
  arcText(ctx,profTxt.toUpperCase(),true,S.profColor||'#RAINBOW');
  arcTextWithHolder(ctx,nameTxt.toUpperCase(),S.nameColor||'#RAINBOW',showHolder);

  // ── Outer drop shadow ──
  if(!forPrint){
    ctx.save();ctx.shadowColor='rgba(0,0,0,0.3)';ctx.shadowBlur=20;ctx.shadowOffsetY=7;
    ctx.beginPath();ctx.arc(CX,CY,R,0,Math.PI*2);
    ctx.strokeStyle='rgba(255,255,255,0.5)';ctx.lineWidth=2;ctx.stroke();ctx.restore();
  }
}
function dEyes(ctx){const t=CATS.eyes.items[S.eyes].type;[{x:CX-26,y:CY-9},{x:CX+26,y:CY-9}].forEach(({x,y})=>{if(t==='normal'||t==='wide'){const r=t==='wide'?14:10;ctx.fillStyle='white';ctx.beginPath();ctx.ellipse(x,y,r,r*1.1,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#0D1B2A';ctx.beginPath();ctx.arc(x+2,y+2,r*0.55,0,Math.PI*2);ctx.fill();ctx.fillStyle='white';ctx.beginPath();ctx.arc(x+4,y,r*0.2,0,Math.PI*2);ctx.fill();}else if(t==='sleepy'){ctx.strokeStyle='#0D1B2A';ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();ctx.arc(x,y+4,10,Math.PI,0);ctx.stroke();}else if(t==='star'){ctx.fillStyle='#FFD166';mStar(ctx,x,y,5,12,5);}else if(t==='heart'){ctx.fillStyle='#FF5E5B';ctx.font='20px serif';ctx.textAlign='center';ctx.fillText('♥',x,y+7);}});}
function dMouth(ctx){const t=CATS.mouth.items[S.mouth].type;ctx.strokeStyle='#0D1B2A';ctx.lineWidth=3;ctx.lineCap='round';ctx.fillStyle='#FF8FA3';if(t==='smile'){ctx.beginPath();ctx.arc(CX,CY+20,26,0.2,Math.PI-0.2);ctx.stroke();}else if(t==='grin'){ctx.beginPath();ctx.arc(CX,CY+16,30,0.1,Math.PI-0.1);ctx.closePath();ctx.fill();ctx.stroke();}else if(t==='smirk'){ctx.beginPath();ctx.moveTo(CX-11,CY+22);ctx.quadraticCurveTo(CX+7,CY+20,CX+22,CY+15);ctx.stroke();}else if(t==='open'){ctx.fillStyle='#8B0000';ctx.beginPath();ctx.ellipse(CX,CY+24,20,14,0,0,Math.PI*2);ctx.fill();ctx.stroke();}else{ctx.beginPath();ctx.arc(CX,CY+20,26,0.2,Math.PI-0.2);ctx.stroke();ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(CX+15,CY-13);ctx.lineTo(CX+37,CY-4);ctx.stroke();}}
function dHair(ctx){const t=CATS.hair.items[S.hair].type;if(t==='none')return;ctx.fillStyle='#3D2B1F';if(t==='short'){ctx.beginPath();ctx.arc(CX,CY-7,76,Math.PI,0);ctx.fill();}else if(t==='long'){ctx.beginPath();ctx.arc(CX,CY-7,76,Math.PI,0);ctx.fill();ctx.fillRect(CX-74,CY-7,20,105);ctx.fillRect(CX+54,CY-7,20,105);}else if(t==='curly'){ctx.beginPath();ctx.arc(CX,CY-7,76,Math.PI,0);ctx.fill();[-52,-26,0,26,52].forEach(dx=>{ctx.beginPath();ctx.arc(CX+dx,CY-78,17,0,Math.PI*2);ctx.fill();});}else if(t==='bun'){ctx.beginPath();ctx.arc(CX,CY-7,76,Math.PI,0);ctx.fill();ctx.beginPath();ctx.arc(CX,CY-90,26,0,Math.PI*2);ctx.fill();}else{ctx.beginPath();ctx.arc(CX,CY-7,76,Math.PI,0);ctx.fill();for(let i=0;i<5;i++){const a=Math.PI+(i/4)*Math.PI;ctx.beginPath();ctx.moveTo(CX+Math.cos(a)*76,CY-7+Math.sin(a)*76);ctx.lineTo(CX+Math.cos(a-0.2)*53,CY-7+Math.sin(a-0.2)*53);ctx.lineTo(CX+Math.cos(a+0.2)*53,CY-7+Math.sin(a+0.2)*53);ctx.closePath();ctx.fill();}}}
function dOutfit(ctx,t,color){ctx.fillStyle=color||'#FF5E5B';ctx.beginPath();ctx.roundRect(CX-60,CY+84,120,86,[0,0,10,10]);ctx.fill();if(color==='#FFFFFF'){ctx.strokeStyle='#DDD';ctx.lineWidth=1.5;ctx.stroke();}if(t==='doctor'){ctx.fillStyle='#E74C3C';ctx.font='bold 16px Nunito';ctx.textAlign='center';ctx.fillText('✚',CX,CY+116);}else if(t==='engineer'){ctx.fillStyle='rgba(0,0,0,0.15)';ctx.fillRect(CX-7,CY+84,14,86);}else if(t==='astronaut'){ctx.strokeStyle='rgba(255,255,255,0.5)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(CX,CY+108,28,0,Math.PI*2);ctx.stroke();}else if(t==='chef'){ctx.fillStyle='rgba(255,255,255,0.6)';ctx.beginPath();ctx.arc(CX,CY+76,20,Math.PI,0);ctx.fill();}}

const RAINBOW_TOP=['#FF6B9D','#FF9F43','#FECA57','#48DBFB','#A29BFE','#55EFC4','#FD79A8','#FDCB6E'];
const RAINBOW_BOT=['#A29BFE','#FD79A8','#FF6B9D','#FECA57','#55EFC4','#FF9F43','#48DBFB','#A29BFE'];
function arcText(ctx,text,top,color){
  if(!text.trim())return;
  const MAX=16*1.6*1.2,MIN=16*0.6,arcR=R-34,maxArc=top?Math.PI*0.80:Math.PI*0.76;
  const chars=text.split(''),n=chars.length;
  let fs=MAX;
  for(let s=MAX;s>=MIN;s-=0.5){if((s*0.62/arcR)*n<=maxArc){fs=s;break;}fs=MIN;}
  const fontFace=(document.getElementById('profFont')||document.getElementById('textFont')||{}).value||'Nunito';
  const palette=top?RAINBOW_TOP:RAINBOW_BOT;
  const useRainbow=color==='#RAINBOW';
  // Measure actual text width for tight kerning
  ctx.save();ctx.font='900 '+fs+'px '+fontFace;
  const charWidths=chars.map(ch=>ch===' '?fs*0.3:ctx.measureText(ch).width+2);
  ctx.restore();
  const totalWidth=charWidths.reduce((a,b)=>a+b,0);
  const totalArc=totalWidth/arcR;
  const clampedArc=Math.min(totalArc,maxArc);
  const scale=clampedArc/totalArc;
  const scaledWidths=charWidths.map(w=>w*scale);
  const startAngle=top?-(Math.PI/2)-(clampedArc/2):(Math.PI/2)+(clampedArc/2);
  const dir=top?1:-1;
  let cursor=0;
  chars.forEach((ch,i)=>{
    if(ch===' '){cursor+=scaledWidths[i];return;}
    const angle=startAngle+dir*(cursor+scaledWidths[i]/2)/arcR;
    cursor+=scaledWidths[i];
    ctx.save();
    ctx.translate(CX+arcR*Math.cos(angle),CY+arcR*Math.sin(angle));
    ctx.rotate(angle+(top?Math.PI/2:-Math.PI/2));
    ctx.font='900 '+fs+'px '+fontFace;
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.lineWidth=fs*0.22;ctx.strokeStyle='rgba(255,255,255,0.95)';ctx.lineJoin='round';
    ctx.strokeText(ch,0,0);
    ctx.shadowColor='rgba(0,0,0,0.15)';ctx.shadowBlur=2;ctx.shadowOffsetX=1;ctx.shadowOffsetY=1;
    ctx.fillStyle=useRainbow?palette[i%palette.length]:color;
    ctx.fillText(ch,0,0);
    ctx.shadowColor='transparent';
    ctx.restore();
  });
}
// ── FONT / COLOR HELPERS ──
S.profColor = '#RAINBOW';
S.nameColor = '#RAINBOW';

function toggleHolder(){
  showHolder=!showHolder;
  const t=document.getElementById('holderToggle');
  const k=document.getElementById('holderToggleKnob');
  const w=document.getElementById('holderColorsWrap');
  if(t) t.style.background=showHolder?'var(--pink)':'rgba(255,255,255,0.2)';
  if(k) k.style.left=showHolder?'18px':'2px';
  if(w) w.style.opacity=showHolder?'1':'0.3';
  drawPin();
}
function setHolderColor(val,el){
  holderColor=val;
  document.querySelectorAll('#holderColorsWrap .color-dot').forEach(d=>d.classList.remove('active'));
  el.classList.add('active');
  drawPin();
}
function setProfColor(hex, el){
  S.profColor = hex;
  document.querySelectorAll('#profColors .color-dot').forEach(d=>d.classList.remove('active'));
  el.classList.add('active');
  drawPin();
}
function setNameColor(hex, el){
  S.nameColor = hex;
  document.querySelectorAll('#nameColors .color-dot').forEach(d=>d.classList.remove('active'));
  el.classList.add('active');
  drawPin();
}

// ══ PATTERN SYSTEM ══
// ══ NAME HOLDER BANNER ══
function arcTextWithHolder(ctx, text, color, useHolder){
  if(!text.trim())return;
  const MAX=16*1.6*1.2,MIN=16*0.6,arcR=R-34,maxArc=Math.PI*0.76;
  const chars=text.split(''),n=chars.length;
  let fs=MAX;
  for(let s=MAX;s>=MIN;s-=0.5){if((s*0.62/arcR)*n<=maxArc){fs=s;break;}fs=MIN;}
  const fontFace=(document.getElementById('nameFont')||document.getElementById('textFont')||{}).value||'Nunito';
  ctx.save();ctx.font='900 '+fs+'px '+fontFace;
  const charWidths=chars.map(ch=>ch===' '?fs*0.3:ctx.measureText(ch).width+2);
  ctx.restore();
  const totalWidth=charWidths.reduce((a,b)=>a+b,0);
  const totalArc=Math.min(totalWidth/arcR,maxArc);
  const scale=totalArc/(totalWidth/arcR);
  const scaledWidths=charWidths.map(w=>w*scale);
  const startAngle=(Math.PI/2)+(totalArc/2);

  // ── Draw holder banner ──
  if(useHolder){
    const padH=fs*0.38;
    const padW=fs*0.55;
    const bannerArc=totalArc+padW*2/arcR;
    const bannerR1=arcR+padH*1.2;
    const bannerR2=arcR-padH*1.2;
    ctx.save();
    ctx.save();
    ctx.translate(2,3);
    ctx.beginPath();
    ctx.arc(CX,CY,bannerR1,Math.PI/2-bannerArc/2,Math.PI/2+bannerArc/2);
    ctx.arc(CX,CY,bannerR2,Math.PI/2+bannerArc/2,Math.PI/2-bannerArc/2,true);
    ctx.closePath();
    ctx.fillStyle='rgba(0,0,0,0.22)';
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(CX,CY,bannerR1,Math.PI/2-bannerArc/2,Math.PI/2+bannerArc/2);
    ctx.arc(CX,CY,bannerR2,Math.PI/2+bannerArc/2,Math.PI/2-bannerArc/2,true);
    ctx.closePath();
    ctx.fillStyle=holderColor;
    ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.95)';
    ctx.lineWidth=1.5;
    ctx.stroke();
    ctx.restore();
  }

  // ── Draw arc text on top ──
  const palette=RAINBOW_BOT;
  const useRainbow=color==='#RAINBOW';
  let cursor=0;
  chars.forEach((ch,i)=>{
    if(ch===' '){cursor+=scaledWidths[i];return;}
    const angle=startAngle-(cursor+scaledWidths[i]/2)/arcR;
    cursor+=scaledWidths[i];
    ctx.save();
    ctx.translate(CX+arcR*Math.cos(angle),CY+arcR*Math.sin(angle));
    ctx.rotate(angle-Math.PI/2);
    ctx.font='900 '+fs+'px '+fontFace;
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle=useRainbow?palette[i%palette.length]:color;
    ctx.fillText(ch,0,0);
    ctx.restore();
  });
}

// ── INIT ──
resetIdle();
startLandingAnim();
loadAssetManifest();

// ══════════════════════════════════════════════
// ADMIN SYSTEM
// ══════════════════════════════════════════════
const ADMIN_PIN = '1234';
let adminPinEntry = '';
let adminCurrentTab = 'all';
let adminSelected = new Set();

// ── Storage ──
function getSubmissions(){
  try{ return JSON.parse(localStorage.getItem('morphii_submissions')||'[]'); }
  catch(e){ return []; }
}
function saveSubmissions(arr){
  localStorage.setItem('morphii_submissions', JSON.stringify(arr));
}

// ── Save submission on approve ──
function saveSubmission(){
  const name = document.getElementById('nameInput').value || 'Alex Rivera';
  const prof = document.getElementById('profInput').value || 'Future Doctor';
  const canvas = document.getElementById('pinCanvas');
  // Draw print-clean version to capture thumb without gloss/depth
  if(canvas) drawPin(true);
  const thumb = canvas ? canvas.toDataURL('image/png') : '';
  // Restore display version
  if(canvas) drawPin(false);
  const subs = getSubmissions();
  const entry = {
    id: Date.now().toString(),
    name, prof,
    size: document.getElementById('pinSizeSelect')?.value || '2.25',
    thumb,
    state: JSON.parse(JSON.stringify(S)), // snapshot avatar state
    timestamp: new Date().toISOString(),
    paid: false,
    printed: false,
  };
  subs.unshift(entry);
  saveSubmissions(subs);
}

// ── Patch handleApprove to also save ──
const _origApprove = handleApprove;
handleApprove = function(){
  saveSubmission();
  showCelebration();
};

// ── Admin navigation ──
function goToAdmin(){
  adminPinEntry = '';
  updatePinDots();
  document.getElementById('adminLogin').style.display = 'flex';
}
function openAdminScreen(){
  document.getElementById('adminLogin').style.display = 'none';
  document.getElementById('landing-screen').classList.add('hidden');
  document.getElementById('builder-screen').classList.remove('active');
  document.getElementById('admin-screen').classList.add('active');
  clearTimeout(idleTimer);
  adminSelected.clear();
  refreshAdmin();
}

// ── Numpad ──
function numpadPress(v){
  if(v==='clear'){ adminPinEntry=''; }
  else if(v==='back'){ adminPinEntry=adminPinEntry.slice(0,-1); }
  else if(adminPinEntry.length<4){ adminPinEntry+=v; }
  updatePinDots();
  document.getElementById('loginErr').textContent='';
  if(adminPinEntry.length===4){
    setTimeout(()=>{
      if(adminPinEntry===ADMIN_PIN){ openAdminScreen(); }
      else{
        document.getElementById('loginErr').textContent='Wrong PIN. Try again.';
        adminPinEntry='';
        updatePinDots();
      }
    },150);
  }
}
function updatePinDots(){
  for(let i=0;i<4;i++){
    document.getElementById('pd'+i).classList.toggle('filled', i<adminPinEntry.length);
  }
}

// ── Tab ──
function setAdminTab(tab, el){
  adminCurrentTab = tab;
  document.querySelectorAll('.admin-tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  adminSelected.clear();
  renderPinsGrid();
  updatePrintBar();
}

// ── Filter ──
function filterSubs(tab){
  const subs = getSubmissions();
  if(tab==='all') return subs;
  if(tab==='unpaid') return subs.filter(s=>!s.paid);
  if(tab==='paid') return subs.filter(s=>s.paid);
  if(tab==='unprinted') return subs.filter(s=>s.paid&&!s.printed);
  if(tab==='printed') return subs.filter(s=>s.printed);
  return subs;
}

// ── Stats ──
function refreshAdmin(){
  const all = getSubmissions();
  const paid = all.filter(s=>s.paid).length;
  const printed = all.filter(s=>s.printed).length;
  const pending = all.filter(s=>!s.paid).length;
  const queue = all.filter(s=>s.paid&&!s.printed).length;
  document.getElementById('adminStats').innerHTML = `
    <div class="stat-pill"><div><div class="sval">${all.length}</div><div class="slbl">Total</div></div></div>
    <div class="stat-pill"><div><div class="sval" style="color:#FF6FAE">${pending}</div><div class="slbl">Unpaid</div></div></div>
    <div class="stat-pill"><div><div class="sval" style="color:#55EFC4">${paid}</div><div class="slbl">Paid</div></div></div>
    <div class="stat-pill"><div><div class="sval" style="color:#74B9FF">${queue}</div><div class="slbl">In Queue</div></div></div>
    <div class="stat-pill"><div><div class="sval" style="color:#A29BFE">${printed}</div><div class="slbl">Printed</div></div></div>
  `;
  // Update tab counts
  document.getElementById('cnt-all').textContent = all.length;
  document.getElementById('cnt-unpaid').textContent = all.filter(s=>!s.paid).length;
  document.getElementById('cnt-paid').textContent = paid;
  document.getElementById('cnt-unprinted').textContent = queue;
  document.getElementById('cnt-printed').textContent = printed;
  renderPinsGrid();
  updatePrintBar();
}

// ── Render grid ──
function renderPinsGrid(){
  const grid = document.getElementById('pinsGrid');
  const subs = filterSubs(adminCurrentTab);
  if(!subs.length){
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 0;color:rgba(255,255,255,0.2);font-family:Fredoka One,cursive;font-size:20px;">No pins here yet 📌</div>';
    return;
  }
  grid.innerHTML = '';
  subs.forEach(sub => {
    const card = document.createElement('div');
    const sel = adminSelected.has(sub.id);
    card.className = 'pin-card' + (sel?' selected':'') + (sub.paid?' paid':'') + (sub.printed?' printed':'');
    const timeStr = new Date(sub.timestamp).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
    card.innerHTML = `
      <div class="pin-select-box">${sel?'✓':''}</div>
      <div class="pin-thumb">
        <img src="${sub.thumb}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none'">
      </div>
      <div class="pin-info-name">${sub.name}</div>
      <div class="pin-info-prof">${sub.prof}</div>
      <div class="pin-info-meta">
        <span class="meta-badge badge-size">${sub.size}" pin</span>
        <span class="meta-badge badge-time">${timeStr}</span>
      </div>
      <div class="pin-toggles">
        <button class="toggle-btn ${sub.paid?'on-paid':''}" onclick="event.stopPropagation();toggleStatus('${sub.id}','paid')">${sub.paid?'✓ Paid':'$ Unpaid'}</button>
        <button class="toggle-btn ${sub.printed?'on-printed':''}" onclick="event.stopPropagation();toggleStatus('${sub.id}','printed')">${sub.printed?'✓ Printed':'🖨 Queue'}</button>
      </div>
    `;
    card.onclick = () => toggleSelect(sub.id);
    grid.appendChild(card);
  });
}

// ── Toggle paid/printed ──
function toggleStatus(id, field){
  const subs = getSubmissions();
  const sub = subs.find(s=>s.id===id);
  if(sub){ sub[field]=!sub[field]; saveSubmissions(subs); refreshAdmin(); }
}

// ── Selection ──
function toggleSelect(id){
  if(adminSelected.has(id)) adminSelected.delete(id);
  else adminSelected.add(id);
  renderPinsGrid();
  updatePrintBar();
}
function selectAllVisible(){
  filterSubs(adminCurrentTab).forEach(s=>adminSelected.add(s.id));
  renderPinsGrid();updatePrintBar();
}
function clearSelection(){
  adminSelected.clear();
  renderPinsGrid();updatePrintBar();
}
function updatePrintBar(){
  const n = adminSelected.size;
  document.getElementById('selCount').textContent = n;
  const lb = document.getElementById('layoutBtnBar');
  const lb2 = document.getElementById('layoutBtn');
  lb.disabled = n===0; lb2.disabled = n===0;
  if(n>0){lb.style.opacity='1';lb2.style.opacity='1';}
  else{lb.style.opacity='0.35';lb2.style.opacity='0.35';}
}

// ── Size select in builder ──
// Inject size picker next to approve button
function injectSizePicker(){
  const inp = document.querySelector('.inputs-section');
  if(!inp||document.getElementById('pinSizeSelect'))return;
  const wrap = document.createElement('div');
  wrap.className = 'inp-group';
  wrap.innerHTML = `<label>Pin Size</label>
    <select id="pinSizeSelect" style="width:100%;padding:9px 12px;border-radius:12px;border:2px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);font-family:'Fredoka One',cursive;font-size:14px;color:white;outline:none;cursor:pointer;">
      <option value="1.5">Small — 1.5"</option>
      <option value="2.25" selected>Regular — 2.25"</option>
      <option value="3">Large — 3"</option>
    </select>`;
  inp.insertBefore(wrap, inp.querySelector('.approve-btn'));
}

// ══ PRINT LAYOUT ══
function openPrintModal(){
  if(adminSelected.size===0)return;
  document.getElementById('printModal').classList.add('open');
  packPins();
  setTimeout(initPaperDrag,100);
}
function closePrintModal(){
  document.getElementById('printModal').classList.remove('open');
}

const PAPER_SIZES = {
  letter: { w: 8.5, h: 11 },
  a4:     { w: 8.27, h: 11.69 },
};
const MARGIN_IN = 0.4;
const PREVIEW_W = 420; // canvas px for preview

// Mixed-size shelf packer
// Algorithm: shelf packing — place pins left to right on a shelf,
// start a new shelf when current pin doesn't fit width.
// Each shelf height = tallest pin on that shelf.
// ── Print layout state ──
let layoutPins = []; // {sub, cx, cy, rad, dPx, active}
let dragIdx = -1, dragOffX = 0, dragOffY = 0;
let printScale = 1;
let printMg = 0;

function packPins(){
  const paper = PAPER_SIZES[document.getElementById('paperSize').value];
  const GAP = 0.12;
  const usableW = paper.w - MARGIN_IN*2;
  const usableH = paper.h - MARGIN_IN*2;
  printScale = PREVIEW_W / paper.w;
  printMg = MARGIN_IN * printScale;
  const gapPx = GAP * printScale;

  const subs = getSubmissions().filter(s=>adminSelected.has(s.id));

  // Shelf pack
  let shelfX=printMg, shelfY=printMg, shelfH=0;
  layoutPins = [];
  for(const sub of subs){
    const d = (parseFloat(sub.size)||2.25)*printScale;
    const rad = d/2-2;
    if(shelfX+d > printMg+(usableW*printScale) && shelfX>printMg){ shelfY+=shelfH+gapPx; shelfX=printMg; shelfH=0; }
    if(shelfY+d > printMg+(usableH*printScale)) break;
    layoutPins.push({sub, cx:shelfX+d/2, cy:shelfY+d/2, rad, dPx:d, active:true, img:null});
    shelfX+=d+gapPx; shelfH=Math.max(shelfH,d);
  }
  // Preload images
  layoutPins.forEach(p=>{
    if(!p.sub.thumb)return;
    const img=new Image(); img.onload=()=>{p.img=img;renderPaperCanvas();}; img.src=p.sub.thumb;
  });
  renderPaperCanvas();
  renderPmiSidebar();
}

function renderPaperCanvas(){
  const paper = PAPER_SIZES[document.getElementById('paperSize').value];
  const canvH = Math.round(paper.h * printScale);
  const pc = document.getElementById('paperCanvas');
  pc.width = PREVIEW_W; pc.height = canvH;
  const ctx = pc.getContext('2d');

  // Paper
  ctx.fillStyle='#FFFFFF'; ctx.fillRect(0,0,PREVIEW_W,canvH);
  // Margin
  ctx.setLineDash([3,3]); ctx.strokeStyle='rgba(180,180,180,0.5)'; ctx.lineWidth=0.7;
  ctx.strokeRect(printMg,printMg,PREVIEW_W-printMg*2,canvH-printMg*2);
  ctx.setLineDash([]);

  layoutPins.forEach((p,i)=>{
    if(!p.active){ // greyed out
      ctx.save(); ctx.globalAlpha=0.2;
      ctx.beginPath(); ctx.arc(p.cx,p.cy,p.rad,0,Math.PI*2);
      ctx.strokeStyle='#CCC'; ctx.lineWidth=1; ctx.setLineDash([3,2]); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();
      return;
    }
    ctx.save();
    if(p.img){
      ctx.beginPath(); ctx.arc(p.cx,p.cy,p.rad,0,Math.PI*2); ctx.clip();
      ctx.drawImage(p.img,p.cx-p.rad,p.cy-p.rad,p.rad*2,p.rad*2);
    } else {
      ctx.beginPath(); ctx.arc(p.cx,p.cy,p.rad,0,Math.PI*2);
      ctx.fillStyle='#EEF6FF'; ctx.fill();
      ctx.fillStyle='#AAA'; ctx.font=`bold ${Math.max(7,p.rad*0.25)}px sans-serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(p.sub.size+'"',p.cx,p.cy);
    }
    ctx.restore();
    // Cut-line ring
    ctx.save();
    ctx.beginPath(); ctx.arc(p.cx,p.cy,p.rad+1,0,Math.PI*2);
    ctx.strokeStyle='rgba(0,0,0,0.12)'; ctx.lineWidth=0.8; ctx.stroke();
    ctx.restore();
    // Checkmark badge top-right
    const bx=p.cx+p.rad*0.62, by=p.cy-p.rad*0.62;
    ctx.save();
    ctx.fillStyle='#55EFC4'; ctx.beginPath(); ctx.arc(bx,by,Math.max(5,p.rad*0.22),0,Math.PI*2); ctx.fill();
    ctx.fillStyle='white'; ctx.font=`bold ${Math.max(5,p.rad*0.18)}px sans-serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('✓',bx,by);
    ctx.restore();
  });

  const active = layoutPins.filter(p=>p.active);
  const counts={}; active.forEach(p=>{ counts[p.sub.size]=(counts[p.sub.size]||0)+1; });
  const bd=Object.entries(counts).map(([s,n])=>`${n}×${s}"`).join(' · ');
  document.getElementById('packInfo').textContent = `${active.length} pins on paper${bd?' · '+bd:''}`;
}

function renderPmiSidebar(){
  const list=document.getElementById('pmiPinList');
  list.innerHTML='';
  const allSubs = getSubmissions().filter(s=>adminSelected.has(s.id));
  allSubs.forEach(sub=>{
    const idx = layoutPins.findIndex(p=>p.sub.id===sub.id);
    const onPaper = idx>=0;
    const isActive = onPaper && layoutPins[idx].active;
    const item=document.createElement('div');
    item.className='pmi-pin-item';
    item.style.cssText=`cursor:pointer;border:1.5px solid ${isActive?'#55EFC4':'rgba(255,255,255,0.08)'};border-radius:10px;padding:5px 8px;background:${isActive?'rgba(85,239,196,0.08)':'rgba(255,255,255,0.03)'};transition:all 0.15s;`;
    // Thumbnail
    const mc=document.createElement('canvas'); mc.width=28; mc.height=28;
    const mctx=mc.getContext('2d');
    const mi=new Image();
    mi.onload=function(){mctx.save();mctx.beginPath();mctx.arc(14,14,13,0,Math.PI*2);mctx.clip();mctx.drawImage(mi,0,0,28,28);mctx.restore();};
    if(sub.thumb)mi.src=sub.thumb;
    item.appendChild(mc);
    // Info
    const info=document.createElement('div'); info.style.flex='1';
    info.innerHTML=`<div style="font-size:10px;color:white;font-family:'Nunito',sans-serif;font-weight:800">${sub.name}</div><div style="font-size:8px;color:rgba(255,255,255,0.4);font-family:'Nunito',sans-serif">${sub.size}" · ${sub.prof}</div>`;
    item.appendChild(info);
    // Toggle checkbox
    const cb=document.createElement('div');
    cb.style.cssText=`width:18px;height:18px;border-radius:5px;border:2px solid ${isActive?'#55EFC4':'rgba(255,255,255,0.2)'};background:${isActive?'#55EFC4':'transparent'};display:flex;align-items:center;justify-content:center;font-size:10px;color:#0B2E4E;flex-shrink:0;`;
    if(isActive)cb.textContent='✓';
    item.appendChild(cb);
    item.onclick=()=>{
      if(idx>=0){ layoutPins[idx].active=!layoutPins[idx].active; }
      else {
        // Add to layout at a free spot
        const paper=PAPER_SIZES[document.getElementById('paperSize').value];
        const d=(parseFloat(sub.size)||2.25)*printScale;
        layoutPins.push({sub,cx:printMg+d/2+10,cy:printMg+d/2+10,rad:d/2-2,dPx:d,active:true,img:null});
        if(sub.thumb){const img=new Image();img.onload=()=>{layoutPins[layoutPins.length-1].img=img;renderPaperCanvas();};img.src=sub.thumb;}
      }
      renderPaperCanvas(); renderPmiSidebar();
    };
    list.appendChild(item);
  });
}

// ── Drag interactions ──
function initPaperDrag(){
  const pc=document.getElementById('paperCanvas');
  if(!pc||pc._dragInited)return;
  pc._dragInited=true;
  function getPos(e){
    const r=pc.getBoundingClientRect();
    const scx=pc.width/r.width;
    const scy=pc.height/r.height;
    const cx=(e.touches?e.touches[0].clientX:e.clientX)-r.left;
    const cy=(e.touches?e.touches[0].clientY:e.clientY)-r.top;
    return{x:cx*scx,y:cy*scy};
  }
  function startDrag(e){
    const{x,y}=getPos(e);
    dragIdx=-1;
    for(let i=layoutPins.length-1;i>=0;i--){
      const p=layoutPins[i];
      if(!p.active)continue;
      const dx=x-p.cx,dy=y-p.cy;
      if(dx*dx+dy*dy<p.rad*p.rad){dragIdx=i;dragOffX=dx;dragOffY=dy;break;}
    }
    if(dragIdx>=0)pc.style.cursor='grabbing';
    e.preventDefault();
  }
  function moveDrag(e){
    if(dragIdx<0)return;
    const{x,y}=getPos(e);
    layoutPins[dragIdx].cx=x-dragOffX;
    layoutPins[dragIdx].cy=y-dragOffY;
    renderPaperCanvas();
    e.preventDefault();
  }
  function endDrag(){
    dragIdx=-1;
    pc.style.cursor='grab';
  }
  pc.addEventListener('mousedown',startDrag);
  pc.addEventListener('mousemove',moveDrag);
  pc.addEventListener('mouseup',endDrag);
  pc.addEventListener('touchstart',startDrag,{passive:false});
  pc.addEventListener('touchmove',moveDrag,{passive:false});
  pc.addEventListener('touchend',endDrag);
}

function doPrint(){
  const pc = document.getElementById('paperCanvas');
  const paper = PAPER_SIZES[document.getElementById('paperSize').value];
  // Open print window with the canvas as image
  const win = window.open('','_blank');
  const img = pc.toDataURL('image/png');
  win.document.write(`<!DOCTYPE html><html><head><title>Morphii Print</title>
    <style>*{margin:0;padding:0;}body{background:white;}
    img{width:${paper.w}in;height:${paper.h}in;display:block;}
    @media print{@page{size:${paper.w}in ${paper.h}in;margin:0;}img{width:100%;height:100%;}}
    </style></head><body>
    <img src="${img}" onload="setTimeout(()=>{window.print();window.close();},200)">
    </body></html>`);
  // Mark only active layout pins as printed
  const subs = getSubmissions();
  layoutPins.filter(p=>p.active).forEach(p=>{
    const s=subs.find(x=>x.id===p.sub.id);
    if(s)s.printed=true;
  });
  saveSubmissions(subs);
  refreshAdmin();
}

// Add admin access: long-press on landing logo (3 sec) or hidden button
document.addEventListener('DOMContentLoaded',()=>{
  injectSizePicker();
  // Add secret admin button to builder header
  const adminBtn = document.createElement('button');
  adminBtn.className = 'back-to-landing';
  adminBtn.style.cssText = 'opacity:0.4;font-size:11px;padding:4px 10px;';
  adminBtn.textContent = '⚙ Admin';
  adminBtn.onclick = (e)=>{ e.stopPropagation(); goToAdmin(); };
  const hdr = document.querySelector('#admin-screen')?.previousElementSibling;
  // Attach to builder header
  setTimeout(()=>{
    const builderNav = document.querySelector('#builder-screen header');
    if(builderNav){
      builderNav.appendChild(adminBtn);
    }
  },500);
});

// Add demo data if empty
function addDemoData(){
  const existing = getSubmissions();
  if(existing.length > 0) return;
  const demos=[
    {name:'Mia Santos',prof:'Future Doctor',size:'2.25',paid:true,printed:false},
    {name:'Jake Cruz',prof:'Future Engineer',size:'1.5',paid:true,printed:true},
    {name:'Lily Reyes',prof:'Future Chef',size:'3',paid:false,printed:false},
    {name:'Sam Lim',prof:'Future Astronaut',size:'2.25',paid:true,printed:false},
    {name:'Ana Garcia',prof:'Future Teacher',size:'1.5',paid:false,printed:false},
  ];
  const canvas = document.getElementById('pinCanvas');
  const thumb = canvas ? canvas.toDataURL('image/png') : '';
  const now = Date.now();
  const subs = demos.map((d,i)=>({
    id:(now-i*60000).toString(),
    ...d, thumb,
    state:{},
    timestamp: new Date(now-i*3600000).toISOString(),
  }));
  saveSubmissions(subs);
}

setTimeout(addDemoData, 800);
