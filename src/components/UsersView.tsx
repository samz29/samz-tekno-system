import React, { useMemo, useState } from 'react';
import { Plus, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import type { AuthUser, UserRole } from '../types';
import { ROLE_META } from '../lib/rbac';
import { formatDateTimeId } from '../lib/formatters';

interface UsersViewProps {
  users: AuthUser[];
  currentUser: AuthUser;
  onSaveUser: (
    payload: Partial<AuthUser> & { password?: string }
  ) => Promise<{ ok: boolean; message?: string }>;
  onDeleteUser: (user: AuthUser) => Promise<{ ok: boolean; message?: string }>;
}

const ROLES_ORDER: UserRole[] = ['admin', 'manager', 'hrd', 'user'];

export const UsersView: React.FC<UsersViewProps> = ({
  users,
  currentUser,
  onSaveUser,
  onDeleteUser,
}) => {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);

  // Modal Form State
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('Keuangan');
  const [role, setRole] = useState<UserRole>('user');
  const [password, setPassword] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openModalForUser = (target: AuthUser | null) => {
    setFormError(null);
    if (target) {
      setEditingUser(target);
      setName(target.name);
      setUsername(target.username);
      setEmail(target.email);
      setDepartment(target.department || 'Umum');
      setRole(target.role);
      setPassword('');
      setActive(target.active);
    } else {
      setEditingUser(null);
      setName('');
      setUsername('');
      setEmail('');
      setDepartment('Operasional');
      setRole('user');
      setPassword('');
      setActive(true);
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim() || !username.trim() || !email.trim()) {
      setFormError('Nama lengkap, username, dan email wajib diisi.');
      return;
    }
    if (!editingUser && password.trim().length < 6) {
      setFormError('Kata sandi minimal 6 karakter untuk akun baru.');
      return;
    }
    setSaving(true);
    try {
      const res = await onSaveUser({
        id: editingUser?.id,
        name: name.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        department: department.trim() || 'Umum',
        role,
        active,
        password: password.trim() || undefined,
      });
      if (!res.ok) {
        setFormError(res.message || 'Gagal menyimpan data pengguna.');
        return;
      }
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          u.name.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.department.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [users, roleFilter, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Manajemen Pengguna &amp; Hak Akses (RBAC)
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Atur akun login dan pembagian kewenangan untuk Admin, Manager, HRD, serta User / Staf.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openModalForUser(null)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tambah Pengguna</span>
        </button>
      </div>

      {/* Role Access Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {ROLES_ORDER.map((r) => {
          const meta = ROLE_META[r];
          const count = users.filter((u) => u.role === r && u.active).length;
          return (
            <div key={r} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-sm font-semibold ${meta.textClass}`}>{meta.label}</span>
                <span className="font-mono text-xs text-slate-500">{count} aktif</span>
              </div>
              <p className="text-xs text-slate-500">{meta.shortDesc}</p>
              <ul className="space-y-1 pt-1 border-t border-slate-100 text-[11px] text-slate-600">
                {meta.capabilities.map((cap) => (
                  <li key={cap} className="flex items-start gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>{cap}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 overflow-x-auto">
          {(
            [
              { id: 'all', label: 'Semua Peran' },
              { id: 'admin', label: 'Admin' },
              { id: 'manager', label: 'Manager' },
              { id: 'hrd', label: 'HRD' },
              { id: 'user', label: 'User / Staf' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setRoleFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                roleFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, username, email..."
            className="w-64 rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs focus:border-blue-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                <th className="py-3 px-4">Pengguna &amp; Username</th>
                <th className="py-3 px-4">Email &amp; Departemen</th>
                <th className="py-3 px-4">Hak Akses</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Login Terakhir</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-slate-500">
                    Tidak ada pengguna yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const roleMeta = ROLE_META[u.role];
                  const isSelf = u.id === currentUser.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900">
                          {u.name}{' '}
                          {isSelf && (
                            <span className="text-[11px] font-normal text-blue-700">(Anda)</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">@{u.username}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-xs text-slate-800">{u.email}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{u.department}</div>
                      </td>
                      <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                        <span className={`font-semibold ${roleMeta.textClass}`}>
                          {roleMeta.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                        <span
                          className={
                            u.active
                              ? 'font-medium text-emerald-700'
                              : 'font-medium text-slate-500'
                          }
                        >
                          {u.active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono text-slate-500 whitespace-nowrap">
                        {u.lastLoginAt ? formatDateTimeId(u.lastLoginAt) : 'Belum pernah'}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openModalForUser(u)}
                            className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Ubah
                          </button>
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => void onDeleteUser(u)}
                            className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-30"
                            title={
                              isSelf
                                ? 'Tidak dapat menghapus akun sendiri'
                                : 'Hapus Pengguna'
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit User Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl my-8">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingUser ? `Ubah Akun @${editingUser.username}` : 'Tambah Akun Pengguna Baru'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tentukan peran akses dan kredensial login perusahaan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Budi Santoso"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Username Login
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="budi.finance"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Email Perusahaan
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="budi@nusantarakarya.co.id"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Departemen
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Keuangan / HRD / Operasional"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Hak Akses (Role)
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  >
                    {ROLES_ORDER.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_META[r].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    {editingUser ? 'Kata Sandi Baru (Opsional)' : 'Kata Sandi Awal'}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      editingUser ? 'Kosongkan jika tidak diubah' : 'Minimal 6 karakter'
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 text-sm text-slate-700 pt-1">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                />
                <span>Akun aktif dan diizinkan masuk ke sistem</span>
              </label>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : editingUser ? 'Simpan Perubahan' : 'Buat Akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
