/* Round 169 appointment development parser. */
importScripts("https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js","./excel-core.js");
const Core=self.AppointmentExcelCore;

self.onmessage=async(event)=>{
  const {type,buffer,fileName,config}=event.data||{};
  if(type!=="PARSE"||!buffer)return;
  try{
    postMessage({type:"PROGRESS",step:"hash",message:"กำลังเตรียมไฟล์"});
    const hash=await sha256(buffer);
    postMessage({type:"PROGRESS",step:"read",message:"กำลังอ่านข้อมูล"});
    const wb=XLSX.read(buffer,{type:"array",cellDates:false,cellNF:true,cellText:true,dense:false});
    const cfg=Core.normalizeConfig(config||{});
    cfg.workbookDate1904=!!wb?.Workbook?.WBProps?.date1904;
    const resolved=resolveSheet(wb,cfg);
    if(!resolved)throw new Error("ไม่พบชีทที่ตรงกับการตั้งค่า");
    postMessage({type:"PROGRESS",step:"sheet",message:`กำลังอ่านข้อมูลจาก ${resolved.name}`});
    const ws=wb.Sheets[resolved.name], headerRow=resolved.headerRow;
    const range=XLSX.utils.decode_range(ws["!ref"]||"A1:A1");
    const headerCells=[];for(let c=range.s.c;c<=range.e.c;c++)headerCells.push(ws[XLSX.utils.encode_cell({r:headerRow,c})]||{});
    const header=Core.buildHeaderMap(headerCells,cfg);
    const critical=["dc","date","appointment",cfg.timeReference==="FROM"?"from":"period"];
    const missingCritical=critical.filter(k=>!(k in header.map));
    if(missingCritical.length)throw new Error("ไม่พบคอลัมน์ที่จำเป็น: "+missingCritical.map(k=>cfg.fields[k]?.header||k).join(", "));
    const rows=[];
    const total=Math.max(0,range.e.r-headerRow);
    for(let r=headerRow+1;r<=range.e.r;r++){
      if((r-headerRow)%3000===0)postMessage({type:"PROGRESS",step:"rows",message:`กำลังตรวจข้อมูล ${Math.min(r-headerRow,total).toLocaleString()}/${total.toLocaleString()} แถว`});
      const row={__row:r+1};
      for(const key of Object.keys(cfg.fields)){
        const pos=header.map[key];row[key]=Number.isInteger(pos)?(ws[XLSX.utils.encode_cell({r,c:range.s.c+pos})]||{}):{};
      }
      rows.push(row);
    }
    const result=Core.aggregateNormalizedRows(rows,cfg);
    const dateValues=result.appointments.map(a=>a.date).sort();
    postMessage({type:"RESULT",result:{
      fileName,fileHash:hash,sheets:wb.SheetNames,sourceSheet:resolved.name,sheetResolution:resolved.method,headerRow:headerRow+1,workbookDate1904:cfg.workbookDate1904,
      dateRange:dateValues.length?[dateValues[0],dateValues[dateValues.length-1]]:[],
      ...result,
      appointments:result.appointments.slice(0,5000),
      totalAppointments:result.appointments.length
    }});
  }catch(error){postMessage({type:"ERROR",message:String(error?.message||error)})}
};

function resolveSheet(wb,cfg){
  const names=wb.SheetNames||[],wanted=[cfg.sheetName,...(cfg.sheetAliases||[])].filter(Boolean);
  for(const w of wanted){const n=names.find(x=>x.trim().toUpperCase()===String(w).trim().toUpperCase());if(n){const hr=findHeaderRow(wb.Sheets[n],cfg);if(hr>=0)return{name:n,headerRow:hr,method:n===cfg.sheetName?"PRIMARY_NAME":"ALIAS_NAME"}}}
  let best=null;
  for(const n of names){const ws=wb.Sheets[n],hr=findHeaderRow(ws,cfg);if(hr<0)continue;const score=scoreHeaderRow(ws,hr,cfg);if(!best||score>best.score)best={name:n,headerRow:hr,method:"HEADER_DETECTED",score}}
  return best&&best.score>=5?best:null;
}
function findHeaderRow(ws,cfg){const range=XLSX.utils.decode_range(ws?.["!ref"]||"A1:A1"),end=Math.min(range.e.r,range.s.r+19);let best={r:-1,score:-1,req:0};for(let r=range.s.r;r<=end;r++){const cells=[];for(let c=range.s.c;c<=range.e.c;c++)cells.push(ws[XLSX.utils.encode_cell({r,c})]||{});const s=Core.headerScore(cells,cfg);if(s.requiredHits>=3&&s.score>best.score)best={r,score:s.score,req:s.requiredHits}}return best.r}
function scoreHeaderRow(ws,r,cfg){const range=XLSX.utils.decode_range(ws?.["!ref"]||"A1:A1"),cells=[];for(let c=range.s.c;c<=range.e.c;c++)cells.push(ws[XLSX.utils.encode_cell({r,c})]||{});return Core.headerScore(cells,cfg).score}
async function sha256(buffer){const digest=await crypto.subtle.digest("SHA-256",buffer.slice(0));return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("")}
