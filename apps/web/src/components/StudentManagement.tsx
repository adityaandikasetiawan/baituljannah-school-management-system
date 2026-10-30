import { useEffect, useState } from "react";
import { Button, Card, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import type { TableColumnsType } from "antd";
import { api } from "../lib/api";
const { Text } = Typography;
type SchoolUnit = { id:string; code:string; name:string };
type Student = { id:string; fullName:string; nisn:string|null; admissionNumber:string; academicYear:string; gradeLabel:string; classGroupId:string|null; enrollmentStatus:string; gender:string };
type ClassOption={id:string;name:string;gradeLabel:string;academicYear:string};
type StudentForm = { fullName:string; nisn?:string; gender:"male"|"female"; birthDate?:string; admissionNumber:string; academicYear:string; gradeLabel:string; guardianName?:string; guardianRelationship?:"father"|"mother"|"guardian"|"other"; guardianPhone?:string; guardianEmail?:string };
export function StudentManagement({schoolUnits}:{schoolUnits:SchoolUnit[]}) {
  const [schoolId,setSchoolId]=useState<string>();
  const [rows,setRows]=useState<Student[]>([]);
  const [classes,setClasses]=useState<ClassOption[]>([]);
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [open,setOpen]=useState(false);
  const [detailOpen,setDetailOpen]=useState(false);
  const [detail,setDetail]=useState<{student:Record<string,unknown>;enrollment:Record<string,unknown>;guardians:{id:string;fullName:string;relationship:string;phone:string;email:string|null;isPrimary:boolean}[]}|null>(null);
  const [query,setQuery]=useState("");
  const [form]=Form.useForm<StudentForm>();
  useEffect(()=>{if(!schoolId&&schoolUnits.length)setSchoolId(schoolUnits[0]!.id);},[schoolUnits,schoolId]);
  async function load(){
    if(!schoolId)return;
    setLoading(true);
    try{
      const response=await api.get("/api/v1/students",{headers:{"x-school-id":schoolId},params:{q:query||undefined,page:1,pageSize:100}});
      setRows(response.data.data as Student[]);
      try{const classResponse=await api.get("/api/v1/academic/classes",{headers:{"x-school-id":schoolId}});setClasses(classResponse.data.data as ClassOption[]);}catch{setClasses([]);}
    }catch{message.error("Data siswa gagal dimuat.");}
    finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[schoolId]);
  async function create(values:StudentForm){
    if(!schoolId)return;
    setSaving(true);
    try{
      await api.post("/api/v1/students",{...values,nisn:values.nisn||undefined,birthDate:values.birthDate||undefined,enrollmentStatus:"active",guardians:values.guardianName?[{fullName:values.guardianName,relationship:values.guardianRelationship??"guardian",phone:values.guardianPhone??"",email:values.guardianEmail??"",isPrimary:true,canPickup:true}]:[]},{headers:{"x-school-id":schoolId}});
      message.success("Data siswa berhasil ditambahkan.");
      setOpen(false);form.resetFields();await load();
    }catch(error:unknown){
      const response=(error as {response?:{data?:{error?:{message?:string}}}}).response;
      message.error(response?.data?.error?.message??"Data siswa gagal disimpan.");
    }finally{setSaving(false);}
  }
  async function showDetail(row:Student){
    if(!schoolId)return;
    try{const response=await api.get(`/api/v1/students/${row.id}`,{headers:{"x-school-id":schoolId}});setDetail(response.data.data as typeof detail);setDetailOpen(true);}
    catch{message.error("Detail siswa gagal dimuat.");}
  }
  const columns:TableColumnsType<Student>=[
    {title:"Nomor Induk",dataIndex:"admissionNumber",key:"admissionNumber"},
    {title:"Nama Siswa",dataIndex:"fullName",key:"fullName",render:(value:string,row)=><><Text strong>{value}</Text><div><Text type="secondary">NISN: {row.nisn||"Belum diisi"}</Text></div></>},
    {title:"Kelas",dataIndex:"gradeLabel",key:"gradeLabel",render:(value:string,row)=><Select size="small" style={{minWidth:150}} value={row.classGroupId??undefined} placeholder={value} allowClear options={classes.filter(c=>c.academicYear===row.academicYear).map(c=>({value:c.id,label:c.name}))} onChange={async next=>{if(!schoolId)return;try{await api.patch(`/api/v1/students/${row.id}/enrollment`,{classGroupId:next??null},{headers:{"x-school-id":schoolId}});message.success("Penempatan kelas diperbarui.");await load();}catch(error:unknown){const response=(error as {response?:{data?:{error?:{message?:string}}}}).response;message.error(response?.data?.error?.message??"Penempatan kelas gagal diperbarui.");}}}/>},
    {title:"Tahun Ajaran",dataIndex:"academicYear",key:"academicYear"},
    {title:"Jenis Kelamin",dataIndex:"gender",key:"gender",render:(value:string)=>value==="male"?"Laki-laki":"Perempuan"},
    {title:"Status",dataIndex:"enrollmentStatus",key:"enrollmentStatus",render:(value:string)=><Tag color={value==="active"?"green":"gold"}>{value.toUpperCase()}</Tag>},
    {title:"Detail",key:"detail",render:(_value,row)=><Button size="small" onClick={()=>void showDetail(row)}>Lihat</Button>},
    {title:"Ubah Status",key:"action",render:(_value,row)=><Select size="small" value={row.enrollmentStatus} style={{width:150}} onChange={async next=>{if(!schoolId)return;try{await api.patch(`/api/v1/students/${row.id}/enrollment`,{status:next},{headers:{"x-school-id":schoolId}});message.success("Status siswa diperbarui.");await load();}catch{message.error("Status siswa gagal diperbarui.");}}} options={[{value:"candidate",label:"Calon Siswa"},{value:"active",label:"Aktif"},{value:"graduated",label:"Lulus"},{value:"transferred",label:"Pindah"},{value:"withdrawn",label:"Mengundurkan Diri"}]}/>},
  ];
  return <Space direction="vertical" size="middle" style={{width:"100%"}}>
    <Card><Space wrap style={{width:"100%",justifyContent:"space-between"}}>
      <div><Text strong>Data Siswa</Text><div><Text type="secondary">Identitas dan pendaftaran siswa pada unit sekolah.</Text></div></div>
      <Space wrap><Select style={{minWidth:240}} value={schoolId} onChange={setSchoolId} options={schoolUnits.map(u=>({value:u.id,label:`${u.code} — ${u.name}`}))}/><Button type="primary" disabled={!schoolId} onClick={()=>setOpen(true)}>Tambah Siswa</Button></Space>
    </Space></Card>
    <Card><Space wrap style={{marginBottom:16}}><Input.Search style={{width:320}} placeholder="Cari nama, NISN, nomor induk" value={query} onChange={e=>setQuery(e.target.value)} onSearch={()=>void load()}/><Button onClick={()=>void load()}>Refresh</Button></Space>
      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} scroll={{x:850}} pagination={{pageSize:15}} locale={{emptyText:"Belum ada data siswa."}}/>
    </Card>
    <Modal title="Detail Siswa" open={detailOpen} onCancel={()=>setDetailOpen(false)} footer={<Button onClick={()=>setDetailOpen(false)}>Tutup</Button>}>
      {detail&&<Space direction="vertical" style={{width:"100%"}}>
        <Typography.Title level={5}>{String(detail.student.fullName??"")}</Typography.Title>
        <Text>NISN: {String(detail.student.nisn??"-")}</Text>
        <Text>Tempat / tanggal lahir: {String(detail.student.birthPlace??"-")} / {String(detail.student.birthDate??"-")}</Text>
        <Text>Alamat: {String(detail.student.address??"-")}</Text>
        <Typography.Title level={5}>Pendaftaran</Typography.Title>
        <Text>Nomor induk: {String(detail.enrollment.admissionNumber??"-")}</Text>
        <Text>Tahun ajaran: {String(detail.enrollment.academicYear??"-")}</Text>
        <Text>Kelas: {String(detail.enrollment.gradeLabel??"-")}</Text>
        <Text>Status: {String(detail.enrollment.status??"-")}</Text>
        <Typography.Title level={5}>Orang Tua / Wali</Typography.Title>
        {detail.guardians.length===0?<Text type="secondary">Belum ada data orang tua atau wali.</Text>:detail.guardians.map(guardian=><Card key={guardian.id} size="small"><Text strong>{guardian.fullName}</Text>{guardian.isPrimary&&<Tag color="green">Utama</Tag>}<div><Text type="secondary">{guardian.relationship} · {guardian.phone}</Text></div><Text type="secondary">{guardian.email??""}</Text></Card>)}
      </Space>}
    </Modal>
    <Modal title="Tambah Siswa" open={open} onCancel={()=>setOpen(false)} onOk={()=>form.submit()} confirmLoading={saving} okText="Simpan" cancelText="Batal" destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={create}>
        <Form.Item name="fullName" label="Nama Lengkap" rules={[{required:true,min:2}]}><Input/></Form.Item>
        <Form.Item name="nisn" label="NISN"><Input maxLength={10}/></Form.Item>
        <Form.Item name="gender" label="Jenis Kelamin" rules={[{required:true}]}><Select options={[{value:"male",label:"Laki-laki"},{value:"female",label:"Perempuan"}]}/></Form.Item>
        <Form.Item name="birthDate" label="Tanggal Lahir"><Input type="date"/></Form.Item>
        <Form.Item name="admissionNumber" label="Nomor Induk" rules={[{required:true}]}><Input/></Form.Item>
        <Form.Item name="academicYear" label="Tahun Ajaran" rules={[{required:true,pattern:/^\d{4}\/\d{4}$/}]}><Input placeholder="2026/2027"/></Form.Item>
        <Form.Item name="gradeLabel" label="Kelas" rules={[{required:true}]}><Input placeholder="Kelas 1"/></Form.Item>
        <Typography.Title level={5}>Orang Tua / Wali (Opsional)</Typography.Title>
        <Form.Item name="guardianName" label="Nama Orang Tua / Wali"><Input/></Form.Item>
        <Form.Item name="guardianRelationship" label="Hubungan"><Select options={[{value:"father",label:"Ayah"},{value:"mother",label:"Ibu"},{value:"guardian",label:"Wali"},{value:"other",label:"Lainnya"}]}/></Form.Item>
        <Form.Item name="guardianPhone" label="Nomor Telepon"><Input/></Form.Item>
        <Form.Item name="guardianEmail" label="Email"><Input/></Form.Item>
      </Form>
    </Modal>
  </Space>;
}
