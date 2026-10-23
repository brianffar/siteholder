/**
 * Siteholder caption API (Google Apps Script web app).
 * Standalone script. Deploy: Deploy > New deployment > Web app,
 * Execute as: Me, Who has access: Anyone.
 * Script property SECRET must match the Worker secret SHEET_SECRET.
 * Called only by the Cloudflare Worker (admin/api/captions), never by the browser.
 *
 * GET  ?secret=...            -> {posts:{<n>:{caption,status,reel}}}  (n = Avery row - 4)
 * POST {secret,action:'reel',kind,key,reel,image} -> writes the reel link (Releases!S, or Outreach!C and D for artists) and flips Draft rows to Scheduled once reel and caption exist
 * POST {secret,n,caption}     -> writes the caption into the source cell
 *   Release rows  -> Releases column Q, matched on catalog # (column B)
 *   Spotlight rows -> Artists column O, matched on artist name (column A)
 *   Announcement rows -> Avery column K itself
 */
var SHEET_ID = '1zE4oZ7jLhZAfK9lYzC-XOMzmU4CLyA-j4qvwg8JVDeg';

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function ok_(s) {
  return s && s === PropertiesService.getScriptProperties().getProperty('SECRET');
}
function doGet(e) {
  if (!ok_(e.parameter.secret)) return out_({error: 'forbidden'});
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Avery');
  var last = sh.getLastRow();
  if (last < 5) return out_({posts: {}});
  var v = sh.getRange(5, 1, last - 4, 13).getDisplayValues();
  var posts = {};
  v.forEach(function (r, i) {
    if (!r[6]) return;
    posts[i + 1] = {caption: r[10], status: r[12], reel: r[9]};
  });
  return out_({posts: posts});
}
function doPost(e) {
  var b;
  try { b = JSON.parse(e.postData.contents); } catch (x) { return out_({error: 'bad json'}); }
  if (!ok_(b.secret)) return out_({error: 'forbidden'});
  if (b.action === 'reel') return reel_(b);
  var n = Number(b.n), cap = String(b.caption == null ? '' : b.caption);
  if (!n || n < 1) return out_({error: 'bad row'});
  if (cap.length > 2200) return out_({error: 'caption over 2200 characters'});
  var ss = SpreadsheetApp.openById(SHEET_ID), av = ss.getSheetByName('Avery');
  var row = n + 4, r = av.getRange(row, 1, 1, 13).getDisplayValues()[0];
  var type = r[5], key = r[6], status = r[12];
  if (!key) return out_({error: 'no such post'});
  if (status === 'Posted') return out_({error: 'already posted'});
  var tgt, col, keyCol;
  if (type === 'Release') { tgt = ss.getSheetByName('Releases'); col = 17; keyCol = 2; }
  else if (type === 'Artist spotlight') { tgt = ss.getSheetByName('Artists'); col = 15; keyCol = 1; }
  else { av.getRange(row, 11).setValue(cap); return out_({ok: true, where: 'Avery'}); }
  var keys = tgt.getRange(1, keyCol, tgt.getLastRow(), 1).getValues();
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i][0]) === key) {
      tgt.getRange(i + 1, col).setValue(cap);
      return out_({ok: true, where: tgt.getName() + '!' + tgt.getRange(i + 1, col).getA1Notation()});
    }
  }
  return out_({error: 'source row not found for ' + key});
}

function reel_(b) {
  var kind = b.kind, key = String(b.key || ''), reel = String(b.reel || ''), image = String(b.image || '');
  if (!key || !/^https:\/\/audio\.siteholderrecords\.com\/share\/reels\/[a-z0-9-]+\.mp4$/.test(reel)) return out_({error: 'bad reel link'});
  if (image && !/^https:\/\/audio\.siteholderrecords\.com\/share\/images\/[a-z0-9-]+\.png$/.test(image)) return out_({error: 'bad image link'});
  var ss = SpreadsheetApp.openById(SHEET_ID), where = [];
  if (kind === 'release') {
    var rs = ss.getSheetByName('Releases'), rk = rs.getRange(1, 2, rs.getLastRow(), 1).getValues(), ri = -1;
    for (var i = 0; i < rk.length; i++) if (String(rk[i][0]) === key) { ri = i + 1; break; }
    if (ri < 0) return out_({error: 'release not found in Releases: ' + key});
    rs.getRange(ri, 19).setValue(reel); where.push('Releases!S' + ri);
  } else if (kind === 'artist') {
    var os = ss.getSheetByName('Outreach'), ok = os.getRange(1, 1, os.getLastRow(), 1).getValues(), oi = -1;
    for (var k = 0; k < ok.length; k++) if (String(ok[k][0]) === key) { oi = k + 1; break; }
    if (oi < 0) return out_({error: 'artist not found in the Outreach tab: ' + key});
    os.getRange(oi, 3).setValue(reel); where.push('Outreach!C' + oi);
    if (image) { os.getRange(oi, 4).setValue(image); where.push('Outreach!D' + oi); }
  } else return out_({error: 'bad kind'});
  SpreadsheetApp.flush();
  var av = ss.getSheetByName('Avery'), last = av.getLastRow(), flipped = [];
  if (last >= 5) {
    var v = av.getRange(5, 1, last - 4, 13).getDisplayValues(), want = kind === 'release' ? 'Release' : 'Artist spotlight';
    v.forEach(function (r, i) {
      if (r[5] === want && r[6] === key && r[12] === 'Draft' && r[9] && r[10]) {
        av.getRange(i + 5, 13).setValue('Scheduled'); flipped.push(i + 1);
      }
    });
  }
  return out_({ok: true, where: where.join(', '), flipped: flipped});
}
