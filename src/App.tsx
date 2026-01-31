import { useEffect, useState, useCallback } from 'react';
import { useStore } from './store';
import { Layout } from './components/Layout';
import { Editor } from './components/editor/Editor';
import { VaultPicker } from './components/modals/VaultPicker';
import { CommandPalette } from './components/modals/CommandPalette';
import { QuickSwitcher } from './components/modals/QuickSwitcher';
import { SettingsModal } from './components/modals/SettingsModal';
import { TemplatePickerModal } from './components/modals/TemplatePickerModal';

function App() {
  // Select individual values to avoid new object reference on each render
  const isOpen = useStore((state) => state.isOpen);
  const vaultPickerOpen = useStore((state) => state.vaultPickerOpen);
  const openVaultPicker = useStore((state) => state.openVaultPicker);

  // Template picker state (not in store yet)
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

  // Show vault picker if no vault is open
  useEffect(() => {
    if (!isOpen && !vaultPickerOpen) {
      openVaultPicker();
    }
  }, [isOpen, vaultPickerOpen, openVaultPicker]);

  const handleTemplateInsert = useCallback((content: string) => {
    // TODO: Insert content into active editor
    console.log('Template content to insert:', content);
  }, []);

  return (
    <>
      <Layout>
        <Editor />
      </Layout>

      {/* Modals */}
      <VaultPicker />
      <CommandPalette />
      <QuickSwitcher />
      <SettingsModal />
      <TemplatePickerModal
        isOpen={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        onInsert={handleTemplateInsert}
      />
    </>
  );
}

export default App;
