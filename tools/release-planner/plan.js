/* Release Planner logic: a release date in, a dated checklist out. Plain dates only (no time zones). */
(function(root){
  var DAY=86400000;
  /* d = days before the release (negative) or after it (positive). v = only when the release includes vinyl. */
  var TASKS=[
    {id:'v1',d:-154,g:'Vinyl',v:1,t:'Send masters to the pressing plant and place the order',h:'Lead times vary a lot between plants. Ask yours for current turnaround and adjust these dates.'},
    {id:'v2',d:-126,g:'Vinyl',v:1,t:'Test pressings arrive: listen, approve or request changes',h:'Check every side on more than one system.'},
    {id:'v3',d:-98,g:'Vinyl',v:1,t:'Sleeve, labels and stickers approved with the printer',h:'Get a proof before the full print run.'},
    {id:'t1',d:-84,g:'Prepare',t:'Lock the tracklist and final mixes',h:'Everyone on the release signs off on the versions before mastering.'},
    {id:'t2',d:-77,g:'Prepare',t:'Send to mastering',h:'Allow a week for revisions.'},
    {id:'t3',d:-70,g:'Prepare',t:'Artwork in progress',h:'Ask for 3000 x 3000 px for digital, plus the sleeve template if you are pressing vinyl.'},
    {id:'t4',d:-63,g:'Prepare',t:'Sign split sheets and remix agreements',h:'Get it in writing before anything is public.'},
    {id:'t5',d:-56,g:'Prepare',t:'Masters approved and artwork final'},
    {id:'t6',d:-49,g:'Prepare',t:'Gather the metadata',h:'Titles, mix names, credits, ISRCs, UPC, catalog number, genre and release date.'},
    {id:'v4',d:-28,g:'Vinyl',v:1,t:'Pressed records delivered: check a few copies',h:'Look for warps, noise and label or sleeve mistakes.'},
    {id:'v5',d:-14,g:'Vinyl',v:1,t:'List the vinyl in your online stores and open pre-orders'},
    {id:'d1',d:-42,g:'Deliver',t:'Upload to your distributor',h:'Many stores want four weeks or more of lead time. Check yours.'},
    {id:'d2',d:-35,g:'Deliver',t:'Pitch to stores and playlists',h:'Deadlines are tied to the release date, so check each store.'},
    {id:'d3',d:-35,g:'Deliver',t:'Set up the Bandcamp page and a pre-save or pre-order link'},
    {id:'p1',d:-28,g:'Promote',t:'Build the release link page and preview clips'},
    {id:'p2',d:-21,g:'Promote',t:'Send promos to DJs and press',h:'Short preview clips plus one private download link.'},
    {id:'p3',d:-14,g:'Promote',t:'Announce the release and start teaser posts'},
    {id:'p4',d:-7,g:'Promote',t:'Final check of every link, credit and image',h:'Then schedule the release week posts.'},
    {id:'p5',d:-3,g:'Promote',t:'Reminder post and email to your list'},
    {id:'r1',d:0,g:'Release',t:'Release day: confirm it is live in each store, post it and send the email'},
    {id:'a1',d:7,g:'After',t:'Thank supporters and follow up with DJs who played it',h:'Collect charts and support for your next press release.'},
    {id:'a2',d:14,g:'After',t:'Pay what is owed, then archive masters, artwork and paperwork',h:'Update your catalog too.'}
  ];
  var GROUPS=['Vinyl','Prepare','Deliver','Promote','Release','After'];
  function parse(s){var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||'');if(!m)return null;var t=Date.UTC(+m[1],+m[2]-1,+m[3]);var d=new Date(t);return d.getUTCFullYear()===+m[1]&&d.getUTCMonth()===+m[2]-1&&d.getUTCDate()===+m[3]?t:null}
  function iso(t){var d=new Date(t);return d.getUTCFullYear()+'-'+('0'+(d.getUTCMonth()+1)).slice(-2)+'-'+('0'+d.getUTCDate()).slice(-2)}
  function fmt(t){return new Date(t).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric',timeZone:'UTC'})}
  function fmtShort(t){return new Date(t).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'})}
  function rel(d){
    if(d===0)return 'release day';
    var a=Math.abs(d),w=Math.round(a/7*10)/10,txt=a%7===0?(a/7)+(a/7===1?' week':' weeks'):a+(a===1?' day':' days');
    return txt+(d<0?' before':' after');
  }
  function build(relIso,vinyl){
    var base=parse(relIso);if(base===null)return [];
    return TASKS.filter(function(x){return !x.v||vinyl}).map(function(x){
      return {id:x.id,g:x.g,t:x.t,h:x.h||'',d:x.d,at:base+x.d*DAY,iso:iso(base+x.d*DAY)};
    }).sort(function(a,b){return a.at-b.at||GROUPS.indexOf(a.g)-GROUPS.indexOf(b.g)});
  }
  function isFriday(relIso){var t=parse(relIso);return t!==null&&new Date(t).getUTCDay()===5}
  function esc(s){return String(s).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n')}
  function ics(name,list){
    var L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Siteholder Records//Release Planner//EN','CALSCALE:GREGORIAN'];
    list.forEach(function(x){
      var ds=x.iso.replace(/-/g,''),de=iso(x.at+DAY).replace(/-/g,'');
      L.push('BEGIN:VEVENT','UID:'+x.id+'-'+ds+'@siteholderrecords.com','DTSTAMP:'+stamp(),'DTSTART;VALUE=DATE:'+ds,'DTEND;VALUE=DATE:'+de,'SUMMARY:'+esc((name?name+': ':'')+x.t));
      if(x.h)L.push('DESCRIPTION:'+esc(x.h));
      L.push('END:VEVENT');
    });
    L.push('END:VCALENDAR');return L.join('\r\n')+'\r\n';
  }
  function stamp(){var d=new Date();return d.getUTCFullYear()+('0'+(d.getUTCMonth()+1)).slice(-2)+('0'+d.getUTCDate()).slice(-2)+'T'+('0'+d.getUTCHours()).slice(-2)+('0'+d.getUTCMinutes()).slice(-2)+('0'+d.getUTCSeconds()).slice(-2)+'Z'}
  function text(name,relIso,list,checks){
    var out=[(name||'Release plan')+' ('+fmt(parse(relIso))+')',''];
    list.forEach(function(x){out.push((checks&&checks[x.id]?'[x] ':'[ ] ')+fmtShort(x.at)+'  '+x.t+(x.h?' ('+x.h+')':''))});
    return out.join('\n');
  }
  var api={TASKS:TASKS,GROUPS:GROUPS,parse:parse,iso:iso,fmt:fmt,fmtShort:fmtShort,rel:rel,build:build,isFriday:isFriday,ics:ics,text:text,DAY:DAY};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Plan=api;
})(typeof window!=='undefined'?window:this);
