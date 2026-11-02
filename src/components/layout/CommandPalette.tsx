import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, CopyPlus, Image, Paintbrush, Play, Search, Settings2, Trash2, Wifi, WifiOff } from 'lucide-react';

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: typeof Activity;
  shortcut?: string;
  action: string;
  group: string;
}

const commands: Command[] = [
  { id: 'create', label: 'Create Profile', icon: CopyPlus, action: 'create-profile', group: 'Profiles', shortcut: '⌘N' },
  { id: 'duplicate', label: 'Duplicate Profile', icon: CopyPlus, action: 'duplicate-profile', group: 'Profiles' },
  { id: 'delete', label: 'Delete Profile', icon: Trash2, action: 'delete-profile', group: 'Profiles' },
  { id: 'editor', label: 'Open Studio', icon: Activity, description: 'Edit presence details', action: 'switch-editor', group: 'Navigate' },
  { id: 'assets', label: 'Open Assets', icon: Image, description: 'Manage image library', action: 'switch-assets', group: 'Navigate' },
  { id: 'settings', label: 'Open Settings', icon: Settings2, description: 'App preferences', action: 'switch-settings', group: 'Navigate' },
  { id: 'nav-background', label: 'Open Background', icon: Paintbrush, description: 'Customize background', action: 'switch-background', group: 'Navigate' },
  { id: 'toggle', label: 'Toggle Presence', icon: Play, description: 'Start or stop live presence', action: 'toggle-presence', group: 'Actions' },
  { id: 'connect', label: 'Connect Discord', icon: Wifi, action: 'connect-discord', group: 'Actions' },
  { id: 'disconnect', label: 'Disconnect Discord', icon: WifiOff, action: 'disconnect-discord', group: 'Actions' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onAction: (action: string) => void;
}

export function CommandPalette({ open, onClose, onAction }: Props) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return commands;
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.description?.toLowerCase().includes(q) ||
        cmd.group.toLowerCase().includes(q)
    );
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      const timer = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' && filtered[selectedIndex]) { onAction(filtered[selectedIndex].action); return; }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [open, filtered, selectedIndex, onAction, onClose]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const item = el.querySelector('.cmd-item.highlighted') as HTMLElement | null;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const groups = useMemo(() => {
    const map = new Map<string, Command[]>();
    filtered.forEach((cmd) => {
      const g = map.get(cmd.group) || [];
      g.push(cmd);
      map.set(cmd.group, g);
    });
    return Array.from(map.entries());
  }, [filtered]);

  // Index of each command in the flat list, so the highlighted row matches the
  // keyboard cursor even when the list is split across groups.
  const indexById = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((cmd, i) => map.set(cmd.id, i));
    return map;
  }, [filtered]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="cmd-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          onClick={onClose}
        >
          <motion.div
            className="cmd-modal"
            initial={{ opacity: 0, scale: 0.96, y: -24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -16 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cmd-input-shell">
              <Search size={18} className="cmd-search-icon" />
              <input
                ref={inputRef}
                className="cmd-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search commands..."
              />
              <kbd className="cmd-input-hint">ESC</kbd>
            </div>
            <div className="cmd-list" ref={listRef}>
              {groups.map(([group, cmds]) => (
                <div key={group} className="cmd-group">
                  <div className="cmd-group-label">{group}</div>
                  {cmds.map((cmd) => {
                    const globalIdx = indexById.get(cmd.id) ?? -1;
                    const Icon = cmd.icon;
                    return (
                      <div
                        key={cmd.id}
                        className={`cmd-item ${globalIdx === selectedIndex ? 'highlighted' : ''}`}
                        onClick={() => onAction(cmd.action)}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                      >
                        <div className="cmd-item-icon">
                          <Icon size={16} />
                        </div>
                        <div className="cmd-item-text">
                          <div className="cmd-item-label">{cmd.label}</div>
                          {cmd.description && <div className="cmd-item-desc">{cmd.description}</div>}
                        </div>
                        {cmd.shortcut && (
                          <div className="cmd-item-shortcut">
                            <kbd>{cmd.shortcut}</kbd>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="cmd-empty">No commands found</div>
              )}
            </div>
            <div className="cmd-footer">
              <span className="cmd-footer-item"><kbd>↑↓</kbd> Navigate</span>
              <span className="cmd-footer-item"><kbd>↵</kbd> Select</span>
              <span className="cmd-footer-item"><kbd>ESC</kbd> Close</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
