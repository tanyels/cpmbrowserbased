import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { browserAuthService } from '../services/browserAuthService';
import { UserPlus, Trash2, Edit3, Save, X, Users, Shield, User as UserIcon } from 'lucide-react';

function UserManagement() {
  const { user, isOwner } = useAuth();
  const [users, setUsers] = useState([]);
  const [seatInfo, setSeatInfo] = useState({ current: 0, max: 5 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Add member form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [adding, setAdding] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.key_id) return;
    try {
      const [userList, seats] = await Promise.all([
        browserAuthService.listUsers(user.key_id),
        browserAuthService.getSeatCount(user.key_id)
      ]);
      setUsers(userList);
      setSeatInfo(seats);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.key_id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    setError(null);

    if (!newUsername.trim() || !newPassword || !newDisplayName.trim()) {
      setError('All fields are required');
      return;
    }
    if (newPassword.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }

    setAdding(true);
    try {
      await browserAuthService.createMember(user.key_id, newUsername, newPassword, newDisplayName);
      setNewUsername('');
      setNewPassword('');
      setNewDisplayName('');
      setShowAddForm(false);
      showSuccess('Member added successfully');
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleEdit = (member) => {
    setEditingId(member.id);
    setEditDisplayName(member.display_name);
    setEditPassword('');
  };

  const handleSaveEdit = async (memberId) => {
    setError(null);
    const updates = {};
    if (editDisplayName.trim()) updates.display_name = editDisplayName;
    if (editPassword) {
      if (editPassword.length < 4) {
        setError('Password must be at least 4 characters');
        return;
      }
      updates.password = editPassword;
    }

    if (Object.keys(updates).length === 0) {
      setEditingId(null);
      return;
    }

    setSaving(true);
    try {
      await browserAuthService.updateMember(memberId, updates);
      setEditingId(null);
      showSuccess('Member updated successfully');
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (memberId, currentActive) => {
    setError(null);
    try {
      await browserAuthService.updateMember(memberId, { is_active: !currentActive });
      showSuccess(currentActive ? 'Member deactivated' : 'Member activated');
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (memberId) => {
    if (!window.confirm('Are you sure you want to delete this member? This cannot be undone.')) return;
    setError(null);
    try {
      await browserAuthService.deleteMember(memberId, user.key_id);
      showSuccess('Member deleted');
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!isOwner) {
    return (
      <div className="um-container">
        <div className="um-no-access">
          <Shield size={48} />
          <h3>Owner Access Required</h3>
          <p>Only the organization owner can manage team members.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="um-container">
        <div className="um-loading">Loading team members...</div>
      </div>
    );
  }

  return (
    <div className="um-container">
      <div className="um-header">
        <div className="um-header-left">
          <Users size={24} />
          <h2>Team Management</h2>
        </div>
        <div className="um-seat-info">
          <span className="um-seat-count">{seatInfo.current} / {seatInfo.max}</span>
          <span className="um-seat-label">seats used</span>
        </div>
      </div>

      {error && (
        <div className="um-error">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X size={16} /></button>
        </div>
      )}

      {successMsg && (
        <div className="um-success">
          <span>{successMsg}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="um-table-wrapper">
        <table className="um-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((member) => (
              <tr key={member.id} className={!member.is_active ? 'um-inactive-row' : ''}>
                <td>
                  {editingId === member.id ? (
                    <input
                      type="text"
                      value={editDisplayName}
                      onChange={(e) => setEditDisplayName(e.target.value)}
                      className="um-edit-input"
                    />
                  ) : (
                    <div className="um-user-name">
                      {member.role === 'owner' ? <Shield size={14} /> : <UserIcon size={14} />}
                      {member.display_name}
                    </div>
                  )}
                </td>
                <td><code>{member.username}</code></td>
                <td>
                  <span className={`um-badge ${member.role === 'owner' ? 'um-badge-owner' : 'um-badge-member'}`}>
                    {member.role}
                  </span>
                </td>
                <td>
                  <span className={`um-badge ${member.is_active ? 'um-badge-active' : 'um-badge-inactive'}`}>
                    {member.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="um-date">
                  {member.last_login_at
                    ? new Date(member.last_login_at).toLocaleDateString()
                    : 'Never'}
                </td>
                <td>
                  {member.role !== 'owner' && (
                    <div className="um-actions">
                      {editingId === member.id ? (
                        <>
                          <input
                            type="password"
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            placeholder="New password (optional)"
                            className="um-edit-input um-edit-password"
                          />
                          <button
                            className="um-btn um-btn-save"
                            onClick={() => handleSaveEdit(member.id)}
                            disabled={saving}
                            title="Save"
                          >
                            <Save size={14} />
                          </button>
                          <button
                            className="um-btn um-btn-cancel"
                            onClick={() => setEditingId(null)}
                            title="Cancel"
                          >
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="um-btn um-btn-edit"
                            onClick={() => handleEdit(member)}
                            title="Edit"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            className={`um-btn ${member.is_active ? 'um-btn-deactivate' : 'um-btn-activate'}`}
                            onClick={() => handleToggleActive(member.id, member.is_active)}
                            title={member.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {member.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            className="um-btn um-btn-delete"
                            onClick={() => handleDelete(member.id)}
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Member */}
      {!showAddForm ? (
        <button
          className="um-add-btn"
          onClick={() => setShowAddForm(true)}
          disabled={seatInfo.current >= seatInfo.max}
        >
          <UserPlus size={18} />
          {seatInfo.current >= seatInfo.max ? 'All seats used' : 'Add Member'}
        </button>
      ) : (
        <div className="um-add-form">
          <h3>Add New Member</h3>
          <form onSubmit={handleAddMember}>
            <div className="um-form-row">
              <div className="um-form-field">
                <label>Display Name</label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="Full name"
                  disabled={adding}
                />
              </div>
              <div className="um-form-field">
                <label>Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Username"
                  disabled={adding}
                />
              </div>
              <div className="um-form-field">
                <label>Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Password"
                  disabled={adding}
                />
              </div>
            </div>
            <div className="um-form-actions">
              <button type="submit" className="btn btn-primary" disabled={adding}>
                {adding ? 'Adding...' : 'Add Member'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => { setShowAddForm(false); setError(null); }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
