import { useEffect,useState } from "react";
import { Button,Card,Empty,Input,Select,Space,Table,Tag,Typography,message } from "antd";
import type { TableColumnsType } from "antd";
import { api } from "../lib/api";
const {Text}=Typography;
type Unit={id:string;code:string;name:string};
type ClassOption={id:string;name:string;gradeLabel:string;academicYear:string};
type Session={id:string;sessionDate:string;status:"draft"|"submitted"|"locked";classGroupId:string;className:string;subjectName:string|null};
type RecordRow={id:string;studentId:string;fullName:string;admissionNumber:string;status:"unmarked"|"present"|"absent"|"late"|"sick"|"permission";note:string|null};
const statusOptions=[{value:"present",label:"Hadir"},{value:"absent",label:"Tidak Hadir"},{value:"late",label:"Terlambat"},{value:"sick",label:"Sakit"},{value:"permission",label:"Izin"},{value:"unmarked",label:"Belum Diisi"}];
export function AttendanceManagement({schoolUnits}:{schoolUnits:Unit[]}){
 const [schoolId,setSchoolId]=useState<string>();const [classes,setClasses]=useState<ClassOption[]>([]);const [sessions,setSessions]=useState<Session[]>([]);
 const [selectedClass,setSelectedClass]=useState<string>();const [selectedDate,setSelectedDate]=useState(new Date().toISOString().slice(0,10));
 const [sessionId,setSessionId]=useState<string>();const [records,setRecords]=useState<RecordRow[]>([]);const [sessionStatus,setSessionStatus]=useState<Session["status"]>("draft");
 const [loading,setLoading]=useState(false);const [saving,setSaving]=useState(false);
 useEffect(()=>{if(!schoolId&&schoolUnits.length)setSchoolId(schoolUnits[0]!.id);},[schoolUnits,schoolId]);
 async function loadBase(){if(!schoolId)return;setLoading(true);try{const headers={headers:{"x-school-id":schoolId}};
  const [c,s]=await Promise.all([api.get("/api/v1/attendance/classes",headers),api.get("/api/v1/attendance/sessions",{...headers,params:{date:selectedDate,classGroupId:selectedClass||undefined}})]);
  setClasses(c.data.data as ClassOption[]);setSessions(s.data.data as Session[]);
 }catch{message.error("Data absensi gagal dimuat.");}finally{setLoading(false);}}
 useEffect(()=>{void loadBase();},[schoolId,selectedDate,selectedClass]);
 async function openSession(id:string){if(!schoolId)return;try{const r=await api.get(`/api/v1/attendance/sessions/${id}`,{headers:{"x-school-id":schoolId}});const d=r.data.data as {session:Session;records:RecordRow[]};setSessionId(id);setSessionStatus(d.session.status);setRecords(d.records);}catch{message.error("Daftar kehadiran gagal dimuat.");}}
 async function createSession(){if(!schoolId||!selectedClass)return;setSaving(true);try{const r=await api.post("/api/v1/attendance/sessions",{classGroupId:selectedClass,sessionDate:selectedDate},{headers:{"x-school-id":schoolId}});message.success("Sesi absensi dibuat.");await loadBase();await openSession(r.data.data.id as string);}catch(error:unknown){const r=(error as {response?:{data?:{error?:{message?:string}}}}).response;message.error(r?.data?.error?.message??"Sesi absensi gagal dibuat.");}finally{setSaving(false);}}
 function changeStatus(studentId:string,status:RecordRow["status"]){setRecords(current=>current.map(row=>row.studentId===studentId?{...row,status}:row));}
 async function saveRecords(){if(!schoolId||!sessionId)return;setSaving(true);try{await api.put(`/api/v1/attendance/sessions/${sessionId}/records`,{records:records.map(r=>({studentId:r.studentId,status:r.status,note:r.note??undefined}))},{headers:{"x-school-id":schoolId}});message.success("Absensi berhasil disimpan.");await openSession(sessionId);}catch(error:unknown){const r=(error as {response?:{data?:{error?:{message?:string}}}}).response;message.error(r?.data?.error?.message??"Absensi gagal disimpan.");}finally{setSaving(false);}}
 async function submitSession(){if(!schoolId||!sessionId)return;setSaving(true);try{await api.post(`/api/v1/attendance/sessions/${sessionId}/submit`,{},{headers:{"x-school-id":schoolId}});message.success("Absensi berhasil dikirim.");setSessionStatus("submitted");await loadBase();}catch(error:unknown){const r=(error as {response?:{data?:{error?:{message?:string}}}}).response;message.error(r?.data?.error?.message??"Absensi belum dapat dikirim.");}finally{setSaving(false);}}
 const columns:TableColumnsType<RecordRow>=[
  {title:"Nomor Induk",dataIndex:"admissionNumber",key:"admissionNumber"},
  {title:"Nama Siswa",dataIndex:"fullName",key:"fullName",render:(v:string)=><Text strong>{v}</Text>},
  {title:"Status Kehadiran",dataIndex:"status",key:"status",render:(v:RecordRow["status"],row)=><Select size="small" style={{width:160}} disabled={sessionStatus!=="draft"} value={v} options={statusOptions} onChange={next=>changeStatus(row.studentId,next)}/>},
 ];
 return <Space direction="vertical" style={{width:"100%"}} size="middle">
  <Card><Space wrap style={{width:"100%",justifyContent:"space-between"}}><div><Text strong>Absensi Siswa</Text><div><Text type="secondary">Pencatatan kehadiran per kelas dan tanggal.</Text></div></div><Select style={{minWidth:230}} value={schoolId} onChange={setSchoolId} options={schoolUnits.map(u=>({value:u.id,label:`${u.code} — ${u.name}`}))}/></Space></Card>
  <Card><Space wrap>
   <div><Text type="secondary">Tanggal</Text><Input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}/></div>
   <div><Text type="secondary">Kelas</Text><Select style={{minWidth:220}} value={selectedClass} onChange={setSelectedClass} placeholder="Pilih kelas" options={classes.map(c=>({value:c.id,label:`${c.name} · ${c.academicYear}`}))}/></div>
   <Button type="primary" disabled={!selectedClass} loading={saving} onClick={()=>void createSession()}>Buat Sesi Absensi</Button><Button onClick={()=>void loadBase()}>Refresh</Button>
  </Space></Card>
  <Card title="Sesi Absensi" loading={loading}>{sessions.length===0?<Empty description="Belum ada sesi pada tanggal ini"/>:<Space wrap>{sessions.map(s=><Button key={s.id} type={sessionId===s.id?"primary":"default"} onClick={()=>void openSession(s.id)}>{s.className} · {s.status}</Button>)}</Space>}</Card>
  {sessionId&&<Card title="Daftar Kehadiran" extra={<Space><Tag color={sessionStatus==="draft"?"processing":"success"}>{sessionStatus.toUpperCase()}</Tag>{sessionStatus==="draft"&&<><Button loading={saving} onClick={()=>void saveRecords()}>Simpan</Button><Button type="primary" loading={saving} onClick={()=>void submitSession()}>Kirim Absensi</Button></>}</Space>}><Table rowKey="id" columns={columns} dataSource={records} pagination={{pageSize:20}} scroll={{x:600}} locale={{emptyText:"Tidak ada siswa pada kelas ini."}}/></Card>}
 </Space>;
}
