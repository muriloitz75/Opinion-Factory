'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Upload,
  Download,
  Trash2,
  FileSearch,
  X,
  Loader2,
  Menu,
  FileUp,
  RotateCcw,
  LogOut,
} from 'lucide-react';
import { deleteTemplate, getTemplates, Template } from './actions/templates';
import { uploadTemplate, importFromGoogleDocs } from './actions/upload';
import { generateFilledDocx } from './actions/generate';
import { renderTemplate } from './actions/render';

export default function Home() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [formDataByTemplate, setFormDataByTemplate] = useState<Record<string, Record<string, string>>>({});
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [uploadTab, setUploadTab] = useState<'file' | 'gdocs'>('file');
  const [gdocsUrl, setGdocsUrl] = useState('');
  const [gdocsLoading, setGdocsLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const paperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getTemplates().then(data => {
      setTemplates(data);
      if (data.length > 0) applyTemplate(data[0], {});
      setLoading(false);
    });
  }, []);

  const applyTemplate = (template: Template, saved: Record<string, string>) => {
    setSelectedTemplate(template);
    const fd: Record<string, string> = {};
    template.variables.forEach(v => { fd[v] = saved[v] ?? ''; });
    setFormData(fd);
  };

  const handleSelectTemplate = (template: Template) => {
    applyTemplate(template, formDataByTemplate[template.filename] ?? {});
  };

  const handleInputChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (!selectedTemplate) return;
    setFormDataByTemplate(prev => ({
      ...prev,
      [selectedTemplate.filename]: { ...(prev[selectedTemplate.filename] ?? {}), [name]: value },
    }));
  };

  /** Converte valores de data de AAAA-MM-DD (padrão HTML) para DD/MM/AAAA (padrão brasileiro). */
  const formatValuesForOutput = (values: Record<string, string>): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(values)) {
      if (k.toLowerCase().includes('data') && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
        const [year, month, day] = v.split('-');
        out[k] = `${day}/${month}/${year}`;
      } else {
        out[k] = v;
      }
    }
    return out;
  };

  const applyMask = (name: string, value: string): string => {
    const digits = value.replace(/\D/g, '');
    const key = name.toLowerCase();
    if (key.includes('cnpj')) {
      const d = digits.slice(0, 14);
      if (d.length <= 2) return d;
      if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
      if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
      if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
      return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
    }
    if (key.includes('cpf')) {
      const d = digits.slice(0, 11);
      if (d.length <= 3) return d;
      if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
      if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
      return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
    }
    return value;
  };

  const handleClearFields = () => {
    if (!selectedTemplate) return;
    const cleared: Record<string, string> = {};
    selectedTemplate.variables.forEach(v => { cleared[v] = ''; });
    setFormData(cleared);
    setFormDataByTemplate(prev => ({ ...prev, [selectedTemplate.filename]: cleared }));
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplate || deleting) return;
    if (!window.confirm(`Deseja excluir o modelo "${selectedTemplate.name}"?`)) return;
    setDeleting(true);
    const result = await deleteTemplate(selectedTemplate.filename);
    if (!result.success) {
      alert('Erro ao excluir: ' + (result.error ?? 'Falha desconhecida'));
      setDeleting(false);
      return;
    }
    const updated = await getTemplates();
    setTemplates(updated);
    setFormDataByTemplate(prev => { const n = { ...prev }; delete n[selectedTemplate.filename]; return n; });
    if (updated.length > 0) applyTemplate(updated[0], {});
    else {
      setSelectedTemplate(null);
      setFormData({});
      setPreviewHtml('');
      setPageCount(0);
    }
    setDeleting(false);
  };

  const processFile = async (file: File) => {
    const allowed = file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.md');
    if (!allowed) {
      alert('Apenas arquivos .docx ou .md são aceitos.');
      return;
    }
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    const result = await uploadTemplate(fd);
    if (result.success) {
      const data = await getTemplates();
      setTemplates(data);
      const baseName = file.name.replace(/\.(docx|md)$/i, '');
      const uploaded = data.find(t => t.name === baseName);
      if (uploaded) applyTemplate(uploaded, {});
      setShowUploadModal(false);
    } else {
      alert('Erro ao carregar template: ' + result.error);
    }
    setUploading(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleGdocsImport = async () => {
    if (!gdocsUrl.trim() || gdocsLoading) return;
    setGdocsLoading(true);
    const result = await importFromGoogleDocs(gdocsUrl);
    if (result.success) {
      const data = await getTemplates();
      setTemplates(data);
      const imported = data.find(t => t.name === result.name);
      if (imported) applyTemplate(imported, {});
      setShowUploadModal(false);
      setGdocsUrl('');
    } else {
      alert(result.error);
    }
    setGdocsLoading(false);
  };

  // Estima contagem de páginas pela altura do conteúdo vs A4 (297mm @ 96dpi)
  const estimatePageCount = useCallback(() => {
    if (!paperRef.current) return;
    const A4_PX = 297 * 3.7795;
    const pages = Math.max(1, Math.ceil(paperRef.current.scrollHeight / A4_PX));
    setPageCount(pages);
  }, []);

  const triggerPreview = useCallback((filename: string, values: Record<string, string>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setRendering(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await renderTemplate(filename, values);
        if (result.html !== undefined) {
          setPreviewHtml(result.html);
          // Aguarda o DOM atualizar para medir a altura
          setTimeout(estimatePageCount, 80);
        }
      } catch (err) {
        console.error('Erro ao renderizar preview:', err);
      } finally {
        setRendering(false);
      }
    }, 700);
  }, [estimatePageCount]);

  useEffect(() => {
    if (!selectedTemplate) return;
    triggerPreview(selectedTemplate.filename, formatValuesForOutput(formData));
  }, [selectedTemplate, formData, triggerPreview]);

  const handleGenerate = async () => {
    if (!selectedTemplate || generating) return;
    setGenerating(true);
    const result = await generateFilledDocx(selectedTemplate.filename, formatValuesForOutput(formData));
    if (result.error || !result.base64) {
      alert('Erro ao gerar documento: ' + (result.error ?? 'Falha desconhecida'));
      setGenerating(false);
      return;
    }
    const binary = atob(result.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTemplate.name}.docx`;
    a.click();
    URL.revokeObjectURL(url);
    setGenerating(false);
  };

  const handleExit = () => {
    if (window.confirm('Deseja realmente sair da aplicação?')) {
      // Como é uma SPA local, podemos redirecionar ou simplesmente limpar o estado.
      // Para uma aplicação web real, isso seria um logout.
      window.location.href = 'about:blank';
    }
  };

  if (loading) return <div className="loading-state">Carregando templates…</div>;

  const hasVariables = selectedTemplate && selectedTemplate.variables.length > 0;

  return (
    <div className="app">

      {/* ── Header ── */}
      <header className="app-header">
        <div className="app-brand">
          <button
            className="btn-ghost sidebar-toggle"
            onClick={() => setSidebarOpen(o => !o)}
            aria-label="Abrir menu"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <FileText size={18} />
          <div className="app-brand-text">
            <span className="app-title">Opinion Factory</span>
            <span className="app-subtitle">Gerador de Pareceres Fiscais</span>
          </div>
        </div>
        <div className="app-header-actions">
          <button className="btn btn-outline" onClick={() => setShowUploadModal(true)}>
            <Upload size={14} /> Carregar Modelo
          </button>
          <button className="btn-icon btn-icon--ghost" onClick={handleExit} title="Sair da aplicação">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* ── Mobile Sidebar Overlay ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="sidebar-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Body ── */}
      <div className="app-body">

        {/* ── Sidebar ── */}
        <aside className={`sidebar${sidebarOpen ? ' sidebar--open' : ''}`}>

          {/* Template Selector */}
          <div className="sidebar-section">
            <p className="sidebar-label"><FileSearch size={14} /> Tipos de Parecer Fiscal</p>
            <div className="template-select-row">
              <div className="select-wrapper">
                <select
                  className="select-field"
                  value={selectedTemplate?.name ?? ''}
                  title={selectedTemplate ? `${selectedTemplate.name}${selectedTemplate.type === 'markdown' ? ' (.md)' : ''}` : ''}
                  onChange={e => {
                    const t = templates.find(t => t.name === e.target.value);
                    if (t) handleSelectTemplate(t);
                  }}
                >
                  {templates.map(t => (
                    <option key={t.name} value={t.name}>
                      {t.name}{t.type === 'markdown' ? ' (.md)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="btn-icon btn-icon--danger"
                onClick={handleDeleteTemplate}
                disabled={!selectedTemplate || deleting}
                title="Excluir modelo"
              >
                {deleting
                  ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                  : <Trash2 size={15} />}
              </button>
            </div>
          </div>

          {/* Form Fields */}
          <div className="sidebar-section-scroll">
            {hasVariables && (
              <div className="form-section-header">
                <span className="form-section-title">Variáveis</span>
                <button className="btn-text" onClick={handleClearFields}>
                  <RotateCcw size={11} /> Limpar
                </button>
              </div>
            )}
            <div className="form-container">
              {hasVariables ? (
                selectedTemplate.variables.map((v, idx) => (
                  <motion.div
                    key={v}
                    className="field-group"
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.02 }}
                  >
                    <label className="field-label">
                      {v.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim()}
                    </label>
                    <input
                      type={v.toLowerCase().includes('data') ? 'date' : 'text'}
                      className="input-field"
                      value={formData[v] ?? ''}
                      placeholder={
                        v.toLowerCase().includes('cnpj') ? '00.000.000/0000-00' :
                        v.toLowerCase().includes('cpf') ? '000.000.000-00' : undefined
                      }
                      onChange={e => handleInputChange(v, applyMask(v, e.target.value))}
                    />
                  </motion.div>
                ))
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <FileText size={22} />
                  </div>
                  <p className="empty-state-title">
                    {templates.length === 0 ? 'Nenhum modelo carregado' : 'Sem variáveis'}
                  </p>
                  <p className="empty-state-desc">
                    {templates.length === 0
                      ? 'Faça upload de um .docx ou .md com variáveis no formato {{variavel}} para começar.'
                      : 'Este modelo não possui variáveis editáveis.'}
                  </p>
                  {templates.length === 0 && (
                    <button className="btn btn-outline" style={{ marginTop: 8 }} onClick={() => setShowUploadModal(true)}>
                      <Upload size={13} /> Carregar Modelo
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer CTA */}
          <div className="sidebar-footer">
            <button
              className="btn btn-primary btn-full"
              onClick={handleGenerate}
              disabled={!selectedTemplate || generating}
            >
              {generating
                ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Gerando…</>
                : <><Download size={14} /> Gerar Parecer Fiscal </>}
            </button>
          </div>
        </aside>

        {/* ── Preview ── */}
        <div className="preview-workspace">
          <div className="preview-toolbar">
            <span className="preview-badge"><FileText size={11} /> Preview do Parecer Fiscal</span>
            <div className="preview-toolbar-right">
              {pageCount > 0 && !rendering && (
                <span className="preview-badge">
                  ~{pageCount} {pageCount === 1 ? 'página' : 'páginas'}
                </span>
              )}
              {rendering && (
                <span className="preview-badge" style={{ color: 'rgba(255,255,255,0.6)', gap: 6 }}>
                  <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Renderizando…
                </span>
              )}
            </div>
          </div>

          <div className="preview-container">
            {previewHtml ? (
              <div className="paper-page">
                <div
                  className="paper-content"
                  ref={paperRef}
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>
            ) : (
              <div className="preview-empty">
                <FileText size={32} style={{ opacity: 0.2, color: 'white' }} />
                <p>Selecione um modelo para visualizar o preview</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Upload Modal ── */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div
            className="upload-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowUploadModal(false)}
          >
            <motion.div
              className="upload-modal"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18 }}
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: 440 }}
            >
              <div className="upload-modal-header">
                <span className="upload-modal-title">Adicionar Template</span>
                <button className="btn-ghost" onClick={() => { setShowUploadModal(false); setUploadTab('file'); setGdocsUrl(''); }}><X size={15} /></button>
              </div>

              {/* Tabs */}
              <div className="upload-tabs">
                <button
                  className={`upload-tab${uploadTab === 'file' ? ' upload-tab--active' : ''}`}
                  onClick={() => setUploadTab('file')}
                >
                  <FileUp size={13} /> Arquivo
                </button>
                <button
                  className={`upload-tab${uploadTab === 'gdocs' ? ' upload-tab--active' : ''}`}
                  onClick={() => setUploadTab('gdocs')}
                >
                  <FileText size={13} /> Google Docs
                </button>
              </div>

              {uploadTab === 'file' ? (
                <>
                  <p className="upload-modal-desc">
                    Arquivo <strong>.docx</strong> ou <strong>.md</strong> com variáveis no formato{' '}
                    <code style={{ background: 'var(--surface-2)', padding: '1px 5px', borderRadius: 3 }}>{'{{variavel}}'}</code>.
                  </p>
                  <div
                    className={`drop-zone${dragOver ? ' drop-zone--active' : ''}`}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                  >
                    <input
                      type="file"
                      accept=".docx,.md"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                    <div className="drop-zone-content">
                      {uploading ? (
                        <>
                          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
                          <p className="drop-zone-hint">Processando…</p>
                        </>
                      ) : (
                        <>
                          <FileUp size={24} />
                          <div>
                            <p className="drop-zone-cta"><strong>Clique para selecionar</strong> ou arraste aqui</p>
                            <p className="drop-zone-hint">.docx ou .md</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <p className="upload-modal-desc">
                    Cole o link de compartilhamento de um <strong>Google Docs público</strong>.
                    O documento será importado como modelo .docx.
                  </p>
                  <div className="gdocs-input-row">
                    <input
                      type="url"
                      className="input-field"
                      placeholder="https://docs.google.com/document/d/..."
                      value={gdocsUrl}
                      onChange={e => setGdocsUrl(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleGdocsImport()}
                      disabled={gdocsLoading}
                      style={{ height: 44, fontSize: 13 }}
                    />
                    <button
                      className="btn btn-primary"
                      onClick={handleGdocsImport}
                      disabled={!gdocsUrl.trim() || gdocsLoading}
                      style={{ height: 44, flexShrink: 0 }}
                    >
                      {gdocsLoading
                        ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                        : <Download size={14} />}
                      {gdocsLoading ? 'Importando…' : 'Importar'}
                    </button>
                  </div>
                  <p className="upload-modal-hint">
                    O documento precisa estar compartilhado como &quot;Qualquer pessoa com o link pode visualizar&quot;.
                  </p>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
