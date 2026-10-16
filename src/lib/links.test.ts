import { extractWikiLinks, resolveEntityByTitle, normalizeEntityTitle, LinkCatalogItem, getNodeShape } from './links';

// Simple in-code assertion test runner
export function runLinksUnitTests(): { passed: boolean; results: { name: string; ok: boolean; error?: string }[] } {
  const results: { name: string; ok: boolean; error?: string }[] = [];

  function test(name: string, fn: () => void) {
    try {
      fn();
      results.push({ name, ok: true });
    } catch (err: any) {
      results.push({ name, ok: false, error: err?.message || String(err) });
    }
  }

  // Test 1: Simple link extraction
  test('extracts simple [[Title]] correctly', () => {
    const text = 'Revisar detalles con [[Estudio Cane]] hoy a las 15hs.';
    const links = extractWikiLinks(text);
    if (links.length !== 1) throw new Error(`Expected 1 link, got ${links.length}`);
    if (links[0].targetTitle !== 'Estudio Cane') throw new Error(`Unexpected title: ${links[0].targetTitle}`);
    if (links[0].displayText !== 'Estudio Cane') throw new Error(`Unexpected displayText: ${links[0].displayText}`);
    if (links[0].alias !== undefined) throw new Error('Expected no alias');
  });

  // Test 2: Alias support [[Title|Display Text]]
  test('extracts [[Title|Alias]] with alias support', () => {
    const text = 'Hablé con [[Estudio Cane Arquitectura|Cane]] sobre el presupuesto.';
    const links = extractWikiLinks(text);
    if (links.length !== 1) throw new Error(`Expected 1 link, got ${links.length}`);
    if (links[0].targetTitle !== 'Estudio Cane Arquitectura') throw new Error(`Unexpected title: ${links[0].targetTitle}`);
    if (links[0].displayText !== 'Cane') throw new Error(`Expected displayText "Cane", got ${links[0].displayText}`);
    if (links[0].alias !== 'Cane') throw new Error(`Expected alias "Cane", got ${links[0].alias}`);
  });

  // Test 3: Normalization test: "Adán García" = "adan garcia"
  test('normalizes diacritics and symbols correctly: "Adán García" = "adan garcia"', () => {
    const normalized1 = normalizeEntityTitle('Adán García');
    const normalized2 = normalizeEntityTitle('  adan   garcia  ');
    const normalized3 = normalizeEntityTitle('ADÁN GARCÍA!');
    if (normalized1 !== 'adan garcia') throw new Error(`Expected "adan garcia", got "${normalized1}"`);
    if (normalized2 !== 'adan garcia') throw new Error(`Expected "adan garcia", got "${normalized2}"`);
    if (normalized3 !== 'adan garcia') throw new Error(`Expected "adan garcia", got "${normalized3}"`);
  });

  // Test 4: Duplicate names protection (no false links)
  test('returns null when multiple duplicate entities exist to prevent false automatic links', () => {
    const catalog: LinkCatalogItem[] = [
      { id: '1', type: 'proyecto', title: 'Estudio Cane', path: '/clientes/1' },
      { id: '2', type: 'proyecto', title: 'estudio cane', path: '/clientes/2' }, // Duplicate name
      { id: '3', type: 'nota', title: 'Estrategia 2026', path: '/notas?id=3' },
    ];

    const resolvedDuplicate = resolveEntityByTitle('Estudio Cane', catalog);
    if (resolvedDuplicate !== null) {
      throw new Error('Expected null due to duplicate entity titles, but resolved an entity');
    }

    const resolvedUnique = resolveEntityByTitle('Estrategia 2026', catalog);
    if (!resolvedUnique || resolvedUnique.id !== '3') {
      throw new Error('Expected unique entity to resolve cleanly');
    }
  });

  // Test 5: Substrings do not partially link
  test('does not partially link substrings (e.g. "Cane" must not link to "Estudio Cane")', () => {
    const catalog: LinkCatalogItem[] = [
      { id: '1', type: 'proyecto', title: 'Estudio Cane', path: '/clientes/1' },
    ];

    const partial1 = resolveEntityByTitle('Cane', catalog);
    if (partial1 !== null) throw new Error('Expected null for partial substring "Cane"');

    const partial2 = resolveEntityByTitle('Estudio', catalog);
    if (partial2 !== null) throw new Error('Expected null for partial substring "Estudio"');
  });

  // Test 6: Geometric shapes per entity type
  test('determines standard shapes correctly', () => {
    if (getNodeShape('nota') !== 'circle') throw new Error('Note must be circle');
    if (getNodeShape('proyecto') !== 'rounded-rect') throw new Error('Project must be rounded-rect');
    if (getNodeShape('cliente') !== 'rounded-rect') throw new Error('Client must be rounded-rect');
    if (getNodeShape('objetivo') !== 'diamond') throw new Error('Goal must be diamond');
    if (getNodeShape('tag') !== 'capsule') throw new Error('Tag must be capsule');
  });

  // Test 7: Ignores code blocks
  test('ignores links inside triple backticks and inline code', () => {
    const text = 'Link real [[Nota Alfa]] pero ignorar `[[Falsa 1]]` y \n```\n[[Falsa 2]]\n```';
    const links = extractWikiLinks(text);
    if (links.length !== 1) throw new Error(`Expected 1 link, got ${links.length}`);
    if (links[0].targetTitle !== 'Nota Alfa') throw new Error('Expected Nota Alfa');
  });

  const passed = results.every(r => r.ok);
  return { passed, results };
}
