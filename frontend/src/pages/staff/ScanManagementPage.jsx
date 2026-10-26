import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  FileSearch, Search, Filter, X, ChevronRight, ChevronLeft,
  AlertTriangle, Shield, Clock, CheckCircle, RefreshCw,
  Calendar, SlidersHorizontal, Users, ShieldCheck, Link2, Inbox
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { fetchStaffPredictions } from '@/services/staffService';
import Container from '@/components/layout/Container';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import ConnectScanModal from '@/components/sharing/ConnectScanModal';

const ITEMS_PER_PAGE = 15;

export default function ScanManagementPage() {
  useDocumentTitle('Scan Management');
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Scope: 'my_patients' (default) | 'all' (admin only)
  const rawScope = searchParams.get('scope') || 'my_patients';
  const currentScope = rawScope === 'unassigned' ? 'my_patients' : rawScope;

  // Initialize filters from URL params
  const [filters, setFilters] = useState({
    scope: currentScope,
    status: searchParams.get('status') || 'all',
    classification: searchParams.get('classification') || 'all',
    uncertain: searchParams.get('uncertain') || 'all',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    patientId: searchParams.get('patientId') || '',
  });

  const [showFilters, setShowFilters] = useState(
    !!(searchParams.get('status') || searchParams.get('classification') || searchParams.get('uncertain') || searchParams.get('dateFrom'))
  );

  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

  const loadPredictions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: err, count, hasMore: more } = await fetchStaffPredictions({
        page,
        limit: ITEMS_PER_PAGE,
        ...filters,
      });
      if (err) throw err;
      setPredictions(data || []);
      setHasMore(more);
      setTotalCount(count || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    loadPredictions();
  }, [loadPredictions]);

  const setScope = (newScope) => {
    setFilters(prev => ({ ...prev, scope: newScope }));
    setPage(1);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('scope', newScope);
      return next;
    });
  };

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(prev => ({
      ...prev,
      status: 'all', classification: 'all', uncertain: 'all',
      dateFrom: '', dateTo: '', patientId: '',
    }));
    setPage(1);
    setSearchParams(prev => {
      const next = new URLSearchParams();
      if (prev.get('scope')) next.set('scope', prev.get('scope'));
      return next;
    });
  };

  const hasActiveFilters = Object.entries(filters).some(([k, v]) => {
    if (k === 'scope') return false;
    if (k === 'status' || k === 'classification' || k === 'uncertain') return v !== 'all';
    return !!v;
  });

  // Count active filters (excluding scope)
  const activeFilterCount = Object.entries(filters).reduce((count, [k, v]) => {
    if (k === 'scope') return count;
    if (k === 'status' || k === 'classification' || k === 'uncertain') return v !== 'all' ? count + 1 : count;
    return v ? count + 1 : count;
  }, 0);

  return (
    <Container size="xl" className="py-8 md:py-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted mb-4 animate-fade-in-up">
        <Link to="/staff" className="hover:text-primary transition-colors">Dashboard</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">Scans</span>
      </nav>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 animate-fade-in-up">
        <PageHeader
          title="Scan Management"
          description="Clinical screening records with strict patient consent and doctor-patient assignment."
        />
        <Button
          variant="primary"
          icon={<Link2 className="h-4 w-4" />}
          onClick={() => setIsConnectModalOpen(true)}
          className="shrink-0 self-start sm:self-auto shadow-md shadow-primary/20"
        >
          Connect Patient Scan
        </Button>
      </div>

      {/* Scope Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border mb-6 overflow-x-auto pb-1 animate-fade-in-up stagger-1">
        <button
          onClick={() => setScope('my_patients')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-semibold transition-all border-b-2 cursor-pointer ${
            filters.scope === 'my_patients'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-secondary hover:text-foreground hover:bg-surface-hover/50'
          }`}
        >
          <Users className="h-4 w-4" />
          My Assigned Patients
        </button>

        {isAdmin && (
          <button
            onClick={() => setScope('all')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-semibold transition-all border-b-2 cursor-pointer ${
              filters.scope === 'all'
                ? 'border-info text-info bg-info/5'
                : 'border-transparent text-secondary hover:text-foreground hover:bg-surface-hover/50'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            All Hospital Scans (Admin)
          </button>
        )}
      </div>

      {/* Security Context Banner */}
      <div className="mb-6 p-3.5 rounded-xl border text-xs sm:text-sm flex items-center justify-between gap-3 animate-fade-in-up stagger-2 bg-surface/50 border-border/40">
        <div className="flex items-center gap-2 text-secondary">
          {filters.scope === 'my_patients' && (
            <>
              <ShieldCheck className="h-4 w-4 text-success shrink-0" />
              <span>
                <strong>Strict Privacy Active:</strong> Displaying only scans linked to patients assigned to your direct clinical care. Stranger scans are strictly blocked.
              </span>
            </>
          )}
          {filters.scope === 'all' && (
            <>
              <Shield className="h-4 w-4 text-info shrink-0" />
              <span>
                <strong>Hospital Oversight:</strong> Viewing entire screening database under administrator privileges.
              </span>
            </>
          )}
        </div>
        <span className="font-semibold text-foreground shrink-0">{totalCount} total scans</span>
      </div>

      {/* Filter Toggle + Active Count */}
      <div className="flex items-center gap-3 mb-4 animate-fade-in-up stagger-2" style={{ opacity: 0 }}>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
            showFilters ? 'bg-primary/10 text-primary border border-primary/30' : 'bg-surface border border-border text-secondary hover:bg-surface-hover'
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-muted hover:text-error flex items-center gap-1 transition-colors cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
            Clear all
          </button>
        )}

        <div className="flex-1" />

        <button
          onClick={loadPredictions}
          className="p-2 rounded-lg text-muted hover:text-primary hover:bg-primary/5 transition-colors cursor-pointer"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="glass rounded-2xl p-5 mb-6 border border-border/40 animate-fade-in-up">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Review Status</label>
              <select
                value={filters.status}
                onChange={e => updateFilter('status', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-foreground text-sm focus:outline-none focus:border-primary transition-all cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="reviewed">Reviewed</option>
                <option value="confirmed">Confirmed</option>
                <option value="overridden">Overridden</option>
              </select>
            </div>

            {/* Classification Filter */}
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">AI Classification</label>
              <select
                value={filters.classification}
                onChange={e => updateFilter('classification', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-foreground text-sm focus:outline-none focus:border-primary transition-all cursor-pointer"
              >
                <option value="all">All Results</option>
                <option value="NORMAL">Normal</option>
                <option value="PNEUMONIA">Pneumonia</option>
              </select>
            </div>

            {/* Uncertainty Filter */}
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Uncertainty Flag</label>
              <select
                value={filters.uncertain}
                onChange={e => updateFilter('uncertain', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-foreground text-sm focus:outline-none focus:border-primary transition-all cursor-pointer"
              >
                <option value="all">All Scans</option>
                <option value="yes">Flagged (Uncertain)</option>
                <option value="no">High Confidence Only</option>
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">From Date</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={e => updateFilter('dateFrom', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-foreground text-sm focus:outline-none focus:border-primary transition-all cursor-pointer"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">To Date</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={e => updateFilter('dateTo', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-foreground text-sm focus:outline-none focus:border-primary transition-all cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-error-bg border border-error-light text-error mb-6">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" className="text-primary" />
        </div>
      ) : predictions.length === 0 ? (
        /* Empty State */
        <div className="glass rounded-2xl p-12 text-center animate-fade-in-up">
          <FileSearch className="h-16 w-16 text-muted mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">
            {filters.scope === 'unassigned'
              ? 'No unassigned scans in the queue'
              : hasActiveFilters
                ? 'No scans match your filters'
                : 'No patient scans found'}
          </h3>
          <p className="text-secondary mb-4">
            {filters.scope === 'unassigned'
              ? 'All incoming screenings have been assigned to patients.'
              : hasActiveFilters
                ? 'Try adjusting your filters or clearing them.'
                : 'Scans will appear here once linked to your patients.'}
          </p>
          {hasActiveFilters && (
            <Button variant="secondary" onClick={clearFilters}>Clear Filters</Button>
          )}
        </div>
      ) : (
        /* Scan List */
        <>
          <div className="space-y-3">
            {predictions.map((prediction, i) => (
              <ScanRow key={prediction.id} prediction={prediction} index={i} scope={filters.scope} isAdmin={isAdmin} />
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-8">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              icon={<ChevronLeft className="h-4 w-4" />}
            >
              Previous
            </Button>
            <span className="text-sm text-muted">
              Page {page} · Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, totalCount)} of {totalCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasMore}
              onClick={() => setPage(p => p + 1)}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}

      {/* Connect Patient Scan Modal */}
      <ConnectScanModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onSuccess={() => loadPredictions()}
      />
    </Container>
  );
}


// ── Sub-Components ──────────────────────────────────────────

function ScanRow({ prediction, index, scope, isAdmin }) {
  const isPneumonia = prediction.predicted_class === 'PNEUMONIA';
  const patient = prediction.patients;
  const reviews = prediction.staff_reviews || [];
  const hasReview = reviews.length > 0;

  const statusConfig = {
    pending: { icon: Clock, color: 'text-warning bg-warning/10 border-warning/30', label: 'Pending' },
    reviewed: { icon: FileSearch, color: 'text-info bg-info/10 border-info/30', label: 'Reviewed' },
    confirmed: { icon: CheckCircle, color: 'text-success bg-success/10 border-success/30', label: 'Confirmed' },
    overridden: { icon: RefreshCw, color: 'text-pneumonia bg-pneumonia/10 border-pneumonia/30', label: 'Overridden' },
  };

  const status = statusConfig[prediction.review_status] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <Link
      to={`/staff/scans/${prediction.id}`}
      className="flex items-center gap-4 glass rounded-xl p-4 hover-lift hover-glow border border-border/30 transition-all duration-200 group animate-fade-in-up"
      style={{ animationDelay: `${index * 40}ms`, opacity: 0 }}
    >
      {/* Classification indicator */}
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
        isPneumonia ? 'bg-pneumonia/10' : 'bg-success/10'
      }`}>
        <Shield className={`h-6 w-6 ${isPneumonia ? 'text-pneumonia' : 'text-success'}`} />
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className={`text-sm font-bold ${isPneumonia ? 'text-pneumonia' : 'text-success'}`}>
            {prediction.predicted_class}
          </span>
          <span className="text-xs text-muted font-mono">
            {Number(prediction.confidence_score || 0).toFixed(1)}%
          </span>

          {prediction.is_uncertain && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-warning/10 text-warning border border-warning/30">
              <AlertTriangle className="h-2.5 w-2.5" />
              UNCERTAIN
            </span>
          )}

          {hasReview && reviews[0]?.verdict === 'overridden' && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-pneumonia/10 text-pneumonia border border-pneumonia/30">
              → {reviews[0].override_class}
            </span>
          )}

          {/* Patient Assignment Tag */}
          {patient ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
              <Users className="h-2.5 w-2.5" />
              {patient.patient_name}
            </span>
          ) : isAdmin ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
              <Users className="h-2.5 w-2.5 text-indigo-600 dark:text-indigo-400" />
              {prediction.profiles?.full_name || 'Direct Patient Upload'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-warning/10 text-warning border border-warning/30">
              <Inbox className="h-2.5 w-2.5" />
              Unassigned Intake
            </span>
          )}
        </div>

        <p className="text-xs text-muted truncate">
          {patient?.patient_name
            ? `${patient.patient_name}${patient.patient_id ? ` · Hospital ID: ${patient.patient_id}` : ''}`
            : isAdmin && prediction.profiles?.full_name
              ? `Uploaded by ${prediction.profiles.full_name}${prediction.profiles.email ? ` (${prediction.profiles.email})` : ''}`
              : 'Unassigned screening · Click to claim and link to your patient'}
          {' · '}
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(prediction.created_at).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </span>
        </p>
      </div>

      {/* Action / Status */}
      {!patient ? (
        <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-hover text-muted border border-border">
          Staff Upload
        </span>
      ) : (
        <span className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${status.color}`}>
          <StatusIcon className="h-3.5 w-3.5" />
          {status.label}
        </span>
      )}

      {/* Arrow */}
      <ChevronRight className="h-4 w-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </Link>
  );
}
