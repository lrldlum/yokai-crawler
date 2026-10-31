'use strict';
/* Host-authoritative co-op over PeerJS (public broker for signalling only).
   The host simulates the road. Clients send inputs. The host broadcasts state.
   Room codes are 4 unambiguous characters, same shape as a static-site co-op lobby. */
(function () {
  const CODE = 'ACDEFHJKLMNPRTUVWXY3479';

  function newCode() {
    let s = '';
    for (let i = 0; i < 4; i++) s += CODE[Math.floor(Math.random() * CODE.length)];
    return s;
  }

  function pid(code) {
    return 'yokai-road-' + String(code).toLowerCase();
  }

  function opts() {
    const q = new URLSearchParams(location.search);
    const o = { debug: +(q.get('peerdebug') || 0) };
    if (q.get('peerhost')) {
      o.host = q.get('peerhost');
      o.port = +(q.get('peerport') || 9000);
      o.path = q.get('peerpath') || '/';
      o.secure = q.get('peersecure') === '1';
    }
    o.config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
      ],
    };
    return o;
  }

  const Net = {
    role: null,
    code: null,
    peer: null,
    conn: null,
    status: '',
    err: '',
    last: 0,
    guestInput: null,
    snap: null,
    snapAt: 0,
    onSnap: null,
    onLink: null,
    onDrop: null,
    seqIn: 0,
    host: function () { return this.role === 'host'; },
    guest: function () { return this.role === 'guest'; },
    linked: function () { return !!(this.conn && this.conn.open); },
    send: function (m) {
      if (!this.linked()) return;
      try { this.conn.send(m); } catch (e) { /* channel closed mid-send */ }
    },
    leave: function () {
      try { if (this.conn) this.conn.close(); } catch (e) {}
      try { if (this.peer) this.peer.destroy(); } catch (e) {}
      this.conn = null;
      this.peer = null;
      this.guestInput = null;
      this.role = null;
    },
    startHost: function (code) {
      if (typeof Peer === 'undefined') {
        this.err = this.status = 'PEERJS MISSING';
        return;
      }
      this.role = 'host';
      this.code = code || newCode();
      this.status = 'OPENING THE ROAD';
      this.peer = new Peer(pid(this.code), opts());
      const self = this;
      this.peer.on('open', function () {
        self.status = 'WAITING FOR A COMPANION';
        self.err = '';
      });
      this.peer.on('connection', function (c) {
        if (self.linked()) {
          c.on('open', function () {
            try { c.send({ t: 'full' }); } catch (e) {}
            setTimeout(function () { try { c.close(); } catch (e) {} }, 250);
          });
          return;
        }
        self.bind(c);
      });
      this.peer.on('error', function (e) {
        if (e && e.type === 'unavailable-id') {
          try { self.peer.destroy(); } catch (err) {}
          self.startHost(newCode());
          return;
        }
        self.err = String((e && e.type) || e).toUpperCase();
        self.status = 'ROOM ERROR: ' + self.err;
      });
      this.peer.on('disconnected', function () {
        try { self.peer.reconnect(); } catch (e) {}
      });
    },
    startJoin: function (code, cb) {
      if (typeof Peer === 'undefined') {
        cb && cb('PEERJS MISSING');
        return;
      }
      this.role = 'guest';
      this.code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
      this.status = 'SEEKING ' + this.code;
      this.joinCb = cb;
      const self = this;
      clearTimeout(this.jt);
      this.jt = setTimeout(function () {
        if (self.joinCb) {
          const c = self.joinCb;
          self.joinCb = null;
          self.leave();
          self.err = self.status = 'CONNECTION FAILED';
          c('CONNECTION FAILED — TRY ANOTHER NETWORK');
        }
      }, +(new URLSearchParams(location.search).get('jointimeout') || 15000));
      this.peer = new Peer(undefined, opts());
      this.peer.on('open', function () {
        self.bind(self.peer.connect(pid(self.code), { reliable: true, serialization: 'json' }));
      });
      this.peer.on('error', function (e) {
        const m = e && e.type === 'peer-unavailable' ? 'NO ROAD WITH THAT CODE' : String((e && e.type) || e).toUpperCase();
        self.err = self.status = m;
        if (self.joinCb) {
          const c = self.joinCb;
          self.joinCb = null;
          clearTimeout(self.jt);
          self.leave();
          c(m);
        }
      });
    },
    bind: function (c) {
      const self = this;
      this.conn = c;
      c.on('open', function () {
        self.last = performance.now();
        clearTimeout(self.jt);
        if (self.host()) {
          self.status = 'COMPANION ON THE ROAD';
          if (self.onLink) self.onLink();
        } else {
          self.status = 'JOINED ' + self.code;
          self.send({ t: 'hello' });
          if (self.joinCb) {
            const cb = self.joinCb;
            self.joinCb = null;
            cb(null);
          }
        }
      });
      c.on('data', function (d) {
        if (self.conn !== c) return;
        self.last = performance.now();
        try { self.recv(d); } catch (e) { console.warn('net', e); }
      });
      c.on('close', function () { if (self.conn === c) self.dropped('closed'); });
      c.on('error', function () { if (self.conn === c) self.dropped('error'); });
    },
    dropped: function () {
      if (!this.conn && this.role !== 'host') return;
      this.conn = null;
      this.guestInput = null;
      if (this.host()) {
        this.status = 'WAITING FOR A COMPANION';
      } else if (this.guest()) {
        this.status = 'HOST LOST';
        this.err = 'HOST LOST';
      }
      if (this.onDrop) this.onDrop();
    },
    heartbeat: function () {
      if (this.linked() && performance.now() - this.last > 8000) this.dropped();
    },
    pushInput: function (input) {
      if (!this.guest() || !this.linked()) return;
      const now = performance.now();
      const prev = this._lastIn || {};
      const edge = input.dash !== prev.dash || input.burst !== prev.burst || input.heal !== prev.heal || input.kunai !== prev.kunai || input.use !== prev.use || input.slash !== prev.slash || input.beam !== prev.beam;
      if (!edge && now - (this._inAt || 0) < 50) return;
      this._inAt = now;
      this._lastIn = input;
      this.send({
        t: 'in', ct: now,
        mx: input.mx, my: input.my, ax: input.ax, ay: input.ay,
        slash: input.slash, beam: input.beam,
        dash: input.dash, burst: input.burst, heal: input.heal, kunai: input.kunai, use: input.use,
      });
    },
    pushSnap: function (snap) {
      if (!this.host() || !this.linked()) return;
      const now = performance.now();
      if (now - (this._snapAt || 0) < 50) return;
      this._snapAt = now;
      this.send(snap);
    },
    takeGuestInput: function () {
      const g = this.guestInput;
      if (!g) return null;
      if (performance.now() - g.at > 350) return null;
      return g.input;
    },
    recv: function (d) {
      if (!d || typeof d !== 'object') return;
      if (d.t === 'full') {
        this.conn = null;
        this.err = this.status = 'THAT ROAD IS FULL';
        clearTimeout(this.jt);
        if (this.joinCb) {
          const c = this.joinCb;
          this.joinCb = null;
          c('THAT ROAD IS FULL');
        }
        this.leave();
        return;
      }
      if (this.host()) {
        if (d.t === 'hello') {
          this.status = 'COMPANION ON THE ROAD';
          if (this.onLink) this.onLink();
          return;
        }
        if (d.t === 'in') {
          this.guestInput = { at: performance.now(), ct: d.ct, input: d };
          return;
        }
        return;
      }
      if (d.t === 's') {
        this.snap = d;
        this.snapAt = performance.now();
        if (this.joinCb) {
          const c = this.joinCb;
          this.joinCb = null;
          this.status = 'JOINED ' + this.code;
          c(null);
        }
        if (this.onSnap) this.onSnap(d);
      }
    },
  };

  window.Net = Net;
  window.YokaiCode = { newCode: newCode, chars: CODE };
})();
