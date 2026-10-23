(() => {
  'use strict';
  const data = window.CATALONIA_DATA;
  const assetBase=document.currentScript.src;
  const KEY = 'catalonia_simulator_v1';
  const root = document.getElementById('catalonia-election-wrap') || document;
  const $ = id => root.querySelector('#'+id);
  const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sum = values => values.reduce((a,b)=>a+b,0);
  const clamp = (value,min,max,fallback=min) => Number.isFinite(Number(value)) ? Math.max(min,Math.min(max,Number(value))) : fallback;
  const names = {'JxSí':'Junts pel Sí',"C's":'Ciutadans',PSC:'Partit dels Socialistes de Catalunya',CatSíqueesPot:'Catalunya Sí que es Pot',PP:'Partit Popular',CUP:'Candidatura d’Unitat Popular','unio.cat':'Unió Democràtica de Catalunya',PACMA:'PACMA','RECORTES CERO-ELS VERDS':'Recortes Cero – Els Verds','PIRATA.CAT/XDT':'Pirates de Catalunya',GANEMOS:'Ganemos'};
  const colors = ['#00A19A','#EB6109','#E30613','#8B1B75','#0070B5','#FFED00','#005A9C','#73A434','#CF252A','#722D85','#A8272B'];

  const axes={social:['Social','Conservative','Progressive'],economic:['Economic','Free market','State'],geography:['Rural / metropolitan','Rural','Metropolitan'],populism:['Organization','Established','Populist'],independence:['National position','Unionist','Independentist']};
  // Editable scenario assumptions, not measured candidate or voter scores.
  const profiles={
    'JxSí':{candidate:'Raül Romeva',social:65,economic:45,geography:45,populism:55,independence:100},
    "C's":{candidate:'Inés Arrimadas',social:55,economic:25,geography:75,populism:65,independence:0},
    PSC:{candidate:'Miquel Iceta',social:75,economic:65,geography:75,populism:30,independence:25},
    CatSíqueesPot:{candidate:'Lluís Rabell',social:90,economic:90,geography:80,populism:75,independence:50},
    PP:{candidate:'Xavier García Albiol',social:20,economic:15,geography:55,populism:35,independence:0},
    CUP:{candidate:'Antonio Baños',social:95,economic:100,geography:45,populism:95,independence:100},
    'unio.cat':{candidate:'Ramon Espadaler',social:30,economic:30,geography:40,populism:20,independence:55}
  };
  const evidence=window.CATALONIA_REGIONAL_PROFILES;
  const normalName=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  function evidenceParty(p){
    if(Object.prototype.hasOwnProperty.call(p,'evidenceParty'))return evidence?.parties[p.evidenceParty]?p.evidenceParty:'';
    const name=normalName(p.name),id=normalName(p.id);
    const aliases=[['ALIANÇA.CAT',['aliancacatalana','ac']],['ERC',['erc','esquerrarepublicanadecatalunya','esquerrarepublicana']],['CAT-JUNTS+',['juntsxcat','juntspercat','juntspercatalunya','junts','catjunts']],['PSC',['psc','partitsocialistadecatalunya','partitdelssocialistesdecatalunya']],['COMUNS SUMAR',['comuns','comunssumar','catalunyaencomu']],['CUP - DT',['cup','candidaturadunitatpopular']],['PP',['pp','ppcatalunya','partitpopular']],['VOX',['vox']],['PACMA',['pacma']],['Cs',['cs','ciutadans']]];
    return aliases.find(([,names])=>names.includes(name)||names.includes(id))?.[0]||'';
  }
  function partyTag(p){
    const modern=evidenceParty(p);if(modern)return evidence.parties[modern].short;
    const presets={'JxSí':'JxSí',"C's":'Cs',CatSíqueesPot:'CSQP','unio.cat':'Unió','RECORTES CERO-ELS VERDS':'RC-EV','PIRATA.CAT/XDT':'Pirates',GANEMOS:'Ganemos'};
    if(presets[p.id])return presets[p.id];
    const words=String(p.name||'Party').trim().split(/\s+/).filter(w=>!['de','del','dels','la','el','i'].includes(w.toLowerCase()));
    return (words.length===1?words[0]:words.map(w=>w[0]).join('')).slice(0,8);
  }
  function regionEvidence(region){return evidence?.regions[region.code||region.name]||null;}
  function safeImage(value){const s=String(value||'');return s.startsWith('https://')||/^data:image\/(png|jpeg|webp);base64,/.test(s)?s.slice(0,2800000):'';}
  function profileDefaults(id){return {candidate:'',image:'',imageStatus:'',...Object.fromEntries(Object.keys(axes).map(k=>[k,50])),...(profiles[id]||{})};}
  function photoMarkup(p,cls){return '<div class="'+cls+'">'+(p.image?'<img src="'+esc(safeImage(p.image))+'" alt="'+esc(p.candidate||p.name)+'" loading="lazy" referrerpolicy="no-referrer">':'<span>'+esc((p.candidate||p.name).split(/\s+/).map(w=>w[0]).slice(0,3).join(''))+'</span>')+'</div>';}

  const historicalTotals = {};
  data.constituencies.forEach(region=>Object.entries(region.votes).forEach(([id,v])=>{if(id) historicalTotals[id]=(historicalTotals[id]||0)+v;}));
  const totalHistorical = sum(Object.values(historicalTotals));
  function defaults() {
    return {version:1,parties:Object.keys(names).map((id,i)=>({id,...profileDefaults(id),name:names[id],short:partyTag({id,name:names[id]}),evidenceParty:evidenceParty({id,name:names[id]}),color:colors[i],target:(historicalTotals[id]||0)/totalHistorical*100,alliance:''})),blocs:[],regionBias:{},settings:{model:'historical',regionalEvidence:'2015',ideologyStrength:70,chamberView:'bloc',mapView:'bloc',districts:'provinces',method:'dhondt',threshold:3,reporting:100,countSpeed:1,labels:false},government:[]};
  }
  function validate(raw) {
    if (!raw || !Array.isArray(raw.parties) || !raw.parties.length || raw.parties.length>50) throw Error('Scenario must contain 1–50 parties.');
    const ids=new Set();
    const parties=raw.parties.map((p,i)=>{
      const id=String(p.id||'custom-'+i).slice(0,80);
      if(ids.has(id))throw Error('Duplicate party identifier.');ids.add(id);
      return {...profileDefaults(id),...Object.fromEntries(Object.keys(axes).map(k=>[k,clamp(p[k],0,100,profileDefaults(id)[k])])),candidate:String(p.candidate??profileDefaults(id).candidate).slice(0,120),image:safeImage(p.image),imageStatus:String(p.imageStatus||'').slice(0,160),id,name:String(p.name||'Party').slice(0,120),short:String(p.short??partyTag(p)).trim().slice(0,8)||partyTag(p),evidenceParty:evidenceParty(p),color:/^#[0-9a-f]{6}$/i.test(p.color)?p.color:colors[i%colors.length],target:clamp(p.target,0,100),alliance:String(p.alliance||'').trim().slice(0,80)};
    });
    if(!parties.some(p=>p.target>0))throw Error('At least one party needs votes.');
    const s=raw.settings||{};
    const blocs=(Array.isArray(raw.blocs)?raw.blocs:[]).slice(0,50).map((b,i)=>({id:String(b.id||'bloc-'+i),name:String(b.name||'Bloc').trim().slice(0,80),short:String(b.short||'BLOC').slice(0,8),color:/^#[0-9a-f]{6}$/i.test(b.color)?b.color:'#7c3aed',type:b.type==='coalition'?'coalition':'electoral'}));
    for(const p of parties)if(p.alliance&&!blocs.some(b=>b.name===p.alliance))blocs.push({id:'legacy-'+blocs.length,name:p.alliance,short:'BLOC',color:p.color,type:'electoral'});
    const regionBias={};for(const [code,values] of Object.entries(raw.regionBias||{}).slice(0,1100)){regionBias[code]=Object.fromEntries(Object.entries(values||{}).filter(([id])=>ids.has(id)).map(([id,v])=>[id,clamp(v,-30,30,0)]));}
    return {version:1,parties,blocs,regionBias,settings:{model:s.model==='ideological'?'ideological':'historical',regionalEvidence:s.regionalEvidence==='2024'?'2024':'2015',ideologyStrength:clamp(s.ideologyStrength,0,100,70),chamberView:s.chamberView==='party'?'party':'bloc',mapView:s.mapView==='party'?'party':'bloc',districts:['provinces','national','comarques'].includes(s.districts)?s.districts:'provinces',method:['dhondt','sainte','hare'].includes(s.method)?s.method:'dhondt',threshold:clamp(s.threshold,0,30,3),reporting:clamp(s.reporting,0,100,100),countSpeed:clamp(s.countSpeed,.25,8,1),labels:!!s.labels},government:Array.isArray(raw.government)?raw.government.filter(x=>typeof x==='string'):[]};
  }
  let app;
  try {const saved=localStorage.getItem(KEY);app=saved?validate(JSON.parse(saved)):defaults();}catch {app=defaults();}
  app.parties.forEach(p=>{p.short=p.short||partyTag(p);p.evidenceParty=p.evidenceParty||evidenceParty(p);});
  // Upgrade only untouched old preset colors; retain user-selected colors.
  const previousColors=["#63b660","#ef8b35","#df4860","#9659c9","#548ad0","#efd13c","#447b89","#93c29a","#98575e","#7b81b8","#aa8b72"];
  app.parties.forEach(p=>{const i=Object.keys(names).indexOf(p.id);if(i>=0&&p.color.toLowerCase()===previousColors[i].toLowerCase())p.color=colors[i];});
  function hash(key){return [...String(key)].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,7);}
  // Fixed batches simulate uneven reporting; every party's counted votes only rise.
  function assuredWinner(grouped,remaining) {
    const lead=grouped[0]?.votes||0,runner=grouped[1]?.votes||0;
    // A tie is not a call. Use only counted votes and the uncounted total,
    // never the simulator's knowledge of which party owns remaining ballots.
    return lead>0 && lead-runner>Math.max(0,remaining)+1e-7;
  }
  let countCacheResults=null,countCacheClock=-1,countCache=new Map(),municipalCountRows=null;
  function localCount(row){
    const clock=app.settings.reporting;
    if(countCacheResults!==results || countCacheClock!==clock){countCacheResults=results;countCacheClock=clock;countCache=new Map();municipalCountRows=null;}
    const key=row.region.code||row.region.name;
    if(countCache.has(key))return countCache.get(key);
    // Municipalities report independently; the comarca completes only after all
    // its local counts finish. Scale ratios to retain calibrated comarca totals.
    if(municipis && !row.region.comarca && data.comarques.some(c=>c.code===row.region.code)){
      municipalCountRows ||= municipalRows(null);
      const members=municipalCountRows.filter(r=>r.region.comarca===row.region.code);
      if(members.length){
        const counts=members.map(localCount);
        const votes=row.votes.map((v,i)=>{const full=sum(members.map(r=>r.votes[i]));return full?v*sum(counts.map(c=>c.votes[i]))/full:v*sum(counts.map(c=>c.progress))/counts.length/100;});
        const grouped=results.groups.map(g=>({...g,votes:sum(g.members.map(i=>votes[i]))})).sort((a,b)=>b.votes-a.votes);
        const value={votes,grouped,progress:sum(row.votes)?sum(votes)/sum(row.votes)*100:sum(counts.map(c=>c.progress))/counts.length,complete:counts.every(c=>c.complete),called:assuredWinner(grouped,sum(row.votes)-sum(votes))};
        countCache.set(key,value);return value;
      }
    }
    const seed=hash(row.region.code||row.region.name);
    const start=seed%18,end=58+seed%41;
    const progress=clock>=end?100:clamp((clock-start)/(end-start)*100,0,100);
    const x=progress/100*24;
    const votes=row.votes.map((v,i)=>{
      const weights=Array.from({length:24},(_,batch)=>Math.exp(((hash(seed+':'+i+':'+batch)%1000)/999-.5)*3.6));
      const arrived=sum(weights.map((w,b)=>w*clamp(x-b,0,1)));
      return v*arrived/sum(weights);
    });
    const grouped=results.groups.map(g=>({...g,votes:sum(g.members.map(i=>votes[i]))})).sort((a,b)=>b.votes-a.votes);
    const value={progress,votes,grouped,complete:progress===100,called:assuredWinner(grouped,sum(row.votes)-sum(votes))};countCache.set(key,value);return value;
  }
  function provinceCount(row){
    const code={Barcelona:'08',Girona:'17',Lleida:'25',Tarragona:'43'}[row.region.name];
    const pieces=results.comarques.map(r=>{
      const members=(municipis||[]).filter(m=>m.comarca===r.region.code);
      const total=sum(members.map(m=>sum(Object.values(m.votes))));
      const fraction=total?sum(members.filter(m=>m.code.startsWith(code)).map(m=>sum(Object.values(m.votes))))/total:0;
      const c=localCount(r);return {full:r.votes.map(v=>v*fraction),count:c.votes.map(v=>v*fraction),done:c.complete,fraction};
    }).filter(p=>p.fraction>0);
    const overseas=window.CATALONIA_MUNICIPAL_DATA?.overseas?.find(m=>m.code.startsWith(code));
    if(overseas){const full=app.parties.map((p,i)=>(overseas.votes[p.id]||sum(Object.values(overseas.votes))*row.votes[i]/sum(row.votes)));const c=localCount({region:overseas,votes:full});pieces.push({full,count:c.votes,done:c.complete});}
    if(!pieces.length)return localCount(row);
    const votes=row.votes.map((v,i)=>{const den=sum(pieces.map(p=>p.full[i]));return den?v*sum(pieces.map(p=>p.count[i]))/den:0});
    return {votes,progress:sum(row.votes)?sum(votes)/sum(row.votes)*100:0,complete:pieces.every(p=>p.done)};
  }
  function electionCounts(){
    const provinces=regionalProvinces().map(provinceCount);
    const districts=results.allocated.map(r=>app.settings.districts==='comarques'?localCount(r):app.settings.districts==='national'?{votes:app.parties.map((_,i)=>sum(provinces.map(c=>c.votes[i]))),complete:provinces.every(c=>c.complete),progress:sum(provinces.map(c=>sum(c.votes)))/results.total*100}:provinces[data.constituencies.findIndex(p=>p.name===r.region.name)]);
    results.allocated.forEach((r,i)=>{const c=districts[i],votes=results.groups.map(g=>sum(g.members.map(j=>c.votes[j])));r.complete=c.complete;r.countProgress=c.progress;r.seats=sum(votes)?allocate(votes,r.blank*c.progress/100,r.available,app.settings.method,app.settings.threshold):votes.map(()=>0)});
    results.rows.forEach((row,i)=>{row.seats=sum(results.allocated.map(r=>r.seats[i]));row.confirmedSeats=sum(results.allocated.filter(r=>r.complete).map(r=>r.seats[i]))});
    return provinces;
  }
  let selected=null, selectedMunicipi=null, municipis=window.CATALONIA_MUNICIPAL_DATA?.municipis||null, municipalLoading=null, timer=null, results=null;
  function save(){try{localStorage.setItem(KEY,JSON.stringify(app));}catch{$('status').textContent='Storage unavailable. Export your scenario to keep a backup.';}}

  // Iterative proportional fitting: retain geographic vote texture while matching
  // the requested national totals. Ideological scenarios start from slider affinity; historical custom parties start uniformly.
  function calibrated(regions) {
    const total=sum(regions.map(r=>sum(Object.values(r.votes))));
    const targetTotal=sum(app.parties.map(p=>p.target));
    const modern=app.settings.regionalEvidence==='2024';
    const matrix=regions.map(r=>app.parties.map(p=>{
      if(p.target<=0)return 0;
      if(app.settings.model==='ideological')return sum(Object.values(r.votes))*profileAffinity(p,r);
      const ref=modern&&p.evidenceParty&&regionEvidence(r);
      return ref ? (ref.votes[p.evidenceParty]||0)/ref.total*sum(Object.values(r.votes)) : (r.votes[p.id]||(historicalTotals[p.id]?0:sum(Object.values(r.votes))*0.01));
    }));
    if(app.settings.model!=='ideological' && !modern && app.parties.length===Object.keys(historicalTotals).length && app.parties.every(p=>Math.abs(p.target/targetTotal-(historicalTotals[p.id]||0)/totalHistorical)<1e-10))return regions.map(region=>({region,votes:app.parties.map(p=>region.votes[p.id]||0),blank:region.blank}));
    // Historical zero ballot access remains zero. If a target exceeds all votes
    // in those areas, expose the infeasibility rather than silently misreport it.
    for(let iteration=0;iteration<800;iteration++) {
      app.parties.forEach((p,j)=>{
        const current=sum(matrix.map(row=>row[j]));
        const wanted=total*p.target/targetTotal;
        if(current>0)matrix.forEach(row=>{row[j]*=wanted/current;});
      });
      regions.forEach((r,i)=>{
        const wanted=sum(Object.values(r.votes)),current=sum(matrix[i]);
        if(current>0)matrix[i]=matrix[i].map(v=>v*wanted/current);
      });
      const error=Math.max(...app.parties.map((p,j)=>Math.abs(sum(matrix.map(row=>row[j]))/total*100-p.target/targetTotal*100)));
      if(error<0.000001)break;
    }
    return regions.map((region,i)=>({region,votes:matrix[i],blank:region.blank}));
  }

  function terrain(region){if(app.settings.regionalEvidence==='2024'&&regionEvidence(region))return {...regionEvidence(region).profile};const total=sum(Object.values(region.votes));return Object.fromEntries(Object.keys(axes).map(k=>[k,total?sum(Object.entries(region.votes).map(([id,v])=>v*profileDefaults(id)[k]))/total:50]));}
  // Scenario party IDs, names and historical references never enter this score.
  // Historical voting informs a fixed mixture of estimated local voter profiles.
  function profileAffinity(p,region){
    if(app.settings.model!=='ideological')return 1;
    const modern=app.settings.regionalEvidence==='2024',ref=modern&&regionEvidence(region);
    const local=terrain(region),votes=ref?ref.votes:region.votes;
    const weights={social:.22,economic:.22,geography:.17,populism:.05,independence:.34};
    const strength=clamp(app.settings.ideologyStrength,0,100,70)*.07;
    let affinity=0,total=0;
    for(const [id,count] of Object.entries(votes||{})){
      if(!count)continue;
      const cohort=ref?evidence.parties[id]:profileDefaults(id);if(!cohort)continue;
      const distance=sum(Object.keys(axes).map(k=>weights[k]*Math.pow((p[k]-(k==='geography'?local.geography:cohort[k]))/50,2)));
      affinity+=count*Math.exp(-distance*strength);total+=count;
    }
    return total?affinity/total:1;
  }
  let ideologicalCache=null;
  function ideologicalMunicipalRows(){
    if(!municipis)return [];
    const key=JSON.stringify([app.settings.regionalEvidence,app.settings.ideologyStrength,app.parties.map(p=>[p.target,...Object.keys(axes).map(k=>p[k])])]);
    if(ideologicalCache?.key!==key||ideologicalCache?.municipis!==municipis){
      const regions=[...municipis,...(window.CATALONIA_MUNICIPAL_DATA?.overseas||[])];
      ideologicalCache={key,municipis,rows:calibrated(regions)};
    }
    // Manual local overrides are applied after nationally calibrated preferences.
    return ideologicalCache.rows.map(applyRegionalScenario);
  }
  function ideologicalAggregate(rows,region,predicate){
    const members=rows.filter(r=>predicate(r.region));
    return {region,votes:app.parties.map((_,i)=>sum(members.map(r=>r.votes[i]))),blank:region.blank||0};
  }
  function biasedVotes(region,votes){
    const key=region.code||region.name,bias={...(app.regionBias[region.comarca]||{}),...(app.regionBias[key]||{})};
    const weights=votes.map((v,i)=>v*Math.exp((bias[app.parties[i].id]||0)/15));
    const total=sum(votes),adjusted=sum(weights);return weights.map(v=>adjusted?v/adjusted*total:0);
  }
  function applyRegionalScenario(row){return {...row,votes:biasedVotes(row.region,row.votes)};}


  function regionalProvinces(){
    if(app.settings.model==='ideological'&&municipis){const rows=ideologicalMunicipalRows();const codes={Barcelona:'08',Girona:'17',Lleida:'25',Tarragona:'43'};return data.constituencies.map(region=>ideologicalAggregate(rows,region,m=>m.code.slice(0,2)===codes[region.name]));}
    const provinces=calibrated(data.constituencies).map(applyRegionalScenario);
    if(!municipis||!Object.keys(app.regionBias).length)return provinces;
    const provinceNames={'08':'Barcelona','17':'Girona','25':'Lleida','43':'Tarragona'};
    const changes=provinces.map(()=>app.parties.map(()=>0));
    for(const m of municipis){
      const bias={...(app.regionBias[m.comarca]||{}),...(app.regionBias[m.code]||{})};if(!Object.values(bias).some(Boolean))continue;
      const index=provinces.findIndex(r=>r.region.name===provinceNames[m.code.slice(0,2)]);if(index<0)continue;
      const province=provinces[index];
      const votes=app.parties.map((p,j)=>{const historical=province.region.votes[p.id]||0;return historical?(m.votes[p.id]||0)*province.votes[j]/historical:sum(Object.values(m.votes))*p.target/sum(app.parties.map(p=>p.target));});
      const weights=votes.map((v,j)=>v*Math.exp((bias[app.parties[j].id]||0)/15));const total=sum(votes),weighted=sum(weights);
      weights.forEach((v,j)=>changes[index][j]+=(weighted?v/weighted*total:0)-votes[j]);
    }
    return provinces.map((r,i)=>{const total=sum(r.votes),adjusted=r.votes.map((v,j)=>Math.max(0,v+changes[i][j])),den=sum(adjusted);return {...r,votes:adjusted.map(v=>den?v/den*total:0)};});
  }

  function entities() {
    const groups=new Map();
    app.parties.forEach((p,i)=>{
      const bloc=app.blocs.find(b=>b.name===p.alliance&&b.type==='electoral');
      const id=bloc?'alliance:'+bloc.name:'party:'+p.id;
      if(!groups.has(id))groups.set(id,{id,name:bloc?.name||p.name,color:bloc?.color||p.color,members:[]});
      groups.get(id).members.push(i);
    });
    return [...groups.values()];
  }
  function allocate(votes,blank,seats,method,threshold) {
    const valid=sum(votes)+blank;
    const eligible=votes.map((v,i)=>({v,i})).filter(r=>r.v>0 && r.v>=valid*threshold/100);
    const counts=votes.map(()=>0);
    if(!eligible.length)return counts;
    if(method==='hare') {
      const quota=sum(eligible.map(r=>r.v))/seats;
      eligible.forEach(r=>{counts[r.i]=Math.floor(r.v/quota);r.remainder=r.v/quota-counts[r.i];});
      const order=[...eligible].sort((a,b)=>b.remainder-a.remainder||b.v-a.v||a.i-b.i);
      for(let i=0,left=seats-sum(counts);i<left;i++)counts[order[i%order.length].i]++;
    } else {
      for(let seat=0;seat<seats;seat++) {
        const best=[...eligible].sort((a,b)=>{
          const qa=a.v/(method==='sainte'?2*counts[a.i]+1:counts[a.i]+1);
          const qb=b.v/(method==='sainte'?2*counts[b.i]+1:counts[b.i]+1);
          return qb-qa||b.v-a.v||a.i-b.i;
        })[0];
        counts[best.i]++;
      }
    }
    return counts;
  }
  function calculate() {
    const groups=entities();
    const provinces=regionalProvinces(), comarques=app.settings.model==='ideological'&&municipis?data.comarques.map(region=>ideologicalAggregate(ideologicalMunicipalRows(),region,m=>m.comarca===region.code)):calibrated(data.comarques).map(applyRegionalScenario);
    let regions=provinces,seatCounts=data.constituencies.map(r=>r.seatsAvailable);
    if(app.settings.districts==='national') {
      regions=[{region:{name:'Catalunya'},votes:app.parties.map((_,i)=>sum(provinces.map(r=>r.votes[i]))),blank:sum(provinces.map(r=>r.blank))}];seatCounts=[135];
    } else if(app.settings.districts==='comarques') {
      regions=comarques;
      const weights=regions.map(r=>sum(r.votes));
      // One guaranteed seat per comarca; remaining 93 by 2015 candidature turnout.
      const extras=allocate(weights,0,135-regions.length,'hare',0);seatCounts=extras.map(x=>x+1);
    }
    const allocated=regions.map((r,i)=>{
      const votes=groups.map(g=>sum(g.members.map(j=>r.votes[j])));
      return {...r,groupVotes:votes,seats:allocate(votes,r.blank,seatCounts[i],app.settings.method,app.settings.threshold),available:seatCounts[i]};
    });
    const total=sum(provinces.map(r=>sum(r.votes)));
    const rows=groups.map((g,j)=>({...g,seats:sum(allocated.map(r=>r.seats[j])),votes:sum(provinces.map(r=>sum(g.members.map(i=>r.votes[i]))))}));
    const error=Math.max(...app.parties.map((p,j)=>Math.abs(sum(provinces.map(r=>r.votes[j]))/total*100-p.target/sum(app.parties.map(p=>p.target))*100)));
    return {groups,allocated,rows,total,comarques,error};
  }
  function slider(key,p){const labels=axes[key];return '<label class="cat-profile-slider"><span>'+labels[0]+' <output>'+Math.round(p[key])+'</output></span><input type="range" min="0" max="100" value="'+p[key]+'" data-field="'+key+'" aria-label="'+labels[0]+'"><small>'+labels[1]+' ↔ '+labels[2]+'</small></label>';}

  function renderBlocs(){
    const list=$('cat-blocs');if(!list)return;
    list.innerHTML=app.blocs.map(b=>{const members=app.parties.filter(p=>p.alliance===b.name);return '<article class="bloc-chip cat-bloc" style="--bloc:'+b.color+'"><span class="cat-bloc-dot" style="background:'+b.color+'"></span><strong>'+esc(b.name)+'</strong><b>'+esc(b.short)+'</b><span>'+members.map(p=>esc(p.name)).join(' + ')+'</span><select data-bloc-type="'+esc(b.id)+'" aria-label="Bloc type"><option value="electoral" '+(b.type==='electoral'?'selected':'')+'>Electoral · pool votes</option><option value="coalition" '+(b.type==='coalition'?'selected':'')+'>Coalition · combine seats</option></select><button class="election-btn small" data-delete-bloc="'+esc(b.id)+'">Clear</button><small>'+sum(members.map(p=>p.target)).toFixed(1)+'% target vote · '+members.length+' members</small></article>';}).join('');
  }
  function coalitionRows(){const grouped=new Map();for(const row of results.rows){const p=app.parties[row.members[0]],bloc=app.blocs.find(b=>b.name===p.alliance);const key=bloc?.id||row.id;if(!grouped.has(key))grouped.set(key,{...row,name:bloc?.name||row.name,color:bloc?.color||row.color,seats:0,members:[]});const g=grouped.get(key);g.seats+=row.seats;g.members.push(...row.members);}return [...grouped.values()];}

  function renderEditor() {
    renderBlocs();
    const opened=new Set([...$('editor').querySelectorAll('details[open]')].map(el=>el.closest('[data-party]').dataset.party));
    $('editor').innerHTML=app.parties.map(p=>'<article class="party-edit-card" data-party="'+esc(p.id)+'" style="--party:'+p.color+'"><div class="party-edit-main"><div class="edit-photo-stack">'+photoMarkup(p,'edit-photo')+'</div><div class="edit-fields"><div class="edit-line three"><input data-field="candidate" value="'+esc(p.candidate)+'" placeholder="Candidate name" aria-label="Candidate name"><input data-field="target" type="number" min="0" max="100" step="0.1" value="'+Number(p.target.toFixed(4))+'" aria-label="Vote target percent"><input type="color" data-field="color" value="'+p.color+'" aria-label="Party color"></div><div class="edit-line two"><input data-field="name" value="'+esc(p.name)+'" aria-label="Party name"><select data-field="alliance" aria-label="Electoral bloc"><option value="">No bloc</option>'+app.blocs.map(b=>'<option value="'+esc(b.name)+'" '+(b.name===p.alliance?'selected':'')+'>'+esc(b.short+' · '+b.name)+'</option>').join('')+'</select></div><div class="edit-line cat-tag-line"><label>Party tag<input data-field="short" maxlength="8" value="'+esc(p.short||partyTag(p))+'" aria-label="Party tag"></label><label class="cat-historical-reference">Historical geography only<select data-field="evidenceParty" aria-label="2024 electoral geography"><option value="">No 2024 reference</option>'+Object.entries(evidence?.parties||{}).map(([id,v])=>'<option value="'+esc(id)+'" '+(id===p.evidenceParty?'selected':'')+'>'+esc(v.short)+'</option>').join('')+'</select></label><button class="election-btn small" data-profile="'+esc(p.id)+'" '+(p.evidenceParty?'':'disabled')+'>Use suggested sliders</button></div><div class="image-status-row"><span>'+esc(p.imageStatus||'Wikipedia portrait lookup')+'</span><button class="election-btn small" data-photo="'+esc(p.id)+'">Find portrait</button><label class="image-upload visible">Upload<input type="file" accept="image/png,image/jpeg,image/webp" data-upload="'+esc(p.id)+'"></label></div></div><button class="remove-party" data-remove="'+esc(p.id)+'" aria-label="Remove party">×</button></div><details class="party-dropdown" '+(opened.has(p.id)?'open':'')+'><summary>Political profile and vote</summary><div class="slider-grid">'+Object.keys(axes).map(k=>slider(k,p)).join('')+'</div><p class="notice">Profiles are editable assumptions. Choose Ideological mode to apply them; Historical mode uses selected electoral geography. Ideological mode ignores scenario party names and references: sliders and national targets determine municipal support.</p></details></article>').join('');
  }
  function render() {
    results=calculate();
    if($('cat-ideology-strength-value'))$('cat-ideology-strength-value').textContent=app.settings.ideologyStrength+' / 100';
    if($('ideologyStrength'))$('ideologyStrength').disabled=app.settings.model!=='ideological';
    root.querySelectorAll('.cat-historical-reference').forEach(el=>el.hidden=app.settings.model==='ideological');
    root.querySelectorAll('[data-cat-model]').forEach(b=>{b.classList.toggle('active',b.dataset.catModel===app.settings.model);b.setAttribute('aria-pressed',String(b.dataset.catModel===app.settings.model));});
    const reporting=app.settings.reporting;
    const nationalCounts=electionCounts();
    const counted=results.comarques.map(localCount);
    const countedVotes=results.rows.map(g=>sum(nationalCounts.map(c=>sum(g.members.map(i=>c.votes[i])))));
    const countedTotal=sum(countedVotes);
    $('reporting-value').textContent=reporting.toFixed(1)+'% timeline · '+counted.filter(c=>c.called).length+'/'+counted.length+' comarques called';
    const ranked=[...results.rows].sort((a,b)=>b.seats-a.seats||b.votes-a.votes);
    $('cards').innerHTML=ranked.filter(r=>r.votes>0).map(r=>{const p=app.parties[[...r.members].sort((a,b)=>app.parties[b].target-app.parties[a].target)[0]];return `<article class="candidate-card ${r.seats>=68?'winner':''}" style="--party:${r.color};--bloc:${r.color};--card:${r.color}"><div class="candidate-photo-stack">${photoMarkup(p,'candidate-photo')}</div><div class="candidate-info"><div class="candidate-tags"><span class="candidate-short">${esc(r.members.length>1?(app.blocs.find(b=>'alliance:'+b.name===r.id)?.short||'BLOC'):(p.short||partyTag(p)))}</span></div><div class="candidate-name-line"><strong title="${esc(p.candidate||p.name)}">${esc(p.candidate||p.name)}</strong></div><em title="${esc(r.name)}">${esc(r.name)}</em></div><div class="candidate-score"><strong>${r.seats}</strong><span>${reporting<100?'Provisional seats':'Seats'}</span><small>${r.confirmedSeats} confirmed</small></div><div class="candidate-meta"><span>${(reporting===100?r.votes/results.total*100:countedTotal?countedVotes[results.rows.indexOf(r)]/countedTotal*100:0).toFixed(2)}% counted vote</span><span>${Math.round(reporting===100?r.votes:countedVotes[results.rows.indexOf(r)]).toLocaleString()} votes</span></div></article>`;}).join('');
    $('seat-bar').innerHTML=ranked.filter(r=>r.seats).map(r=>`<div style="width:${r.seats/135*100}%;background:${r.color}" title="${esc(r.name)} · ${r.seats}"></div>`).join('');
    if($('cat-seat-legend'))$('cat-seat-legend').innerHTML=ranked.filter(r=>r.seats).map(r=>`<span><i style="background:${r.color}"></i>${esc(r.name)}<b>${r.seats}</b></span>`).join('');
    if($('cat-map-legend'))$('cat-map-legend').innerHTML='<span><i style="background:#aab9c7"></i>Not called</span>'+ranked.filter(r=>r.votes).map(r=>`<span><i style="background:${r.color}"></i>${esc(r.name)}</span>`).join('');
    const assigned=sum(ranked.map(r=>r.seats));
    $('majority').textContent=assigned+'/135 '+(reporting<100?'projected':'allocated')+' · 68 for majority';
    if($('cat-call-feed'))$('cat-call-feed').innerHTML='<h3>Called comarques</h3>'+results.comarques.map((r,i)=>({r,c:counted[i]})).filter(x=>x.c.called).slice(0,8).map(({r,c})=>'<div class="result-row"><b>'+esc(r.region.name)+'</b><span style="color:'+c.grouped[0].color+'">'+esc(c.grouped[0].name)+'</span></div>').join('')+(counted.some(c=>c.called)?'':'<p class="notice">Waiting for the first assured winner…</p>');
    $('rules').textContent=app.settings.districts==='provinces' && app.settings.method==='dhondt' && app.settings.threshold===3 ? 'Actual Catalan rules · Barcelona 85 / Girona 17 / Lleida 15 / Tarragona 18 · 3% of valid votes, including blanks.' : `Hypothetical rules · ${app.settings.districts==='comarques'?'one seat per comarca, then remaining seats by 2015 candidature turnout':app.settings.districts==='national'?'135 seats in one constituency':'historical constituency seat counts'} · ${app.settings.threshold}% threshold, including blanks.`;
    $('status').textContent=assigned<135&&reporting===100?'Some constituencies have no list above the threshold; their seats remain unallocated.':results.error>0.01?'Target votes cannot be matched with historical ballot access. Reduce geographically restricted minor-party targets or add a new nationwide party.':'';
    $('transfer').disabled=reporting<100 || assigned!==135;
    $('government').innerHTML=ranked.map(r=>`<label class="result-row"><span><input type="checkbox" data-government="${esc(r.id)}" ${app.government.includes(r.id)?'checked':''}> ${esc(r.name)}</span><b>${r.seats}</b></label>`).join('');
    renderGovernment();
    $('regions').innerHTML=results.allocated.map(r=>`<div class="result-row"><b>${esc(r.region.name)}</b><small>${r.seats.map((s,i)=>s?esc(results.groups[i].name)+': '+s:'').filter(Boolean).join(' · ')}<br>${r.countProgress.toFixed(1)}% counted · ${r.complete?'Final':'Provisional'} · ${sum(r.seats)}/${r.available} seats</small></div>`).join('');
    renderChamber();renderMap();renderDetail();save();
  }
  function chamberDotCounts(values, totalUnits, dotCount) {
    const safeTotal = Math.max(1, Number(totalUnits) || values.reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0));
    const exactRows = values.map((value, index) => {
      const units = Math.max(0, Number(value) || 0);
      const exact = units / safeTotal * dotCount;
      const count = Math.floor(exact);
      return { index, units, count, remainder: exact - count };
    });
    let assigned = exactRows.reduce((sum, row) => sum + row.count, 0);
    exactRows
      .filter(row => row.units > 0)
      .sort((a, b) => b.remainder - a.remainder || b.units - a.units || a.index - b.index)
      .forEach(row => {
        if (assigned < dotCount) {
          row.count += 1;
          assigned += 1;
        }
      });
    let cursor = exactRows.length - 1;
    while (assigned < dotCount && exactRows.length) {
      exactRows[Math.max(0, cursor)].count += 1;
      assigned += 1;
      cursor = cursor <= 0 ? exactRows.length - 1 : cursor - 1;
    }
    return exactRows.sort((a, b) => a.index - b.index).map(row => row.count);
  }

  function chamberSeatPositions(dotCount) {
    const rows = 5;
    const houseMode = dotCount > 300;
    const gap = houseMode ? 0.20 : 0.07;
    const angleRange = Math.PI - gap * 2;
    const radii = Array.from({ length: rows }, (_item, row) => 68 + (row / (rows - 1)) * 96);
    const totalCircumference = radii.reduce((sum, radius) => sum + Math.PI * radius, 0);
    const counts = chamberDotCounts(
      radii.map(radius => Math.PI * radius),
      totalCircumference,
      dotCount,
    );
    const positions = [];
    const width = 620;
    const height = 310;
    const centerX = width / 2;
    const centerY = 270;
    const horizontalScale = houseMode ? 1.68 : 1.36;
    const verticalScale = houseMode ? 1.12 : 1;
    radii.forEach((radius, row) => {
      const count = Math.max(1, counts[row] || 0);
      for (let index = 0; index < count; index += 1) {
        const frac = (index + 0.5) / count;
        const angle = Math.PI + gap + frac * angleRange;
        positions.push({
          frac,
          row,
          x: (centerX + radius * horizontalScale * Math.cos(angle)) / width * 100,
          y: (centerY + radius * verticalScale * Math.sin(angle)) / height * 100,
        });
      }
    });
    return positions.sort((a, b) => a.frac - b.frac || a.row - b.row).slice(0, dotCount);
  }


  function renderChamber(){
    const card=$('cat-chamber');if(!card)return;
    const rows=app.settings.chamberView==='party'?app.parties.map((p,i)=>({name:p.name,color:p.color,seats:sum(results.allocated.map(r=>{const g=results.groups.findIndex(g=>g.members.includes(i));const members=results.groups[g].members;if(members.length===1)return r.seats[g];const split=allocate(members.map(j=>r.votes[j]),0,r.seats[g],'hare',0);return split[members.indexOf(i)];}))})):coalitionRows();
    const ranked=[...rows].sort((a,b)=>{const pa=app.parties.find(p=>p.name===a.name),pb=app.parties.find(p=>p.name===b.name);return (pb?.economic||50)-(pa?.economic||50);});
    const seats=ranked.flatMap(r=>Array.from({length:r.seats},()=>r));while(seats.length<135)seats.push({name:'Awaiting votes',color:'#64748b'});
    const majority=rows.find(r=>r.seats>=68);card.classList.toggle('has-majority-party',!!majority);card.style.setProperty('--majority-color',majority?.color||'#fbbf24');
    card.innerHTML='<div class="chamber-head"><div><span class="election-kicker">Parlament de Catalunya</span><h3>135 seats · '+(app.settings.reporting<100?'projections':'final result')+'</h3></div><div class="chamber-head-actions"><div class="chamber-view-toggle"><button data-group="bloc" class="'+(app.settings.chamberView==='bloc'?'active':'')+'">Bloc</button><button data-group="party" class="'+(app.settings.chamberView==='party'?'active':'')+'">Party</button></div><strong>68 majority</strong></div></div><div class="chamber-hemicycle senate" style="--seat-size:8px"><span class="chamber-majority-line"><b>68</b></span><div class="chamber-floor"><span>Majority</span><b>68</b></div>'+chamberSeatPositions(135).map((pos,i)=>'<span class="chamber-seat" style="--x:'+pos.x+'%;--y:'+pos.y+'%;--party:'+seats[i].color+'" title="'+esc(seats[i].name)+'"></span>').join('')+'</div><div class="chamber-legend">'+rows.filter(r=>r.seats).map(r=>'<span><i style="background:'+r.color+'"></i><b>'+esc(r.name)+'</b><em>'+r.seats+'</em></span>').join('')+'</div>';
  }

  function renderGovernment() {
    const seats=sum(results.rows.filter(r=>app.government.includes(r.id)).map(r=>r.seats));
    $('government-result').innerHTML=`<strong>${seats} / 68 seats</strong><p>${seats>=68?'Absolute majority · '+(seats-68)+' above threshold':(68-seats)+' seats short of an absolute majority'}</p>`;
  }
  function mapWinner(row) {
    const votes=results.groups.map(g=>sum(g.members.map(i=>row.votes[i])));
    const index=votes.indexOf(Math.max(...votes));return results.groups[index];
  }
  // Presentation only: coalition pooling and seat allocation remain unchanged.
  function mapCount(row) {
    const local=localCount(row);
    const winner=local.grouped[0];
    if(app.settings.mapView!=='party')return {...local,winner};
    const grouped=app.parties.map((p,i)=>({...p,index:i,votes:local.votes[i]||0})).sort((a,b)=>b.votes-a.votes);
    const member=grouped.find(p=>winner.members.includes(p.index));
    return {...local,grouped,winner:member||grouped[0]};
  }
  function renderMap() {
    root.querySelectorAll('[data-cat-map-view]').forEach(button=>{
      const active=button.dataset.catMapView===app.settings.mapView;
      button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
    });
    const layer=$('map-layer');
    if(selected && municipis){
      const rows=municipalRows();
      layer.innerHTML=rows.filter(r=>r.region.path).map(row=>`<path tabindex="0" role="button" aria-label="${esc(row.region.name)}" data-municipi="${row.region.code}" d="${row.region.path}" fill="${mapCount(row).called?mapCount(row).winner.color:'#aab9c7'}" class="${selectedMunicipi===row.region.code?'selected':''}"><title>${esc(row.region.name)}</title></path>`).join('');
      const boxes=rows.filter(r=>r.region.bbox).map(r=>r.region.bbox);
      if(boxes.length){const x=Math.min(...boxes.map(b=>b[0])),y=Math.min(...boxes.map(b=>b[1])),w=Math.max(...boxes.map(b=>b[2]))-x,h=Math.max(...boxes.map(b=>b[3]))-y;$('map').setAttribute('viewBox',`${x-3} ${y-3} ${w+6} ${h+6}`);}
      if($('cat-map-level'))$('cat-map-level').textContent=data.comarques.find(c=>c.code===selected).name+' · Municipis';
      if($('cat-back-comarques'))$('cat-back-comarques').hidden=false;
      if($('cat-municipal-list')){$('cat-municipal-list').hidden=false;$('cat-municipal-list').innerHTML='<h3>Municipis</h3>'+rows.map(row=>`<button class="election-btn small" data-municipi="${row.region.code}">${esc(row.region.name)}</button>`).join('');}
      return;
    }
    $('map').setAttribute('viewBox','0 0 640 640');
    if($('cat-map-level'))$('cat-map-level').textContent='Comarques';
    if($('cat-back-comarques'))$('cat-back-comarques').hidden=true;
    if($('cat-municipal-list'))$('cat-municipal-list').hidden=true;
    layer.innerHTML=data.comarques.map(c=>`<path tabindex="0" role="button" aria-label="${esc(c.name)}" data-comarca="${c.code}" d="${c.path}"><title>${esc(c.name)}</title></path>`).join('')+data.comarques.map(c=>`<text x="${c.center[0]}" y="${c.center[1]}">${esc(c.name)}</text>`).join('');
    results.comarques.forEach(row=>{
      const path=layer.querySelector(`[data-comarca="${row.region.code}"]`);const local=mapCount(row);path.setAttribute('fill',local.called?local.winner.color:local.progress>0?`color-mix(in srgb, ${local.winner.color} 35%, #aab9c7)`:'#aab9c7');path.classList.toggle('selected',row.region.code===selected);
    });
    layer.querySelectorAll('text').forEach(t=>{t.style.display=app.settings.labels?'':'none';});
  }
  function renderDetail() {
    const row=selectedMunicipi?municipalRows().find(r=>r.region.code===selectedMunicipi):results.comarques.find(r=>r.region.code===selected);
    if(!row){$('detail').innerHTML='<span class="election-kicker">Local results</span><h3>Explore the map</h3><p class="notice">Select a comarca to explore its vote shares, regional controls and municipalities.</p>';return;}
    const local=mapCount(row),total=sum(local.votes),votes=local.grouped;
    const baseline=terrain(row.region);
    $('detail').innerHTML=`<h3 class="detail-title">${esc(row.region.name)}</h3><p class="notice">${local.progress.toFixed(1)}% reporting · ${local.called?'Called for '+esc(local.winner.name):'Not called'}</p>${votes.filter(g=>g.votes>0).map(g=>`<div class="result-row cat-local-result" style="--party:${g.color}"><b><i class="cat-result-dot"></i>${esc(g.name)}</b><span>${(total?g.votes/total*100:0).toFixed(2)}%</span><div class="cat-result-track"><i style="width:${total?g.votes/total*100:0}%"></i></div></div>`).join('')}<p class="notice">${app.settings.model==='ideological'?'Slider-driven municipal preferences, calibrated to national vote targets. Municipal votes feed into constituency seats.':selectedMunicipi?(app.settings.regionalEvidence==='2024'?'2024 municipal vote patterns scaled to the scenario’s 2015 turnout.':'2015 municipal votes adjusted by national vote-strength ratios.')+' Local estimates are not reconciled to constituency totals.':'Simulated comarca results, using '+app.settings.regionalEvidence+' electoral geography.'} Shares exclude blank ballots.</p><details class="party-dropdown"><summary>Regional profile &amp; biases</summary>${regionalProfileMarkup(row.region,baseline)}<div class="cat-region-bias">${app.parties.map(p=>`<label>${esc(p.name)}<input type="number" min="-30" max="30" step="1" value="${app.regionBias[row.region.code||row.region.name]?.[p.id]||0}" data-bias-party="${esc(p.id)}" data-region="${esc(row.region.code||row.region.name)}" aria-label="${esc(p.name)} regional bias"></label>`).join('')}</div><p class="notice">−30 to +30 local relative-strength adjustment. Region edits may change national shares.</p></details>`;
  }
  function regionalProfileMarkup(region,baseline){
    const ref=regionEvidence(region),modern=app.settings.regionalEvidence==='2024'&&ref;
    const scores=Object.keys(axes).map(k=>{const value=Math.round(baseline[k]/5)*5;return `<div class="cat-fit-axis"><span>${esc(axes[k][0])}<b>${value}</b></span><meter min="0" max="100" value="${value}" aria-label="${esc(axes[k][0])} estimated fit">${value}</meter><small>${esc(axes[k][1])} ↔ ${esc(axes[k][2])}</small></div>`;}).join('');
    const shares=ref?Object.entries(ref.votes).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id,v])=>`<span>${esc(evidence.parties[id].short)} <b>${(v/ref.total*100).toFixed(1)}%</b></span>`).join(''):'';
    return `<p class="notice">${modern?'2024 electoral':'2015 electoral'} profile · suggested slider fit, rounded to 5. Estimates describe this model, not a survey of local residents.</p><div class="cat-fit-grid">${scores}</div>${ref?`<div class="cat-observed"><span class="election-kicker">Observed 2024 candidature votes</span><div>${shares}</div><p class="notice">${ref.coverage.toFixed(1)}% of candidature votes covered by modeled parties. ${ref.population?.toLocaleString()||'No'} population record (2025).</p></div>`:''}<p class="notice">${modern?'Social, economic and national-position scores average assumed party positions using local votes. Organization has a smaller model weight. Rural / metropolitan uses municipal population-size bands, not a metro-area boundary.':'Switch Regional evidence to 2024 for updated voting patterns and population-size geography.'} Ideological mode compares your party’s sliders with the full mixture of local profiles, not just this average. National targets are calibrated across municipalities; local results feed into seats.</p><a class="cat-research-link" href="catalonia-regional-research.html" target="_blank" rel="noopener">Research, slider definitions &amp; sources ↗</a>`;
  }
  function municipalRows(comarca=selected){
    if(!municipis)return [];
    if(app.settings.model==='ideological')return ideologicalMunicipalRows().filter(r=>!comarca||r.region.comarca===comarca);
    const targetSum=sum(app.parties.map(p=>p.target));
    return municipis.filter(m=>!comarca||m.comarca===comarca).map(m=>{
      const total=sum(Object.values(m.votes));
      const weights=app.parties.map(p=>{
        const ref=app.settings.regionalEvidence==='2024'&&p.evidenceParty&&regionEvidence(m);
        if(ref){const national=evidence.regions;const all=sum(['Barcelona','Girona','Lleida','Tarragona'].map(k=>national[k].votes[p.evidenceParty]||0)),den=sum(['Barcelona','Girona','Lleida','Tarragona'].map(k=>national[k].total));return all?(ref.votes[p.evidenceParty]||0)*(p.target/targetSum)/(all/den)*total/ref.total:0;}
        const historical=(historicalTotals[p.id]||0)/totalHistorical;
        return historical?(m.votes[p.id]||0)*(p.target/targetSum)/historical:total*p.target/targetSum;
      });
      const weightSum=sum(weights);
      return {region:m,votes:biasedVotes(m,weights.map(v=>weightSum?v/weightSum*total:0))};
    });
  }
  async function openComarca(code){
    selected=code;selectedMunicipi=null;camera.x=0;camera.y=0;camera.z=1;paint();renderDetail();
    if(!municipalLoading)municipalLoading=new Promise((resolve,reject)=>{
      if(window.CATALONIA_MUNICIPAL_DATA){municipis=window.CATALONIA_MUNICIPAL_DATA.municipis;resolve();return;}
      const script=document.createElement('script');script.src=new URL('catalonia-municipal-data.js?v=20261011-blocs5',assetBase).href;
      script.onload=()=>{municipis=window.CATALONIA_MUNICIPAL_DATA.municipis;resolve();};
      script.onerror=()=>{script.remove();municipalLoading=null;reject(Error('Could not load municipal results.'));};document.body.append(script);
    });
    try{await municipalLoading;render();}catch(e){$('status').textContent=e.message;}
  }
  function sync(){for(const key of ['model','regionalEvidence','ideologyStrength','districts','method','threshold','reporting','countSpeed','labels']){const el=$(key);if(!el)continue;if(key==='labels')el.checked=app.settings[key];else el.value=app.settings[key];}renderEditor();render();}
  function stop(){tooltip?.classList.remove('visible');clearInterval(timer);timer=null;$('play').textContent='▶ Count';}
  ['model','regionalEvidence','districts','method','threshold','labels'].forEach(key=>$(key)?.addEventListener('change',e=>{app.settings[key]=key==='labels'?e.target.checked:key==='threshold'?clamp(e.target.value,0,30,3):e.target.value;render();}));
  $('ideologyStrength')?.addEventListener('input',e=>{app.settings.ideologyStrength=clamp(e.target.value,0,100,70);render();});
  $('countSpeed')?.addEventListener('change',e=>{app.settings.countSpeed=clamp(e.target.value,.25,8,1);save();});
  $('reporting').addEventListener('input',e=>{app.settings.reporting=Number(e.target.value);render();});
  $('play').addEventListener('click',()=>{if(timer){stop();return;}if(app.settings.reporting>=100)app.settings.reporting=0;timer=setInterval(()=>{app.settings.reporting=Math.min(100,app.settings.reporting+0.5*app.settings.countSpeed);$('reporting').value=app.settings.reporting;render();if(app.settings.reporting===100)stop();},650);$('play').textContent='Pause';});
  $('government').addEventListener('change',e=>{const id=e.target.dataset.government;if(!id)return;app.government=app.government.filter(x=>x!==id);if(e.target.checked)app.government.push(id);renderGovernment();save();});
  $('editor').addEventListener('change',e=>{
    const p=app.parties.find(p=>p.id===e.target.closest('[data-party]')?.dataset.party),field=e.target.dataset.field;if(!p||!field)return;
    const value=field==='target'||axes[field]?clamp(e.target.value,0,100):String(e.target.value).slice(0,120);
    if(field==='target' && value===0 && !app.parties.some(other=>other!==p&&other.target>0)){e.target.value=p.target;return;}
    p[field]=field==='short'?(value.trim().slice(0,8)||partyTag(p)):field==='alliance'?value.trim():value;if(field==='evidenceParty')renderEditor();if(axes[field]){const output=e.target.closest('label')?.querySelector('output');if(output)output.textContent=value;}if(field==='candidate'){p.image='';p.imageStatus='Looking up Wikipedia…';fetchPortrait(p.id,p.candidate);}render();
  });
  $('editor').addEventListener('click',e=>{const id=e.target.dataset.remove;if(!id||app.parties.length<=1)return;if(!confirm('Remove this party from your scenario?'))return;app.parties=app.parties.filter(p=>p.id!==id);if(!app.parties.some(p=>p.target>0))app.parties[0].target=100;sync();});
  $('add').addEventListener('click',()=>{if(app.parties.length>=50)return;app.parties.push({id:'custom-'+crypto.randomUUID(),name:'New party',color:'#49b3c5',target:1,alliance:'',...profileDefaults('custom')});sync();});
  $('restore').addEventListener('click',()=>{if(confirm('Replace this scenario with the original 2015 election? Export first if you want to keep it.')){stop();app=defaults();sync();}});
  $('export').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(app,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='catalunya-scenario.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  $('import').addEventListener('change',async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>20000000)throw Error('Scenario file is too large.');const next=validate(JSON.parse(await file.text()));if(confirm('Replace the current scenario with this import?')){stop();app=next;sync();}}catch(error){$('status').textContent='Import failed: '+error.message;}e.target.value='';});
  $('transfer').addEventListener('click',()=>{
    if(app.settings.reporting<100 || sum(results.rows.map(r=>r.seats))!==135)return;
    if(!confirm('Replace the hemicycle parties with these 135 seats? Your Catalan scenario remains saved.'))return;
    try{const old=JSON.parse(localStorage.getItem('parliament_autosave')||'{}');const parties=results.rows.filter(r=>r.seats>0).map((r,i)=>({id:'p'+(i+1),name:r.name,color:r.color,seats:r.seats}));localStorage.setItem('parliament_autosave',JSON.stringify({...old,parties,votes:{},idCounter:parties.length+1,coalitionData:{name:'',partyIds:[],supportIds:[],passiveIds:[]}}));location.href='parliament.html';}catch{$('status').textContent='Could not save hemicycle transfer. Export your scenario instead.';}
  });
  const tooltip=document.createElement('div');tooltip.className='election-tooltip';document.body.append(tooltip);
  function hideTip(){tooltip.classList.remove('visible');}
  $('map').addEventListener('pointermove',e=>{
    if(gesture){hideTip();return;}
    const path=e.target.closest('[data-comarca],[data-municipi]');if(!path){hideTip();return;}
    const row=path.dataset.comarca?results.comarques.find(r=>r.region.code===path.dataset.comarca):municipalRows().find(r=>r.region.code===path.dataset.municipi);if(!row)return;
    const local=mapCount(row),total=sum(local.votes);
    tooltip.innerHTML='<strong>'+esc(row.region.name)+'</strong><em>'+local.progress.toFixed(1)+'% reporting · '+(local.called?'Called for '+esc(local.winner.name):'Not called')+'</em>'+local.grouped.slice(0,5).map(g=>'<div class="election-tip-row"><i style="background:'+g.color+'"></i><span>'+esc(g.name)+'</span><b>'+(total?g.votes/total*100:0).toFixed(1)+'%</b></div>').join('');
    tooltip.classList.add('visible');tooltip.style.left=Math.max(12,Math.min(e.clientX+16,innerWidth-tooltip.offsetWidth-12))+'px';tooltip.style.top=Math.max(12,Math.min(e.clientY+16,innerHeight-tooltip.offsetHeight-12))+'px';
  });
  $('map').addEventListener('pointerleave',hideTip);
  // Vector-only camera; no raster snapshots or per-wheel redraw of results.
  const camera={x:0,y:0,z:1};let raf=0,gesture=null,dragged=false;
  function paint(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;$('map-layer').setAttribute('transform',`translate(${camera.x} ${camera.y}) scale(${camera.z})`);});}
  function zoom(factor,x,y){const box=$('map').viewBox.baseVal;if(x===undefined)x=box.x+box.width/2;if(y===undefined)y=box.y+box.height/2;const next=clamp(camera.z*factor,1,8);const ratio=next/camera.z;camera.x=x-(x-camera.x)*ratio;camera.y=y-(y-camera.y)*ratio;camera.z=next;paint();}
  function point(e){const p=$('map').createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform($('map').getScreenCTM().inverse());}
  $('map').addEventListener('wheel',e=>{e.preventDefault();const p=point(e);zoom(Math.exp(-clamp(e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?640:1),-160,160)*0.0015),p.x,p.y);},{passive:false});
  $('zoom-in').onclick=()=>zoom(1.25);$('zoom-out').onclick=()=>zoom(0.8);$('zoom-reset').onclick=()=>{camera.x=0;camera.y=0;camera.z=1;paint();};
  $('map').addEventListener('pointerdown',e=>{if(e.button!==0)return;gesture={id:e.pointerId,start:point(e),x:camera.x,y:camera.y};dragged=false;});
  $('map').addEventListener('pointermove',e=>{if(!gesture||gesture.id!==e.pointerId)return;const p=point(e);if(Math.hypot(p.x-gesture.start.x,p.y-gesture.start.y)>4)dragged=true;if(!dragged)return;$('map').setPointerCapture(e.pointerId);$('map').classList.add('dragging');camera.x=gesture.x+p.x-gesture.start.x;camera.y=gesture.y+p.y-gesture.start.y;paint();});
  function finish(){gesture=null;$('map').classList.remove('dragging');}
  $('map').addEventListener('pointerup',finish);$('map').addEventListener('pointercancel',finish);
  function selectArea(e){const target=e.target.closest('[data-comarca],[data-municipi]');if(!target)return;if(target.dataset.comarca)openComarca(target.dataset.comarca);else{selectedMunicipi=target.dataset.municipi;renderMap();renderDetail();}}
  $('map').addEventListener('click',e=>{if(!dragged)selectArea(e);});
  $('map').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectArea(e);}});
  $('cat-municipal-list')?.addEventListener('click',selectArea);
  $('cat-back-comarques')?.addEventListener('click',()=>{selected=null;selectedMunicipi=null;camera.x=0;camera.y=0;camera.z=1;paint();renderMap();renderDetail();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});

  const pendingPhotos=new Set();
  async function fetchPortrait(id,name){
    if(!name.trim()||pendingPhotos.has(id))return;pendingPhotos.add(id);
    const p=app.parties.find(p=>p.id===id);if(!p){pendingPhotos.delete(id);return;}
    try{
      const response=await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(name.trim().replace(/\s+/g,'_')),{signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw Error('Wikipedia unavailable');const article=await response.json();
      if(p.candidate!==name||!app.parties.includes(p))return;
      const src=safeImage(article.thumbnail?.source||article.originalimage?.source);
      p.image=src;p.imageStatus=src?'Wikipedia portrait · '+article.title:'No Wikipedia portrait found. Upload one.';
    }catch{if(p.candidate===name)p.imageStatus='Wikipedia unavailable. Retry or upload a portrait.';}
    finally{pendingPhotos.delete(id);if(app.parties.includes(p)&&p.candidate===name){renderEditor();render();}else if(app.parties.includes(p)&&!p.image)fetchPortrait(id,p.candidate);}
  }
  $('editor').addEventListener('click',e=>{const p=app.parties.find(p=>p.id===e.target.dataset.profile),recommended=evidence?.parties[p?.evidenceParty];if(!p||!recommended)return;for(const key of Object.keys(axes))p[key]=recommended[key];renderEditor();render();});
  $('editor').addEventListener('click',e=>{const id=e.target.dataset.photo;if(id){const p=app.parties.find(p=>p.id===id);fetchPortrait(id,p.candidate);}});
  $('editor').addEventListener('change',async e=>{
    const p=app.parties.find(p=>p.id===e.target.dataset.upload);if(!p)return;const file=e.target.files?.[0];if(!file)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>1800000){p.imageStatus='Choose PNG, JPEG or WebP under 1.8 MB.';renderEditor();return;}
    const reader=new FileReader();reader.onload=()=>{p.image=safeImage(reader.result);p.imageStatus='Uploaded portrait';renderEditor();render();};reader.readAsDataURL(file);
  });
  $('detail').addEventListener('change',e=>{const id=e.target.dataset.biasParty,key=e.target.dataset.region;if(!id||!key)return;(app.regionBias[key]??={})[id]=clamp(e.target.value,-30,30,0);render();});
  root.addEventListener('click',e=>{
    const button=e.target.closest('[data-cat-map-view]');if(!button)return;
    app.settings.mapView=button.dataset.catMapView==='party'?'party':'bloc';
    hideTip();renderMap();renderDetail();save();
  });
  $('cat-chamber')?.addEventListener('click',e=>{const group=e.target.dataset.group;if(!group)return;app.settings.chamberView=group;renderChamber();save();});


  root.querySelectorAll('[data-cat-model]').forEach(button=>button.addEventListener('click',()=>{app.settings.model=button.dataset.catModel;if($('model'))$('model').value=app.settings.model;render();}));
  $('editor').addEventListener('input',e=>{
    const field=e.target.dataset.field;if(!axes[field])return;
    const p=app.parties.find(p=>p.id===e.target.closest('[data-party]')?.dataset.party);if(!p)return;p[field]=clamp(e.target.value,0,100);
    const output=e.target.closest('label')?.querySelector('output');if(output)output.textContent=Math.round(p[field]);
    render();
  });
  $('cat-make-bloc')?.addEventListener('click',()=>{
    const name=$('cat-bloc-name').value.trim().slice(0,80);if(!name)return;
    if(app.blocs.some(b=>b.name===name)){$('cat-bloc-status').textContent='A bloc with this name already exists.';return;}
    app.blocs.push({id:crypto.randomUUID(),name,short:$('cat-bloc-short').value.trim().slice(0,8)||name.slice(0,3).toUpperCase(),color:$('cat-bloc-color').value,type:$('cat-bloc-type').value});
    $('cat-bloc-name').value='';$('cat-bloc-status').textContent='Assign members using the bloc dropdown in each party card.';renderEditor();render();
  });
  $('cat-blocs')?.addEventListener('change',e=>{const b=app.blocs.find(b=>b.id===e.target.dataset.blocType);if(b){b.type=e.target.value;render();save();}});
  $('cat-blocs')?.addEventListener('click',e=>{const b=app.blocs.find(b=>b.id===e.target.dataset.deleteBloc);if(!b)return;app.parties.forEach(p=>{if(p.alliance===b.name)p.alliance='';});app.blocs=app.blocs.filter(x=>x!==b);renderEditor();render();});
  $('cat-import-parliament')?.addEventListener('click',()=>{
    let source=[];try{if(Array.isArray(parties))source=parties;}catch{}
    if(!source.length)try{source=JSON.parse(localStorage.getItem('parliament_autosave')||'{}').parties||[];}catch{}
    const usable=source.filter(p=>p.name&&(Number(p.seats)>0||Number(p.pollPct)>0));
    if(!usable.length){$('cat-bloc-status').textContent='No parliament parties with seats or vote percentages to import.';return;}
    if(!confirm('Replace Catalunya parties with the current parliament composition? Export your scenario first to keep it.'))return;
    const polls=sum(usable.map(p=>Math.max(0,Number(p.pollPct)||0))),seats=sum(usable.map(p=>Math.max(0,Number(p.seats)||0)));
    stop();app.parties=usable.slice(0,50).map((p,i)=>({...profileDefaults('custom'),id:'import-'+crypto.randomUUID(),name:p.name,short:String(p.short||p.tag||partyTag(p)).slice(0,8),evidenceParty:evidenceParty(p),candidate:p.candidate||p.leader||'',image:safeImage(p.image),color:/^#[0-9a-f]{6}$/i.test(p.color)?p.color:colors[i%colors.length],target:polls?Math.max(0,Number(p.pollPct)||0)/polls*100:Math.max(0,Number(p.seats)||0)/seats*100,alliance:'',social:clamp(p.social,0,100,50),economic:clamp(p.economic,0,100,50)}));
    app.settings.regionalEvidence='2024';app.blocs=[];app.government=[];app.regionBias={};sync();$('cat-bloc-status').textContent='Imported from parliament. Historical mode can use 2024 party references. In Ideological mode, every party is scored by its sliders and national target, regardless of its name.';
    app.parties.filter(p=>p.candidate&&!p.image).forEach(p=>fetchPortrait(p.id,p.candidate));
  });

  // Pure math hooks for baseline/regression tests; no mutable UI state exposed.
  window.CataloniaMath={allocate};
  window.CataloniaUI={pause:stop};
  sync();
  app.parties.filter(p=>p.candidate&&!p.image&&!p.imageStatus).forEach(p=>fetchPortrait(p.id,p.candidate));
})();
