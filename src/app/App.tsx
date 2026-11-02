import { AnimatePresence, motion } from 'framer-motion';
import { Activity, Images, PanelLeftOpen, Palette, Plus, Settings2, Wifi, WifiOff } from 'lucide-react';
import { Shell } from '../components/layout/Shell';
import { ErrorBoundary } from '../components/layout/ErrorBoundary';
import { PresenceEditor } from '../components/editor/PresenceEditor';
import { ProfilesPanel } from '../components/profiles/ProfilesPanel';
import { AssetsView } from '../components/settings/AssetsView';
import { SettingsView } from '../components/settings/SettingsView';
import { BackgroundView } from '../components/theme/BackgroundView';
import { BackgroundEngine } from '../components/theme/BackgroundEngine';
import { OnboardingWizard } from '../components/onboarding/OnboardingWizard';
import { LivePreview } from '../components/preview/LivePreview';
import { useAppStore, useProfile } from '../lib/store';

const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.16, ease: [0.16, 1, 0.3, 1] }
};

export function App() {
  const activeTab = useAppStore((state) => state.activeTab);
  const createProfile = useAppStore((state) => state.createProfile);
  const setActiveTab = useAppStore((state) => state.setActiveTab);
  const profile = useProfile();
  const connectionStatus = useAppStore((state) => state.connectionStatus);
  const statusMessage = useAppStore((state) => state.statusMessage);
  const sidebarCollapsed = useAppStore((state) => state.settings.sidebarCollapsed ?? false);
  const setSidebarCollapsed = useAppStore((state) => state.setSidebarCollapsed);
  // The preview is only meaningful next to the editor, which is the one tab
  // that shows a live activity card.
  const showPreview = activeTab === 'editor' && Boolean(profile);

  return (
    <ErrorBoundary>
      <BackgroundEngine />
      <Shell>
        <OnboardingWizard />
        <div className={`app-grid ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          <ProfilesPanel />

          {sidebarCollapsed && (
            <button
              className="sidebar-reveal"
              onClick={() => setSidebarCollapsed(false)}
              title="Show library (Ctrl+B)"
              aria-label="Show library panel"
            >
              <PanelLeftOpen size={15} />
              <span className="sidebar-reveal-text">Library</span>
            </button>
          )}

          <main className="workspace-panel">
            {activeTab !== 'editor' && (
              <WorkspaceViewHeader activeTab={activeTab} connectionStatus={connectionStatus} statusMessage={statusMessage} />
            )}
            <div className={`workspace-body ${activeTab === 'editor' ? 'editor-workspace-body' : 'page-workspace-body'}`}>
              <AnimatePresence mode="wait">
                <motion.div key={activeTab} {...pageTransition}>
                  {activeTab === 'editor' && (
                    profile ? (
                      <PresenceEditor profile={profile} />
                    ) : (
                      <div className="empty-state centered">
                        <div className="empty-state-icon">
                          <Activity size={24} />
                        </div>
                        <h3 className="empty-state-title">No Profiles</h3>
                        <p className="empty-state-description">
                          Create a profile to start configuring your Discord activity.
                        </p>
                        <div className="empty-state-action">
                          <button className="ui-button ui-button--primary ui-button--md" onClick={() => { createProfile(); setActiveTab('editor'); }}>
                            <Plus size={14} />
                            Create First Profile
                          </button>
                        </div>
                      </div>
                    )
                  )}
                  {activeTab === 'assets' ? <AssetsView /> : null}
                  {activeTab === 'background' ? <BackgroundView /> : null}
                  {activeTab === 'settings' ? <SettingsView /> : null}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>

          {showPreview && profile ? (
            <AnimatePresence mode="wait">
              <motion.div
                key="preview"
                className="preview-column"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              >
                <LivePreview profile={profile} />
              </motion.div>
            </AnimatePresence>
          ) : null}
        </div>
      </Shell>
    </ErrorBoundary>
  );
}

function WorkspaceViewHeader({
  activeTab,
  connectionStatus,
  statusMessage
}: {
  activeTab: 'assets' | 'background' | 'settings';
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
  statusMessage: string;
}) {
  const content = {
    assets: { icon: Images, eyebrow: 'Workspace', title: 'Asset library', description: 'Keep your artwork ready for every presence.' },
    background: { icon: Palette, eyebrow: 'Workspace', title: 'Background studio', description: 'Shape the atmosphere of your workspace.' },
    settings: { icon: Settings2, eyebrow: 'Workspace', title: 'Settings', description: 'Tune MY Presence to fit the way you work.' }
  }[activeTab];
  const Icon = content.icon;
  const isConnected = connectionStatus === 'connected';
  const isConnecting = connectionStatus === 'connecting';

  return (
    <header className="workspace-view-header">
      <div className="workspace-view-heading">
        <div className="workspace-view-icon"><Icon size={20} /></div>
        <div>
          <p className="eyebrow">{content.eyebrow}</p>
          <h1>{content.title}</h1>
          <p>{content.description}</p>
        </div>
      </div>
      <div className={`connection-badge ${isConnected ? 'connected' : ''} ${isConnecting ? 'connecting' : ''}`}>
        {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
        <span>{isConnected ? 'Discord connected' : isConnecting ? 'Connecting…' : statusMessage || 'Discord offline'}</span>
      </div>
    </header>
  );
}
