'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const SYSTEMS=[
 {id:'base',name:'Structură și montaj',color:'#6f8498',move:[0,-.2,0]},
 {id:'motion',name:'Mecanism motor',color:'#e5a851',move:[0,0,1.6]},
 {id:'block',name:'Cilindri și chiulase',color:'#4fa8aa',move:[0,1.45,0]},
 {id:'valves',name:'Distribuție și injecție',color:'#d6b96e',move:[0,2.7,.3]},
 {id:'turbo',name:'Admisie și evacuare',color:'#b894d0',move:[0,.65,-2.0]},
 {id:'aux',name:'Ungere și răcire',color:'#5c9ed3',move:[0,.2,2.15]},
 {id:'generator',name:'Alternator',color:'#9baab9',move:[2.5,0,0]},
 {id:'safety',name:'Măsurare și comandă',color:'#ee985b',move:[.5,1.6,1.6]}
];
const PARTS=[
 ['bed','base','Șasiu comun','Susține motorul și alternatorul și păstrează poziția relativă a ansamblurilor.','Transmite eforturile către suporturi și fundație.','Șasiul este comun; fundația aparține structurii navei.'],
 ['mounts','base','Suporturi elastice','Reduc transmiterea vibrațiilor către structura navei în domeniul pentru care au fost proiectate.','Racordurile flexibile permit mișcarea relativă.','Un suport elastic nu elimină toate vibrațiile.'],
 ['case','base','Carter','Închide mecanismul motor și susține ansamblul în construcția reprezentată.','În secțiune se văd lagărele și arborele cotit.','Capacele de vizitare permit inspecția după oprire și izolare.'],
 ['sump','base','Baie de ulei','Colectează uleiul care revine din motor. Modelul folosește o soluție cu carter umed.','Uleiul este aspirat de pompa de ungere.','Sorbului trebuie să îi rămână disponibil ulei și la mișcările navei.'],
 ['crank','motion','Arbore cotit','Primește eforturile din biele și transmite cuplul către alternator.','Manetoanele transformă mișcarea alternativă în rotație.','Animația reprezintă un arbore idealizat cu șase manetoane.'],
 ['mainbear','motion','Lagăre principale','Susțin fusurile principale și transmit eforturile către structura motorului.','Pelicula de ulei separă suprafețele în mișcare.','Presiunea indicată corect nu garantează debit în toate ramurile.'],
 ['rods','motion','Biele','Leagă bolțul pistonului de maneton și transmit forța gazelor către arbore.','Mișcare plană cu capătul mare pe maneton.','Motorul cu piston portant nu are mecanism cu cap de cruce.'],
 ['pistons','motion','Pistoane și segmenți','Primesc presiunea gazelor; segmenții contribuie la etanșare și controlul peliculei de ulei.','Pistonul se deplasează în cămașa cilindrului.','Poziția este calculată din geometria bielă–manivelă.'],
 ['flywheel','motion','Volant','Stochează energie cinetică și reduce neuniformitatea rotației în interiorul ciclului.','Este montat la capătul arborelui motor.','Nu înlocuiește regulatorul la schimbarea sarcinii.'],
 ['liners','block','Cămăși de cilindru','Formează suprafețele de ghidare pentru pistoane și segmenți.','Sunt înconjurate de spații de răcire.','Secțiunea este o tăiere vizuală, nu o demontare reală.'],
 ['jacket','block','Cămașă de apă','Simbolizează spațiul de răcire din jurul cilindrilor.','Apa dulce tratată preia căldura motorului.','Apa de mare este separată de circuitul intern prin schimbător.'],
 ['cylblock','block','Bloc motor','Reunește cilindrii și asigură rigiditatea structurii.','Se sprijină pe structura inferioară a motorului.','Pozițiile și dimensiunile sunt didactice.'],
 ['heads','block','Chiulase','Închid camerele de ardere și susțin supapele și injectoarele.','Cuprind trasee de admisie, evacuare și răcire.','Etanșările sunt solicitate termic și mecanic.'],
 ['cam','valves','Arbore cu came','Comandă mișcarea supapelor prin mecanismul distribuției.','La motorul în patru timpi se rotește la jumătatea turației arborelui cotit.','Animația păstrează raportul de turație 1:2.'],
 ['camdrive','valves','Antrenarea distribuției','Transmite rotația de la arborele cotit către arborele cu came.','Perechea de roți simbolizează reducerea de turație.','Profilurile dinților și lanțul real de antrenare sunt simplificate.'],
 ['tappets','valves','Tacheți','Preiau mișcarea camei și o transmit către tijele împingătoare.','Acționează între camă și tijă.','Jocurile și contactele nu sunt simulate.'],
 ['pushrods','valves','Tije împingătoare și culbutori','Transmit mișcarea spre supapele montate în chiulasă.','Culbutorul schimbă direcția mișcării.','Distribuția este reprezentată funcțional.'],
 ['inlet','valves','Supape de admisie','Permit intrarea aerului în cilindru în timpul admisiei.','Închiderea lor permite comprimarea aerului.','Ferestrele de animație folosesc timpi ideali, fără avansuri.'],
 ['exhaustvalve','valves','Supape de evacuare','Permit evacuarea gazelor arse către colector.','Se deschid în intervalul idealizat al evacuării.','Sunt solicitate puternic de temperatura gazelor.'],
 ['injectors','valves','Injectoare','Dozează și pulverizează combustibilul în camera de ardere.','Sunt comandate în apropierea sfârșitului comprimării.','Impulsul luminos arată momentul didactic al injecției.'],
 ['airman','turbo','Colector de aer','Distribuie aerul de supraalimentare către cilindri.','Primește aer după compresor și răcitorul de aer.','Albastru: traseu de aer, nu circuit de apă.'],
 ['exman','turbo','Colector de evacuare','Colectează gazele din cilindri și le conduce către turbină.','Gazele furnizează energia pentru turbosuflantă.','Roșu brun: gaze fierbinți.'],
 ['turbo','turbo','Turbosuflantă','Turbina și compresorul sunt cuplate pe un arbore comun.','Recuperează energie din gazele de evacuare pentru comprimarea aerului.','Turația turbosuflantei nu este turația arborelui cotit.'],
 ['aircool','turbo','Răcitor de aer','Reduce temperatura aerului după comprimare și îi crește densitatea.','Este intercalat în traseul spre colectorul de admisie.','Circuitul agentului de răcire nu este calculat.'],
 ['oilpump','aux','Pompă de ungere','Asigură circulația uleiului spre punctele de ungere.','Aspiră din baie și livrează prin filtrare și răcire.','Preungerea poate avea o pompă separată.'],
 ['oilfilter','aux','Filtre de ulei','Rețin impuritățile din circuitul de ungere.','Sunt reprezentate două corpuri pentru identificare.','Dispunerea lor nu certifică o schemă duplex reală.'],
 ['oilcool','aux','Răcitor de ulei','Transferă căldura din ulei către agentul de răcire.','Se integrează în circuitul de ungere și în bilanțul termic.','Temperatura și presiunea se urmăresc separat.'],
 ['waterpump','aux','Pompă de apă dulce','Circulă agentul de răcire prin motor și schimbătoare.','Este conectată didactic la zona cilindrilor.','Pompa de apă de mare nu este reprezentată în acest model de grup.'],
 ['thermo','aux','Vană termostatică','Repartizează debitul între răcitor și by-pass pentru controlul temperaturii.','Completează pompa și schimbătorul de căldură.','Poziția vanei nu este simulată termohidraulic.'],
 ['stator','generator','Stator alternator','Poartă înfășurarea trifazată de putere și miezul magnetic.','Tensiunea este indusă de câmpul magnetic rotitor.','În această configurație puterea se culege din partea fixă.'],
 ['rotor','generator','Rotor alternator','Produce câmpul magnetic principal al mașinii sincrone.','Este antrenat de motor prin cuplaj.','Frecvența rezultă din turație și numărul de poli.'],
 ['genbear','generator','Lagăre alternator','Susțin rotorul și păstrează poziția lui față de stator.','Modelul arată o soluție cu două lagăre.','Există și alternatoare cu un singur lagăr propriu.'],
 ['exciter','generator','Excitatoare și diode rotitoare','Asigură alimentarea în curent continuu a rotorului principal fără perii.','AVR comandă câmpul fix al excitatoarei.','Mașina de excitație este simplificată geometric.'],
 ['avr','generator','Regulator AVR','Compară tensiunea măsurată cu referința și modifică excitația.','Influențează în principal tensiunea și repartizarea puterii reactive.','AVR nu comandă alimentarea cu combustibil a motorului.'],
 ['terminal','generator','Cutie de borne','Adăpostește conexiunile electrice de putere ale alternatorului.','Cablurile merg spre întreruptorul de generator.','Tabloul principal și protecțiile externe nu sunt modelate aici.'],
 ['coupling','generator','Cuplaj elastic','Transmite cuplul de la motor la alternator și admite dezalinieri limitate.','Leagă arborii celor două mașini.','Nu corectează o aliniere necorespunzătoare.'],
 ['speed','safety','Traductor de turație MPU','Detectează trecerea dinților unei roți feromagnetice.','Frecvența impulsurilor este proporțională cu turația roții.','Nu se confundă cu frecvența electrică de la borne.'],
 ['temp','safety','Senzori de temperatură','Supraveghează temperaturi relevante pentru motor.','Sunt reprezentați în apropierea chiulaselor.','Modelul nu furnizează temperaturi măsurate.'],
 ['mist','safety','Detector de ceață de ulei','Urmărește apariția ceții de ulei în carter ca posibil indiciu de supraîncălzire.','Comunică o alarmă către sistemul de supraveghere.','Alarma nu stabilește singură cauza defectului.'],
 ['shutdown','safety','Oprire de urgență','Solicită oprirea prin lanțul de comandă și protecție prevăzut.','Butonul este un element de siguranță al ansamblului.','În aplicație doar oprește animația.']
].map(([id,system,name,description,connection,note])=>({id,system,name,description,connection,note}));
const byId=Object.fromEntries(PARTS.map(p=>[p.id,p]));
const state={system:'all',selected:null,cut:true,ghost:false,explode:0,play:false,speed:1,labels:false,isolated:false,auto:false,tour:-1};
const stage=$('#stage');
let renderer;
try {renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});}catch(e){renderer=new TeachingCanvasRenderer();$('#renderer-note').textContent='Afișare compatibilă Canvas';}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor('#101f2d');renderer.localClippingEnabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace;stage.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.fog=new THREE.Fog('#101f2d',24,65);
const camera=new THREE.PerspectiveCamera(37,1,.1,100);const target=new THREE.Vector3(0,2,0);
let yaw=.7,pitch=.47,distance=15.8;
const model=new THREE.Group();scene.add(model);
const light=new THREE.HemisphereLight('#dceeff','#3b4a50',2.5);scene.add(light);
const key=new THREE.DirectionalLight('#ffffff',3.0);key.position.set(3,9,6);scene.add(key);
const fill=new THREE.DirectionalLight('#8cbde8',1.9);fill.position.set(-5,3,-7);scene.add(fill);
const grid=new THREE.GridHelper(30,30,'#294251','#203443');grid.position.y=-.08;scene.add(grid);
const plate=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#132432',roughness:1}));plate.rotation.x=-Math.PI/2;plate.position.y=-.1;scene.add(plate);
const clipping=new THREE.Plane(new THREE.Vector3(0,0,-1),0);
const groups={},meshes=[],animations={pistons:[],rods:[],cranks:[],valves:[],cams:[],injectors:[]};
const systemRoots={};SYSTEMS.forEach(s=>{const g=new THREE.Group();g.userData.system=s.id;systemRoots[s.id]=g;model.add(g);});
PARTS.forEach(p=>{const g=new THREE.Group();g.userData.part=p.id;systemRoots[p.system].add(g);groups[p.id]=g;});
const C={body:'#378a86',block:'#317b7c',head:'#52a6a2',metal:'#c0cbd1',steel:'#6d8794',dark:'#243d4c',oil:'#daa54d',water:'#438cc7',exhaust:'#aa645c',air:'#78a8c9',copper:'#b48b55',red:'#db6357'};
function mesh(id,geo,pos,color,rot,shell=false){
 const mat=new THREE.MeshStandardMaterial({color,roughness:.38,metalness:.48,side:THREE.DoubleSide});
 const m=new THREE.Mesh(geo,mat);m.position.set(...pos);if(rot)m.rotation.set(...rot);m.userData={part:id,shell,original:color};groups[id].add(m);meshes.push(m);return m;
}
function box(id,size,pos,color=C.body,shell=false){return mesh(id,new THREE.BoxGeometry(...size),pos,color,null,shell);}
function cyl(id,r,len,pos,color=C.metal,axis='y',shell=false,r2=r){return mesh(id,new THREE.CylinderGeometry(r,r2,len,40),pos,color,axis==='x'?[0,0,Math.PI/2]:axis==='z'?[Math.PI/2,0,0]:null,shell);}
function tube(id,points,r,color){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return mesh(id,new THREE.TubeGeometry(curve,32,r,10,false),[0,0,0],color);}
function rodBetween(id,a,b,r,color){const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),d=B.clone().sub(A);const m=mesh(id,new THREE.CylinderGeometry(r,r,d.length(),12),A.clone().add(B).multiplyScalar(.5).toArray(),color);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;}
const xs=[-3.35,-2.43,-1.51,-.59,.33,1.25];
box('bed',[9.5,.3,2.6],[0,.38,0],C.dark);
for(const x of [-4,-2,0,2,4])for(const z of [-.95,.95]){box('mounts',[.55,.23,.5],[x,.12,z],'#d5a44b');cyl('mounts',.065,.38,[x,.2,z],C.metal);}
box('sump',[5.6,.36,1.55],[-1.08,.67,0],C.dark,true);
box('case',[5.85,1.1,1.65],[-1.08,1.25,0],C.body,true);
for(const x of xs){box('case',[.62,.63,.08],[x,1.3,.87],C.head,true);for(const dx of [-.22,.22])for(const y of [1.06,1.52])cyl('case',.035,.045,[x+dx,y,.94],C.metal,'z',true);}
box('cylblock',[5.85,.83,1.47],[-1.08,2.14,0],C.block,true);
for(const [i,x] of xs.entries()){
 cyl('liners',.344,1.28,[x,2.33,0],C.steel,'y',true);
 cyl('jacket',.41,1.17,[x,2.34,0],C.water,'y',true);
 box('heads',[.79,.34,1.12],[x,3.04,0],C.head,true);
 // Individual rocker covers
 box('heads',[.72,.18,.7],[x,3.31,0],C.dark,true);
 const piston=new THREE.Group();groups.pistons.add(piston);const pm=mesh('pistons',new THREE.CylinderGeometry(.308,.308,.37,32),[0,0,0],C.metal);groups.pistons.remove(pm);piston.add(pm);
 for(const yy of [.08,.12]){const ring=new THREE.Mesh(new THREE.TorusGeometry(.31,.015,8,36),new THREE.MeshStandardMaterial({color:C.dark}));ring.rotation.x=Math.PI/2;ring.position.y=yy;ring.userData.part='pistons';piston.add(ring);meshes.push(ring);}
 animations.pistons.push(piston);
 const rm=mesh('rods',new THREE.CylinderGeometry(.073,.073,1,12),[x,1.7,0],C.copper);animations.rods.push(rm);
 cyl('mainbear',.18,.15,[x-.43,1.13,0],C.oil,'x');
 const cg=new THREE.Group();cg.position.set(x,1.13,0);groups.crank.add(cg);
 const shaft=mesh('crank',new THREE.CylinderGeometry(.11,.11,.83,20),[0,0,0],C.metal,[0,0,Math.PI/2]);groups.crank.remove(shaft);cg.add(shaft);
 for(const dx of [-.19,.19]){const web=new THREE.Mesh(new THREE.BoxGeometry(.12,.56,.18),new THREE.MeshStandardMaterial({color:C.steel,metalness:.6,roughness:.4}));web.position.set(dx,.22,0);web.userData.part='crank';cg.add(web);meshes.push(web);}
 const pin=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.47,20),new THREE.MeshStandardMaterial({color:C.metal}));pin.rotation.z=Math.PI/2;pin.position.y=.43;pin.userData.part='crank';cg.add(pin);meshes.push(pin);animations.cranks.push(cg);
 for(const [type,z] of [['inlet',.2],['exhaustvalve',-.2]]){
  const vg=new THREE.Group();vg.position.set(x,3.1,z);groups[type].add(vg);
  const stem=mesh(type,new THREE.CylinderGeometry(.026,.026,.55,12),[0,.1,0],C.metal);groups[type].remove(stem);vg.add(stem);
  const disk=mesh(type,new THREE.CylinderGeometry(.13,.13,.04,24),[0,-.2,0],type==='inlet'?C.air:C.exhaust);groups[type].remove(disk);vg.add(disk);
  animations.valves.push({g:vg,i,type});
  rodBetween('pushrods',[x,1.65,z+.56],[x,3.4,z+.56],.025,C.metal);
  box('pushrods',[.09,.06,.58],[x,3.44,z+.28],C.copper);
  cyl('tappets',.058,.15,[x,1.73,z+.56],C.oil);
 }
 const inj=cyl('injectors',.052,.56,[x,3.42,0],C.oil);animations.injectors.push(inj);
 tube('injectors',[[x,3.6,0],[x+.12,3.7,.15],[x+.12,3.7,.65]],.021,C.metal);
 const cam=cyl('cam',.10,.09,[x,1.56,.78],C.oil,'x');animations.cams.push(cam);
 cyl('temp',.035,.2,[x,3.22,-.51],C.red);
}
cyl('crank',.12,5.75,[-1.08,1.13,0],C.metal,'x');
cyl('cam',.055,5.8,[-1.1,1.56,.78],C.steel,'x');
cyl('camdrive',.25,.12,[-4.02,1.13,.25],C.copper,'x');cyl('camdrive',.5,.12,[-4.02,1.64,.25],C.copper,'x');
const fly=cyl('flywheel',.65,.24,[1.93,1.13,0],C.dark,'x');
for(let j=0;j<24;j++){const t=j/24*Math.PI*2;box('flywheel',[.28,.045,.045],[1.93,1.13+.66*Math.cos(t),.66*Math.sin(t)],C.metal);}
cyl('coupling',.32,.45,[2.3,1.48,0],C.oil,'x');
// Electrical machine: stator shell with bore and internal rotor
const gs=mesh('stator',new THREE.CylinderGeometry(.93,.93,2.1,64,1,true),[3.64,1.48,0],C.steel,[0,0,Math.PI/2],true);
for(const x of [2.64,4.64]){cyl('genbear',.2,.13,[x,1.48,0],C.oil,'x');box('stator',[.3,.38,1.25],[x,.8,0],C.steel,true);}
for(let k=0;k<30;k++){const a=k/30*Math.PI*2;const coil=box('stator',[1.83,.09,.11],[3.64,1.48+.81*Math.cos(a),.81*Math.sin(a)],C.copper,true);coil.rotation.x=a;}
const rot=cyl('rotor',.49,1.8,[3.64,1.48,0],C.metal,'x');
for(let k=0;k<8;k++){const a=k/8*Math.PI*2;const pole=box('rotor',[1.55,.13,.26],[3.64,1.48+.53*Math.cos(a),.53*Math.sin(a)],k%2?C.copper:C.dark);pole.rotation.x=a;}
cyl('rotor',.12,2.8,[3.64,1.48,0],C.metal,'x');cyl('exciter',.48,.28,[4.93,1.48,0],C.copper,'x');
box('terminal',[.65,.46,.72],[3.42,2.6,-.18],C.steel);for(let j=0;j<3;j++)cyl('terminal',.045,.13,[3.24+j*.17,2.88,-.18],C.oil);
box('avr',[.6,.45,.16],[4.26,1.9,1],C.dark);box('avr',[.36,.17,.035],[4.26,1.94,1.1],C.water);
// Air and exhaust manifolds
for(const x of xs){tube('airman',[[x,2.98,.3],[x,2.82,.9],[x,2.72,1.1]],.075,C.air);tube('exman',[[x,3.03,-.3],[x,3.23,-.9],[x,3.55,-1.02]],.07,C.exhaust);}
cyl('airman',.17,5.6,[-1.12,2.72,1.1],C.air,'x');cyl('exman',.15,5.6,[-1.12,3.55,-1.02],C.exhaust,'x');
for(const [x,c] of [[-4.1,C.exhaust],[-4.53,C.air]]){cyl('turbo',.4,.32,[x,3.6,-.75],c,'x');cyl('turbo',.22,.2,[x,3.6,-.75],C.dark,'x');}
cyl('turbo',.085,.75,[-4.3,3.6,-.75],C.metal,'x');
tube('exman',[[-3.9,3.55,-1.02],[-4,3.65,-1.02],[-4.1,3.8,-.8]],.13,C.exhaust);
tube('turbo',[[-4.52,3.6,-.65],[-4.68,3.7,.4],[-4.4,3.0,1.2]],.14,C.air);
box('aircool',[.6,.9,.75],[-4.2,2.7,1.1],C.air);for(let k=0;k<6;k++)box('aircool',[.65,.045,.8],[-4.2,2.37+k*.12,1.1],C.metal);
// Local auxiliaries, shown as simplified attached assemblies
cyl('oilpump',.2,.28,[-3.65,1.03,1.1],C.oil,'z');box('oilpump',[.5,.32,.28],[-3.65,.9,1.1],C.oil);
for(const x of [-2.9,-2.53])cyl('oilfilter',.14,.55,[x,1.15,1.16],C.oil);
box('oilcool',[.72,.45,.4],[-1.75,1.02,1.17],C.oil);
cyl('waterpump',.22,.3,[-.84,1.07,1.2],C.water,'z');cyl('thermo',.13,.28,[-.2,1.65,1.15],C.water);
tube('waterpump',[[-.84,1.1,1.2],[-.84,1.7,1.2],[-.2,1.7,1.15],[.3,2.2,.65]],.055,C.water);
tube('oilpump',[[-3.65,1,1.1],[-3.4,1.1,1.3],[-2.7,1.05,1.3],[-1.7,1.05,1.3]],.045,C.oil);
// Monitoring
cyl('speed',.05,.28,[1.9,1.93,.44],C.red,'y');box('mist',[.35,.3,.18],[-2,1.55,.99],C.dark);
box('shutdown',[.36,.4,.18],[.8,1.5,1.03],C.oil);cyl('shutdown',.1,.09,[.8,1.52,1.16],C.red,'z');
// Fasteners improve scale and readability
for(const x of xs)for(const z of [-.4,.4])cyl('heads',.044,.11,[x+.28,3.23,z],C.metal,'y',true);

const spinGroups=[];
for(const [id,center] of [['rotor',[3.64,1.48,0]],['flywheel',[1.93,1.13,0]],['exciter',[4.93,1.48,0]]]){
 const pivot=new THREE.Group();pivot.position.set(...center);const children=[...groups[id].children];groups[id].add(pivot);children.forEach(m=>{m.position.sub(pivot.position);pivot.add(m);});spinGroups.push(pivot);
}
let phase=0,last=performance.now();const crankPhases=[0,480,240,600,120,360].map(n=>n*Math.PI/180);
function animateMechanics(){
 const r=.43,L=1.18,y0=1.13;
 spinGroups.forEach(g=>g.rotation.x=phase);
 xs.forEach((x,i)=>{
  const a=phase+crankPhases[i], yy=y0+r*Math.cos(a),zz=r*Math.sin(a),py=yy+Math.sqrt(L*L-zz*zz);
  animations.pistons[i].position.set(x,py,0);
  const A=new THREE.Vector3(x,yy,zz),B=new THREE.Vector3(x,py,0),dir=B.clone().sub(A);
  animations.rods[i].position.copy(A.add(B).multiplyScalar(.5));animations.rods[i].scale.y=dir.length();animations.rods[i].quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());
  animations.cranks[i].rotation.x=a;
  const c=((a%(Math.PI*4))+Math.PI*4)%(Math.PI*4);
  animations.injectors[i].material.emissive.set(c>Math.PI*1.9&&c<Math.PI*2.13?'#f89b36':'#000000');
 });
 animations.valves.forEach(v=>{const a=((phase+crankPhases[v.i])%(Math.PI*4)+Math.PI*4)%(Math.PI*4);const active=v.type==='inlet'?a<Math.PI:a>3*Math.PI;const lift=active?.1*Math.sin(a%Math.PI):0;v.g.position.y=3.1-lift;});
 animations.cams.forEach(c=>c.rotation.x=phase/2);
}
let cachedBounds={};PARTS.forEach(p=>{cachedBounds[p.id]=new THREE.Box3().setFromObject(groups[p.id]).getCenter(new THREE.Vector3());});
function materialState(){
 meshes.forEach(m=>{
  const id=m.userData.part,chosen=id===state.selected,hiddenBySystem=state.isolated&&(state.selected?id!==state.selected:state.system!=='all'&&byId[id].system!==state.system);
  m.visible=!hiddenBySystem;
  if(m.material){m.material.clippingPlanes=m.userData.shell&&state.cut?[clipping]:[];m.material.transparent=!!(m.userData.shell&&state.ghost);m.material.opacity=m.userData.shell&&state.ghost?.16:1;m.material.depthWrite=!(m.userData.shell&&state.ghost);if(m.material.emissive&&id!=='injectors')m.material.emissive.set(chosen?'#6e3510':'#000000');}
 });
 PARTS.forEach(p=>{groups[p.id].visible=!hiddenParts.has(p.id)&&(!state.isolated||(state.selected?p.id===state.selected:state.system==='all'||p.system===state.system));});
 $('#cut').setAttribute('aria-pressed',state.cut);$('#ghost').setAttribute('aria-pressed',state.ghost);$('#isolate').setAttribute('aria-pressed',state.isolated);$('#labels').setAttribute('aria-pressed',state.labels);$('#play').setAttribute('aria-pressed',state.play);$('#play').textContent=state.play?'Ⅱ Pauză':'▶ Animare';
 $('#view-badge').textContent=state.isolated?'VEDERE IZOLATĂ':state.cut?'SECȚIUNE DIDACTICĂ':'ANSAMBLU COMPLET';
}
const hiddenParts=new Set();
function select(id){$('#search').value='';state.selected=id;if(id)state.system=byId[id].system;renderNav();renderDetail();materialState();}
function renderNav(){
 $('#systems').innerHTML=`<button class="system ${state.system==='all'?'active':''}" data-system="all"><span class="dot" style="--c:#a8b7c4"></span>Toate sistemele <b>${PARTS.length}</b></button>`+SYSTEMS.map(s=>`<button class="system ${state.system===s.id?'active':''}" data-system="${s.id}"><span class="dot" style="--c:${s.color}"></span>${s.name}<b>${PARTS.filter(p=>p.system===s.id).length}</b></button>`).join('');
 const normal=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const q=normal($('#search').value);const filtered=PARTS.filter(p=>(state.system==='all'||p.system===state.system)&&normal(p.name).includes(q));
 $('#component-count').textContent=filtered.length;
 $('#parts').innerHTML=filtered.map(p=>`<div class="part-row ${state.selected===p.id?'selected':''}"><button class="part" data-part="${p.id}"><span>${p.name}</span><span class="chevron">›</span></button><button class="eye" aria-label="${hiddenParts.has(p.id)?'Arată':'Ascunde'} ${p.name}" data-hide="${p.id}">${hiddenParts.has(p.id)?'○':'◉'}</button></div>`).join('')||'<p class="empty">Nicio componentă găsită.</p>';
 $('#systems').querySelectorAll('button').forEach(b=>b.onclick=()=>{state.system=b.dataset.system;state.selected=null;renderNav();renderDetail();materialState();});
 $('#parts').querySelectorAll('[data-part]').forEach(b=>b.onclick=()=>select(b.dataset.part));
 $('#parts').querySelectorAll('[data-hide]').forEach(b=>b.onclick=()=>{const id=b.dataset.hide;hiddenParts.has(id)?hiddenParts.delete(id):hiddenParts.add(id);renderNav();materialState();});
}
function renderDetail(){
 const p=byId[state.selected],s=SYSTEMS.find(x=>x.id===(p?p.system:state.system));
 $('#info-category').textContent=s?s.name:'GHID DE EXPLORARE';$('#info-title').textContent=p?p.name:'Un grup. Opt sisteme.';
 $('#description').textContent=p?p.description:'Explorează un diesel generator naval în șase cilindri. Alege o piesă direct din model sau din lista componentelor.';
 $('#connection').textContent=p?p.connection:'Începe cu mecanismul motor, apoi urmărește distribuția, auxiliarele și alternatorul.';
 $('#note').textContent=p?p.note:'Model geometric propriu, simplificat pentru studiu. Nu reprezintă un produs comercial sau un desen de execuție.';
 $('#focus').disabled=!p;$('#selection-status').textContent=p?'COMPONENTĂ SELECTATĂ':'VIZUALIZATOR 3D';
}
function focusPart(){if(!state.selected)return;const p=byId[state.selected],root=systemRoots[p.system];const center=new THREE.Box3().setFromObject(groups[p.id]).getCenter(new THREE.Vector3());target.copy(center);distance=Math.max(3.0,Math.min(8,new THREE.Box3().setFromObject(groups[p.id]).getSize(new THREE.Vector3()).length()*1.5));}
function reset(){$('#search').value='';state.system='all';state.selected=null;state.isolated=false;state.ghost=false;state.cut=true;state.explode=0;state.play=false;state.auto=false;state.labels=false;hiddenParts.clear();$('#explode').value=0;$('#explode-value').textContent='0%';$('#auto').setAttribute('aria-pressed',false);yaw=.7;pitch=.47;distance=15.8;target.set(0,2,0);state.tour=-1;$('#tour-card').hidden=true;renderNav();renderDetail();materialState();}
$('#search').oninput=()=>{if($('#search').value)state.system='all';renderNav();};
['cut','ghost','isolate','labels'].forEach(id=>$('#'+id).onclick=()=>{state[id==='isolate'?'isolated':id]=!state[id==='isolate'?'isolated':id];materialState();});
$('#play').onclick=()=>{state.play=!state.play;materialState();};$('#focus').onclick=focusPart;$('#reset').onclick=reset;
$('#explode').oninput=e=>{state.explode=Number(e.target.value)/100;$('#explode-value').textContent=e.target.value+'%';distance=15.8+state.explode*6;target.set(state.explode*.6,2+state.explode*1.1,0);};
$('#speed').oninput=e=>{state.speed=Number(e.target.value);$('#speed-value').textContent=state.speed.toFixed(1)+'×';};
$('#auto').onclick=()=>{state.auto=!state.auto;$('#auto').setAttribute('aria-pressed',state.auto);};
$$('[data-view]').forEach(b=>b.onclick=()=>{const v=b.dataset.view;if(v==='iso'){yaw=.7;pitch=.47;}if(v==='front'){yaw=0;pitch=.02;}if(v==='side'){yaw=Math.PI/2;pitch=.05;}if(v==='top'){yaw=.01;pitch=1.47;}distance=15.8;target.set(0,2,0);});
$('#clear').onclick=()=>{$('#search').value='';state.selected=null;state.system='all';state.isolated=false;renderNav();renderDetail();materialState();};
$('#fullscreen').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen?.();};
$('#capture').onclick=()=>{renderer.render(scene,camera);const a=document.createElement('a');a.download='Diesel_generator_naval.png';a.href=renderer.domElement.toDataURL('image/png');a.click();};
$('#about').onclick=()=>$('#about-dialog').showModal();$('#close-about').onclick=()=>$('#about-dialog').close();
$('#shutdown-action').onclick=()=>{state.play=false;materialState();select('shutdown');};
// Guided study changes the same visible scene rather than playing a canned video.
const tour=[['Structura comună','bed','Observă legătura dintre motor, cuplaj și alternator. Șasiul comun se sprijină pe suporturi elastice.'],['Transformarea mișcării','pistons','Activează animația. Pistonul se deplasează alternativ, biela transmite efortul, iar arborele cotit se rotește.'],['Distribuția','cam','Arborele cu came comandă supapele și se rotește de două ori mai lent decât arborele cotit.'],['Aerul și gazele','turbo','Identifică turbina, compresorul, răcitorul de aer și cele două colectoare.'],['Auxiliarele','waterpump','Pompa de apă și circuitul de ungere mențin condițiile de funcționare ale motorului.'],['Conversia electrică','rotor','Rotorul se rotește în stator. Cuplajul transmite puterea mecanică, iar AVR comandă excitația.']];
function tourStep(i){$('#search').value='';state.tour=(i+tour.length)%tour.length;const t=tour[state.tour];state.isolated=false;state.explode=0;$('#explode').value=0;$('#explode-value').textContent='0%';state.cut=true;state.play=state.tour===1||state.tour===2;select(t[1]);$('#tour-card').hidden=false;$('#tour-title').textContent=t[0];$('#tour-text').textContent=t[2];$('#tour-index').textContent=(state.tour+1)+' / '+tour.length;}
$('#tour').onclick=()=>tourStep(0);$('#tour-next').onclick=()=>tourStep(state.tour+1);$('#tour-prev').onclick=()=>tourStep(state.tour-1);$('#tour-close').onclick=()=>{$('#tour-card').hidden=true;state.tour=-1;};
// Orbit / zoom / pan. No external controls or remote assets.
let drag=null;
renderer.domElement.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,button:e.button,pan:e.shiftKey};renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(drag.button===2||drag.pan){target.x-=dx*.006*distance/12;target.y+=dy*.006*distance/12;}else{yaw-=dx*.006;pitch=Math.max(-.15,Math.min(1.48,pitch+dy*.006));}drag.x=e.clientX;drag.y=e.clientY;});
const ray=new THREE.Raycaster();const mouse=new THREE.Vector2();
renderer.domElement.addEventListener('pointerup',e=>{if(drag&&Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)<5&&drag.button===0){const rect=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(mouse,camera);const hits=ray.intersectObjects(meshes,false).filter(h=>{let obj=h.object;while(obj){if(!obj.visible)return false;obj=obj.parent;}return !(state.cut&&h.object.userData.shell&&h.point.z>0);});if(hits[0])select(hits[0].object.userData.part);}drag=null;});
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(2.5,Math.min(35,distance*Math.exp(e.deltaY*.001)));},{passive:false});
const pointers=new Map();let pinch=0;renderer.domElement.addEventListener('pointerdown',e=>{pointers.set(e.pointerId,[e.clientX,e.clientY]);});renderer.domElement.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,[e.clientX,e.clientY]);if(pointers.size===2){const v=[...pointers.values()],d=Math.hypot(v[0][0]-v[1][0],v[0][1]-v[1][1]);if(pinch)distance=Math.max(2.5,Math.min(35,distance*pinch/d));pinch=d;drag=null;}});['pointerup','pointercancel'].forEach(type=>renderer.domElement.addEventListener(type,e=>{pointers.delete(e.pointerId);pinch=0;drag=null;}));
window.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName))return;if(e.key==='r'||e.key==='R')reset();if(e.key==='Escape')select(null);if(e.key==='ArrowLeft')yaw+=.12;if(e.key==='ArrowRight')yaw-=.12;if(e.key==='ArrowUp')pitch=Math.min(1.48,pitch+.1);if(e.key==='ArrowDown')pitch=Math.max(-.15,pitch-.1);if(e.key==='+')distance=Math.max(2.5,distance*.9);if(e.key==='-')distance=Math.min(35,distance*1.1);});
function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}new ResizeObserver(resize).observe(stage);
const labelCenters={base:[-1,.5,0],motion:[-1,1.3,0],block:[-1,2.7,0],valves:[-1,3.6,0],turbo:[-4.4,3.6,-.7],aux:[-1.8,1.2,1.4],generator:[3.8,1.5,0],safety:[.8,1.5,1.2]};
SYSTEMS.forEach(s=>{const b=document.createElement('button');b.className='model-label';b.textContent=s.name;b.style.setProperty('--c',s.color);b.dataset.system=s.id;b.onclick=()=>{state.system=s.id;state.selected=null;renderNav();renderDetail();materialState();};$('#model-labels').append(b);});
let lastDraw=0;
function frame(now){requestAnimationFrame(frame);if(renderer.isSoftware&&now-lastDraw<85)return;lastDraw=now;const dt=Math.min((now-last)/1000,.06);last=now;if(state.play)phase+=dt*1.25*state.speed;if(state.auto&&!drag)yaw+=dt*.12;animateMechanics();
 SYSTEMS.forEach(s=>systemRoots[s.id].position.set(...s.move.map((v,i)=>v*state.explode+(i===1&&!['base','generator'].includes(s.id)?.35:0))));
 camera.position.set(target.x+distance*Math.sin(yaw)*Math.cos(pitch),target.y+distance*Math.sin(pitch),target.z+distance*Math.cos(yaw)*Math.cos(pitch));camera.lookAt(target);
 $$('.model-label').forEach(b=>{const id=b.dataset.system,g=systemRoots[id],v=new THREE.Vector3(...labelCenters[id]).add(g.position).project(camera);b.hidden=!state.labels||v.z>1;b.style.left=(v.x*.5+.5)*stage.clientWidth+'px';b.style.top=(-v.y*.5+.5)*stage.clientHeight+'px';});
 $('#animation-badge').textContent=state.play?'● ANIMAȚIE RALENTITĂ':'● MODEL STATIC';renderer.render(scene,camera);
}
renderNav();renderDetail();materialState();resize();animateMechanics();requestAnimationFrame(frame);
// Expose a small read-only diagnostic snapshot through the DOM for local troubleshooting.
$('#model-meta').textContent=`${PARTS.length} componente · ${SYSTEMS.length} sisteme · model geometric propriu`;
