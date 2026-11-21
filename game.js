"use strict";
const el = id => document.getElementById(id);
const words = {
  s: ["Сок","Суп","Сыр","Сова","Собака","Санки","Сумка","Самолёт","Самокат","Слон","Снег","Сапоги","Нос","Лес","Усы"],
  sh: ["Шар","Шапка","Шуба","Шарф","Шкаф","Шишка","Шляпа","Шорты","Мышь","Кошка","Чашка","Машина","Подушка","Груша","Карандаш"]
};
const pictures = Object.fromEntries(Object.entries(words).map(([group,names]) =>
  [group,names.map((name,i)=>({name,group,src:'assets/'+group+(i+1)+'.jpg'}))]));
const state = {group:"s", count:5, lives:5, score:0, deck:[], locked:false};
const random = (a,b) => a + Math.random()*(b-a);
function shuffled(items) {
  const out = items.slice();
  for(let i=out.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [out[i],out[j]]=[out[j],out[i]];
  }
  return out;
}
function setupChoices(id,select){
  el(id).onclick = event => {
    const choice=event.target.closest("button");
    if(!choice)return;
    for(const b of el(id).children)b.setAttribute("aria-pressed",String(b===choice));
    select(choice.dataset.value);
  };
}
setupChoices("sounds",v=>state.group=v);
setupChoices("counts",v=>state.count=Number(v));
function setScreen(name){
  el("field").dataset.screen=name;
  el("menu").hidden=name!=="menu";el("end").hidden=name!=="end";
  for(const id of ["boards","prompt","hud"])el(id).hidden=name!=="play";
}
function heart(){
  return '<svg class="heart" viewBox="0 0 32 30" aria-hidden="true"><path d="M16 27C11 23 2 17 2 10 2 2 12 0 16 7 21 -1 30 3 30 10 30 16 21 24 16 27Z" fill="#a6c9d4" stroke="#557a88" stroke-width="1.5"/><path d="M4 10C4 4 11 2 15 9M19 7q5-5 8 0" stroke="#fff" fill="none" stroke-width="3" stroke-linecap="round"/></svg>';
}
function updateHud(){
  el("score").textContent=state.score+"/15";
  el("lives").setAttribute("aria-label","Осталось жизней — "+state.lives);
  Array.from(el("lives").children).forEach((h,i)=>h.classList.toggle("spent",i>=state.lives));
}
function start(){
  Object.assign(state,{deck:shuffled(pictures[state.group]),score:0,lives:state.count,locked:false});
  el("boy").src="assets/boy.png";
  el("prompt").textContent="Найди звук "+(state.group==="s"?"С":"Ш");
  el("lives").innerHTML=heart().repeat(state.count);
  setScreen("play");updateHud();round();
}
function round(){
  const distractors=shuffled(pictures[state.group==="s"?"sh":"s"]).slice(0,2);
  const choices=shuffled([state.deck[state.score],...distractors]);
  el("boards").replaceChildren(...choices.map((card,i)=>{
    const slot=document.createElement("div"),button=document.createElement("button"),img=new Image();
    slot.className="slot";slot.style.setProperty("--lift",(i===1?random(-19,-7):random(-3,14))+"%");
    button.className="board";button.setAttribute("aria-label",card.name);img.src=card.src;img.alt="";button.append(img);
    button.onclick=()=>shoot(card,button);slot.append(button);return slot;
  }));
}
const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
async function motion(node,frames,duration,easing="ease-out"){
  const anim=node.animate(frames,{duration:reduced?18:duration,easing});
  await anim.finished.catch(()=>{});
}
function point(node,fx=.5,fy=.5){
  const r=node.getBoundingClientRect(),field=el("field").getBoundingClientRect();
  return {x:r.left-field.left+r.width*fx,y:r.top-field.top+r.height*fy};
}
async function flight(a,b){
  const ball=document.createElement("i");ball.className="ball";el("field").append(ball);
  const arc=Math.min(125,el("field").clientHeight*.16);
  const frames=Array.from({length:17},(_,i)=>{
    const t=i/16,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t-4*arc*t*(1-t);
    return {transform:'translate('+x+'px,'+y+'px) translate(-50%,-50%) scale('+(1-.25*t)+')'};
  });
  ball.style.left="0";ball.style.top="0";await motion(ball,frames,360,"linear");ball.remove();
}
function burst(p,flags=false){
  for(let i=0;i<(flags?45:14);i++){
    const bit=document.createElement("i");bit.className=flags?"flag":"dust";
    bit.style.left=p.x+"px";bit.style.top=p.y+"px";
    if(flags && i%3)bit.style.background=["#c67545","#6e957f","#e5b450","#8db5ce"][i%4];
    else if(flags)bit.className="dust";
    el("field").append(bit);
    const dx=random(-1,1)*(flags?el("field").clientWidth*.48:44);
    const dy=flags?random(70,220):random(12,48);
    motion(bit,[{transform:"translate(0,0)",opacity:1},{transform:'translate('+dx*.58+'px,'+-dy+'px) rotate(65deg)',opacity:1,offset:.55},{transform:'translate('+dx+'px,'+(flags?52:-dy*.25)+'px) rotate(150deg)',opacity:0}],flags?1450:380).then(()=>bit.remove());
  }
}
async function shoot(card,button){
  if(state.locked || el("field").dataset.screen!=="play")return;
  state.locked=true;
  const boy=el("boy"),hand=point(boy,.90,.04),target=point(button);
  await motion(boy,[{transform:"rotate(0)"},{transform:"rotate(-7deg)",offset:.55},{transform:"rotate(4deg)"}],180);
  boy.src="assets/throw.png";await flight(hand,target);burst(target);
  const correct=card.group===state.group;
  if(correct){
    state.score++;updateHud();el("announce").textContent=card.name+". Верно! "+state.score+" из 15.";
    await motion(button,[{transform:"rotate(0)"},{transform:"rotate(-8deg)",offset:.25},{transform:"rotate(5deg)",offset:.48},{transform:"translateY(115%)"}],400);
    if(state.score===15)finish(true);else round();
  }else{
    await flight(target,point(boy,.5,.18));burst(point(boy,.5,.18));
    state.lives--;updateHud();el("announce").textContent=card.name+". Попробуй другую картинку. Жизней — "+state.lives;
    await motion(boy,[{transform:"rotate(0)"},{transform:"rotate(-5deg)"},{transform:"rotate(3deg)"},{transform:"rotate(0)"}],270);
    if(state.lives===0)finish(false);
  }
  if(el("field").dataset.screen==="play")boy.src="assets/boy.png";
  state.locked=false;
}
function finish(won){
  setScreen("end");el("boy").src="assets/"+(won?"win":"lose")+".png";
  el("ending").textContent=won?"Ура! Крепость покорена!":"Снежки закончились!";
  el("summary").textContent=won?"15 точных попаданий!":"Попробуем ещё раз?";
  el("remaining").textContent=won?"Осталось жизней — "+state.lives:"Попадания — "+state.score+"/15";
  el("again").textContent=won?"Играть ещё":"Попробовать снова";el("again").focus();
  if(won){burst(point(el("field"),.64,.53),true);}
}
el("play").onclick=start;el("again").onclick=start;
el("back").onclick=()=>{setScreen("menu");el("boy").src="assets/boy.png";el("play").focus();};
for(let i=0;i<40;i++){
  const flake=document.createElement("i");flake.className="flake";flake.style.left=random(-3,100)+"%";
  const size=random(1,4)+"px";flake.style.width=size;flake.style.height=size;
  flake.style.animationDuration=random(5,12)+"s";flake.style.animationDelay=-random(0,12)+"s";el("snow").append(flake);
}
for(const src of [...Object.values(pictures).flat().map(c=>c.src),"assets/win.png","assets/lose.png","assets/throw.png"]){new Image().src=src;}
