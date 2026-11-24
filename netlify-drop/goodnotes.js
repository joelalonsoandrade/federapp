'use strict';
// GoodNotes export (.goodnotes): writes each pen stroke as native GoodNotes ink, so the
// handwriting can be erased, moved and re-styled in GoodNotes. The file format follows the
// MIT-licensed gnnote writer (github.com/jakubfabrici/notability-goodnotes, docs/goodnotes-*.md):
// schema 24, flat constant-width strokes, Apple LZ4 frames, one paper template PDF per document.
// Nothing here is loaded from the network.
const GoodNotesExport = (() => {
  const enc = new TextEncoder();
  const SCHEMA = 24, ELEMENT_MAGIC = 5381, DOC_CONSTANT = '5A53E89E-F4C2-4548-8DD3-E9DF9FB4592E';
  const CANVAS_PER_PT = 132 / 72, WIDTH_PER_PT = 2, DASH = 0.3, LZ4_BLOCK = 32768;
  const THUMB_HEX = 'ffd8ffe000104a46494600010100000100010000ffdb00430001010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101ffc0001108001f001803011100021100031100ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc400b5100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffda000c03010002000300003f00fefe28a28a28a28a28a28a28a28a28a28a28a28a28a28a28a28a28a28affd9';
  const PAGE_COLOUR_HEX = '0a2e122c0a140ddedd5d3f15dedd5d3f1ddedd5d3f250000803f12140d0000803f150000803f1d0000803f250000803f';
  const FLAT_FORMAT = 'vuA(v)A(S(uu))A(S(uuuu))vA(f)';
  const ORDER_PREFIX = '43';

  // ---- bytes and protobuf -------------------------------------------------------------
  const hex = h => Uint8Array.from(h.match(/../g), x => parseInt(x, 16));
  const cat = parts => { let n = 0; for (const p of parts) n += p.length; const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
  const bytes = x => typeof x === 'string' ? enc.encode(x) : x;
  const varint = n => { let v = BigInt(n); const out = []; do { let b = Number(v & 0x7fn); v >>= 7n; if (v) b |= 0x80; out.push(b); } while (v); return Uint8Array.from(out); };
  const key = (num, wire) => varint((BigInt(num) << 3n) | BigInt(wire));
  const fVar = (num, n) => cat([key(num, 0), varint(n)]);
  const fBytes = (num, b) => { b = bytes(b); return cat([key(num, 2), varint(b.length), b]); };
  const fMsg = fBytes;
  const u32 = v => { const d = new DataView(new ArrayBuffer(4)); d.setUint32(0, v >>> 0, true); return new Uint8Array(d.buffer); };
  const u16 = v => { const d = new DataView(new ArrayBuffer(2)); d.setUint16(0, v, true); return new Uint8Array(d.buffer); };
  const f32 = f => { const d = new DataView(new ArrayBuffer(4)); d.setFloat32(0, f, true); return new Uint8Array(d.buffer); };
  const f32bits = f => new DataView(f32(f).buffer).getUint32(0, true);
  const fFix32 = (num, f) => cat([key(num, 5), f32(f)]);
  const fFix64 = (num, x) => { const d = new DataView(new ArrayBuffer(8)); d.setFloat64(0, x, true); return cat([key(num, 1), new Uint8Array(d.buffer)]); };
  const records = list => cat(list.flatMap(r => [varint(r.length), r]));
  const point = (x, y) => cat([fFix32(1, x), fFix32(2, y)]);
  const rect = (x, y, w, h) => cat([fMsg(1, point(x, y)), fMsg(2, point(w, h))]);
  const colour = rgba => cat(rgba.map((v, i) => v !== 0 ? fFix32(i + 1, v) : new Uint8Array(0)));

  // ---- identifiers ----------------------------------------------------------------------
  const uuid = () => crypto.randomUUID().toUpperCase();
  const rand32 = () => crypto.getRandomValues(new Uint32Array(1))[0];
  function makeIds() {
    const r = crypto.getRandomValues(new Uint32Array(2));
    const dev = (((BigInt(r[0]) << 32n) | BigInt(r[1])) & ((1n << 63n) - 1n)) || 1n;
    let seq = BigInt(Date.now()), counter = 0;
    return {
      dev, nowMs: Date.now(), uuid, nonce: rand32,
      clock: version => cat([fVar(1, version), fVar(2, rand32())]),
      seq: () => { seq += 1n; return seq; },
      element: () => ++counter,
    };
  }
  function pageUuids() { // P ends in 0-E, N = P with the last hex digit + 1
    const p0 = uuid(), last = Math.floor(Math.random() * 15);
    const p = p0.slice(0, -1) + last.toString(16).toUpperCase();
    return [p, p.slice(0, -1) + (last + 1).toString(16).toUpperCase()];
  }
  const orderKey = index => ORDER_PREFIX + (index + 1).toString(36).toUpperCase().padStart(4, '0');

  // ---- Apple LZ4 frame (literal-only blocks; deflate in the ZIP layer removes redundancy) --
  function lz4Literals(data) {
    const n = data.length, head = [];
    if (n < 15) head.push(n << 4);
    else { head.push(0xf0); let rest = n - 15; while (rest >= 255) { head.push(255); rest -= 255; } head.push(rest); }
    return cat([Uint8Array.from(head), data]);
  }
  function appleLz4(data) {
    const parts = [];
    for (let s = 0; s < data.length; s += LZ4_BLOCK) {
      const chunk = data.subarray(s, s + LZ4_BLOCK), block = lz4Literals(chunk);
      const head = new Uint8Array(12); head.set(enc.encode('bv41'), 0);
      const dv = new DataView(head.buffer); dv.setUint32(4, chunk.length, true); dv.setUint32(8, block.length, true);
      parts.push(head, block);
    }
    parts.push(enc.encode('bv4$'));
    return cat(parts);
  }

  // ---- TPL flat stroke (constant width, quadratic segments) --------------------------------
  function flatImage({ width, starts, quads }) {
    const flags = [0, ...quads.map(() => 1)];
    const parts = [u16(2), u32(f32bits(width)), u32(flags.length)];
    for (const f of flags) parts.push(u16(f));
    parts.push(u32(starts.length));
    for (const [x, y] of starts) parts.push(u32(f32bits(x)), u32(f32bits(y)));
    parts.push(u32(quads.length));
    for (const q of quads) for (const v of q) parts.push(u32(f32bits(v)));
    parts.push(u16(1), u32(0)); // trailer word 1, empty dash array
    const body = cat(parts), fmt = enc.encode(FLAT_FORMAT + '\0');
    return cat([enc.encode('tpl\0'), u32(8 + fmt.length + body.length), fmt, body]);
  }
  // Same curve as the on-screen renderer: quadratics with the points as controls and segment midpoints as ends.
  function flatFromPoints(points, width) {
    if (points.length === 1) {
      const [x, y] = points[0];
      return { width, starts: [[x, y]], quads: [[x + DASH / 2, y, x + DASH, y]] };
    }
    const quads = [];
    for (let i = 1; i < points.length - 1; i++) {
      const p = points[i], q = points[i + 1];
      quads.push([p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2]);
    }
    const a = points[points.length - 2], b = points[points.length - 1];
    quads.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, b[0], b[1]]);
    return { width, starts: [points[0]], quads };
  }

  // ---- records ----------------------------------------------------------------------------
  function metadata(ids, element, clock, attachment) {
    return cat([fBytes(1, element), fMsg(2, clock), attachment ? fBytes(4, attachment) : new Uint8Array(0),
      fVar(8, ids.dev), fVar(9, ids.element()), fVar(14, ELEMENT_MAGIC), fVar(16, SCHEMA)]);
  }
  function strokeRecords(ids, stroke, drawIndex) {
    const element = ids.uuid(), clock = ids.clock(2);
    const pts = stroke.points.map(([x, y]) => [x * CANVAS_PER_PT, y * CANVAS_PER_PT]);
    const frame = appleLz4(flatImage(flatFromPoints(pts, stroke.width * WIDTH_PER_PT)));
    const body = cat([
      fBytes(1, element), fBytes(2, frame), fMsg(4, colour([...stroke.color, 1])),
      fBytes(6, ''), fMsg(7, fMsg(1, cat([fVar(1, drawIndex), fVar(2, ids.nonce())]))),
      fBytes(9, ''), fMsg(15, clock), fBytes(20, ''), fVar(21, SCHEMA),
    ]);
    return [metadata(ids, element, clock), fMsg(7, body)];
  }

  // ---- the event log ----------------------------------------------------------------------
  function events(ids, o) {
    const stamp = () => cat([fFix64(10, ids.nowMs), fBytes(11, ids.uuid())]);
    const trio = first => cat([fVar(first, ids.dev), fVar(first + 1, ids.seq()), fVar(first + 2, SCHEMA)]);
    const reg = v => cat([v, fMsg(2, ids.clock(1))]);
    const ev = (entity, num, body) => cat([fBytes(1, entity), fMsg(num, body)]);
    const list = [];
    list.push(ev(o.doc, 30, cat([
      fBytes(1, o.doc), fMsg(2, reg(fBytes(1, o.title))), fMsg(3, reg(fBytes(1, DOC_CONSTANT))),
      fMsg(6, reg(fBytes(1, 'P'))), fMsg(7, reg(fBytes(1, DOC_CONSTANT))), fBytes(9, 'auto'), stamp(),
      fVar(13, ids.dev), fVar(14, ids.seq()), fBytes(17, ''), fBytes(18, ''),
      fMsg(19, fMsg(2, ids.clock(1))), fVar(20, SCHEMA),
    ])));
    list.push(ev(o.att, 6, cat([
      fBytes(1, o.att), fBytes(2, o.att), fVar(5, o.paperPdf.length), fBytes(6, o.doc), stamp(),
      fMsg(12, cat([fVar(1, 1), fVar(2, 1)])), trio(14),
    ])));
    list.push(ev(o.tmpl, 2, cat([
      fBytes(1, o.doc), fBytes(2, o.tmpl), fBytes(4, o.att), fVar(5, 1), fVar(6, 1),
      fMsg(8, point(o.canvasW, o.canvasH)), fBytes(9, o.tmplName), stamp(),
      fMsg(12, fMsg(2, ids.clock(1))), fMsg(13, fMsg(2, ids.clock(1))),
      fVar(15, ids.dev), fVar(16, ids.seq()), fMsg(17, reg(fVar(1, 1))),
      fMsg(19, fMsg(2, ids.clock(1))), fVar(21, SCHEMA),
    ])));
    for (const p of o.pages) list.push(ev(p.P, 54, cat([
      fBytes(1, o.doc), fBytes(2, p.P), fMsg(3, reg(fBytes(1, o.tmpl))), fMsg(4, reg(fBytes(1, orderKey(p.index)))),
      stamp(), trio(13), fMsg(17, reg(hex(PAGE_COLOUR_HEX))),
    ])));
    for (const p of o.pages) list.push(ev(p.N, 105, cat([
      fVar(1, 1), fBytes(2, o.doc), fBytes(4, p.N), fBytes(6, 'auto'), stamp(), trio(13),
    ])));
    list.push(ev(o.doc, 10, cat([
      fBytes(1, o.doc), fBytes(2, o.pages[0].P), fBytes(3, 'PagingViewServiceUpdater:' + ids.uuid()), stamp(), trio(13),
    ])));
    for (const p of o.pages) if (p.content.length) list.push(ev(p.N, 102, cat([
      fBytes(1, p.N), stamp(), trio(13), fBytes(16, o.doc),
    ])));
    return records(list);
  }

  // ---- ZIP (deflate when the browser can, otherwise stored) -------------------------------
  const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(data) { let c = 0xFFFFFFFF; for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  async function deflateRaw(data) {
    if (typeof CompressionStream === 'undefined') return null;
    const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function zip(members) {
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const locals = [], centrals = [];
    let offset = 0;
    for (const [name, data] of members) {
      const nameB = enc.encode(name), deflated = await deflateRaw(data);
      const comp = deflated ?? data, method = deflated ? 8 : 0, crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, method, true); lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, comp.length, true); lh.setUint32(22, data.length, true);
      lh.setUint16(26, nameB.length, true);
      const local = cat([new Uint8Array(lh.buffer), nameB, comp]);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, (3 << 8) | 20, true); ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true); ch.setUint16(10, method, true); ch.setUint16(12, dosTime, true);
      ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true); ch.setUint32(20, comp.length, true);
      ch.setUint32(24, data.length, true); ch.setUint16(28, nameB.length, true);
      ch.setUint32(38, (0o100644 << 16) >>> 0, true); ch.setUint32(42, offset, true);
      centrals.push(cat([new Uint8Array(ch.buffer), nameB]));
      locals.push(local); offset += local.length;
    }
    const cd = cat(centrals), end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, members.length, true); end.setUint16(10, members.length, true);
    end.setUint32(12, cd.length, true); end.setUint32(16, offset, true);
    return new Blob([cat([...locals, cd, new Uint8Array(end.buffer)])], { type: 'application/zip' });
  }

  // ---- public: build the .goodnotes file --------------------------------------------------
  // pages: [[{ points: [[x, y] pt], width: pt, color: [r, g, b] 0..1 }]], one array per page.
  // paperPdf: a PDF with one page of widthPt x heightPt pt, used as the background of every page.
  async function build({ title, widthPt, heightPt, pages, paperPdf }) {
    const ids = makeIds();
    const doc = ids.uuid(), att = ids.uuid(), tmpl = ids.uuid();
    const size = Math.abs(widthPt - 595.28) < 1 && Math.abs(heightPt - 841.89) < 1 ? 'a4' : 'standard';
    const outs = pages.map((strokes, index) => {
      const [P, N] = pageUuids();
      const recs = []; let drawIndex = 0;
      for (const stroke of strokes) {
        if (!stroke.points.length) continue;
        drawIndex++;
        recs.push(...strokeRecords(ids, stroke, drawIndex));
      }
      return { index, P, N, content: records(recs) };
    });
    const o = {
      doc, att, tmpl, paperPdf,
      tmplName: `${tmpl}_${size}_1_1 - White`,
      canvasW: widthPt * CANVAS_PER_PT, canvasH: heightPt * CANVAS_PER_PT, pages: outs,
    };
    o.title = title || 'Meine Notizen';
    const members = [
      ['index.search.pb', new Uint8Array(0)],
      ['index.notes.pb', records(outs.map(p => cat([fBytes(1, p.N), fBytes(2, 'notes/' + p.N)])))],
      ...outs.map(p => ['notes/' + p.N, p.content]),
      ['index.events.pb', events(ids, o)],
      ['thumbnail.jpg', hex(THUMB_HEX)],
      ['index.attachments.pb', records([cat([fBytes(1, att), fBytes(2, 'attachments/' + att)])])],
      ['attachments/' + att, paperPdf],
      ['schema.pb', Uint8Array.from([0x08, SCHEMA])],
    ];
    return zip(members);
  }

  return { build, hexToBytes: hex };
})();

// ---- wiring: the export dialog button ---------------------------------------------------
// Uses the app's globals (state, pages, dimensions, drawPaper, VectorPage, PDFLib, ...). Runs at
// click time, so the load order of the other scripts does not matter.
async function goodNotesFile() {
  const [w, h] = dimensions(), PT = 0.75, s = state.settings, unit = s.size / REF_XHEIGHT;
  const rgb = [1, 3, 5].map(i => parseInt(s.ink.slice(i, i + 2), 16) / 255);
  let skipped = 0;
  const strokes = pages.map(glyphs => {
    const out = [];
    for (const g of glyphs) {
      if (!g.v) { if (s.fallback && !/^\s$/u.test(g.char)) skipped++; continue; }
      // The same transform as drawPageInk(): offset, scale, slant, then placement on the page.
      const sx = unit * s.width / 100 * g.stretch, sy = unit * g.stretch;
      const width = g.v.pen / 2.5 * s.strokeWidth * PT;
      for (const stroke of g.v.strokes) {
        out.push({ width, color: rgb, points: stroke.map(([x, y]) => {
          const X = (x - g.b.minX) * sx, Y = (y - g.baseline) * sy;
          return [(X + g.slant * Y + g.x) * PT, (Y + g.y) * PT];
        }) });
      }
    }
    return out;
  });
  // Paper background: the same paper that the PDF export draws, without ink.
  const paperDoc = await PDFLib.PDFDocument.create();
  paperDoc.setCreator('Feder');
  const page = paperDoc.addPage([w * PT, h * PT]);
  page.pushOperators(PDFLib.pushGraphicsState(), PDFLib.concatTransformationMatrix(PT, 0, 0, -PT, 0, h * PT));
  const paper = new VectorPage();
  drawPaper(paper, w, h);
  await paper.toPDF(paperDoc, page, new Map());
  page.pushOperators(PDFLib.popGraphicsState());
  const paperPdf = new Uint8Array(await paperDoc.save());
  const title = (document.querySelector('#export-name').value.trim() || 'Meine Notizen');
  const blob = await GoodNotesExport.build({ title, widthPt: w * PT, heightPt: h * PT, pages: strokes, paperPdf });
  return { blob, skipped };
}
(function bindGoodNotesExport() {
  const button = document.querySelector('#download-goodnotes');
  if (!button) return;
  let busy = false;
  button.addEventListener('click', async () => {
    if (busy) return;
    if (!allText().trim()) { toast('Füge zuerst einen Text ein.'); return; }
    busy = true; button.disabled = true;
    try {
      renderPreview();
      const { blob, skipped } = await goodNotesFile();
      download(blob, filename('.goodnotes'));
      toast(skipped
        ? `.goodnotes ist bereit. ${skipped} Zeichen aus der Beispielschrift sind nicht enthalten.`
        : '.goodnotes ist bereit.');
    } catch (error) {
      toast('GoodNotes-Export fehlgeschlagen. Bitte mit einem kürzeren Text erneut versuchen.');
    } finally { busy = false; button.disabled = false; }
  });
})();
