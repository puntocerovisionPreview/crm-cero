import React, { useEffect, useState } from 'react';
import { CheckCircle2, Download, Loader2 } from 'lucide-react';
import { PublicDocument, acceptPublicDocument, docTitle, loadPublicDocument, markPublicDocumentViewed } from '../utils/documents';
import { planAmounts, stepWhen } from '../utils/contracts';

const money = (n: number, cur: string) => `${cur === 'USD' ? 'US$' : '$'} ${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const longDate = (d?: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
const METHOD: Record<string, string> = { transferencia: 'Transferencia', mercadopago: 'Mercado Pago', efectivo: 'Efectivo', tarjeta: 'Tarjeta', usdt: 'USDT', otro: 'Otro' };

// Presupuesto o recibo que ve el cliente con el link (sin entrar al CRM). Se imprime como PDF.
export const DocumentPublicView: React.FC<{ token: string }> = ({ token }) => {
  const [doc, setDoc] = useState<PublicDocument | null | undefined>(undefined);
  const [loadFailed, setLoadFailed] = useState(false);
  const [name, setName] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    // Siempre en claro: es un documento para leer e imprimir
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    // Si la conexión falla, no queda cargando para siempre
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 12000));
    Promise.race([loadPublicDocument(token), timeout])
      .then(d => {
        setDoc(d);
        if (d) document.title = `${docTitle(d)} · ${d.studioName}`;
        // Aviso de "lo abrió" (solo presupuestos sin aceptar; no bloquea nada)
        if (d && d.kind === 'presupuesto' && d.status !== 'aceptado') markPublicDocumentViewed(token);
      })
      .catch(() => {
        setLoadFailed(true);
        setDoc(null);
      });
  }, [token]);

  if (doc === undefined) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#F2F2F7]">
        <Loader2 className="w-6 h-6 animate-spin text-[#8E8E93]" aria-label="Cargando" />
      </div>
    );
  }
  if (!doc) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#F2F2F7] p-6 text-center">
        <div>
          <h1 className="text-[22px] font-bold text-[#1D1D1F]">{loadFailed ? 'No se pudo cargar el documento' : 'No encontramos este documento'}</h1>
          <p className="text-[15px] text-[#6E6E73] mt-1">
            {loadFailed ? 'Revisá tu conexión y volvé a abrir el link.' : 'Puede que el link esté incompleto o que lo hayan retirado.'}
          </p>
        </div>
      </div>
    );
  }

  const accept = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await acceptPublicDocument(token, name.trim());
      setDoc({ ...doc, status: 'aceptado', acceptedName: name.trim(), acceptedAt: new Date().toISOString() });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  // PDF con react-pdf: se carga solo al tocar el botón (la librería pesa)
  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const { renderDocumentPdf, pdfFileName } = await import('../pdf/DocumentPdf');
      const { blob } = await renderDocumentPdf(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pdfFileName(doc);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      console.warn('PDF:', err);
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  const isQuote = doc.kind === 'presupuesto';
  const expired = isQuote && doc.validUntil && doc.validUntil < new Date().toISOString().slice(0, 10) && doc.status !== 'aceptado';

  return (
    <div className="min-h-[100dvh] bg-[#F2F2F7] py-8 px-4 print:bg-white print:p-0 text-[#1D1D1F]">
      <style>{`@media print { .no-print { display: none !important } @page { margin: 16mm } }`}</style>
      <article className="max-w-[720px] mx-auto bg-white rounded-[24px] shadow-[0_2px_20px_rgba(0,0,0,0.06)] p-6 sm:p-10 space-y-8 print:shadow-none print:rounded-none print:p-0">
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="" className="w-11 h-11 rounded-[10px] object-contain bg-black" />
            <div>
              <p className="text-[17px] font-semibold">{doc.studioName}</p>
              <p className="text-[13px] text-[#6E6E73]">{isQuote ? 'Presupuesto' : 'Recibo de pago'}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[13px] text-[#6E6E73]">{docTitle(doc).replace(/^(Presupuesto|Recibo) /, '')}</p>
            <p className="text-[13px] text-[#6E6E73]">{longDate(doc.issueDate)}</p>
          </div>
        </header>

        <section>
          <p className="text-[13px] text-[#6E6E73]">{isQuote ? 'Para' : 'Recibimos de'}</p>
          <h1 className="text-[28px] font-bold tracking-tight leading-tight">{doc.clientName}</h1>
          {doc.contactName && doc.contactName !== doc.clientName && <p className="text-[15px] text-[#6E6E73]">{doc.contactName}</p>}
        </section>

        <section>
          <table className="w-full text-[15px]">
            <thead>
              <tr className="text-left text-[12px] text-[#6E6E73] border-b border-[#E5E5EA]">
                <th className="py-2 font-medium">Detalle</th>
                <th className="py-2 font-medium text-right w-16">Cant.</th>
                <th className="py-2 font-medium text-right w-32">Importe</th>
              </tr>
            </thead>
            <tbody>
              {doc.items.map((it, i) => (
                <tr key={i} className="border-b border-[#F2F2F7] align-top">
                  <td className="py-3 pr-3 whitespace-pre-line">{it.description}</td>
                  <td className="py-3 text-right tabular-nums">{it.quantity}</td>
                  <td className="py-3 text-right tabular-nums">{money(it.quantity * it.unitPrice, doc.currency)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} className="pt-4 text-right text-[15px] font-semibold">Total</td>
                <td className="pt-4 text-right text-[22px] font-bold tabular-nums">{money(doc.total, doc.currency)}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        {!isQuote && (
          <section className="rounded-[16px] bg-[#34C759]/10 px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-[#248A3D] shrink-0" aria-hidden />
            <p className="text-[15px]">
              Pago recibido el {longDate(doc.paymentDate || doc.issueDate)}
              {doc.paymentMethod ? ` por ${METHOD[doc.paymentMethod] || doc.paymentMethod}` : ''}. ¡Gracias!
            </p>
          </section>
        )}

        {isQuote && doc.paymentPlan && doc.paymentPlan.length > 0 && (
          <section>
            <h2 className="text-[13px] font-semibold text-[#6E6E73] mb-2">Forma de pago</h2>
            <ul className="divide-y divide-[#F2F2F7]">
              {doc.paymentPlan.map((s, i) => (
                <li key={i} className="py-2 flex justify-between gap-3 text-[15px]">
                  <span>
                    {s.label} <span className="text-[#6E6E73]">· {s.percent}% {stepWhen(s)}</span>
                  </span>
                  <span className="tabular-nums font-medium">{money(planAmounts(doc.paymentPlan!, doc.total)[i], doc.currency)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {doc.notes && (
          <section>
            <h2 className="text-[13px] font-semibold text-[#6E6E73] mb-1">{isQuote ? 'Notas' : 'Detalle'}</h2>
            <p className="text-[15px] whitespace-pre-line">{doc.notes}</p>
          </section>
        )}

        {isQuote && doc.clauses && doc.clauses.length > 0 && (
          <section>
            <h2 className="text-[13px] font-semibold text-[#6E6E73] mb-2">Condiciones del servicio</h2>
            <ol className="space-y-3 text-[14px] leading-relaxed">
              {doc.clauses.map((c, i) => (
                <li key={i}>
                  <p className="font-semibold">
                    {i + 1}. {c.title}
                  </p>
                  <p className="text-[#3A3A3C] whitespace-pre-line">{c.body}</p>
                </li>
              ))}
            </ol>
          </section>
        )}

        {isQuote && doc.validUntil && (
          <p className={`text-[13px] ${expired ? 'text-[#D70015]' : 'text-[#6E6E73]'}`}>
            {expired ? 'Este presupuesto venció el ' : 'Válido hasta el '}
            {longDate(doc.validUntil)}.
          </p>
        )}

        {isQuote && doc.paymentInfo && (
          <section className="rounded-[16px] bg-[#F2F2F7] px-4 py-3 text-[14px] space-y-0.5">
            <h2 className="text-[13px] font-semibold text-[#6E6E73] mb-1">Datos de pago</h2>
            {doc.paymentInfo.holder && <p>Titular: {doc.paymentInfo.holder}</p>}
            {doc.paymentInfo.alias && <p>Alias: {doc.paymentInfo.alias}</p>}
            {doc.paymentInfo.cbu && <p>CBU/CVU: {doc.paymentInfo.cbu}</p>}
            {doc.paymentInfo.link && <p>Link de pago: {doc.paymentInfo.link}</p>}
          </section>
        )}

        {/* Aceptación */}
        {isQuote && doc.status === 'aceptado' && (
          <section className="rounded-[16px] bg-[#34C759]/10 px-4 py-4 flex items-center gap-3">
            <CheckCircle2 className="w-7 h-7 text-[#248A3D] shrink-0" aria-hidden />
            <div>
              <p className="text-[17px] font-semibold">Presupuesto aceptado</p>
              <p className="text-[14px] text-[#6E6E73]">
                Por {doc.acceptedName} el {longDate(doc.acceptedAt)}.
              </p>
            </div>
          </section>
        )}
        {/* Firma digital con Documenso: si está enviado a firmar, se firma ahí */}
        {isQuote && doc.status !== 'aceptado' && !expired && doc.signingUrl && (
          <section className="no-print rounded-[16px] border border-[#E5E5E5] p-4 space-y-3">
            <p className="text-[17px] font-semibold">Firmá el presupuesto</p>
            <p className="text-[14px] text-[#737373]">Se abre la firma digital (Documenso). Cuando firmes, nos llega el aviso para arrancar.</p>
            <a href={doc.signingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 px-6 rounded-[12px] bg-[#171717] text-white text-[16px] font-semibold items-center">
              Firmar
            </a>
          </section>
        )}
        {isQuote && doc.status !== 'aceptado' && !expired && !doc.signingUrl && (
          <form onSubmit={accept} className="no-print rounded-[16px] border border-[#E5E5EA] p-4 space-y-3">
            <p className="text-[17px] font-semibold">¿Avanzamos?</p>
            <p className="text-[14px] text-[#6E6E73]">
              Escribí tu nombre y tocá "Acepto"{doc.clauses?.length ? ' para aceptar el presupuesto y las condiciones del servicio' : ''}. Te vamos a escribir para arrancar.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                required
                minLength={2}
                placeholder="Tu nombre y apellido"
                aria-label="Tu nombre y apellido"
                className="flex-1 h-11 rounded-[12px] bg-[#F2F2F7] border-0 px-3 text-[16px] focus:outline-none focus:ring-2 focus:ring-[#171717]/30"
              />
              <button type="submit" disabled={sending || name.trim().length < 2} className="h-11 px-6 rounded-[12px] bg-[#171717] text-white text-[16px] font-semibold disabled:opacity-50">
                {sending ? 'Enviando…' : 'Acepto'}
              </button>
            </div>
            {error && <p className="text-[14px] text-[#D70015]">{error}</p>}
          </form>
        )}

        <div className="no-print flex justify-center">
          <button type="button" onClick={downloadPdf} disabled={downloading} className="h-10 px-4 rounded-full bg-[#F2F2F7] text-[15px] font-medium flex items-center gap-2 disabled:opacity-60">
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Download className="w-4 h-4" aria-hidden />}
            {downloading ? 'Armando PDF…' : 'Descargar PDF'}
          </button>
        </div>
      </article>
      <p className="no-print text-center text-[12px] text-[#8E8E93] mt-4">{doc.studioName}</p>
    </div>
  );
};

export default DocumentPublicView;
