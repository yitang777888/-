const DATA=window.DATA;
const KEY='xh_mindmap_v1';
let state=JSON.parse(localStorage.getItem(KEY)||'{}');
state.done=state.done||{};state.star=state.star||{};state.quiz=state.quiz||{};
function save(){localStorage.setItem(KEY,JSON.stringify(state));}
function today(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}

const tree=document.getElementById('tree');
const nodes=[]; // {id,node,depth,parentId,el,leaf,branch}
const branchLeaves={}; // chapterName(branch root name)-> [leaf ids]

function esc(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function tableHTML(rows){
  let h='<div class="tw"><table>';
  rows.forEach((r,ri)=>{h+='<tr>';r.forEach(c=>{h+=(ri===0?'<th>':'<td>')+esc(c)+(ri===0?'</th>':'</td>');});h+='</tr>';});
  return h+'</table></div>';
}
function buildNode(node,id,depth,parentId,bname){
  const el=document.createElement('div');
  el.className='node'+(depth===0?' b0 bcol-'+bname:'');
  el.dataset.id=id;
  const kids=node.children||[];
  const hasKids=kids.length>0;
  const isQuiz=!!node.quiz;
  const leaf=!hasKids && !isQuiz;
  const rec={id,node,depth,parentId,el,leaf,branch:bname,name:(node.name||'').toLowerCase(),detail:(node.detail||'').toLowerCase()};
  nodes.push(rec);
  if(leaf){branchLeaves[bname]=branchLeaves[bname]||[];branchLeaves[bname].push(id);}
  let row='<div class="row">';
  row+='<span class="chev'+((hasKids||isQuiz||leaf)?'':' empty')+'">'+((hasKids||isQuiz)?'▸':(leaf?'·':''))+'</span>';
  if(leaf) row+='<span class="chk" data-act="chk"></span>';
  row+='<span class="lbl" data-act="lbl"><span class="nm">'+esc(node.name)+'</span><span class="cnt"></span></span>';
  row+='<span class="star" data-act="star">★</span>';
  row+='</div>';
  el.innerHTML=row;
  const kc=document.createElement('div');kc.className='kids';el.appendChild(kc);
  if(hasKids){kids.forEach((c,i)=>kc.appendChild(buildNode(c,id+'-'+i,depth+1,id,bname)));}
  else if(isQuiz){rec.quiz=node.quiz;rec.kc=kc;}
  else{ // leaf detail lazy
    rec.kc=kc;rec.built=false;
  }
  return el;
}
// build branches; append quiz synthetic child for chapters with questions
DATA.branches.forEach((b,bi)=>{
  const bname=b.name;
  const el=buildNode(b,'b'+bi,0,null,bname);
  // quiz child
  if(b.ch && DATA.questions[b.ch] && DATA.questions[b.ch].length){
    const qn=DATA.questions[b.ch].length;
    const qel=buildNode({name:'巩固练习（'+qn+'题）',quiz:b.ch},'b'+bi+'-q',1,'b'+bi,bname);
    el.querySelector('.kids').appendChild(qel);
  }
  tree.appendChild(el);
});

const byId={};nodes.forEach(n=>byId[n.id]=n);

function buildDetail(rec){
  if(rec.built)return;rec.built=true;
  let h='';
  if(rec.node.detail) h+='<div class="detail">'+esc(rec.node.detail)+(rec.node.tables?rec.node.tables.map(tableHTML).join(''):'')+'</div>';
  else if(rec.node.tables) h+='<div class="detail">'+rec.node.tables.map(tableHTML).join('')+'</div>';
  else h+='<div class="detail" style="color:var(--mut)">（暂无要点文字）</div>';
  rec.kc.innerHTML=h;
}
function buildQuiz(rec){
  if(rec.built)return;rec.built=true;
  const list=DATA.questions[rec.quiz]||[];
  const types=[...new Set(list.map(x=>x.t))];
  let h='<div class="qz"><div class="qzbar"><span class="tag">共'+list.length+'题</span>';
  h+='<button class="mini qf on" data-t="全部">全部</button>';
  types.forEach(t=>h+='<button class="mini qf" data-t="'+t+'">'+t+'</button>');
  h+='<span class="tag" id="score-'+rec.id+'"></span></div><div class="qlist"></div></div>';
  rec.kc.innerHTML=h;
  rec.listEl=rec.kc.querySelector('.qlist');
  renderQuiz(rec,'全部');
  rec.kc.querySelectorAll('.qf').forEach(b=>b.onclick=()=>{rec.kc.querySelectorAll('.qf').forEach(x=>x.classList.remove('on'));b.classList.add('on');renderQuiz(rec,b.dataset.t);});
}
function renderQuiz(rec,filter){
  const list=DATA.questions[rec.quiz]||[];
  let n=0,right=0;
  let h='';
  list.forEach((x,i)=>{
    if(filter!=='全部'&&x.t!==filter)return;
    const key=rec.quiz+'|'+i;const g=state.quiz[key];
    if(g==='right')right++;if(g!=null)n++;
    const ansLabel=(x.t==='名词'||x.t==='简答')?'参考答案：':'正确答案：';
    h+='<div class="qitem'+(g?' g-'+g:'')+'" data-key="'+key+'"><div class="q"><span class="tag">'+x.t+'</span> '+esc(x.q)+'</div>';
    h+='<button class="mini" data-act="reveal">显示答案</button>';
    h+='<div class="ans">'+ansLabel+esc(x.a)+'<div class="gd"><button class="mini right" data-g="right">我答对了</button><button class="mini wrong" data-g="wrong">我答错了</button></div></div></div>';
  });
  rec.listEl.innerHTML=h||'<div style="color:var(--mut);padding:8px 0">本类暂无题目</div>';
  updateScore(rec);
  rec.listEl.querySelectorAll('.qitem').forEach(it=>{
    const key=it.dataset.key;
    it.querySelector('[data-act=reveal]').onclick=()=>it.classList.add('show');
    it.querySelectorAll('[data-g]').forEach(btn=>btn.onclick=()=>{state.quiz[key]=btn.dataset.g;save();it.classList.remove('g-right','g-wrong');it.classList.add('g-'+btn.dataset.g);updateScore(rec);});
  });
}
function updateScore(rec){
  const list=DATA.questions[rec.quiz]||[];let done=0,right=0;
  list.forEach((x,i)=>{const g=state.quiz[rec.quiz+'|'+i];if(g)done++;if(g==='right')right++;});
  const sc=document.getElementById('score-'+rec.id);if(sc)sc.textContent='已练 '+done+' · 对 '+right;
}

// apply saved state to checkboxes/stars
function applyState(){
  nodes.forEach(n=>{
    if(n.leaf){const c=n.el.querySelector('.chk');if(state.done[n.id]){c.classList.add('on');c.innerHTML='✓';}else{c.classList.remove('on');c.innerHTML='';}}
    const s=n.el.querySelector('.star');if(s){s.classList.toggle('on',!!state.star[n.id]);}
  });
}
function updateStats(){
  let total=0,done=0;
  nodes.forEach(n=>{if(n.leaf){total++;if(state.done[n.id])done++;}});
  const pct=total?Math.round(done/total*100):0;
  document.getElementById('ov-bar').style.width=pct+'%';
  document.getElementById('ov-txt').textContent=done+' / '+total+'（'+pct+'%）';
  const t=today();let tn=0;Object.values(state.done).forEach(d=>{if(d===t)tn++;});
  document.getElementById('today').textContent=tn;
  // streak
  const set=new Set(Object.values(state.done));
  let s=0;let d=new Date();
  function ds(dt){return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');}
  if(!set.has(ds(d)))d.setDate(d.getDate()-1);
  while(set.has(ds(d))){s++;d.setDate(d.getDate()-1);}
  document.getElementById('streak').textContent=s;
  // per-branch counts
  DATA.branches.forEach((b,bi)=>{
    const ids=branchLeaves[b.name]||[];let dn=0;ids.forEach(id=>{if(state.done[id])dn++;});
    const el=byId['b'+bi];if(el){const c=el.el.querySelector('.cnt');if(c)c.textContent=ids.length?('  '+dn+'/'+ids.length):'';}
  });
}

tree.addEventListener('click',e=>{
  const act=e.target.dataset.act;
  const nodeEl=e.target.closest('.node');if(!nodeEl)return;
  const rec=byId[nodeEl.dataset.id];
  if(e.target.classList.contains('chev')){toggle(rec);return;}
  if(act==='chk'){
    if(state.done[rec.id])delete state.done[rec.id];else state.done[rec.id]=today();
    save();applyState();updateStats();return;
  }
  if(act==='star'){if(state.star[rec.id])delete state.star[rec.id];else state.star[rec.id]=1;save();applyState();return;}
  if(act==='lbl'){toggle(rec);return;}
});
function toggle(rec){
  if(rec.quiz){if(!rec.built)buildQuiz(rec);rec.el.classList.toggle('open');return;}
  if(rec.leaf){if(!rec.built)buildDetail(rec);rec.el.classList.toggle('open');return;}
  rec.el.classList.toggle('open');
}

// search
const search=document.getElementById('search');
search.addEventListener('input',()=>{
  const q=search.value.trim().toLowerCase();
  clearFilters();
  if(!q){return;}
  const keep=new Set();
  nodes.forEach(n=>{if(n.name.includes(q)||n.detail.includes(q)){let id=n.id;while(id){keep.add(id);const r=byId[id];id=r.parentId;}}});
  nodes.forEach(n=>{n.el.classList.toggle('hide',!keep.has(n.id));});
  nodes.forEach(n=>{if(keep.has(n.id)&&(n.node.children||n.quiz))n.el.classList.add('open');});
});
function clearFilters(){nodes.forEach(n=>{n.el.classList.remove('hide');});document.getElementById('f-star').classList.remove('on');document.getElementById('f-undone').classList.remove('on');}
function filterBy(test,btn){
  const on=btn.classList.contains('on');
  search.value='';
  clearFilters();
  if(on)return;
  btn.classList.add('on');
  const keep=new Set();
  nodes.forEach(n=>{if(test(n)){let id=n.id;while(id){keep.add(id);id=byId[id].parentId;}}});
  nodes.forEach(n=>{n.el.classList.toggle('hide',!keep.has(n.id));});
  nodes.forEach(n=>{if(keep.has(n.id)&&(n.node.children||n.quiz))n.el.classList.add('open');});
}
document.getElementById('f-star').onclick=function(){filterBy(n=>state.star[n.id],this);};
document.getElementById('f-undone').onclick=function(){filterBy(n=>n.leaf&&!state.done[n.id],this);};
document.querySelectorAll('[data-lv]').forEach(b=>b.onclick=()=>{
  const lv=+b.dataset.lv;clearFilters();search.value='';
  nodes.forEach(n=>{if(n.node.children||n.quiz){n.el.classList.toggle('open',n.depth<lv);}});
});
document.getElementById('expand-all').onclick=()=>{clearFilters();search.value='';nodes.forEach(n=>{if(n.node.children){n.el.classList.add('open');}});};
document.getElementById('collapse-all').onclick=()=>{clearFilters();search.value='';nodes.forEach(n=>n.el.classList.remove('open'));};
// io
document.getElementById('io-btn').onclick=()=>{const b=document.getElementById('io-box');b.style.display=b.style.display==='block'?'none':'block';};
document.getElementById('io-export').onclick=()=>{const t=document.getElementById('io-text');t.value=JSON.stringify(state);t.select();try{document.execCommand('copy');}catch(e){}alert('进度码已生成并复制，发到新设备粘贴即可');};
document.getElementById('io-import').onclick=()=>{try{const v=JSON.parse(document.getElementById('io-text').value);state=v;state.done=state.done||{};state.star=state.star||{};state.quiz=state.quiz||{};save();applyState();updateStats();alert('导入成功');}catch(e){alert('进度码无效');}};
document.getElementById('io-reset').onclick=()=>{if(confirm('确定清空全部进度？此操作不可恢复')){state={done:{},star:{},quiz:{}};save();applyState();updateStats();location.reload();}};

// e-ink 逐条导航
let curLeafId=null;
function openAncestors(id){let p=byId[id].parentId;while(p){byId[p].el.classList.add('open');p=byId[p].parentId;}}
function focusLeaf(rec){nodes.forEach(n=>n.el.classList.remove('focus'));openAncestors(rec.id);if(!rec.built&&rec.leaf)buildDetail(rec);rec.el.classList.add('open');rec.el.classList.add('focus');curLeafId=rec.id;rec.el.scrollIntoView({block:'start'});}
function visLeaves(){return nodes.filter(n=>n.leaf&&!n.el.classList.contains('hide'));}
function gotoLeaf(dir){const v=visLeaves();if(!v.length)return;let i=v.findIndex(n=>n.id===curLeafId);i=i<0?(dir>0?0:v.length-1):i+dir;i=Math.max(0,Math.min(v.length-1,i));focusLeaf(v[i]);}
document.getElementById('nav-top').onclick=()=>window.scrollTo(0,0);
document.getElementById('nav-prev').onclick=()=>gotoLeaf(-1);
document.getElementById('nav-next').onclick=()=>gotoLeaf(1);
document.getElementById('nav-done').onclick=()=>{if(curLeafId){const r=byId[curLeafId];if(!state.done[r.id]){state.done[r.id]=today();save();applyState();updateStats();}}gotoLeaf(1);};

applyState();updateStats();