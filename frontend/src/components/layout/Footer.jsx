import { Activity, ExternalLink } from 'lucide-react';
import GithubIcon from '@/components/ui/GithubIcon';
import { Link } from 'react-router-dom';

/**
 * Application footer with project links and credits.
 * @see docs/frontend/components.md — Footer
 */
export default function Footer() {
  return (
    <footer className="relative mt-auto">
      {/* Gradient top border */}
      <div className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      <div className="glass-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Brand */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-gradient-to-br from-primary to-info flex items-center justify-center">
                <Activity className="h-4 w-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-sm font-semibold gradient-text">DiagnoVision</span>
            </div>

            {/* Links */}
            <div className="flex items-center gap-6 text-sm text-secondary">
              <Link to="/model" className="hover:text-primary transition-colors">
                Model Info
              </Link>
              <Link to="/about" className="hover:text-primary transition-colors">
                About
              </Link>
              <a
                href="https://github.com/Dhruv-Adhiya/DiagnoVision"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-primary transition-colors"
              >
                <GithubIcon className="h-4 w-4" />
                GitHub
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* Credits */}
            <p className="text-xs text-muted text-center md:text-right">
              © {new Date().getFullYear()} DiagnoVision · Academic Research Project
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
