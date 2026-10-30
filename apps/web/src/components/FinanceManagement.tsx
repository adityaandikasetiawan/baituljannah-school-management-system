import {useEffect,useState} from "react";
import {Button,Card,Form,Input,InputNumber,Modal,Select,Space,Table,Tabs,Tag,Typography,message} from "antd";
import type {TableColumnsType} from "antd";
import {api} from "../lib/api";
const {Text}=Typography;
const rupiah=(value:number)=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(value);
type Unit={id:string;code:string;name:string};
type Enrollment={id:string;admissionNumber:string;studentName:string;academicYear:string;gradeLabel:string};
type Invoice={id:string;invoiceNumber:string;description:string;dueDate:string;amountTotal:number;amountPaid:number;status:string;studentName:string;admissionNumber:string;enrollmentId?:string};
type Payment={id:string;invoiceId:string;invoiceNumber:string;amount:number;method:string;referenceNumber:string|null;status:"pending"|"verified"|"rejected";studentName:string;admissionNumber:string};
type InvoiceForm={enrollmentId:string;invoiceNumber:string;description:string;period?:string;dueDate:string;amountTotal:number};
type PaymentForm={invoiceId:string;amount:number;method:"cash"|"bank_transfer"|"other";referenceNumber?:string;proofUrl?:string};
export function FinanceManagement({schoolUnits}:{schoolUnits:Unit[]}){
 const [schoolId,setSchoolId]=useState<string>();const [invoices,setInvoices]=useState<Invoice[]>([]);const [payments,setPayments]=useState<Payment[]>([]);const [enrollments,setEnrollments]=useState<Enrollment[]>([]);
 const [loading,setLoading]=useState(false);const [saving,setSaving]=useState(false);const [invoiceOpen,setInvoiceOpen]=useState(false);const [paymentOpen,setPaymentOpen]=useState(false);const [rejectId,setRejectId]=useState<string>();const [rejectReason,setRejectReason]=useState("");
 const [invoiceForm]=Form.useForm<InvoiceForm>();const [paymentForm]=Form.useForm<PaymentForm>();
 useEffect(()=>{if(!schoolId&&schoolUnits.length)setSchoolId(schoolUnits[0]!.id);},[schoolUnits,schoolId]);
 async function load(){if(!schoolId)return;setLoading(true);try{const headers={headers:{"x-school-id":schoolId}};const [i,p,e]=await Promise.all([api.get("/api/v1/finance/invoices",headers),api.get("/api/v1/finance/payments",headers),api.get("/api/v1/finance/enrollments",headers)]);setInvoices(i.data.data as Invoice[]);setPayments(p.data.data as Payment[]);setEnrollments(e.data.data as Enrollment[]);}catch(error:unknown){const status=(error as {response?:{status?:number}}).response?.status;message.error(status===403?"Akun belum memiliki izin mengelola keuangan.":"Data keuangan gagal dimuat.");}finally{setLoading(false);}}
 useEffect(()=>{void load();},[schoolId]);
 async function createInvoice(values:InvoiceForm){if(!schoolId)return;setSaving(true);try{await api.post("/api/v1/finance/invoices",values,{headers:{"x-school-id":schoolId}});message.success("Tagihan berhasil diterbitkan.");setInvoiceOpen(false);invoiceForm.resetFields();await load();}catch(error:unknown){const r=(error as {response?:{data?:{error?:{message?:string}}}}).response;message.error(r?.data?.error?.message??"Tagihan gagal dibuat.");}finally{setSaving(false);}}
 async function recordPayment(values:PaymentForm){if(!schoolId)return;setSaving(true);try{await api.post("/api/v1/finance/payments",values,{headers:{"x-school-id":schoolId}});message.success("Pembayaran dicatat dan menunggu verifikasi.");setPaymentOpen(false);paymentForm.resetFields();await load();}catch(error:unknown){const r=(error as {response?:{data?:{error?:{message?:string}}}}).response;message.error(r?.data?.error?.message??"Pembayaran gagal dicatat.");}finally{setSaving(false);}}
 async function verify(id:string){if(!schoolId)return;try{await api.post(`/api/v1/finance/payments/${id}/verify`,{},{headers:{"x-school-id":schoolId}});message.success("Pembayaran berhasil diverifikasi.");await load();}catch(error:unknown){const r=(error as {response?:{data?:{error?:{message?:string}}}}).response;message.error(r?.data?.error?.message??"Verifikasi pembayaran gagal.");}}
 async function reject(){if(!schoolId||!rejectId)return;try{await api.post(`/api/v1/finance/payments/${rejectId}/reject`,{reason:rejectReason},{headers:{"x-school-id":schoolId}});message.success("Pembayaran ditolak.");setRejectId(undefined);setRejectReason("");await load();}catch(error:unknown){const r=(error as {response?:{data?:{error?:{message?:string}}}}).response;message.error(r?.data?.error?.message??"Penolakan pembayaran gagal.");}}
 const invoiceColumns:TableColumnsType<Invoice>=[
  {title:"Nomor Tagihan",dataIndex:"invoiceNumber",key:"invoiceNumber",render:(v:string)=><Text strong>{v}</Text>},
  {title:"Siswa",dataIndex:"studentName",key:"studentName",render:(v:string,row)=><>{v}<div><Text type="secondary">{row.admissionNumber}</Text></div></>},
  {title:"Keterangan",dataIndex:"description",key:"description"},
  {title:"Jatuh Tempo",dataIndex:"dueDate",key:"dueDate"},
  {title:"Total",dataIndex:"amountTotal",key:"amountTotal",render:(v:number)=>rupiah(v)},
  {title:"Dibayar",dataIndex:"amountPaid",key:"amountPaid",render:(v:number)=>rupiah(v)},
  {title:"Status",dataIndex:"status",key:"status",render:(v:string)=><Tag color={v==="paid"?"green":v==="partially_paid"?"blue":v==="issued"?"gold":"default"}>{v.toUpperCase()}</Tag>},
 ];
 const paymentColumns:TableColumnsType<Payment>=[
  {title:"Siswa",dataIndex:"studentName",key:"studentName",render:(v:string,row)=><>{v}<div><Text type="secondary">{row.admissionNumber}</Text></div></>},
  {title:"Tagihan",dataIndex:"invoiceNumber",key:"invoiceNumber"},
  {title:"Nominal",dataIndex:"amount",key:"amount",render:(v:number)=>rupiah(v)},
  {title:"Metode",dataIndex:"method",key:"method",render:(v:string)=>v==="bank_transfer"?"Transfer Bank":v==="cash"?"Tunai":"Lainnya"},
  {title:"Status",dataIndex:"status",key:"status",render:(v:string)=><Tag color={v==="verified"?"green":v==="pending"?"gold":"red"}>{v.toUpperCase()}</Tag>},
  {title:"Aksi",key:"action",render:(_v,row)=>row.status==="pending"?<Space><Button size="small" type="primary" onClick={()=>void verify(row.id)}>Verifikasi</Button><Button size="small" danger onClick={()=>{setRejectId(row.id);setRejectReason("");}}>Tolak</Button></Space>:"-"},
 ];
 return <Space direction="vertical" style={{width:"100%"}} size="middle">
  <Card><Space wrap style={{width:"100%",justifyContent:"space-between"}}><div><Text strong>Keuangan Sekolah</Text><div><Text type="secondary">Tagihan siswa dan verifikasi pembayaran manual.</Text></div></div><Space><Select style={{minWidth:230}} value={schoolId} onChange={setSchoolId} options={schoolUnits.map(u=>({value:u.id,label:`${u.code} — ${u.name}`}))}/><Button onClick={()=>void load()}>Refresh</Button></Space></Space></Card>
  <Tabs items={[
   {key:"invoices",label:`Tagihan (${invoices.length})`,children:<Card loading={loading} title="Daftar Tagihan" extra={<Button type="primary" onClick={()=>setInvoiceOpen(true)} disabled={!enrollments.length}>Buat Tagihan</Button>}><Table rowKey="id" columns={invoiceColumns} dataSource={invoices} pagination={{pageSize:15}} scroll={{x:950}} locale={{emptyText:"Belum ada tagihan."}}/></Card>},
   {key:"payments",label:`Pembayaran (${payments.length})`,children:<Card loading={loading} title="Pembayaran Manual" extra={<Button type="primary" onClick={()=>setPaymentOpen(true)} disabled={!invoices.some(i=>i.status!=="paid"&&i.status!=="cancelled")}>Catat Pembayaran</Button>}><Table rowKey="id" columns={paymentColumns} dataSource={payments} pagination={{pageSize:15}} scroll={{x:850}} locale={{emptyText:"Belum ada pembayaran."}}/></Card>},
  ]}/>
  <Modal title="Buat Tagihan Siswa" open={invoiceOpen} onCancel={()=>setInvoiceOpen(false)} onOk={()=>invoiceForm.submit()} confirmLoading={saving} okText="Terbitkan Tagihan" cancelText="Batal" destroyOnHidden>
   <Form form={invoiceForm} layout="vertical" onFinish={createInvoice}>
    <Form.Item name="enrollmentId" label="Siswa" rules={[{required:true}]}><Select showSearch optionFilterProp="label" options={enrollments.map(e=>({value:e.id,label:`${e.studentName} · ${e.admissionNumber} · ${e.gradeLabel}`}))}/></Form.Item>
    <Form.Item name="invoiceNumber" label="Nomor Tagihan" rules={[{required:true}]}><Input placeholder="INV-SD-2026-0001"/></Form.Item>
    <Form.Item name="description" label="Keterangan" rules={[{required:true}]}><Input placeholder="SPP Bulan Januari"/></Form.Item>
    <Form.Item name="period" label="Periode"><Input placeholder="Januari 2027"/></Form.Item>
    <Form.Item name="dueDate" label="Jatuh Tempo" rules={[{required:true}]}><Input type="date"/></Form.Item>
    <Form.Item name="amountTotal" label="Nominal (Rupiah)" rules={[{required:true}]}><InputNumber min={1} max={1000000000} style={{width:"100%"}}/></Form.Item>
   </Form>
  </Modal>
  <Modal title="Catat Pembayaran" open={paymentOpen} onCancel={()=>setPaymentOpen(false)} onOk={()=>paymentForm.submit()} confirmLoading={saving} okText="Catat Pembayaran" cancelText="Batal" destroyOnHidden>
   <Form form={paymentForm} layout="vertical" onFinish={recordPayment}>
    <Form.Item name="invoiceId" label="Tagihan" rules={[{required:true}]}><Select showSearch optionFilterProp="label" options={invoices.filter(i=>i.status!=="paid"&&i.status!=="cancelled").map(i=>({value:i.id,label:`${i.invoiceNumber} · ${i.studentName} · Sisa ${rupiah(i.amountTotal-i.amountPaid)}`}))}/></Form.Item>
    <Form.Item name="amount" label="Nominal Pembayaran (Rupiah)" rules={[{required:true}]}><InputNumber min={1} max={1000000000} style={{width:"100%"}}/></Form.Item>
    <Form.Item name="method" label="Metode Pembayaran" rules={[{required:true}]}><Select options={[{value:"bank_transfer",label:"Transfer Bank"},{value:"cash",label:"Tunai"},{value:"other",label:"Lainnya"}]}/></Form.Item>
    <Form.Item name="referenceNumber" label="Nomor Referensi"><Input/></Form.Item>
    <Form.Item name="proofUrl" label="URL Bukti Pembayaran"><Input placeholder="https://..."/></Form.Item>
   </Form>
  </Modal>
  <Modal title="Tolak Pembayaran" open={!!rejectId} onCancel={()=>setRejectId(undefined)} onOk={()=>void reject()} okText="Tolak Pembayaran" okButtonProps={{danger:true,disabled:rejectReason.trim().length<3}} cancelText="Batal">
   <Text>Masukkan alasan penolakan agar dapat ditindaklanjuti.</Text><Input.TextArea rows={3} value={rejectReason} onChange={e=>setRejectReason(e.target.value)} style={{marginTop:12}}/>
  </Modal>
 </Space>;
}
