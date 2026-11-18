import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowRight, Bus, Check, Clock3, LayoutDashboard, LogOut, MapPinned, Navigation, Plus, RotateCcw, Route, TrafficCone, TrainFront, Trash2, UserRound, AlertTriangle, Info, CalendarClock } from 'lucide-react';

// Relative API requests go through Vite's development proxy. This also works over a frontend Dev Tunnel.
const API = import.meta.env.VITE_API_URL || '';
const MENU = [
  {id:'dashboard',label:'Dashboard',icon:LayoutDashboard},
  {id:'journey',label:'Plan a journey',icon:Route},
  {id:'roads',label:'Road updates',icon:MapPinned},
  {id:'signals',label:'Traffic signals',icon:TrafficCone},
  {id:'transit',label:'Metro & bus',icon:TrainFront},
];
const STOPS = [
  ['indiranagar','Indiranagar'],['ulsoor','Ulsoor'],['trinity','Trinity'],['mgroad','MG Road'],
  ['vidhana','Vidhana Soudha'],['majestic','Majestic'],['domlur','Domlur'],
  ['richmond','Richmond Town'],['townhall','Town Hall'],
];
const LABELS = Object.fromEntries(STOPS);
const DEFAULT_PLAN={origin:'indiranagar',destination:'majestic',departure:'09:00',flow:'busy'};
async function api(path, options={}) {
  const response=await fetch(API+path,{headers:{'Content-Type':'application/json'},...options});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(typeof data.detail==='string'?data.detail:'Request failed');
  return data;
}
const hhmm=(value)=>{
  // Handle temporarily absent API fields without crashing the entire page.
  if(typeof value!=='string'||!/^\d{2}:\d{2}/.test(value)) return 'Not set';
  return value.slice(0,5);
};
function arrivalAt(departure, minutes) {
  if (typeof departure !== 'string' || !/^\d{2}:\d{2}$/.test(departure) || !Number.isFinite(Number(minutes))) return '—';
  const [h,m] = departure.split(':').map(Number);
  const total = (h * 60 + m + Number(minutes)) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2,'0')}:${String(Math.floor(total % 60)).padStart(2,'0')}`;
}
function ImpactSummary({data}) {
  const road = data.routes?.[0];
  if (!road) return null;
  const delay = road.incident_delay_minutes || 0;
  const affected = (data.routes || []).filter(r => r.affected_incidents > 0).length;
  return <div className="impact-summary" aria-live="polite">
    <div><span>Fastest road trip</span><strong>{road.minutes} min</strong><small>Arrival around {road.arrival || arrivalAt(data.departure, road.minutes)}</small></div>
    <div><span>Disruption impact</span><strong>{delay > 0 ? `+${delay} min` : 'No delay'}</strong><small>{affected} of {data.routes.length} options affected</small></div>
    <div><span>Suggested option</span><strong>{data.recommendation?.mode || '—'}</strong><small>Arrive around {data.recommendation?.arrival || arrivalAt(data.departure, data.recommendation?.minutes)}</small></div>
  </div>;
}
function MapPanel({data,selectedRoute=0}){
  const element=useRef(null), map=useRef(null), layer=useRef(null);
  useEffect(()=>{
    if(!element.current)return;
    const m=L.map(element.current,{scrollWheelZoom:false,zoomControl:false}).setView([12.975,77.608],12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:18}).addTo(m);
    L.control.zoom({position:'bottomright'}).addTo(m);
    map.current=m;layer.current=L.layerGroup().addTo(m);
    const timer=setTimeout(()=>m.invalidateSize(),150);
    return()=>{clearTimeout(timer);m.remove();map.current=null;};
  },[]);
  useEffect(()=>{
    if(!data||!layer.current||!map.current)return;
    const group=layer.current;group.clearLayers();
    const pt=(key)=>[data.places[key].lat,data.places[key].lng];
    data.roads.forEach(edge=>L.polyline([pt(edge.from),pt(edge.to)],{color:'#adbbb4',weight:3,dashArray:'5 8'}).addTo(group));
    const route=data.routes[selectedRoute]||data.routes[0];
    if(route){const points=route.nodes.map(pt);L.polyline(points,{color:'#167D68',weight:6}).addTo(group);map.current.fitBounds(L.latLngBounds(points).pad(0.28),{animate:false,maxZoom:13});}
    [[data.origin_id,'Start'],[data.destination_id,'Destination']].forEach(([key,label])=>{
      L.circleMarker(pt(key),{radius:9,color:'#fff',weight:3,fillColor:label==='Start'?'#167D68':'#DC9950',fillOpacity:1}).addTo(group).bindPopup(`${label}: ${data.places[key].name}`);
    });
    data.incidents.forEach(item=>{
      const a=pt(item.from),b=pt(item.to);
      L.circleMarker([(a[0]+b[0])/2,(a[1]+b[1])/2],{radius:8,color:'#fff',weight:2,fillColor:'#D25D43',fillOpacity:1}).addTo(group).bindPopup(`${item.label} · simulated`);
    });
  },[data,selectedRoute]);
  return <div className="map-container"><div ref={element} className="map-canvas"/><span className="map-caption">Schematic routes · OpenStreetMap basemap · not live navigation</span></div>;
}
function SectionTitle({eyebrow,title,subtitle,action}){return <div className="section-head"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>;}
function Card({title,kicker,children,action,className=''}){return <section className={`card ${className}`}><div className="card-head"><div><span className="eyebrow">{kicker}</span><h2>{title}</h2></div>{action}</div><div className="card-body">{children}</div></section>;}
function LocationSelect({label,field,draft,setDraft}) {
  const [filter,setFilter]=useState('');
  const matches=STOPS.filter(([,name])=>name.toLowerCase().includes(filter.trim().toLowerCase()));
  const visible=matches.some(([id])=>id===draft[field]) ? matches : [[draft[field],LABELS[draft[field]]],...matches];
  return <label>{label}<input className="stop-search" type="search" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search sample locations" aria-label={`Search ${label.toLowerCase()}`}/><select value={draft[field]} onChange={e=>setDraft(s=>({...s,[field]:e.target.value}))}>{visible.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>;
}
function JourneyForm({draft,setDraft,onSubmit,working,compact=false}){
  return <form className={`planner ${compact?'planner-compact':''}`} onSubmit={onSubmit}>
    <LocationSelect label="Starting from" field="origin" draft={draft} setDraft={setDraft}/>
    <LocationSelect label="Going to" field="destination" draft={draft} setDraft={setDraft}/>
    <label>Departure time<input type="time" required value={draft.departure} onChange={e=>setDraft(s=>({...s,departure:e.target.value}))}/></label>
    <label>Expected traffic<select value={draft.flow} onChange={e=>setDraft(s=>({...s,flow:e.target.value}))}><option value="normal">Light</option><option value="busy">Moderate</option><option value="peak">Heavy / peak</option></select></label>
    <button className="primary" disabled={working||draft.origin===draft.destination} type="submit"><Navigation size={16}/> Find my route</button>
    {draft.origin===draft.destination&&<small className="form-hint">Choose two different locations.</small>}
  </form>;
}
function Login({onLogin}){
  const [name,setName]=useState('');const [email,setEmail]=useState('');
  function submit(e){e.preventDefault();if(!name.trim()||!email.trim())return;onLogin({name:name.trim(),email:email.trim()});}
  return <div className="login-shell"><div className="login-story"><div className="brand brand-light"><span className="brand-icon"><Navigation size={23}/></span><span>namma<strong>move</strong></span></div><div className="login-pitch"><span className="light-eyebrow">MADE FOR BENGALURU</span><h1>Your city.<br/>A better way through it.</h1><p>Compare road routes, see disruptions, and explore metro alternatives — all in one simple place.</p><div className="login-pills"><span>Road routes</span><span>Metro & bus</span><span>Traffic updates</span></div></div><div className="login-foot">Illustrative mobility demo · No live traffic information</div></div><div className="login-side"><div className="login-card"><div className="mobile-brand">NammaMove</div><div className="login-icon"><UserRound size={24}/></div><h2>Welcome aboard</h2><p>Enter your details to explore the Bengaluru commute demo.</p><form onSubmit={submit}><label>Your name<input required maxLength={60} autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Monisha"/></label><label>Email address<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><button className="primary" type="submit">Continue to dashboard <ArrowRight size={17}/></button></form><div className="demo-disclaimer"><Info size={16}/> Demo access only. No password, account creation, or server authentication. Details stay in this browser session.</div></div></div></div>;
}
export default function App(){
  const [user,setUser]=useState(()=>{try{const saved=JSON.parse(sessionStorage.getItem('nammamove_demo_user')||'null');return typeof saved?.name==='string'&&saved.name.trim()?saved:null;}catch{return null;}});
  const [page,setPage]=useState('dashboard');
  const [draft,setDraft]=useState(DEFAULT_PLAN);
  const [plan,setPlan]=useState(DEFAULT_PLAN);
  const [data,setData]=useState(null);
  const [selectedRoute,setSelectedRoute]=useState(0);
  const [segment,setSegment]=useState('trinity:mgroad');
  const [incidentKind,setIncidentKind]=useState('breakdown');
  const [incidentOpen,setIncidentOpen]=useState(false);
  const [working,setWorking]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const query=(p)=>`/api/overview?${new URLSearchParams({origin:p.origin,destination:p.destination,departure:p.departure})}`;
  async function load(p=plan){const next=await api(query(p));if(!Array.isArray(next.routes)||!Array.isArray(next.journeys))throw new Error('Unexpected API response. Check that this frontend and backend are from the same project version.');setData(next);setSelectedRoute(0);return next;}
  useEffect(()=>{if(user)load().catch(e=>setError(e.message));},[Boolean(user)]);
  function signIn(next){sessionStorage.setItem('nammamove_demo_user',JSON.stringify(next));setUser(next);}
  function signOut(){sessionStorage.removeItem('nammamove_demo_user');setUser(null);setData(null);setPage('dashboard');}
  async function update(path,method='POST',body=null,success='Updated',p=plan){setWorking(true);setError('');setMessage('');try{await api(path,{method,...(body?{body:JSON.stringify(body)}:{})});await load(p);setMessage(success);return true;}catch(e){setError(e.message);return false;}finally{setWorking(false);}}
  async function submitJourney(e){e.preventDefault();if(draft.origin===draft.destination)return;setWorking(true);setError('');setMessage('');try{if(draft.flow!==data?.flow)await api('/api/simulation',{method:'POST',body:JSON.stringify({flow:draft.flow})});const next=await load(draft);setPlan({...draft});setData(next);setMessage('Journey updated');setPage('journey');}catch(e){setError(e.message);}finally{setWorking(false);}}
  async function reset(){setDraft(DEFAULT_PLAN);setPlan(DEFAULT_PLAN);await update('/api/reset','POST',null,'Demo reset',DEFAULT_PLAN);}
  if(!user)return <Login onLogin={signIn}/>;
  const best=data?.routes?.[0];const recommended=data?.recommendation;
  const active=MENU.find(m=>m.id===page)||MENU[0];
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-icon"><Navigation size={21}/></span><span>namma<strong>move</strong><small>Bengaluru mobility</small></span></div><span className="sidebar-caption">YOUR WORKSPACE</span><nav>{MENU.map(item=>{const Icon=item.icon;return <button key={item.id} className={`nav-link ${page===item.id?'selected':''}`} onClick={()=>setPage(item.id)}><Icon size={19}/><span>{item.label}</span></button>;})}</nav><div className="sidebar-note"><Info size={18}/><strong>About these estimates</strong><p>Travel times, incidents and signal comparisons are simulated. Only the map tiles are real.</p></div></aside>
    <div className="app-main"><header className="topbar"><div className="breadcrumbs">NammaMove <span>/</span> {active.label}</div><div className="top-right"><span className="demo-label">DEMO MODE</span><span className="user-avatar">{user.name.charAt(0).toUpperCase()}</span><span className="username">{user.name}</span><button className="icon-button" onClick={signOut} title="Sign out" aria-label="Sign out"><LogOut size={18}/></button></div></header>
      <main className="content">{error&&<div className="alert" role="alert"><AlertTriangle size={18}/>{error}<button onClick={()=>setError('')}>Dismiss</button></div>}{message&&<div className="success"><Check size={17}/>{message}</div>}
      {!data?<div className="card loading"><div>{error?'Could not load your dashboard.':'Loading your demo…'}<p>Start FastAPI on port 8000, then select Retry.</p><button className="primary" onClick={()=>{setError('');load().catch(e=>setError(e.message));}}>Retry connection</button></div></div>:<>
      {page==='dashboard'&&<>
        <SectionTitle eyebrow="YOUR COMMUTE OVERVIEW" title={`Good to see you, ${user.name.split(' ')[0]}.`} subtitle="Where are you heading today? Start with a journey or explore what is happening on the roads." action={<button className="quiet-button" onClick={reset} disabled={working}><RotateCcw size={15}/> Reset demo</button>}/>
        <div className="welcome-banner"><span>ONE CITY, BETTER CHOICES</span><h2>Less guessing. More moving.</h2><p>Choose your route and see how road disruptions and public transport can change your commute.</p><button onClick={()=>setPage('journey')} className="banner-button">Plan a journey <ArrowRight size={16}/></button></div>
        <div className="metrics"><div className="metric"><span>Current journey</span><strong>{data.origin} → {data.destination}</strong><small>Depart {hhmm(data.departure)} · Arrive {best?.arrival || arrivalAt(data.departure,best?.minutes)}</small></div><div className="metric"><span>Quickest road option</span><strong>{best?.minutes} min</strong><small>Simulated travel time</small></div><div className="metric"><span>Recommended travel</span><strong>{recommended?.mode}</strong><small>{recommended?.minutes} min · Arrive {recommended?.arrival || arrivalAt(data.departure,recommended?.minutes)}</small></div><div className="metric"><span>Road disruptions</span><strong>{data.incidents.length}</strong><small>Simulated active reports</small></div></div>
        <div className="cols dashboard-cols"><Card kicker="YOUR CURRENT JOURNEY" title="Your route on the map" action={<button className="text-action" onClick={()=>setPage('journey')}>See routes <ArrowRight size={14}/></button>}><MapPanel data={data} selectedRoute={0}/></Card><div className="stack"><Card kicker="A BETTER OPTION" title="Travel recommendation"><div className="recommendation"><span>Based on sample timings</span><strong>{recommended?.mode}</strong><h3>{recommended?.minutes} minutes</h3><p>Estimated arrival {recommended?.arrival || arrivalAt(data.departure,recommended?.minutes)}</p><p>{recommended?.note}</p></div></Card><Card kicker="QUICK ACCESS" title="What would you like to check?"><div className="quick-links"><button onClick={()=>setPage('roads')}><MapPinned size={20}/> Road updates <ArrowRight size={16}/></button><button onClick={()=>setPage('signals')}><TrafficCone size={20}/> Signal timings <ArrowRight size={16}/></button><button onClick={()=>setPage('transit')}><TrainFront size={20}/> Metro & bus <ArrowRight size={16}/></button></div></Card></div></div>
      </>}
      {page==='journey'&&<>
        <SectionTitle eyebrow="COMMUTEDNA · JOURNEY PLANNER" title="Where are you going?" subtitle="Choose a start, destination and departure time to compare your options."/>
        <Card kicker="PLAN YOUR COMMUTE" title="Your journey details"><JourneyForm draft={draft} setDraft={setDraft} onSubmit={submitJourney} working={working}/><p className="muted-note">You can choose from nine sample locations. Arrival times are calculated from your chosen departure time. Traffic levels are illustrative and do not change automatically with departure time.</p></Card>
        <ImpactSummary data={data}/><div className="cols journey-cols"><Card kicker="ROUTE COMPARISON" title={`${data.origin} to ${data.destination}`} action={<span className="tag">Leaving {data.departure}</span>}><div className="route-list">{data.routes.map((r,i)=><button className={`route-row ${selectedRoute===i?'chosen':''}`} key={r.id} onClick={()=>setSelectedRoute(i)}><span className="route-index">{i+1}</span><span className="route-details"><strong>{i===0?'Fastest road route':`Alternative route ${i}`}</strong><small>Via {r.names.slice(1,-1).join(' · ')||'direct connection'}</small><small>{r.affected_incidents?`${r.affected_incidents} disruption(s) · +${r.incident_delay_minutes || 0} min on this route`:'No reported disruptions on route'}</small><small>Arrival {r.arrival || arrivalAt(data.departure,r.minutes)}</small></span><strong className="route-min">{r.minutes} min</strong></button>)}</div></Card><Card kicker="MAP VIEW" title="Selected road route"><MapPanel data={data} selectedRoute={selectedRoute}/></Card></div>
      </>}
      {page==='roads'&&<>
        <SectionTitle eyebrow="ROADPULSE · INCIDENTS" title="What's happening on the roads?" subtitle="Add a simulated disruption and see how it affects route calculations." action={<button className="primary" onClick={()=>setIncidentOpen(s=>!s)}><Plus size={16}/>{incidentOpen?'Close form':'Report a road issue'}</button>}/>
        <ImpactSummary data={data}/><div className="cols road-cols"><Card kicker="SAMPLE REPORTS" title="Road disruptions">{incidentOpen&&<form className="incident-form" onSubmit={async e=>{e.preventDefault();const ok=await update('/api/incidents','POST',{segment_id:segment,kind:incidentKind},'Simulated incident added');if(ok)setIncidentOpen(false);}}><label>Road segment<select value={segment} onChange={e=>setSegment(e.target.value)}>{data.segments.map(s=><option value={s.id} key={s.id}>{s.label}</option>)}</select></label><label>Type of issue<select value={incidentKind} onChange={e=>setIncidentKind(e.target.value)}><option value="breakdown">Vehicle breakdown</option><option value="roadwork">Roadworks</option><option value="waterlogging">Waterlogging</option></select></label><button className="primary" disabled={working}>Add sample incident</button></form>}{data.incidents.length===0?<div className="empty"><MapPinned size={30}/><h3>No disruptions in this scenario</h3><p>Add an incident to see how it changes route suggestions.</p></div>:data.incidents.map(item=><div className="incident-item" key={item.id}><div className="incident-symbol"><AlertTriangle size={18}/></div><div><strong>{item.label}</strong><p>{item.location}</p><small>+{item.penalty} simulated minutes on affected road · {item.created_at ? new Date(item.created_at).toLocaleString() : "Sample report"}</small></div><button className="icon-button" title="Remove incident" onClick={()=>update(`/api/incidents/${item.id}`,'DELETE',null,'Incident removed')} disabled={working}><Trash2 size={17}/></button></div>)}</Card><Card kicker="NETWORK VIEW" title="Disruptions on the map"><MapPanel data={data}/><p className="muted-note">Orange dots mark simulated disruptions. You can add or remove them to compare scenarios.</p></Card></div>
      </>}
      {page==='signals'&&<>
        <SectionTitle eyebrow="SIGNALSYNC · SIMULATION" title="Can we reduce waiting at signals?" subtitle="Compare sample fixed timings with a simplified adaptive signal model."/>
        <div className="simulation-control"><div><strong>Traffic scenario</strong><span>Change demand to compare wait-time estimates.</span></div><select value={data.flow} disabled={working} onChange={e=>update('/api/simulation','POST',{flow:e.target.value},'Scenario updated')}><option value="normal">Light traffic</option><option value="busy">Moderate traffic</option><option value="peak">Peak-hour traffic</option></select></div>
        <Card kicker="THREE SAMPLE JUNCTIONS" title="Fixed vs adaptive signal waiting"><div className="bar-legend"><span><i className="legend-fixed"/> Fixed timing</span><span><i className="legend-adaptive"/> Adaptive timing</span></div><div className="signals-list">{data.signals.map(s=><div className="signal-row" key={s.id}><div className="signal-row-header"><strong>{s.name}</strong><span>{s.fixed_wait-s.adaptive_wait} seconds less waiting (simulated)</span></div><div className="signal-bar"><div className="signal-track"><span style={{width:`${Math.min(s.fixed_wait/90*100,100)}%`,background:'#C8D3CD'}}/></div><strong>{s.fixed_wait}s</strong></div><div className="signal-bar"><div className="signal-track"><span style={{width:`${Math.min(s.adaptive_wait/90*100,100)}%`,background:'#167D68'}}/></div><strong>{s.adaptive_wait}s</strong></div></div>)}</div><p className="muted-note">Model comparison only — this app is not controlling Bengaluru's real traffic signals.</p></Card>
      </>}
      {page==='transit'&&<>
        <SectionTitle eyebrow="METROBRIDGE · TRANSIT CHOICES" title="Maybe there's another way." subtitle="Compare simulated metro, bus and road estimates for your selected commute." action={<button className="quiet-button" onClick={()=>setPage('journey')}><CalendarClock size={16}/> Change journey</button>}/>
        <div className="trip-summary"><span>{data.origin}</span><ArrowRight size={18}/><span>{data.destination}</span><span className="tag">Departure {data.departure}</span></div>
        <div className="option-grid">{data.journeys.map((j,i)=>{const Icon=j.kind==='metro'?TrainFront:j.kind==='bus'?Bus:Route;return <div className={`travel-option ${i===0?'option-best':''}`} key={j.kind}><div className="option-icon"><Icon size={22}/></div><span>{j.mode}</span><strong>{j.minutes} min</strong><p>Arrival {j.arrival || arrivalAt(data.departure,j.minutes)}</p><p>{j.note}</p><ol className="journey-steps">{(j.steps || []).map((step,n)=><li key={n}>{step}</li>)}</ol>{i===0&&<span className="best-label">Lowest sample estimate</span>}</div>;})}</div>
        <div className="subtle-note"><Info size={18}/><span>Metro alternatives appear only for supported sample corridor stops. Bus and metro estimates are illustrative — not live schedules, availability, or accurate journey predictions.</span></div>
      </>}
      <footer className="footer">Made for Bengaluru · NammaMove demo <span>Simulated data · Not for real travel decisions</span></footer>
      </>}</main></div></div>;
}
