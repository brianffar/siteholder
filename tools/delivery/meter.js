/* Loudness meter: integrated loudness (ITU-R BS.1770-4 with gating), momentary and short-term loudness,
   sample peak, true peak (4x oversampling), clipping runs, stereo correlation and DC offset.
   Works on arrays of Float32Array channels. No dependencies. */
(function(root){
  var OFFSET=-0.691;
  function kCoefs(fs){
    /* Stage 1: the high shelf of the K-weighting curve. Stage 2: the 38 Hz high-pass.
       Written so the coefficients at 48 kHz equal the published ones, and they scale to other sample rates. */
    var f0=1681.974450955533,G=3.999843853973347,Q=0.7071752369554196;
    var K=Math.tan(Math.PI*f0/fs),Vh=Math.pow(10,G/20),Vb=Math.pow(Vh,0.4996667741545416),a0=1+K/Q+K*K;
    var shelf={b:[(Vh+Vb*K/Q+K*K)/a0,2*(K*K-Vh)/a0,(Vh-Vb*K/Q+K*K)/a0],a:[2*(K*K-1)/a0,(1-K/Q+K*K)/a0]};
    var f1=38.13547087602444,Q1=0.5003270373238773,K1=Math.tan(Math.PI*f1/fs),h0=1+K1/Q1+K1*K1;
    var hp={b:[1,-2,1],a:[2*(K1*K1-1)/h0,(1-K1/Q1+K1*K1)/h0]};
    return {shelf:shelf,hp:hp};
  }
  function db(p){return p>0?10*Math.log10(p):-Infinity}
  function toDb(a){return a>0?20*Math.log10(a):-Infinity}

  /* Measures loudness and level statistics, a chunk of samples at a time. */
  function Meter(fs,nch){
    this.fs=fs;this.nch=nch;this.hop=Math.round(fs*0.1);
    var k=kCoefs(fs);this.k=k;
    this.st=[];for(var c=0;c<nch;c++)this.st.push({x1:0,x2:0,y1:0,y2:0,z1:0,z2:0,w1:0,w2:0});
    this.acc=new Float64Array(nch);this.inHop=0;this.subs=[];for(c=0;c<nch;c++)this.subs.push([]);
    this.n=0;this.peak=0;this.run=new Int32Array(nch);this.clipRuns=0;this.clipSamples=0;
    this.sum=new Float64Array(nch);this.sumsq=new Float64Array(nch);this.sumLR=0;this.maxDiff=0;
  }
  /* chs: array of Float32Array (same length); processes samples a..b-1 */
  Meter.prototype.process=function(chs,a,b){
    var nch=this.nch,sh=this.k.shelf,hp=this.k.hp,hop=this.hop,CL=0.9999;
    for(var i=a;i<b;i++){
      for(var c=0;c<nch;c++){
        var x=chs[c][i],s=this.st[c];
        var y=sh.b[0]*x+sh.b[1]*s.x1+sh.b[2]*s.x2-sh.a[0]*s.y1-sh.a[1]*s.y2;
        s.x2=s.x1;s.x1=x;s.y2=s.y1;s.y1=y;
        var z=hp.b[0]*y+hp.b[1]*s.z1+hp.b[2]*s.z2-hp.a[0]*s.w1-hp.a[1]*s.w2;
        s.z2=s.z1;s.z1=y;s.w2=s.w1;s.w1=z;
        this.acc[c]+=z*z;
        var ax=x<0?-x:x;if(ax>this.peak)this.peak=ax;
        if(ax>=CL){this.run[c]++;this.clipSamples++;if(this.run[c]===3)this.clipRuns++}else this.run[c]=0;
        this.sum[c]+=x;this.sumsq[c]+=x*x;
      }
      if(nch>1){var l=chs[0][i],r=chs[1][i];this.sumLR+=l*r;var d=l-r;if(d<0)d=-d;if(d>this.maxDiff)this.maxDiff=d}
      if(++this.inHop===hop){for(c=0;c<nch;c++){this.subs[c].push(this.acc[c]);this.acc[c]=0}this.inHop=0}
    }
    this.n+=b-a;
  };
  /* gated integrated loudness, plus the loudness-over-time lines */
  Meter.prototype.loudness=function(){
    var nch=this.nch,hop=this.hop,m=this.subs[0].length,blocks=[],mom=[],i,c;
    for(i=0;i+4<=m;i++){
      var p=0;
      for(c=0;c<nch;c++){var s=0;for(var j=0;j<4;j++)s+=this.subs[c][i+j];p+=s/(4*hop)}
      blocks.push(p);mom.push(OFFSET+db(p));
    }
    var sh=[];
    for(i=0;i+30<=m;i++){
      var q=0;
      for(c=0;c<nch;c++){var s2=0;for(var j2=0;j2<30;j2++)s2+=this.subs[c][i+j2];q+=s2/(30*hop)}
      sh.push(OFFSET+db(q));
    }
    var abs=[];for(i=0;i<blocks.length;i++)if(mom[i]>-70)abs.push(blocks[i]);
    var integrated=-Infinity;
    if(abs.length){
      var mean=0;abs.forEach(function(v){mean+=v});mean/=abs.length;
      var thr=OFFSET+db(mean)-10,rel=[];
      for(i=0;i<blocks.length;i++)if(mom[i]>-70&&mom[i]>thr)rel.push(blocks[i]);
      if(rel.length){var m2=0;rel.forEach(function(v){m2+=v});integrated=OFFSET+db(m2/rel.length)}
    }
    var mMax=-Infinity,sMax=-Infinity;mom.forEach(function(v){if(v>mMax)mMax=v});sh.forEach(function(v){if(v>sMax)sMax=v});
    return {integrated:integrated,momentary:mom,momentaryMax:mMax,shortTermMax:sMax,hopSeconds:0.1};
  };
  Meter.prototype.stats=function(){
    var n=this.n,nch=this.nch,dc=[],c,out={};
    for(c=0;c<nch;c++)dc.push(n?this.sum[c]/n:0);
    out.dc=dc;out.samplePeakDb=toDb(this.peak);out.clipRuns=this.clipRuns;out.clipSamples=this.clipSamples;
    if(nch>1){
      var den=Math.sqrt(this.sumsq[0]*this.sumsq[1]);out.correlation=den>0?this.sumLR/den:1;out.identical=this.maxDiff<1e-6;
    }else{out.correlation=1;out.identical=false}
    return out;
  };

  /* True peak: 4x oversampling with a windowed-sinc interpolator (16 taps per phase). Returns the largest magnitude. */
  var KT=(function(){
    var out=[];
    for(var p=1;p<=3;p++){
      var h=[],s=0;
      for(var k=-7;k<=8;k++){
        var t=k-p/4,sinc=Math.sin(Math.PI*t)/(Math.PI*t),w=0.5+0.5*Math.cos(Math.PI*t/8);
        h.push(sinc*w);s+=sinc*w;
      }
      out.push(h.map(function(v){return v/s}));
    }
    return out;
  })();
  function truePeakChunk(x,a,b){
    var n=x.length,mx=0,i,p,k,v,h;
    for(i=a;i<b;i++){
      var ax=x[i]<0?-x[i]:x[i];if(ax>mx)mx=ax;
      if(i+8<n&&i>=7){
        for(p=0;p<3;p++){
          h=KT[p];v=0;
          for(k=0;k<16;k++)v+=x[i-7+k]*h[k];
          if(v<0)v=-v;if(v>mx)mx=v;
        }
      }else{
        for(p=0;p<3;p++){
          h=KT[p];v=0;
          for(k=0;k<16;k++){var j=i-7+k;if(j>=0&&j<n)v+=x[j]*h[k]}
          if(v<0)v=-v;if(v>mx)mx=v;
        }
      }
    }
    return mx;
  }

  /* all in one go (used by the tests and small files) */
  function analyze(chs,fs){
    var m=new Meter(fs,chs.length),n=chs[0].length;m.process(chs,0,n);
    var tp=0;chs.forEach(function(ch){var v=truePeakChunk(ch,0,n);if(v>tp)tp=v});
    var l=m.loudness(),s=m.stats();
    return {integrated:l.integrated,shortTermMax:l.shortTermMax,momentaryMax:l.momentaryMax,samplePeakDb:s.samplePeakDb,truePeakDb:toDb(tp),clipRuns:s.clipRuns,correlation:s.correlation,identical:s.identical,dc:s.dc};
  }
  var api={Meter:Meter,kCoefs:kCoefs,truePeakChunk:truePeakChunk,analyze:analyze,toDb:toDb};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LoudMeter=api;
})(typeof window!=='undefined'?window:this);
