const $ = (id) => document.getElementById(id);
const state = { magnetX: 0.29, phase: -0.51, magnetAngle: 0, motionMode: 'linear', rotationSpeed: 1.5, axisMode: 'auto', fixedScale: .5, moving: false, speed: 1, turns: 120, strength: 0.8, direction: 1, dragging: false, flux: 0.6, emf: 0, previousFlux: 0, closed: false, switchTime: 0, voltageHistory: [], lastChartSample: 0 };
const coilView={yaw:-.42,pitch:.2,dragging:false,lastX:0,lastY:0};

function fitCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if(canvas.width!==width)canvas.width=width;
  if(canvas.height!==height)canvas.height=height;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: rect.width, h: rect.height, dpr };
}

function drawHero(time) {
  if(!$('hero3d')||$('panel-fundamente').hidden)return;
  const cyaw=Math.cos(coilView.yaw),syaw=Math.sin(coilView.yaw),cp=Math.cos(coilView.pitch),sp=Math.sin(coilView.pitch);
  function rotate(point){
    const [x,y,z]=point;
    const x1=x*cyaw+z*syaw,z1=-x*syaw+z*cyaw;
    const y1=y*cp-z1*sp,z2=y*sp+z1*cp;
    const perspective=760/(760+z2);
    return {x:380+x1*perspective,y:270+y1*perspective,z:z2};
  }
  function linePath(points,closed=false){
    const projected=points.map(rotate);
    return projected.map((p,index)=>`${index?'L':'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')+(closed?' Z':'');
  }
  const fields=$('coilFields3d');
  const fieldDefinitions=[
    {offset:0,plane:0,reach:155,axis:true},
    {offset:22,plane:0,reach:145},
    {offset:46,plane:0,reach:172},
    {offset:22,plane:Math.PI/3,reach:155},
    {offset:46,plane:Math.PI/3,reach:180},
    {offset:22,plane:2*Math.PI/3,reach:155},
    {offset:46,plane:2*Math.PI/3,reach:180}
  ];
  if(fields.children.length!==fieldDefinitions.length){
    fields.replaceChildren();
    fieldDefinitions.forEach(()=>fields.appendChild(document.createElementNS('http://www.w3.org/2000/svg','path')));
  }
  fieldDefinitions.forEach((definition,index)=>{
    const points=[],half=80,extent=255,plane=definition.plane;
    for(let i=0;i<=half;i++){
      const ratio=i/half;
      const radius=definition.offset;
      points.push([extent-ratio*extent*2,radius*Math.cos(plane),radius*Math.sin(plane)]);
    }
    for(let i=1;i<=half;i++){
      const angle=i/half*Math.PI;
      const radius=definition.offset+(definition.reach-definition.offset)*Math.sin(angle);
      points.push([-extent*Math.cos(angle),radius*Math.cos(plane),radius*Math.sin(plane)]);
    }
    const element=fields.children[index];
    element.setAttribute('d',linePath(points,true));
    element.classList.toggle('coil-field-axis',Boolean(definition.axis));
    element.setAttribute('marker-end','url(#coilFieldArrow)');
  });
  const particles=$('coilParticles3d');
  if(!particles.children.length)for(let i=0;i<8;i++)particles.appendChild(document.createElementNS('http://www.w3.org/2000/svg','circle'));
  for(let i=0;i<8;i++){
    const a=time*.00055+i*Math.PI/4;
    const fieldIndex=i%fieldDefinitions.length;
    const definition=fieldDefinitions[fieldIndex];
    let p;
    if(a%(Math.PI*2)<Math.PI){
      const x=255-(a%(Math.PI))*2*255/Math.PI;
      p=rotate([x,definition.offset*Math.cos(definition.plane),definition.offset*Math.sin(definition.plane)]);
    }else{
      const angle=(a%(Math.PI))-Math.PI;
      const radius=definition.offset+(definition.reach-definition.offset)*Math.sin(angle);
      p=rotate([-255*Math.cos(angle),radius*Math.cos(definition.plane),radius*Math.sin(definition.plane)]);
    }
    particles.children[i].setAttribute('cx',p.x);particles.children[i].setAttribute('cy',p.y);particles.children[i].setAttribute('r',i%2?2.3:3.2);
  }
  const back=[],front=[],turns=14,steps=turns*34;
  for(let i=0;i<steps;i++){
    const a=i/steps*turns*Math.PI*2,b=(i+1)/steps*turns*Math.PI*2;
    const p1=[-175+(i/steps)*350,82*Math.cos(a),82*Math.sin(a)];
    const p2=[-175+((i+1)/steps)*350,82*Math.cos(b),82*Math.sin(b)];
    const a1=rotate(p1),b1=rotate(p2);
    ((a1.z+b1.z)/2<0?back:front).push(`M${a1.x.toFixed(1)} ${a1.y.toFixed(1)}L${b1.x.toFixed(1)} ${b1.y.toFixed(1)}`);
  }
  $('coilBack3d').setAttribute('d',back.join(''));
  $('coilFront3d').setAttribute('d',front.join(''));
  $('coilAxis3d').setAttribute('d',linePath([[215,0,0],[-215,0,0]]));
  const left=rotate([-215,115,0]),right=rotate([215,115,0]),leadL=rotate([-175,0,-82]),leadR=rotate([175,0,82]);
  $('coilLeadLeft3d').setAttribute('d',linePath([[-175,0,-82],[-215,115,0]]));
  $('coilLeadRight3d').setAttribute('d',linePath([[175,0,82],[215,115,0]]));
  [['coilTerminalLeft3d','coilMinus3d',left],['coilTerminalRight3d','coilPlus3d',right]].forEach(([circle,text,p])=>{
    $(circle).setAttribute('cx',p.x);$(circle).setAttribute('cy',p.y);
    $(text).setAttribute('x',p.x);$(text).setAttribute('y',p.y);
  });
  const n=rotate([-230,0,0]),s=rotate([230,0,0]);
  $('coilNorth3d').setAttribute('x',n.x);$('coilNorth3d').setAttribute('y',n.y);
  $('coilSouth3d').setAttribute('x',s.x);$('coilSouth3d').setAttribute('y',s.y);
}

if($('hero3d')){
  $('hero3d').addEventListener('pointerdown',event=>{
    coilView.dragging=true;coilView.lastX=event.clientX;coilView.lastY=event.clientY;$('hero3d').setPointerCapture(event.pointerId);
  });
  $('hero3d').addEventListener('pointermove',event=>{
    if(!coilView.dragging)return;
    coilView.yaw+=(event.clientX-coilView.lastX)*.009;
    coilView.pitch=Math.max(-1.1,Math.min(1.1,coilView.pitch+(event.clientY-coilView.lastY)*.007));
    coilView.lastX=event.clientX;coilView.lastY=event.clientY;
  });
  $('hero3d').addEventListener('pointerup',()=>coilView.dragging=false);
  $('hero3d').addEventListener('pointercancel',()=>coilView.dragging=false);
}

function drawCoil() {
  const { ctx, w, h } = fitCanvas($('coilCanvas'));
  ctx.clearRect(0, 0, w, h);
  const cx = w * .61, cy = h * .48, coilW = Math.min(235, w * .34), coilH = Math.min(190, h * .56);
  ctx.fillStyle = '#e3e4dc';
  for (let y=25;y<h;y+=24) for(let x=20;x<w;x+=24) { ctx.fillRect(x,y,1,1); }
  const magX = state.magnetX * w, magY = cy;
  const proximity = Math.exp(-Math.pow((magX - cx) / (w * .26), 2));
  ctx.strokeStyle = `rgba(120,140,35,${.08 + proximity * .12})`; ctx.lineWidth=1;
  for(let i=-4;i<=4;i++) {
    ctx.beginPath(); ctx.ellipse(cx,cy+i*5,coilW*.9+Math.abs(i)*18,coilH*.7+Math.abs(i)*9,0,0,Math.PI*2); ctx.stroke();
  }
  ctx.lineCap='round';
  ctx.strokeStyle='#20231f'; ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(cx-coilW/2,cy+coilH*.5);ctx.lineTo(cx-coilW/2-30,cy+coilH*.5);ctx.lineTo(cx-coilW/2-30,cy+coilH*.7);ctx.lineTo(cx+coilW*.52,cy+coilH*.7);ctx.lineTo(cx+coilW*.52,cy-coilH*.1);ctx.stroke();
  const loops=Math.min(18,8+state.turns/15);
  for(let i=0;i<loops;i++) {
    const x=cx-coilW/2+i*coilW/(loops-1);
    ctx.strokeStyle=i%2?'#bd654c':'#dd7858'; ctx.lineWidth=3.4;
    ctx.beginPath();ctx.ellipse(x,cy,15,coilH/2,0,0,Math.PI*2);ctx.stroke();
  }
  ctx.font="8px 'DM Mono'";
  ctx.fillStyle='#92968d';ctx.textAlign='center';
  ctx.fillText(`BOBINĂ CU ${state.turns} SPIRE`,cx,cy-coilH*.72);
  ctx.save();ctx.translate(magX,magY);ctx.rotate(state.magnetAngle);
  const grad=ctx.createLinearGradient(-37,0,37,0);
  grad.addColorStop(0,'#ed7651');grad.addColorStop(.5,'#ed7651');grad.addColorStop(.5,'#4563df');grad.addColorStop(1,'#4563df');
  ctx.fillStyle='#0002';ctx.fillRect(-36,-17,76,39);
  ctx.fillStyle=grad;ctx.fillRect(-38,-20,76,38);
  ctx.strokeStyle='#0002';ctx.strokeRect(-38,-20,76,38);
  ctx.fillStyle='#fff';ctx.font="bold 12px 'DM Mono'";ctx.fillText('N',-19,4);ctx.fillText('S',19,4);ctx.restore();
  const arrow=state.direction*26;
  ctx.strokeStyle='#262a23';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(magX-arrow,magY-48);ctx.lineTo(magX+arrow,magY-48);ctx.stroke();
  const a=Math.sign(arrow);ctx.beginPath();ctx.moveTo(magX+arrow-a*5,magY-52);ctx.lineTo(magX+arrow,magY-48);ctx.lineTo(magX+arrow-a*5,magY-44);ctx.stroke();
  if(Math.abs(state.emf)>.02) {
    ctx.fillStyle=state.emf>0?'#7d9222':'#4765d8';ctx.font="10px 'DM Mono'";ctx.fillText(state.emf>0?'TENSIUNE +':'TENSIUNE −',cx+coilW*.7,cy-20);
  }
}

function setMagnetPosition(clientX) {
  const rect=$('coilCanvas').getBoundingClientRect();
  state.magnetX=Math.max(.07,Math.min(.9,(clientX-rect.left)/rect.width));
  state.flux=state.strength*Math.exp(-Math.pow((state.magnetX-.61)/.29,2))*.75*Math.cos(state.magnetAngle);
  state.previousFlux=state.flux;
  state.phase=Math.asin(Math.max(-1,Math.min(1,(state.magnetX-.5)/.43)));
}
$('coilCanvas').addEventListener('pointerdown',e=>{if(state.motionMode!=='linear')return;state.dragging=true;state.moving=false;updatePlayButton();$('coilCanvas').setPointerCapture(e.pointerId);setMagnetPosition(e.clientX);});
$('coilCanvas').addEventListener('pointermove',e=>{if(state.dragging&&state.motionMode==='linear')setMagnetPosition(e.clientX);});
$('coilCanvas').addEventListener('pointerup',()=>state.dragging=false);

function updatePlayButton(){ $('playButton').innerHTML=`<span id="playIcon">${state.moving?'Ⅱ':'▶'}</span> ${state.moving?'Oprește mișcarea':'Pornește mișcarea'}`; }
$('playButton').addEventListener('click',()=>{state.moving=!state.moving;updatePlayButton();});
$('reverseButton').addEventListener('click',()=>{
  if(state.motionMode==='linear')state.direction*=-1;
  else{
    state.rotationSpeed*=-1;
    $('rotationInput').value=state.rotationSpeed;
    $('rotationOutput').textContent=state.rotationSpeed.toFixed(1)+' rad/s';
  }
});
$('resetMagnet').addEventListener('click',()=>{
  state.magnetX=state.motionMode==='rotation'?.61:.29;
  state.phase=-.51;state.magnetAngle=0;state.moving=false;state.direction=1;state.voltageHistory=[];
  state.previousFlux=state.strength*Math.exp(-Math.pow((state.magnetX-.61)/.29,2))*.75;
  updatePlayButton();
});
document.querySelectorAll('input[name="motionMode"]').forEach(input=>input.addEventListener('change',event=>{
  state.motionMode=event.target.value;
  state.moving=false;
  state.magnetAngle=0;
  state.voltageHistory=[];
  if(state.motionMode==='rotation'){
    state.magnetX=.61;
    state.previousFlux=state.strength*Math.exp(-Math.pow((state.magnetX-.61)/.29,2))*.75;
  }else{
    state.magnetX=.29;
    state.phase=-.51;
    state.previousFlux=state.strength*Math.exp(-Math.pow((state.magnetX-.61)/.29,2))*.75;
  }
  $('linearSpeedControl').classList.toggle('hidden-control',state.motionMode!=='linear');
  $('rotationSpeedControl').classList.toggle('hidden-control',state.motionMode!=='rotation');
  updatePlayButton();
}));
$('turnsInput').addEventListener('input',e=>{state.turns=+e.target.value;$('turnsOutput').textContent=state.turns;});
$('speedInput').addEventListener('input',e=>{state.speed=+e.target.value;$('speedOutput').textContent=state.speed.toFixed(1)+'×';});
$('rotationInput').addEventListener('input',e=>{state.rotationSpeed=+e.target.value;$('rotationOutput').textContent=state.rotationSpeed.toFixed(1)+' rad/s';});
$('strengthInput').addEventListener('input',e=>{state.strength=+e.target.value;$('strengthOutput').textContent=state.strength.toFixed(2)+' T';});
$('doubleTurns').addEventListener('click',()=>{state.turns=Math.min(240,state.turns*2);$('turnsInput').value=state.turns;$('turnsOutput').textContent=state.turns;state.moving=true;updatePlayButton();openTab('inductie');});
$('axisMode').addEventListener('change',e=>{state.axisMode=e.target.value;$('fixedScaleControl').classList.toggle('visible',state.axisMode==='fixed');});
$('fixedScaleInput').addEventListener('input',e=>{state.fixedScale=+e.target.value;$('fixedScaleLabel').textContent=`±${state.fixedScale.toFixed(2)} V`;});

function updateSimulation(dt) {
  if(state.moving&&state.motionMode==='linear'&&state.speed>0) {
    state.phase += state.direction * dt * .9 * state.speed;
    state.magnetX=.5+.43*Math.sin(state.phase);
  }
  if(state.moving&&state.motionMode==='rotation'){
    state.magnetX=.61;
    state.magnetAngle=(state.magnetAngle+state.rotationSpeed*dt)%(Math.PI*2);
  }
  const old=state.previousFlux;
  state.flux=state.strength*Math.exp(-Math.pow((state.magnetX-.61)/.29,2))*.75*Math.cos(state.magnetAngle);
  state.emf=-(state.turns/120)*((state.flux-old)/Math.max(dt,.001))*.8;
  state.previousFlux=state.flux;
  if(!state.moving) state.emf*=.9;
  $('fluxReadout').textContent=(state.flux*1000).toFixed(0);
  $('fluxRateReadout').textContent=((state.flux-old)/Math.max(dt,.001)*1000>=0?'+':'')+((state.flux-old)/Math.max(dt,.001)*1000).toFixed(0);
  $('voltageReadout').textContent=state.emf.toFixed(2);
}

function drawVoltageChart(time) {
  if(time-state.lastChartSample>35) {
    state.voltageHistory.push(state.emf);
    if(state.voltageHistory.length>240)state.voltageHistory.shift();
    state.lastChartSample=time;
  }
  const canvas=$('voltageChartCanvas'), rect=canvas.getBoundingClientRect();
  if(rect.width<2||rect.height<2)return;
  const {ctx,w,h}=fitCanvas(canvas), left=35,right=8,top=8,bottom=18,gw=w-left-right,gh=h-top-bottom;
  const peak=state.axisMode==='fixed'?state.fixedScale:Math.max(.2,...state.voltageHistory.map(Math.abs));
  ctx.clearRect(0,0,w,h);
  ctx.strokeStyle='#daddd2';ctx.lineWidth=1;ctx.setLineDash([2,3]);
  [-1,0,1].forEach(level=>{
    const y=top+gh/2-level*gh/2;
    ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke();
  });
  ctx.setLineDash([]);
  ctx.fillStyle='#858a80';ctx.font='9px "Times New Roman"';ctx.textAlign='right';
  ctx.fillText(`+${peak.toFixed(1)}`,left-6,top+4);ctx.fillText('0',left-6,top+gh/2+3);ctx.fillText(`−${peak.toFixed(1)}`,left-6,top+gh);
  ctx.textAlign='center';ctx.fillText('t →',w-13,h-3);
  if(state.voltageHistory.length<2)return;
  ctx.save();ctx.beginPath();ctx.rect(left,top,gw,gh);ctx.clip();
  const gradient=ctx.createLinearGradient(0,top,0,top+gh);
  gradient.addColorStop(0,'#ef744c55');gradient.addColorStop(.5,'#ef744c08');gradient.addColorStop(1,'#ef744c55');
  ctx.beginPath();
  state.voltageHistory.forEach((value,index)=>{
    const x=left+index/Math.max(1,state.voltageHistory.length-1)*gw;
    const y=top+gh/2-value/peak*gh/2;
    index?ctx.lineTo(x,y):ctx.moveTo(x,y);
  });
  ctx.strokeStyle='#e86c45';ctx.lineWidth=1.8;ctx.stroke();ctx.restore();
}

const circuit={L:.2,R:10,V:20,time:0,closedAt:performance.now()};
function bindCircuit(){
  circuit.L=+$('inductanceInput').value; circuit.R=+$('resistanceInput').value; circuit.V=+$('supplyInput').value;
  $('inductanceOutput').textContent=circuit.L.toFixed(2)+' H';$('resistanceOutput').textContent=circuit.R+' Ω';$('supplyOutput').textContent=circuit.V+' V';
  $('tauReadout').textContent=(circuit.L/circuit.R*1000).toFixed(1);$('steadyReadout').textContent=(circuit.V/circuit.R).toFixed(2);
}
['inductanceInput','resistanceInput','supplyInput'].forEach(id=>$(id).addEventListener('input',bindCircuit));
$('switchButton').addEventListener('click',()=>{state.closed=!state.closed;$('switchButton').textContent=state.closed?'Deschide comutatorul':'Închide comutatorul';state.switchTime=performance.now();});
function circuitCurrent(t){return state.closed?circuit.V/circuit.R*(1-Math.exp(-t/(circuit.L/circuit.R))):0;}
function drawScope(time) {
  const {ctx,w,h}=fitCanvas($('scopeCanvas')), padL=46,padR=18,padT=24,padB=32, gw=w-padL-padR,gh=h-padT-padB;
  ctx.clearRect(0,0,w,h);
  ctx.strokeStyle='#ddded6';ctx.lineWidth=1;
  for(let i=0;i<=8;i++){ctx.beginPath();ctx.moveTo(padL+gw*i/8,padT);ctx.lineTo(padL+gw*i/8,padT+gh);ctx.stroke();}
  for(let i=0;i<=4;i++){ctx.beginPath();ctx.moveTo(padL,padT+gh*i/4);ctx.lineTo(w-padR,padT+gh*i/4);ctx.stroke();}
  ctx.fillStyle='#8c9087';ctx.font="8px 'DM Mono'";ctx.textAlign='right';
  for(let i=0;i<=4;i++)ctx.fillText((1-i/4).toFixed(2),padL-9,padT+gh*i/4+3);
  ctx.textAlign='center';ctx.fillText('0',padL,h-14);ctx.fillText('1τ',padL+gw*.2,h-14);ctx.fillText('2τ',padL+gw*.4,h-14);ctx.fillText('3τ',padL+gw*.6,h-14);ctx.fillText('4τ',padL+gw*.8,h-14);ctx.fillText('5τ',padL+gw,h-14);
  const elapsed=(time-state.switchTime)/1000, duration=Math.max(.25,circuit.L/circuit.R*5);
  function path(fn,color){ctx.beginPath();for(let x=0;x<=gw;x++){const t=x/gw*duration;const y=padT+gh*(1-fn(t));x?ctx.lineTo(padL+x,y):ctx.moveTo(padL+x,y);}ctx.strokeStyle=color;ctx.lineWidth=2.3;ctx.stroke();}
  path(t=> state.closed?(1-Math.exp(-t/(circuit.L/circuit.R))):0,'#ed744e');
  path(t=> state.closed?Math.exp(-t/(circuit.L/circuit.R)):0,'#4465ee');
  const markerT=Math.min(elapsed,duration);
  if(state.closed){const x=padL+markerT/duration*gw, current=1-Math.exp(-markerT/(circuit.L/circuit.R));ctx.setLineDash([3,4]);ctx.strokeStyle='#a0a399';ctx.beginPath();ctx.moveTo(x,padT);ctx.lineTo(x,padT+gh);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#ed744e';ctx.beginPath();ctx.arc(x,padT+gh*(1-current),5,0,Math.PI*2);ctx.fill();}
  ctx.font="9px 'DM Mono'";ctx.fillStyle='#8b8f85';ctx.textAlign='left';ctx.fillText('RĂSPUNS NORMALIZAT',padL,padT-10);
}

const questions=[
 {q:"Dacă numărul de spire se dublează, iar dΦ/dt rămâne constant, tensiunea indusă va…",a:["Rămâne neschimbată","Se dublează în modul","Scade la jumătate","Își schimbă doar semnul"],correct:1,why:"Corect: în ε = −N dΦ/dt, t.e.m. este direct proporțională cu numărul de spire N."},
 {q:"Un magnet se oprește în interiorul unei bobine. Ce se întâmplă cu tensiunea indusă?",a:["Devine zero","Atinge maximul","Rămâne constantă și pozitivă","Se inversează periodic"],correct:0,why:"Corect: fără mișcare fluxul nu se schimbă. Prin urmare dΦ/dt = 0, iar tensiunea indusă este nulă."},
 {q:"Într-un circuit RL, creșterea rezistenței R la aceeași inductanță L va…",a:["Crește constanta de timp","Nu modifică constanta de timp","Reduce constanta de timp","Face curentul să crească instantaneu"],correct:2,why:"Corect: τ = L/R. Creșterea lui R reduce constanta de timp, deci regimul staționar se atinge mai repede."}
];
let currentQuestion=0,score=0,selected=-1,checked=false;
function renderQuestion(){
  selected=-1;checked=false;const q=questions[currentQuestion];
  $('progressLabel').textContent=currentQuestion<3?`Întrebarea ${currentQuestion+1} din 3`:'Evaluare încheiată';$('questionNumber').textContent=`ÎNTREBAREA ${String(Math.min(currentQuestion+1,3)).padStart(2,'0')}`;
  $('questionText').textContent=q.q;$('feedback').textContent="Alege răspunsul potrivit pe baza laboratorului."; $('answerList').innerHTML='';
  q.a.forEach((answer,i)=>{const b=document.createElement('button');b.className='answer';b.innerHTML=`<span>${String.fromCharCode(65+i)}</span>${answer}`;b.addEventListener('click',()=>{if(checked)return;selected=i;[...$('answerList').children].forEach(x=>x.classList.remove('selected'));b.classList.add('selected');$('checkAnswer').disabled=false;});$('answerList').appendChild(b);});
  $('checkAnswer').disabled=true;$('checkAnswer').innerHTML='Verifică răspunsul <span>→</span>';
  document.querySelectorAll('.progress-dots i').forEach((el,i)=>el.className=i<currentQuestion?'done':i===currentQuestion?'current':'');
  $('scoreLabel').textContent=`PUNCTAJ ${score}/3`;
}
$('checkAnswer').addEventListener('click',()=>{
  if(currentQuestion>=questions.length){
    currentQuestion=0;score=0;renderQuestion();return;
  }
  if(checked){
    currentQuestion++;
    if(currentQuestion>=questions.length){$('questionText').textContent=`Evaluare încheiată — ai obținut ${score} din 3 puncte.`;$('answerList').innerHTML='<p style="color:#71756f;font-size:13px;line-height:1.8">Poți reveni la simulări și relua testul pentru a consolida noțiunile. Încearcă să anticipezi rezultatul înainte de a modifica parametrii.</p>';$('checkAnswer').innerHTML='Reluare evaluare ↺';$('feedback').textContent=score===3?'Foarte bine. Înțelegerea legilor inducției este solidă.':"Revizuiește legea lui Faraday și relația τ = L/R, apoi încearcă din nou.";$('progressLabel').textContent='Toate întrebările sunt parcurse';$('questionNumber').textContent='EVALUARE ÎNCHEIATĂ';document.querySelectorAll('.progress-dots i').forEach(el=>el.className='done');return;}
    renderQuestion();return;
  }
  checked=true;const q=questions[currentQuestion];[...$('answerList').children].forEach((el,i)=>{if(i===q.correct)el.classList.add('correct');else if(i===selected)el.classList.add('incorrect');});
  if(selected===q.correct)score++;$('feedback').textContent=selected===q.correct?q.why:`Nu chiar. ${q.why}`;$('scoreLabel').textContent=`PUNCTAJ ${score}/3`;$('checkAnswer').innerHTML=currentQuestion===2?'Vezi rezultatul <span>→</span>':'Întrebarea următoare <span>→</span>';
});

function openTab(name) {
  document.querySelectorAll('.tab').forEach(tab=>{
    const active=tab.dataset.tab===name;
    tab.classList.toggle('active',active);
    tab.setAttribute('aria-selected',String(active));
    tab.tabIndex=active?0:-1;
  });
  document.querySelectorAll('.tab-panel').forEach(panel=>{const active=panel.id===`panel-${name}`;panel.hidden=!active;panel.classList.toggle('active',active);});
  history.replaceState(null,'',`#${name}`);
  window.scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('[data-tab]').forEach(tab=>tab.addEventListener('click',()=>openTab(tab.dataset.tab)));
document.querySelectorAll('.next-tab').forEach(button=>button.addEventListener('click',()=>openTab(button.dataset.target)));
document.querySelectorAll('[data-open-tab]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();openTab(link.dataset.openTab);}));
document.querySelector('.tab-bar').addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
  const tabs=[...document.querySelectorAll('.tab')], current=tabs.findIndex(tab=>tab.classList.contains('active'));
  const next=(current+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  tabs[next].focus();openTab(tabs[next].dataset.tab);
});
$('themeButton').addEventListener('click',()=>document.body.classList.toggle('contrast'));

let last=performance.now(),lastDraw=0;
function animate(time){
  const dt=Math.min((time-last)/1000,.05);last=time;
  updateSimulation(dt);
  drawCoil();
  drawVoltageChart(time);
  if(time-lastDraw>33){drawHero(time);drawScope(time);lastDraw=time;}
  requestAnimationFrame(animate);
}
bindCircuit();renderQuestion();
const initialTab=location.hash.slice(1);
if(['fundamente','inductie','circuit','evaluare'].includes(initialTab))openTab(initialTab);
requestAnimationFrame(animate);
