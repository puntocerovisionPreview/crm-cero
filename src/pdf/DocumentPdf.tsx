import React from 'react';
import { Document, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';
import { PublicDocument, docTitle } from '../utils/documents';
import { SIGNATURE_POINTS } from '../utils/signatureBox';

/**
 * PDF del presupuesto o recibo, armado con @react-pdf/renderer: sale igual en
 * cualquier navegador (antes dependía de "Imprimir" de cada uno).
 * Los presupuestos llevan un recuadro de firma abajo de cada hoja; su posición
 * está en utils/signatureBox.ts y es la misma que usa Documenso para el campo de firma.
 */

const SIG = SIGNATURE_POINTS;

const INK = '#171717';
const MUTED = '#737373';
const RULE = '#E5E5E5';

const s = StyleSheet.create({
  page: { paddingTop: 48, paddingHorizontal: 40, paddingBottom: 150, fontFamily: 'Helvetica', fontSize: 10, color: INK },
  row: { flexDirection: 'row' },
  between: { flexDirection: 'row', justifyContent: 'space-between' },
  studio: { fontSize: 13, fontFamily: 'Helvetica-Bold' },
  muted: { color: MUTED },
  small: { fontSize: 9, color: MUTED },
  client: { fontSize: 22, marginTop: 4, letterSpacing: -0.4 },
  th: { fontSize: 8, color: MUTED, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: RULE },
  td: { paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: RULE },
  colDesc: { flex: 1, paddingRight: 8 },
  colQty: { width: 40, textAlign: 'right' },
  colAmt: { width: 100, textAlign: 'right' },
  total: { fontSize: 18, fontFamily: 'Helvetica-Bold', width: 140, textAlign: 'right' },
  box: { marginTop: 18, padding: 12, borderWidth: 1, borderColor: RULE, borderRadius: 8 },
  label: { fontSize: 8, color: MUTED, marginBottom: 3 },
  sig: { position: 'absolute', left: SIG.left, bottom: SIG.bottom, width: SIG.width, height: SIG.height, borderBottomWidth: 1, borderBottomColor: INK, justifyContent: 'flex-end' },
  sigLabel: { position: 'absolute', left: SIG.left, bottom: SIG.bottom - 14, fontSize: 8, color: MUTED },
  footer: { position: 'absolute', right: 40, bottom: 24, fontSize: 8, color: MUTED },
});

const money = (n: number, cur: string) => `${cur === 'USD' ? 'US$' : '$'} ${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const longDate = (d?: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
const METHOD: Record<string, string> = { transferencia: 'Transferencia', mercadopago: 'Mercado Pago', efectivo: 'Efectivo', tarjeta: 'Tarjeta', usdt: 'USDT', otro: 'Otro' };

export const DocumentPdf: React.FC<{ doc: PublicDocument }> = ({ doc }) => {
  const isQuote = doc.kind === 'presupuesto';
  return (
    <Document title={`${docTitle(doc)} · ${doc.studioName}`} author={doc.studioName}>
      <Page size="A4" style={s.page}>
        <View style={s.between}>
          <View>
            <Text style={s.studio}>{doc.studioName}</Text>
            <Text style={s.muted}>{isQuote ? 'Presupuesto' : 'Recibo de pago'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.muted}>{docTitle(doc).replace(/^(Presupuesto|Recibo) /, '')}</Text>
            <Text style={s.muted}>{longDate(doc.issueDate)}</Text>
          </View>
        </View>

        <View style={{ marginTop: 32 }}>
          <Text style={s.small}>{isQuote ? 'Para' : 'Recibimos de'}</Text>
          <Text style={s.client}>{doc.clientName}</Text>
          {doc.contactName && doc.contactName !== doc.clientName ? <Text style={s.muted}>{doc.contactName}</Text> : null}
        </View>

        <View style={{ marginTop: 28 }}>
          <View style={s.row}>
            <Text style={[s.th, s.colDesc]}>DETALLE</Text>
            <Text style={[s.th, s.colQty]}>CANT.</Text>
            <Text style={[s.th, s.colAmt]}>IMPORTE</Text>
          </View>
          {doc.items.map((it, i) => (
            <View key={i} style={s.row} wrap={false}>
              <Text style={[s.td, s.colDesc]}>{it.description}</Text>
              <Text style={[s.td, s.colQty]}>{it.quantity}</Text>
              <Text style={[s.td, s.colAmt]}>{money(it.quantity * it.unitPrice, doc.currency)}</Text>
            </View>
          ))}
          <View style={[s.row, { justifyContent: 'flex-end', alignItems: 'baseline', marginTop: 12 }]}>
            <Text style={{ marginRight: 12 }}>Total</Text>
            <Text style={s.total}>{money(doc.total, doc.currency)}</Text>
          </View>
        </View>

        {!isQuote && (
          <View style={s.box}>
            <Text>
              Pago recibido el {longDate(doc.paymentDate || doc.issueDate)}
              {doc.paymentMethod ? ` por ${METHOD[doc.paymentMethod] || doc.paymentMethod}` : ''}. ¡Gracias!
            </Text>
          </View>
        )}

        {doc.notes ? (
          <View style={{ marginTop: 18 }}>
            <Text style={s.label}>{isQuote ? 'CONDICIONES' : 'DETALLE'}</Text>
            <Text>{doc.notes}</Text>
          </View>
        ) : null}

        {isQuote && doc.validUntil ? <Text style={[s.small, { marginTop: 14 }]}>Válido hasta el {longDate(doc.validUntil)}.</Text> : null}

        {isQuote && doc.paymentInfo ? (
          <View style={s.box} wrap={false}>
            <Text style={s.label}>DATOS DE PAGO</Text>
            {doc.paymentInfo.holder ? <Text>Titular: {doc.paymentInfo.holder}</Text> : null}
            {doc.paymentInfo.alias ? <Text>Alias: {doc.paymentInfo.alias}</Text> : null}
            {doc.paymentInfo.cbu ? <Text>CBU/CVU: {doc.paymentInfo.cbu}</Text> : null}
            {doc.paymentInfo.link ? <Text>Link de pago: {doc.paymentInfo.link}</Text> : null}
          </View>
        ) : null}

        {isQuote && doc.status === 'aceptado' && doc.acceptedName ? (
          <Text style={[s.small, { marginTop: 14 }]}>
            Aceptado por {doc.acceptedName} el {longDate(doc.acceptedAt)}.
          </Text>
        ) : null}

        {isQuote && (
          <>
            <View style={s.sig} fixed />
            <Text style={s.sigLabel} fixed>
              Firma y aclaración del cliente
            </Text>
          </>
        )}
        <Text style={s.footer} fixed render={({ pageNumber, totalPages }) => `${doc.studioName} · ${pageNumber}/${totalPages}`} />
      </Page>
    </Document>
  );
};

/** Genera el PDF y devuelve el archivo y su cantidad de hojas */
export async function renderDocumentPdf(doc: PublicDocument): Promise<{ blob: Blob; pages: number }> {
  const blob = await pdf(<DocumentPdf doc={doc} />).toBlob();
  const text = new TextDecoder('latin1').decode(await blob.arrayBuffer());
  const pages = Math.max(1, (text.match(/\/Type\s*\/Page(?!s)/g) || []).length);
  return { blob, pages };
}

export function pdfFileName(doc: PublicDocument) {
  return `${docTitle(doc).replace('N° ', '')} - ${doc.clientName}.pdf`.replace(/[\\/:*?"<>|]/g, '');
}
