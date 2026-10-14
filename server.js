
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const WebSocket = require("ws");

const PORT = process.env.PORT || 8080;
const WORLD = 4200;
const FPS = 30;
const FOOD_TARGET = 420;
const rooms = new Map();

const rand=(a,b)=>a+Math.random()*(b-a);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function wrapAngle(a){
  while(a>Math.PI)a-=Math.PI*2;
  while(a<-Math.PI)a+=Math.PI*2;
  return a;
}
function cleanRoom(v){
  return String(v||"FAMILIA")
    .toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,10) || "FAMILIA";
}
function cleanName(v){
  return String(v||"Jugador").replace(/[<>]/g,"").trim().slice(0,18) || "Jugador";
}
function cleanColor(v){
  return /^#[0-9a-fA-F]{6}$/.test(String(v)) ? String(v) : "#7cf29c";
}
function makeFood(x=rand(50,WORLD-50),y=rand(50,WORLD-50),value=rand(.8,2.2)){
  return {x,y,value,r:3+value*1.4,h:Math.floor(rand(0,360))};
}
function makeRoom(code){
  const room={code,players:new Map(),foods:[]};
  for(let i=0;i<FOOD_TARGET;i++) room.foods.push(makeFood());
  rooms.set(code,room);
  return room;
}
function getRoom(code){
  return rooms.get(code)||makeRoom(code);
}
function createPlayer(id,name,color){
  const x=rand(500,WORLD-500),y=rand(500,WORLD-500),angle=rand(-Math.PI,Math.PI);
  const p={
    id,name:cleanName(name),color:cleanColor(color),x,y,angle,targetAngle:angle,
    radius:11,baseSpeed:3.1,boost:false,targetLength:90,alive:true,points:[]
  };
  const spacing=6,n=Math.max(8,Math.floor(p.targetLength/spacing));
  for(let i=0;i<n;i++){
    p.points.push({x:x-Math.cos(angle)*i*spacing,y:y-Math.sin(angle)*i*spacing});
  }
  return p;
}
function kill(room,p){
  if(!p.alive)return;
  p.alive=false;
  p.boost=false;
  for(let i=0;i<p.points.length;i+=2){
    const q=p.points[i];
    room.foods.push(makeFood(q.x+rand(-10,10),q.y+rand(-10,10),rand(1.2,3)));
  }
}
function update(room,p){
  if(!p.alive)return;

  const da=wrapAngle(p.targetAngle-p.angle);
  p.angle += clamp(da,-.075,.075);

  const boosting=p.boost && p.targetLength>55;
  const speed=p.baseSpeed*(boosting?1.65:1);
  p.x+=Math.cos(p.angle)*speed;
  p.y+=Math.sin(p.angle)*speed;

  if(boosting){
    p.targetLength=Math.max(50,p.targetLength-.045);
    if(Math.random()<.03){
      const t=p.points[p.points.length-1];
      if(t) room.foods.push(makeFood(t.x,t.y,.55));
    }
  }

  if(p.x<=24||p.x>=WORLD-24||p.y<=24||p.y>=WORLD-24){
    kill(room,p); return;
  }

  const spacing=6;
  const desired=Math.max(8,Math.floor(p.targetLength/spacing));
  p.points[0].x=p.x; p.points[0].y=p.y;
  while(p.points.length<desired){
    const t=p.points[p.points.length-1];
    p.points.push({x:t.x,y:t.y});
  }
  if(p.points.length>desired)p.points.length=desired;

  for(let i=1;i<p.points.length;i++){
    const a=p.points[i-1],b=p.points[i];
    const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||.0001;
    b.x=a.x+(dx/d)*spacing;
    b.y=a.y+(dy/d)*spacing;
  }

  for(let i=room.foods.length-1;i>=0;i--){
    const f=room.foods[i],dx=f.x-p.x,dy=f.y-p.y,rr=p.radius+f.r+3;
    if(dx*dx+dy*dy<rr*rr){
      p.targetLength+=f.value*5.5;
      room.foods.splice(i,1);
      room.foods.push(makeFood());
    }
  }
}
function collisions(room){
  const arr=[...room.players.values()];
  for(const p of arr){
    if(!p.alive)continue;
    for(const o of arr){
      if(p===o||!o.alive)continue;
      for(let i=4;i<o.points.length;i++){
        const q=o.points[i],dx=p.x-q.x,dy=p.y-q.y,rr=p.radius+o.radius*.72;
        if(dx*dx+dy*dy<rr*rr){
          kill(room,p);break;
        }
      }
      if(!p.alive)break;
    }
  }
}
function state(room){
  const ranking=[...room.players.values()]
    .filter(p=>p.alive)
    .sort((a,b)=>b.targetLength-a.targetLength)
    .map(p=>({id:p.id,name:p.name,length:Math.round(p.targetLength)}));
  return {
    t:"state",room:room.code,world:WORLD,
    foods:room.foods.map(f=>[f.x,f.y,f.r,f.h]),
    ranking,
    players:[...room.players.values()].map(p=>({
      id:p.id,name:p.name,color:p.color,x:p.x,y:p.y,angle:p.angle,
      radius:p.radius,length:p.targetLength,alive:p.alive,
      points:p.points.map(q=>[q.x,q.y])
    }))
  };
}

const server=http.createServer((req,res)=>{
  if(req.url==="/health"){
    res.writeHead(200,{"content-type":"text/plain"}); return res.end("ok");
  }
  let u=req.url.split("?")[0];
  if(u==="/")u="/index.html";
  const base=path.join(__dirname,"public");
  const file=path.normalize(path.join(base,u));
  if(!file.startsWith(base)){
    res.writeHead(403);return res.end("Forbidden");
  }
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(404);return res.end("Not found");}
    const ext=path.extname(file);
    const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json"};
    res.writeHead(200,{"content-type":types[ext]||"application/octet-stream","cache-control":"no-store"});
    res.end(data);
  });
});

const wss=new WebSocket.Server({server,path:"/ws"});

wss.on("connection",ws=>{
  ws.id=crypto.randomBytes(8).toString("hex");
  ws.roomCode=null;
  ws.isAlive=true;
  ws.on("pong",()=>ws.isAlive=true);
  ws.send(JSON.stringify({t:"hello",id:ws.id}));

  ws.on("message",raw=>{
    let m;
    try{m=JSON.parse(raw.toString())}catch{return}

    if(m.t==="join"){
      const code=cleanRoom(m.room);
      if(ws.roomCode){
        const old=rooms.get(ws.roomCode);
        if(old)old.players.delete(ws.id);
      }
      const room=getRoom(code);
      room.players.set(ws.id,createPlayer(ws.id,m.name,m.color));
      ws.roomCode=code;
      ws.send(JSON.stringify({t:"joined",room:code}));
      return;
    }

    if(!ws.roomCode)return;
    const room=rooms.get(ws.roomCode);
    if(!room)return;
    const p=room.players.get(ws.id);
    if(!p)return;

    if(m.t==="input"){
      if(Number.isFinite(m.angle))p.targetAngle=m.angle;
      p.boost=!!m.boost;
    }else if(m.t==="respawn" && !p.alive){
      room.players.set(ws.id,createPlayer(ws.id,p.name,p.color));
    }
  });

  ws.on("close",()=>{
    if(ws.roomCode){
      const room=rooms.get(ws.roomCode);
      if(room){
        room.players.delete(ws.id);
        if(room.players.size===0) setTimeout(()=>{
          const current=rooms.get(ws.roomCode);
          if(current && current.players.size===0)rooms.delete(ws.roomCode);
        },60000);
      }
    }
  });
});

setInterval(()=>{
  for(const room of rooms.values()){
    for(const p of room.players.values())update(room,p);
    collisions(room);
    while(room.foods.length<FOOD_TARGET)room.foods.push(makeFood());
    if(room.foods.length>900)room.foods.splice(0,room.foods.length-900);

    const msg=JSON.stringify(state(room));
    for(const ws of wss.clients){
      if(ws.readyState===WebSocket.OPEN && ws.roomCode===room.code)ws.send(msg);
    }
  }
},1000/FPS);

setInterval(()=>{
  for(const ws of wss.clients){
    if(ws.isAlive===false){ws.terminate();continue}
    ws.isAlive=false;ws.ping();
  }
},25000);

server.listen(PORT,"0.0.0.0",()=>console.log("Snake Arena on port",PORT));
