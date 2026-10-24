import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Users, UserPlus, Search, Edit3, Trash2, X, ChevronLeft,
  AlertTriangle, User, Phone, FileText, Calendar, ChevronRight
} from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { fetchPatients, createPatient, updatePatient, deletePatient } from '@/services/staffService';
import Container from '@/components/layout/Container';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

export default function PatientManagementPage() {
  useDocumentTitle('Patient Records');
  const [searchParams, setSearchParams] = useSearchParams();

  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Modal state
  const [showModal, setShowModal] = useState(searchParams.get('action') === 'new');
  const [editingPatient, setEditingPatient] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Form state
  const [form, setForm] = useState({
    patientName: '', patientId: '', age: '', gender: '', contact: '', notes: '',
  });

  const loadPatients = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: err, count, hasMore: more } = await fetchPatients({
        search, page, limit: 20,
      });
      if (err) throw err;
      setPatients(data || []);
      setHasMore(more);
      setTotalCount(count || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const resetForm = () => {
    setForm({ patientName: '', patientId: '', age: '', gender: '', contact: '', notes: '' });
    setEditingPatient(null);
  };

  const openNewModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (patient) => {
    setForm({
      patientName: patient.patient_name || '',
      patientId: patient.patient_id || '',
      age: patient.age?.toString() || '',
      gender: patient.gender || '',
      contact: patient.contact || '',
      notes: patient.notes || '',
    });
    setEditingPatient(patient);
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.patientName.trim()) return;

    try {
      setSaving(true);
      const payload = {
        ...form,
        age: form.age ? parseInt(form.age, 10) : null,
      };

      if (editingPatient) {
        const { error: err } = await updatePatient(editingPatient.id, payload);
        if (err) throw err;
      } else {
        const { error: err } = await createPatient(payload);
        if (err) throw err;
      }

      setShowModal(false);
      resetForm();
      loadPatients();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const { error: err } = await deletePatient(id);
      if (err) throw err;
      setDeleteConfirm(null);
      loadPatients();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Container size="xl" className="py-8 md:py-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted mb-4 animate-fade-in-up">
        <Link to="/staff" className="hover:text-primary transition-colors">Dashboard</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">Patients</span>
      </nav>

      <PageHeader
        title="Patient Records"
        description="Manage patient records and link them to screening results."
      />

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6 animate-fade-in-up stagger-2" style={{ opacity: 0 }}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            placeholder="Search by name or patient ID..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-surface text-foreground text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setPage(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button variant="primary" onClick={openNewModal} icon={<UserPlus className="h-4 w-4" />}>
          Add Patient
        </Button>
      </div>

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
      ) : patients.length === 0 ? (
        /* Empty State */
        <div className="glass rounded-2xl p-12 text-center animate-fade-in-up">
          <Users className="h-16 w-16 text-muted mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">
            {search ? 'No patients found' : 'No patients yet'}
          </h3>
          <p className="text-secondary mb-6">
            {search
              ? 'Try a different search term.'
              : 'Create your first patient record to start linking scans.'}
          </p>
          {!search && (
            <Button variant="primary" onClick={openNewModal} icon={<UserPlus className="h-4 w-4" />}>
              Add First Patient
            </Button>
          )}
        </div>
      ) : (
        /* Patient Cards */
        <>
          <p className="text-sm text-muted mb-4">{totalCount} patient{totalCount !== 1 ? 's' : ''} found</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {patients.map((patient, i) => (
              <PatientCard
                key={patient.id}
                patient={patient}
                onEdit={() => openEditModal(patient)}
                onDelete={() => setDeleteConfirm(patient)}
                index={i}
              />
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="text-sm text-muted">Page {page}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasMore}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <PatientModal
          form={form}
          setForm={setForm}
          onSave={handleSave}
          onClose={() => { setShowModal(false); resetForm(); }}
          isEditing={!!editingPatient}
          saving={saving}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <DeleteConfirmModal
          patient={deleteConfirm}
          onConfirm={() => handleDelete(deleteConfirm.id)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </Container>
  );
}


// ── Sub-Components ──────────────────────────────────────────

function PatientCard({ patient, onEdit, onDelete, index }) {
  return (
    <div
      className="glass rounded-2xl p-5 border border-border/30 hover-lift hover-glow transition-all duration-300 animate-fade-in-up"
      style={{ animationDelay: `${index * 60}ms`, opacity: 0 }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center">
            <User className="h-5 w-5 text-info" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">{patient.patient_name}</h3>
            {patient.patient_id && (
              <p className="text-xs text-muted">ID: {patient.patient_id}</p>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-primary/5 transition-colors cursor-pointer"
            title="Edit"
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-muted hover:text-error hover:bg-error/5 transition-colors cursor-pointer"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-1.5 text-xs text-muted">
        {patient.age && (
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" />
            <span>Age: {patient.age} {patient.gender ? `· ${patient.gender}` : ''}</span>
          </div>
        )}
        {patient.contact && (
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5" />
            <span>{patient.contact}</span>
          </div>
        )}
        {patient.notes && (
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" />
            <span className="truncate">{patient.notes}</span>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-border/30 flex justify-between items-center">
        <span className="text-[11px] text-muted">
          Added {new Date(patient.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
        <Link
          to={`/staff/scans?patientId=${patient.id}`}
          className="text-[11px] text-primary font-medium hover:text-primary-hover flex items-center gap-0.5 transition-colors"
        >
          View Scans <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

function PatientModal({ form, setForm, onSave, onClose, isEditing, saving }) {
  const handleChange = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="glass-strong rounded-2xl w-full max-w-lg p-6 shadow-xl animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">
            {isEditing ? 'Edit Patient' : 'New Patient'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-hover text-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onSave} className="space-y-4">
          {/* Patient Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Patient Name <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={form.patientName}
              onChange={handleChange('patientName')}
              placeholder="Full name"
              required
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-foreground text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          {/* Patient ID + Age */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Patient ID</label>
              <input
                type="text"
                value={form.patientId}
                onChange={handleChange('patientId')}
                placeholder="Hospital ID"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-foreground text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Age</label>
              <input
                type="number"
                value={form.age}
                onChange={handleChange('age')}
                placeholder="Years"
                min="0"
                max="150"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-foreground text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          {/* Gender + Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Gender</label>
              <select
                value={form.gender}
                onChange={handleChange('gender')}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-foreground text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
              >
                <option value="">Not specified</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Contact</label>
              <input
                type="text"
                value={form.contact}
                onChange={handleChange('contact')}
                placeholder="Phone / Email"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-foreground text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Notes</label>
            <textarea
              value={form.notes}
              onChange={handleChange('notes')}
              placeholder="Any relevant medical history or notes..."
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-foreground text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" isLoading={saving}>
              {isEditing ? 'Save Changes' : 'Create Patient'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ patient, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onCancel}>
      <div
        className="glass-strong rounded-2xl w-full max-w-sm p-6 shadow-xl animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="h-7 w-7 text-error" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">Delete Patient?</h3>
          <p className="text-sm text-secondary mb-6">
            This will permanently delete <strong>{patient.patient_name}</strong> and unlink all associated scans. This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
            <Button variant="danger" className="flex-1" onClick={onConfirm}>Delete</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
