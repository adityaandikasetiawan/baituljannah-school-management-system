import { useEffect, useState } from "react";
import {
  AppstoreOutlined, BankOutlined, BookOutlined, LogoutOutlined, EditOutlined, GlobalOutlined,
  SafetyCertificateOutlined, TeamOutlined, PlusOutlined
} from "@ant-design/icons";
import {
  Button, Card, Col, Form, Input, Layout, Menu, message, Modal,
  Row, Select, Space, Spin, Statistic, Table, Tag, Typography
} from "antd";
import type { TableColumnsType } from "antd";
import { api } from "./lib/api";
import { APP_VERSION } from "./version";
import { UserManagement } from "./components/UserManagement";
import { CmsManagement } from "./components/CmsManagement";
import { StudentManagement } from "./components/StudentManagement";
import { AcademicManagement } from "./components/AcademicManagement";
import { PublicSchoolSite } from "./components/PublicSchoolSite";

const { Header, Sider, Content, Footer } = Layout;
const { Title, Text } = Typography;

interface AuthUser { id: string; email: string; fullName: string }
interface SchoolUnit { id: string; code: string; name: string; level: string; status: "active" | "inactive" | "archived"; createdAt: string }
interface LoginInput { email: string; password: string }
interface CreateSchoolUnitInput { code: string; name: string; level: "TK" | "SD" | "SMP" | "SMA" | "SLB" }

function AdminApp() {
  const [collapsed, setCollapsed] = useState(false);
  const [activeMenu, setActiveMenu] = useState("overview");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [apiStatus, setApiStatus] = useState<"unknown" | "online" | "offline">("unknown");
  const [units, setUnits] = useState<SchoolUnit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<SchoolUnit | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [loginForm] = Form.useForm<LoginInput>();
  const [unitForm] = Form.useForm<CreateSchoolUnitInput>();

  useEffect(() => {
    const token = sessionStorage.getItem("bj_access_token");
    if (!token) { setCheckingSession(false); return; }
    api.get("/api/v1/auth/me")
      .then((response) => setUser(response.data as AuthUser))
      .catch(() => { sessionStorage.removeItem("bj_access_token"); })
      .finally(() => setCheckingSession(false));
  }, []);

  async function loadUnits() {
    setUnitsLoading(true);
    try {
      const response = await api.get("/api/v1/school-units/accessible");
      setUnits(response.data.data as SchoolUnit[]);
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } }).response?.status;
      message.error(status === 403 ? "Akun ini belum memiliki akses melihat school unit." : "Gagal mengambil data school unit.");
    } finally { setUnitsLoading(false); }
  }

  useEffect(() => {
    if (user) void loadUnits();
  }, [user, activeMenu]);

  async function login(values: LoginInput) {
    setLoginLoading(true);
    try {
      const response = await api.post("/api/v1/auth/login", values);
      sessionStorage.setItem("bj_access_token", response.data.accessToken as string);
      setUser(response.data.user as AuthUser);
      setActiveMenu("overview");
      message.success("Berhasil masuk ke Baituljannah SMIS.");
    } catch {
      message.error("Email atau password tidak sesuai, atau akun belum aktif.");
    } finally { setLoginLoading(false); }
  }

  function logout() {
    sessionStorage.removeItem("bj_access_token");
    setUser(null);
    setUnits([]);
    setActiveMenu("overview");
    message.success("Anda telah keluar.");
  }

  async function checkApi() {
    try {
      await api.get("/health");
      const meta = await api.get("/api/v1/meta");
      setApiStatus("online");
      message.success(`API ${meta.data.apiVersion} aktif — aplikasi v${meta.data.version}`);
    } catch {
      setApiStatus("offline");
      message.error("API belum dapat diakses. Pastikan server dan PostgreSQL berjalan.");
    }
  }

  async function createSchoolUnit(values: CreateSchoolUnitInput) {
    setCreateLoading(true);
    try {
      if (editingUnit) {
        await api.patch(`/api/v1/school-units/${editingUnit.id}`, values);
        message.success("School unit berhasil diperbarui.");
      } else {
        await api.post("/api/v1/school-units", values);
        message.success("School unit dan website draft berhasil dibuat.");
      }
      setCreateOpen(false);
      setEditingUnit(null);
      unitForm.resetFields();
      await loadUnits();
    } catch (error: unknown) {
      const response = (error as { response?: { status?: number; data?: { error?: { message?: string } } } }).response;
      message.error(response?.data?.error?.message ?? "School unit gagal dibuat. Periksa kode unit dan hak akses.");
    } finally { setCreateLoading(false); }
  }

  const columns: TableColumnsType<SchoolUnit> = [
    { title: "Kode", dataIndex: "code", key: "code", width: 120, render: (value: string) => <Text strong>{value}</Text> },
    { title: "Nama School Unit", dataIndex: "name", key: "name" },
    { title: "Jenjang", dataIndex: "level", key: "level", width: 120 },
    { title: "Status", dataIndex: "status", key: "status", width: 130, render: (value: SchoolUnit["status"]) => <Tag color={value === "active" ? "green" : value === "inactive" ? "default" : "red"}>{value.toUpperCase()}</Tag> },
    { title: "Aksi", key: "action", width: 190, render: (_value, row) => <Space>
      <Button size="small" icon={<EditOutlined/>} disabled={row.status === "archived"} onClick={() => { setEditingUnit(row); unitForm.setFieldsValue({ code: row.code, name: row.name, level: row.level as CreateSchoolUnitInput["level"] }); setCreateOpen(true); }}>Ubah</Button>
      <Button size="small" disabled={row.status === "archived"} onClick={async () => {
        const status = row.status === "active" ? "inactive" : "active";
        try { await api.patch(`/api/v1/school-units/${row.id}/status`, { status }); message.success("Status school unit diperbarui."); await loadUnits(); }
        catch { message.error("Status school unit gagal diperbarui."); }
      }}>{row.status === "active" ? "Nonaktifkan" : "Aktifkan"}</Button>
    </Space> },
  ];

  if (checkingSession) return <div className="loading-screen"><Spin size="large" tip="Memeriksa sesi..." /></div>;

  if (!user) return <div className="login-screen">
    <Card className="login-card" bordered={false}>
      <div className="login-brand"><div className="brand-mark">B</div><div><Text strong>BAITULJANNAH</Text><div><Text type="secondary">School Management System</Text></div></div></div>
      <Title level={3}>Masuk ke Dashboard</Title>
      <Text type="secondary">Gunakan akun yang telah dibuat oleh administrator yayasan.</Text>
      <Form form={loginForm} layout="vertical" onFinish={login} requiredMark={false} className="login-form">
        <Form.Item name="email" label="Email" rules={[{ required: true, type: "email", message: "Masukkan email yang valid." }]}>
          <Input size="large" autoComplete="username" placeholder="nama@baituljannah.sch.id" />
        </Form.Item>
        <Form.Item name="password" label="Password" rules={[{ required: true, message: "Password wajib diisi." }]}>
          <Input.Password size="large" autoComplete="current-password" placeholder="Masukkan password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" size="large" block loading={loginLoading}>Masuk</Button>
      </Form>
      <Text type="secondary" className="login-version">Versi aplikasi {APP_VERSION}</Text>
    </Card>
  </div>;

  return <Layout className="app-shell">
    <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} breakpoint="lg">
      <div className="brand"><div className="brand-mark">B</div>{!collapsed && <span>BAITULJANNAH</span>}</div>
      <Menu theme="dark" mode="inline" selectedKeys={[activeMenu]} onClick={({ key }) => setActiveMenu(key)} items={[
        {key:"overview",icon:<AppstoreOutlined/>,label:"Dashboard"},
        {key:"units",icon:<BankOutlined/>,label:"School Units"},
        {key:"users",icon:<TeamOutlined/>,label:"Pengguna & Akses"},
        {key:"website",icon:<GlobalOutlined/>,label:"Website Builder"},
        {key:"students",icon:<TeamOutlined/>,label:"Data Siswa"},
        {key:"academic",icon:<BookOutlined/>,label:"Akademik"},
        {key:"security",icon:<SafetyCertificateOutlined/>,label:"Audit & Keamanan",disabled:true}
      ]}/>
    </Sider>
    <Layout>
      <Header className="topbar">
        <Text strong>School Management System</Text>
        <Space><Text type="secondary">{user.fullName} · v{APP_VERSION}</Text><Button type="text" icon={<LogoutOutlined/>} onClick={logout}>Keluar</Button></Space>
      </Header>
      <Content className="page-content">
        {activeMenu === "overview" ? <>
          <div className="page-heading">
            <div><Text type="secondary">BAITULJANNAH / OVERVIEW</Text><Title level={2}>Dashboard Foundation</Title><Text type="secondary">Pusat pengelolaan sekolah dalam satu platform terintegrasi.</Text></div>
            <Button type="primary" onClick={checkApi}>Periksa koneksi API</Button>
          </div>
          <Row gutter={[16,16]}>
            <Col xs={24} sm={12} xl={6}><Card><Statistic title="School Units" value={units.length || "—"}/></Card></Col>
            <Col xs={24} sm={12} xl={6}><Card><Statistic title="Pengguna Aktif" value="—"/></Card></Col>
            <Col xs={24} sm={12} xl={6}><Card><Statistic title="Status API" value={apiStatus==="online"?"Online":apiStatus==="offline"?"Offline":"Belum dicek"} valueStyle={{color:apiStatus==="online"?"#15803d":undefined,fontSize:20}}/></Card></Col>
            <Col xs={24} sm={12} xl={6}><Card><Statistic title="Database" value="PostgreSQL" valueStyle={{fontSize:20}}/></Card></Col>
          </Row>
          <Card className="welcome-card">
            <Title level={4}>Selamat datang, {user.fullName}</Title>
            <Text type="secondary">Foundation Baituljannah sudah memiliki autentikasi, kontrol akses, dan manajemen awal school unit. Pilih menu School Units untuk mulai menambahkan unit sekolah.</Text>
          </Card>
        </> : activeMenu === "units" ? <div className="page-heading">
          <div><Text type="secondary">BAITULJANNAH / FOUNDATION</Text><Title level={2}>School Units</Title><Text type="secondary">Kelola unit sekolah yang berada di bawah Yayasan Baituljannah.</Text></div>
          <Button type="primary" icon={<PlusOutlined/>} onClick={() => { setEditingUnit(null); unitForm.resetFields(); setCreateOpen(true); }}>Tambah School Unit</Button>
        </div> : null}
        {activeMenu === "website" && <div className="page-heading"><div><Text type="secondary">BAITULJANNAH / WEBSITE</Text><Title level={2}>Website Builder</Title><Text type="secondary">Atur halaman, blok konten, pratinjau, dan publikasi website sekolah.</Text></div></div>}
        {activeMenu === "users" && <div className="page-heading">
          <div><Text type="secondary">BAITULJANNAH / FOUNDATION</Text><Title level={2}>Pengguna & Akses</Title><Text type="secondary">Kelola akun dan penempatan peran pengguna pada setiap unit sekolah.</Text></div>
        </div>}
        {activeMenu === "units" && <Card>
          <Table rowKey="id" columns={columns} dataSource={units} loading={unitsLoading} pagination={{ pageSize: 10, showSizeChanger: false }} locale={{ emptyText: "Belum ada school unit. Tambahkan unit pertama untuk memulai." }} scroll={{ x: 640 }} />
        </Card>}
        {activeMenu === "users" && <UserManagement schoolUnits={units} />}
        {activeMenu === "website" && <CmsManagement schoolUnits={units} />}
        {activeMenu === "students" && <div className="page-heading"><div><Text type="secondary">BAITULJANNAH / ACADEMIC</Text><Title level={2}>Data Siswa</Title><Text type="secondary">Kelola identitas dan pendaftaran siswa per unit sekolah.</Text></div></div>}
        {activeMenu === "students" && <StudentManagement schoolUnits={units} />}
        {activeMenu === "academic" && <div className="page-heading"><div><Text type="secondary">BAITULJANNAH / ACADEMIC</Text><Title level={2}>Manajemen Akademik</Title><Text type="secondary">Kelola tahun ajaran, kelas, dan mata pelajaran.</Text></div></div>}
        {activeMenu === "academic" && <AcademicManagement schoolUnits={units} />}
      </Content>
      <Footer className="app-footer">Baituljannah SMIS · v{APP_VERSION} · API v1</Footer>
    </Layout>
    <Modal title={editingUnit ? "Ubah School Unit" : "Tambah School Unit"} open={createOpen} onCancel={() => { setCreateOpen(false); setEditingUnit(null); unitForm.resetFields(); }} onOk={() => unitForm.submit()} confirmLoading={createLoading} okText="Buat School Unit" cancelText="Batal" destroyOnHidden>
      <Form form={unitForm} layout="vertical" onFinish={createSchoolUnit} requiredMark={false}>
        <Form.Item name="code" label="Kode Unit" rules={[{ required: true, min: 2, max: 32, pattern: /^[A-Z0-9_-]+$/, message: "Gunakan huruf kapital, angka, tanda - atau _." }]}>
          <Input placeholder="Contoh: IT-SD" maxLength={32}/>
        </Form.Item>
        <Form.Item name="name" label="Nama School Unit" rules={[{ required: true, min: 2, max: 180 }]}>
          <Input placeholder="Contoh: Islamic Technology School Baituljannah SD" maxLength={180}/>
        </Form.Item>
        <Form.Item name="level" label="Jenjang Pendidikan" rules={[{ required: true }]}>
          <Select placeholder="Pilih jenjang" options={[{value:"TK",label:"TK"},{value:"SD",label:"SD"},{value:"SMP",label:"SMP"},{value:"SMA",label:"SMA"},{value:"SLB",label:"SLB"}]}/>
        </Form.Item>
        <Text type="secondary">Website draft akan dibuat otomatis. Admin unit dan domain website dapat ditentukan setelah unit berhasil dibuat.</Text>
      </Form>
    </Modal>
  </Layout>;
}

export default function App() {
  const publicMatch = window.location.pathname.match(/^\/site\/([A-Za-z0-9_-]+)(?:\/([a-z0-9-]+))?\/?$/);
  if (publicMatch) return <PublicSchoolSite schoolCode={publicMatch[1] ?? ""} slug={publicMatch[2] ?? "beranda"} />;
  return <AdminApp />;
}
