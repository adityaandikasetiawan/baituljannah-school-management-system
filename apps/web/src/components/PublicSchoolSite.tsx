import { useEffect, useState } from "react";
import { Alert, Button, Card, Empty, Spin, Typography } from "antd";
import { api } from "../lib/api";

const { Title, Paragraph, Text } = Typography;
type PublicBlock =
  | { id:string;type:"hero";title:string;subtitle:string;imageUrl?:string;buttonLabel?:string;buttonUrl?:string }
  | { id:string;type:"heading";text:string;level:"h2"|"h3" }
  | { id:string;type:"rich_text";text:string }
  | { id:string;type:"image";url:string;alt:string;caption?:string }
  | { id:string;type:"notice";title:string;text:string }
  | { id:string;type:"button";label:string;url:string };
interface PublicPage { pageId:string;title:string;slug:string;isHome:boolean;version:string;document:{schemaVersion:string;blocks:PublicBlock[]};schoolName:string;siteTitle:string;templateDefinition?:{theme?:{primaryColor?:string;surfaceColor?:string;textColor?:string}}|null }
interface PublicSite { schoolName:string;siteTitle:string;schoolCode:string;pages:{pageId:string;title:string;slug:string;isHome:boolean}[] }
export function PublicSchoolSite({schoolCode,slug}:{schoolCode:string;slug:string}) {
  const [site,setSite]=useState<PublicSite|null>(null);
  const [page,setPage]=useState<PublicPage|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string>();
  useEffect(()=>{
    let cancelled=false;
    async function load(){
      setLoading(true);setError(undefined);
      try{
        const siteResponse=await api.get(`/api/v1/public/schools/${encodeURIComponent(schoolCode)}`);
        const siteData=siteResponse.data.data as PublicSite;
        const pageResponse=await api.get(`/api/v1/public/schools/${encodeURIComponent(schoolCode)}/pages/${encodeURIComponent(slug)}`);
        if(!cancelled){setSite(siteData);setPage(pageResponse.data.data as PublicPage);}
      }catch{if(!cancelled)setError("Website atau halaman ini belum tersedia untuk publik.");}
      finally{if(!cancelled)setLoading(false);}
    }
    void load();return()=>{cancelled=true;};
  },[schoolCode,slug]);
  if(loading)return <div style={{minHeight:"100vh",display:"grid",placeItems:"center"}}><Spin size="large" tip="Memuat website sekolah..."/></div>;
  if(error||!site||!page)return <div style={{maxWidth:720,margin:"80px auto",padding:24}}><Alert type="info" showIcon message="Website belum tersedia" description={error??"Halaman belum dipublikasikan."}/></div>;
  const theme=page.templateDefinition?.theme;
  const primaryColor=theme?.primaryColor??"#166534";
  const surfaceColor=theme?.surfaceColor??"#f0fdf4";
  const textColor=theme?.textColor??"#14532d";
  const renderBlock=(block:PublicBlock)=>{
    if(block.type==="hero")return <section key={block.id} style={{background:surfaceColor,padding:"clamp(24px,5vw,56px)",borderRadius:16,marginBottom:24}}><Title style={{color:textColor}}>{block.title}</Title><Paragraph style={{fontSize:18}}>{block.subtitle}</Paragraph>{block.imageUrl&&<img src={block.imageUrl} alt="" style={{width:"100%",maxHeight:420,objectFit:"cover",borderRadius:12}}/>}{block.buttonLabel&&block.buttonUrl&&<Button type="primary" style={{background:primaryColor}} href={block.buttonUrl} target={block.buttonUrl.startsWith("http")?"_blank":undefined} rel="noreferrer">{block.buttonLabel}</Button>}</section>;
    if(block.type==="heading")return block.level==="h2"?<Title level={2} key={block.id}>{block.text}</Title>:<Title level={3} key={block.id}>{block.text}</Title>;
    if(block.type==="rich_text")return <Paragraph key={block.id} style={{whiteSpace:"pre-wrap",fontSize:16,lineHeight:1.8}}>{block.text}</Paragraph>;
    if(block.type==="image")return <figure key={block.id} style={{margin:"24px 0"}}><img src={block.url} alt={block.alt} style={{width:"100%",maxHeight:520,objectFit:"cover",borderRadius:12}}/>{block.caption&&<figcaption><Text type="secondary">{block.caption}</Text></figcaption>}</figure>;
    if(block.type==="notice")return <Alert key={block.id} type="info" showIcon message={block.title} description={block.text} style={{margin:"20px 0"}}/>;
    return <Button key={block.id} type="primary" style={{background:primaryColor}} href={block.url} target={block.url.startsWith("http")?"_blank":undefined} rel="noreferrer">{block.label}</Button>;
  };
  return <div style={{minHeight:"100vh",background:"#fff"}}>
    <header style={{borderBottom:"1px solid #e5e7eb",padding:"14px clamp(18px,5vw,72px)",display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap"}}>
      <div><Text strong style={{fontSize:18,color:primaryColor}}>{site.siteTitle||site.schoolName}</Text><div><Text type="secondary">{site.schoolName}</Text></div></div>
      <nav style={{display:"flex",gap:8,flexWrap:"wrap"}}>{site.pages.map(item=><Button key={item.pageId} type={item.slug===slug?"primary":"text"} href={`/site/${site.schoolCode}/${item.slug}`}>{item.title}</Button>)}</nav>
    </header>
    <main style={{maxWidth:1120,margin:"0 auto",padding:"clamp(18px,4vw,48px)"}}>
      {page.document.blocks.map(renderBlock)}
      {page.document.blocks.length===0&&<Empty description="Konten halaman belum tersedia"/>}
    </main>
    <footer style={{background:"#f8fafc",padding:24,textAlign:"center",color:"#64748b"}}>{site.schoolName} · Website resmi sekolah</footer>
  </div>;
}
