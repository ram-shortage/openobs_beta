import { useState, useEffect, useCallback } from 'react';
import { FileText, Search, Check, X, RefreshCw, Copy } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { Modal, ModalFooter } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Spinner } from '../ui/Spinner';
import { cn } from '../../lib/utils';

/**
 * Template info from the Rust backend
 */
export interface TemplateInfo {
  name: string;
  path: string;
  description?: string;
  content: string;
}

/**
 * Template variable for substitution
 */
export interface TemplateVariable {
  name: string;
  value: string;
  placeholder?: string;
}

interface TemplatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (content: string) => void;
}

export function TemplatePickerModal({ isOpen, onClose, onInsert }: TemplatePickerModalProps) {
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<TemplateInfo[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variables, setVariables] = useState<Map<string, string>>(new Map());
  const [previewContent, setPreviewContent] = useState<string>('');

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await invoke<TemplateInfo[]>('get_templates');
      setTemplates(response);
      setFilteredTemplates(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch templates');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load templates when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
      setSelectedTemplate(null);
      setSearchQuery('');
      setVariables(new Map());
      setPreviewContent('');
    }
  }, [isOpen, fetchTemplates]);

  // Filter templates based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTemplates(templates);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredTemplates(
        templates.filter(
          (t) =>
            t.name.toLowerCase().includes(query) ||
            t.description?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, templates]);

  // Extract variables from template content
  const extractVariables = useCallback((content: string): string[] => {
    const regex = /\{\{(\w+)\}\}/g;
    const vars: Set<string> = new Set();
    let match;
    while ((match = regex.exec(content)) !== null) {
      vars.add(match[1]);
    }
    return Array.from(vars);
  }, []);

  // Update preview when template or variables change
  useEffect(() => {
    if (!selectedTemplate) {
      setPreviewContent('');
      return;
    }

    let content = selectedTemplate.content;

    // Replace variables
    variables.forEach((value, key) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      content = content.replace(regex, value || `{{${key}}}`);
    });

    setPreviewContent(content);
  }, [selectedTemplate, variables]);

  // Handle template selection
  const handleSelectTemplate = useCallback((template: TemplateInfo) => {
    setSelectedTemplate(template);

    // Extract and initialize variables
    const vars = extractVariables(template.content);
    const newVariables = new Map<string, string>();

    // Pre-fill date variable if present
    const today = new Date().toISOString().split('T')[0];
    vars.forEach((v) => {
      if (v.toLowerCase() === 'date' || v.toLowerCase() === 'today') {
        newVariables.set(v, today);
      } else if (v.toLowerCase() === 'title') {
        newVariables.set(v, '');
      } else {
        newVariables.set(v, '');
      }
    });

    setVariables(newVariables);
  }, [extractVariables]);

  // Handle variable change
  const handleVariableChange = useCallback((name: string, value: string) => {
    setVariables((prev) => {
      const newVars = new Map(prev);
      newVars.set(name, value);
      return newVars;
    });
  }, []);

  // Apply template
  const handleApply = useCallback(async () => {
    if (!selectedTemplate) return;

    setIsLoading(true);

    try {
      // Convert Map to object for Rust
      const varsObj: Record<string, string> = {};
      variables.forEach((value, key) => {
        varsObj[key] = value;
      });

      const result = await invoke<string>('apply_template', {
        name: selectedTemplate.name,
        variables: varsObj,
      });

      onInsert(result);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply template');
    } finally {
      setIsLoading(false);
    }
  }, [selectedTemplate, variables, onInsert, onClose]);

  const handleClose = useCallback(() => {
    setSelectedTemplate(null);
    setSearchQuery('');
    setError(null);
    onClose();
  }, [onClose]);

  const templateVariables = selectedTemplate
    ? extractVariables(selectedTemplate.content)
    : [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Insert Template"
      size="lg"
    >
      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="p-1 hover:bg-red-500/20 rounded">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex gap-4 min-h-[400px]">
        {/* Template list */}
        <div className="w-1/2 flex flex-col border-r border-background-modifier-border pr-4">
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
            className="mb-3"
          />

          {isLoading && templates.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <Spinner size="md" label="Loading templates..." />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <FileText className="h-12 w-12 text-text-muted mb-3" />
              <p className="text-sm text-text-muted">
                {templates.length === 0 ? 'No templates found' : 'No matching templates'}
              </p>
              {templates.length === 0 && (
                <p className="text-xs text-text-faint mt-1">
                  Create templates in your vault's templates folder
                </p>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-1">
              {filteredTemplates.map((template) => (
                <button
                  key={template.path}
                  onClick={() => handleSelectTemplate(template)}
                  className={cn(
                    'w-full flex items-start gap-3 p-3 rounded-md text-left',
                    'transition-colors',
                    selectedTemplate?.path === template.path
                      ? 'bg-interactive-accent/20 border border-interactive-accent'
                      : 'hover:bg-background-modifier-hover border border-transparent'
                  )}
                >
                  <FileText className="h-5 w-5 text-text-muted shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-normal truncate">
                      {template.name}
                    </p>
                    {template.description && (
                      <p className="text-xs text-text-faint truncate mt-0.5">
                        {template.description}
                      </p>
                    )}
                  </div>
                  {selectedTemplate?.path === template.path && (
                    <Check className="h-4 w-4 text-interactive-accent shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="pt-3 mt-3 border-t border-background-modifier-border">
            <button
              onClick={fetchTemplates}
              className={cn(
                'flex items-center gap-2 text-xs text-text-muted',
                'hover:text-text-normal transition-colors',
                isLoading && 'opacity-50'
              )}
              disabled={isLoading}
            >
              <RefreshCw className={cn('h-3 w-3', isLoading && 'animate-spin')} />
              Refresh templates
            </button>
          </div>
        </div>

        {/* Preview and variables */}
        <div className="w-1/2 flex flex-col">
          {selectedTemplate ? (
            <>
              {/* Variables form */}
              {templateVariables.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-text-normal mb-2">Variables</h3>
                  <div className="space-y-2">
                    {templateVariables.map((varName) => (
                      <Input
                        key={varName}
                        label={varName}
                        placeholder={`Enter ${varName}...`}
                        value={variables.get(varName) || ''}
                        onChange={(e) => handleVariableChange(varName, e.target.value)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Preview */}
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-text-normal">Preview</h3>
                  <button
                    onClick={() => navigator.clipboard.writeText(previewContent)}
                    className="p-1 rounded hover:bg-background-modifier-hover text-text-muted"
                    aria-label="Copy preview"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
                <div
                  className={cn(
                    'flex-1 overflow-auto p-3 rounded-md',
                    'bg-background-secondary border border-background-modifier-border',
                    'text-sm text-text-normal font-mono whitespace-pre-wrap'
                  )}
                >
                  {previewContent || selectedTemplate.content}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <FileText className="h-12 w-12 text-text-muted mb-3" />
              <p className="text-sm text-text-muted">Select a template to preview</p>
            </div>
          )}
        </div>
      </div>

      <ModalFooter>
        <Button variant="secondary" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleApply}
          disabled={!selectedTemplate || isLoading}
          isLoading={isLoading}
        >
          Insert Template
        </Button>
      </ModalFooter>
    </Modal>
  );
}
