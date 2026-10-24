import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield, Users, Activity, FileText, CheckCircle2, AlertTriangle,
  RefreshCw, Search, Filter, UserCheck, UserX, Stethoscope,
  Cpu, Server, HardDrive, Clock, ArrowUpRight, BarChart3,
  SlidersHorizontal, ShieldAlert, Award, ChevronRight, Zap
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import Container from '@/components/layout/Container';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import {
  fetchAdminOverviewStats,
  fetchAdminUsers,
  updateUserRole,
  toggleUserStatus,
  fetchAdminAuditLogs,
  checkSystemHealth
} from '@/services/adminService';

export default function AdminDashboardPage() {
  useDocumentTitle('Hospital Admin Console');
  const { profile } = useAuth();

  // Tab State: 'users' | 'analytics' | 'audits' | 'health'
  const [activeTab, setActiveTab] = useState('users');

  // Overview Stats
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Users Tab State
  const [users, setUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState(null);

  // Audits Tab State
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudits, setLoadingAudits] = useState(false);

  // System Health Tab State
  const [healthData, setHealthData] = useState(null);
  const [testingHealth, setTestingHealth] = useState(false);

  // Action message feedback
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', text: string }

  // ── Load Overview Stats ──
  const loadStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      const { data, error } = await fetchAdminOverviewStats();
      if (error) throw new Error(error);
      setStats(data);
    } catch (err) {
      console.error('[AdminDashboard] Error loading stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // ── Load Users ──
  const loadUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      const { users: fetchedUsers, total, error } = await fetchAdminUsers({
        search: userSearch.trim(),
        role: roleFilter,
        page: 1,
        limit: 100,
      });
      if (error) throw new Error(error);
      setUsers(fetchedUsers);
      setTotalUsers(total);
    } catch (err) {
      console.error('[AdminDashboard] Error loading users:', err);
    } finally {
      setLoadingUsers(false);
    }
  }, [userSearch, roleFilter]);

  // ── Load Audit Logs ──
  const loadAudits = useCallback(async () => {
    try {
      setLoadingAudits(true);
      const { logs, error } = await fetchAdminAuditLogs({ limit: 50 });
      if (error) throw new Error(error);
      setAuditLogs(logs);
    } catch (err) {
      console.error('[AdminDashboard] Error loading audits:', err);
    } finally {
      setLoadingAudits(false);
    }
  }, []);

  // ── Test System Health ──
  const runHealthCheck = useCallback(async () => {
    try {
      setTestingHealth(true);
      const res = await checkSystemHealth();
      setHealthData(res);
    } finally {
      setTestingHealth(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    runHealthCheck();
  }, [loadStats, runHealthCheck]);

  useEffect(() => {
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'audits') loadAudits();
    if (activeTab === 'health') runHealthCheck();
  }, [activeTab, loadUsers, loadAudits, runHealthCheck]);

  // ── Handlers for User Governance ──
  const handleRoleChange = async (userId, newRole) => {
    try {
      setUpdatingUserId(userId);
      setFeedback(null);
      const { error } = await updateUserRole({ userId, role: newRole });
      if (error) throw new Error(error);

      setFeedback({ type: 'success', text: `User role successfully updated to ${newRole}.` });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      loadStats();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to update role.' });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleStatusToggle = async (userId, currentStatus) => {
    const nextStatus = !currentStatus;
    try {
      setUpdatingUserId(userId);
      setFeedback(null);
      const { error } = await toggleUserStatus({ userId, status: nextStatus });
      if (error) throw new Error(error);

      setFeedback({
        type: 'success',
        text: `User account has been ${nextStatus ? 'activated' : 'suspended'}.`
      });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: nextStatus } : u));
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to toggle status.' });
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <Container size="xl" className="py-8 md:py-12">
      {/* ── Header ── */}
      <header className="mb-8 animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 via-primary to-info flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                  Hospital Administration
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Root Admin
                </span>
              </div>
              <p className="text-sm text-secondary mt-0.5">
                Staff role governance, clinical AI concordance oversight, and system health.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw className={`h-4 w-4 ${loadingStats ? 'animate-spin' : ''}`} />}
              onClick={() => {
                loadStats();
                if (activeTab === 'users') loadUsers();
                if (activeTab === 'audits') loadAudits();
                if (activeTab === 'health') runHealthCheck();
              }}
            >
              Refresh Data
            </Button>
            <Link to="/staff">
              <Button variant="secondary" size="sm" icon={<Stethoscope className="h-4 w-4" />}>
                Staff View
              </Button>
            </Link>
          </div>
        </div>

        {/* Global Feedback Alert */}
        {feedback && (
          <div className={`mt-4 p-3.5 rounded-xl border text-sm flex items-center justify-between animate-fade-in ${
            feedback.type === 'success' ? 'bg-success-bg border-success-light text-success' : 'bg-error-bg border-error-light text-error'
          }`}>
            <span>{feedback.text}</span>
            <button onClick={() => setFeedback(null)} className="text-xs font-bold underline cursor-pointer">Dismiss</button>
          </div>
        )}
      </header>

      {/* ── Key Performance Metrics Bar ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Total Registered Users"
          value={loadingStats ? '—' : stats?.total_users ?? 0}
          subtitle={`${stats?.total_staff ?? 0} medical staff & admins`}
          icon={<Users className="h-5 w-5 text-indigo-600" />}
          gradient="from-indigo-500/10 to-indigo-500/5 border-indigo-500/20"
        />
        <MetricCard
          title="Clinical Medical Staff"
          value={loadingStats ? '—' : stats?.total_staff ?? 0}
          subtitle="Doctors & Radiologists with access"
          icon={<Stethoscope className="h-5 w-5 text-primary" />}
          gradient="from-primary/10 to-primary/5 border-primary/20"
        />
        <MetricCard
          title="Total Hospital Scans"
          value={loadingStats ? '—' : stats?.total_scans ?? 0}
          subtitle={`${stats?.uncertain_scans ?? 0} flagged for clinical review`}
          icon={<Activity className="h-5 w-5 text-info" />}
          gradient="from-info/10 to-info/5 border-info/20"
        />
        <MetricCard
          title="AI Concordance Rate"
          value={loadingStats ? '—' : `${stats?.concordance_rate ?? 100}%`}
          subtitle={`${stats?.confirmed_reviews ?? 0} confirmed · ${stats?.overridden_reviews ?? 0} overridden`}
          icon={<Award className="h-5 w-5 text-success" />}
          gradient="from-success/10 to-success/5 border-success/20"
        />
      </div>

      {/* ── Admin Navigation Tabs ── */}
      <div className="flex items-center gap-2 border-b border-border mb-6 overflow-x-auto pb-1 animate-fade-in-up">
        <TabButton
          active={activeTab === 'users'}
          onClick={() => setActiveTab('users')}
          icon={<Users className="h-4 w-4" />}
          label="User & Staff Governance"
          count={totalUsers > 0 ? totalUsers : null}
        />
        <TabButton
          active={activeTab === 'analytics'}
          onClick={() => setActiveTab('analytics')}
          icon={<BarChart3 className="h-4 w-4" />}
          label="Clinical AI Performance"
        />
        <TabButton
          active={activeTab === 'audits'}
          onClick={() => setActiveTab('audits')}
          icon={<FileText className="h-4 w-4" />}
          label="Clinical Audit Log"
        />
        <TabButton
          active={activeTab === 'health'}
          onClick={() => setActiveTab('health')}
          icon={<Cpu className="h-4 w-4" />}
          label="System & AI Health"
          badge={healthData?.online ? 'Online' : 'Check'}
          badgeColor={healthData?.online ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}
        />
      </div>

      {/* ══════════════════════════════════════════════════════════
          TAB 1: USER & STAFF GOVERNANCE
          ══════════════════════════════════════════════════════════ */}
      {activeTab === 'users' && (
        <div className="space-y-4 animate-fade-in">
          {/* Controls Bar */}
          <div className="glass rounded-2xl p-4 border border-border/40 flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Search */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <input
                type="text"
                placeholder="Search user by name or email…"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-surface border border-border text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            {/* Role Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
              {[
                { id: 'all', label: 'All Accounts' },
                { id: 'medical_staff', label: 'Medical Staff' },
                { id: 'admin', label: 'Administrators' },
                { id: 'general', label: 'Patients / General' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setRoleFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    roleFilter === f.id
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-surface border border-border text-secondary hover:text-foreground hover:bg-surface-hover'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Users Table */}
          <div className="glass rounded-2xl border border-border/40 overflow-hidden shadow-sm">
            {loadingUsers ? (
              <div className="p-12 text-center">
                <Spinner size="lg" className="text-primary mx-auto mb-3" />
                <p className="text-secondary text-sm">Loading user roster…</p>
              </div>
            ) : users.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="h-10 w-10 text-muted mx-auto mb-3 opacity-50" />
                <h3 className="text-base font-semibold text-foreground">No users match your criteria</h3>
                <p className="text-xs text-muted mt-1">Try adjusting your search query or role filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface/80 border-b border-border/40 text-xs font-semibold text-muted uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">User</th>
                      <th className="py-3.5 px-4">Role</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Activity</th>
                      <th className="py-3.5 px-4">Joined</th>
                      <th className="py-3.5 px-4 text-right">Role Governance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {users.map(u => {
                      const isSelf = u.id === profile?.id;
                      const isUpdating = updatingUserId === u.id;

                      return (
                        <tr key={u.id} className="hover:bg-surface-hover/50 transition-colors">
                          {/* User info */}
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-indigo-500/20 flex items-center justify-center font-bold text-primary text-xs shrink-0">
                                {u.full_name ? u.full_name.charAt(0).toUpperCase() : u.email?.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-foreground truncate">
                                  {u.full_name || 'Unnamed Account'}
                                  {isSelf && <span className="ml-2 text-[10px] text-primary font-bold">(You)</span>}
                                </p>
                                <p className="text-xs text-muted truncate">{u.email}</p>
                              </div>
                            </div>
                          </td>

                          {/* Role Badge */}
                          <td className="py-4 px-4">
                            <RoleBadge role={u.role} />
                          </td>

                          {/* Status Pill */}
                          <td className="py-4 px-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              u.status !== false
                                ? 'bg-success/10 text-success border border-success/30'
                                : 'bg-error/10 text-error border border-error/30'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${u.status !== false ? 'bg-success' : 'bg-error'}`} />
                              {u.status !== false ? 'Active' : 'Suspended'}
                            </span>
                          </td>

                          {/* Activity Counts */}
                          <td className="py-4 px-4 text-xs text-secondary">
                            {u.role === 'medical_staff' ? (
                              <span>{u.patients_count ?? 0} assigned patients</span>
                            ) : (
                              <span>{u.scans_count ?? 0} saved screenings</span>
                            )}
                          </td>

                          {/* Date Joined */}
                          <td className="py-4 px-4 text-xs text-muted">
                            {new Date(u.created_at).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric'
                            })}
                          </td>

                          {/* Role Governance Actions */}
                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Role Select Dropdown */}
                              <select
                                value={u.role}
                                disabled={isUpdating}
                                onChange={e => handleRoleChange(u.id, e.target.value)}
                                className="px-2.5 py-1.5 rounded-lg bg-surface border border-border text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer disabled:opacity-50"
                              >
                                <option value="general">General User</option>
                                <option value="medical_staff">Medical Staff (Doctor)</option>
                                <option value="admin">Administrator</option>
                              </select>

                              {/* Status Toggle Button */}
                              {!isSelf && (
                                <button
                                  disabled={isUpdating}
                                  onClick={() => handleStatusToggle(u.id, u.status !== false)}
                                  className={`p-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                                    u.status !== false
                                      ? 'text-error hover:bg-error/10 border-error/30'
                                      : 'text-success hover:bg-success/10 border-success/30'
                                  }`}
                                  title={u.status !== false ? 'Suspend User' : 'Activate User'}
                                >
                                  {u.status !== false ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB 2: CLINICAL AI PERFORMANCE ANALYTICS
          ══════════════════════════════════════════════════════════ */}
      {activeTab === 'analytics' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Concordance Analysis Card */}
            <div className="glass rounded-2xl p-6 border border-border/40 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Award className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground">AI Concordance & Clinician Agreement</h3>
                </div>
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                  {stats?.concordance_rate ?? 100}% Agreement
                </span>
              </div>

              <p className="text-xs text-secondary leading-relaxed">
                Represents the proportion of automated AI screening classifications confirmed by licensed medical staff versus cases where the doctor overrode the diagnostic conclusion.
              </p>

              {/* Visual Progress Bar */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-success flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Doctor Confirmed ({stats?.confirmed_reviews ?? 0})
                  </span>
                  <span className="text-pneumonia flex items-center gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Doctor Overridden ({stats?.overridden_reviews ?? 0})
                  </span>
                </div>
                <div className="h-3 bg-surface-hover rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-success transition-all duration-700"
                    style={{ width: `${stats?.concordance_rate ?? 100}%` }}
                  />
                  <div
                    className="h-full bg-pneumonia transition-all duration-700"
                    style={{ width: `${100 - (stats?.concordance_rate ?? 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted text-right">
                  Based on {stats?.total_reviews ?? 0} formal clinical reviews submitted.
                </p>
              </div>
            </div>

            {/* Diagnostic Ratio Card */}
            <div className="glass rounded-2xl p-6 border border-border/40 space-y-4">
              <div className="flex items-center gap-2.5">
                <BarChart3 className="h-5 w-5 text-info" />
                <h3 className="text-base font-bold text-foreground">Hospital Pathology Ratio</h3>
              </div>

              <p className="text-xs text-secondary leading-relaxed">
                Distribution of chest X-ray findings across all pediatric screenings processed by DiagnoVision.
              </p>

              <div className="space-y-3 pt-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-foreground font-semibold">Normal / Clear Lung Fields</span>
                    <span className="text-muted font-medium">{stats?.normal_scans ?? 0}</span>
                  </div>
                  <div className="h-2.5 bg-surface-hover rounded-full overflow-hidden">
                    <div
                      className="h-full bg-success rounded-full"
                      style={{
                        width: stats?.total_scans > 0 ? `${(stats.normal_scans / stats.total_scans) * 100}%` : '0%'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-foreground font-semibold">Pneumonia Findings Detected</span>
                    <span className="text-muted font-medium">{stats?.pneumonia_scans ?? 0}</span>
                  </div>
                  <div className="h-2.5 bg-surface-hover rounded-full overflow-hidden">
                    <div
                      className="h-full bg-pneumonia rounded-full"
                      style={{
                        width: stats?.total_scans > 0 ? `${(stats.pneumonia_scans / stats.total_scans) * 100}%` : '0%'
                      }}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs text-secondary">
                  <span className="flex items-center gap-1.5 text-warning">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {stats?.uncertain_scans ?? 0} Uncertain / Low Confidence
                  </span>
                  <span>{stats?.total_patients ?? 0} Registered Patient Charts</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB 3: CLINICAL AUDIT LOG
          ══════════════════════════════════════════════════════════ */}
      {activeTab === 'audits' && (
        <div className="space-y-4 animate-fade-in">
          <div className="glass rounded-2xl border border-border/40 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border/40 flex items-center justify-between bg-surface/50">
              <div>
                <h3 className="text-sm font-bold text-foreground">Official Clinical Verdicts</h3>
                <p className="text-xs text-muted">Chronological trail of doctor confirmations, overrides, and rationale notes.</p>
              </div>
              <span className="text-xs text-muted font-medium">{auditLogs.length} recent reviews</span>
            </div>

            {loadingAudits ? (
              <div className="p-12 text-center">
                <Spinner size="lg" className="text-primary mx-auto mb-3" />
                <p className="text-secondary text-sm">Loading audit logs…</p>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="h-10 w-10 text-muted mx-auto mb-3 opacity-50" />
                <h3 className="text-base font-semibold text-foreground">No clinical reviews logged yet</h3>
                <p className="text-xs text-muted mt-1">When medical staff review and submit verdicts, they will be audited here.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {auditLogs.map(log => (
                  <div key={log.id} className="p-4 hover:bg-surface-hover/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          log.verdict === 'confirmed' ? 'bg-success/10 text-success border border-success/30' : 'bg-pneumonia/10 text-pneumonia border border-pneumonia/30'
                        }`}>
                          {log.verdict === 'confirmed' ? 'Confirmed' : `Overridden → ${log.override_class}`}
                        </span>
                        <span className="text-xs font-bold text-foreground">
                          Scan #{log.prediction_id}
                        </span>
                        <span className="text-xs text-muted">
                          · AI classified: <strong className="text-foreground">{log.predicted_class}</strong> ({log.confidence_score?.toFixed(1)}%)
                        </span>
                        <span className="text-xs text-muted">
                          · Patient: <strong className="text-foreground">{log.patient_name}</strong>
                        </span>
                      </div>

                      {log.clinical_notes && (
                        <p className="text-xs text-secondary bg-surface p-2 rounded-lg border border-border/40 font-mono mt-1">
                          "{log.clinical_notes}"
                        </p>
                      )}

                      <p className="text-[11px] text-muted flex items-center gap-2 pt-0.5">
                        <span>Reviewed by: <strong>{log.reviewer_name}</strong></span>
                        <span>·</span>
                        <Clock className="h-3 w-3 inline" />
                        <span>{new Date(log.created_at).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}</span>
                      </p>
                    </div>

                    <Link to={`/staff/scans/${log.prediction_id}`}>
                      <Button variant="outline" size="sm" icon={<ArrowUpRight className="h-3.5 w-3.5" />}>
                        View Scan
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          TAB 4: SYSTEM & AI INFRASTRUCTURE HEALTH
          ══════════════════════════════════════════════════════════ */}
      {activeTab === 'health' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* FastAPI Inference Server */}
            <div className="glass rounded-2xl p-6 border border-border/40 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    healthData?.online ? 'bg-success/15 text-success' : 'bg-error/15 text-error'
                  }`}>
                    <Server className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">FastAPI Inference API</h3>
                    <p className="text-xs text-muted">Render / Local Backend</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  healthData?.online ? 'bg-success/10 text-success border border-success/30' : 'bg-error/10 text-error border border-error/30'
                }`}>
                  {healthData?.online ? 'Online' : 'Unreachable'}
                </span>
              </div>

              <div className="space-y-2 text-xs text-secondary pt-2">
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span>Ping Latency:</span>
                  <span className="font-mono font-bold text-foreground">{healthData?.latencyMs ?? 0} ms</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span>Hardware Device:</span>
                  <span className="font-mono text-foreground uppercase">{healthData?.data?.device ?? 'CPU'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span>CUDA Acceleration:</span>
                  <span className="font-mono text-foreground">{healthData?.data?.cuda_available ? 'Available' : 'Disabled (CPU)'}</span>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full justify-center"
                isLoading={testingHealth}
                onClick={runHealthCheck}
                icon={<Zap className="h-4 w-4" />}
              >
                Ping Health Check
              </Button>
            </div>

            {/* AI Model Checkpoints */}
            <div className="glass rounded-2xl p-6 border border-border/40 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                  <Cpu className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Loaded PyTorch Models</h3>
                  <p className="text-xs text-muted">Dual-Stage Pipeline</p>
                </div>
              </div>

              <div className="space-y-3 pt-2 text-xs">
                <div className="p-3 rounded-xl bg-surface border border-border/40 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-foreground">1. Pneumonia Classifier</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      healthData?.data?.models?.pneumonia?.loaded ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'
                    }`}>
                      {healthData?.data?.models?.pneumonia?.loaded ? 'Loaded' : 'Offline'}
                    </span>
                  </div>
                  <p className="text-muted">Architecture: EfficientNet-B0 / best_model.pth</p>
                </div>

                <div className="p-3 rounded-xl bg-surface border border-border/40 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-foreground">2. Image Gatekeeper</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      healthData?.data?.models?.gatekeeper?.loaded ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'
                    }`}>
                      {healthData?.data?.models?.gatekeeper?.loaded ? 'Loaded' : 'Offline'}
                    </span>
                  </div>
                  <p className="text-muted">Architecture: MobileNetV3-Small / gatekeeper_best.pth</p>
                </div>
              </div>
            </div>

            {/* Supabase Storage & Database */}
            <div className="glass rounded-2xl p-6 border border-border/40 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-600 flex items-center justify-center">
                  <HardDrive className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Supabase Cloud Infrastructure</h3>
                  <p className="text-xs text-muted">Database & Private Storage</p>
                </div>
              </div>

              <div className="space-y-2 text-xs text-secondary pt-2">
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span>PostgreSQL Database:</span>
                  <span className="font-bold text-success">Healthy / Connected</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span>Row Level Security (RLS):</span>
                  <span className="font-bold text-success">Enforced</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span>Private Storage Bucket:</span>
                  <span className="font-mono font-bold text-foreground">xrays</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span>Consent Sharing RPC:</span>
                  <span className="font-mono text-success">Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Container>
  );
}

// ── Helpers ──

function MetricCard({ title, value, subtitle, icon, gradient }) {
  return (
    <div className={`glass rounded-2xl p-5 border bg-gradient-to-br ${gradient} hover-lift transition-all duration-300`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-secondary">{title}</span>
        <div className="p-2 rounded-xl bg-white/70 shadow-xs">{icon}</div>
      </div>
      <p className="text-3xl font-extrabold text-foreground tracking-tight">{value}</p>
      <p className="text-xs text-muted mt-1">{subtitle}</p>
    </div>
  );
}

function TabButton({ active, onClick, icon, label, count, badge, badgeColor }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-semibold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
        active
          ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
          : 'border-transparent text-secondary hover:text-foreground hover:bg-surface-hover/50'
      }`}
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && count !== null && (
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
          active ? 'bg-indigo-600 text-white' : 'bg-surface border border-border text-muted'
        }`}>
          {count}
        </span>
      )}
      {badge && (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeColor}`}>
          {badge}
        </span>
      )}
    </button>
  );
}

function RoleBadge({ role }) {
  switch (role) {
    case 'admin':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <Shield className="h-3 w-3" />
          Admin
        </span>
      );
    case 'medical_staff':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20">
          <Stethoscope className="h-3 w-3" />
          Medical Staff
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-surface text-secondary border border-border">
          <Users className="h-3 w-3" />
          General User
        </span>
      );
  }
}
