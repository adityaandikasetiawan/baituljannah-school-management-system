import {useEffect,useState} from "react";
import {Button,Card,Form,Input,Modal,Select,Space,Table,Tag,Typography,message} from "antd";
import type {TableColumnsType} from "antd";
import {api} from "../lib/api";
const {Text}=Typography;
type Unit={id:string;code:string;name:string};
type Teacher={id:string;userId:string;email:string;fullName:string;employeeNumber:string;jobTitle:string;specialization:string|null;hireDate:string|null;employmentStatus:"active"|"leave"|"inactive"};
type FormValues={email:string;employeeNumber:string;jobTitle:string;specialization?:string;hireDate?:string};
export function TeacherManagement({schoolUnits}:{schoolUnits:Unit[]}){
 const [schoolId,setSchoolId]=useState<string>();const [rows,setRows]=useState<Teacher[]>([]);const [loading,setLoading]=useState(false);const [saving,setSaving]=useState(false);const [open,setOpen]=useState(false);const [form]=Form.useForm<FormValues>();
 useEffect(()=>{if(!schoolId&&schoolUnits.length)setSchoolId(schoolUnits[0]!.id);},[schoolUnits,schoolId]);
 async function load(){if(!schoolId)return;setLoading(true);try{const r=await api.get("/api/v1/teachers",{headers:{"x-school-id":schoolId}});setRows(r.data.data as Teacher[]);}catch{message.error("Data guru gagal dimuat.");}finally{setLoading(false);}}
 useEffect(()=>{void load();},[schoolId]);
 async function create(values:FormValues){if(!schoolId)return;setSaving(true);try{await api.post("/api/v1/teachers",values,{headers:{"x-school-id":schoolId}});message.success("Profil guru berhasil dibuat.");setOpen(false);form.resetFields();await load();}catch(error:unknown){const r=(error as {response?:{data?:{error?:{message?:string}}}}).response;message.error(r?.data?.error?.message??"Profil guru gagal dibuat.");}finally{setSaving(false);}}
 async function changeStatus(row:Teacher,status:Teacher["employmentStatus"]){if(!schoolId)return;try{await api.patch(`/api/v1/teachers/${row.id}`,{employmentStatus:status},{headers:{"x-school-id":schoolId}});message.success("Status guru diperbarui.");await load();}catch{message.error("Status guru gagal diperbarui.");}}
 const columns:TableColumnsType<Teacher>=[
  {title:"Nama Guru",dataIndex:"fullName",key:"fullName",render:(v:string,row)=><><Text strong>{v}</Text><div><Text type="secondary">{row.email}</Text></div></>},
  {title:"NIP / Nomor Pegawai",dataIndex:"employeeNumber",key:"employeeNumber"},
  {title:"Jabatan",dataIndex:"jobTitle",key:"jobTitle"},
  {title:"Spesialisasi",dataIndex:"specialization",key:"specialization",render:(v:string|null)=>v||"-"},
  {title:"Status",dataIndex:"employmentStatus",key:"employmentStatus",render:(v:string)=><Tag color={v==="active"?"green":v==="leave"?"gold":"default"}>{v.toUpperCase()}</Tag>},
  {title:"Ubah Status",key:"action",render:(_v,row)=><Select size="small" value={row.employmentStatus} style={{width:140}} onChange={v=>void changeStatus(row,v)} options={[{value:"active",label:"Aktif"},{value:"leave",label:"Cuti"},{value:"inactive",label:"Tidak Aktif"}]}/>},
 ];
 return <Space direction="vertical" style={{width:"100%"}} size="middle">
  <Card><Space wrap style={{width:"100%",justifyContent:"space-between"}}><div><Text strong>Data Guru</Text><div><Text type="secondary">Profil kepegawaian guru per unit sekolah.</Text></div></div><Space><Select style={{minWidth:230}} value={schoolId} onChange={setSchoolId} options={schoolUnits.map(u=>({value:u.id,label:`${u.code} — ${u.name}`}))}/><Button type="primary" disabled={!schoolId} onClick={()=>setOpen(true)}>Tambah Profil Guru</Button></Space></Space></Card>
  <Card><Table rowKey="id" columns={columns} dataSource={rows} loading={loading} pagination={{pageSize:15}} scroll={{x:900}} locale={{emptyText:"Belum ada profil guru. Buat akun dengan role Teacher terlebih dahulu."}}/></Card>
  <Modal title="Tambah Profil Guru" open={open} onCancel={()=>setOpen(false)} onOk={()=>form.submit()} confirmLoading={saving} okText="Simpan" cancelText="Batal" destroyOnHidden>
   <Form form={form} layout="vertical" onFinish={create}>
    <Form.Item name="email" label="Email Akun Guru" rules={[{required:true,type:"email"}]}><Input placeholder="guru@baituljannah.sch.id"/></Form.Item>
    <Form.Item name="employeeNumber" label="NIP / Nomor Pegawai" rules={[{required:true,min:2}]}><Input/></Form.Item>
    <Form.Item name="jobTitle" label="Jabatan" initialValue="Guru"><Input/></Form.Item>
    <Form.Item name="specialization" label="Spesialisasi / Mata Pelajaran"><Input placeholder="Matematika, Bahasa Indonesia, dll."/></Form.Item>
    <Form.Item name="hireDate" label="Tanggal Bergabung"><Input type="date"/></Form.Item>
    <Text type="secondary">Akun guru harus sudah dibuat dan diberi role Teacher pada unit sekolah melalui menu Pengguna & Akses.</Text>
   </Form>
  </Modal>
 </Space>;
}
