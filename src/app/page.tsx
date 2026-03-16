'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Upload,
  Download,
  CheckCircle,
  FileSearch,
  ChevronDown,
  X,
  Zap
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { getTemplates, Template } from './actions/templates';
import { uploadTemplate } from './actions/upload';
import { extractVariables, replaceVariables, TemplateVariable } from '@/lib/parser';

export default function Home() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [paginatedContent, setPaginatedContent] = useState<string[]>([]);
  const measurementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const data = await getTemplates();
      setTemplates(data);
      if (data.length > 0) {
        handleSelectTemplate(data[0]);
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    const extracted = extractVariables(template.content);

    // Injetar variáveis obrigatórias para a Assinatura/Cabeçalho se não existirem
    const mandatory: TemplateVariable[] = [
      { name: 'Parecer', label: 'Número do Parecer', type: 'text' },
      { name: 'Data', label: 'Data da Assinatura', type: 'date' }
    ];

    mandatory.forEach(m => {
      if (!extracted.find(v => v.name === m.name)) {
        extracted.push(m);
      }
    });

    setVariables(extracted);

    const newFormData: Record<string, string> = {};
    extracted.forEach((v: TemplateVariable) => {
      newFormData[v.name] = formData[v.name] || '';
    });
    setFormData(newFormData);
  };

  const handleInputChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    const result = await uploadTemplate(formData);
    if (result.success) {
      const data = await getTemplates();
      setTemplates(data);
      alert('Template carregado com sucesso!');
      setShowUploadModal(false);
    } else {
      alert('Erro ao carregar template: ' + result.error);
    }
    setUploading(false);
  };

  const currentContent = selectedTemplate
    ? replaceVariables(selectedTemplate.content, formData)
    : '';

  // Pagination Logic
  useEffect(() => {
    if (!currentContent) return;

    const paginate = () => {
      // Use requestAnimationFrame to ensure the DOM has updated before measuring
      requestAnimationFrame(() => {
        if (!measurementRef.current) return;

        const contentElements = Array.from(measurementRef.current.children);
        const pages: string[] = [];
        let currentPageHtml = "";
        let currentHeight = 0;
        const maxPageHeight = 820; // px - Reduced for footer breathing room
        const signatureHeight = 180; // Reserved space for signature block

        for (let i = 0; i < contentElements.length; i++) {
          const el = contentElements[i] as HTMLElement;

          // Skip empty paragraphs or tags with only whitespace
          if (el.tagName === 'P' && (el.textContent || '').trim() === '') continue;

          const elHeight = el.offsetHeight; // Synced with CSS (margin-bottom is 0)
          const isHeading = ['H1', 'H2', 'H3'].includes(el.tagName);

          // Post-process HTML for styling specific blocks
          let html = el.outerHTML;
          // Apply custom styles based on content
          if (el.tagName === 'P') {
            const rawText = (el.textContent || '').trim().toUpperCase();

            // Verifica se o parágrafo COMEÇA com as palavras-chave para evitar falsos positivos no corpo do texto
            const isParecer = rawText.startsWith('PARECER');
            const isProcesso = rawText.startsWith('PROCESSO');
            const isInteressado = rawText.startsWith('INTERESSADO');
            const isAssunto = rawText.startsWith('ASSUNTO');

            if (isParecer) {
              // Apenas o Parecer centralizado
              html = `<p class="official-centered">${el.innerHTML}</p>`;
            } else if (isProcesso || isInteressado || isAssunto) {
              // Processo, Interessado e Assunto alinhados à esquerda (sem recuo)
              html = `<p class="official-left">${el.innerHTML}</p>`;
            }
          }

          // Heading protection: prevent widow headings
          if (isHeading && currentPageHtml !== '') {
            const remainingSpace = maxPageHeight - currentHeight;

            // If the heading itself doesn't fit or is too close to bottom (top 85%), push
            if (remainingSpace < (elHeight + 80)) {
              pages.push(currentPageHtml);
              currentPageHtml = html;
              currentHeight = elHeight;
              continue;
            }
          }

          const isLastFew = i >= contentElements.length - 2; // Check last elements for signature space
          const neededSpace = isLastFew ? elHeight + signatureHeight : elHeight;

          if (currentHeight + neededSpace > maxPageHeight && currentPageHtml !== "") {
            pages.push(currentPageHtml);
            currentPageHtml = html;
            currentHeight = elHeight;
          } else {
            currentPageHtml += html;
            currentHeight += elHeight;
          }
        }

        if (currentPageHtml) pages.push(currentPageHtml);

        // Remove empty pages AND pages that only contain empty paragraphs/tags or whitespace
        const filteredPages = pages.filter(page => {
          const stripped = page.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
          return stripped.length > 0;
        });
        setPaginatedContent(filteredPages);
      });
    };

    paginate();
  }, [currentContent]);

  const handleGeneratePDF = () => {
    const previewEl = document.getElementById('opinion-preview');
    if (!previewEl) return;

    // Corrige caminhos relativos de imagens para absolutos (necessário no iframe)
    const clonedHtml = previewEl.innerHTML.replace(
      /src="\/(images\/[^"]+)"/g,
      (match, p1) => `src="${window.location.origin}/${p1}"`
    );

    // Get the HTML classes to inherit font variables
    const htmlClasses = document.documentElement.className;

    // Coleta todos os estilos da página atual (link + style tags)
    const styleLinks = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
      .map(l => `<link rel="stylesheet" href="${l.href}">`)
      .join('\n');
    const inlineStyles = Array.from(document.querySelectorAll('style'))
      .map(s => `<style>${s.textContent}</style>`)
      .join('\n');

    const html = `<!DOCTYPE html>
<html lang="pt-br" class="${htmlClasses}">
<head>
  <meta charset="utf-8">
  <title>Opinion Factory - Gerar PDF</title>
  ${styleLinks}
  ${inlineStyles}
  <style>
    /* Reset e Paridade Total */
    * { 
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important; 
      print-color-adjust: exact !important;
    }
    html, body { 
      background: white !important; 
      margin: 0 !important; 
      padding: 0 !important;
      width: 100% !important;
      min-height: 100% !important;
      overflow: visible !important;
      font-family: var(--font-outfit), sans-serif;
    }
    #opinion-preview { 
      display: block; 
      width: 210mm; 
      margin: 0 auto;
      overflow: visible !important;
    }
    
    .paper-page { 
      margin: 0 !important; 
      box-shadow: none !important; 
      transform: none !important;
      border: none !important;
      width: 210mm !important;
      height: 297mm !important;
      page-break-after: always !important;
      page-break-inside: avoid !important;
      position: relative !important;
      display: flex !important;
      flex-direction: column !important;
      padding: 30mm 20mm 20mm 30mm !important; /* Margens ABNT Rígidas */
      overflow: hidden !important;
      background: white !important;
    }

    .paper-page:last-child { 
      page-break-after: avoid !important; 
    }

    .paper-content {
      width: 100% !important;
      height: auto !important;
    }

    .page-footer { 
      margin-top: auto !important; 
    }

    @media print {
      @page { 
        margin: 0; 
        size: A4 portrait;
      }
    }
  </style>
</head>
<body class="antialiased">
  <div id="opinion-preview">${clonedHtml}</div>
  <script>
    window.onload = () => {
      const images = Array.from(document.querySelectorAll('img'));
      const promises = images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      });
      
      Promise.all(promises).then(() => {
        // Delay para garantir renderização de layout e fontes
        setTimeout(() => {
          window.print();
        }, 800);
      });
    };
  </script>
</body>
</html>`;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-10000px;left:-10000px;width:100%;height:100%;border:none;';
    iframe.srcdoc = html;
    document.body.appendChild(iframe);

    iframe.onload = () => {
      // O script interno cuidará do print após as imagens carregarem
    };
  };

  // Calculate completion
  if (loading) return <div className="loading-state">Carregando templates…</div>;

  return (
    <div className="app">

      {/* ── Header ── */}
      <header className="app-header">
        <div className="app-brand">
          <FileText size={18} />
          <div className="app-brand-text">
            <span className="app-title">Opinion Factory</span>
            <span className="app-subtitle">Gerador de Pareceres Fiscais</span>
          </div>
        </div>
        <div className="app-header-actions">
          <button className="btn btn-outline" onClick={() => setShowUploadModal(true)}>
            <Upload size={14} /> Upload Template
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="app-body">

        {/* ── Sidebar ── */}
        <aside className="sidebar">

          {/* Template selector */}
          <div className="sidebar-section">
            <p className="sidebar-label"><FileSearch size={14} /> Modelo do Documento</p>
            <div className="select-wrapper">
              <select
                className="select-field"
                value={selectedTemplate?.name || ''}
                onChange={(e) => {
                  const t = templates.find(t => t.name === e.target.value);
                  if (t) handleSelectTemplate(t);
                }}
              >
                {templates.map(t => (
                  <option key={t.name} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="sidebar-section-scroll">
            <div className="form-container">
              {variables.map((v, idx) => (
                <motion.div
                  key={v.name}
                  className="field-group"
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.02 }}
                >
                  <label className="field-label">{v.label}</label>
                  <input
                    type={v.type}
                    className="input-field"
                    placeholder={`Digite o ${v.label.toLowerCase()}...`}
                    value={formData[v.name] || ''}
                    onChange={(e) => handleInputChange(v.name, e.target.value)}
                  />
                </motion.div>
              ))}
            </div>
          </div>

          {/* Generate PDF button */}
          <div className="sidebar-footer">
            <button className="btn btn-primary btn-full" onClick={handleGeneratePDF}>
              <Download size={14} /> Gerar Parecer em PDF
            </button>
          </div>
        </aside>

        {/* ── Preview ── */}
        <div className="preview-workspace">
          <div className="preview-toolbar">
            <span className="preview-badge"><FileText size={11} /> Layout Oficial A4</span>
            <span className="preview-page-count">{paginatedContent.length} página{paginatedContent.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="preview-container">
            {/* Hidden measurement div */}
            <div
              ref={measurementRef}
              className="paper-content"
              style={{ position: 'absolute', visibility: 'hidden', width: '160mm', pointerEvents: 'none' }}
            >
              <ReactMarkdown>{currentContent}</ReactMarkdown>
            </div>

            <motion.div
              className="paper-scaler"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div id="opinion-preview">
                {paginatedContent.map((pageHtml, index) => (
                  <div key={index} className="paper-page">
                    <div className="page-numbering">{index + 1}</div>

                    <div className="official-header">
                      <img src="/images/cabecalho.png" alt="Cabeçalho Oficial" />
                    </div>

                    <div className="paper-content" dangerouslySetInnerHTML={{ __html: pageHtml }} />

                    {index === paginatedContent.length - 1 && (
                      <div className="official-signature">
                        <div className="signature-date">
                          Imperatriz, {formData['Data'] || '{{Data}}'}
                        </div>
                        <div className="signature-block">
                          <div className="signature-line" />
                          <div className="signature-name">Analista Fiscal</div>
                          <div className="signature-role">Divisão de Arrecadação, Auditoria e Fiscalização</div>
                        </div>
                      </div>
                    )}

                    <div className="page-footer">
                      <img src="/images/rotape.png" alt="Rodapé Oficial" className="official-footer-img" />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
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
              onClick={(e) => e.stopPropagation()}
            >
              <div className="upload-modal-header">
                <span className="upload-modal-title">Upload de Template</span>
                <button className="btn-ghost" onClick={() => setShowUploadModal(false)}>
                  <X size={15} />
                </button>
              </div>
              <p className="upload-modal-desc">Selecione um arquivo <strong>.md</strong> para adicionar como template.</p>
              <input
                type="file"
                accept=".md"
                onChange={handleFileUpload}
                disabled={uploading}
                className="input-field"
                style={{ height: 'auto', padding: '6px 10px' }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
