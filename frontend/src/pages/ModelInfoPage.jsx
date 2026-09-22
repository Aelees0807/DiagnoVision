import {
  Brain, Cpu, Database, Target, ShieldCheck,
  BarChart3, Info, Layers, Zap, Activity,
  ExternalLink, TrendingUp,
} from 'lucide-react';
import Container from '@/components/layout/Container';
import PageHeader from '@/components/layout/PageHeader';
import MetricCard from '@/components/metrics/MetricCard';
import ConfusionMatrix from '@/components/metrics/ConfusionMatrix';
import PerformanceTable from '@/components/metrics/PerformanceTable';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import RevealSection from '@/components/ui/RevealSection';
import { MODEL_METRICS, PNEUMONIA_MODEL, GATEKEEPER_MODEL, DATASET_INFO } from '@/constants';
import { formatPercent } from '@/utils/formatting';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function ModelInfoPage() {
  useDocumentTitle('Model Information');
  const cm = MODEL_METRICS.confusion_matrix;

  return (
    <Container size="xl">
      <PageHeader
        title="Model Information"
        description="Architecture, performance metrics, and evaluation results from the DiagnoVision AI pipeline."
      />

      {/* ─── Model Overview ─── */}
      <section className="mb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pneumonia Model Card */}
          <RevealSection delay={0}>
            <Card variant="glass" hover className="h-full overflow-hidden relative">
              {/* Subtle accent bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-info to-primary" />
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-info flex items-center justify-center shadow-lg shadow-primary/15 transition-transform duration-300 hover:scale-110">
                    <Brain className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle>Pneumonia Classifier</CardTitle>
                    <Badge variant="info" size="sm" className="mt-1">{PNEUMONIA_MODEL.name}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-secondary leading-relaxed mb-4">
                  A pre-trained EfficientNet-B0 model fine-tuned for binary classification of
                  pediatric chest X-rays. Uses compound scaling for optimal accuracy-efficiency
                  trade-off with ImageNet transfer learning.
                </p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-surface-hover/50 rounded-lg p-3">
                    <p className="text-muted text-xs">Input Size</p>
                    <p className="font-semibold font-mono text-foreground">{PNEUMONIA_MODEL.input_size}</p>
                  </div>
                  <div className="bg-surface-hover/50 rounded-lg p-3">
                    <p className="text-muted text-xs">Output Classes</p>
                    <p className="font-semibold text-foreground">{PNEUMONIA_MODEL.num_classes}</p>
                  </div>
                  <div className="bg-surface-hover/50 rounded-lg p-3">
                    <p className="text-muted text-xs">Class Names</p>
                    <div className="flex gap-1.5 mt-1">
                      <Badge variant="success" size="sm">NORMAL</Badge>
                      <Badge variant="pneumonia" size="sm">PNEUMONIA</Badge>
                    </div>
                  </div>
                  <div className="bg-surface-hover/50 rounded-lg p-3">
                    <p className="text-muted text-xs">Checkpoint</p>
                    <p className="font-mono text-xs text-foreground mt-1">{PNEUMONIA_MODEL.checkpoint}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </RevealSection>

          {/* Gatekeeper Model Card */}
          <RevealSection delay={150}>
            <Card variant="glass" hover className="h-full overflow-hidden relative">
              {/* Subtle accent bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-success via-success/70 to-success" />
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-success to-success/70 flex items-center justify-center shadow-lg shadow-success/15 transition-transform duration-300 hover:scale-110">
                    <ShieldCheck className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle>Gatekeeper Model</CardTitle>
                    <Badge variant="success" size="sm" className="mt-1">{GATEKEEPER_MODEL.name}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-secondary leading-relaxed mb-4">
                  {GATEKEEPER_MODEL.purpose}. Trained to distinguish frontal chest X-rays from
                  other image types, acting as a safety layer before pneumonia classification.
                </p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-surface-hover/50 rounded-lg p-3">
                    <p className="text-muted text-xs">Architecture</p>
                    <p className="font-semibold text-foreground">{GATEKEEPER_MODEL.name}</p>
                  </div>
                  <div className="bg-surface-hover/50 rounded-lg p-3">
                    <p className="text-muted text-xs">Checkpoint</p>
                    <p className="font-mono text-xs text-foreground mt-1">{GATEKEEPER_MODEL.checkpoint}</p>
                  </div>
                  <div className="col-span-2 bg-success-bg/50 rounded-lg p-3 border border-success-light/50">
                    <p className="text-xs text-success font-medium flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Purpose
                    </p>
                    <p className="text-xs text-secondary mt-1">
                      Prevents non-X-ray images from reaching the pneumonia classifier,
                      ensuring predictions are only made on valid input.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </RevealSection>
        </div>
      </section>

      {/* ─── Key Metrics Grid ─── */}
      <section className="mb-12">
        <RevealSection>
          <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Key Performance Metrics
          </h2>
        </RevealSection>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <MetricCard
            label="Test Accuracy"
            value={formatPercent(MODEL_METRICS.accuracy)}
            description="Overall correct predictions"
            icon={<Target className="h-5 w-5" />}
          />
          <MetricCard
            label="Sensitivity (Recall)"
            value={formatPercent(MODEL_METRICS.sensitivity)}
            description="Pneumonia detection rate — minimizing missed cases"
          />
          <MetricCard
            label="Specificity"
            value={formatPercent(MODEL_METRICS.specificity)}
            description="Normal identification rate"
          />
          <MetricCard
            label="F1 Score (Pneumonia)"
            value={formatPercent(MODEL_METRICS.f1_pneumonia)}
            description="Harmonic mean of precision and recall"
          />
          <MetricCard
            label="PPV (Precision)"
            value={formatPercent(MODEL_METRICS.ppv)}
            description="Positive predictive value"
          />
          <MetricCard
            label="NPV"
            value={formatPercent(MODEL_METRICS.npv)}
            description="Negative predictive value"
          />
        </div>

        {/* Sensitivity priority callout */}
        <RevealSection delay={200}>
          <div className="mt-5 flex items-start gap-3 rounded-xl bg-info-bg/60 backdrop-blur-sm border border-info-light p-4 transition-all duration-300 hover:shadow-md">
            <Info className="h-5 w-5 text-info shrink-0 mt-0.5" />
            <div className="text-sm text-info">
              <p className="font-medium">About Sensitivity Priority</p>
              <p className="mt-1 opacity-80">
                The model is optimized for high sensitivity ({formatPercent(MODEL_METRICS.sensitivity)})
                to minimize missed pneumonia cases (false negative rate: {formatPercent(MODEL_METRICS.false_negative_rate)}).
                This is clinically preferred for screening, as missing a case is more dangerous than a false alarm.
              </p>
            </div>
          </div>
        </RevealSection>
      </section>

      {/* ─── Confusion Matrix ─── */}
      <section className="mb-12">
        <RevealSection>
          <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            Confusion Matrix
          </h2>
        </RevealSection>

        <RevealSection delay={100}>
          <Card variant="default" className="overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
            <CardContent className="py-8">
              <ConfusionMatrix
                tn={cm.true_normal_pred_normal}
                fp={cm.true_normal_pred_pneumonia}
                fn={cm.true_pneumonia_pred_normal}
                tp={cm.true_pneumonia_pred_pneumonia}
              />
              <p className="text-center text-xs text-muted mt-5">
                Evaluated on {MODEL_METRICS.test_set_size} test images from the held-out test set
              </p>
            </CardContent>
          </Card>
        </RevealSection>
      </section>

      {/* ─── Per-Class Performance Table ─── */}
      <section className="mb-12">
        <RevealSection>
          <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Per-Class Performance
          </h2>
        </RevealSection>

        <PerformanceTable metrics={MODEL_METRICS.per_class} />
      </section>

      {/* ─── Training Process ─── */}
      <section className="mb-12">
        <RevealSection>
          <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Training Process
          </h2>
        </RevealSection>

        <RevealSection delay={100}>
          <Card variant="default" className="overflow-hidden">
            <CardContent className="py-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    Architecture
                  </h3>
                  <ul className="space-y-2 text-sm text-secondary">
                    <li className="flex justify-between">
                      <span>Base Model</span>
                      <span className="font-mono text-foreground font-medium">EfficientNet-B0</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Pre-training</span>
                      <span className="font-mono text-foreground font-medium">ImageNet</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Input Size</span>
                      <span className="font-mono text-foreground font-medium">224×224 RGB</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Normalization</span>
                      <span className="font-mono text-foreground font-medium">ImageNet stats</span>
                    </li>
                  </ul>
                </div>
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Training Details
                  </h3>
                  <ul className="space-y-2 text-sm text-secondary">
                    <li className="flex justify-between">
                      <span>Approach</span>
                      <span className="font-mono text-foreground font-medium">Transfer Learning</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Output</span>
                      <span className="font-mono text-foreground font-medium">2-class softmax</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Grad-CAM Layer</span>
                      <span className="font-mono text-foreground font-medium">features[-1]</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Checkpoint</span>
                      <span className="font-mono text-foreground font-medium">best_model.pth</span>
                    </li>
                  </ul>
                </div>
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Database className="h-4 w-4 text-primary" />
                    Data Split
                  </h3>
                  <ul className="space-y-2 text-sm text-secondary">
                    <li className="flex justify-between">
                      <span>Training</span>
                      <span className="font-mono text-foreground font-medium">{DATASET_INFO.trainSize.toLocaleString()} images</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Validation</span>
                      <span className="font-mono text-foreground font-medium">{DATASET_INFO.valSize} images</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Test</span>
                      <span className="font-mono text-foreground font-medium">{DATASET_INFO.testSize} images</span>
                    </li>
                    <li className="flex justify-between">
                      <span>Total</span>
                      <span className="font-mono text-foreground font-medium">{DATASET_INFO.totalImages.toLocaleString()} images</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </RevealSection>
      </section>

      {/* ─── Dataset Info ─── */}
      <section className="mb-16">
        <RevealSection>
          <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Training Dataset
          </h2>
        </RevealSection>

        <RevealSection delay={100}>
          <Card variant="default" className="overflow-hidden">
            <CardContent className="py-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-muted">Dataset</p>
                  <p className="font-semibold text-foreground">{DATASET_INFO.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted">Source</p>
                  <a
                    href={DATASET_INFO.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                  >
                    {DATASET_INFO.source}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div>
                  <p className="text-sm text-muted">Total Images</p>
                  <p className="font-semibold font-mono text-foreground">{DATASET_INFO.totalImages.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted">Image Type</p>
                  <p className="font-semibold text-foreground">{DATASET_INFO.imageType}</p>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-border grid grid-cols-3 gap-4 text-center">
                {[
                  { label: 'Train', value: DATASET_INFO.trainSize },
                  { label: 'Validation', value: DATASET_INFO.valSize },
                  { label: 'Test', value: DATASET_INFO.testSize },
                ].map(({ label, value }) => (
                  <div key={label} className="group">
                    <p className="text-2xl font-bold font-mono text-foreground transition-colors duration-200 group-hover:text-primary">
                      {value.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted">{label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </RevealSection>
      </section>
    </Container>
  );
}
