import { useEffect, useState } from "react";
import { Button, Card, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import type { TableColumnsType } from "antd";
import { api } from "../lib/api";

const { Text } = Typography;
interface SchoolUnit { id: string; code: string; name: string }
interface SchoolUser { id: string; email: string; fullName: string; status: "active" | "suspended" | "invited"; roles: { code: string; name: string }[] }
interface Role { code: string; name: string; description?: string | null }
interface CreateUser { email: string; fullName: string; password: string; roleCode: string }

export function UserManagement({ schoolUnits }: { schoolUnits: SchoolUnit[] }) {
  const [schoolId, setSchoolId] = useState<string>();
  const [users, setUsers] = useState<SchoolUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<CreateUser>();

  useEffect(() => {
    if (!schoolId && schoolUnits.length) setSchoolId(schoolUnits[0]!.id);
  }, [schoolUnits, schoolId]);

  async function load() {
    if (!schoolId) return;
    setLoading(true);
    const config = { headers: { "x-school-id": schoolId } };
    try {
      const [userResponse, roleResponse] = await Promise.all([
        api.get("/api/v1/users", config), api.get("/api/v1/users/roles", config),
      ]);
      setUsers(userResponse.data.data as SchoolUser[]);
      setRoles(roleResponse.data.data as Role[]);
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } }).response?.status;
      message.error(status === 403 ? "Akun tidak memiliki hak mengelola pengguna pada unit ini." : "Gagal mengambil data pengguna.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [schoolId]);

  async function create(values: CreateUser) {
    if (!schoolId) return;
    setSaving(true);
    try {
      await api.post("/api/v1/users", values, { headers: { "x-school-id": schoolId } });
      message.success("Pengguna berhasil dibuat dan ditambahkan ke unit sekolah.");
      setOpen(false);
      form.resetFields();
      await load();
    } catch (error: unknown) {
      const response = (error as { response?: { data?: { error?: { message?: string } } } }).response;
      message.error(response?.data?.error?.message ?? "Pengguna gagal dibuat.");
    } finally { setSaving(false); }
  }

  async function toggleStatus(user: SchoolUser) {
    if (!schoolId) return;
    const status = user.status === "active" ? "suspended" : "active";
    try {
      await api.patch(`/api/v1/users/${user.id}`, { status }, { headers: { "x-school-id": schoolId } });
      message.success(status === "active" ? "Akun diaktifkan." : "Akun dinonaktifkan sementara.");
      await load();
    } catch { message.error("Status akun gagal diperbarui."); }
  }

  const columns: TableColumnsType<SchoolUser> = [
    { title: "Nama", dataIndex: "fullName", key: "fullName", render: (value: string, row) => <><Text strong>{value}</Text><br/><Text type="secondary">{row.email}</Text></> },
    { title: "Peran", dataIndex: "roles", key: "roles", render: (value: SchoolUser["roles"]) => <Space wrap>{value.map((role) => <Tag key={role.code}>{role.name}</Tag>)}</Space> },
    { title: "Status", dataIndex: "status", key: "status", render: (value: SchoolUser["status"]) => <Tag color={value === "active" ? "green" : value === "suspended" ? "red" : "gold"}>{value.toUpperCase()}</Tag> },
    { title: "Aksi", key: "action", width: 130, render: (_value, row) => <Button size="small" disabled={row.status === "invited"} onClick={() => void toggleStatus(row)}>{row.status === "active" ? "Nonaktifkan" : "Aktifkan"}</Button> },
  ];

  return <Space direction="vertical" size="large" style={{ width: "100%" }}>
    <Card>
      <Space wrap style={{ width: "100%", justifyContent: "space-between" }}>
        <div><Text strong>Pengguna Sekolah</Text><div><Text type="secondary">Akun dan peran dibatasi pada unit sekolah yang dipilih.</Text></div></div>
        <Space wrap>
          <Select style={{ minWidth: 240 }} placeholder="Pilih school unit" value={schoolId} onChange={setSchoolId}
            options={schoolUnits.map((unit) => ({ value: unit.id, label: `${unit.code} — ${unit.name}` }))} />
          <Button type="primary" disabled={!schoolId} onClick={() => setOpen(true)}>Tambah Pengguna</Button>
        </Space>
      </Space>
    </Card>
    <Card><Table rowKey="id" columns={columns} dataSource={users} loading={loading} scroll={{ x: 700 }} pagination={{ pageSize: 10 }} locale={{ emptyText: "Belum ada pengguna pada unit ini." }} /></Card>
    <Modal title="Tambah Pengguna Sekolah" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} confirmLoading={saving} okText="Simpan Pengguna" cancelText="Batal" destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={create} requiredMark={false}>
        <Form.Item name="fullName" label="Nama Lengkap" rules={[{ required: true, min: 2, max: 180 }]}><Input maxLength={180} placeholder="Nama lengkap pengguna"/></Form.Item>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}><Input placeholder="nama@baituljannah.sch.id"/></Form.Item>
        <Form.Item name="roleCode" label="Peran" rules={[{ required: true }]}><Select placeholder="Pilih peran" options={roles.map((role) => ({ value: role.code, label: role.name }))}/></Form.Item>
        <Form.Item name="password" label="Password Awal" rules={[{ required: true, min: 12, message: "Password minimal 12 karakter." }]}><Input.Password autoComplete="new-password" placeholder="Minimal 12 karakter"/></Form.Item>
        <Text type="secondary">Akun dibuat aktif. Sampaikan password awal melalui kanal yang aman dan minta pengguna menggantinya setelah login. Alur undangan dan reset password akan menjadi tahap berikutnya.</Text>
      </Form>
    </Modal>
  </Space>;
}
