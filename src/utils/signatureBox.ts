/**
 * Recuadro de firma de los presupuestos, compartido entre el PDF (react-pdf, en puntos)
 * y Documenso (que pide la posición del campo en % de la hoja).
 */
export const A4_POINTS = { w: 595.28, h: 841.89 };
export const SIGNATURE_POINTS = { left: 40, bottom: 56, width: 220, height: 56 };

export const SIGNATURE_BOX = {
  positionX: (SIGNATURE_POINTS.left / A4_POINTS.w) * 100,
  positionY: ((A4_POINTS.h - SIGNATURE_POINTS.bottom - SIGNATURE_POINTS.height) / A4_POINTS.h) * 100,
  width: (SIGNATURE_POINTS.width / A4_POINTS.w) * 100,
  height: (SIGNATURE_POINTS.height / A4_POINTS.h) * 100,
};
