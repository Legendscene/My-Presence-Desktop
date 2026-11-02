import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, Layers, MonitorCog, Palette, Sparkles } from 'lucide-react';
import { useAppStore } from '../../lib/store';

// No Discord step: connecting is something the user does deliberately from the
// editor (Go Live), not something onboarding should ask for up front.
const STEPS = ['welcome', 'theme', 'customize', 'startup', 'finish'] as const;
type Step = typeof STEPS[number];

const stepLabels: Record<Step, string> = {
  welcome: 'Welcome',
  theme: 'Choose Theme',
  customize: 'Make it yours',
  startup: 'Startup Preference',
  finish: 'Done',
};

export function OnboardingWizard() {
  const onboardingOpen = useAppStore((s) => s.onboardingOpen);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const themes = useAppStore((s) => s.themes);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const setActiveTheme = useAppStore((s) => s.setActiveTheme);

  const [step, setStep] = useState<number>(0);
  const [selectedTheme, setSelectedTheme] = useState(themes[0]?.id || '');
  // Opt-in, not opt-out: registering a Windows startup item is a system change
  // the user did not ask for, and it is the thing that used to surprise people
  // by making the app appear on its own after a reboot.
  const [launchOnStartup, setLaunchOnStartup] = useState(false);
  const [appearance, setAppearance] = useState<'dark' | 'light' | 'oled'>('dark');

  const currentStep = STEPS[step];

  const next = () => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  };

  const prev = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const finish = () => {
    if (selectedTheme) setActiveTheme(selectedTheme);
    updateSettings((s) => ({ ...s, launchOnStartup, appearance }));
    void window.myPresenceDesktop?.setLaunchOnStartup?.(launchOnStartup).catch(() => {});
    completeOnboarding();
  };

  // Skipping must mark onboarding complete too — otherwise "Skip" would just
  // mean "ask me again next launch", which is exactly the complaint this screen
  // used to attract. It records the theme/appearance already chosen.
  const skip = () => {
    if (selectedTheme) setActiveTheme(selectedTheme);
    completeOnboarding();
  };

  return (
    <AnimatePresence>
      {onboardingOpen && (
        <motion.div
          className="onboarding-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="onboarding-modal"
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="onboarding-steps">
              {STEPS.map((s, i) => (
                <div
                  key={s}
                  className={`onboarding-step-dot ${i === step ? 'active' : i < step ? 'done' : ''}`}
                  title={stepLabels[s]}
                  aria-label={`${i + 1}. ${stepLabels[s]}`}
                >
                  {i < step ? <Check size={10} /> : <span>{i + 1}</span>}
                </div>
              ))}
            </div>

            <div className="onboarding-body">
              {currentStep === 'welcome' && <WelcomeStep />}
              {currentStep === 'theme' && (
                <ThemeStep themes={themes} selected={selectedTheme} onSelect={setSelectedTheme} />
              )}
              {currentStep === 'customize' && (
                <CustomizeStep appearance={appearance} onChange={setAppearance} />
              )}
              {currentStep === 'startup' && (
                <StartupStep enabled={launchOnStartup} onChange={setLaunchOnStartup} />
              )}
              {currentStep === 'finish' && <FinishStep />}
            </div>

            <div className="onboarding-footer">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {step > 0 ? (
                  <button className="ui-button ui-button--ghost" onClick={prev}>Back</button>
                ) : null}
                {/* Not on the final step: there "Get Started" already finishes, and
                    two ways to dismiss the same screen is just noise. */}
                {step < STEPS.length - 1 ? (
                  <button className="ui-button ui-button--ghost" onClick={skip}>Skip</button>
                ) : null}
              </div>
              {step < STEPS.length - 1 ? (
                <button className="ui-button ui-button--primary" onClick={next}>
                  Continue <ChevronRight size={14} />
                </button>
              ) : (
                <button className="ui-button ui-button--primary" onClick={finish}>
                  <Sparkles size={14} /> Get Started
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function WelcomeStep() {
  return (
    <div className="onboarding-step-content">
      <div className="onboarding-icon-large"><Sparkles size={32} /></div>
      <h2>Welcome to My Presence</h2>
      <p>Customize your Discord status with rich presence — show what you're playing, watching, or listening to with custom artwork, timers, and buttons.</p>
      <div className="onboarding-features">
        {['Custom Profiles', 'Rich Artwork', 'Live Preview', 'Fully Custom Themes'].map((f) => (
          <div key={f} className="onboarding-feature"><Check size={12} /><span>{f}</span></div>
        ))}
      </div>
    </div>
  );
}

function ThemeStep({ themes, selected, onSelect }: {
  themes: { id: string; name: string; backgroundType: string; solidColor: string; gradientStart: string; gradientEnd: string }[];
  selected: string; onSelect: (id: string) => void;
}) {
  return (
    <div className="onboarding-step-content">
      <div className="onboarding-icon-large"><Palette size={32} /></div>
      <h2>Choose Your Theme</h2>
      <p>Pick a look that fits your style. You can always change it later.</p>
      <div className="onboarding-theme-grid">
        {themes.map((theme) => {
          const bg = theme.backgroundType === 'gradient'
            ? `linear-gradient(135deg, ${theme.gradientStart}, ${theme.gradientEnd})`
            : theme.solidColor;
          return (
            <button
              key={theme.id}
              className={`onboarding-theme-card ${selected === theme.id ? 'selected' : ''}`}
              onClick={() => onSelect(theme.id)}
              style={{ background: bg }}
            >
              <span className="onboarding-theme-name">{theme.name}</span>
              {selected === theme.id && <span className="onboarding-theme-check"><Check size={12} /></span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CustomizeStep({ appearance, onChange }: {
  appearance: 'dark' | 'light' | 'oled';
  onChange: (v: 'dark' | 'light' | 'oled') => void;
}) {
  const options = [
    { value: 'dark' as const, label: 'Dark', hint: 'Comfortable default' },
    { value: 'light' as const, label: 'Light', hint: 'Bright and clean' },
    { value: 'oled' as const, label: 'OLED', hint: 'True black, saving power' }
  ];
  return (
    <div className="onboarding-step-content">
      <div className="onboarding-icon-large"><Layers size={32} /></div>
      <h2>Pick your look</h2>
      <p>You can fine-tune backgrounds, blur, accent colours and glass in the Background tab at any time.</p>
      <div className="onboarding-theme-grid">
        {options.map((option) => (
          <button
            key={option.value}
            className={`onboarding-theme-card ${appearance === option.value ? 'selected' : ''}`}
            onClick={() => onChange(option.value)}
            style={{ background: option.value === 'light' ? '#f5f5f0' : option.value === 'oled' ? '#000' : '#0b0b0f' }}
          >
            <span className="onboarding-theme-name">{option.label}</span>
            <span className="onboarding-theme-hint">{option.hint}</span>
            {appearance === option.value && <span className="onboarding-theme-check"><Check size={12} /></span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function StartupStep({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="onboarding-step-content">
      <div className="onboarding-icon-large"><MonitorCog size={32} /></div>
      <h2>Startup Preference</h2>
      <p>Start My Presence automatically when Windows starts?</p>
      <div className="onboarding-option">
        <label className="choice-card active" style={{ width: '100%' }}>
          <input type="radio" name="startup" checked={enabled} onChange={() => onChange(true)} className="choice-input" />
          <span className="radio-indicator" />
          <span className="choice-copy">
            <span className="choice-label">Enable</span>
            <span className="choice-description">Start with Windows, quietly in the system tray</span>
          </span>
        </label>
        <label className="choice-card" style={{ width: '100%' }}>
          <input type="radio" name="startup" checked={!enabled} onChange={() => onChange(false)} className="choice-input" />
          <span className="radio-indicator" />
          <span className="choice-copy">
            <span className="choice-label">Not Now</span>
            <span className="choice-description">I'll enable this later in Settings</span>
          </span>
        </label>
      </div>
      <p className="onboarding-note">
        My Presence lives in the system tray either way — close the window and it keeps running. You can change this
        any time in Settings → Startup.
      </p>
    </div>
  );
}

function FinishStep() {
  return (
    <div className="onboarding-step-content">
      <div className="onboarding-icon-large"><Check size={32} style={{ color: 'var(--green)' }} /></div>
      <h2>You're All Set!</h2>
      <p>Your presence is ready to go. Create profiles, customize themes, and show off what you're doing on Discord.</p>
    </div>
  );
}