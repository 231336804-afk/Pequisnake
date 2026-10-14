
const http=require("http"),fs=require("fs"),path=require("path"),crypto=require("crypto"),WebSocket=require("ws");
const PORT=process.env.PORT||8080,WORLD=4200,SERVER_FPS=16,SNAPSHOT_FPS=8,FOOD_TARGET=220,BOT_TARGET=100,MAX_FOOD_PACKET=160;
const rooms=new Map(),rand=(a,b)=>a+Math.random()*(b-a),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function wrap(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a}
function cleanRoom(v){return String(v||"FAMILIA").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,10)||"FAMILIA"}
function cleanName(v){return String(v||"Jugador").replace(/[<>]/g,"").trim().slice(0,18)||"Jugador"}
function cleanColor(v){return /^#[0-9a-fA-F]{6}$/.test(String(v))?String(v):"#7cf29c"}
function food(x=rand(50,WORLD-50),y=rand(50,WORLD-50),value=rand(.8,2.2)){return{x,y,value,r:3+value*1.4,h:Math.floor(rand(0,360))}}
function botColor(){const p=["#ff6b6b","#4dabf7","#ffd43b","#69db7c","#b197fc","#ffa94d","#f783ac","#63e6be"];return p[Math.floor(Math.random()*p.length)]}
function botName(){
 const names=[
  "Leo","Mia","Axel","Luna","Nico","Zoe","Max","Emma","Ian","Sofi",
  "Dani","Noa","Alex","Gael","Iker","Nora","Milo","Sara","Teo","Vera",
  "Mateo","Valen","Lucas","Alma","Bruno","Aitana","Diego","Renata","Hugo","Mara",
  "Thiago","Olivia","Enzo","Elena","Dylan","Julia","Adri","Cami","Pablo","Ines",
  "Rafa","Lia","Marco","Nina","Tomas","Eva","Santi","Maya","Alan","Clara",
  "Beto","Lola","Gabi","Ari","Javi","Nahi","Romi","Mati","Fede","Isa",
  "Kira","Liam","Sam","Vale","Emi","Tadeo","Luca","Nerea","Dario","Iris"
 ];
 const tags=["","X","Pro","MX","77","21","GG","YT","Neo","Max"];
 const base=names[Math.floor(Math.random()*names.length)];
 const tag=Math.random()<0.28?tags[Math.floor(Math.random()*tags.length)]:"";
 return (base+tag).slice(0,18);
}
function makeSnake(id,name,color,isBot=false){
 const x=rand(500,WORLD-500),y=rand(500,WORLD-500),angle=rand(-Math.PI,Math.PI);
 const s={id,name,color,x,y,angle,targetAngle:angle,radius:11,baseSpeed:isBot?rand(2.65,2.95):3.1,boost:false,targetLength:isBot?rand(70,140):90,alive:true,points:[],isBot,aiTimer:0,score:0};
 for(let i=0;i<Math.max(8,Math.floor(s.targetLength/6));i++)s.points.push({x:x-Math.cos(angle)*i*6,y:y-Math.sin(angle)*i*6});
 return s;
}
function makeRoom(code){const r={code,players:new Map(),foods:[],botSeq:0};for(let i=0;i<FOOD_TARGET;i++)r.foods.push(food());rooms.set(code,r);ensureBots(r);return r}
function room(code){return rooms.get(code)||makeRoom(code)}
function ensureBots(r){let n=[...r.players.values()].filter(p=>p.isBot).length;for(;n<BOT_TARGET;n++){const id="bot-"+r.code+"-"+(++r.botSeq);r.players.set(id,makeSnake(id,botName(),botColor(),true))}}
function kill(r,p){if(!p.alive)return;p.alive=false;p.boost=false;for(let i=0;i<p.points.length;i+=3){const q=p.points[i];r.foods.push(food(q.x+rand(-10,10),q.y+rand(-10,10),rand(1.1,2.8)))}if(p.isBot)setTimeout(()=>{const rr=rooms.get(r.code);if(rr)rr.players.set(p.id,makeSnake(p.id,p.name,p.color,true))},700)}
function botAI(r,p,dt){
 p.aiTimer-=dt;if(p.aiTimer>0)return;p.aiTimer=rand(.18,.5);
 let t=null,b=Infinity;for(const f of r.foods){const dx=f.x-p.x,dy=f.y-p.y,d=dx*dx+dy*dy;if(d<b){b=d;t=f}}
 if(t)p.targetAngle=Math.atan2(t.y-p.y,t.x-p.x);
 if(p.x<260)p.targetAngle=0;else if(p.x>WORLD-260)p.targetAngle=Math.PI;
 if(p.y<260)p.targetAngle=Math.PI/2;else if(p.y>WORLD-260)p.targetAngle=-Math.PI/2;
 for(const o of r.players.values()){if(o===p||!o.alive)continue;const dx=o.x-p.x,dy=o.y-p.y;if(dx*dx+dy*dy<180*180){p.targetAngle=Math.atan2(p.y-o.y,p.x-o.x)+rand(-.35,.35);break}}
 p.targetAngle+=rand(-.16,.16);p.boost=Math.random()<.04&&p.targetLength>80;
}
function step(r,p,dt){
 if(!p.alive)return;if(p.isBot)botAI(r,p,dt);
 p.angle+=clamp(wrap(p.targetAngle-p.angle),-.08,.08);
 const boosting=p.boost&&p.targetLength>55,sp=p.baseSpeed*(boosting?1.6:1);
 p.x+=Math.cos(p.angle)*sp;p.y+=Math.sin(p.angle)*sp;if(boosting)p.targetLength=Math.max(50,p.targetLength-.04);
 if(p.x<=24||p.x>=WORLD-24||p.y<=24||p.y>=WORLD-24){kill(r,p);return}
 const desired=Math.max(8,Math.floor(p.targetLength/6));p.points[0].x=p.x;p.points[0].y=p.y;
 while(p.points.length<desired){const q=p.points[p.points.length-1];p.points.push({x:q.x,y:q.y})}
 if(p.points.length>desired)p.points.length=desired;
 for(let i=1;i<p.points.length;i++){const a=p.points[i-1],b=p.points[i],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||.0001;b.x=a.x+dx/d*6;b.y=a.y+dy/d*6}
 for(let i=r.foods.length-1;i>=0;i--){const f=r.foods[i],dx=f.x-p.x,dy=f.y-p.y,rr=p.radius+f.r+3;if(dx*dx+dy*dy<rr*rr){p.targetLength+=f.value*5.2;p.score+=Math.round(f.value*10);r.foods.splice(i,1);r.foods.push(food())}}
}
function collide(r){const a=[...r.players.values()].filter(p=>p.alive);for(const p of a){for(const o of a){if(p===o)continue;for(let i=5;i<o.points.length;i+=3){const q=o.points[i],dx=p.x-q.x,dy=p.y-q.y,rr=p.radius+o.radius*.68;if(dx*dx+dy*dy<rr*rr){kill(r,p);break}}if(!p.alive)break}}}
function packet(r,id){
 const focus=r.players.get(id),foods=[];for(const f of r.foods){if(!focus||((f.x-focus.x)**2+(f.y-focus.y)**2<1300**2)){foods.push([Math.round(f.x),Math.round(f.y),+f.r.toFixed(1),f.h]);if(foods.length>=MAX_FOOD_PACKET)break}}
 const ranking=[...r.players.values()].filter(p=>p.alive).sort((a,b)=>b.score-a.score||b.targetLength-a.targetLength).slice(0,10).map(p=>({id:p.id,name:p.name,score:p.score,isBot:p.isBot}));
 return{t:"state",room:r.code,world:WORLD,foods,ranking,players:[...r.players.values()]
 .filter(p=>!focus || p.id===id || ((p.x-focus.x)**2+(p.y-focus.y)**2<1500**2))
 .map(p=>({id:p.id,name:p.name,color:p.color,x:+p.x.toFixed(1),y:+p.y.toFixed(1),angle:+p.angle.toFixed(3),radius:p.radius,length:+p.targetLength.toFixed(1),score:p.score,alive:p.alive,isBot:p.isBot,points:p.points.filter((_,i)=>i%3===0).map(q=>[Math.round(q.x),Math.round(q.y)])}))}
}
const server=http.createServer((req,res)=>{if(req.url==="/health"){res.writeHead(200);return res.end("ok")}let u=req.url.split("?")[0];if(u==="/")u="/index.html";const base=path.join(__dirname,"public"),file=path.normalize(path.join(base,u));if(!file.startsWith(base)){res.writeHead(403);return res.end("Forbidden")}fs.readFile(file,(e,d)=>{if(e){res.writeHead(404);return res.end("Not found")}res.writeHead(200,{"content-type":path.extname(file)===".html"?"text/html; charset=utf-8":"text/plain","cache-control":"no-store"});res.end(d)})});
const wss=new WebSocket.Server({server,path:"/ws"});
wss.on("connection",ws=>{ws.id=crypto.randomBytes(8).toString("hex");ws.roomCode=null;ws.send(JSON.stringify({t:"hello",id:ws.id}));
 ws.on("message",raw=>{let m;try{m=JSON.parse(raw.toString())}catch{return}
  if(m.t==="join"){if(ws.roomCode){const old=rooms.get(ws.roomCode);if(old)old.players.delete(ws.id)}const code=cleanRoom(m.room),r=room(code);r.players.set(ws.id,makeSnake(ws.id,cleanName(m.name),cleanColor(m.color),false));ws.roomCode=code;ensureBots(r);ws.send(JSON.stringify({t:"joined",room:code}));return}
  if(!ws.roomCode)return;const r=rooms.get(ws.roomCode),p=r&&r.players.get(ws.id);if(!p)return;
  if(m.t==="input"){if(Number.isFinite(m.angle))p.targetAngle=m.angle;p.boost=!!m.boost}
  if(m.t==="respawn"&&!p.alive){const np=makeSnake(ws.id,p.name,p.color,false);r.players.set(ws.id,np)}
 });
 ws.on("close",()=>{const r=rooms.get(ws.roomCode);if(r)r.players.delete(ws.id)});
});
setInterval(()=>{for(const r of rooms.values()){ensureBots(r);for(const p of r.players.values())step(r,p,1/SERVER_FPS);collide(r);while(r.foods.length<FOOD_TARGET)r.foods.push(food());if(r.foods.length>600)r.foods.splice(0,r.foods.length-600)}},1000/SERVER_FPS);
setInterval(()=>{for(const ws of wss.clients){if(ws.readyState===WebSocket.OPEN&&ws.roomCode){const r=rooms.get(ws.roomCode);if(r)ws.send(JSON.stringify(packet(r,ws.id)))}}},1000/SNAPSHOT_FPS);
server.listen(PORT,"0.0.0.0",()=>console.log("Pequisnake v4",PORT));
