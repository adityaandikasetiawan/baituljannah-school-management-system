import { useState } from "react";
import { Button, Card, Col, Layout, Menu, Row, Space, Statistic, Typography, message } from "antd";
import { AppstoreOutlined, BankOutlined, BookOutlined, LogoutOutlined, SafetyCertificateOutlined, TeamOutlined } from "@ant-design/icons";
import { api } from "./lib/api";
import { APP_VERSION } from "./version";
const { Header, Sider, Content, Footer } = Layout;
const { Title, Text } = Typography;
export default function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [apiStatus, setApiStatus] = useState<"unknown" | "online" | "offline">("unknown");
  async function checkApi() {
    try {
      const [health, meta] = await Promise.all([api.get("/health"), api.get("/api/v1/meta")]);
      setApiStatus("online");
      message.success(`API ${meta.data.apiVersion} aktif — aplikasi v${meta.data.version}`);
      return health;
    } catch {
      setApiStatus("offline");
      message.error("API belum dapat diakses. Pastikan server dan PostgreSQL berjalan.");
    }
  }
  return <Layout className="app-shell">
    <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} breakpoint="lg">
      <div className="brand"><div className="brand-mark">B</div>{!collapsed && <span>BAITULJANNAH</span>}</div>
      <Menu theme="dark" mode="inline" defaultSelectedKeys={["overview"]} items={[
        {key:"overview",icon:<AppstoreOutlined/>,label:"Dashboard"},
        {key:"units",icon:<BankOutlined/>,label:"School Units"},
        {key:"users",icon:<TeamOutlined/>,label:"Pengguna & Akses"},
        {key:"academic",icon:<BookOutlined/>,label:"Akademik"},
        {key:"security",icon:<SafetyCertificateOutlined/>,label:"Audit & Keamanan"}
      ]}/>
    </Sider>
    <Layout>
      <Header className="topbar">
        <Text strong>School Management System</Text>
        <Space><Text type="secondary">v{APP_VERSION}</Text><Button type="text" icon={<LogoutOutlined/>} disabled>Keluar</Button></Space>
      </Header>
      <Content className="page-content">
        <div className="page-heading">
          <div><Text type="secondary">BAITULJANNAH / OVERVIEW</Text><Title level={2}>Dashboard Foundation</Title><Text type="secondary">Pusat pengelolaan sekolah dalam satu platform terintegrasi.</Text></div>
          <Button type="primary" onClick={checkApi}>Periksa koneksi API</Button>
        </div>
        <Row gutter={[16,16]}>
          <Col xs={24} sm={12} xl={6}><Card><Statistic title="School Units" value="—"/></Card></Col>
          <Col xs={24} sm={12} xl={6}><Card><Statistic title="Pengguna Aktif" value="—"/></Card></Col>
          <Col xs={24} sm={12} xl={6}><Card><Statistic title="Status API" value={apiStatus==="online"?"Online":apiStatus==="offline"?"Offline":"Belum dicek"} valueStyle={{color:apiStatus==="online"?"#15803d":undefined,fontSize:20}}/></Card></Col>
          <Col xs={24} sm={12} xl={6}><Card><Statistic title="Database" value="PostgreSQL" valueStyle={{fontSize:20}}/></Card></Col>
        </Row>
        <Card className="welcome-card">
          <Title level={4}>Foundation berhasil disiapkan</Title>
          <Text type="secondary">Tahap ini menyiapkan struktur aplikasi, database, autentikasi, role & permission, serta fondasi multi-school. Modul operasional akan dibangun bertahap setelah fondasi diverifikasi.</Text>
          <div className="status-row"><span className="status-dot"/><Text>Workspace siap dikembangkan</Text></div>
        </Card>
      </Content>
      <Footer className="app-footer">Baituljannah SMIS · v{APP_VERSION} · API v1</Footer>
    </Layout>
  </Layout>;
}
