// Original Tripod synthesis from the user-provided APEX-Animated-Entity HTML.
// Oscillators, formants, compressor, convolution and timing are preserved.
// Only the context/output are injected to retain HUD volume, mute and speech ducking.
export function createOriginalHorn(context,destination){
const DU = .75;
let NU = .72;
const c_ = () => TE.full;
let rt = null
  , Lm = null
  , bo = null
  , vy = null
  , Um = null
  , Dm = null
  , Bm = null
  , zm = null
  , bd = null
  , jv = []
  , Hm = {};
function l1(i, e, t) {
    const n = Math.floor(i.sampleRate * e)
      , r = i.createBuffer(2, n, i.sampleRate);
    for (let o = 0; o < 2; o++) {
        const l = r.getChannelData(o);
        for (let f = 0; f < n; f++)
            l[f] = (Math.random() * 2 - 1) * Math.pow(1 - f / n, t)
    }
    return r
}
function a0(i) {
    const t = new Float32Array(1024);
    for (let n = 0; n < 1024; n++) {
        const r = n * 2 / 1024 - 1;
        t[n] = (1 + i) * r / (1 + i * Math.abs(r))
    }
    return t
}
function f_() {
    if (rt)
        return rt;
    rt = context,
    bo = rt.createDynamicsCompressor(),
    bo.threshold.value = -8,
    bo.knee.value = 12,
    bo.ratio.value = 3.5,
    bo.attack.value = .006,
    bo.release.value = .25,
    Lm = rt.createGain(),
    Lm.gain.value = NU * .62,
    vy = rt.createGain(),
    Bm = rt.createConvolver(),
    Bm.buffer = l1(rt, 3.2, 2.4),
    zm = rt.createConvolver(),
    zm.buffer = l1(rt, 6, 1.7);
    const i = DU;
    Um = rt.createGain(),
    Um.gain.value = i,
    Dm = rt.createGain(),
    Dm.gain.value = i * 1.15,
    vy.connect(bo),
    Bm.connect(Um),
    Um.connect(bo),
    zm.connect(Dm),
    Dm.connect(bo),
    bo.connect(Lm),
    Lm.connect(destination);
    const e = Math.floor(rt.sampleRate * 2);
    bd = rt.createBuffer(1, e, rt.sampleRate);
    const t = bd.getChannelData(0);
    for (let n = 0; n < e; n++)
        t[n] = Math.random() * 2 - 1;
    return rt
}
const Gu = () => {
    const i = f_();
    return i.state === "suspended" && i.resume(),
    i.currentTime
}
;
function Ta(i, e, t) {
    if (i.connect(vy),
    e > 0) {
        const n = rt.createGain();
        n.gain.value = e,
        i.connect(n),
        n.connect(Bm)
    }
    if (t > 0) {
        const n = rt.createGain();
        n.gain.value = t,
        i.connect(n),
        n.connect(zm)
    }
}
const jr = i => {
    jv.push(i),
    i.onended = () => {
        jv = jv.filter(e => e !== i)
    }
}
;
function Ef({f: i=440, ratio: e=2.76, index: t=600, indexEnd: n=8, dur: r=.2, peak: o=.18, attack: l=.012, delay: f=0, fEnd: d=null, detune: p=0, send: m=.45, big: g=0, type: v="sine", drive: x=0, t0: S=null}) {
    const A = (S ?? Gu()) + f
      , E = rt.createOscillator();
    E.type = v,
    E.detune.value = p,
    E.frequency.setValueAtTime(i, A),
    d && E.frequency.exponentialRampToValueAtTime(d, A + r);
    const M = rt.createOscillator();
    M.type = "sine",
    M.frequency.setValueAtTime(i * e, A),
    d && M.frequency.exponentialRampToValueAtTime(d * e, A + r);
    const C = rt.createGain();
    C.gain.setValueAtTime(Math.max(t, 1), A),
    C.gain.exponentialRampToValueAtTime(Math.max(n, 1), A + r),
    M.connect(C),
    C.connect(E.frequency);
    const b = rt.createGain();
    b.gain.setValueAtTime(1e-4, A),
    b.gain.exponentialRampToValueAtTime(o, A + l),
    b.gain.exponentialRampToValueAtTime(1e-4, A + r);
    let I = b;
    if (E.connect(b),
    x > 0) {
        const k = rt.createWaveShaper();
        k.curve = a0(x),
        b.connect(k),
        I = k
    }
    Ta(I, m, g),
    E.start(A),
    M.start(A),
    E.stop(A + r + .05),
    M.stop(A + r + .05),
    jr(E),
    jr(M)
}
function OU({from: i=400, to: e=2400, q: t=7, dur: n=.3, peak: r=.16, attack: o=.04, delay: l=0, type: f="bandpass", send: d=.55, big: p=0, t0: m=null}) {
    const g = (m ?? Gu()) + l
      , v = rt.createBufferSource();
    v.buffer = bd,
    v.loop = !0;
    const x = rt.createBiquadFilter();
    x.type = f,
    x.Q.value = t,
    x.frequency.setValueAtTime(i, g),
    x.frequency.exponentialRampToValueAtTime(e, g + n);
    const S = rt.createGain();
    S.gain.setValueAtTime(1e-4, g),
    S.gain.exponentialRampToValueAtTime(r, g + o),
    S.gain.exponentialRampToValueAtTime(1e-4, g + n),
    v.connect(x),
    x.connect(S),
    Ta(S, d, p),
    v.start(g),
    v.stop(g + n + .06),
    jr(v)
}
function bg({f: i=62, dur: e=.22, peak: t=.22, delay: n=0, fEnd: r=null, send: o=.15, big: l=0, drive: f=0, attack: d=.016, t0: p=null}) {
    const m = (p ?? Gu()) + n
      , g = rt.createOscillator();
    g.type = "sine",
    g.frequency.setValueAtTime(i, m),
    r && g.frequency.exponentialRampToValueAtTime(r, m + e);
    const v = rt.createGain();
    v.gain.setValueAtTime(1e-4, m),
    v.gain.exponentialRampToValueAtTime(t, m + d),
    v.gain.exponentialRampToValueAtTime(1e-4, m + e);
    let x = v;
    if (g.connect(v),
    f > 0) {
        const S = rt.createWaveShaper();
        S.curve = a0(f),
        v.connect(S),
        x = S
    }
    Ta(x, o, l),
    g.start(m),
    g.stop(m + e + .05),
    jr(g)
}
function u1({f: i=52, dur: e=4, peak: t=.5, bend: n=[.93, 1, 1.05, 1, .955], formants: r=[[205, 5, 1], [540, 7, .62], [1150, 9, .28]], drive: o=2.8, spread: l=.62, wobble: f=.75, shimmer: d=!1, send: p=.5, big: m=1, t0: g=null}) {
    const v = g ?? Gu()
      , x = rt.createGain()
      , S = [];
    [[-l, -9], [0, 0], [l, 11]].forEach( ([D,re]) => {
        const te = rt.createOscillator();
        te.type = "sawtooth",
        te.detune.value = re,
        te.frequency.setValueCurveAtTime(new Float32Array(n.map($ => i * $)), v, e);
        const oe = rt.createGain();
        if (oe.gain.value = .32,
        te.connect(oe),
        rt.createStereoPanner) {
            const $ = rt.createStereoPanner();
            $.pan.value = D,
            oe.connect($),
            $.connect(x)
        } else
            oe.connect(x);
        te.start(v),
        te.stop(v + e + .12),
        jr(te),
        S.push(te)
    }
    );
    const A = rt.createOscillator();
    A.type = "sine",
    A.frequency.value = f;
    const E = rt.createGain();
    E.gain.value = i * .014,
    A.connect(E),
    S.forEach(D => E.connect(D.frequency)),
    A.start(v),
    A.stop(v + e + .12),
    jr(A);
    const M = rt.createOscillator();
    M.type = "sine",
    M.frequency.setValueAtTime(i / 2, v);
    const C = rt.createGain();
    C.gain.value = .55,
    M.connect(C),
    C.connect(x),
    M.start(v),
    M.stop(v + e + .12),
    jr(M);
    const b = rt.createBufferSource();
    b.buffer = bd,
    b.loop = !0;
    const I = rt.createBiquadFilter();
    I.type = "bandpass",
    I.frequency.value = 430,
    I.Q.value = 1.1;
    const k = rt.createGain();
    k.gain.value = .07,
    b.connect(I),
    I.connect(k),
    k.connect(x),
    b.start(v),
    b.stop(v + e + .12),
    jr(b);
    const N = rt.createWaveShaper();
    N.curve = a0(o),
    x.connect(N);
    const B = rt.createGain();
    r.forEach( ([D,re,te]) => {
        const oe = rt.createBiquadFilter();
        oe.type = "bandpass",
        oe.frequency.value = D,
        oe.Q.value = re;
        const $ = rt.createGain();
        $.gain.value = te,
        N.connect(oe),
        oe.connect($),
        $.connect(B)
    }
    );
    const X = rt.createGain();
    X.gain.value = .42,
    N.connect(X),
    X.connect(B);
    const ee = rt.createBiquadFilter();
    ee.type = "lowpass",
    ee.frequency.value = 4400,
    ee.Q.value = .7;
    const L = rt.createGain();
    L.gain.setValueAtTime(1e-4, v),
    L.gain.exponentialRampToValueAtTime(t, v + e * .19),
    L.gain.setValueAtTime(t, v + e * .52),
    L.gain.exponentialRampToValueAtTime(1e-4, v + e),
    B.connect(ee),
    ee.connect(L),
    Ta(L, p, m),
    d && [2100, 3400, 5100].forEach( (D, re) => {
        const te = rt.createOscillator();
        te.type = "sine",
        te.frequency.value = D * (1 + (re - 1) * .004);
        const oe = rt.createGain();
        oe.gain.setValueAtTime(1e-4, v + e * .42),
        oe.gain.exponentialRampToValueAtTime([.022, .014, .008][re], v + e * .72),
        oe.gain.exponentialRampToValueAtTime(1e-4, v + e),
        te.connect(oe),
        Ta(oe, .4, 1),
        te.start(v + e * .42),
        te.stop(v + e + .1),
        jr(te)
    }
    )
}

const GU = [{
    k: "A",
    name: "Tripod",
    play: (i, e) => u1({
        f: 52,
        dur: i,
        peak: .52,
        drive: 2.8,
        t0: e,
        formants: [[205, 5, 1], [540, 7, .62], [1150, 9, .28]],
        bend: [.93, 1, 1.05, 1, .955]
    })
}, {
    k: "B",
    name: "Leviathan",
    play: (i, e) => u1({
        f: 36,
        dur: i * 1.08,
        peak: .56,
        drive: 3.4,
        wobble: .5,
        spread: .7,
        t0: e,
        formants: [[128, 4, 1], [330, 6, .55], [760, 8, .2]],
        bend: [.96, 1, 1.03, .99, .93]
    })
}]
  , WU = (i, e) => bg({
    f: 41,
    dur: i,
    peak: .17,
    attack: .4,
    send: .5,
    big: 1,
    t0: e
});

 f_();
 return {
  play(start=context.currentTime){GU[0].play(3.2,start);WU(2.6,start+3.2*.72);},
  stop(){for(const node of [...jv]){try{node.stop()}catch{}}jv=[];Lm.disconnect();}
 };
}
