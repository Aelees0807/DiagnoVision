import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, Users, AlertTriangle, ClipboardCheck, FileSearch,
  ChevronRight, Stethoscope, BarChart3, Clock, TrendingUp,
  Shield, UserPlus, Upload, ShieldCheck, Link2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { fetchDashboardStats } from '@/services/staffService';
import Container from '@/components/layout/Container';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import ConnectScanModal from '@/components/sharing/ConnectScanModal';

export default function StaffDashboardPage() {
  useDocumentTitle('Staff Dashboard');
  const { profile } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await fetchDashboardStats();
      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh]">
        <Spinner size="lg" className="text-primary mb-4" />
        <p className="text-secondary font-medium animate-pulse">Loading dashboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <Container size="lg" className="py-12">
        <div className="glass rounded-2xl p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-warning mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Error loading dashboard</h2>
          <p className="text-secondary">{error}</p>
          <Button variant="primary" className="mt-4" onClick={loadStats}>Retry</Button>
        </div>
      </Container>
    );
  }

  const greeting = getGreeting();

  return (
    <Container size="xl" className="py-8 md:py-12">
      {/* Header */}
      <header className="mb-8 animate-fade-in-up">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-info flex items-center justify-center shadow-md">
              <Stethoscope className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-muted font-medium">{greeting}</p>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                {profile?.full_name ? `${profile.full_name}` : 'Medical Staff'}
              </h1>
            </div>
          </div>

          {/* Privacy Security Status Pill + Connect Action */}
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              icon={<Link2 className="h-4 w-4" />}
              onClick={() => setIsConnectModalOpen(true)}
              className="shadow-md shadow-primary/20"
            >
              Connect Patient Scan
            </Button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-success-bg border border-success-light text-xs font-semibold text-success shadow-sm">
              <ShieldCheck className="h-4 w-4 text-success" />
              <span>Patient Privacy Active</span>
            </div>
          </div>
        </div>

        <p className="text-secondary mt-2 ml-14 text-sm">
          Screening workspace restricted to patients under your clinical care and incoming triage.
        </p>
      </header>

      {/* Patient Consent Sharing Banner */}
      <div className="mb-8 p-4 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-surface border border-primary/20 flex items-center justify-between gap-4 flex-wrap animate-fade-in-up">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0 shadow-sm">
            <Link2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              Patient Consent-Based Import
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-success-bg text-success border border-success-light">
                Zero Unauthorized Access
              </span>
            </h3>
            <p className="text-xs text-secondary mt-0.5">
              Patients generate a secure 6-character code (e.g., <code className="font-mono text-primary font-bold">DV-XXXXXX</code>) to authorize scan review.
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Link2 className="h-3.5 w-3.5" />}
          onClick={() => setIsConnectModalOpen(true)}
        >
          Enter Patient Code
        </Button>
      </div>

      {/* Stats Cards (My Assigned Patients) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Activity className="h-5 w-5" />}
          label="My Scans Today"
          value={stats.scansToday}
          color="primary"
          delay={0}
        />
        <StatCard
          icon={<ClipboardCheck className="h-5 w-5" />}
          label="Pending Reviews"
          value={stats.pendingReviews}
          color="warning"
          delay={1}
          link="/staff/scans?scope=my_patients&status=pending"
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Flagged Uncertain"
          value={stats.flaggedCases}
          color="pneumonia"
          delay={2}
          link="/staff/scans?scope=my_patients&uncertain=yes&status=pending"
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="My Assigned Patients"
          value={stats.totalPatients}
          color="info"
          delay={3}
          link="/staff/patients"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Quick Actions */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 animate-fade-in-up stagger-2" style={{ opacity: 0 }}>
            <TrendingUp className="h-5 w-5 text-primary" />
            Clinical Actions
          </h2>

          <div className="space-y-3 animate-fade-in-up stagger-3" style={{ opacity: 0 }}>
            <QuickAction
              icon={<FileSearch className="h-5 w-5" />}
              title="My Patients' Scans"
              description={`${stats.totalScans} scans under your care`}
              to="/staff/scans?scope=my_patients"
              color="primary"
            />
            <QuickAction
              icon={<Link2 className="h-5 w-5" />}
              title="Connect Patient Scan"
              description="Import X-ray via 6-digit patient share code"
              onClick={() => setIsConnectModalOpen(true)}
              color="warning"
            />
            <QuickAction
              icon={<UserPlus className="h-5 w-5" />}
              title="Add Patient"
              description="Register new patient under your care"
              to="/staff/patients?action=new"
              color="info"
            />
            <QuickAction
              icon={<Upload className="h-5 w-5" />}
              title="New X-Ray Screening"
              description="Upload and analyze patient X-ray"
              to="/predict"
              color="secondary"
            />
          </div>

          {/* Distribution Summary */}
          <div className="glass rounded-2xl p-5 mt-4 animate-fade-in-up stagger-4" style={{ opacity: 0 }}>
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              My Patient Classification Ratio
            </h3>
            <div className="space-y-3">
              <DistributionBar
                label="Normal"
                count={stats.distribution.NORMAL}
                total={stats.totalScans}
                color="bg-success"
              />
              <DistributionBar
                label="Pneumonia"
                count={stats.distribution.PNEUMONIA}
                total={stats.totalScans}
                color="bg-pneumonia"
              />
              <div className="pt-2 border-t border-border/50 mt-3">
                <div className="flex justify-between text-xs text-muted">
                  <span>{stats.distribution.uncertain} flagged uncertain</span>
                  <span>{stats.distribution.reviewed} clinical reviews</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Screenings */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4 animate-fade-in-up stagger-2" style={{ opacity: 0 }}>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Recent Screenings
            </h2>
            <Link
              to="/staff/scans?scope=my_patients"
              className="text-xs font-semibold text-primary hover:text-primary-hover flex items-center gap-1 transition-colors"
            >
              View all scans <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {stats.recentScans.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center animate-fade-in-up stagger-3" style={{ opacity: 0 }}>
              <FileSearch className="h-12 w-12 text-muted mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No screenings yet</h3>
              <p className="text-secondary mb-4">Start by uploading an X-ray or claiming a triage scan.</p>
              <Link to="/predict">
                <Button variant="primary" icon={<Upload className="h-4 w-4" />}>
                  Upload X-Ray
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3 animate-fade-in-up stagger-3" style={{ opacity: 0 }}>
              {stats.recentScans.map((scan, i) => (
                <RecentScanCard key={scan.id} scan={scan} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Connect Patient Scan Modal */}
      <ConnectScanModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onSuccess={() => loadStats()}
      />
    </Container>
  );
}

// ── Sub-Components ──────────────────────────────────────────

function StatCard({ icon, label, value, color, delay = 0, link }) {
  const colorStyles = {
    primary: 'from-primary/10 to-primary/5 text-primary border-primary/20',
    warning: 'from-warning/10 to-warning/5 text-warning border-warning/20',
    pneumonia: 'from-pneumonia/10 to-pneumonia/5 text-pneumonia border-pneumonia/20',
    info: 'from-info/10 to-info/5 text-info border-info/20',
    success: 'from-success/10 to-success/5 text-success border-success/20',
  };

  const iconBg = {
    primary: 'bg-primary/15',
    warning: 'bg-warning/15',
    pneumonia: 'bg-pneumonia/15',
    info: 'bg-info/15',
    success: 'bg-success/15',
  };

  const content = (
    <div
      className={`glass rounded-2xl p-5 border bg-gradient-to-br ${colorStyles[color]} hover-lift hover-glow transition-all duration-300 animate-fade-in-up`}
      style={{ animationDelay: `${delay * 100}ms`, opacity: 0 }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${iconBg[color]} flex items-center justify-center`}>
          {icon}
        </div>
        {link && <ChevronRight className="h-4 w-4 opacity-40" />}
      </div>
      <p className="text-3xl font-bold text-foreground">{value}</p>
      <p className="text-sm text-muted mt-1">{label}</p>
    </div>
  );

  if (link) {
    return <Link to={link} className="block">{content}</Link>;
  }

  return content;
}

function QuickAction({ icon, title, description, to, onClick, color }) {
  const colorClasses = {
    primary: 'text-primary bg-primary/10',
    info: 'text-info bg-info/10',
    warning: 'text-warning bg-warning/10',
    secondary: 'text-secondary bg-surface-hover',
  };

  const inner = (
    <>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colorClasses[color]}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
          {title}
        </p>
        <p className="text-xs text-muted truncate">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left flex items-center gap-4 glass rounded-xl p-4 hover-lift hover-glow border border-border/30 transition-all duration-200 group cursor-pointer"
      >
        {inner}
      </button>
    );
  }

  return (
    <Link
      to={to}
      className="flex items-center gap-4 glass rounded-xl p-4 hover-lift hover-glow border border-border/30 transition-all duration-200 group"
    >
      {inner}
    </Link>
  );
}

function DistributionBar({ label, count, total, color }) {
  const pct = total > 0 ? ((count / total) * 100).toFixed(0) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-secondary font-medium">{label}</span>
        <span className="text-muted">{count} ({pct}%)</span>
      </div>
      <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function RecentScanCard({ scan, index }) {
  const isPneumonia = scan.predicted_class === 'PNEUMONIA';
  const statusStyles = {
    pending: 'bg-warning/10 text-warning border-warning/30',
    reviewed: 'bg-info/10 text-info border-info/30',
    confirmed: 'bg-success/10 text-success border-success/30',
    overridden: 'bg-pneumonia/10 text-pneumonia border-pneumonia/30',
  };

  return (
    <Link
      to={`/staff/scans/${scan.id}`}
      className="flex items-center gap-4 glass rounded-xl p-4 hover-lift hover-glow border border-border/30 transition-all duration-200 group"
    >
      {/* Classification indicator */}
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
        isPneumonia ? 'bg-pneumonia/10' : 'bg-success/10'
      }`}>
        <Shield className={`h-5 w-5 ${isPneumonia ? 'text-pneumonia' : 'text-success'}`} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-sm font-bold ${isPneumonia ? 'text-pneumonia' : 'text-success'}`}>
            {scan.predicted_class}
          </span>
          <span className="text-xs text-muted">
            {scan.confidence_score.toFixed(1)}%
          </span>
          {scan.is_uncertain && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-warning/10 text-warning border border-warning/30">
              <AlertTriangle className="h-2.5 w-2.5" />
              UNCERTAIN
            </span>
          )}

          {scan.patients?.patient_name ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
              <Users className="h-2.5 w-2.5" />
              Assigned: {scan.patients.patient_name}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-warning/10 text-warning border border-warning/30">
              <Inbox className="h-2.5 w-2.5" />
              Unassigned Intake
            </span>
          )}
        </div>
        <p className="text-xs text-muted truncate">
          {scan.patients?.patient_name
            ? `Hospital ID: ${scan.patients.patient_id || 'N/A'}`
            : 'Click to claim and link to your patient record'}
          {' · '}
          {new Date(scan.created_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
          })}
        </p>
      </div>

      {/* Status badge */}
      <span className={`hidden sm:inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusStyles[scan.review_status]}`}>
        {scan.review_status}
      </span>

      <ChevronRight className="h-4 w-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning,';
  if (hour < 17) return 'Good afternoon,';
  return 'Good evening,';
}
