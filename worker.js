const JSON_HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"};
const encoder=new TextEncoder();
const PASSWORD_ITERATIONS=100000;
const BUILD_VERSION="2026.08.08-round33-tracking-final-hardening-r66";
const apiWorker={async fetch(request,env){if(request.method==="OPTIONS")return cors(new Response(null,{status:204}),request,env);const url=new URL(request.url);try{
  if(url.pathname==="/api/health"&&request.method==="GET")return reply({success:true,status:"READY",build:BUILD_VERSION,time:new Date().toISOString()},200,request,env);
  if(url.pathname==="/api/public/queue"&&request.method==="GET")return await publicQueue(request,env);
  if(url.pathname==="/api/public/track"&&request.method==="GET")return await publicTrack(request,env,url);
  if(url.pathname==="/api/track/link"&&request.method==="POST")return await createTrackLink(request,env);
  if(url.pathname==="/api/sync/gate"&&request.method==="POST")return await syncGate(request,env);
  if(url.pathname==="/api/sync/users"&&request.method==="POST")return await syncUsers(request,env);
  if(url.pathname==="/api/maintenance/retention"&&request.method==="POST")return await retentionMaintenance(request,env);
  if(url.pathname==="/api/workflow/inbound-scan"&&request.method==="POST")return await inboundScan(request,env);
  if(url.pathname==="/api/workflow/inbound-submit"&&request.method==="POST")return await inboundSubmit(request,env);
  if(url.pathname==="/api/workflow/inbound-return"&&request.method==="POST")return await inboundReturn(request,env);
  if(url.pathname==="/api/workflow/receiving-start"&&request.method==="POST")return await receivingStart(request,env);
  if(url.pathname==="/api/workflow/receiving-complete"&&request.method==="POST")return await receivingComplete(request,env);
  if(url.pathname==="/api/auth/login"&&request.method==="POST")return await login(request,env);
  if(url.pathname==="/api/auth/me"&&request.method==="GET")return await me(request,env);
  if(url.pathname==="/api/auth/logout"&&request.method==="POST")return await logout(request,env);
  if(url.pathname==="/api/vehicles/active-version"&&request.method==="GET")return await activeVehiclesVersion(request,env);
  if(url.pathname==="/api/vehicles/active"&&request.method==="GET")return await activeVehicles(request,env);
  if(url.pathname==="/api/dashboard/summary"&&request.method==="GET")return await dashboardSummary(request,env,url);
  if(url.pathname==="/api/dashboard/calendar"&&request.method==="GET")return await dashboardCalendar(request,env,url);
  if(url.pathname==="/api/admin/settings"&&request.method==="GET")return await adminSettings(request,env);
  if(url.pathname==="/api/admin/data-usage"&&request.method==="GET")return await adminDataUsage(request,env);
  if(url.pathname==="/api/admin/users/save"&&request.method==="POST")return await adminSaveUser(request,env);
  if(url.pathname==="/api/admin/users/status"&&request.method==="POST")return await adminUserStatus(request,env);
  if(url.pathname==="/api/admin/workflow"&&request.method==="POST")return await adminSaveWorkflow(request,env);
  if(url.pathname==="/api/admin/doors"&&request.method==="POST")return await adminSaveDoors(request,env);
  if(url.pathname==="/api/admin/shifts"&&request.method==="POST")return await adminSaveShifts(request,env);
  if(url.pathname==="/api/admin/alerts"&&request.method==="POST")return await adminSaveAlerts(request,env);
  if(url.pathname==="/api/admin/tracking"&&request.method==="POST")return await adminSaveTracking(request,env);
  return reply({success:false,message:"ไม่พบรายการที่ต้องการ"},404,request,env);
}catch(error){console.error("request_failed",error);return reply({success:false,message:"ดำเนินการไม่สำเร็จ กรุณาลองอีกครั้ง"},500,request,env)}}};
export default apiWorker;

async function syncUsers(request,env){if(!validSync(request,env))return reply({success:false,message:"ไม่มีสิทธิ์ดำเนินการ"},401,request,env);const body=await readJson(request);if(!Array.isArray(body.users))return reply({success:false,message:"รูปแบบข้อมูลไม่ถูกต้อง"},400,request,env);const seen=new Set();for(const item of body.users){const key=normalizeName(item.name);if(!key||!item.password||!["ADMIN","USER","INBOUND"].includes(item.accessRights))return reply({success:false,message:"พบข้อมูลผู้ใช้ไม่ครบถ้วน"},400,request,env);if(seen.has(key))return reply({success:false,message:`พบชื่อผู้ใช้ซ้ำ: ${item.name}`},409,request,env);seen.add(key)}
  const now=unix();let inserted=0,updated=0,skipped=0;const statements=[env.DB.prepare("UPDATE users SET is_active=0,updated_at=? WHERE user_id NOT IN (SELECT user_id FROM user_management WHERE managed_source='ADMIN')").bind(now)];for(const item of body.users){const existing=await env.DB.prepare("SELECT u.user_id,u.password_hash,COALESCE(m.managed_source,'SHEET') AS managed_source FROM users u LEFT JOIN user_management m ON m.user_id=u.user_id WHERE lower(trim(u.name))=?").bind(normalizeName(item.name)).first();if(existing?.managed_source==="ADMIN"){skipped++;continue}if(existing){const same=await verifyPassword(item.password,existing.password_hash);const passwordHash=same?existing.password_hash:await hashPassword(item.password);statements.push(env.DB.prepare("UPDATE users SET name=?,password_hash=?,access_rights=?,is_active=1,updated_at=? WHERE user_id=?").bind(item.name.trim(),passwordHash,item.accessRights,now,existing.user_id));updated++}else{statements.push(env.DB.prepare("INSERT INTO users(user_id,name,password_hash,access_rights,is_active,created_at,updated_at) VALUES(?,?,?,?,1,?,?)").bind(crypto.randomUUID(),item.name.trim(),await hashPassword(item.password),item.accessRights,now,now));inserted++}}await env.DB.batch(statements);
  return reply({success:true,inserted,updated,skipped,total:body.users.length},200,request,env)}

async function syncGate(request,env){
  if(!validSync(request,env))return reply({success:false,message:"ไม่มีสิทธิ์ดำเนินการ"},401,request,env);
  const body=await readJson(request),rows=body.rows,syncId=String(body.syncId||"").trim(),mode=body.mode==="FULL"?"FULL":"QUICK";
  if(!Array.isArray(rows)||rows.length>100)return reply({success:false,message:"จำนวนข้อมูลต่อชุดไม่ถูกต้อง"},400,request,env);
  if(syncId.length<8||syncId.length>200)return reply({success:false,message:"ไม่พบรหัสรอบซิงก์"},400,request,env);
  const completed=await env.DB.prepare("SELECT source_row_count,inserted_count,updated_count,closed_count,status FROM sync_runs WHERE sync_id=? LIMIT 1").bind(syncId).first();
  if(completed?.status==="COMPLETED")return reply({success:true,duplicate:true,mode,received:rows.length,inserted:completed.inserted_count,updated:completed.updated_count,closed:completed.closed_count,unchanged:rows.length-Number(completed.inserted_count||0)-Number(completed.updated_count||0)},200,request,env);
  const now=unix(),sourceRowCount=Math.max(0,Math.floor(Number(body.sourceRowCount)||0));
  await env.DB.prepare("INSERT INTO sync_runs(sync_id,started_at,source_row_count,status) VALUES(?,?,?,'RUNNING') ON CONFLICT(sync_id) DO UPDATE SET started_at=excluded.started_at,source_row_count=excluded.source_row_count,status='RUNNING',error_summary=NULL").bind(syncId,now,sourceRowCount).run();
  try{
    const normalized=[],seen=new Set();
    for(const input of rows){const row=normalizeGateRow(input);if(!row)return await finishBadSync(env,syncId,"พบข้อมูล Gate ไม่ครบถ้วน",request);if(seen.has(row.autoId))return await finishBadSync(env,syncId,"พบ Auto ID ซ้ำในชุดข้อมูล",request);seen.add(row.autoId);normalized.push(row)}
    if(!normalized.length){await finishSyncRun(env,syncId,now,0,0,0,null);return reply({success:true,mode,received:0,inserted:0,updated:0,closed:0,unchanged:0},200,request,env)}
    const profile=await env.DB.prepare("SELECT profile_id,use_inbound_first,use_door,require_door,use_receiving,use_inbound_second FROM workflow_profiles WHERE is_default=1 AND is_active=1 LIMIT 1").first();
    if(!profile)throw new Error("default_workflow_missing");
    const shiftsResult=await env.DB.prepare("SELECT shift_id,start_minute,end_minute FROM shifts WHERE is_active=1 AND valid_to IS NULL ORDER BY start_minute").all(),activeShifts=shiftsResult.results||[];
    const placeholders=normalized.map(()=>"?").join(","),ids=normalized.map(row=>row.autoId);
    const existingResult=await env.DB.prepare(`SELECT v.auto_id,v.gate_out_at,v.current_status,s.source_hash FROM vehicles v LEFT JOIN source_vehicle_state s ON s.auto_id=v.auto_id WHERE v.auto_id IN (${placeholders})`).bind(...ids).all();
    const existing=new Map((existingResult.results||[]).map(row=>[row.auto_id,row]));
    let inserted=0,updated=0,closed=0,unchanged=0;const statementGroups=[];
    for(const row of normalized){
      const rowStatements=[];
      const current=existing.get(row.autoId);
      if(current?.source_hash===row.sourceHash){unchanged++;rowStatements.push(env.DB.prepare("INSERT OR IGNORE INTO sync_run_items(sync_id,auto_id,result_code,closed_transition,created_at) VALUES(?,?,'UNCHANGED',0,?)").bind(syncId,row.autoId,now));statementGroups.push(rowStatements);continue}
      const isNew=!current,nextStatus=row.gateOutAt?"CLOSED":initialWorkflowStatus(profile);
      if(isNew)inserted++;else updated++;
      if(row.gateOutAt&&!current?.gate_out_at)closed++;
      const shiftId=isNew?shiftForTimestamp(activeShifts,row.gateInAt):null;
      rowStatements.push(env.DB.prepare("INSERT INTO vehicles(auto_id,appointment_no,company_name,driver_title,driver_first_name,driver_last_name,phone,vehicle_plate,province,vehicle_type,gate_in_at,gate_out_at,current_status,workflow_profile_id,workflow_snapshot_json,shift_id,source_seen_at,closed_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(auto_id) DO UPDATE SET appointment_no=excluded.appointment_no,company_name=excluded.company_name,driver_title=excluded.driver_title,driver_first_name=excluded.driver_first_name,driver_last_name=excluded.driver_last_name,phone=excluded.phone,vehicle_plate=excluded.vehicle_plate,province=excluded.province,vehicle_type=excluded.vehicle_type,gate_in_at=excluded.gate_in_at,gate_out_at=COALESCE(excluded.gate_out_at,vehicles.gate_out_at),current_status=CASE WHEN COALESCE(excluded.gate_out_at,vehicles.gate_out_at) IS NOT NULL THEN 'CLOSED' ELSE vehicles.current_status END,source_seen_at=excluded.source_seen_at,closed_at=CASE WHEN COALESCE(excluded.gate_out_at,vehicles.gate_out_at) IS NOT NULL THEN COALESCE(vehicles.closed_at,excluded.closed_at) ELSE vehicles.closed_at END,updated_at=excluded.updated_at").bind(row.autoId,row.appointmentNo,row.companyName,row.driverTitle,row.driverFirstName,row.driverLastName,row.phone,row.vehiclePlate,row.province,row.vehicleType,row.gateInAt,row.gateOutAt,nextStatus,profile.profile_id,JSON.stringify(profile),shiftId,now,row.gateOutAt?now:null,now,now));
      rowStatements.push(env.DB.prepare("INSERT INTO source_vehicle_state(auto_id,source_hash,source_gate_out_at,last_source_seen_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(auto_id) DO UPDATE SET source_hash=excluded.source_hash,source_gate_out_at=COALESCE(excluded.source_gate_out_at,source_vehicle_state.source_gate_out_at),last_source_seen_at=excluded.last_source_seen_at,updated_at=excluded.updated_at").bind(row.autoId,row.sourceHash,row.gateOutAt,now,now));
      rowStatements.push(env.DB.prepare("INSERT INTO workflow_events(event_id,auto_id,event_type,occurred_at,received_at,actor_user_id,idempotency_key,note,metadata_json,created_at) VALUES(?,?,'GATE_IN',?,?,NULL,?,NULL,?,?) ON CONFLICT(auto_id,event_type) DO UPDATE SET occurred_at=excluded.occurred_at,received_at=excluded.received_at,metadata_json=excluded.metadata_json").bind(crypto.randomUUID(),row.autoId,row.gateInAt,now,`source:gate-in:${row.autoId}`,JSON.stringify({mode,source:"Sheet1"}),now));
      if(row.gateOutAt)rowStatements.push(env.DB.prepare("INSERT INTO workflow_events(event_id,auto_id,event_type,occurred_at,received_at,actor_user_id,idempotency_key,note,metadata_json,created_at) VALUES(?,?,'GATE_OUT',?,?,NULL,?,NULL,?,?) ON CONFLICT(auto_id,event_type) DO UPDATE SET occurred_at=excluded.occurred_at,received_at=excluded.received_at,metadata_json=excluded.metadata_json").bind(crypto.randomUUID(),row.autoId,row.gateOutAt,now,`source:gate-out:${row.autoId}`,JSON.stringify({mode,source:"Sheet1"}),now));
      rowStatements.push(env.DB.prepare("INSERT OR IGNORE INTO sync_run_items(sync_id,auto_id,result_code,closed_transition,created_at) VALUES(?,?,?,?,?)").bind(syncId,row.autoId,isNew?'INSERTED':'UPDATED',row.gateOutAt&&!current?.gate_out_at?1:0,now));
      statementGroups.push(rowStatements);
    }
    let batch=[];for(const group of statementGroups){if(batch.length&&batch.length+group.length>80){await env.DB.batch(batch);batch=[]}batch.push(...group)}if(batch.length)await env.DB.batch(batch);
    const totals=await env.DB.prepare("SELECT COALESCE(SUM(result_code='INSERTED'),0) AS inserted_count,COALESCE(SUM(result_code='UPDATED'),0) AS updated_count,COALESCE(SUM(result_code='UNCHANGED'),0) AS unchanged_count,COALESCE(SUM(closed_transition),0) AS closed_count FROM sync_run_items WHERE sync_id=?").bind(syncId).first();
    inserted=Number(totals?.inserted_count||0);updated=Number(totals?.updated_count||0);closed=Number(totals?.closed_count||0);unchanged=Number(totals?.unchanged_count||0);
    await finishSyncRun(env,syncId,unix(),inserted,updated,closed,null);
    return reply({success:true,mode,received:normalized.length,inserted,updated,closed,unchanged},200,request,env);
  }catch(error){await env.DB.prepare("UPDATE sync_runs SET finished_at=?,status='FAILED',error_summary=? WHERE sync_id=?").bind(unix(),String(error?.message||error).slice(0,500),syncId).run();throw error}
}

async function finishBadSync(env,syncId,message,request){await env.DB.prepare("UPDATE sync_runs SET finished_at=?,status='REJECTED',error_summary=? WHERE sync_id=?").bind(unix(),message,syncId).run();return reply({success:false,message},400,request,env)}
async function finishSyncRun(env,syncId,finishedAt,inserted,updated,closed,error){await env.DB.prepare("UPDATE sync_runs SET finished_at=?,inserted_count=?,updated_count=?,closed_count=?,status=?,error_summary=? WHERE sync_id=?").bind(finishedAt,inserted,updated,closed,error?"FAILED":"COMPLETED",error,syncId).run()}
function normalizeGateRow(input){const autoId=String(input?.autoId||"").trim(),sourceHash=String(input?.sourceHash||"").trim().toLowerCase(),gateInAt=Number(input?.gateInAt),gateOutAt=input?.gateOutAt==null?null:Number(input.gateOutAt);if(!autoId||autoId.length>160||!Number.isFinite(gateInAt)||gateInAt<=0||!/^[a-f0-9]{32}$/.test(sourceHash)||gateOutAt!=null&&(!Number.isFinite(gateOutAt)||gateOutAt<gateInAt))return null;return{autoId,sourceHash,gateInAt:Math.floor(gateInAt),gateOutAt:gateOutAt==null?null:Math.floor(gateOutAt),driverTitle:nullable(input.driverTitle),driverFirstName:nullable(input.driverFirstName),driverLastName:nullable(input.driverLastName),appointmentNo:nullable(input.appointmentNo),companyName:nullable(input.companyName),phone:nullable(input.phone),vehiclePlate:nullable(input.vehiclePlate),province:nullable(input.province),vehicleType:nullable(input.vehicleType)}}

async function retentionMaintenance(request,env){
  if(!validSync(request,env))return reply({success:false,message:"ไม่มีสิทธิ์ดำเนินการ"},401,request,env);
  const configured=Number((await env.DB.prepare("SELECT setting_value FROM system_settings WHERE setting_key='retention_days' LIMIT 1").first())?.setting_value||365),days=Math.min(Math.max(Math.floor(configured),30),730),cutoff=unix()-days*86400;
  const counts=await env.DB.prepare("SELECT COUNT(*) AS vehicle_count FROM vehicles WHERE current_status='CLOSED' AND closed_at IS NOT NULL AND closed_at<?").bind(cutoff).first();
  const results=await env.DB.batch([
    env.DB.prepare("DELETE FROM audit_logs WHERE target_type='VEHICLE' AND target_id IN (SELECT auto_id FROM vehicles WHERE current_status='CLOSED' AND closed_at IS NOT NULL AND closed_at<?)").bind(cutoff),
    env.DB.prepare("DELETE FROM workflow_events WHERE auto_id IN (SELECT auto_id FROM vehicles WHERE current_status='CLOSED' AND closed_at IS NOT NULL AND closed_at<?)").bind(cutoff),
    env.DB.prepare("DELETE FROM source_vehicle_state WHERE auto_id IN (SELECT auto_id FROM vehicles WHERE current_status='CLOSED' AND closed_at IS NOT NULL AND closed_at<?)").bind(cutoff),
    env.DB.prepare("DELETE FROM vehicles WHERE current_status='CLOSED' AND closed_at IS NOT NULL AND closed_at<?").bind(cutoff),
    env.DB.prepare("DELETE FROM sessions WHERE expires_at<?").bind(unix()-7*86400),
    env.DB.prepare("DELETE FROM sync_run_items WHERE sync_id IN (SELECT sync_id FROM sync_runs WHERE started_at<?)").bind(cutoff),
    env.DB.prepare("DELETE FROM sync_runs WHERE started_at<?").bind(cutoff)
  ]);
  return reply({success:true,retentionDays:days,removedVehicles:Number(counts?.vehicle_count||0),removedEvents:changeCount(results[1]),finishedAt:unix()},200,request,env)
}

async function inboundScan(request,env){
  const auth=await requireInboundUser(request,env);if(auth.error)return auth.error;
  const body=await readJson(request),checked=validateInboundRequest(request,body);
  if(checked.error)return reply({success:false,message:checked.error},400,request,env);
  const vehicle=await getVehicle(env,checked.autoId);
  if(!vehicle)return reply({success:false,message:"ไม่พบ Auto ID ในรายการรถที่อยู่ในพื้นที่"},404,request,env);
  const priorKey=await env.DB.prepare("SELECT auto_id,event_type FROM workflow_events WHERE idempotency_key=? LIMIT 1").bind(checked.idempotencyKey).first();
  if(priorKey){if(priorKey.auto_id!==checked.autoId)return reply({success:false,message:"รายการยืนยันซ้ำไม่ตรงกับข้อมูลเดิม"},409,request,env);if(priorKey.event_type==="DOCUMENT_SUBMITTED")return reply({success:true,duplicate:true,action:"DOCUMENT_SUBMITTED",message:inboundDuplicateMessage(vehicle),vehicle:publicVehicle(vehicle),tracking:await inboundTrackingPayload(env,vehicle,20)},200,request,env);if(priorKey.event_type==="DOCUMENT_RETURNED")return reply({success:true,duplicate:true,action:"DOCUMENT_RETURNED",message:"รับเอกสารคืนแล้ว รอออกจากพื้นที่",vehicle:publicVehicle(vehicle),tracking:await inboundTrackingPayload(env,vehicle,20)},200,request,env);return reply({success:false,message:"รายการยืนยันซ้ำไม่ตรงกับข้อมูลเดิม"},409,request,env)}
  if(vehicle.current_status==="WAITING_DOCUMENT_SUBMISSION")return await recordDocumentSubmitted(request,env,auth.user,body,vehicle,checked);
  if(vehicle.current_status==="WAITING_DOCUMENT_RETURN")return await recordDocumentReturned(request,env,auth.user,body,vehicle,checked);
  return reply(await inboundScanInformation(env,vehicle),200,request,env);
}

async function inboundSubmit(request,env){
  const auth=await requireInboundUser(request,env);if(auth.error)return auth.error;
  const body=await readJson(request),checked=validateInboundRequest(request,body);
  if(checked.error)return reply({success:false,message:checked.error},400,request,env);
  const vehicle=await getVehicle(env,checked.autoId);if(!vehicle)return reply({success:false,message:"ไม่พบ Auto ID ในรายการรถที่อยู่ในพื้นที่"},404,request,env);
  return await recordDocumentSubmitted(request,env,auth.user,body,vehicle,checked);
}

async function inboundReturn(request,env){
  const auth=await requireInboundUser(request,env);if(auth.error)return auth.error;
  const body=await readJson(request),checked=validateInboundRequest(request,body);
  if(checked.error)return reply({success:false,message:checked.error},400,request,env);
  const vehicle=await getVehicle(env,checked.autoId);if(!vehicle)return reply({success:false,message:"ไม่พบ Auto ID ในรายการรถที่อยู่ในพื้นที่"},404,request,env);
  return await recordDocumentReturned(request,env,auth.user,body,vehicle,checked);
}

async function recordDocumentSubmitted(request,env,user,body,vehicle,checked){
  const {autoId,idempotencyKey,source}=checked;
  const priorKey=await env.DB.prepare("SELECT auto_id,event_type FROM workflow_events WHERE idempotency_key=? LIMIT 1").bind(idempotencyKey).first();
  if(priorKey){if(priorKey.auto_id!==autoId||priorKey.event_type!=="DOCUMENT_SUBMITTED")return reply({success:false,message:"รายการยืนยันซ้ำไม่ตรงกับข้อมูลเดิม"},409,request,env);const current=await getVehicle(env,autoId);return reply({success:true,duplicate:true,action:"DOCUMENT_SUBMITTED",message:inboundDuplicateMessage(current),vehicle:publicVehicle(current),tracking:await inboundTrackingPayload(env,current,20)},200,request,env)}
  if(vehicle.current_status==="CLOSED"||vehicle.gate_out_at)return reply({success:false,message:"รถคันนี้ออกจากพื้นที่และปิดงานแล้ว",vehicle:publicVehicle(vehicle)},409,request,env);
  const priorEvent=await env.DB.prepare("SELECT event_id FROM workflow_events WHERE auto_id=? AND event_type='DOCUMENT_SUBMITTED' LIMIT 1").bind(autoId).first();
  if(priorEvent)return reply({success:true,duplicate:true,action:"DOCUMENT_SUBMITTED",message:inboundDuplicateMessage(vehicle),vehicle:publicVehicle(vehicle),tracking:await inboundTrackingPayload(env,vehicle,20)},200,request,env);
  if(vehicle.current_status!=="WAITING_DOCUMENT_SUBMISSION")return reply({success:false,message:statusConflictMessage(vehicle.current_status),vehicle:publicVehicle(vehicle)},409,request,env);
  const profile=await vehicleProfile(env,vehicle);
  if(!profile||!enabled(profile.use_inbound_first))return reply({success:false,message:"รถคันนี้ไม่ต้องผ่านขั้นตอนยื่นเอกสาร",vehicle:publicVehicle(vehicle)},409,request,env);
  const nextStatus=enabled(profile.use_receiving)?"READY_FOR_RECEIVING":enabled(profile.use_inbound_second)?"WAITING_DOCUMENT_RETURN":"WAITING_GATE_OUT";
  const now=unix(),eventId=crypto.randomUUID(),auditId=crypto.randomUUID(),metadata=JSON.stringify({fromStatus:vehicle.current_status,toStatus:nextStatus,source});
  const results=await env.DB.batch([
    env.DB.prepare("INSERT INTO workflow_events(event_id,auto_id,event_type,occurred_at,received_at,actor_user_id,idempotency_key,note,metadata_json,created_at) SELECT ?,auto_id,'DOCUMENT_SUBMITTED',?,?,?,?,NULL,?,? FROM vehicles WHERE auto_id=? AND current_status='WAITING_DOCUMENT_SUBMISSION'").bind(eventId,now,now,user.user_id,idempotencyKey,metadata,now,autoId),
    env.DB.prepare("UPDATE vehicles SET current_status=?,updated_at=? WHERE auto_id=? AND current_status='WAITING_DOCUMENT_SUBMISSION'").bind(nextStatus,now,autoId),
    env.DB.prepare("INSERT INTO audit_logs(audit_id,actor_user_id,action_code,target_type,target_id,before_json,after_json,reason,created_at) SELECT ?,?,'INBOUND_DOCUMENT_SUBMITTED','VEHICLE',?,?,?,NULL,? FROM workflow_events WHERE event_id=?").bind(auditId,user.user_id,autoId,JSON.stringify({currentStatus:vehicle.current_status}),JSON.stringify({currentStatus:nextStatus}),now,eventId)
  ]);
  if(changeCount(results[0])!==1||changeCount(results[1])!==1){const current=await getVehicle(env,autoId),duplicate=await env.DB.prepare("SELECT event_id FROM workflow_events WHERE auto_id=? AND event_type='DOCUMENT_SUBMITTED' LIMIT 1").bind(autoId).first();if(duplicate)return reply({success:true,duplicate:true,action:"DOCUMENT_SUBMITTED",message:inboundDuplicateMessage(current),vehicle:publicVehicle(current),tracking:await inboundTrackingPayload(env,current,20)},200,request,env);return reply({success:false,message:"สถานะรถมีการเปลี่ยนแปลง กรุณาโหลดข้อมูลใหม่",vehicle:publicVehicle(current)},409,request,env)}
  const updated=await getVehicle(env,autoId);return reply({success:true,duplicate:false,action:"DOCUMENT_SUBMITTED",message:"บันทึกเวลายื่นเอกสารแล้ว",occurredAt:now,vehicle:publicVehicle(updated),tracking:await inboundTrackingPayload(env,updated,15)},200,request,env)
}

async function recordDocumentReturned(request,env,user,body,vehicle,checked){
  const {autoId,idempotencyKey,source}=checked;
  const priorKey=await env.DB.prepare("SELECT auto_id,event_type FROM workflow_events WHERE idempotency_key=? LIMIT 1").bind(idempotencyKey).first();
  if(priorKey){if(priorKey.auto_id!==autoId||priorKey.event_type!=="DOCUMENT_RETURNED")return reply({success:false,message:"รายการยืนยันซ้ำไม่ตรงกับข้อมูลเดิม"},409,request,env);const current=await getVehicle(env,autoId);return reply({success:true,duplicate:true,action:"DOCUMENT_RETURNED",message:"รับเอกสารคืนแล้ว รอออกจากพื้นที่",vehicle:publicVehicle(current),tracking:await inboundTrackingPayload(env,current,20)},200,request,env)}
  if(vehicle.current_status==="CLOSED"||vehicle.gate_out_at)return reply({success:false,message:"รถคันนี้ออกจากพื้นที่และปิดงานแล้ว",vehicle:publicVehicle(vehicle)},409,request,env);
  const priorEvent=await env.DB.prepare("SELECT event_id FROM workflow_events WHERE auto_id=? AND event_type='DOCUMENT_RETURNED' LIMIT 1").bind(autoId).first();
  if(priorEvent)return reply({success:true,duplicate:true,action:"DOCUMENT_RETURNED",message:"รับเอกสารคืนแล้ว รอออกจากพื้นที่",vehicle:publicVehicle(vehicle),tracking:await inboundTrackingPayload(env,vehicle,20)},200,request,env);
  if(vehicle.current_status!=="WAITING_DOCUMENT_RETURN")return reply({success:false,message:returnStatusConflictMessage(vehicle.current_status),vehicle:publicVehicle(vehicle)},409,request,env);
  const profile=await vehicleProfile(env,vehicle);
  if(!profile||!enabled(profile.use_inbound_second))return reply({success:false,message:"รถคันนี้ไม่ต้องผ่านขั้นตอนรับเอกสารคืน",vehicle:publicVehicle(vehicle)},409,request,env);
  const now=unix(),eventId=crypto.randomUUID(),auditId=crypto.randomUUID(),nextStatus="WAITING_GATE_OUT",metadata=JSON.stringify({fromStatus:vehicle.current_status,toStatus:nextStatus,source});
  const results=await env.DB.batch([
    env.DB.prepare("INSERT INTO workflow_events(event_id,auto_id,event_type,occurred_at,received_at,actor_user_id,idempotency_key,note,metadata_json,created_at) SELECT ?,auto_id,'DOCUMENT_RETURNED',?,?,?,?,NULL,?,? FROM vehicles WHERE auto_id=? AND current_status='WAITING_DOCUMENT_RETURN'").bind(eventId,now,now,user.user_id,idempotencyKey,metadata,now,autoId),
    env.DB.prepare("UPDATE vehicles SET current_status='WAITING_GATE_OUT',updated_at=? WHERE auto_id=? AND current_status='WAITING_DOCUMENT_RETURN'").bind(now,autoId),
    env.DB.prepare("INSERT INTO audit_logs(audit_id,actor_user_id,action_code,target_type,target_id,before_json,after_json,reason,created_at) SELECT ?,?,'INBOUND_DOCUMENT_RETURNED','VEHICLE',?,?,?,NULL,? FROM workflow_events WHERE event_id=?").bind(auditId,user.user_id,autoId,JSON.stringify({currentStatus:vehicle.current_status}),JSON.stringify({currentStatus:nextStatus}),now,eventId)
  ]);
  if(changeCount(results[0])!==1||changeCount(results[1])!==1){const current=await getVehicle(env,autoId),duplicate=await env.DB.prepare("SELECT event_id FROM workflow_events WHERE auto_id=? AND event_type='DOCUMENT_RETURNED' LIMIT 1").bind(autoId).first();if(duplicate)return reply({success:true,duplicate:true,action:"DOCUMENT_RETURNED",message:"รับเอกสารคืนแล้ว รอออกจากพื้นที่",vehicle:publicVehicle(current),tracking:await inboundTrackingPayload(env,current,20)},200,request,env);return reply({success:false,message:"สถานะรถมีการเปลี่ยนแปลง กรุณาโหลดข้อมูลใหม่",vehicle:publicVehicle(current)},409,request,env)}
  const updated=await getVehicle(env,autoId);return reply({success:true,duplicate:false,action:"DOCUMENT_RETURNED",message:"บันทึกเวลารับเอกสารคืนแล้ว",occurredAt:now,vehicle:publicVehicle(updated),tracking:await inboundTrackingPayload(env,updated,15)},200,request,env)
}

async function receivingStart(request,env){
  const auth=await requireUser(request,env);if(auth.error)return auth.error;
  if(!["ADMIN","USER"].includes(auth.user.access_rights))return reply({success:false,message:"คุณไม่มีสิทธิ์เริ่มตรวจรับสินค้า"},403,request,env);
  const body=await readJson(request),autoId=String(body.autoId||"").trim(),idempotencyKey=readIdempotencyKey(request,body);
  if(!validAutoId(autoId))return reply({success:false,message:"กรุณาระบุ Auto ID ให้ถูกต้อง"},400,request,env);
  if(!validIdempotencyKey(idempotencyKey))return reply({success:false,message:"ไม่สามารถยืนยันรายการได้ กรุณาลองใหม่"},400,request,env);
  const duplicate=await receivingDuplicateByKey(env,idempotencyKey,autoId,"RECEIVING_STARTED");if(duplicate)return reply(duplicate.data,duplicate.status,request,env);
  const vehicle=await getVehicle(env,autoId);if(!vehicle)return reply({success:false,message:"ไม่พบรถในรายการพร้อมตรวจรับ"},404,request,env);
  if(vehicle.current_status==="CLOSED"||vehicle.gate_out_at)return reply({success:false,message:"รถคันนี้ออกจากพื้นที่และปิดงานแล้ว",vehicle:publicVehicle(vehicle)},409,request,env);
  const priorEvent=await env.DB.prepare("SELECT event_id FROM workflow_events WHERE auto_id=? AND event_type='RECEIVING_STARTED' LIMIT 1").bind(autoId).first();
  if(priorEvent)return reply({success:true,duplicate:true,message:receivingStartDuplicateMessage(vehicle),vehicle:publicVehicle(vehicle)},200,request,env);
  if(vehicle.current_status!=="READY_FOR_RECEIVING")return reply({success:false,message:receivingStatusConflictMessage(vehicle.current_status),vehicle:publicVehicle(vehicle)},409,request,env);
  const profile=await vehicleProfile(env,vehicle);if(!profile||!enabled(profile.use_receiving))return reply({success:false,message:"รถคันนี้ไม่ต้องผ่านขั้นตอนตรวจรับสินค้า",vehicle:publicVehicle(vehicle)},409,request,env);
  const doorSetting=await env.DB.prepare("SELECT use_door,require_door FROM workflow_profiles WHERE is_default=1 AND is_active=1 LIMIT 1").first();
  const door=normalizeDoor(body.doorCode),usesDoor=enabled(doorSetting?.use_door),requiresDoor=usesDoor&&enabled(doorSetting?.require_door);
  if(requiresDoor&&!door)return reply({success:false,message:"กรุณาระบุประตูรับสินค้า"},400,request,env);
  if(usesDoor&&door?.error)return reply({success:false,message:"กรุณาตรวจสอบตัวอักษรและหมายเลขประตู"},400,request,env);
  const doorCode=usesDoor&&door?door.code:null,now=unix(),eventId=crypto.randomUUID(),auditId=crypto.randomUUID(),metadata=JSON.stringify({fromStatus:vehicle.current_status,toStatus:"RECEIVING_IN_PROGRESS",doorCode});
  const statements=[];
  if(doorCode){const configuredDoor=await env.DB.prepare("SELECT is_active FROM doors WHERE door_code=? LIMIT 1").bind(doorCode).first();if(!configuredDoor||Number(configuredDoor.is_active)!==1)return reply({success:false,message:`ประตู ${doorCode} ยังไม่ได้เปิดใช้งาน`},409,request,env)}
  const eventIndex=statements.length;
  statements.push(env.DB.prepare("INSERT OR IGNORE INTO workflow_events(event_id,auto_id,event_type,occurred_at,received_at,actor_user_id,idempotency_key,note,metadata_json,created_at) SELECT ?,auto_id,'RECEIVING_STARTED',?,?,?,?,NULL,?,? FROM vehicles WHERE auto_id=? AND current_status='READY_FOR_RECEIVING'").bind(eventId,now,now,auth.user.user_id,idempotencyKey,metadata,now,autoId));
  const updateIndex=statements.length;
  statements.push(env.DB.prepare("UPDATE vehicles SET current_status='RECEIVING_IN_PROGRESS',door_code=?,updated_at=? WHERE auto_id=? AND current_status='READY_FOR_RECEIVING'").bind(doorCode,now,autoId));
  statements.push(env.DB.prepare("INSERT INTO audit_logs(audit_id,actor_user_id,action_code,target_type,target_id,before_json,after_json,reason,created_at) SELECT ?,?,'RECEIVING_STARTED','VEHICLE',?,?,?,NULL,? FROM workflow_events WHERE event_id=?").bind(auditId,auth.user.user_id,autoId,JSON.stringify({currentStatus:vehicle.current_status,doorCode:vehicle.door_code}),JSON.stringify({currentStatus:"RECEIVING_IN_PROGRESS",doorCode}),now,eventId));
  const results=await env.DB.batch(statements);
  if(changeCount(results[eventIndex])!==1||changeCount(results[updateIndex])!==1){const current=await getVehicle(env,autoId),existing=await env.DB.prepare("SELECT event_id FROM workflow_events WHERE auto_id=? AND event_type='RECEIVING_STARTED' LIMIT 1").bind(autoId).first();if(existing)return reply({success:true,duplicate:true,message:receivingStartDuplicateMessage(current),vehicle:publicVehicle(current)},200,request,env);return reply({success:false,message:"สถานะรถมีการเปลี่ยนแปลง กรุณาโหลดข้อมูลใหม่",vehicle:publicVehicle(current)},409,request,env)}
  const updated=await getVehicle(env,autoId);return reply({success:true,duplicate:false,message:"เริ่มตรวจรับสินค้าแล้ว",occurredAt:now,queueCall:{active:true,calledAt:now,doorCode:doorCode||null},vehicle:publicVehicle(updated)},200,request,env)
}

async function receivingComplete(request,env){
  const auth=await requireUser(request,env);if(auth.error)return auth.error;
  if(!["ADMIN","USER"].includes(auth.user.access_rights))return reply({success:false,message:"คุณไม่มีสิทธิ์ยืนยันรับสินค้าเสร็จ"},403,request,env);
  const body=await readJson(request),autoId=String(body.autoId||"").trim(),idempotencyKey=readIdempotencyKey(request,body);
  if(!validAutoId(autoId))return reply({success:false,message:"กรุณาระบุ Auto ID ให้ถูกต้อง"},400,request,env);
  if(!validIdempotencyKey(idempotencyKey))return reply({success:false,message:"ไม่สามารถยืนยันรายการได้ กรุณาลองใหม่"},400,request,env);
  const duplicate=await receivingDuplicateByKey(env,idempotencyKey,autoId,"RECEIVING_COMPLETED");if(duplicate)return reply(duplicate.data,duplicate.status,request,env);
  const vehicle=await getVehicle(env,autoId);if(!vehicle)return reply({success:false,message:"ไม่พบรถในรายการกำลังตรวจรับ"},404,request,env);
  const priorEvent=await env.DB.prepare("SELECT event_id FROM workflow_events WHERE auto_id=? AND event_type='RECEIVING_COMPLETED' LIMIT 1").bind(autoId).first();
  if(priorEvent)return reply({success:true,duplicate:true,message:"รถคันนี้ยืนยันรับสินค้าเสร็จแล้ว",vehicle:publicVehicle(vehicle)},200,request,env);
  if(vehicle.current_status!=="RECEIVING_IN_PROGRESS")return reply({success:false,message:receivingStatusConflictMessage(vehicle.current_status),vehicle:publicVehicle(vehicle)},409,request,env);
  const profile=await vehicleProfile(env,vehicle);if(!profile||!enabled(profile.use_receiving))return reply({success:false,message:"รถคันนี้ไม่ต้องผ่านขั้นตอนตรวจรับสินค้า",vehicle:publicVehicle(vehicle)},409,request,env);
  const nextStatus=enabled(profile.use_inbound_second)?"WAITING_DOCUMENT_RETURN":"WAITING_GATE_OUT",now=unix(),eventId=crypto.randomUUID(),auditId=crypto.randomUUID(),metadata=JSON.stringify({fromStatus:vehicle.current_status,toStatus:nextStatus,doorCode:vehicle.door_code});
  const results=await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO workflow_events(event_id,auto_id,event_type,occurred_at,received_at,actor_user_id,idempotency_key,note,metadata_json,created_at) SELECT ?,auto_id,'RECEIVING_COMPLETED',?,?,?,?,NULL,?,? FROM vehicles WHERE auto_id=? AND current_status='RECEIVING_IN_PROGRESS'").bind(eventId,now,now,auth.user.user_id,idempotencyKey,metadata,now,autoId),
    env.DB.prepare("UPDATE vehicles SET current_status=?,updated_at=? WHERE auto_id=? AND current_status='RECEIVING_IN_PROGRESS'").bind(nextStatus,now,autoId),
    env.DB.prepare("INSERT INTO audit_logs(audit_id,actor_user_id,action_code,target_type,target_id,before_json,after_json,reason,created_at) SELECT ?,?,'RECEIVING_COMPLETED','VEHICLE',?,?,?,NULL,? FROM workflow_events WHERE event_id=?").bind(auditId,auth.user.user_id,autoId,JSON.stringify({currentStatus:vehicle.current_status}),JSON.stringify({currentStatus:nextStatus}),now,eventId)
  ]);
  if(changeCount(results[0])!==1||changeCount(results[1])!==1){const current=await getVehicle(env,autoId),existing=await env.DB.prepare("SELECT event_id FROM workflow_events WHERE auto_id=? AND event_type='RECEIVING_COMPLETED' LIMIT 1").bind(autoId).first();if(existing)return reply({success:true,duplicate:true,message:"รถคันนี้ยืนยันรับสินค้าเสร็จแล้ว",vehicle:publicVehicle(current)},200,request,env);return reply({success:false,message:"สถานะรถมีการเปลี่ยนแปลง กรุณาโหลดข้อมูลใหม่",vehicle:publicVehicle(current)},409,request,env)}
  const updated=await getVehicle(env,autoId);return reply({success:true,duplicate:false,message:"ยืนยันรับสินค้าเสร็จแล้ว",occurredAt:now,vehicle:publicVehicle(updated)},200,request,env)
}

async function adminDataUsage(request,env){
  const auth=await requireAdmin(request,env);if(auth.error)return auth.error;
  const plan=String(env.D1_PLAN_MODE||"FREE").trim().toUpperCase()==="PAID"?"PAID":"FREE";
  const maxDatabaseBytes=plan==="PAID"?10*1024*1024*1024:500*1024*1024;

  const safeCount=async(sql)=>{
    try{
      const result=await env.DB.prepare(sql).all();
      return {total:Number(result?.results?.[0]?.total||0),sizeBytes:Math.max(0,Number(result?.meta?.size_after||0))};
    }catch(error){
      console.warn("admin-data-usage count failed",sql,String(error?.message||error));
      return {total:0,sizeBytes:0};
    }
  };

  const [vehicles,activeVehicles,workflowEvents,auditLogs,users,doors,syncRuns]=await Promise.all([
    safeCount("SELECT COUNT(*) AS total FROM vehicles"),
    safeCount("SELECT COUNT(*) AS total FROM vehicles WHERE current_status<>'CLOSED'"),
    safeCount("SELECT COUNT(*) AS total FROM workflow_events"),
    safeCount("SELECT COUNT(*) AS total FROM audit_logs"),
    safeCount("SELECT COUNT(*) AS total FROM users"),
    safeCount("SELECT COUNT(*) AS total FROM doors"),
    safeCount("SELECT COUNT(*) AS total FROM sync_runs")
  ]);

  const activity=[];
  const addActivity=rows=>{for(const row of rows||[])activity.push(row)};
  try{
    const work=await env.DB.prepare("SELECT e.occurred_at AS event_time,'WORK' AS event_group,e.event_type AS event_code,COALESCE(u.name,'ระบบ') AS actor,e.auto_id AS reference,NULL AS detail FROM workflow_events e LEFT JOIN users u ON u.user_id=e.actor_user_id ORDER BY e.occurred_at DESC LIMIT 35").all();
    addActivity(work.results);
  }catch(error){console.warn("admin-data-usage workflow activity failed",String(error?.message||error))}
  try{
    const admin=await env.DB.prepare("SELECT a.created_at AS event_time,'ADMIN' AS event_group,a.action_code AS event_code,COALESCE(u.name,'ระบบ') AS actor,COALESCE(a.target_id,'') AS reference,a.reason AS detail FROM audit_logs a LEFT JOIN users u ON u.user_id=a.actor_user_id ORDER BY a.created_at DESC LIMIT 35").all();
    addActivity(admin.results);
  }catch(error){console.warn("admin-data-usage admin activity failed",String(error?.message||error))}
  try{
    const sync=await env.DB.prepare("SELECT started_at AS event_time,'SYNC' AS event_group,'SYNC_GATE' AS event_code,'ระบบ' AS actor,sync_id AS reference,status AS detail FROM sync_runs ORDER BY started_at DESC LIMIT 20").all();
    addActivity(sync.results);
  }catch(error){console.warn("admin-data-usage sync activity failed",String(error?.message||error))}

  activity.sort((a,b)=>Number(b.event_time||0)-Number(a.event_time||0));
  const sizeBytes=Math.max(vehicles.sizeBytes,activeVehicles.sizeBytes,workflowEvents.sizeBytes,auditLogs.sizeBytes,users.sizeBytes,doors.sizeBytes,syncRuns.sizeBytes,0);
  const remainingBytes=Math.max(0,maxDatabaseBytes-sizeBytes),percent=maxDatabaseBytes?Math.min(100,sizeBytes*100/maxDatabaseBytes):0;
  return reply({success:true,generatedAt:unix(),plan,sizeBytes,maxDatabaseBytes,remainingBytes,percent,counts:{vehicles:vehicles.total,activeVehicles:activeVehicles.total,workflowEvents:workflowEvents.total,auditLogs:auditLogs.total,users:users.total,doors:doors.total,syncRuns:syncRuns.total},activity:activity.slice(0,80),exactSqlHistory:false,build:BUILD_VERSION},200,request,env)
}
async function adminSettings(request,env){
  const auth=await requireAdmin(request,env);if(auth.error)return auth.error;
  const [users,workflow,doors,shifts,alerts,tracking]=await Promise.all([
    env.DB.prepare("SELECT u.user_id,u.name,u.access_rights,u.is_active,COALESCE(m.managed_source,'SHEET') AS managed_source,u.updated_at FROM users u LEFT JOIN user_management m ON m.user_id=u.user_id ORDER BY u.is_active DESC,u.access_rights,u.name").all(),
    env.DB.prepare("SELECT profile_id,profile_name,use_inbound_first,use_door,require_door,use_receiving,use_inbound_second,is_default,is_active,updated_at FROM workflow_profiles WHERE is_default=1 AND is_active=1 LIMIT 1").first(),
    env.DB.prepare("SELECT door_code,group_code,sort_order,is_active,updated_at FROM doors ORDER BY is_active DESC,group_code,sort_order,door_code").all(),
    env.DB.prepare("SELECT shift_id,shift_name,start_minute,end_minute,color,is_active,valid_from,valid_to FROM shifts WHERE is_active=1 AND valid_to IS NULL ORDER BY start_minute").all(),
    env.DB.prepare("SELECT rule_id,stage_code,level_code,start_seconds,color,sound_enabled,repeat_seconds,is_active FROM alert_rules ORDER BY stage_code,start_seconds").all(),
    driverTrackingSettings(env)
  ]);
  return reply({success:true,users:users.results||[],workflow:workflow||null,doors:doors.results||[],shifts:shifts.results||[],alerts:alerts.results||[],tracking,build:BUILD_VERSION},200,request,env)
}

async function adminSaveUser(request,env){
  const auth=await requireAdmin(request,env);if(auth.error)return auth.error;const body=await readJson(request),userId=String(body.userId||"").trim(),name=String(body.name||"").trim(),password=String(body.password||""),accessRights=String(body.accessRights||"").toUpperCase(),isActive=body.isActive===false||body.isActive===0?0:1;
  if(!name||name.length>120||!["ADMIN","USER","INBOUND"].includes(accessRights))return reply({success:false,message:"กรุณากรอกชื่อและสิทธิ์ให้ถูกต้อง"},400,request,env);
  if(password&&password.length<4||password.length>200)return reply({success:false,message:"รหัสผ่านต้องมี 4–200 ตัวอักษร"},400,request,env);
  const duplicate=await env.DB.prepare("SELECT user_id FROM users WHERE lower(trim(name))=? AND user_id<>? LIMIT 1").bind(normalizeName(name),userId||"-").first();if(duplicate)return reply({success:false,message:"ชื่อผู้ใช้นี้มีอยู่แล้ว"},409,request,env);
  const now=unix();let targetId=userId,before=null;
  if(userId){before=await env.DB.prepare("SELECT user_id,name,access_rights,is_active,password_hash FROM users WHERE user_id=? LIMIT 1").bind(userId).first();if(!before)return reply({success:false,message:"ไม่พบผู้ใช้ที่ต้องการแก้ไข"},404,request,env);if(userId===auth.user.user_id&&(!isActive||accessRights!=="ADMIN"))return reply({success:false,message:"ไม่สามารถลดสิทธิ์หรือปิดบัญชีที่กำลังใช้งาน"},409,request,env);if(before.access_rights==="ADMIN"&&before.is_active&&(!isActive||accessRights!=="ADMIN")){const admins=await activeAdminCount(env);if(admins<=1)return reply({success:false,message:"ระบบต้องมีผู้ดูแลที่ใช้งานได้อย่างน้อย 1 คน"},409,request,env)}const hash=password?await hashPassword(password):before.password_hash;await env.DB.batch([env.DB.prepare("UPDATE users SET name=?,password_hash=?,access_rights=?,is_active=?,updated_at=? WHERE user_id=?").bind(name,hash,accessRights,isActive,now,userId),env.DB.prepare("INSERT INTO user_management(user_id,managed_source,updated_at) VALUES(?,'ADMIN',?) ON CONFLICT(user_id) DO UPDATE SET managed_source='ADMIN',updated_at=excluded.updated_at").bind(userId,now)]);
  }else{if(!password)return reply({success:false,message:"กรุณากำหนดรหัสผ่าน"},400,request,env);targetId=crypto.randomUUID();await env.DB.batch([env.DB.prepare("INSERT INTO users(user_id,name,password_hash,access_rights,is_active,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").bind(targetId,name,await hashPassword(password),accessRights,isActive,now,now),env.DB.prepare("INSERT INTO user_management(user_id,managed_source,updated_at) VALUES(?,'ADMIN',?)").bind(targetId,now)])}
  await writeAudit(env,auth.user,"ADMIN_USER_SAVE","USER",targetId,before&&{name:before.name,accessRights:before.access_rights,isActive:before.is_active},{name,accessRights,isActive},null);return reply({success:true,message:userId?"บันทึกผู้ใช้แล้ว":"เพิ่มผู้ใช้แล้ว",userId:targetId},200,request,env)
}

async function adminUserStatus(request,env){
  const auth=await requireAdmin(request,env);if(auth.error)return auth.error;const body=await readJson(request),userId=String(body.userId||"").trim(),isActive=body.isActive?1:0;if(!userId)return reply({success:false,message:"ไม่พบผู้ใช้"},400,request,env);const user=await env.DB.prepare("SELECT user_id,name,access_rights,is_active FROM users WHERE user_id=? LIMIT 1").bind(userId).first();if(!user)return reply({success:false,message:"ไม่พบผู้ใช้"},404,request,env);if(userId===auth.user.user_id&&!isActive)return reply({success:false,message:"ไม่สามารถปิดบัญชีที่กำลังใช้งาน"},409,request,env);if(user.access_rights==="ADMIN"&&user.is_active&&!isActive&&(await activeAdminCount(env))<=1)return reply({success:false,message:"ระบบต้องมีผู้ดูแลที่ใช้งานได้อย่างน้อย 1 คน"},409,request,env);const now=unix();await env.DB.batch([env.DB.prepare("UPDATE users SET is_active=?,updated_at=? WHERE user_id=?").bind(isActive,now,userId),env.DB.prepare("INSERT INTO user_management(user_id,managed_source,updated_at) VALUES(?,'ADMIN',?) ON CONFLICT(user_id) DO UPDATE SET managed_source='ADMIN',updated_at=excluded.updated_at").bind(userId,now)]);if(!isActive)await env.DB.prepare("UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL").bind(now,userId).run();await writeAudit(env,auth.user,"ADMIN_USER_STATUS","USER",userId,{isActive:user.is_active},{isActive},null);return reply({success:true,message:isActive?"เปิดใช้งานผู้ใช้แล้ว":"ปิดใช้งานผู้ใช้แล้ว"},200,request,env)
}

async function adminSaveWorkflow(request,env){
  const auth=await requireAdmin(request,env);if(auth.error)return auth.error;const body=await readJson(request),profile=await env.DB.prepare("SELECT * FROM workflow_profiles WHERE is_default=1 AND is_active=1 LIMIT 1").first();if(!profile)return reply({success:false,message:"ไม่พบการตั้งค่าขั้นตอนงาน"},404,request,env);let useInboundFirst=flag(body.useInboundFirst),useReceiving=flag(body.useReceiving),useInboundSecond=flag(body.useInboundSecond),useDoor=useReceiving?flag(body.useDoor):0,requireDoor=useDoor?flag(body.requireDoor):0;const after={useInboundFirst,useReceiving,useInboundSecond,useDoor,requireDoor},now=unix();await env.DB.prepare("UPDATE workflow_profiles SET use_inbound_first=?,use_door=?,require_door=?,use_receiving=?,use_inbound_second=?,updated_at=? WHERE profile_id=?").bind(useInboundFirst,useDoor,requireDoor,useReceiving,useInboundSecond,now,profile.profile_id).run();await writeAudit(env,auth.user,"ADMIN_WORKFLOW_SAVE","WORKFLOW_PROFILE",profile.profile_id,{useInboundFirst:profile.use_inbound_first,useReceiving:profile.use_receiving,useInboundSecond:profile.use_inbound_second,useDoor:profile.use_door,requireDoor:profile.require_door},after,useDoor?"เปิดใช้ประตูรับสินค้า":"ปิดใช้ประตูรับสินค้า");return reply({success:true,message:useDoor?"เปิดใช้ประตูรับสินค้าแล้ว":"ปิดใช้ประตูรับสินค้าแล้ว",workflow:after},200,request,env)
}

async function adminSaveDoors(request,env){
  const auth=await requireAdmin(request,env);if(auth.error)return auth.error;const body=await readJson(request);if(!Array.isArray(body.doors)||body.doors.length>300)return reply({success:false,message:"รายการประตูไม่ถูกต้อง"},400,request,env);const seen=new Set(),normalized=[];for(const item of body.doors){const door=normalizeDoor(item.doorCode);if(!door||door.error)return reply({success:false,message:`กรุณาตรวจสอบรหัสประตู ${item.doorCode||""}`},400,request,env);if(seen.has(door.code))return reply({success:false,message:`มีประตู ${door.code} ซ้ำกัน`},409,request,env);seen.add(door.code);normalized.push({...door,isActive:item.isActive===false||item.isActive===0?0:1})}const activeCount=normalized.filter(item=>item.isActive).length,now=unix(),statements=[env.DB.prepare("UPDATE doors SET is_active=0,updated_at=?").bind(now),...normalized.map(door=>env.DB.prepare("INSERT INTO doors(door_code,group_code,sort_order,is_active,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(door_code) DO UPDATE SET group_code=excluded.group_code,sort_order=excluded.sort_order,is_active=excluded.is_active,updated_at=excluded.updated_at").bind(door.code,door.group,door.number,door.isActive,now,now))];await env.DB.batch(statements);await writeAudit(env,auth.user,"ADMIN_DOORS_SAVE","DOORS",null,null,{count:normalized.length,activeCount},null);return reply({success:true,message:"บันทึกรายการประตูแล้ว",count:normalized.length,activeCount},200,request,env)
}

async function adminSaveShifts(request,env){
  const auth=await requireAdmin(request,env);if(auth.error)return auth.error;const body=await readJson(request);if(!Array.isArray(body.shifts)||body.shifts.length<1||body.shifts.length>12)return reply({success:false,message:"กำหนดกะได้ 1–12 กะ"},400,request,env);const names=new Set(),minutes=new Uint8Array(1440),items=[];for(const input of body.shifts){const name=String(input.name||"").trim(),start=Number(input.startMinute),end=Number(input.endMinute),color=validColor(input.color)?String(input.color).toUpperCase():"#416FC3";if(!name||name.length>60||names.has(normalizeName(name)))return reply({success:false,message:"ชื่อกะต้องไม่ว่างและไม่ซ้ำ"},400,request,env);if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||start>1439||end<0||end>1439||start===end)return reply({success:false,message:`ช่วงเวลาของกะ ${name} ไม่ถูกต้อง`},400,request,env);names.add(normalizeName(name));for(let minute=0;minute<1440;minute++){const inside=start<end?minute>=start&&minute<end:minute>=start||minute<end;if(inside){minutes[minute]++;if(minutes[minute]>1)return reply({success:false,message:"ช่วงเวลากะซ้อนกัน กรุณาตรวจสอบใหม่"},409,request,env)}}items.push({id:crypto.randomUUID(),name,start,end,color})}if(minutes.some(value=>value!==1))return reply({success:false,message:"ช่วงเวลากะต้องครอบคลุมครบ 24 ชั่วโมงโดยไม่มีช่องว่าง"},409,request,env);const now=unix(),statements=[env.DB.prepare("UPDATE shifts SET is_active=0,valid_to=?,updated_at=? WHERE is_active=1 AND valid_to IS NULL").bind(now,now)];for(const item of items)statements.push(env.DB.prepare("INSERT INTO shifts(shift_id,shift_name,start_minute,end_minute,color,is_active,valid_from,valid_to,created_at,updated_at) VALUES(?,?,?,?,?,1,?,NULL,?,?)").bind(item.id,item.name,item.start,item.end,item.color,now,now,now));await env.DB.batch(statements);const backfill=[];for(const item of items){const condition=item.start<item.end?"minute_value>=? AND minute_value<?":"(minute_value>=? OR minute_value<?)";backfill.push(env.DB.prepare(`UPDATE vehicles SET shift_id=?,updated_at=? WHERE shift_id IS NULL AND current_status<>'CLOSED' AND auto_id IN (SELECT auto_id FROM (SELECT auto_id,CAST(((gate_in_at+25200)/60)%1440 AS INTEGER) AS minute_value FROM vehicles) WHERE ${condition})`).bind(item.id,now,item.start,item.end))}if(backfill.length)await env.DB.batch(backfill);await writeAudit(env,auth.user,"ADMIN_SHIFTS_SAVE","SHIFTS",null,null,{count:items.length},"มีผลกับรถใหม่และเติมกะให้รถที่ยังไม่เคยมีกะ");return reply({success:true,message:"บันทึกกะทำงานแล้ว",count:items.length},200,request,env)
}

async function adminSaveAlerts(request,env){
  const auth=await requireAdmin(request,env);if(auth.error)return auth.error;const body=await readJson(request),allowedStages=new Set(["GATE_TO_DOCUMENT","DOCUMENT_TO_RECEIVING_START","RECEIVING_DURATION","RECEIVING_TO_RETURN","RETURN_TO_GATE_OUT","TOTAL_IN_SITE"]),allowedLevels=new Set(["NORMAL","WATCH","WARNING","URGENT","CRITICAL"]);if(!Array.isArray(body.rules)||body.rules.length>30)return reply({success:false,message:"เงื่อนไขการแจ้งเตือนไม่ถูกต้อง"},400,request,env);const grouped=new Map(),seen=new Set(),items=[];for(const input of body.rules){const stage=String(input.stageCode||"").toUpperCase(),level=String(input.levelCode||"").toUpperCase(),startSeconds=Number(input.startSeconds),repeatSeconds=input.repeatSeconds==null||input.repeatSeconds===""?null:Number(input.repeatSeconds),color=String(input.color||"").toUpperCase(),key=`${stage}:${level}`;if(!allowedStages.has(stage)||!allowedLevels.has(level)||seen.has(key)||!Number.isInteger(startSeconds)||startSeconds<0||!validColor(color)||repeatSeconds!=null&&(!Number.isInteger(repeatSeconds)||repeatSeconds<0))return reply({success:false,message:"พบเงื่อนไขแจ้งเตือนที่ไม่ถูกต้องหรือซ้ำกัน"},400,request,env);seen.add(key);if(!grouped.has(stage))grouped.set(stage,[]);grouped.get(stage).push(startSeconds);items.push({stage,level,startSeconds,color,sound:flag(input.soundEnabled),repeatSeconds,isActive:input.isActive===false||input.isActive===0?0:1})}for(const values of grouped.values()){values.sort((a,b)=>a-b);for(let i=1;i<values.length;i++)if(values[i]<=values[i-1])return reply({success:false,message:"เวลาแจ้งเตือนในแต่ละช่วงต้องเรียงจากน้อยไปมากและไม่ซ้ำ"},409,request,env)}const now=unix(),statements=[env.DB.prepare("UPDATE alert_rules SET is_active=0,updated_at=?").bind(now)];for(const item of items)statements.push(env.DB.prepare("INSERT INTO alert_rules(rule_id,stage_code,level_code,start_seconds,color,sound_enabled,repeat_seconds,is_active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(stage_code,level_code) DO UPDATE SET start_seconds=excluded.start_seconds,color=excluded.color,sound_enabled=excluded.sound_enabled,repeat_seconds=excluded.repeat_seconds,is_active=excluded.is_active,updated_at=excluded.updated_at").bind(crypto.randomUUID(),item.stage,item.level,item.startSeconds,item.color,item.sound,item.repeatSeconds,item.isActive,now,now));await env.DB.batch(statements);await writeAudit(env,auth.user,"ADMIN_ALERTS_SAVE","ALERT_RULES",null,null,{count:items.length},null);return reply({success:true,message:"บันทึกเวลาแจ้งเตือนแล้ว",count:items.length},200,request,env)
}

async function adminSaveTracking(request,env){
  const auth=await requireAdmin(request,env);if(auth.error)return auth.error;
  const body=await readJson(request),before=await driverTrackingSettings(env),after={
    enabled:body.enabled===false||body.enabled===0?false:true,
    firstDisplaySeconds:boundedNumber(body.firstDisplaySeconds,before.firstDisplaySeconds,8,60),
    repeatDisplaySeconds:boundedNumber(body.repeatDisplaySeconds,before.repeatDisplaySeconds,8,60),
    maxHours:boundedNumber(body.maxHours,before.maxHours,1,168),
    afterGateOutHours:boundedNumber(body.afterGateOutHours,before.afterGateOutHours,0,48)
  };
  const packed=JSON.stringify({v:1,enabled:after.enabled?1:0,firstDisplaySeconds:after.firstDisplaySeconds,repeatDisplaySeconds:after.repeatDisplaySeconds,maxHours:after.maxHours,afterGateOutHours:after.afterGateOutHours});
  const save=await saveTrackingSettingSchemaSafe(env,packed,auth.user);
  if(!save.success)return reply({success:false,message:save.message,diagnostic:save.diagnostic||null},409,request,env);
  try{await writeAudit(env,auth.user,"ADMIN_DRIVER_TRACKING","SYSTEM","driver_tracking_settings",before,after,null)}catch(error){console.warn("tracking-settings audit failed",String(error?.message||error))}
  return reply({success:true,message:"บันทึกการติดตามคนขับแล้ว",tracking:after,enabled:after.enabled,storage:save.storage},200,request,env)
}

async function saveTrackingSettingSchemaSafe(env,packed,user){
  const key="driver_tracking_enabled";
  try{
    const existing=await env.DB.prepare("SELECT rowid AS __rowid__,* FROM system_settings WHERE setting_key=? LIMIT 1").bind(key).first();
    if(existing){
      const result=await env.DB.prepare("UPDATE system_settings SET setting_value=? WHERE rowid=?").bind(packed,existing.__rowid__).run();
      if(changeCount(result)>0)return{success:true,storage:"UPDATED_EXISTING"};
    }
  }catch(error){
    console.warn("tracking setting lookup/update failed",String(error?.message||error));
  }

  let schema=[];
  try{
    const info=await env.DB.prepare("PRAGMA table_info(system_settings)").all();
    schema=info.results||[];
  }catch(error){
    return{success:false,message:"ไม่สามารถตรวจสอบโครงสร้างการตั้งค่าระบบได้",diagnostic:{stage:"SCHEMA_READ",error:cleanDbError(error)}};
  }
  if(!schema.length)return{success:false,message:"ไม่พบโครงสร้างตารางการตั้งค่าระบบ",diagnostic:{stage:"SCHEMA_EMPTY"}};

  const byName=new Map(schema.map(c=>[String(c.name),c]));
  if(!byName.has("setting_key")||!byName.has("setting_value"))return{success:false,message:"โครงสร้างการตั้งค่าระบบไม่ตรงกับรุ่นที่รองรับ",diagnostic:{stage:"SCHEMA_COLUMNS",columns:schema.map(c=>c.name)}};

  let sample=null;
  try{sample=await env.DB.prepare("SELECT * FROM system_settings LIMIT 1").first()}catch{}
  const columns=[],values=[];
  const now=unix();
  for(const col of schema){
    const name=String(col.name),type=String(col.type||"").toUpperCase(),required=Number(col.notnull||0)===1,hasDefault=col.dflt_value!=null,pk=Number(col.pk||0)>0;
    if(name==="setting_key"){columns.push(name);values.push(key);continue}
    if(name==="setting_value"){columns.push(name);values.push(packed);continue}
    if(pk&&type.includes("INT"))continue;
    if(!required||hasDefault)continue;
    let value;
    if(/created_at|updated_at|modified_at|timestamp|time$/i.test(name))value=now;
    else if(/id$/i.test(name))value=crypto.randomUUID();
    else if(/group|category|section/i.test(name))value="TRACKING";
    else if(/type|kind/i.test(name))value="JSON";
    else if(/name|label|title|description/i.test(name))value="การติดตามคนขับ";
    else if(/user|actor|owner/i.test(name))value=user?.user_id||"SYSTEM";
    else if(sample&&sample[name]!=null)value=sample[name];
    else return{success:false,message:`การตั้งค่าระบบต้องการข้อมูลเพิ่มเติมในช่อง ${name}`,diagnostic:{stage:"REQUIRED_COLUMN",column:name,type:col.type||"",columns:schema.map(c=>({name:c.name,type:c.type,notnull:c.notnull,default:c.dflt_value,pk:c.pk}))}};
    columns.push(name);values.push(value);
  }
  const quote=name=>'"'+String(name).replace(/"/g,'""')+'"';
  const sql=`INSERT INTO system_settings(${columns.map(quote).join(",")}) VALUES(${columns.map(()=>"?").join(",")})`;
  try{
    await env.DB.prepare(sql).bind(...values).run();
    const verify=await env.DB.prepare("SELECT setting_value FROM system_settings WHERE setting_key=? LIMIT 1").bind(key).first();
    if(!verify)return{success:false,message:"สร้างค่าติดตามแล้วแต่ตรวจสอบข้อมูลกลับไม่สำเร็จ",diagnostic:{stage:"VERIFY_AFTER_INSERT"}};
    return{success:true,storage:"SCHEMA_SAFE_SEED"};
  }catch(error){
    console.error("tracking schema-safe seed failed",String(error?.message||error));
    return{success:false,message:"ยังบันทึกการติดตามคนขับไม่ได้ ระบบตรวจพบข้อจำกัดของฐานข้อมูล",diagnostic:{stage:"INSERT",error:cleanDbError(error),columns:schema.map(c=>({name:c.name,type:c.type,notnull:c.notnull,default:c.dflt_value,pk:c.pk}))}};
  }
}

function cleanDbError(error){return String(error?.message||error||"unknown").replace(/\s+/g," ").slice(0,300)}

async function requireAdmin(request,env){const auth=await requireUser(request,env);if(auth.error)return auth;if(auth.user.access_rights!=="ADMIN")return{error:reply({success:false,message:"เฉพาะผู้ดูแลระบบเท่านั้น"},403,request,env)};return auth}
async function activeAdminCount(env){const row=await env.DB.prepare("SELECT COUNT(*) AS total FROM users WHERE access_rights='ADMIN' AND is_active=1").first();return Number(row?.total||0)}
async function writeAudit(env,user,action,targetType,targetId,before,after,reason){await env.DB.prepare("INSERT INTO audit_logs(audit_id,actor_user_id,action_code,target_type,target_id,before_json,after_json,reason,created_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),user?.user_id||null,action,targetType,targetId,JSON.stringify(before??null),JSON.stringify(after??null),reason,unix()).run()}
function flag(value){return value===true||value===1||value==="1"?1:0}
function validColor(value){return /^#[0-9A-F]{6}$/i.test(String(value||""))}
function shiftForTimestamp(shifts,timestamp){const minute=Math.floor((Number(timestamp)+25200)/60)%1440,shift=(shifts||[]).find(item=>Number(item.start_minute)<Number(item.end_minute)?minute>=Number(item.start_minute)&&minute<Number(item.end_minute):minute>=Number(item.start_minute)||minute<Number(item.end_minute));return shift?.shift_id||null}

async function login(request,env){const body=await readJson(request);const name=String(body.name||"").trim();const password=String(body.password||"");if(!name||!password||name.length>120||password.length>200)return reply({success:false,message:"ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"},400,request,env);const user=await env.DB.prepare("SELECT user_id,name,password_hash,access_rights,is_active FROM users WHERE lower(trim(name))=? LIMIT 1").bind(normalizeName(name)).first();if(!user||!user.is_active||!(await verifyPassword(password,user.password_hash)))return reply({success:false,message:"ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"},401,request,env);const rawToken=randomToken(32),tokenHash=await sha256(rawToken),now=unix();const hours=Number((await env.DB.prepare("SELECT setting_value FROM system_settings WHERE setting_key='session_hours'").first())?.setting_value||12);await env.DB.prepare("INSERT INTO sessions(session_id,user_id,token_hash,expires_at,created_at,last_seen_at) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),user.user_id,tokenHash,now+Math.min(Math.max(hours,1),72)*3600,now,now).run();return reply({success:true,token:rawToken,user:publicUser(user)},200,request,env)}
async function me(request,env){const auth=await requireUser(request,env);if(auth.error)return auth.error;return reply({success:true,user:publicUser(auth.user)},200,request,env)}
async function logout(request,env){const token=bearer(request);if(token)await env.DB.prepare("UPDATE sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL").bind(unix(),await sha256(token)).run();return reply({success:true,message:"ออกจากระบบแล้ว"},200,request,env)}

async function activeVehicles(request,env){const auth=await requireUser(request,env);if(auth.error)return auth.error;const now=unix(),[items,doors,doorSetting,trackingEnabled]=await Promise.all([loadActiveVehicles(env,now),env.DB.prepare("SELECT door_code FROM doors WHERE is_active=1 ORDER BY group_code,sort_order,door_code").all(),env.DB.prepare("SELECT use_door,require_door FROM workflow_profiles WHERE is_default=1 AND is_active=1 LIMIT 1").first(),driverTrackingEnabled(env)]);const useDoor=Number(doorSetting?.use_door||0),requireDoor=useDoor?Number(doorSetting?.require_door||0):0;return reply({success:true,serverTime:now,items:items.map(item=>({...item,use_door:useDoor,require_door:requireDoor})),activeDoors:(doors.results||[]).map(row=>row.door_code),doorSettings:{useDoor,requireDoor},trackingEnabled},200,request,env)}


function trackingSecret(env){return String(env.TRACKING_TOKEN_SECRET||env.SYNC_SECRET||"").trim()}
function boundedNumber(value,fallback,min,max){const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,Math.round(n))):fallback}
async function driverTrackingSettings(env){
  const defaults={enabled:true,firstDisplaySeconds:15,repeatDisplaySeconds:20,maxHours:boundedNumber(env.TRACKING_MAX_HOURS,24,1,168),afterGateOutHours:boundedNumber(env.TRACKING_AFTER_GATE_OUT_HOURS,2,0,48)};
  try{
    const row=await env.DB.prepare("SELECT setting_value FROM system_settings WHERE setting_key='driver_tracking_enabled' LIMIT 1").first();
    if(!row)return defaults;
    const raw=String(row.setting_value??"").trim();
    if(raw.startsWith("{")){
      try{const cfg=JSON.parse(raw);return{enabled:cfg.enabled===0||cfg.enabled===false?false:true,firstDisplaySeconds:boundedNumber(cfg.firstDisplaySeconds,defaults.firstDisplaySeconds,8,60),repeatDisplaySeconds:boundedNumber(cfg.repeatDisplaySeconds,defaults.repeatDisplaySeconds,8,60),maxHours:boundedNumber(cfg.maxHours,defaults.maxHours,1,168),afterGateOutHours:boundedNumber(cfg.afterGateOutHours,defaults.afterGateOutHours,0,48)}}catch{}
    }
    const result=await env.DB.prepare("SELECT setting_key,setting_value FROM system_settings WHERE setting_key IN ('driver_tracking_first_seconds','driver_tracking_repeat_seconds','driver_tracking_max_hours','driver_tracking_after_gate_out_hours')").all(),map=new Map((result.results||[]).map(item=>[item.setting_key,item.setting_value]));
    return{enabled:raw!=="0",firstDisplaySeconds:boundedNumber(map.get('driver_tracking_first_seconds'),defaults.firstDisplaySeconds,8,60),repeatDisplaySeconds:boundedNumber(map.get('driver_tracking_repeat_seconds'),defaults.repeatDisplaySeconds,8,60),maxHours:boundedNumber(map.get('driver_tracking_max_hours'),defaults.maxHours,1,168),afterGateOutHours:boundedNumber(map.get('driver_tracking_after_gate_out_hours'),defaults.afterGateOutHours,0,48)};
  }catch(error){console.warn("driverTrackingSettings failed",String(error?.message||error));return defaults}
}
async function driverTrackingEnabled(env){return (await driverTrackingSettings(env)).enabled}
function bytesToBase64Url(bytes){let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}
function textToBase64Url(text){return bytesToBase64Url(encoder.encode(text))}
function base64UrlToText(value){const normalized=String(value||"").replace(/-/g,"+").replace(/_/g,"/");const padded=normalized+"=".repeat((4-normalized.length%4)%4),binary=atob(padded),bytes=Uint8Array.from(binary,ch=>ch.charCodeAt(0));return new TextDecoder().decode(bytes)}
async function trackingSignature(secret,payload){const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]),signature=await crypto.subtle.sign("HMAC",key,encoder.encode(payload));return bytesToBase64Url(new Uint8Array(signature))}
function safeEqual(a,b){const x=String(a||""),y=String(b||"");if(x.length!==y.length)return false;let diff=0;for(let i=0;i<x.length;i++)diff|=x.charCodeAt(i)^y.charCodeAt(i);return diff===0}
async function makeTrackingToken(env,vehicle){const secret=trackingSecret(env);if(!secret)throw new Error("TRACKING_SECRET_MISSING");const payload=textToBase64Url(JSON.stringify({a:String(vehicle.auto_id),g:Number(vehicle.gate_in_at||0)})),signature=await trackingSignature(secret,payload);return `${payload}.${signature}`}
async function readTrackingToken(env,token){const secret=trackingSecret(env);if(!secret)return null;const parts=String(token||"").split(".");if(parts.length!==2||!parts[0]||!parts[1])return null;const expected=await trackingSignature(secret,parts[0]);if(!safeEqual(parts[1],expected))return null;try{const data=JSON.parse(base64UrlToText(parts[0]));if(!data||!data.a)return null;return{autoId:String(data.a),gateInAt:Number(data.g||0)}}catch{return null}}
async function trackingExpiresAt(env,vehicle,settings=null){const cfg=settings||await driverTrackingSettings(env),start=Number(vehicle?.document_submitted_at||vehicle?.gate_in_at||0);let expires=start?start+Math.round(cfg.maxHours*3600):unix()+Math.round(cfg.maxHours*3600);const gateOut=Number(vehicle?.gate_out_at||0);if(gateOut)expires=Math.min(expires,gateOut+Math.round(cfg.afterGateOutHours*3600));return expires}
async function inboundTrackingPayload(env,vehicle,displaySeconds){const cfg=await driverTrackingSettings(env);if(!cfg.enabled)return null;if(!vehicle||vehicle.current_status==="CLOSED"||vehicle.gate_out_at||vehicle.current_status==="WAITING_DOCUMENT_SUBMISSION")return null;try{const first=Number(displaySeconds||20)<=15;return{token:await makeTrackingToken(env,vehicle),displaySeconds:first?cfg.firstDisplaySeconds:cfg.repeatDisplaySeconds,expiresAt:await trackingExpiresAt(env,vehicle,cfg)}}catch{return null}}
function trackingStatusLabel(status){return({WAITING_DOCUMENT_SUBMISSION:"รอยื่นเอกสาร",READY_FOR_RECEIVING:"รอเรียกตรวจรับ",RECEIVING_IN_PROGRESS:"กำลังตรวจรับสินค้า",WAITING_DOCUMENT_RETURN:"รอรับเอกสารคืน",WAITING_GATE_OUT:"รอออกจากพื้นที่",CLOSED:"เสร็จสิ้น"})[status]||"กำลังดำเนินการ"}
function trackingTimeline(vehicle){return[
 {code:"GATE_IN",label:"เข้าพื้นที่",at:Number(vehicle.gate_in_at||0)||null,done:Boolean(vehicle.gate_in_at)},
 {code:"DOCUMENT_SUBMITTED",label:"ยื่นเอกสาร",at:Number(vehicle.document_submitted_at||0)||null,done:Boolean(vehicle.document_submitted_at)},
 {code:"RECEIVING_STARTED",label:"เริ่มตรวจรับ",at:Number(vehicle.receiving_started_at||0)||null,done:Boolean(vehicle.receiving_started_at)},
 {code:"RECEIVING_COMPLETED",label:"รับสินค้าเสร็จ",at:Number(vehicle.receiving_completed_at||0)||null,done:Boolean(vehicle.receiving_completed_at)},
 {code:"DOCUMENT_RETURNED",label:"รับเอกสารคืน",at:Number(vehicle.document_returned_at||0)||null,done:Boolean(vehicle.document_returned_at)},
 {code:"GATE_OUT",label:"ออกจากพื้นที่",at:Number(vehicle.gate_out_at||0)||null,done:Boolean(vehicle.gate_out_at)}]}
async function createTrackLink(request,env){
 const auth=await requireUser(request,env);if(auth.error)return auth.error;if(!["ADMIN","USER"].includes(auth.user.access_rights))return reply({success:false,message:"คุณไม่มีสิทธิ์สร้างลิงก์ติดตาม"},403,request,env);if(!(await driverTrackingEnabled(env)))return reply({success:false,message:"ผู้ดูแลระบบปิดการติดตามสถานะสำหรับคนขับ"},409,request,env);
 const body=await readJson(request),search=String(body.search||body.autoId||body.appointmentNo||"").trim();if(!search)return reply({success:false,message:"กรุณาระบุ Auto ID หรือหมายเลขนัดหมาย"},400,request,env);
 const vehicle=await env.DB.prepare("SELECT auto_id,appointment_no,company_name,vehicle_plate,province,current_status,door_code,gate_in_at,workflow_snapshot_json FROM vehicles WHERE current_status<>'CLOSED' AND (auto_id=? OR appointment_no=?) ORDER BY gate_in_at DESC LIMIT 1").bind(search,search).first();if(!vehicle)return reply({success:false,message:"ไม่พบรถที่กำลังปฏิบัติงาน"},404,request,env);
 let token;try{token=await makeTrackingToken(env,vehicle)}catch(error){if(String(error?.message)==="TRACKING_SECRET_MISSING")return reply({success:false,message:"ยังไม่ได้ตั้งค่ารหัสสำหรับลิงก์ติดตาม"},503,request,env);throw error}
 return reply({success:true,token,vehicle:{autoId:vehicle.auto_id,appointmentNo:vehicle.appointment_no,companyName:vehicle.company_name,vehiclePlate:vehicle.vehicle_plate,province:vehicle.province,status:vehicle.current_status}},200,request,env)}
async function publicTrack(request,env,url){
 const cache=caches.default,cacheKey=new Request(url.toString(),{method:"GET"}),cached=await cache.match(cacheKey);if(cached)return cached;
 if(!(await driverTrackingEnabled(env)))return new Response(JSON.stringify({success:false,disabled:true,reason:"TRACKING_DISABLED",message:"ระบบติดตามสถานะสำหรับคนขับปิดใช้งานชั่วคราว"}),{status:403,headers:{...JSON_HEADERS,"access-control-allow-origin":"*","cache-control":"no-store"}});
 const tokenData=await readTrackingToken(env,url.searchParams.get("t"));if(!tokenData)return new Response(JSON.stringify({success:false,reason:"INVALID_LINK",message:"ลิงก์ติดตามนี้ไม่ถูกต้อง"}),{status:403,headers:{...JSON_HEADERS,"access-control-allow-origin":"*","cache-control":"no-store"}});
 const vehicle=await getVehicle(env,tokenData.autoId);if(!vehicle||Number(vehicle.gate_in_at||0)!==Number(tokenData.gateInAt||0))return new Response(JSON.stringify({success:false,reason:"TRACK_NOT_FOUND",message:"ไม่พบรายการรถสำหรับลิงก์นี้"}),{status:404,headers:{...JSON_HEADERS,"access-control-allow-origin":"*","cache-control":"no-store"}});
 const expiresAt=await trackingExpiresAt(env,vehicle);if(unix()>expiresAt)return new Response(JSON.stringify({success:false,expired:true,reason:"LINK_EXPIRED",message:"การติดตามรายการนี้สิ้นสุดแล้ว"}),{status:410,headers:{...JSON_HEADERS,"access-control-allow-origin":"*","cache-control":"no-store"}});
 const profile=parseObject(vehicle.workflow_snapshot_json)||{},useDoor=enabled(profile.use_door),doorCode=useDoor&&vehicle.door_code?String(vehicle.door_code):null,closed=vehicle.current_status==="CLOSED"||Boolean(vehicle.gate_out_at);
 const refreshByStatus={WAITING_DOCUMENT_SUBMISSION:30,READY_FOR_RECEIVING:20,RECEIVING_IN_PROGRESS:15,WAITING_DOCUMENT_RETURN:20,WAITING_GATE_OUT:30,CLOSED:60},refreshSeconds=refreshByStatus[vehicle.current_status]||20;
 const instruction=vehicle.current_status==="WAITING_DOCUMENT_SUBMISSION"?"กรุณายื่นเอกสารที่จุดบริการ":vehicle.current_status==="READY_FOR_RECEIVING"?"กรุณารอการเรียกเข้าตรวจรับ":vehicle.current_status==="RECEIVING_IN_PROGRESS"?(doorCode?`กรุณาดำเนินการตรวจรับที่ประตู ${doorCode}`:"กำลังตรวจรับสินค้า"):vehicle.current_status==="WAITING_DOCUMENT_RETURN"?"กรุณารอรับเอกสารคืน":vehicle.current_status==="WAITING_GATE_OUT"?"รับเอกสารแล้ว กรุณาดำเนินการออกจากพื้นที่":"รายการเสร็จสิ้นแล้ว";
 const payload={success:true,generatedAt:unix(),refreshSeconds,expiresAt,closed,instruction,lifecycle:{active:unix()<=expiresAt,closed,expiresAt,afterGateOut:Boolean(vehicle.gate_out_at)},vehicle:{autoId:vehicle.auto_id,appointmentNo:vehicle.appointment_no||vehicle.auto_id,companyName:vehicle.company_name||"ไม่ระบุบริษัท",driverName:[vehicle.driver_title,vehicle.driver_first_name,vehicle.driver_last_name].filter(Boolean).join(" ")||null,vehiclePlate:vehicle.vehicle_plate||null,province:vehicle.province||null,status:vehicle.current_status,statusLabel:trackingStatusLabel(vehicle.current_status),doorCode,gateInAt:Number(vehicle.gate_in_at||0)||null,gateOutAt:Number(vehicle.gate_out_at||0)||null},timeline:trackingTimeline(vehicle),build:BUILD_VERSION};
 const response=new Response(JSON.stringify(payload),{status:200,headers:{...JSON_HEADERS,"access-control-allow-origin":"*","cache-control":"public,max-age=5,stale-while-revalidate=5","x-track-build":BUILD_VERSION}});
 await cache.put(cacheKey,response.clone());return response}

async function publicQueue(request,env){
  const cacheUrl=new URL(request.url);cacheUrl.search="";const cacheKey=new Request(cacheUrl.toString(),{method:"GET"}),cache=caches.default;
  const cached=await cache.match(cacheKey);if(cached)return cached;
  const now=unix(),callWindowSeconds=60;
  const sql=`WITH active AS (
    SELECT v.auto_id,v.appointment_no,v.company_name,v.vehicle_plate,v.province,v.current_status,v.door_code,v.gate_in_at,v.workflow_snapshot_json
    FROM vehicles v WHERE v.current_status<>'CLOSED' ORDER BY v.gate_in_at ASC LIMIT 500
  ), ev AS (
    SELECT e.auto_id,
      MAX(CASE WHEN e.event_type='DOCUMENT_SUBMITTED' THEN e.occurred_at END) AS document_submitted_at,
      MAX(CASE WHEN e.event_type='RECEIVING_STARTED' THEN e.occurred_at END) AS receiving_started_at,
      MAX(CASE WHEN e.event_type='RECEIVING_COMPLETED' THEN e.occurred_at END) AS receiving_completed_at,
      MAX(CASE WHEN e.event_type='DOCUMENT_RETURNED' THEN e.occurred_at END) AS document_returned_at
    FROM workflow_events e JOIN active a ON a.auto_id=e.auto_id
    WHERE e.event_type IN ('DOCUMENT_SUBMITTED','RECEIVING_STARTED','RECEIVING_COMPLETED','DOCUMENT_RETURNED')
    GROUP BY e.auto_id
  )
  SELECT a.*,ev.document_submitted_at,ev.receiving_started_at,ev.receiving_completed_at,ev.document_returned_at
  FROM active a LEFT JOIN ev ON ev.auto_id=a.auto_id ORDER BY a.gate_in_at ASC`;
  const result=await env.DB.prepare(sql).all(),items=(result.results||[]).map(row=>publicQueueItem(row,now));
  const counts={WAITING_DOCUMENT_SUBMISSION:0,READY_FOR_RECEIVING:0,RECEIVING_IN_PROGRESS:0,WAITING_DOCUMENT_RETURN:0,WAITING_GATE_OUT:0};
  for(const item of items)if(Object.prototype.hasOwnProperty.call(counts,item.status))counts[item.status]++;
  const calling=items.filter(item=>item.status==='RECEIVING_IN_PROGRESS'&&item.receivingStartedAt&&now-item.receivingStartedAt<=callWindowSeconds).sort((a,b)=>b.receivingStartedAt-a.receivingStartedAt)[0]||null;
  const payload={success:true,generatedAt:now,refreshSeconds:5,callWindowSeconds,calling,counts,items,build:BUILD_VERSION};
  const response=new Response(JSON.stringify(payload),{status:200,headers:{...JSON_HEADERS,"access-control-allow-origin":"*","cache-control":"public,max-age=5","x-queue-build":BUILD_VERSION}});
  await cache.put(cacheKey,response.clone());return response;
}
function publicQueueItem(row,now){
  const profile=parseObject(row.workflow_snapshot_json)||{},useDoor=enabled(profile.use_door),status=String(row.current_status||""),stageSince=queueStageSince(row,status),appointmentNo=String(row.appointment_no||row.auto_id||"-").trim(),companyName=String(row.company_name||"ไม่ระบุบริษัท").trim();
  return{appointmentNo,companyName,vehiclePlate:String(row.vehicle_plate||"").trim()||null,province:String(row.province||"").trim()||null,status,doorCode:useDoor&&row.door_code?String(row.door_code):null,gateInAt:Number(row.gate_in_at||0)||null,stageSince:stageSince||Number(row.gate_in_at||0)||null,receivingStartedAt:Number(row.receiving_started_at||0)||null,elapsedSeconds:Math.max(0,now-(stageSince||Number(row.gate_in_at||now)))}
}
function queueStageSince(row,status){return({WAITING_DOCUMENT_SUBMISSION:row.gate_in_at,READY_FOR_RECEIVING:row.document_submitted_at||row.gate_in_at,RECEIVING_IN_PROGRESS:row.receiving_started_at||row.gate_in_at,WAITING_DOCUMENT_RETURN:row.receiving_completed_at||row.receiving_started_at||row.gate_in_at,WAITING_GATE_OUT:row.document_returned_at||row.receiving_completed_at||row.gate_in_at})[status]||row.gate_in_at}

async function activeVehiclesVersion(request,env){const auth=await requireUser(request,env);if(auth.error)return auth.error;const row=await env.DB.prepare("SELECT COUNT(*) AS active_count,COALESCE(MAX(v.updated_at),0) AS last_changed_at,COALESCE((SELECT COUNT(*) FROM workflow_events e JOIN vehicles a ON a.auto_id=e.auto_id WHERE a.current_status<>'CLOSED'),0) AS active_event_count,COALESCE((SELECT MAX(updated_at) FROM doors),0) AS doors_changed_at,COALESCE((SELECT COUNT(*) FROM doors WHERE is_active=1),0) AS active_door_count,COALESCE((SELECT MAX(updated_at) FROM alert_rules),0) AS alerts_changed_at,COALESCE((SELECT updated_at FROM workflow_profiles WHERE is_default=1 AND is_active=1 LIMIT 1),0) AS workflow_changed_at FROM vehicles v WHERE v.current_status<>'CLOSED'").first();const activeCount=Number(row?.active_count||0),lastChangedAt=Number(row?.last_changed_at||0),activeEventCount=Number(row?.active_event_count||0),doorsChangedAt=Number(row?.doors_changed_at||0),activeDoorCount=Number(row?.active_door_count||0),alertsChangedAt=Number(row?.alerts_changed_at||0),workflowChangedAt=Number(row?.workflow_changed_at||0),alertTick=Math.floor(unix()/30);return reply({success:true,version:`${activeCount}:${lastChangedAt}:${activeEventCount}:${doorsChangedAt}:${activeDoorCount}:${alertsChangedAt}:${workflowChangedAt}:${alertTick}`,activeCount,lastChangedAt,activeEventCount,activeDoorCount,alertTick},200,request,env)}

async function loadActiveVehicles(env,now=unix()){
  const [vehicles,rules]=await Promise.all([
    env.DB.prepare("SELECT v.auto_id,v.appointment_no,v.company_name,trim(COALESCE(v.driver_title,'')||' '||COALESCE(v.driver_first_name,'')||' '||COALESCE(v.driver_last_name,'')) AS driver_name,v.vehicle_plate,v.province,v.vehicle_type,v.current_status,v.door_code,v.gate_in_at,v.shift_id,s.shift_name,CAST(COALESCE(json_extract(v.workflow_snapshot_json,'$.use_door'),0) AS INTEGER) AS use_door,CAST(COALESCE(json_extract(v.workflow_snapshot_json,'$.require_door'),0) AS INTEGER) AS require_door,(SELECT e.occurred_at FROM workflow_events e WHERE e.auto_id=v.auto_id AND e.event_type='DOCUMENT_SUBMITTED' ORDER BY e.occurred_at DESC LIMIT 1) AS document_submitted_at,(SELECT e.occurred_at FROM workflow_events e WHERE e.auto_id=v.auto_id AND e.event_type='RECEIVING_STARTED' ORDER BY e.occurred_at DESC LIMIT 1) AS receiving_started_at,(SELECT e.occurred_at FROM workflow_events e WHERE e.auto_id=v.auto_id AND e.event_type='RECEIVING_COMPLETED' ORDER BY e.occurred_at DESC LIMIT 1) AS receiving_completed_at,(SELECT e.occurred_at FROM workflow_events e WHERE e.auto_id=v.auto_id AND e.event_type='DOCUMENT_RETURNED' ORDER BY e.occurred_at DESC LIMIT 1) AS document_returned_at FROM vehicles v LEFT JOIN shifts s ON s.shift_id=v.shift_id WHERE v.current_status<>'CLOSED' ORDER BY v.gate_in_at ASC LIMIT 500").all(),
    env.DB.prepare("SELECT stage_code,level_code,start_seconds,color,sound_enabled,repeat_seconds FROM alert_rules WHERE is_active=1 ORDER BY stage_code,start_seconds").all()
  ]);
  return (vehicles.results||[]).map(vehicle=>decorateVehicleAlert(vehicle,rules.results||[],now));
}

function decorateVehicleAlert(vehicle,rules,now){
  const stage=alertStageForVehicle(vehicle),stageStartedAt=alertStageStart(vehicle),stageElapsed=Math.max(0,now-Number(stageStartedAt||vehicle.gate_in_at||now)),totalElapsed=Math.max(0,now-Number(vehicle.gate_in_at||now));
  const stageRule=selectAlertRule(rules,stage,stageElapsed),totalRule=selectAlertRule(rules,"TOTAL_IN_SITE",totalElapsed),chosen=strongerAlert(stageRule,totalRule)||{level_code:"NORMAL",color:"#59A63E",sound_enabled:0,stage_code:stage||"TOTAL_IN_SITE"};
  return{...vehicle,alert_stage_code:stage,alert_level:chosen.level_code,alert_color:chosen.color,alert_sound_enabled:Number(chosen.sound_enabled||0),alert_repeat_seconds:chosen.repeat_seconds==null?null:Number(chosen.repeat_seconds),alert_source:chosen===totalRule?"TOTAL_IN_SITE":"CURRENT_STAGE",alert_started_at:Number(stageStartedAt||vehicle.gate_in_at||now),stage_elapsed_seconds:stageElapsed,total_elapsed_seconds:totalElapsed};
}
function alertStageForVehicle(vehicle){return({WAITING_DOCUMENT_SUBMISSION:"GATE_TO_DOCUMENT",READY_FOR_RECEIVING:"DOCUMENT_TO_RECEIVING_START",RECEIVING_IN_PROGRESS:"RECEIVING_DURATION",WAITING_DOCUMENT_RETURN:"RECEIVING_TO_RETURN",WAITING_GATE_OUT:"RETURN_TO_GATE_OUT"})[vehicle.current_status]||"TOTAL_IN_SITE"}
function alertStageStart(vehicle){return({WAITING_DOCUMENT_SUBMISSION:vehicle.gate_in_at,READY_FOR_RECEIVING:vehicle.document_submitted_at||vehicle.gate_in_at,RECEIVING_IN_PROGRESS:vehicle.receiving_started_at||vehicle.document_submitted_at||vehicle.gate_in_at,WAITING_DOCUMENT_RETURN:vehicle.receiving_completed_at||vehicle.receiving_started_at||vehicle.document_submitted_at||vehicle.gate_in_at,WAITING_GATE_OUT:vehicle.document_returned_at||vehicle.receiving_completed_at||vehicle.document_submitted_at||vehicle.gate_in_at})[vehicle.current_status]||vehicle.gate_in_at}
function selectAlertRule(rules,stage,elapsed){let selected=null;for(const rule of rules)if(rule.stage_code===stage&&Number(rule.start_seconds)<=elapsed)selected=rule;return selected}
function strongerAlert(first,second){if(!first)return second;if(!second)return first;return alertRank(second.level_code)>alertRank(first.level_code)?second:first}
function alertRank(level){return({NORMAL:0,WATCH:1,WARNING:2,URGENT:3,CRITICAL:4})[level]??0}

async function dashboardSummary(request,env,url){
  const auth=await requireUser(request,env);if(auth.error)return auth.error;if(!["ADMIN","USER"].includes(auth.user.access_rights))return reply({success:false,message:"คุณไม่มีสิทธิ์ดู Dashboard"},403,request,env);
  const shiftId=String(url.searchParams.get("shiftId")||"").trim(),shiftOptionsResult=await env.DB.prepare("SELECT shift_id,shift_name,start_minute,end_minute,color FROM shifts WHERE is_active=1 AND valid_to IS NULL ORDER BY start_minute").all(),shiftOptions=shiftOptionsResult.results||[],selectedShift=shiftId?shiftOptions.find(item=>String(item.shift_id)===shiftId):null;
  if(shiftId&&!selectedShift)return reply({success:false,message:"ไม่พบกะที่เลือก กรุณาโหลดข้อมูลใหม่"},400,request,env);
  const range=dashboardRange(url.searchParams.get("range"),selectedShift,url.searchParams.get("date"));if(range.error)return reply({success:false,message:range.error},400,request,env);
  const filter=selectedShift?shiftTimeSql(selectedShift):"",bind=values=>values,previous={from:range.from-range.days*86400,to:range.to-range.days*86400},periods=dashboardPeriods(range,selectedShift),periodValues=periods.flatMap(item=>[item.start,item.end]),periodPlaceholders=periods.map(()=>"(?,?)").join(",");
  const metricSql=`SELECT COUNT(*) AS total,SUM(CASE WHEN v.gate_out_at IS NOT NULL THEN 1 ELSE 0 END) AS closed,SUM(CASE WHEN v.gate_out_at IS NULL THEN 1 ELSE 0 END) AS active,AVG(CASE WHEN v.gate_out_at IS NOT NULL THEN v.gate_out_at-v.gate_in_at END) AS avg_total_seconds FROM vehicles v WHERE v.gate_in_at>=? AND v.gate_in_at<?${filter}`;
  const statusSql=`SELECT v.current_status AS label,COUNT(*) AS total FROM vehicles v WHERE v.gate_in_at>=? AND v.gate_in_at<?${filter} GROUP BY v.current_status ORDER BY total DESC`;
  const shiftSql=`SELECT COALESCE(s.shift_name,'ไม่ระบุกะ') AS label,COUNT(*) AS total FROM vehicles v LEFT JOIN shifts s ON s.shift_id=v.shift_id WHERE v.gate_in_at>=? AND v.gate_in_at<?${filter} GROUP BY COALESCE(s.shift_name,'ไม่ระบุกะ') ORDER BY total DESC`;
  const hourSql=`SELECT CAST(strftime('%H',v.gate_in_at,'unixepoch','+7 hours') AS INTEGER) AS hour,COUNT(*) AS total,SUM(CASE WHEN v.gate_out_at IS NOT NULL THEN 1 ELSE 0 END) AS closed,AVG(CASE WHEN v.gate_out_at IS NOT NULL THEN v.gate_out_at-v.gate_in_at END) AS avg_seconds FROM vehicles v WHERE v.gate_in_at>=? AND v.gate_in_at<?${filter} GROUP BY hour ORDER BY hour`;
  const doorSql=`SELECT COALESCE(NULLIF(trim(v.door_code),''),'ไม่ระบุประตู') AS label,COUNT(*) AS total,SUM(CASE WHEN v.gate_out_at IS NOT NULL THEN 1 ELSE 0 END) AS closed,AVG(CASE WHEN v.gate_out_at IS NOT NULL THEN v.gate_out_at-v.gate_in_at END) AS avg_seconds FROM vehicles v WHERE v.gate_in_at>=? AND v.gate_in_at<?${filter} GROUP BY COALESCE(NULLIF(trim(v.door_code),''),'ไม่ระบุประตู') ORDER BY total DESC,avg_seconds DESC LIMIT 12`;
  const shiftPerformanceSql=`SELECT COALESCE(s.shift_id,'') AS shift_id,COALESCE(s.shift_name,'ไม่ระบุกะ') AS label,s.start_minute,s.end_minute,s.color,COUNT(*) AS total,SUM(CASE WHEN v.gate_out_at IS NOT NULL THEN 1 ELSE 0 END) AS closed,AVG(CASE WHEN v.gate_out_at IS NOT NULL THEN v.gate_out_at-v.gate_in_at END) AS avg_seconds FROM vehicles v LEFT JOIN shifts s ON s.shift_id=v.shift_id WHERE v.gate_in_at>=? AND v.gate_in_at<?${filter} GROUP BY s.shift_id,s.shift_name,s.start_minute,s.end_minute,s.color ORDER BY total DESC`;
  const qualitySql=`SELECT SUM(CASE WHEN NULLIF(trim(v.appointment_no),'') IS NULL THEN 1 ELSE 0 END) AS missing_appointment,SUM(CASE WHEN NULLIF(trim(v.vehicle_plate),'') IS NULL THEN 1 ELSE 0 END) AS missing_plate,SUM(CASE WHEN v.shift_id IS NULL THEN 1 ELSE 0 END) AS missing_shift,SUM(CASE WHEN CAST(COALESCE(json_extract(v.workflow_snapshot_json,'$.require_door'),0) AS INTEGER)=1 AND NULLIF(trim(v.door_code),'') IS NULL THEN 1 ELSE 0 END) AS missing_required_door FROM vehicles v WHERE v.gate_in_at>=? AND v.gate_in_at<?${filter}`;
  const durationSql=`SELECT v.gate_out_at-v.gate_in_at AS seconds FROM vehicles v WHERE v.gate_in_at>=? AND v.gate_in_at<? AND v.gate_out_at IS NOT NULL${filter} ORDER BY seconds`;
  const recentSql=`SELECT v.auto_id,v.appointment_no,v.company_name,v.vehicle_plate,v.province,v.door_code,v.gate_in_at,v.gate_out_at,v.gate_out_at-v.gate_in_at AS total_seconds FROM vehicles v WHERE v.gate_in_at>=? AND v.gate_in_at<? AND v.gate_out_at IS NOT NULL${filter} ORDER BY v.gate_out_at DESC LIMIT 10`;
  const stageSql=`WITH selected AS (SELECT v.auto_id,v.gate_in_at,v.gate_out_at FROM vehicles v WHERE v.gate_in_at>=? AND v.gate_in_at<?${filter}),ev AS (SELECT e.auto_id,MAX(CASE WHEN e.event_type='DOCUMENT_SUBMITTED' THEN e.occurred_at END) AS doc_at,MAX(CASE WHEN e.event_type='RECEIVING_STARTED' THEN e.occurred_at END) AS start_at,MAX(CASE WHEN e.event_type='RECEIVING_COMPLETED' THEN e.occurred_at END) AS complete_at,MAX(CASE WHEN e.event_type='DOCUMENT_RETURNED' THEN e.occurred_at END) AS return_at FROM workflow_events e JOIN selected s ON s.auto_id=e.auto_id GROUP BY e.auto_id) SELECT AVG(CASE WHEN ev.doc_at>=s.gate_in_at THEN ev.doc_at-s.gate_in_at END) AS gate_to_doc,AVG(CASE WHEN ev.start_at>=ev.doc_at THEN ev.start_at-ev.doc_at END) AS doc_to_start,AVG(CASE WHEN ev.complete_at>=ev.start_at THEN ev.complete_at-ev.start_at END) AS receiving,AVG(CASE WHEN ev.return_at>=ev.complete_at THEN ev.return_at-ev.complete_at END) AS complete_to_return,AVG(CASE WHEN s.gate_out_at>=ev.return_at THEN s.gate_out_at-ev.return_at END) AS return_to_out FROM selected s LEFT JOIN ev ON ev.auto_id=s.auto_id`;
  const trendFrom=range.code==="today"?range.from-6*86400:range.from;
  const dailySql=`SELECT strftime('%Y-%m-%d',v.gate_in_at,'unixepoch','+7 hours') AS day_key,strftime('%d/%m/%Y',v.gate_in_at,'unixepoch','+7 hours') AS label,COUNT(*) AS total,SUM(CASE WHEN v.gate_out_at IS NOT NULL THEN 1 ELSE 0 END) AS closed,AVG(CASE WHEN v.gate_out_at IS NOT NULL THEN v.gate_out_at-v.gate_in_at END) AS avg_seconds FROM vehicles v WHERE v.gate_in_at>=? AND v.gate_in_at<?${filter} GROUP BY day_key ORDER BY day_key`;
  const heatSql=`WITH top_doors AS (SELECT NULLIF(trim(v.door_code),'') AS door_code FROM vehicles v WHERE v.gate_in_at>=? AND v.gate_in_at<?${filter} AND NULLIF(trim(v.door_code),'') IS NOT NULL GROUP BY NULLIF(trim(v.door_code),'') ORDER BY COUNT(*) DESC LIMIT 8) SELECT v.door_code,CAST(strftime('%H',v.gate_in_at,'unixepoch','+7 hours') AS INTEGER) AS hour,COUNT(*) AS total FROM vehicles v JOIN top_doors d ON d.door_code=v.door_code WHERE v.gate_in_at>=? AND v.gate_in_at<?${filter} GROUP BY v.door_code,hour ORDER BY v.door_code,hour`;
  const targetSql="SELECT MIN(start_seconds) AS target_seconds FROM alert_rules WHERE stage_code='TOTAL_IN_SITE' AND level_code IN ('WARNING','URGENT','CRITICAL') AND is_active=1";
  const workloadSql=`WITH periods(start_at,end_at) AS (VALUES ${periodPlaceholders}),bounds AS (SELECT MIN(start_at) AS first_start,MAX(end_at) AS last_end FROM periods) SELECT (SELECT SUM((SELECT COUNT(*) FROM vehicles v WHERE v.gate_in_at>=p.start_at AND v.gate_in_at<p.end_at)) FROM periods p) AS gate_in,(SELECT SUM((SELECT COUNT(*) FROM vehicles v WHERE v.gate_out_at>=p.start_at AND v.gate_out_at<p.end_at)) FROM periods p) AS gate_out,(SELECT SUM((SELECT COUNT(*) FROM workflow_events e WHERE e.event_type='RECEIVING_COMPLETED' AND e.occurred_at>=p.start_at AND e.occurred_at<p.end_at)) FROM periods p) AS receiving_completed,(SELECT COUNT(*) FROM vehicles v,bounds b WHERE v.gate_in_at<b.first_start AND (v.gate_out_at IS NULL OR v.gate_out_at>=b.first_start)) AS carry_in,(SELECT COUNT(*) FROM vehicles v,bounds b WHERE v.gate_in_at<b.last_end AND (v.gate_out_at IS NULL OR v.gate_out_at>=b.last_end)) AS carry_out,(SELECT SUM((SELECT COUNT(*) FROM vehicles v WHERE v.gate_in_at>=p.start_at AND v.gate_in_at<p.end_at AND v.gate_out_at>=p.start_at AND v.gate_out_at<p.end_at)) FROM periods p) AS same_period_closed,(SELECT SUM((SELECT COUNT(*) FROM vehicles v WHERE v.gate_in_at<p.start_at AND v.gate_out_at>=p.start_at AND v.gate_out_at<p.end_at)) FROM periods p) AS prior_period_closed`;
  const statements=[env.DB.prepare(metricSql).bind(...bind([range.from,range.to])),env.DB.prepare(statusSql).bind(...bind([range.from,range.to])),env.DB.prepare(shiftSql).bind(...bind([range.from,range.to])),env.DB.prepare(hourSql).bind(...bind([range.from,range.to])),env.DB.prepare(doorSql).bind(...bind([range.from,range.to])),env.DB.prepare(shiftPerformanceSql).bind(...bind([range.from,range.to])),env.DB.prepare(qualitySql).bind(...bind([range.from,range.to])),env.DB.prepare(durationSql).bind(...bind([range.from,range.to])),env.DB.prepare(recentSql).bind(...bind([range.from,range.to])),env.DB.prepare(stageSql).bind(...bind([range.from,range.to])),env.DB.prepare(dailySql).bind(...bind([trendFrom,range.to])),env.DB.prepare(metricSql).bind(...bind([previous.from,previous.to])),env.DB.prepare(heatSql).bind(...bind([...bind([range.from,range.to]),range.from,range.to])),env.DB.prepare(targetSql),env.DB.prepare(workloadSql).bind(...periodValues)];
  const boundaryAt=Math.min(unix(),range.to),[batch,rulesResult]=await Promise.all([env.DB.batch(statements),env.DB.prepare("SELECT stage_code,level_code,start_seconds,color,sound_enabled,repeat_seconds FROM alert_rules WHERE is_active=1 ORDER BY stage_code,start_seconds").all()]),rules=rulesResult.results||[],[carryInItems,boundaryItems]=await Promise.all([loadVehiclesAtBoundary(env,range.from,rules),loadVehiclesAtBoundary(env,boundaryAt,rules)]),rows=index=>batch[index]?.results||[],metrics=rows(0)[0]||{},statuses=rows(1),shifts=rows(2),hours=rows(3),doors=rows(4),shiftPerformance=rows(5),dataQuality=rows(6)[0]||{},durations=rows(7),recent=rows(8),stageAverages=rows(9)[0]||{},daily=rows(10),previousMetrics=rows(11)[0]||{},doorHeatmap=rows(12),targetTotalSeconds=Number(rows(13)[0]?.target_seconds||0)||null,workloadRow=rows(14)[0]||{},values=durations.map(row=>Number(row.seconds)).filter(Number.isFinite),p50=percentile(values,.5),p90=percentile(values,.9),alerts=boundaryItems.reduce((acc,item)=>{acc[item.alert_level]=(acc[item.alert_level]||0)+1;return acc},{}),warningNow=(alerts.WARNING||0)+(alerts.URGENT||0)+(alerts.CRITICAL||0),sortedBoundaryItems=[...boundaryItems].sort((a,b)=>alertRank(b.alert_level)-alertRank(a.alert_level)||Number(b.total_elapsed_seconds)-Number(a.total_elapsed_seconds)),actionItems=sortedBoundaryItems.slice(0,12),handoverItems=sortedBoundaryItems.slice(0,100),backlogAging=dashboardBacklogAging(boundaryItems),cycleBands=durationBands(values),activeStages=countVehicleStages(boundaryItems),carryInStages=countVehicleStages(carryInItems),bottleneck=dashboardBottleneck(stageAverages,activeStages),shiftContext=dashboardShiftContext(shiftOptions,shiftId,boundaryAt);
  const currentMetric={total:Number(metrics.total||0),closed:Number(metrics.closed||0),active:Number(metrics.active||0),completionRate:Number(metrics.total||0)?Math.round(Number(metrics.closed||0)*1000/Number(metrics.total))/10:0,avgTotalSeconds:Math.round(Number(metrics.avg_total_seconds||0)),p50TotalSeconds:p50,p90TotalSeconds:p90,activeNow:boundaryItems.length,warningNow};
  const priorMetric={total:Number(previousMetrics.total||0),closed:Number(previousMetrics.closed||0),avgTotalSeconds:Math.round(Number(previousMetrics.avg_total_seconds||0))};
  const workload={gateIn:Number(workloadRow.gate_in||0),gateOut:Number(workloadRow.gate_out||0),receivingCompleted:Number(workloadRow.receiving_completed||0),carryIn:Number(workloadRow.carry_in||0),carryOut:Number(workloadRow.carry_out||0),samePeriodClosed:Number(workloadRow.same_period_closed||0),priorPeriodClosed:Number(workloadRow.prior_period_closed||0),handoverInStages:carryInStages,handoverOutStages:activeStages,balanceApplicable:!selectedShift||range.days===1};
  return reply({success:true,generatedAt:unix(),range:range.code,selectedDate:range.selectedDate,from:range.from,to:range.to,boundaryAt,businessDate:range.businessDate,calculationMode:"GATE_IN_COHORT_AND_SHIFT_THROUGHPUT",metrics:currentMetric,workload,statuses,shifts,hours,doors,shiftPerformance,dataQuality,stageAverages,recent,alertLevels:alerts,activeStages,actionItems,handoverItems,handoverItemCount:boundaryItems.length,backlogAging,cycleBands,bottleneck,shiftOptions,shiftContext,comparison:{previous:priorMetric,delta:{total:deltaPercent(currentMetric.total,priorMetric.total),closed:deltaPercent(currentMetric.closed,priorMetric.closed),avgTotalSeconds:deltaPercent(currentMetric.avgTotalSeconds,priorMetric.avgTotalSeconds)},daily,trendFrom,doorHeatmap,targetTotalSeconds}},200,request,env);
}
async function dashboardCalendar(request,env,url){const auth=await requireUser(request,env);if(auth.error)return auth.error;if(!["ADMIN","USER"].includes(auth.user.access_rights))return reply({success:false,message:"คุณไม่มีสิทธิ์ดู Dashboard"},403,request,env);const month=parseDashboardMonth(url.searchParams.get("month"));if(!month)return reply({success:false,message:"เดือนไม่ถูกต้อง"},400,request,env);const sql=`WITH RECURSIVE days(day_start) AS (VALUES(?) UNION ALL SELECT day_start+86400 FROM days WHERE day_start+86400<?),threshold AS (SELECT MIN(start_seconds) AS seconds FROM alert_rules WHERE stage_code='TOTAL_IN_SITE' AND level_code IN ('WARNING','URGENT','CRITICAL') AND is_active=1) SELECT strftime('%Y-%m-%d',d.day_start,'unixepoch','+7 hours') AS day_key,(SELECT COUNT(*) FROM vehicles v WHERE v.gate_in_at>=d.day_start AND v.gate_in_at<d.day_start+86400) AS gate_in,(SELECT COUNT(*) FROM vehicles v WHERE v.gate_out_at>=d.day_start AND v.gate_out_at<d.day_start+86400) AS gate_out,(SELECT COUNT(*) FROM vehicles v WHERE v.gate_in_at<d.day_start+86400 AND (v.gate_out_at IS NULL OR v.gate_out_at>=d.day_start+86400)) AS carry_out,(SELECT COUNT(*) FROM vehicles v,threshold t WHERE t.seconds IS NOT NULL AND v.gate_in_at<d.day_start+86400-t.seconds AND (v.gate_out_at IS NULL OR v.gate_out_at>=d.day_start+86400)) AS overdue FROM days d ORDER BY d.day_start`;const result=await env.DB.prepare(sql).bind(month.from,month.to).all();return reply({success:true,month:month.key,generatedAt:unix(),days:(result.results||[]).map(row=>({date:row.day_key,gateIn:Number(row.gate_in||0),gateOut:Number(row.gate_out||0),carryOut:Number(row.carry_out||0),overdue:Number(row.overdue||0)}))},200,request,env)}
function dashboardRange(value,shift,dateValue){const code=["today","7d","30d"].includes(value)?value:"today",today=Math.floor((unix()+25200)/86400)*86400-25200,selected=parseDashboardDate(dateValue);if(dateValue&&!selected)return{error:"วันที่ไม่ถูกต้อง"};const anchor=selected??today,days=code==="30d"?30:code==="7d"?7:1,firstDay=anchor-(days-1)*86400;if(!shift)return{code,days,from:firstDay,to:anchor+86400,businessDate:anchor,selectedDate:dashboardDateKey(anchor)};const start=Number(shift.start_minute)*60,duration=shiftDurationSeconds(shift);return{code,days,from:firstDay+start,to:anchor+start+duration,businessDate:anchor,selectedDate:dashboardDateKey(anchor)}}
function dashboardPeriods(range,shift){const periods=[];for(let index=0;index<range.days;index++){const day=range.businessDate-(range.days-1-index)*86400;if(!shift){periods.push({start:day,end:day+86400});continue}const start=day+Number(shift.start_minute)*60,duration=shiftDurationSeconds(shift);periods.push({start,end:start+duration})}return periods}
function shiftDurationSeconds(shift){const minutes=(Number(shift.end_minute)-Number(shift.start_minute)+1440)%1440;return(minutes||1440)*60}
function parseDashboardDate(value){const match=String(value||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!match)return null;const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]),utc=Math.floor(Date.UTC(year,month-1,day)/1000)-25200,date=new Date((utc+25200)*1000);return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?utc:null}
function parseDashboardMonth(value){const match=String(value||"").match(/^(\d{4})-(\d{2})$/);if(!match)return null;const year=Number(match[1]),month=Number(match[2]);if(year<2020||year>2100||month<1||month>12)return null;const from=Math.floor(Date.UTC(year,month-1,1)/1000)-25200,to=Math.floor(Date.UTC(year,month,1)/1000)-25200;return{key:`${year}-${String(month).padStart(2,"0")}`,from,to}}
function dashboardDateKey(timestamp){return new Date((Number(timestamp)+25200)*1000).toISOString().slice(0,10)}
async function loadVehiclesAtBoundary(env,boundary,rules){const result=await env.DB.prepare("SELECT v.auto_id,v.appointment_no,v.company_name,trim(COALESCE(v.driver_title,'')||' '||COALESCE(v.driver_first_name,'')||' '||COALESCE(v.driver_last_name,'')) AS driver_name,v.vehicle_plate,v.province,v.vehicle_type,v.door_code,v.gate_in_at,v.gate_out_at,v.workflow_snapshot_json,(SELECT MAX(e.occurred_at) FROM workflow_events e WHERE e.auto_id=v.auto_id AND e.event_type='DOCUMENT_SUBMITTED' AND e.occurred_at<=?) AS document_submitted_at,(SELECT MAX(e.occurred_at) FROM workflow_events e WHERE e.auto_id=v.auto_id AND e.event_type='RECEIVING_STARTED' AND e.occurred_at<=?) AS receiving_started_at,(SELECT MAX(e.occurred_at) FROM workflow_events e WHERE e.auto_id=v.auto_id AND e.event_type='RECEIVING_COMPLETED' AND e.occurred_at<=?) AS receiving_completed_at,(SELECT MAX(e.occurred_at) FROM workflow_events e WHERE e.auto_id=v.auto_id AND e.event_type='DOCUMENT_RETURNED' AND e.occurred_at<=?) AS document_returned_at FROM vehicles v WHERE v.gate_in_at<? AND (v.gate_out_at IS NULL OR v.gate_out_at>=?) ORDER BY v.gate_in_at").bind(boundary,boundary,boundary,boundary,boundary,boundary).all();return(result.results||[]).map(vehicle=>{vehicle.current_status=vehicleStatusAtBoundary(vehicle);return decorateVehicleAlert(vehicle,rules,boundary)})}
function vehicleStatusAtBoundary(vehicle){const profile=parseObject(vehicle.workflow_snapshot_json)||{};if(vehicle.document_returned_at)return"WAITING_GATE_OUT";if(vehicle.receiving_completed_at)return Number(profile.use_inbound_second)?"WAITING_DOCUMENT_RETURN":"WAITING_GATE_OUT";if(vehicle.receiving_started_at)return"RECEIVING_IN_PROGRESS";if(vehicle.document_submitted_at){if(Number(profile.use_receiving))return"READY_FOR_RECEIVING";return Number(profile.use_inbound_second)?"WAITING_DOCUMENT_RETURN":"WAITING_GATE_OUT"}if(Number(profile.use_inbound_first))return"WAITING_DOCUMENT_SUBMISSION";if(Number(profile.use_receiving))return"READY_FOR_RECEIVING";return Number(profile.use_inbound_second)?"WAITING_DOCUMENT_RETURN":"WAITING_GATE_OUT"}
function countVehicleStages(items){return(items||[]).reduce((acc,item)=>{acc[item.current_status]=(acc[item.current_status]||0)+1;return acc},{})}
function shiftTimeSql(shift){const start=Number(shift.start_minute),end=Number(shift.end_minute),minute="CAST(((v.gate_in_at+25200)/60)%1440 AS INTEGER)";return start<end?` AND ${minute}>=${start} AND ${minute}<${end}`:` AND (${minute}>=${start} OR ${minute}<${end})`}
function timestampInShift(timestamp,shift){const minute=Math.floor((Number(timestamp)+25200)/60)%1440,start=Number(shift.start_minute),end=Number(shift.end_minute);return start<end?minute>=start&&minute<end:minute>=start||minute<end}
function deltaPercent(current,previous){const a=Number(current||0),b=Number(previous||0);if(!b)return a?100:0;return Math.round((a-b)*1000/b)/10}
function dashboardShiftContext(shifts,selectedId,now){const minute=Math.floor(((now+25200)%86400)/60),selected=selectedId?shifts.find(item=>String(item.shift_id)===String(selectedId)):null,current=shifts.find(item=>{const start=Number(item.start_minute),end=Number(item.end_minute);return start===end||start<end?minute>=start&&minute<end:minute>=start||minute<end})||null,item=selected||current;return{selected:Boolean(selectedId),shiftId:item?.shift_id||null,shiftName:item?.shift_name||"ไม่พบกะปัจจุบัน",startMinute:item?.start_minute==null?null:Number(item.start_minute),endMinute:item?.end_minute==null?null:Number(item.end_minute),color:item?.color||"#416FC3",crossesMidnight:item?Number(item.start_minute)>=Number(item.end_minute):false}}
function percentile(values,ratio){if(!values.length)return null;return values[Math.min(values.length-1,Math.max(0,Math.ceil(values.length*ratio)-1))]}
function durationBands(values){const bands=[{label:"ไม่เกิน 1 ชม.",total:0},{label:"1–2 ชม.",total:0},{label:"2–3 ชม.",total:0},{label:"มากกว่า 3 ชม.",total:0}];for(const value of values){if(value<=3600)bands[0].total++;else if(value<=7200)bands[1].total++;else if(value<=10800)bands[2].total++;else bands[3].total++}return bands}
function dashboardBacklogAging(items){
  const stages=["WAITING_DOCUMENT_SUBMISSION","READY_FOR_RECEIVING","RECEIVING_IN_PROGRESS","WAITING_DOCUMENT_RETURN","WAITING_GATE_OUT"],buckets=[{key:"UNDER_30",label:"ไม่เกิน 30 นาที",min:0,max:1800},{key:"MIN_30_60",label:"30–60 นาที",min:1800,max:3600},{key:"HOUR_1_2",label:"1–2 ชั่วโมง",min:3600,max:7200},{key:"HOUR_2_3",label:"2–3 ชั่วโมง",min:7200,max:10800},{key:"OVER_3",label:"มากกว่า 3 ชั่วโมง",min:10800,max:Infinity}],result=buckets.map(bucket=>({key:bucket.key,label:bucket.label,total:0,stages:Object.fromEntries(stages.map(stage=>[stage,0]))}));
  for(const item of items||[]){const seconds=Math.max(0,Number(item.total_elapsed_seconds)||0),index=buckets.findIndex(bucket=>seconds>=bucket.min&&seconds<bucket.max),target=result[index<0?result.length-1:index],stage=stages.includes(item.current_status)?item.current_status:"WAITING_GATE_OUT";target.total++;target.stages[stage]++}
  return result;
}
function dashboardBottleneck(stageAverages,activeStages){const candidates=[{code:"GATE_TO_DOCUMENT",label:"รอยื่นเอกสาร",avg:Number(stageAverages?.gate_to_doc||0),queue:Number(activeStages.WAITING_DOCUMENT_SUBMISSION||0)},{code:"DOCUMENT_TO_RECEIVING_START",label:"รอเริ่มตรวจรับ",avg:Number(stageAverages?.doc_to_start||0),queue:Number(activeStages.READY_FOR_RECEIVING||0)},{code:"RECEIVING_DURATION",label:"กำลังตรวจรับ",avg:Number(stageAverages?.receiving||0),queue:Number(activeStages.RECEIVING_IN_PROGRESS||0)},{code:"RECEIVING_TO_RETURN",label:"รอรับเอกสารคืน",avg:Number(stageAverages?.complete_to_return||0),queue:Number(activeStages.WAITING_DOCUMENT_RETURN||0)},{code:"RETURN_TO_GATE_OUT",label:"รอออกจากพื้นที่",avg:Number(stageAverages?.return_to_out||0),queue:Number(activeStages.WAITING_GATE_OUT||0)}];return candidates.sort((a,b)=>b.queue-a.queue||b.avg-a.avg)[0]}

async function requireUser(request,env){const token=bearer(request);if(!token)return{error:reply({success:false,message:"กรุณาเข้าสู่ระบบ"},401,request,env)};const now=unix();const user=await env.DB.prepare("SELECT u.user_id,u.name,u.access_rights,u.is_active,s.session_id,s.last_seen_at FROM sessions s JOIN users u ON u.user_id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? LIMIT 1").bind(await sha256(token),now).first();if(!user||!user.is_active)return{error:reply({success:false,message:"กรุณาเข้าสู่ระบบอีกครั้ง"},401,request,env)};if(Number(user.last_seen_at||0)<now-300)await env.DB.prepare("UPDATE sessions SET last_seen_at=? WHERE session_id=?").bind(now,user.session_id).run();return{user}}
function publicUser(user){return{userId:user.user_id,name:user.name,accessRights:user.access_rights}}
function publicVehicle(vehicle){if(!vehicle)return null;const profile=parseObject(vehicle.workflow_snapshot_json)||{};return{autoId:vehicle.auto_id,appointmentNo:vehicle.appointment_no,companyName:vehicle.company_name,driverName:[vehicle.driver_title,vehicle.driver_first_name,vehicle.driver_last_name].filter(Boolean).join(" ")||vehicle.driver_name||null,vehiclePlate:vehicle.vehicle_plate,province:vehicle.province,vehicleType:vehicle.vehicle_type,currentStatus:vehicle.current_status,doorCode:vehicle.door_code,gateInAt:vehicle.gate_in_at,documentSubmittedAt:vehicle.document_submitted_at,receivingStartedAt:vehicle.receiving_started_at,receivingCompletedAt:vehicle.receiving_completed_at,documentReturnedAt:vehicle.document_returned_at,useDoor:Number(vehicle.use_door??profile.use_door??0),requireDoor:Number(vehicle.require_door??profile.require_door??0)}}
async function getVehicle(env,autoId){return env.DB.prepare("SELECT v.auto_id,v.appointment_no,v.company_name,v.driver_title,v.driver_first_name,v.driver_last_name,v.vehicle_plate,v.province,v.vehicle_type,v.current_status,v.door_code,v.gate_in_at,v.gate_out_at,v.workflow_profile_id,v.workflow_snapshot_json,(SELECT e.occurred_at FROM workflow_events e WHERE e.auto_id=v.auto_id AND e.event_type='DOCUMENT_SUBMITTED' ORDER BY e.occurred_at DESC LIMIT 1) AS document_submitted_at,(SELECT e.occurred_at FROM workflow_events e WHERE e.auto_id=v.auto_id AND e.event_type='RECEIVING_STARTED' ORDER BY e.occurred_at DESC LIMIT 1) AS receiving_started_at,(SELECT e.occurred_at FROM workflow_events e WHERE e.auto_id=v.auto_id AND e.event_type='RECEIVING_COMPLETED' ORDER BY e.occurred_at DESC LIMIT 1) AS receiving_completed_at,(SELECT e.occurred_at FROM workflow_events e WHERE e.auto_id=v.auto_id AND e.event_type='DOCUMENT_RETURNED' ORDER BY e.occurred_at DESC LIMIT 1) AS document_returned_at FROM vehicles v WHERE v.auto_id=? LIMIT 1").bind(autoId).first()}
async function vehicleProfile(env,vehicle){const snapshot=parseObject(vehicle?.workflow_snapshot_json);return snapshot||env.DB.prepare("SELECT * FROM workflow_profiles WHERE profile_id=? LIMIT 1").bind(vehicle.workflow_profile_id).first()}
function readIdempotencyKey(request,body){return String(request.headers.get("x-idempotency-key")||body.idempotencyKey||"").trim()}
function validIdempotencyKey(value){return value.length>=8&&value.length<=160}
function validAutoId(value){return Boolean(value)&&value.length<=160}
function normalizeDoor(value){const text=String(value||"").trim().toUpperCase();if(!text)return null;const match=text.match(/^(SS|RR|SR|RS|S|R)(\d{1,3})$/);if(!match)return{error:true};return{code:match[1]+match[2],group:match[1],number:Number(match[2])}}
async function receivingDuplicateByKey(env,key,autoId,eventType){const prior=await env.DB.prepare("SELECT auto_id,event_type FROM workflow_events WHERE idempotency_key=? LIMIT 1").bind(key).first();if(!prior)return null;if(prior.auto_id!==autoId||prior.event_type!==eventType)return{status:409,data:{success:false,message:"รายการยืนยันซ้ำไม่ตรงกับข้อมูลเดิม"}};const vehicle=await getVehicle(env,autoId);return{status:200,data:{success:true,duplicate:true,message:eventType==="RECEIVING_STARTED"?receivingStartDuplicateMessage(vehicle):"รถคันนี้ยืนยันรับสินค้าเสร็จแล้ว",vehicle:publicVehicle(vehicle)}}}
function receivingStartDuplicateMessage(vehicle){return vehicle?.current_status==="RECEIVING_IN_PROGRESS"?"รถคันนี้เริ่มตรวจรับสินค้าแล้ว":vehicle?.current_status==="WAITING_DOCUMENT_RETURN"||vehicle?.current_status==="WAITING_GATE_OUT"?"รถคันนี้รับสินค้าเสร็จแล้ว":"รถคันนี้บันทึกเริ่มตรวจรับแล้ว"}
function receivingStatusConflictMessage(status){return({WAITING_DOCUMENT_SUBMISSION:"รถคันนี้ยังไม่ยื่นเอกสาร",RECEIVING_IN_PROGRESS:"รถคันนี้กำลังตรวจรับสินค้า",WAITING_DOCUMENT_RETURN:"รถคันนี้รับสินค้าเสร็จแล้ว รอรับเอกสารคืน",WAITING_GATE_OUT:"รถคันนี้รับสินค้าเสร็จแล้ว รอออกจากพื้นที่",CLOSED:"รถคันนี้ออกจากพื้นที่และปิดงานแล้ว"})[status]||"รถคันนี้ไม่อยู่ในขั้นตอนตรวจรับสินค้า"}
async function requireInboundUser(request,env){const auth=await requireUser(request,env);if(auth.error)return auth;if(!["ADMIN","INBOUND"].includes(auth.user.access_rights))return{error:reply({success:false,message:"คุณไม่มีสิทธิ์บันทึกขั้นตอนนี้"},403,request,env)};return auth}
function validateInboundRequest(request,body){const autoId=String(body.autoId||"").trim(),idempotencyKey=readIdempotencyKey(request,body),source=["camera","scanner"].includes(body.source)?body.source:"manual";if(!validAutoId(autoId))return{error:"กรุณาระบุ Auto ID ให้ถูกต้อง"};if(!validIdempotencyKey(idempotencyKey))return{error:"ไม่สามารถยืนยันรายการได้ กรุณาลองใหม่"};return{autoId,idempotencyKey,source}}
function initialWorkflowStatus(profile){if(enabled(profile.use_inbound_first))return"WAITING_DOCUMENT_SUBMISSION";if(enabled(profile.use_receiving))return"READY_FOR_RECEIVING";if(enabled(profile.use_inbound_second))return"WAITING_DOCUMENT_RETURN";return"WAITING_GATE_OUT"}
async function inboundScanInformation(env,vehicle){const status=vehicle?.current_status,returned=Boolean(vehicle?.document_returned_at),message=status==="READY_FOR_RECEIVING"?"ยื่นเอกสารแล้ว รอตรวจรับสินค้า":status==="RECEIVING_IN_PROGRESS"?"ยื่นเอกสารแล้ว กำลังตรวจรับสินค้า":status==="WAITING_GATE_OUT"?(returned?"รับเอกสารคืนแล้ว รอออกจากพื้นที่":"ผ่านขั้นตอน Inbound แล้ว รอออกจากพื้นที่"):status==="CLOSED"?"รถคันนี้ออกจากพื้นที่และปิดงานแล้ว":statusConflictMessage(status);return{success:true,duplicate:true,action:"NONE",message,vehicle:publicVehicle(vehicle),tracking:await inboundTrackingPayload(env,vehicle,20)}}
function returnStatusConflictMessage(status){return({WAITING_DOCUMENT_SUBMISSION:"รถคันนี้ยังไม่ยื่นเอกสาร",READY_FOR_RECEIVING:"รถคันนี้กำลังรอตรวจรับสินค้า",RECEIVING_IN_PROGRESS:"รถคันนี้กำลังตรวจรับสินค้า",WAITING_GATE_OUT:"รถคันนี้ผ่านขั้นตอน Inbound แล้ว รอออกจากพื้นที่",CLOSED:"รถคันนี้ออกจากพื้นที่และปิดงานแล้ว"})[status]||"รถคันนี้ยังไม่อยู่ในขั้นตอนรับเอกสารคืน"}
function enabled(value){return value===1||value==="1"||value===true}
function parseObject(value){try{const parsed=JSON.parse(String(value||""));return parsed&&typeof parsed==="object"?parsed:null}catch{return null}}
function changeCount(result){return Number(result?.meta?.changes||0)}
function inboundDuplicateMessage(vehicle){return({READY_FOR_RECEIVING:"ยื่นเอกสารแล้ว รอตรวจรับสินค้า",RECEIVING_IN_PROGRESS:"ยื่นเอกสารแล้ว กำลังตรวจรับสินค้า",WAITING_DOCUMENT_RETURN:"รับสินค้าเสร็จแล้ว รอรับเอกสารคืน",DOCUMENT_RETURNED:"รับเอกสารคืนแล้ว",WAITING_GATE_OUT:"ผ่านขั้นตอนยื่นเอกสารแล้ว รอออกจากพื้นที่",CLOSED:"รถคันนี้ออกจากพื้นที่และปิดงานแล้ว"})[vehicle?.current_status]||"รถคันนี้บันทึกยื่นเอกสารแล้ว"}
function statusConflictMessage(status){return({DOCUMENT_SUBMITTED:"รถคันนี้ยื่นเอกสารแล้ว",READY_FOR_RECEIVING:"รถคันนี้พร้อมตรวจรับแล้ว",RECEIVING_IN_PROGRESS:"รถคันนี้กำลังตรวจรับ",WAITING_DOCUMENT_RETURN:"รถคันนี้อยู่ระหว่างรอรับเอกสารคืน",DOCUMENT_RETURNED:"รถคันนี้รับเอกสารคืนแล้ว",WAITING_GATE_OUT:"รถคันนี้รอออกจากพื้นที่"})[status]||"รถคันนี้ไม่อยู่ในขั้นตอนยื่นเอกสาร"}
function bearer(request){const value=request.headers.get("authorization")||"";return value.startsWith("Bearer ")?value.slice(7).trim():""}
function validSync(request,env){return Boolean(env.SYNC_SECRET)&&request.headers.get("x-sync-key")===env.SYNC_SECRET}
async function readJson(request){try{return await request.json()}catch{return{}}}
function nullable(value){const cleaned=String(value==null?"":value).trim();return cleaned||null}
async function hashPassword(password){const salt=crypto.getRandomValues(new Uint8Array(16)),iterations=PASSWORD_ITERATIONS,key=await crypto.subtle.importKey("raw",encoder.encode(password),"PBKDF2",false,["deriveBits"]),bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt,iterations},key,256);return`${toHex(salt)}.${iterations}.${toHex(new Uint8Array(bits))}`}
async function verifyPassword(password,stored){const [saltHex,iterationText,expected]=String(stored||"").split(".");const iterations=Number(iterationText);if(!saltHex||!expected||!Number.isInteger(iterations)||iterations<1||iterations>PASSWORD_ITERATIONS)return false;const salt=fromHex(saltHex),key=await crypto.subtle.importKey("raw",encoder.encode(password),"PBKDF2",false,["deriveBits"]),bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt,iterations},key,256);return timingSafe(toHex(new Uint8Array(bits)),expected)}
async function sha256(value){return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(value))))}
function timingSafe(a,b){if(a.length!==b.length)return false;let result=0;for(let i=0;i<a.length;i++)result|=a.charCodeAt(i)^b.charCodeAt(i);return result===0}
function randomToken(bytes){return toHex(crypto.getRandomValues(new Uint8Array(bytes)))} function toHex(bytes){return[...bytes].map(b=>b.toString(16).padStart(2,"0")).join("")} function fromHex(value){return new Uint8Array(value.match(/.{1,2}/g).map(v=>parseInt(v,16)))} function normalizeName(value){return String(value||"").trim().toLocaleLowerCase("th-TH")} function unix(){return Math.floor(Date.now()/1000)}
function reply(data,status,request,env){return cors(new Response(JSON.stringify(data),{status,headers:JSON_HEADERS}),request,env)}
function cors(response,request,env){const origin=request.headers.get("origin")||"",allowed=(env.ALLOWED_ORIGINS||"").split(",").map(v=>v.trim()).filter(Boolean);if(allowed.includes(origin))response.headers.set("access-control-allow-origin",origin);response.headers.set("vary","Origin");response.headers.set("access-control-allow-methods","GET,POST,OPTIONS");response.headers.set("access-control-allow-headers","content-type,authorization,x-sync-key,x-idempotency-key");response.headers.set("access-control-max-age","86400");return response}
