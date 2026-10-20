/**
 * PLANTILLA PARA CLAUDE
 * Lo que se descarga desde Contenido → Importar: las instrucciones para pegarle a Claude
 * y un calendario de ejemplo. Con eso arma el .zip que la app importa de una.
 */

export const CLAUDE_INSTRUCTIONS = `# Calendario de contenido para importar en mi CRM (.Cero)

Armame el calendario de contenido y entregámelo como **un solo archivo .zip** que pueda importar en mi CRM (Contenido → Importar). Seguí exactamente esta estructura.

## 1. Estructura del .zip

\`\`\`
calendario.json                      ← todas las piezas (formato abajo)
c/<slug>/01.png                      ← slides de cada carrusel o estático, en orden
c/<slug>/02.png
c/<slug>/03.png
r/<nombre-del-recurso>.pdf           ← PDF que se manda cuando comentan la palabra clave
\`\`\`

- **Una carpeta por pieza** dentro de \`c/\`, con el mismo nombre que su \`slug\` (ej. \`c/2026-11-03-bingo-del-estudio/\`).
- **Las slides se numeran con dos dígitos en el orden en que se publican**: \`01.png\` es la portada, \`02.png\` la segunda, etc. La app las muestra en ese orden y usa la 01 como portada en el calendario.
- **Formato de las imágenes**: vertical 4:5, **1080×1350** (o 2160×2700 si querés más definición). PNG o JPG.
- Los **reels** no llevan carpeta en \`c/\` (salvo que tengan una portada: en ese caso, \`c/<slug>/01.png\`).
- Carpeta \`m/\` (miniaturas) **opcional**: si no está, la app las genera.

## 2. Formato de calendario.json

\`\`\`json
{
  "titulo": "Calendario · noviembre 2026",
  "piezas": [
    {
      "iso": "2026-11-03",
      "slug": "2026-11-03-bingo-del-estudio",
      "soporte": "carrusel",
      "titulo": "Bingo del estudio",
      "idea en una línea": "Cartón de 16 situaciones del oficio; marcás las que te pasaron",
      "pilar": "Problema",
      "dolor": "previsibilidad",
      "formato": "Juego / cartón",
      "CTA": "comentá BINGO y te lo mando",
      "estado": "carrusel renderizado (para revisar)",
      "caption": "Texto completo del posteo, con saltos de línea y hashtags.",
      "recursos": [
        { "palabra": "BINGO", "nombre": "Cartón para imprimir", "pub": "r/bingo-del-estudio.pdf" }
      ]
    },
    {
      "iso": "2026-11-05",
      "slug": "2026-11-05-defiendo-el-boca-en-boca",
      "soporte": "reel",
      "titulo": "Defiendo el boca en boca",
      "idea en una línea": "Defiendo el referido y a mitad lo doy vuelta",
      "pilar": "Problema",
      "estado": "guion aprobado",
      "guion": {
        "titulo": "Defiendo el boca en boca",
        "formato": "reel a cámara · 35 a 40 segundos",
        "que": "De qué se trata, en una línea",
        "html": "<h4>Antes de grabar</h4><ul><li>...</li></ul><h4>Paso a paso</h4><ol><li>...</li></ol>",
        "texto": "GUION\\nLo que digo, línea por línea\\n\\nTEXTO EN PANTALLA\\n- ...",
        "caption": "Caption del reel"
      }
    }
  ]
}
\`\`\`

### Campos

| Campo | Obligatorio | Qué va |
|---|---|---|
| \`iso\` | sí | Fecha de publicación, \`AAAA-MM-DD\` |
| \`slug\` | sí | \`AAAA-MM-DD-titulo-corto\`, sin tildes ni espacios. Es el nombre de la carpeta en \`c/\` |
| \`soporte\` | sí | \`carrusel\`, \`reel\` o \`estatico\` |
| \`titulo\` | sí | Título corto de la pieza |
| \`idea en una línea\` | sí | La idea resumida |
| \`estado\` | sí | \`idea\`, \`guion listo\`, \`guion aprobado\`, \`grabado\`, \`editado\`, \`carrusel renderizado (para revisar)\`, \`listo para publicar\`, \`programado\` o \`publicado\` |
| \`caption\` | recomendado | El texto del posteo |
| \`pilar\`, \`dolor\`, \`formato\`, \`CTA\` | opcional | Para ordenar la estrategia |
| \`recursos\` | opcional | Palabra clave → PDF en \`r/\`. Si no hay PDF (ej. un link), poné solo \`palabra\` y \`nombre\` |
| \`guion\` | para reels | \`html\` solo con títulos, listas y párrafos (h4, ul, ol, li, p, b, i) |
| \`slides\` | opcional | Si no lo ponés, la app toma todas las imágenes de \`c/<slug>/\` en orden. Si lo ponés: \`["c/<slug>/01.png", "c/<slug>/02.png"]\` |

## 3. Antes de entregar, revisá

- Cada carrusel tiene su carpeta \`c/<slug>/\` con el mismo nombre que su \`slug\`.
- Las slides están numeradas \`01, 02, 03…\` sin saltos, y la \`01\` es la portada.
- Todos los PDF que nombra \`recursos\` están en \`r/\`.
- \`calendario.json\` está en la raíz del .zip y es JSON válido.
`;

export const EXAMPLE_CALENDAR = {
  titulo: 'Calendario de ejemplo',
  piezas: [
    {
      iso: '2026-11-03',
      slug: '2026-11-03-ejemplo-carrusel',
      soporte: 'carrusel',
      titulo: 'Ejemplo de carrusel',
      'idea en una línea': 'Las slides van en c/2026-11-03-ejemplo-carrusel/01.png, 02.png…',
      pilar: 'Problema',
      CTA: 'comentá GUIA',
      estado: 'idea',
      caption: 'Caption de ejemplo.\n\n#arquitectura',
      recursos: [{ palabra: 'GUIA', nombre: 'Guía en PDF', pub: 'r/guia.pdf' }],
    },
    {
      iso: '2026-11-05',
      slug: '2026-11-05-ejemplo-reel',
      soporte: 'reel',
      titulo: 'Ejemplo de reel',
      'idea en una línea': 'Un reel con su guion',
      estado: 'guion listo',
      guion: {
        titulo: 'Ejemplo de reel',
        formato: 'reel a cámara · 30 segundos',
        que: 'De qué se trata',
        html: '<h4>Antes de grabar</h4><ul><li>Luz de frente</li></ul>',
        texto: 'GUION\nPrimera línea\nSegunda línea',
        caption: 'Caption del reel',
      },
    },
  ],
};

/** Descarga plantilla-contenido.zip con las instrucciones y el ejemplo */
export async function downloadTemplate() {
  const { zipSync, strToU8 } = await import('fflate');
  const zip = zipSync({
    'instrucciones-para-claude.md': strToU8(CLAUDE_INSTRUCTIONS),
    'ejemplo/calendario.json': strToU8(JSON.stringify(EXAMPLE_CALENDAR, null, 2)),
    'ejemplo/c/2026-11-03-ejemplo-carrusel/LEEME.txt': strToU8('Acá van las slides de esta pieza: 01.png (portada), 02.png, 03.png…\n'),
    'ejemplo/r/LEEME.txt': strToU8('Acá van los PDF de los recursos (ej. guia.pdf).\n'),
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }));
  a.download = 'plantilla-contenido-crm.zip';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export async function copyInstructions(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(CLAUDE_INSTRUCTIONS);
    return true;
  } catch {
    return false;
  }
}
