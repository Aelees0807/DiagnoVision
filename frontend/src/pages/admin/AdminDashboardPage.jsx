import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield, Users, Activity, FileText, CheckCircle2, AlertTriangle,
  RefreshCw, Search, Filter, UserCheck, UserX, Stethoscope,
  Cpu, Server, HardDrive, Clock, ArrowUpRight, BarChart3,
  SlidersHorizontal, ShieldAlert, Award, ChevronRight, Zap,
  Eye, Calendar, ChevronLeft, Inbox, User, X, Upload,
  ChevronDown, Check, Tag, Hash, Layers
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import Container from '@/components/layout/Container';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { supabase } from '@/lib/supabase';
import {
  fetchAdminOverviewStats,
  fetchAdminUsers,
  updateUserRole,
  toggleUserStatus,
  fetchAdminAuditLogs,
  checkSystemHealth,
  fetchAdminPredictions
} from '@/services/adminService';

// Professional Google / Lucide Vector Icons for Search Scope (No childish emojis)
const SEARCH_TARGET_OPTIONS = [
  { id: 'all', label: 'All Fields', icon: Layers },
  { id: 'patient_name', label: 'Patient Name', icon: User },
  { id: 'uploader', label: 'Uploaded By', icon: Upload },
  { id: 'patient_id', label: 'Hospital PID', icon: Tag },
  { id: 'scan_id', label: 'Scan ID', icon: Hash },
];

export default function AdminDashboardPage() {
  useDocumentTitle('Hospital Admin Console');
  const { profile, user } = useAuth();

  // Tab State: 'predictions' | 'users' | 'analytics' | 'audits' | 'health'
  const [activeTab, setActiveTab] = useState('predictions');

  // Overview Stats
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Predictions Tab State
  const [predictions, setPredictions] = useState([]);
  const [totalPredictions, setTotalPredictions] = useState(0);
  const [predictionPage, setPredictionPage] = useState(1);
  const [hasMorePredictions, setHasMorePredictions] = useState(false);
  const [loadingPredictions, setLoadingPredictions] = useState(false);
  const [predictionSearch, setPredictionSearch] = useState('');
  const [searchTarget, setSearchTarget] = useState('all');
  const [targetDropdownOpen, setTargetDropdownOpen] = useState(false);
  const targetDropdownRef = useRef(null);
  const [predictionClass, setPredictionClass] = useState('all');
  const [predictionStatus, setPredictionStatus] = useState('all');
  const [predictionUncertain, setPredictionUncertain] = useState('all');
  const [onlyMyUploads, setOnlyMyUploads] = useState(false);
  const [scanThumbnails, setScanThumbnails] = useState({});

  // Close search target dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (targetDropdownRef.current && !targetDropdownRef.current.contains(event.target)) {
        setTargetDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeTargetOption = SEARCH_TARGET_OPTIONS.find(opt => opt.id === searchTarget) || SEARCH_TARGET_OPTIONS[0];
  const ActiveTargetIcon = activeTargetOption.icon;
  const isAllActive = predictionClass === 'all' && predictionStatus === 'all' && predictionUncertain === 'all' && !onlyMyUploads;

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

  // ── Load Hospital Predictions ──
  const loadPredictions = useCallback(async () => {
    try {
      setLoadingPredictions(true);
      const { data, count, hasMore, error } = await fetchAdminPredictions({
        page: predictionPage,
        limit: 15,
        search: predictionSearch.trim(),
        searchTarget,
        classification: predictionClass,
        status: predictionStatus,
        uncertain: predictionUncertain,
        onlyMyUploads,
        currentUserId: user?.id,
      });
      if (error) throw new Error(error);
      setPredictions(data || []);
      setTotalPredictions(count || 0);
      setHasMorePredictions(hasMore);

      // Generate signed URLs for preview thumbnails
      const paths = (data || []).map(p => p.image_path).filter(Boolean);
      if (paths.length > 0) {
        try {
          const { data: urlData } = await supabase.storage.from('xrays').createSignedUrls(paths, 3600);
          if (urlData) {
            const map = {};
            urlData.forEach((u, i) => {
              if (u?.signedUrl) map[paths[i]] = u.signedUrl;
            });
            setScanThumbnails(prev => ({ ...prev, ...map }));
          }
        } catch {
          // Non-blocking thumbnail signing
        }
      }
    } catch (err) {
      console.error('[AdminDashboard] Error loading predictions:', err);
    } finally {
      setLoadingPredictions(false);
    }
  }, [predictionPage, predictionSearch, searchTarget, predictionClass, predictionStatus, predictionUncertain, onlyMyUploads, user?.id]);

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
    if (activeTab === 'predictions') loadPredictions();
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'audits') loadAudits();
    if (activeTab === 'health') runHealthCheck();
  }, [activeTab, loadPredictions, loadUsers, loadAudits, runHealthCheck]);

  // ── Handlers for User Governance ──
  const handleRoleChange = async (userId, newRole) => {
    if (newRole === 'admin') {
      setFeedback({ type: 'error', text: 'Security Violation: Cannot promote accounts to Administrator.' });
      return;
    }
    const target = users.find(u => u.id === userId);
    if (target?.role === 'admin') {
      setFeedback({ type: 'error', text: 'Security Violation: Administrator accounts are permanent and cannot be modified.' });
      return;
    }
    try {
      setUpdatingUserId(userId);
      setFeedback(null);
      const { error } = await updateUserRole({ userId, role: newRole });
      if (error) throw new Error(error);

      const label = newRole === 'medical_staff' ? 'Medical Staff (Doctor)' : 'General User';
      setFeedback({ type: 'success', text: `User role successfully updated to ${label}.` });
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
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-info flex items-center justify-center text-white shadow-lg shadow-primary/20">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                  Hospital Administration
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/25">
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
              icon={<RefreshCw className={`h-4 w-4 ${loadingStats || loadingPredictions ? 'animate-spin' : ''}`} />}
              onClick={() => {
                loadStats();
                if (activeTab === 'predictions') loadPredictions();
                if (activeTab === 'users') loadUsers();
                if (activeTab === 'audits') loadAudits();
                if (activeTab === 'health') runHealthCheck();
              }}
            >
              Refresh Data
            </Button>
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
          title="Total Hospital Scans"
          value={loadingStats ? '—' : stats?.total_scans ?? 0}
          subtitle={`${stats?.uncertain_scans ?? 0} flagged for clinical review`}
          icon={<Activity className="h-5 w-5 text-info" />}
          gradient="from-info/10 to-info/5 border-info/20 hover:border-info/40 cursor-pointer"
          onClick={() => setActiveTab('predictions')}
        />
        <MetricCard
          title="Total Registered Users"
          value={loadingStats ? '—' : stats?.total_users ?? 0}
          subtitle="Registered hospital accounts"
          icon={<Users className="h-5 w-5 text-primary" />}
          gradient="from-primary/10 to-primary/5 border-primary/20 hover:border-primary/40 cursor-pointer"
          onClick={() => setActiveTab('users')}
        />
        <MetricCard
          title="Clinical Medical Staff"
          value={loadingStats ? '—' : stats?.total_staff ?? 0}
          subtitle="Doctors & Radiologists with access"
          icon={<Stethoscope className="h-5 w-5 text-primary" />}
          gradient="from-primary/10 to-primary/5 border-primary/20 hover:border-primary/40 cursor-pointer"
          onClick={() => {
            setActiveTab('users');
            setRoleFilter('medical_staff');
          }}
        />
        <MetricCard
          title="AI Concordance Rate"
          value={loadingStats ? '—' : `${stats?.concordance_rate ?? 100}%`}
          subtitle={`${stats?.confirmed_reviews ?? 0} confirmed · ${stats?.overridden_reviews ?? 0} overridden`}
          icon={<Award className="h-5 w-5 text-success" />}
          gradient="from-success/10 to-success/5 border-success/20 hover:border-success/40 cursor-pointer"
          onClick={() => setActiveTab('analytics')}
        />
      </div>

      {/* ── Admin Navigation Tabs ── */}
      <div className="flex items-center gap-2 border-b border-border mb-6 overflow-x-auto pb-1 animate-fade-in-up">
        <TabButton
          active={activeTab === 'predictions'}
          onClick={() => setActiveTab('predictions')}
          icon={<Activity className="h-4 w-4" />}
          label="Hospital Predictions & Scans"
          count={stats?.total_scans ?? null}
        />
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
          TAB: HOSPITAL PREDICTIONS & SCANS
          ══════════════════════════════════════════════════════════ */}
      {activeTab === 'predictions' && (
        <div className="space-y-4 animate-fade-in">
          {/* Controls Bar (Executive Healthcare Studio Styling) */}
          <div className="glass rounded-2xl p-4 border border-border/40 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
            {/* Search Input with Custom Professional Scope Selector (Google/Lucide Icons) */}
            <div className="flex items-center gap-2 w-full xl:w-auto">
              {/* Professional Scope Dropdown Popover */}
              <div className="relative" ref={targetDropdownRef}>
                <button
                  type="button"
                  onClick={() => setTargetDropdownOpen(prev => !prev)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface border border-border text-xs font-semibold text-foreground hover:bg-surface-hover hover:border-primary/40 transition-all cursor-pointer shadow-xs shrink-0"
                  title="Select search field scope"
                >
                  <ActiveTargetIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="whitespace-nowrap hidden sm:inline">{activeTargetOption.label}</span>
                  <ChevronDown className={`h-3 w-3 text-muted transition-transform duration-200 ${targetDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {targetDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1.5 w-52 rounded-xl bg-surface/98 backdrop-blur-md border border-border shadow-xl py-1 z-50 animate-scale-in">
                    <div className="px-3 py-1 text-[10px] font-bold text-muted uppercase tracking-wider border-b border-border/50 mb-0.5">
                      Search Scope
                    </div>
                    {SEARCH_TARGET_OPTIONS.map(opt => {
                      const Icon = opt.icon;
                      const isSelected = searchTarget === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setSearchTarget(opt.id);
                            setTargetDropdownOpen(false);
                            setPredictionPage(1);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors cursor-pointer text-left ${
                            isSelected
                              ? 'bg-primary/10 text-primary font-bold'
                              : 'text-foreground hover:bg-surface-hover/80'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-primary' : 'text-secondary'}`} />
                            <span>{opt.label}</span>
                          </div>
                          {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Search Field */}
              <div className="relative flex-1 sm:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <input
                  type="text"
                  placeholder={
                    searchTarget === 'patient_name'
                      ? 'Search by patient name…'
                      : searchTarget === 'uploader'
                        ? 'Search by uploader name or email…'
                        : searchTarget === 'patient_id'
                          ? 'Search hospital PID (e.g. PID002)…'
                          : searchTarget === 'scan_id'
                            ? 'Search scan ID…'
                            : 'Search scans across all fields…'
                  }
                  value={predictionSearch}
                  onChange={e => {
                    setPredictionSearch(e.target.value);
                    setPredictionPage(1);
                  }}
                  className="w-full pl-10 pr-8 py-2 rounded-xl bg-surface border border-border text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                {predictionSearch && (
                  <button
                    onClick={() => {
                      setPredictionSearch('');
                      setPredictionPage(1);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground p-0.5 rounded-full cursor-pointer"
                    title="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Structured Semantic Filters (Clustered, Non-Mashy) */}
            <div className="flex items-center gap-2 overflow-x-auto w-full xl:w-auto pb-1 xl:pb-0">
              {/* 1. Master View */}
              <button
                type="button"
                onClick={() => {
                  setPredictionClass('all');
                  setPredictionStatus('all');
                  setPredictionUncertain('all');
                  setOnlyMyUploads(false);
                  setPredictionPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isAllActive
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-surface border border-border text-secondary hover:text-foreground hover:bg-surface-hover'
                }`}
                title="View all hospital scans"
              >
                All Scans
              </button>

              <div className="h-4 w-px bg-border/60 mx-0.5 hidden sm:block shrink-0" />

              {/* 2. Diagnostic Class Group (Same Class Things Grouped Together) */}
              <div className="flex items-center p-0.5 rounded-full bg-surface border border-border shadow-2xs gap-0.5" title="Filter by Diagnostic Class">
                <button
                  type="button"
                  onClick={() => {
                    setPredictionClass(prev => prev === 'PNEUMONIA' ? 'all' : 'PNEUMONIA');
                    setPredictionPage(1);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    predictionClass === 'PNEUMONIA'
                      ? 'bg-pneumonia text-white shadow-xs font-bold'
                      : 'text-secondary hover:text-pneumonia hover:bg-pneumonia/10'
                  }`}
                  title="Filter scans diagnosed as Pneumonia"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${predictionClass === 'PNEUMONIA' ? 'bg-white' : 'bg-pneumonia'}`} />
                  <span>PNEUMONIA</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPredictionClass(prev => prev === 'NORMAL' ? 'all' : 'NORMAL');
                    setPredictionPage(1);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    predictionClass === 'NORMAL'
                      ? 'bg-success text-white shadow-xs font-bold'
                      : 'text-secondary hover:text-success hover:bg-success/10'
                  }`}
                  title="Filter scans diagnosed as Normal"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${predictionClass === 'NORMAL' ? 'bg-white' : 'bg-success'}`} />
                  <span>NORMAL</span>
                </button>
              </div>

              <div className="h-4 w-px bg-border/60 mx-0.5 hidden sm:block shrink-0" />

              {/* 3. Review Workflow Status Group */}
              <div className="flex items-center p-0.5 rounded-full bg-surface border border-border shadow-2xs gap-0.5" title="Filter by Doctor Review Status">
                <button
                  type="button"
                  onClick={() => {
                    setPredictionStatus(prev => prev === 'pending' ? 'all' : 'pending');
                    setPredictionPage(1);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    predictionStatus === 'pending'
                      ? 'bg-primary text-white shadow-xs font-bold'
                      : 'text-secondary hover:text-foreground hover:bg-surface-hover'
                  }`}
                  title="Filter scans awaiting doctor review"
                >
                  <Clock className="h-3 w-3" />
                  <span>Pending</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPredictionStatus(prev => prev === 'reviewed' ? 'all' : 'reviewed');
                    setPredictionPage(1);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    predictionStatus === 'reviewed'
                      ? 'bg-primary text-white shadow-xs font-bold'
                      : 'text-secondary hover:text-foreground hover:bg-surface-hover'
                  }`}
                  title="Filter scans confirmed or overridden by doctors"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Reviewed</span>
                </button>
              </div>

              <div className="h-4 w-px bg-border/60 mx-0.5 hidden sm:block shrink-0" />

              {/* 4. Special Flag: Uncertain Only (Different Amber Warning Color with Live Beacon & Glow) */}
              <button
                type="button"
                onClick={() => {
                  setPredictionUncertain(prev => prev === 'yes' ? 'all' : 'yes');
                  setPredictionPage(1);
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  predictionUncertain === 'yes'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border border-amber-500 shadow-md shadow-amber-500/30 ring-2 ring-amber-400/40 font-bold scale-[1.02]'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/35 hover:bg-amber-500/20 hover:border-amber-500/60 shadow-2xs'
                }`}
                title="Filter scans flagged uncertain by AI gatekeeper"
              >
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${predictionUncertain === 'yes' ? 'bg-white opacity-75' : 'bg-amber-400 opacity-75'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${predictionUncertain === 'yes' ? 'bg-white' : 'bg-amber-500'}`}></span>
                </span>
                <AlertTriangle className={`h-3.5 w-3.5 ${predictionUncertain === 'yes' ? 'text-white' : 'text-amber-600 dark:text-amber-400'}`} />
                <span>Uncertain Only</span>
                {stats?.uncertain_scans > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                    predictionUncertain === 'yes' ? 'bg-white/25 text-white' : 'bg-amber-500/20 text-amber-800 dark:text-amber-200'
                  }`}>
                    {stats.uncertain_scans}
                  </span>
                )}
              </button>

              {/* 5. Special Flag: My Uploads */}
              <button
                type="button"
                onClick={() => {
                  setOnlyMyUploads(prev => !prev);
                  setPredictionPage(1);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  onlyMyUploads
                    ? 'bg-primary text-white shadow-sm font-bold'
                    : 'bg-surface border border-border text-secondary hover:text-foreground hover:bg-surface-hover'
                }`}
                title="Filter scans uploaded by your admin account"
              >
                <User className="h-3.5 w-3.5" />
                <span>My Uploads</span>
              </button>
            </div>
          </div>

          {/* Scans Table / List */}
          <div className="glass rounded-2xl border border-border/40 overflow-hidden shadow-sm">
            {loadingPredictions ? (
              <div className="py-20 flex flex-col items-center justify-center">
                <Spinner size="lg" className="text-primary mb-3" />
                <p className="text-sm text-secondary">Loading hospital predictions & clinical scans…</p>
              </div>
            ) : predictions.length === 0 ? (
              <div className="py-16 text-center">
                <Activity className="h-12 w-12 text-muted mx-auto mb-3" />
                <h4 className="text-base font-bold text-foreground">No hospital predictions found</h4>
                <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
                  {predictionSearch || !isAllActive
                    ? 'No predictions match the selected filters. Try clearing your search or switching filter categories.'
                    : 'Screening records will appear here as doctors and patients submit scans.'}
                </p>
                {(predictionSearch || !isAllActive) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-4"
                    onClick={() => {
                      setPredictionSearch('');
                      setSearchTarget('all');
                      setPredictionClass('all');
                      setPredictionStatus('all');
                      setPredictionUncertain('all');
                      setOnlyMyUploads(false);
                      setPredictionPage(1);
                    }}
                  >
                    Reset Filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {predictions.map(p => {
                  if (!p) return null;
                  const isPneu = p.predicted_class === 'PNEUMONIA';
                  const thumbUrl = p.image_path ? scanThumbnails[p.image_path] : null;
                  const hasReview = Array.isArray(p.staff_reviews) && p.staff_reviews.length > 0;
                  const latestReview = hasReview ? p.staff_reviews[0] : null;

                  const rawId = p.id ? String(p.id) : '';
                  const shortId = rawId.length > 8 ? rawId.slice(0, 8) + '…' : rawId;

                  const confRaw = typeof p.confidence_score === 'number'
                    ? p.confidence_score
                    : parseFloat(p.confidence_score || '0');
                  const confPercent = confRaw <= 1 && confRaw > 0 ? confRaw * 100 : confRaw;
                  const formattedConf = !isNaN(confPercent) ? confPercent.toFixed(1) : '—';

                  const formattedDate = p.created_at
                    ? new Date(p.created_at).toLocaleString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })
                    : 'Recent';

                  // 1. Patient identity (linked hospital patient record)
                  const patientName = p.patients?.patient_name || null;
                  const hospitalPid = p.patients?.patient_id || null;

                  // 2. Uploader identity (who submitted/uploaded the scan image — strictly visible to admin)
                  const isMyUpload = user?.id && p.user_id === user.id;
                  const uploaderName = isMyUpload
                    ? 'You (Admin)'
                    : p.profiles?.full_name
                      ? p.profiles.full_name
                      : p.profiles?.email
                        ? p.profiles.email.split('@')[0]
                        : 'Direct Patient Intake';

                  const uploaderRole = p.profiles?.role === 'admin'
                    ? 'Hospital Admin'
                    : p.profiles?.role === 'medical_staff'
                      ? 'Medical Staff'
                      : (p.profiles?.role === 'patient' || p.profiles?.role === 'general')
                        ? 'Patient Direct'
                        : 'Intake';

                  const uploaderEmail = p.profiles?.email || null;

                  return (
                    <div
                      key={p.id || Math.random()}
                      className="p-4 sm:p-5 hover:bg-surface-hover/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        {/* Clean X-ray Thumbnail Preview (Unobstructed) */}
                        <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-xl bg-slate-950 border border-border/80 overflow-hidden shrink-0 flex items-center justify-center relative shadow-sm ring-1 ring-black/5">
                          {thumbUrl ? (
                            <img
                              src={thumbUrl}
                              alt="Scan Preview"
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                              loading="lazy"
                            />
                          ) : (
                            <Activity className="h-6 w-6 text-slate-500" />
                          )}
                          {p.is_uncertain && (
                            <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-warning ring-2 ring-slate-950 shadow-xs" title="Flagged Uncertain" />
                          )}
                          {isMyUpload && (
                            <div className="absolute top-1.5 left-1.5 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-slate-950 shadow-xs" title="Uploaded by you" />
                          )}
                        </div>

                        {/* Scan Details */}
                        <div className="min-w-0 flex-1">
                          {/* ── Line 1: Patient Identity & Image Uploader Origin (Admin Transparency) ── */}
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            {/* Patient Badge */}
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-primary/10 text-primary border border-primary/20 shadow-2xs">
                              <User className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span>Patient: <strong className="font-extrabold text-foreground">{patientName || 'Direct Intake (Unlinked)'}</strong></span>
                            </span>

                            {hospitalPid && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-mono text-secondary bg-surface border border-border">
                                <span className="text-muted text-[10px] uppercase font-bold">PID</span>
                                {hospitalPid}
                              </span>
                            )}

                            {/* Uploader Identification Badge (Admin Exclusive - Clean Design-System Styling) */}
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium bg-surface text-secondary border border-border shadow-2xs hover:border-primary/40 transition-colors"
                              title={uploaderEmail ? `Uploader account: ${uploaderName} (${uploaderEmail})` : `Uploaded by: ${uploaderName}`}
                            >
                              <Upload className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span>Uploaded by: <strong className="font-semibold text-foreground">{uploaderName}</strong> <span className="text-muted text-[10px] ml-0.5">({uploaderRole})</span></span>
                            </span>

                            {isMyUpload && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-primary text-white rounded-lg font-bold shadow-2xs">
                                Your Upload
                              </span>
                            )}
                          </div>

                          {/* ── Line 2: Clinical AI Assessment & Doctor Review Status ── */}
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold border ${
                              isPneu
                                ? 'bg-pneumonia/10 text-pneumonia border-pneumonia/30'
                                : 'bg-success/10 text-success border-success/30'
                            }`}>
                              {p.predicted_class || 'UNKNOWN'}
                            </span>

                            <span className="text-xs font-mono font-semibold text-foreground">
                              {formattedConf}% <span className="text-muted font-sans font-normal text-[11px]">confidence</span>
                            </span>

                            {p.is_uncertain && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-warning/10 text-warning border border-warning/30">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                UNCERTAIN
                              </span>
                            )}

                            {/* Clean Doctor Review Status badge */}
                            {latestReview ? (
                              latestReview.verdict === 'confirmed' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-success/10 text-success border border-success/30">
                                  <CheckCircle2 className="h-2.5 w-2.5" />
                                  Doctor Confirmed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-pneumonia/10 text-pneumonia border border-pneumonia/30">
                                  <RefreshCw className="h-2.5 w-2.5" />
                                  Overridden → {latestReview.override_class}
                                </span>
                              )
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-muted/10 text-muted border border-border/50">
                                <Clock className="h-2.5 w-2.5" />
                                Pending Review
                              </span>
                            )}
                          </div>

                          {/* ── Line 3: ID, Timestamp & Clinical Notes ── */}
                          <div className="flex items-center gap-2 text-xs text-muted truncate">
                            {shortId && <span className="font-mono text-[11px]">ID: {shortId}</span>}
                            {shortId && <span>·</span>}
                            <span className="flex items-center gap-1 text-[11px]">
                              <Calendar className="h-3 w-3" />
                              {formattedDate}
                            </span>
                            {latestReview?.clinical_notes && (
                              <>
                                <span>·</span>
                                <span className="text-secondary italic text-xs truncate max-w-sm">
                                  "{latestReview.clinical_notes}"
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <Link to={`/admin/scans/${p.id}`}>
                          <Button
                            size="sm"
                            variant="outline"
                            icon={<Eye className="h-3.5 w-3.5 text-primary" />}
                            className="hover:border-primary/50 hover:bg-primary/5"
                          >
                            Inspect & Review
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {!loadingPredictions && predictions.length > 0 && (
              <div className="p-4 border-t border-border/40 flex items-center justify-between text-xs text-secondary">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={predictionPage <= 1}
                  onClick={() => setPredictionPage(p => Math.max(1, p - 1))}
                  icon={<ChevronLeft className="h-3.5 w-3.5" />}
                >
                  Previous
                </Button>
                <span>
                  Page {predictionPage} · Total Scans: {totalPredictions}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!hasMorePredictions}
                  onClick={() => setPredictionPage(p => p + 1)}
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

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
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
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
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-info/20 flex items-center justify-center font-bold text-primary text-xs shrink-0">
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
                              {u.role === 'admin' ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/25 shadow-2xs">
                                  <Shield className="h-3.5 w-3.5 text-primary shrink-0" />
                                  <span>Administrator (Permanent)</span>
                                </span>
                              ) : (
                                <>
                                  {/* Role Select Dropdown — General User & Medical Staff (Doctor) ONLY */}
                                  <select
                                    value={u.role === 'medical_staff' ? 'medical_staff' : 'general'}
                                    disabled={isUpdating}
                                    onChange={e => handleRoleChange(u.id, e.target.value)}
                                    className="px-2.5 py-1.5 rounded-lg bg-surface border border-border text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer disabled:opacity-50 shadow-2xs hover:border-primary/40 transition-colors"
                                    title="Switch role between General User and Medical Staff"
                                  >
                                    <option value="general">General User</option>
                                    <option value="medical_staff">Medical Staff (Doctor)</option>
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
                                </>
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

                    <Link to={`/admin/scans/${log.prediction_id}`}>
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
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
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

function MetricCard({ title, value, subtitle, icon, gradient, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`glass rounded-2xl p-5 border bg-gradient-to-br ${gradient} hover-lift transition-all duration-300 ${onClick ? 'cursor-pointer' : ''}`}
    >
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
          ? 'border-primary text-primary bg-primary/5'
          : 'border-transparent text-secondary hover:text-foreground hover:bg-surface-hover/50'
      }`}
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && count !== null && (
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
          active ? 'bg-primary text-white' : 'bg-surface border border-border text-muted'
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
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/25">
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
