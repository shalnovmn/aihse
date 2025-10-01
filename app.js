const tokenInput=document.getElementById("token");
const randomBtn=document.getElementById("randomBtn");
const sentimentBtn=document.getElementById("sentimentBtn");
const nounsBtn=document.getElementById("nounsBtn");
const spinner=document.getElementById("spinner");
const errorDiv=document.getElementById("error");
const sentimentVal=document.getElementById("sentimentVal");
const nounsVal=document.getElementById("nounsVal");
const reviewTextEl=document.getElementById("reviewText");
const toggleBtn=document.getElementById("toggleBtn");
const fullTextEl=document.getElementById("fullText");

let reviews=[];
let currentId=null;
let inFlight=false;
const cache=new Map();
let fullTextState={full:"",truncated:"",isTruncated:false,expanded:false};

function setLoading(state){
  inFlight=state;
  const busy=state?"true":"false";
  [randomBtn,sentimentBtn,nounsBtn].forEach(b=>{b.disabled=state;b.setAttribute("aria-busy",busy)});
  tokenInput.disabled=state;
  spinner.style.display=state?"block":"none";
}
function setError(msg){errorDiv.textContent=msg||""}

function truncateReview(t){
  if(t.length<=1200){fullTextState={full:t,truncated:t,isTruncated:false,expanded:false};reviewTextEl.textContent=t;toggleBtn.style.display="none";return}
  const truncated=t.slice(0,1200)+"…";
  fullTextState={full:t,truncated,isTruncated:true,expanded:false};
  reviewTextEl.textContent=truncated;
  toggleBtn.textContent="Show more";
  toggleBtn.style.display="inline-block";
}
toggleBtn.addEventListener("click",()=>{
  if(!fullTextState.isTruncated)return;
  fullTextState.expanded=!fullTextState.expanded;
  reviewTextEl.textContent=fullTextState.expanded?fullTextState.full:fullTextState.truncated;
  toggleBtn.textContent=fullTextState.expanded?"Show less":"Show more";
});

function iconForSentiment(s){
  if(s==="positive")return "👍 positive";
  if(s==="negative")return "👎 negative";
  return "❓ neutral";
}
function bandForNouns(n){
  if(n>15)return {label:"High",icon:"🟢"};
  if(n>=6)return {label:"Medium",icon:"🟡"};
  return {label:"Low",icon:"🔴"};
}
function renderAll(){
  const sid=`${currentId}|sentiment`;
  const nid=`${currentId}|nouns`;
  const s=cache.get(sid);
  const n=cache.get(nid);
  sentimentVal.textContent=s?iconForSentiment(s.label):"❓ neutral";
  if(n&&Number.isFinite(n.count)){
    const b=bandForNouns(n.count);
    nounsVal.textContent=`${n.count} ${b.icon} ${b.label}`;
  }else{
    nounsVal.textContent="—";
  }
  const t=(reviews.find(r=>r.id===currentId)||{}).text||"";
  fullTextEl.textContent=t;
  truncateReview(t);
}

async function loadTSV(){
  try{
    const res=await fetch("reviews_test.tsv");
    const raw=await res.text();
    const parsed=Papa.parse(raw,{header:true,delimiter:"\t",skipEmptyLines:true});
    const hasTextCol=Array.isArray(parsed.meta?.fields)&&parsed.meta.fields.map(f=>String(f).trim().toLowerCase()).includes("text");
    const rows=Array.isArray(parsed.data)?parsed.data:[];
    const cleaned=rows.filter(r=>r&&r.text&&String(r.text).trim().length>0).map((r,i)=>({id:i,text:String(r.text).trim()}));
    if(!hasTextCol||cleaned.length===0){setError("TSV missing ‘text’ column or no rows."); [randomBtn,sentimentBtn,nounsBtn].forEach(b=>b.disabled=true); return}
    reviews=cleaned;
    [randomBtn,sentimentBtn,nounsBtn].forEach(b=>b.disabled=false);
    currentId=0;
    renderAll();
  }catch
