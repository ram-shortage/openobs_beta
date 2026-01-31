import { useState, useCallback } from 'react';
import {
  Type,
  FileText,
  Palette,
  Keyboard,
  Monitor,
  Moon,
  Sun,
  Check,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useStore } from '../../store';
import { useSettings, type AppSettings } from '../../hooks/useSettings';
import { formatHotkey, commandRegistry } from '../../lib/commands';
import { cn } from '../../lib/utils';

// ============================================================================
// Types
// ============================================================================

type SettingsSection = 'editor' | 'files' | 'appearance' | 'hotkeys';

interface SectionConfig {
  id: SettingsSection;
  label: string;
  icon: React.ReactNode;
}

// ============================================================================
// Constants
// ============================================================================

const SECTIONS: SectionConfig[] = [
  { id: 'editor', label: 'Editor', icon: <Type className="h-4 w-4" /> },
  { id: 'files', label: 'Files', icon: <FileText className="h-4 w-4" /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette className="h-4 w-4" /> },
  { id: 'hotkeys', label: 'Hotkeys', icon: <Keyboard className="h-4 w-4" /> },
];

const ACCENT_COLORS = [
  { name: 'Purple', value: '#7c3aed' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#10b981' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Yellow', value: '#eab308' },
];

// ============================================================================
// Main Component
// ============================================================================

export function SettingsModal() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('editor');

  const settingsOpen = useStore((state) => state.settingsOpen);
  const closeSettings = useStore((state) => state.closeSettings);

  const { settings, updateSetting, resetToDefaults, isLoading } = useSettings();

  const handleClose = useCallback(() => {
    closeSettings();
  }, [closeSettings]);

  return (
    <Modal
      isOpen={settingsOpen}
      onClose={handleClose}
      title="Settings"
      size="xl"
    >
      <div className="flex -mx-6 -mb-4 h-[500px]">
        {/* Sidebar */}
        <nav className="w-48 border-r border-background-modifier-border py-2 shrink-0">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-2 text-sm',
                'transition-colors text-left',
                activeSection === section.id
                  ? 'bg-background-modifier-active text-text-normal'
                  : 'text-text-muted hover:text-text-normal hover:bg-background-modifier-hover'
              )}
              onClick={() => setActiveSection(section.id)}
            >
              {section.icon}
              {section.label}
            </button>
          ))}

          <div className="border-t border-background-modifier-border mt-2 pt-2 px-4">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-text-muted"
              onClick={resetToDefaults}
            >
              Reset to defaults
            </Button>
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin h-6 w-6 border-2 border-interactive-accent border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              {activeSection === 'editor' && (
                <EditorSettings settings={settings} updateSetting={updateSetting} />
              )}
              {activeSection === 'files' && (
                <FilesSettings settings={settings} updateSetting={updateSetting} />
              )}
              {activeSection === 'appearance' && (
                <AppearanceSettings settings={settings} updateSetting={updateSetting} />
              )}
              {activeSection === 'hotkeys' && (
                <HotkeysSettings settings={settings} updateSetting={updateSetting} />
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// Settings Section Components
// ============================================================================

interface SettingsSectionProps {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(
    section: K,
    key: keyof AppSettings[K],
    value: AppSettings[K][keyof AppSettings[K]]
  ) => Promise<void>;
}

function EditorSettings({ settings, updateSetting }: SettingsSectionProps) {
  return (
    <div className="space-y-6">
      <SettingsGroup title="Font">
        <SettingItem
          label="Font Family"
          description="The font used in the editor"
        >
          <Input
            value={settings.editor.fontFamily}
            onChange={(e) => updateSetting('editor', 'fontFamily', e.target.value)}
            className="w-64"
          />
        </SettingItem>

        <SettingItem
          label="Font Size"
          description="Base font size in pixels"
        >
          <Input
            type="number"
            min={10}
            max={24}
            value={settings.editor.fontSize}
            onChange={(e) => updateSetting('editor', 'fontSize', parseInt(e.target.value, 10))}
            className="w-20"
          />
        </SettingItem>

        <SettingItem
          label="Line Height"
          description="Line height multiplier"
        >
          <Input
            type="number"
            min={1}
            max={3}
            step={0.1}
            value={settings.editor.lineHeight}
            onChange={(e) => updateSetting('editor', 'lineHeight', parseFloat(e.target.value))}
            className="w-20"
          />
        </SettingItem>
      </SettingsGroup>

      <SettingsGroup title="Behavior">
        <ToggleSetting
          label="Vim Mode"
          description="Enable Vim keybindings in the editor"
          checked={settings.editor.vimMode}
          onChange={(checked) => updateSetting('editor', 'vimMode', checked)}
        />

        <ToggleSetting
          label="Word Wrap"
          description="Wrap long lines to fit the editor width"
          checked={settings.editor.wordWrap}
          onChange={(checked) => updateSetting('editor', 'wordWrap', checked)}
        />

        <ToggleSetting
          label="Line Numbers"
          description="Show line numbers in the editor"
          checked={settings.editor.lineNumbers}
          onChange={(checked) => updateSetting('editor', 'lineNumbers', checked)}
        />

        <ToggleSetting
          label="Highlight Active Line"
          description="Highlight the current line"
          checked={settings.editor.highlightActiveLine}
          onChange={(checked) => updateSetting('editor', 'highlightActiveLine', checked)}
        />

        <ToggleSetting
          label="Auto-close Brackets"
          description="Automatically close brackets, quotes, etc."
          checked={settings.editor.autoCloseBrackets}
          onChange={(checked) => updateSetting('editor', 'autoCloseBrackets', checked)}
        />

        <ToggleSetting
          label="Spell Check"
          description="Enable spell checking"
          checked={settings.editor.spellCheck}
          onChange={(checked) => updateSetting('editor', 'spellCheck', checked)}
        />
      </SettingsGroup>

      <SettingsGroup title="Indentation">
        <SettingItem
          label="Tab Size"
          description="Number of spaces per tab"
        >
          <select
            value={settings.editor.tabSize}
            onChange={(e) => updateSetting('editor', 'tabSize', parseInt(e.target.value, 10))}
            className={cn(
              'h-9 px-3 rounded-md text-sm',
              'bg-background-primary border border-background-modifier-border',
              'text-text-normal',
              'focus:outline-none focus:ring-2 focus:ring-interactive-accent'
            )}
          >
            <option value={2}>2 spaces</option>
            <option value={4}>4 spaces</option>
            <option value={8}>8 spaces</option>
          </select>
        </SettingItem>
      </SettingsGroup>
    </div>
  );
}

function FilesSettings({ settings, updateSetting }: SettingsSectionProps) {
  return (
    <div className="space-y-6">
      <SettingsGroup title="Auto-save">
        <ToggleSetting
          label="Auto-save"
          description="Automatically save notes after changes"
          checked={settings.files.autoSave}
          onChange={(checked) => updateSetting('files', 'autoSave', checked)}
        />

        <SettingItem
          label="Auto-save Delay"
          description="Delay in milliseconds before auto-saving"
        >
          <Input
            type="number"
            min={500}
            max={10000}
            step={500}
            value={settings.files.autoSaveDelay}
            onChange={(e) => updateSetting('files', 'autoSaveDelay', parseInt(e.target.value, 10))}
            className="w-24"
            disabled={!settings.files.autoSave}
          />
        </SettingItem>
      </SettingsGroup>

      <SettingsGroup title="New Files">
        <SettingItem
          label="Default Location"
          description="Where to create new notes"
        >
          <Input
            value={settings.files.defaultNoteLocation}
            onChange={(e) => updateSetting('files', 'defaultNoteLocation', e.target.value)}
            placeholder="/"
            className="w-48"
          />
        </SettingItem>

        <SettingItem
          label="File Extension"
          description="Extension for new note files"
        >
          <select
            value={settings.files.newFileFormat}
            onChange={(e) => updateSetting('files', 'newFileFormat', e.target.value as 'md' | 'markdown')}
            className={cn(
              'h-9 px-3 rounded-md text-sm',
              'bg-background-primary border border-background-modifier-border',
              'text-text-normal',
              'focus:outline-none focus:ring-2 focus:ring-interactive-accent'
            )}
          >
            <option value="md">.md</option>
            <option value="markdown">.markdown</option>
          </select>
        </SettingItem>
      </SettingsGroup>

      <SettingsGroup title="Deletion">
        <ToggleSetting
          label="Move to Trash"
          description="Move deleted files to system trash instead of permanent deletion"
          checked={settings.files.trashDeletedFiles}
          onChange={(checked) => updateSetting('files', 'trashDeletedFiles', checked)}
        />
      </SettingsGroup>
    </div>
  );
}

function AppearanceSettings({ settings, updateSetting }: SettingsSectionProps) {
  return (
    <div className="space-y-6">
      <SettingsGroup title="Theme">
        <div className="flex gap-3">
          <ThemeButton
            label="Light"
            icon={<Sun className="h-5 w-5" />}
            selected={settings.appearance.theme === 'light'}
            onClick={() => updateSetting('appearance', 'theme', 'light')}
          />
          <ThemeButton
            label="Dark"
            icon={<Moon className="h-5 w-5" />}
            selected={settings.appearance.theme === 'dark'}
            onClick={() => updateSetting('appearance', 'theme', 'dark')}
          />
          <ThemeButton
            label="System"
            icon={<Monitor className="h-5 w-5" />}
            selected={settings.appearance.theme === 'system'}
            onClick={() => updateSetting('appearance', 'theme', 'system')}
          />
        </div>
      </SettingsGroup>

      <SettingsGroup title="Accent Color">
        <div className="flex flex-wrap gap-2">
          {ACCENT_COLORS.map((color) => (
            <button
              key={color.value}
              className={cn(
                'w-8 h-8 rounded-full transition-transform',
                'hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2',
                'focus:ring-offset-background-primary',
                settings.appearance.accentColor === color.value && 'ring-2 ring-white scale-110'
              )}
              style={{ backgroundColor: color.value }}
              onClick={() => updateSetting('appearance', 'accentColor', color.value)}
              title={color.name}
            >
              {settings.appearance.accentColor === color.value && (
                <Check className="h-4 w-4 text-white mx-auto" />
              )}
            </button>
          ))}
        </div>
      </SettingsGroup>

      <SettingsGroup title="Interface">
        <SettingItem label="Font Size" description="UI font size">
          <select
            value={settings.appearance.fontSize}
            onChange={(e) => updateSetting('appearance', 'fontSize', e.target.value as 'small' | 'medium' | 'large')}
            className={cn(
              'h-9 px-3 rounded-md text-sm',
              'bg-background-primary border border-background-modifier-border',
              'text-text-normal',
              'focus:outline-none focus:ring-2 focus:ring-interactive-accent'
            )}
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </SettingItem>

        <ToggleSetting
          label="Compact Mode"
          description="Reduce padding and spacing throughout the UI"
          checked={settings.appearance.compactMode}
          onChange={(checked) => updateSetting('appearance', 'compactMode', checked)}
        />

        <ToggleSetting
          label="Show Status Bar"
          description="Display the status bar at the bottom"
          checked={settings.appearance.showStatusBar}
          onChange={(checked) => updateSetting('appearance', 'showStatusBar', checked)}
        />

        <ToggleSetting
          label="Show Tab Bar"
          description="Display tabs for open files"
          checked={settings.appearance.showTabBar}
          onChange={(checked) => updateSetting('appearance', 'showTabBar', checked)}
        />
      </SettingsGroup>
    </div>
  );
}

function HotkeysSettings(_props: SettingsSectionProps) {
  const commands = commandRegistry.getAll().filter((cmd) => cmd.hotkey);

  return (
    <div className="space-y-6">
      <p className="text-sm text-text-muted">
        Configure keyboard shortcuts. Click on a shortcut to change it.
      </p>

      <div className="space-y-1">
        {commands.map((command) => (
          <div
            key={command.id}
            className={cn(
              'flex items-center justify-between py-2 px-3 -mx-3 rounded-md',
              'hover:bg-background-modifier-hover'
            )}
          >
            <div>
              <div className="text-sm text-text-normal">{command.label}</div>
              {command.description && (
                <div className="text-xs text-text-muted">{command.description}</div>
              )}
            </div>
            <kbd
              className={cn(
                'px-2 py-1 rounded text-xs font-mono',
                'bg-background-secondary text-text-muted',
                'border border-background-modifier-border'
              )}
            >
              {command.hotkey ? formatHotkey(command.hotkey) : 'None'}
            </kbd>
          </div>
        ))}
      </div>

      <p className="text-xs text-text-faint">
        Custom hotkey editing coming soon. For now, you can see the default hotkeys above.
      </p>
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

interface SettingsGroupProps {
  title: string;
  children: React.ReactNode;
}

function SettingsGroup({ title, children }: SettingsGroupProps) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

interface SettingItemProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

function SettingItem({ label, description, children }: SettingItemProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm text-text-normal">{label}</div>
        {description && (
          <div className="text-xs text-text-muted">{description}</div>
        )}
      </div>
      {children}
    </div>
  );
}

interface ToggleSettingProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleSetting({ label, description, checked, onChange }: ToggleSettingProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm text-text-normal">{label}</div>
        {description && (
          <div className="text-xs text-text-muted">{description}</div>
        )}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full',
          'transition-colors duration-200 ease-in-out',
          'focus:outline-none focus:ring-2 focus:ring-interactive-accent focus:ring-offset-2',
          'focus:ring-offset-background-primary',
          checked ? 'bg-interactive-accent' : 'bg-background-modifier-border'
        )}
        onClick={() => onChange(!checked)}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-4 w-4 rounded-full',
            'bg-white shadow transform ring-0',
            'transition duration-200 ease-in-out',
            checked ? 'translate-x-4' : 'translate-x-0.5',
            'mt-0.5'
          )}
        />
      </button>
    </div>
  );
}

interface ThemeButtonProps {
  label: string;
  icon: React.ReactNode;
  selected: boolean;
  onClick: () => void;
}

function ThemeButton({ label, icon, selected, onClick }: ThemeButtonProps) {
  return (
    <button
      className={cn(
        'flex flex-col items-center gap-2 p-4 rounded-lg',
        'border-2 transition-colors',
        selected
          ? 'border-interactive-accent bg-interactive-accent/10'
          : 'border-background-modifier-border hover:border-text-muted'
      )}
      onClick={onClick}
    >
      {icon}
      <span className="text-sm">{label}</span>
    </button>
  );
}
