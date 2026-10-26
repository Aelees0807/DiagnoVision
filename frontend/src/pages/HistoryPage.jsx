import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { History, Search, Trash2, AlertTriangle, X, ChevronRight, Download, Scan, Stethoscope, Shield, Activity } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import Container from '@/components/layout/Container';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import ShareWithDoctorModal from '@/components/sharing/ShareWithDoctorModal';

const ITEMS_PER_PAGE = 10;

export default function HistoryPage() {
  useDocumentTitle('Screening History');
  const { user, isAdmin } = useAuth();
  
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  const [selectedItem, setSelectedItem] = useState(null);
  const [diseaseInfo, setDiseaseInfo] = useState(null);
  const [shareModalItem, setShareModalItem] = useState(null);
  
  // Storage URLs
  const [signedUrls, setSignedUrls] = useState({});

  const fetchHistory = useCallback(async (pageNumber, append = false) => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      
      const from = (pageNumber - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, error: dbError, count } = await supabase
        .from('medical_predictions')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (dbError) throw dbError;

      setPredictions(prev => append ? [...prev, ...data] : data);
      setHasMore(count > to + 1);
      
      // Fetch signed URLs for these items
      const pathsToSign = [];
      data.forEach(item => {
        if (item.image_path) pathsToSign.push(item.image_path);
        if (item.heatmap_path) pathsToSign.push(item.heatmap_path);
      });
      
      if (pathsToSign.length > 0) {
        const { data: urlData, error: urlError } = await supabase.storage
          .from('xrays')
          .createSignedUrls(pathsToSign, 60 * 60); // 1 hour expiry
          
        if (urlError) {
          console.error('[HistoryPage] Error creating signed URLs:', urlError);
        } else if (urlData) {
          // Map by index — createSignedUrls guarantees the response
          // array is in the same order as the input paths array.
          // Using u.path can fail due to encoding/leading-slash mismatches.
          const urlMap = {};
          urlData.forEach((u, index) => {
            if (!u.error && u.signedUrl) {
              urlMap[pathsToSign[index]] = u.signedUrl;
            } else if (u.error) {
              console.warn(`[HistoryPage] Signed URL error for "${pathsToSign[index]}":`, u.error);
            }
          });
          setSignedUrls(prev => ({ ...prev, ...urlMap }));
        }
      }
    } catch (err) {
      console.error('Fetch history error:', err);
      setError('Failed to load history. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchHistory(1, false);
    }
  }, [user, fetchHistory]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchHistory(nextPage, true);
  };

  const handleDelete = async (e, id, imagePath, heatmapPath) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this result? This cannot be undone.')) {
      return;
    }
    
    try {
      // Delete from storage
      const pathsToDelete = [imagePath];
      if (heatmapPath) pathsToDelete.push(heatmapPath);
      await supabase.storage.from('xrays').remove(pathsToDelete);
      
      // Delete from DB
      await supabase.from('medical_predictions').delete().eq('id', id);
      
      // Update UI
      setPredictions(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete item.');
    }
  };

  const openDetail = async (item) => {
    setSelectedItem(item);
    
    // Fetch disease info matching the class
    try {
      const { data } = await supabase
        .from('disease_info')
        .select('*')
        .eq('class_name', item.predicted_class)
        .single();
      if (data) setDiseaseInfo(data);
    } catch (err) {
      console.error('Failed to fetch disease info', err);
    }
  };

  const closeDetail = () => {
    setSelectedItem(null);
    setDiseaseInfo(null);
  };

  const formatDate = (dateString) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(dateString));
  };

  return (
    <Container size="lg">
      {/* Admin Notice Banner */}
      {isAdmin && (
        <div className="mb-6 p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in-up">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-indigo-600/30">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-indigo-950">Hospital Administrator Account</h3>
              <p className="text-xs text-indigo-700 mt-0.5">
                Administrators oversee hospital-wide predictions and clinical reviews from the Admin Console.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link to="/admin">
              <Button size="sm" variant="primary" icon={<Shield className="h-4 w-4" />}>
                Admin Console
              </Button>
            </Link>
            <Link to="/admin">
              <Button size="sm" variant="outline" icon={<Activity className="h-4 w-4 text-info" />}>
                Manage Hospital Scans
              </Button>
            </Link>
          </div>
        </div>
      )}

      <PageHeader
        title="Screening History"
        description="View and manage your past AI-assisted chest X-ray screening results."
      />

      {error && (
        <div className="mb-8 p-4 bg-error-bg border border-error-light text-error rounded-xl flex items-center gap-3 animate-fade-in-up">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* ── Main List ── */}
      <div className="bg-white/50 backdrop-blur-md rounded-2xl border border-border shadow-sm overflow-hidden mb-8 animate-fade-in-up">
        {predictions.length === 0 && !loading && !error ? (
          isAdmin ? (
            <div className="p-12 text-center flex flex-col items-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-indigo-100/80 border border-indigo-200 text-indigo-600 flex items-center justify-center mb-4">
                <Shield className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Hospital Admin Mode</h3>
              <p className="text-secondary text-sm mb-6 leading-relaxed">
                Your personal screening history is empty because admin accounts manage system-wide hospital records, medical staff governance, and clinical predictions.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
                <Link to="/admin" className="w-full sm:w-auto">
                  <Button className="w-full justify-center" icon={<Shield className="h-4 w-4" />}>
                    Open Admin Console
                  </Button>
                </Link>
                <Link to="/admin" className="w-full sm:w-auto">
                  <Button variant="outline" className="w-full justify-center" icon={<Activity className="h-4 w-4 text-info" />}>
                    Manage Hospital Scans
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <History className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No history yet</h3>
              <p className="text-secondary mb-6">Your saved screening results will appear here.</p>
              <Link to="/predict">
                <Button icon={<Scan className="h-4 w-4" />}>Analyze an X-Ray</Button>
              </Link>
            </div>
          )
        ) : (
          <div className="divide-y divide-border/60">
            {predictions.map((item, index) => {
              const isPneumonia = item.predicted_class === 'PNEUMONIA';
              const imgUrl = signedUrls[item.image_path];
              
              return (
                <div 
                  key={item.id}
                  onClick={() => openDetail(item)}
                  className="p-4 sm:p-6 hover:bg-surface-hover transition-colors cursor-pointer flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 animate-fade-in-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Thumbnail */}
                  <div className="w-20 h-20 shrink-0 bg-gray-100 rounded-lg overflow-hidden border border-border/50 flex items-center justify-center">
                    {imgUrl ? (
                      <img 
                        src={imgUrl} 
                        alt="X-ray thumbnail" 
                        crossOrigin="anonymous"
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="w-full h-full animate-pulse bg-gray-200" />
                    )}
                  </div>
                  
                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className={`text-lg font-bold ${isPneumonia ? 'text-pneumonia' : 'text-success'}`}>
                        {item.predicted_class}
                      </h3>
                      {item.is_uncertain && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-warning-bg text-warning border border-warning-light">
                          Uncertain
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-secondary mt-2">
                      <span className="font-medium bg-surface px-2 py-0.5 rounded-md border border-border">
                        {item.confidence_score.toFixed(1)}% Confidence
                      </span>
                      <span>{formatDate(item.created_at)}</span>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-auto w-full sm:w-auto justify-end mt-4 sm:mt-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShareModalItem(item);
                      }}
                      className="px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 rounded-lg transition-colors flex items-center gap-1.5 border border-primary/20 bg-primary/5 cursor-pointer"
                      title="Share with Doctor"
                    >
                      <Stethoscope className="h-3.5 w-3.5 text-primary" />
                      <span>Share with Doctor</span>
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, item.id, item.image_path, item.heatmap_path)}
                      className="p-2 text-secondary hover:text-error hover:bg-error-bg rounded-lg transition-colors cursor-pointer"
                      title="Delete result"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <div className="w-8 h-8 flex items-center justify-center text-primary bg-primary-light rounded-lg">
                      <ChevronRight className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {/* Loading Skeletons */}
        {loading && (
          <div className="divide-y divide-border/60">
            {[1, 2, 3].map(i => (
              <div key={i} className="p-6 flex gap-6 animate-pulse">
                <div className="w-20 h-20 bg-gray-200 rounded-lg shrink-0" />
                <div className="flex-1 space-y-3 py-2">
                  <div className="h-6 bg-gray-200 rounded w-32" />
                  <div className="h-4 bg-gray-200 rounded w-48" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Load More */}
      {hasMore && !loading && (
        <div className="flex justify-center mb-12">
          <Button variant="outline" onClick={handleLoadMore}>
            Load More Results
          </Button>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {selectedItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={closeDetail} />
          
          <div className="relative bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border">
              <div>
                <h2 className="text-xl font-bold text-foreground">Screening Details</h2>
                <p className="text-sm text-secondary">{formatDate(selectedItem.created_at)}</p>
              </div>
              <button onClick={closeDetail} className="p-2 text-secondary hover:text-foreground hover:bg-surface-hover rounded-lg transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-background">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                
                {/* Images */}
                <div className="space-y-4">
                  <div className="glass-panel rounded-xl p-3 bg-white">
                    <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2 px-1">Original X-Ray</p>
                    <div className="rounded-lg overflow-hidden bg-gray-900 border border-border">
                      <img 
                        src={signedUrls[selectedItem.image_path]} 
                        alt="Original X-Ray" 
                        crossOrigin="anonymous"
                        className="w-full h-auto max-h-[300px] object-contain"
                      />
                    </div>
                  </div>
                  
                  {selectedItem.heatmap_path && signedUrls[selectedItem.heatmap_path] && (
                    <div className="glass-panel rounded-xl p-3 bg-white">
                      <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2 px-1">Grad-CAM Heatmap</p>
                      <div className="rounded-lg overflow-hidden bg-gray-900 border border-border">
                        <img 
                          src={signedUrls[selectedItem.heatmap_path]} 
                          alt="Heatmap" 
                          crossOrigin="anonymous"
                          className="w-full h-auto max-h-[300px] object-contain"
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Info */}
                <div className="space-y-6">
                  {/* Status Card */}
                  <div className={`rounded-xl p-5 border-2 ${
                    selectedItem.predicted_class === 'PNEUMONIA' ? 'bg-pneumonia-bg border-pneumonia-light' : 'bg-success-bg border-success-light'
                  }`}>
                    <h3 className={`text-sm font-semibold uppercase tracking-wider mb-1 ${
                      selectedItem.predicted_class === 'PNEUMONIA' ? 'text-pneumonia/80' : 'text-success/80'
                    }`}>
                      Prediction Result
                    </h3>
                    <div className="flex items-baseline gap-3">
                      <span className={`text-3xl font-bold ${
                        selectedItem.predicted_class === 'PNEUMONIA' ? 'text-pneumonia' : 'text-success'
                      }`}>
                        {selectedItem.predicted_class}
                      </span>
                      <span className="text-lg font-medium text-foreground">
                        {selectedItem.confidence_score.toFixed(1)}%
                      </span>
                    </div>
                    {selectedItem.is_uncertain && (
                      <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-warning/20 text-warning-dark text-sm font-medium">
                        <AlertTriangle className="h-4 w-4" />
                        Low Confidence — Clinical correlation required
                      </div>
                    )}
                  </div>
                  
                  {/* Disease Info */}
                  {diseaseInfo ? (
                    <div className="bg-white rounded-xl p-5 border border-border shadow-sm">
                      <h4 className="font-semibold text-foreground mb-2">Analysis Details</h4>
                      <p className="text-sm text-secondary leading-relaxed mb-4">
                        {diseaseInfo.description}
                      </p>
                      <h4 className="font-semibold text-foreground mb-2">Recommended Action</h4>
                      <p className="text-sm text-secondary leading-relaxed">
                        {diseaseInfo.recommended_action}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl p-5 border border-border shadow-sm animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-200 rounded" />
                        <div className="h-3 bg-gray-200 rounded w-5/6" />
                        <div className="h-3 bg-gray-200 rounded w-4/6" />
                      </div>
                    </div>
                  )}
                  
                  {/* Share Action */}
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      className="w-full justify-center"
                      icon={<Stethoscope className="h-4 w-4 text-primary" />}
                      onClick={() => setShareModalItem(selectedItem)}
                    >
                      Share with Doctor
                    </Button>
                  </div>

                  {/* Disclaimer */}
                  <div className="bg-warning-bg border border-warning-light rounded-xl p-4 flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
                    <p className="text-xs text-warning-dark leading-relaxed">
                      <strong>AI-assisted screening only — not a medical diagnosis.</strong> This system provides supplementary information to assist clinical judgment. Always consult a qualified healthcare professional.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share with Doctor Modal */}
      <ShareWithDoctorModal
        prediction={shareModalItem}
        isOpen={!!shareModalItem}
        onClose={() => setShareModalItem(null)}
      />
    </Container>
  );
}
