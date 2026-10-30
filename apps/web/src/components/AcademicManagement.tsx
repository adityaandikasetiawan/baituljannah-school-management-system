import { useEffect, useState } from "react";
import { Button, Card, Form, Input, InputNumber, Modal, Select, Space, Table, Tabs, Tag, Typography, message } from "antd";
import type { TableColumnsType } from "antd";
import { api } from "../lib/api";
const {Text}=Typography;
type SchoolUnit={id:string;code:string;name:string};
type Year={id:string;label:string;startDate:string;endDate:string;status:string;isCurrent:boolean};
type ClassRow={id:string;code:string;name:string;gradeLabel:string;capacity:string;academicYearId:string;academicYear:string};
type Subject={id:string;code:string;name:string;gradeLevel:string|null;isActive:boolean};
export function AcademicManagement({schoolUnits}:{schoolUnits:SchoolUnit[]}){
  const [schoolId,setSchoolId]=useState<string>();
  const [years,setYears]=useState<Year[]>([]);
  const [classes,setClasses]=useState<ClassRow[]>([]);
  const [subjects,setSubjects]=useState<Subject[]>([]);
  const [loading,setLoading]=useState(false);
  const [yearOpen,setYearOpen]=useState(false);
  const [classOpen,setClassOpen]=useState(false);
  const [subjectOpen,setSubjectOpen]=useState(false);
  const [saving,setSaving]=useState(false);
  const [yearForm]=Form.useForm();
  const [classForm]=Form.useForm();
  const [subjectForm]=Form.useForm();
  useEffect(()=>{if(!schoolId&&schoolUnits.length)setSchoolId(schoolUnits[0]!.id);},[schoolUnits,schoolId]);
  async function load(){
    if(!schoolId)return;
    setLoading(true);
    try{
      const headers={headers:{"x-school-id":schoolId}};
      const [y,c,s]=await Promise.all([api.get("/api/v1/academic/years",headers),api.get("/api/v1/academic/classes",headers),api.get("/api/v1/academic/subjects",headers)]);
      setYears(y.data.data as Year[]);setClasses(c.data.data as ClassRow[]);setSubjects(s.data.data as Subject[]);
    }catch(error:unknown){
      const status=(error as {response?:{status?:number}}).response?.status;
      message.error(status===403?"Akun belum memiliki izin mengelola akademik.":"Konfigurasi akademik gagal dimuat.");
    }finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[schoolId]);
  async function submit(path:string,values:Record<string,unknown>,close:()=>void,form:{resetFields:()=>void}){
    if(!schoolId)return;
    setSaving(true);
    try{await api.post(path,values,{headers:{"x-school-id":schoolId}});message.success("Data akademik berhasil disimpan.");close();form.resetFields();await load();}
    catch(error:unknown){const response=(error as {response?:{data?:{error?:{message?:string}}}}).response;message.error(response?.data?.error?.message??"Data akademik gagal disimpan.");}
    finally{setSaving(false);}
  }
  const yearColumns:TableColumnsType<Year>=[
    {title:"Tahun Ajaran",dataIndex:"label",key:"label",render:(v:string,row)=><Text strong>{v}{row.isCurrent&&<Tag color="green" style={{marginLeft:8}}>Berjalan</Tag>}</Text>},
    {title:"Mulai",dataIndex:"startDate",key:"startDate"},{title:"Selesai",dataIndex:"endDate",key:"endDate"},
    {title:"Status",dataIndex:"status",key:"status",render:(v:string)=><Tag>{v.toUpperCase()}</Tag>},
  ];
  const classColumns:TableColumnsType<ClassRow>=[
    {title:"Kode",dataIndex:"code",key:"code"},{title:"Nama Kelas",dataIndex:"name",key:"name"},
    {title:"Jenjang",dataIndex:"gradeLabel",key:"gradeLabel"},{title:"Tahun Ajaran",dataIndex:"academicYear",key:"academicYear"},
    {title:"Kapasitas",dataIndex:"capacity",key:"capacity"},
  ];
  const subjectColumns:TableColumnsType<Subject>=[
    {title:"Kode",dataIndex:"code",key:"code"},{title:"Mata Pelajaran",dataIndex:"name",key:"name"},
    {title:"Jenjang",dataIndex:"gradeLevel",key:"gradeLevel",render:(v:string|null)=>v||"Semua"},
    {title:"Status",dataIndex:"isActive",key:"isActive",render:(v:boolean)=><Tag color={v?"green":"default"}>{v?"AKTIF":"NONAKTIF"}</Tag>},
  ];
  return <Space direction="vertical" style={{width:"100%"}} size="middle">
    <Card><Space wrap style={{width:"100%",justifyContent:"space-between"}}><div><Text strong>Konfigurasi Akademik</Text><div><Text type="secondary">Atur tahun ajaran, rombongan belajar, dan mata pelajaran.</Text></div></div><Select style={{minWidth:240}} value={schoolId} onChange={setSchoolId} options={schoolUnits.map(u=>({value:u.id,label:`${u.code} — ${u.name}`}))}/></Space></Card>
    <Tabs items={[
      {key:"years",label:"Tahun Ajaran",children:<Card loading={loading} title="Tahun Ajaran" extra={<Button type="primary" onClick={()=>setYearOpen(true)}>Tambah Tahun Ajaran</Button>}><Table rowKey="id" columns={yearColumns} dataSource={years} pagination={false} locale={{emptyText:"Belum ada tahun ajaran."}}/></Card>},
      {key:"classes",label:"Kelas / Rombel",children:<Card loading={loading} title="Kelas / Rombongan Belajar" extra={<Button type="primary" disabled={!years.length} onClick={()=>setClassOpen(true)}>Tambah Kelas</Button>}><Table rowKey="id" columns={classColumns} dataSource={classes} pagination={{pageSize:10}} locale={{emptyText:"Belum ada kelas."}}/></Card>},
      {key:"subjects",label:"Mata Pelajaran",children:<Card loading={loading} title="Mata Pelajaran" extra={<Button type="primary" onClick={()=>setSubjectOpen(true)}>Tambah Mata Pelajaran</Button>}><Table rowKey="id" columns={subjectColumns} dataSource={subjects} pagination={{pageSize:10}} locale={{emptyText:"Belum ada mata pelajaran."}}/></Card>},
    ]}/>
    <Modal title="Tambah Tahun Ajaran" open={yearOpen} onCancel={()=>setYearOpen(false)} onOk={()=>yearForm.submit()} confirmLoading={saving} okText="Simpan" cancelText="Batal" destroyOnHidden>
      <Form form={yearForm} layout="vertical" onFinish={v=>void submit("/api/v1/academic/years",v,()=>setYearOpen(false),yearForm)} initialValues={{status:"draft",isCurrent:false}}>
        <Form.Item name="label" label="Tahun Ajaran" rules={[{required:true,pattern:/^\d{4}\/\d{4}$/}]}><Input placeholder="2026/2027"/></Form.Item>
        <Form.Item name="startDate" label="Tanggal Mulai" rules={[{required:true}]}><Input type="date"/></Form.Item>
        <Form.Item name="endDate" label="Tanggal Selesai" rules={[{required:true}]}><Input type="date"/></Form.Item>
        <Form.Item name="status" label="Status"><Select options={[{value:"draft",label:"Draft"},{value:"active",label:"Aktif"},{value:"closed",label:"Ditutup"}]}/></Form.Item>
        <Form.Item name="isCurrent" label="Tahun Ajaran Berjalan"><Select options={[{value:false,label:"Tidak"},{value:true,label:"Ya"}]}/></Form.Item>
      </Form>
    </Modal>
    <Modal title="Tambah Kelas" open={classOpen} onCancel={()=>setClassOpen(false)} onOk={()=>classForm.submit()} confirmLoading={saving} okText="Simpan" cancelText="Batal" destroyOnHidden>
      <Form form={classForm} layout="vertical" onFinish={v=>void submit("/api/v1/academic/classes",v,()=>setClassOpen(false),classForm)} initialValues={{capacity:36}}>
        <Form.Item name="academicYearId" label="Tahun Ajaran" rules={[{required:true}]}><Select options={years.map(y=>({value:y.id,label:y.label}))}/></Form.Item>
        <Form.Item name="code" label="Kode Kelas" rules={[{required:true}]}><Input placeholder="5A"/></Form.Item>
        <Form.Item name="name" label="Nama Kelas" rules={[{required:true}]}><Input placeholder="Kelas 5A"/></Form.Item>
        <Form.Item name="gradeLabel" label="Jenjang / Tingkat" rules={[{required:true}]}><Input placeholder="Kelas 5"/></Form.Item>
        <Form.Item name="capacity" label="Kapasitas Maksimal"><InputNumber min={1} max={80} style={{width:"100%"}}/></Form.Item>
      </Form>
    </Modal>
    <Modal title="Tambah Mata Pelajaran" open={subjectOpen} onCancel={()=>setSubjectOpen(false)} onOk={()=>subjectForm.submit()} confirmLoading={saving} okText="Simpan" cancelText="Batal" destroyOnHidden>
      <Form form={subjectForm} layout="vertical" onFinish={v=>void submit("/api/v1/academic/subjects",v,()=>setSubjectOpen(false),subjectForm)}>
        <Form.Item name="code" label="Kode Mata Pelajaran" rules={[{required:true}]}><Input placeholder="MAT"/></Form.Item>
        <Form.Item name="name" label="Nama Mata Pelajaran" rules={[{required:true}]}><Input placeholder="Matematika"/></Form.Item>
        <Form.Item name="gradeLevel" label="Jenjang"><Input placeholder="SD"/></Form.Item>
        <Form.Item name="description" label="Deskripsi"><Input.TextArea rows={2}/></Form.Item>
      </Form>
    </Modal>
  </Space>;
}
