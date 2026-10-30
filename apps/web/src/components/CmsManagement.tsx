import { useEffect, useMemo, useState } from "react";
import { Button, Card, Form, Input, Modal, Select, Space, Tag, Typography, message, Empty, Divider, Tooltip } from "antd";
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, PlusOutlined, SaveOutlined, EyeOutlined, SendOutlined, RollbackOutlined } from "@ant-design/icons";
import { api } from "../lib/api";

const { Title, Text, Paragraph } = Typography;
type Block =
  | { id: string; type: "hero"; title: string; subtitle: string; imageUrl?: string; buttonLabel?: string; buttonUrl?: string }
  | { id: string; type: "heading"; text: string; level: "h2" | "h3" }
  | { id: string; type: "rich_text"; text: string }
  | { id: string; type: "image"; url: string; alt: string; caption?: string }
  | { id: string; type: "notice"; title: string; text: string }
  | { id: string; type: "button"; label: string; url: string };
interface Page { id: string; title: string; slug: string; isHome: boolean; isPublished: boolean; updatedAt: string }
interface SchoolUnit { id: string; code: string; name: string }
interface Version { id: string; version: string; createdAt: string; document: { schemaVersion: "1.0"; blocks: Block[] } }
interface SiteDomain { id:string;hostname:string;verifiedAt:string|null;isPrimary:boolean;verificationHost:string;verificationToken:string }
const blockLabels: Record<Block["type"], string> = { hero: "Banner utama", heading: "Judul bagian", rich_text: "Teks informasi", image: "Gambar", notice: "Pengumuman", button: "Tombol tautan" };
const newBlock = (type: Block["type"]): Block => {
  const id = `block-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  if (type === "hero") return { id, type, title: "Judul utama", subtitle: "Deskripsi singkat sekolah" };
  if (type === "heading") return { id, type, text: "Judul bagian", level: "h2" };
  if (type === "rich_text") return { id, type, text: "Tulis informasi sekolah di sini." };
  if (type === "image") return { id, type, url: "https://placehold.co/1200x600", alt: "Foto kegiatan sekolah" };
  if (type === "notice") return { id, type, title: "Pengumuman", text: "Informasi terbaru untuk orang tua dan siswa." };
  return { id, type, label: "Pelajari lebih lanjut", url: "/profil" };
};
export function CmsManagement({ schoolUnits }: { schoolUnits: SchoolUnit[] }) {
  const [schoolId, setSchoolId] = useState<string>();
  const [pages, setPages] = useState<Page[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string>();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [templates, setTemplates] = useState<{id:string;code:string;name:string}[]>([]);
  const [domains,setDomains]=useState<SiteDomain[]>([]);
  const [domainHostname,setDomainHostname]=useState("");
  const [domainSaving,setDomainSaving]=useState(false);
  const [templateId, setTemplateId] = useState<string>();
  const [templateSaving, setTemplateSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [blockType, setBlockType] = useState<Block["type"]>("rich_text");
  const [previewMode, setPreviewMode] = useState<"desktop"|"tablet"|"mobile">("desktop");
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [createForm] = Form.useForm<{title:string;slug:string;isHome:boolean}>();
  const headers = useMemo(() => ({ headers: { "x-school-id": schoolId ?? "" } }), [schoolId]);

  useEffect(() => { if (!schoolId && schoolUnits.length) setSchoolId(schoolUnits[0]!.id); }, [schoolUnits, schoolId]);
  async function loadSite() {
    if (!schoolId) return;
    setLoading(true);
    try {
      const [siteResponse, templateResponse, domainResponse] = await Promise.all([
        api.get("/api/v1/cms/site", headers), api.get("/api/v1/cms/templates", headers), api.get("/api/v1/cms/domains", headers),
      ]);
      const siteData = siteResponse.data.data as {site:{templateId:string|null};pages:Page[]};
      setPages(siteData.pages);
      setTemplateId(siteData.site.templateId ?? undefined);
      setTemplates(templateResponse.data.data as {id:string;code:string;name:string}[]);
      setDomains(domainResponse.data.data as SiteDomain[]);
      const nextId = selectedPageId && siteData.pages.some(p=>p.id===selectedPageId) ? selectedPageId : siteData.pages[0]?.id;
      setSelectedPageId(nextId);
    } catch (error: unknown) {
      const status=(error as {response?:{status?:number}}).response?.status;
      message.error(status===403 ? "Akun belum memiliki izin mengelola website pada unit ini." : "Data website gagal dimuat.");
    } finally { setLoading(false); }
  }
  useEffect(()=>{ void loadSite(); },[schoolId]);
  async function loadPage(pageId:string) {
    if (!schoolId) return;
    try {
      const response=await api.get(`/api/v1/cms/pages/${pageId}`,headers);
      const data=response.data.data as {version:Version|null;versions:Version[]};
      setVersions(data.versions);
      setBlocks(data.version?.document.blocks ?? []);
    } catch { message.error("Konten halaman gagal dimuat."); }
  }
  useEffect(()=>{ if(selectedPageId) void loadPage(selectedPageId); else setBlocks([]); },[selectedPageId,schoolId]);
  async function addDomain() {
    if(!schoolId || !domainHostname.trim()) return;
    setDomainSaving(true);
    try {
      await api.post("/api/v1/cms/domains",{hostname:domainHostname.trim()},headers);
      setDomainHostname("");
      message.success("Domain ditambahkan. Pasang TXT record untuk verifikasi.");
      await loadSite();
    } catch(error:unknown) {
      const response=(error as {response?:{data?:{error?:{message?:string}}}}).response;
      message.error(response?.data?.error?.message ?? "Domain gagal ditambahkan.");
    } finally { setDomainSaving(false); }
  }
  async function verifyDomain(domainId:string) {
    try {
      await api.post(`/api/v1/cms/domains/${domainId}/verify`,{},headers);
      message.success("Domain berhasil diverifikasi melalui DNS TXT.");
      await loadSite();
    } catch(error:unknown) {
      const response=(error as {response?:{data?:{error?:{message?:string}}}}).response;
      message.error(response?.data?.error?.message ?? "Verifikasi DNS belum berhasil.");
    }
  }
  async function setPrimaryDomain(domainId:string) {
    try {
      await api.patch(`/api/v1/cms/domains/${domainId}/primary`,{},headers);
      message.success("Domain utama diperbarui.");
      await loadSite();
    } catch(error:unknown) {
      const response=(error as {response?:{data?:{error?:{message?:string}}}}).response;
      message.error(response?.data?.error?.message ?? "Domain utama gagal diperbarui.");
    }
  }
  async function changeTemplate(nextTemplateId:string) {
    if (!schoolId) return;
    setTemplateSaving(true);
    try {
      await api.patch("/api/v1/cms/site/template",{templateId:nextTemplateId},headers);
      setTemplateId(nextTemplateId);
      message.success("Template website diperbarui. Konten halaman tidak diubah.");
    } catch { message.error("Template website gagal diperbarui."); }
    finally { setTemplateSaving(false); }
  }
  async function createPage(values:{title:string;slug:string;isHome:boolean}) {
    if(!schoolId) return;
    setCreating(true);
    try {
      const response=await api.post("/api/v1/cms/pages",values,headers);
      const created=response.data.data.page as Page;
      message.success("Halaman baru berhasil dibuat.");
      setCreateOpen(false); createForm.resetFields();
      await loadSite(); setSelectedPageId(created.id);
    } catch(error:unknown) {
      const response=(error as {response?:{data?:{error?:{message?:string}}}}).response;
      message.error(response?.data?.error?.message ?? "Halaman gagal dibuat.");
    } finally { setCreating(false); }
  }
  async function savePage() {
    if(!schoolId || !selectedPageId) return;
    setSaving(true);
    try {
      await api.put(`/api/v1/cms/pages/${selectedPageId}`,{document:{schemaVersion:"1.0",blocks}},headers);
      message.success("Draft tersimpan sebagai versi baru.");
      await loadPage(selectedPageId); await loadSite();
    } catch(error:unknown) {
      const response=(error as {response?:{data?:{error?:{message?:string}}}}).response;
      message.error(response?.data?.error?.message ?? "Draft gagal disimpan.");
    } finally { setSaving(false); }
  }
  async function publish() {
    if(!schoolId || !selectedPageId) return;
    try {
      await api.post(`/api/v1/cms/pages/${selectedPageId}/publish`,{},headers);
      message.success("Versi tersimpan berhasil dipublikasikan.");
      await loadSite(); await loadPage(selectedPageId);
    } catch(error:unknown) {
      const response=(error as {response?:{data?:{error?:{message?:string}}}}).response;
      message.error(response?.data?.error?.message ?? "Publikasi gagal. Pastikan draft sudah disimpan.");
    }
  }
  async function rollback(versionId:string) {
    if(!schoolId || !selectedPageId) return;
    try {
      await api.post(`/api/v1/cms/pages/${selectedPageId}/rollback/${versionId}`,{},headers);
      message.success("Versi lama berhasil dipulihkan ke website publik.");
      await loadSite(); await loadPage(selectedPageId);
    } catch { message.error("Rollback gagal dilakukan."); }
  }
  function updateBlock(index:number, patch:Record<string, string | undefined>) {
    setBlocks(current=>current.map((block,i)=>i===index?({...block,...patch} as Block):block));
  }
  function moveBlock(index:number,direction:-1|1) {
    setBlocks(current=>{const next=[...current];const target=index+direction;if(target<0||target>=next.length)return current;[next[index],next[target]]=[next[target]!,next[index]!];return next;});
  }
  function renderBlock(block:Block,index:number) {
    const field=(label:string,value:string,onChange:(v:string)=>void,placeholder?:string)=> <div style={{marginBottom:12}}><Text type="secondary">{label}</Text><Input value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)}/></div>;
    return <div key={block.id} draggable onDragStart={() => setDraggingIndex(index)} onDragOver={event => event.preventDefault()} onDrop={() => { if (draggingIndex !== null && draggingIndex !== index) { setBlocks(current => { const next=[...current]; const [moved]=next.splice(draggingIndex,1); if(moved) next.splice(index,0,moved); return next; }); } setDraggingIndex(null); }} onDragEnd={() => setDraggingIndex(null)} style={{cursor:"grab",opacity:draggingIndex===index?0.45:1}}><Card size="small" title={<Space><Tag>{index+1}</Tag>{blockLabels[block.type]}</Space>} extra={<Space>
      <Tooltip title="Naik"><Button size="small" icon={<ArrowUpOutlined/>} disabled={index===0} onClick={()=>moveBlock(index,-1)}/></Tooltip>
      <Tooltip title="Turun"><Button size="small" icon={<ArrowDownOutlined/>} disabled={index===blocks.length-1} onClick={()=>moveBlock(index,1)}/></Tooltip>
      <Tooltip title="Hapus"><Button danger size="small" icon={<DeleteOutlined/>} onClick={()=>setBlocks(current=>current.filter((_,i)=>i!==index))}/></Tooltip>
    </Space>}>
      {block.type==="hero" && <>{field("Judul",block.title,v=>updateBlock(index,{title:v}))}{field("Deskripsi",block.subtitle,v=>updateBlock(index,{subtitle:v}))}{field("URL gambar (opsional)",block.imageUrl??"",v=>updateBlock(index,{imageUrl:v||undefined}))}{field("Label tombol (opsional)",block.buttonLabel??"",v=>updateBlock(index,{buttonLabel:v||undefined}))}{field("URL tombol (opsional)",block.buttonUrl??"",v=>updateBlock(index,{buttonUrl:v||undefined}))}</>}
      {block.type==="heading" && <>{field("Teks judul",block.text,v=>updateBlock(index,{text:v}))}<Select style={{width:"100%"}} value={block.level} onChange={v=>updateBlock(index,{level:v})} options={[{value:"h2",label:"Heading 2"},{value:"h3",label:"Heading 3"}]}/></>}
      {block.type==="rich_text" && <Input.TextArea rows={5} value={block.text} onChange={e=>updateBlock(index,{text:e.target.value})}/>}
      {block.type==="image" && <>{field("URL gambar",block.url,v=>updateBlock(index,{url:v}))}{field("Teks alternatif",block.alt,v=>updateBlock(index,{alt:v}))}{field("Keterangan",block.caption??"",v=>updateBlock(index,{caption:v||undefined}))}</>}
      {block.type==="notice" && <>{field("Judul pengumuman",block.title,v=>updateBlock(index,{title:v}))}<Input.TextArea rows={3} value={block.text} onChange={e=>updateBlock(index,{text:e.target.value})}/></>}
      {block.type==="button" && <>{field("Label tombol",block.label,v=>updateBlock(index,{label:v}))}{field("URL tujuan",block.url,v=>updateBlock(index,{url:v}))}</>}
    </Card></div>;
  }
  const selected=pages.find(p=>p.id===selectedPageId);
  const previewWidth=previewMode==="desktop"?"100%":previewMode==="tablet"?760:375;
  return <Space direction="vertical" size="middle" style={{width:"100%"}}>
    <Card>
      <Space wrap style={{width:"100%",justifyContent:"space-between"}}>
        <div><Text strong>Website Builder</Text><div><Text type="secondary">Kelola halaman publik untuk masing-masing unit sekolah.</Text></div></div>
        <Select style={{minWidth:240}} value={schoolId} onChange={setSchoolId} options={schoolUnits.map(u=>({value:u.id,label:`${u.code} — ${u.name}`}))}/>
      </Space>
    </Card>
    <div style={{display:"grid",gridTemplateColumns:"minmax(210px,280px) minmax(0,1fr)",gap:16,alignItems:"start"}}>
      <Card title="Halaman Website" loading={loading} extra={<Button size="small" type="primary" icon={<PlusOutlined/>} onClick={()=>setCreateOpen(true)}>Tambah</Button>}>
        {pages.length===0?<Empty description="Belum ada halaman"/>:<Space direction="vertical" style={{width:"100%"}}>
          {pages.map(page=><Button key={page.id} block type={selectedPageId===page.id?"primary":"default"} onClick={()=>setSelectedPageId(page.id)} style={{height:"auto",textAlign:"left",padding:"10px 12px"}}>
            <div style={{whiteSpace:"normal"}}><Text strong style={{color:selectedPageId===page.id?"white":undefined}}>{page.title}</Text><div><Text style={{fontSize:11,color:selectedPageId===page.id?"#e5e7eb":"#888"}}>/{page.slug} · {page.isPublished?"Published":"Draft"}{page.isHome?" · Home":""}</Text></div></div>
          </Button>)}
        </Space>}
        <Divider/>
        <Text type="secondary">Template aktif</Text>
        <Select style={{width:"100%",marginTop:8}} value={templateId} loading={templateSaving} onChange={value=>{if(value) void changeTemplate(value);}} options={templates.map(t=>({value:t.id,label:t.name}))} placeholder="Pilih template"/>
        <Text type="secondary" style={{display:"block",fontSize:11,marginTop:8}}>Pergantian template tidak menimpa konten halaman yang sudah dibuat.</Text>
      </Card>
      <Space direction="vertical" size="middle" style={{width:"100%"}}>
        <Card loading={loading}>
          {!selected?<Empty description="Pilih atau buat halaman untuk mulai mengedit"/>:<>
            <Space wrap style={{width:"100%",justifyContent:"space-between"}}>
              <div><Title level={4} style={{margin:0}}>{selected.title}</Title><Text type="secondary">/{selected.slug} · {selected.isPublished?"Sudah dipublikasikan":"Belum dipublikasikan"}</Text></div>
              <Space wrap><Button icon={<SaveOutlined/>} loading={saving} onClick={()=>void savePage()}>Simpan Draft</Button><Button type="primary" icon={<SendOutlined/>} onClick={()=>void publish()}>Publikasikan</Button></Space>
            </Space>
            <Divider/>
            <Space wrap><Text strong>Susunan konten</Text><Select value={blockType} onChange={setBlockType} style={{width:170}} options={Object.entries(blockLabels).map(([value,label])=>({value,label}))}/><Button icon={<PlusOutlined/>} onClick={()=>setBlocks(current=>[...current,newBlock(blockType)])}>Tambah Blok</Button><Button icon={<EyeOutlined/>} onClick={()=>setPreviewMode(m=>m==="desktop"?"tablet":m==="tablet"?"mobile":"desktop")}>Preview: {previewMode}</Button></Space>
            <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(260px,40%)",gap:16,marginTop:16}}>
              <Space direction="vertical" style={{width:"100%"}}>{blocks.map(renderBlock)}{blocks.length===0&&<Empty description="Tambahkan blok konten"/>}</Space>
              <div style={{position:"sticky",top:16}}>
                <Text strong>Pratinjau halaman</Text>
                <div style={{marginTop:10,marginInline:"auto",width:previewWidth,maxWidth:"100%",border:"1px solid #d9d9d9",borderRadius:10,background:"#fff",padding:previewMode==="mobile"?12:20,boxShadow:"0 4px 18px rgba(0,0,0,.06)",minHeight:300}}>
                  <div style={{borderBottom:"1px solid #eee",paddingBottom:12,marginBottom:16,fontWeight:700,color:"#166534"}}>{schoolUnits.find(u=>u.id===schoolId)?.name}</div>
                  {blocks.map(block=><div key={block.id} style={{marginBottom:18}}>
                    {block.type==="hero"&&<div style={{background:"#f0fdf4",padding:18,borderRadius:8}}><Title level={3}>{block.title}</Title><Paragraph>{block.subtitle}</Paragraph>{block.imageUrl&&<img src={block.imageUrl} alt="" style={{width:"100%",maxHeight:140,objectFit:"cover"}}/>}{block.buttonLabel&&<Tag color="green">{block.buttonLabel}</Tag>}</div>}
                    {block.type==="heading"&&(block.level==="h2"?<Title level={4}>{block.text}</Title>:<Title level={5}>{block.text}</Title>)}
                    {block.type==="rich_text"&&<Paragraph style={{whiteSpace:"pre-wrap"}}>{block.text}</Paragraph>}
                    {block.type==="image"&&<img src={block.url} alt={block.alt} style={{width:"100%",maxHeight:160,objectFit:"cover",borderRadius:6}}/>}
                    {block.type==="notice"&&<div style={{background:"#fff7e6",padding:12,borderRadius:6}}><Text strong>{block.title}</Text><Paragraph style={{margin:0}}>{block.text}</Paragraph></div>}
                    {block.type==="button"&&<Tag color="green">{block.label}</Tag>}
                  </div>)}
                  {blocks.length===0&&<Empty description="Belum ada konten"/>}
                </div>
              </div>
            </div>
            <Divider/>
            <Text strong>Riwayat versi</Text>
            {versions.length===0?<Text type="secondary">Belum ada versi tersimpan.</Text>:versions.map(version=><div key={version.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #f0f0f0"}}>
              <div><Text strong>{version.version}</Text><div><Text type="secondary" style={{fontSize:11}}>{new Date(version.createdAt).toLocaleString("id-ID")}</Text></div></div>
              <Button size="small" icon={<RollbackOutlined/>} onClick={()=>void rollback(version.id)}>Pulihkan & Publikasikan</Button>
            </div>)}
          </>}
        </Card>
      </Space>
    </div>
    <Card title="Domain Website" extra={<Tag color="blue">{domains.length} domain</Tag>}>
      <Space wrap style={{width:"100%"}}>
        <Input style={{minWidth:260,maxWidth:420}} value={domainHostname} onChange={event=>setDomainHostname(event.target.value)} placeholder="contoh: sd.baituljannah.sch.id"/>
        <Button type="primary" loading={domainSaving} disabled={!domainHostname.trim()} onClick={()=>void addDomain()}>Tambahkan Domain</Button>
      </Space>
      <Text type="secondary" style={{display:"block",marginTop:8}}>Tambahkan domain tanpa https://. Sistem akan memberikan TXT record untuk membuktikan kepemilikan domain.</Text>
      <Divider/>
      {domains.length===0?<Empty description="Belum ada domain khusus"/>:domains.map(domain=><div key={domain.id} style={{padding:"12px 0",borderBottom:"1px solid #f0f0f0"}}>
        <Space wrap style={{width:"100%",justifyContent:"space-between"}}>
          <div><Text strong>{domain.hostname}</Text>{domain.isPrimary&&<Tag color="green" style={{marginLeft:8}}>Utama</Tag>}<div><Tag color={domain.verifiedAt?"success":"warning"}>{domain.verifiedAt?"Terverifikasi":"Menunggu verifikasi"}</Tag></div></div>
          <Space wrap>
            {!domain.verifiedAt&&<Button size="small" onClick={()=>void verifyDomain(domain.id)}>Verifikasi DNS</Button>}
            {domain.verifiedAt&&!domain.isPrimary&&<Button size="small" type="primary" onClick={()=>void setPrimaryDomain(domain.id)}>Jadikan Utama</Button>}
          </Space>
        </Space>
        {!domain.verifiedAt&&<div style={{marginTop:8,background:"#fafafa",padding:10,borderRadius:6}}>
          <Text type="secondary">TXT Host</Text><div><Text code>{domain.verificationHost}</Text></div>
          <Text type="secondary">TXT Value</Text><div><Text code>{domain.verificationToken}</Text></div>
        </div>}
      </div>)}
      <Text type="secondary" style={{display:"block",marginTop:12,fontSize:12}}>Verifikasi DNS belum otomatis memasang SSL. Pengaturan DNS tujuan dan sertifikat HTTPS perlu diselesaikan pada infrastruktur hosting.</Text>
    </Card>
    <Modal title="Buat Halaman Website" open={createOpen} onCancel={()=>setCreateOpen(false)} onOk={()=>createForm.submit()} confirmLoading={creating} okText="Buat Halaman" cancelText="Batal" destroyOnHidden>
      <Form form={createForm} layout="vertical" onFinish={createPage} initialValues={{isHome:false}}>
        <Form.Item name="title" label="Nama Halaman" rules={[{required:true,min:2}]}><Input placeholder="Contoh: Profil Sekolah"/></Form.Item>
        <Form.Item name="slug" label="Slug URL" rules={[{required:true,pattern:/^[a-z0-9]+(?:-[a-z0-9]+)*$/,message:"Gunakan huruf kecil, angka, dan tanda hubung."}]}><Input placeholder="profil-sekolah"/></Form.Item>
        <Form.Item name="isHome" label="Jenis Halaman"><Select options={[{value:false,label:"Halaman biasa"},{value:true,label:"Jadikan halaman utama"}]}/></Form.Item>
      </Form>
    </Modal>
  </Space>;
}
