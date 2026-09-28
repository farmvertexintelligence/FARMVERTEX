/* FarmVertex Intelligence - interactions and scroll choreography.
   Lenis smooth scroll feeds GSAP ScrollTrigger. Every effect degrades to a
   readable static layout when GSAP is missing or reduced motion is requested. */
(function () {
  'use strict';
  var doc = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = !!(window.gsap && window.ScrollTrigger);
  if (hasGsap) { gsap.registerPlugin(ScrollTrigger); doc.classList.add('gsap-ready'); }

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- Text splitting ---------- */
  function splitChars(el) {
    var html = el.innerHTML.split(/<br\s*\/?>/i);
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    el.innerHTML = html.map(function (line) {
      var tmp = document.createElement('div'); tmp.innerHTML = line;
      var out = '';
      Array.prototype.forEach.call(tmp.childNodes, function (node) {
        var cls = node.nodeType === 1 ? node.className : '';
        var text = node.textContent;
        text.split(/(\s+)/).forEach(function (w) {
          if (!w) return;
          if (/^\s+$/.test(w)) { out += ' '; return; }
          out += '<span class="word' + (cls ? ' ' + cls : '') + '" aria-hidden="true">' +
            w.split('').map(function (c) { return '<span class="char">' + c + '</span>'; }).join('') + '</span>';
        });
      });
      return '<span class="line-mask">' + out.trim() + '</span>';
    }).join('');
  }
  function splitWords(el) {
    var out = '';
    Array.prototype.forEach.call(el.childNodes, function (node) {
      var hl = node.nodeType === 1 && node.classList.contains('hl');
      node.textContent.split(/(\s+)/).forEach(function (w) {
        if (!w) return;
        out += /^\s+$/.test(w) ? ' ' : '<span class="word' + (hl ? ' hl' : '') + '">' + w + '</span>';
      });
    });
    el.innerHTML = out;
  }
  $$('[data-chars]').forEach(splitChars);
  $$('.kinetic').forEach(splitWords);

  /* ---------- Year ---------- */
  $$('[data-year]').forEach(function (n) { n.textContent = new Date().getFullYear(); });

  /* ---------- Smooth scroll ---------- */
  var lenis = null;
  if (hasGsap && !reduce && window.Lenis) {
    lenis = new Lenis({ duration: 1.15, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  /* ---------- Curtain: intro + page transitions ---------- */
  var curtain = $('.curtain');
  var revealed = false;
  function reveal() {
    if (!curtain || revealed) return;
    revealed = true;
    if (!hasGsap || reduce) { curtain.style.display = 'none'; return; }
    var bar = $('.bar', curtain);
    gsap.timeline()
      .to(bar, { scaleX: 1, duration: 0.55, ease: 'power2.inOut' })
      .to(curtain, { yPercent: -100, duration: 0.9, ease: 'expo.inOut' })
      .set(curtain, { display: 'none' });
    curtain.style.animation = 'none';
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a || !curtain || !hasGsap || reduce) return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#' || a.target === '_blank' || /^(mailto|tel|https?):/i.test(href) || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    gsap.set(curtain, { display: 'grid', yPercent: 100 });
    gsap.set($('.bar', curtain), { scaleX: 0 });
    gsap.to(curtain, { yPercent: 0, duration: 0.7, ease: 'expo.inOut', onComplete: function () { window.location.href = href; } });
  });
  window.addEventListener('pageshow', function (e) { if (e.persisted && curtain) { curtain.style.display = 'none'; } });

  /* ---------- Nav ---------- */
  var nav = $('.nav');
  var menu = $('.menu');
  var menuBtn = $('.menu-btn');
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', function () {
      var open = !menu.classList.contains('open');
      menu.classList.toggle('open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.innerHTML = open ? '<i class="ph ph-x" aria-hidden="true"></i>' : '<i class="ph ph-list" aria-hidden="true"></i>';
      if (lenis) { open ? lenis.stop() : lenis.start(); }
      document.body.style.overflow = open ? 'hidden' : '';
    });
  }

  initForm();

  if (!hasGsap) { reveal(); return; }

  if (nav) {
    ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate: function (self) {
        if (menu && menu.classList.contains('open')) return;
        nav.classList.toggle('is-hidden', self.direction === 1 && self.scroll() > 320);
      }
    });
  }

  if (reduce) { window.addEventListener('load', reveal); return; }

  /* ---------- Hero ---------- */
  var heroTitle = $('.hero [data-chars]');
  var intro = gsap.timeline({ delay: 1.15 });
  if (heroTitle) {
    intro.from($$('.char', heroTitle), {
      yPercent: 115, rotateX: -80, opacity: 0, transformOrigin: '50% 100% -40px',
      duration: 1.3, ease: 'expo.out', stagger: { each: 0.028 },
      onComplete: function () { heroTitle.classList.add('unmasked'); }
    });
  }
  intro.from($$('.hero [data-hero-in]'), { y: 30, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.1 }, '-=0.9');

  if (heroTitle) {
    // Leaving the hero: letters scatter back into the scene in 3D.
    var chars = $$('.char', heroTitle);
    var scatter = gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.8 } });
    chars.forEach(function (c, i) {
      var r = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      scatter.to(c, { yPercent: -60 - Math.abs(r) * 140, z: -300 - Math.abs(r) * 500, rotateX: 50 + r * 60, rotateY: r * 50, opacity: 0, ease: 'none' }, 0);
    });
    gsap.set(chars, { transformPerspective: 900 });
    scatter.to($$('.hero [data-hero-in]'), { y: -60, opacity: 0, ease: 'none' }, 0);
  }

  /* ---------- Section headings: line-by-line 3D rise ---------- */
  $$('main [data-chars]').forEach(function (el) {
    if (el.closest('.hero')) return;
    gsap.from($$('.char', el), {
      yPercent: 110, rotateX: -70, opacity: 0, transformOrigin: '50% 100%',
      duration: 1.1, ease: 'expo.out', stagger: 0.018,
      scrollTrigger: { trigger: el, start: 'top 85%', once: true }
    });
  });

  /* ---------- Generic reveal ---------- */
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 88%', once: true,
    onEnter: function (els) { gsap.to(els, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', stagger: 0.08, overwrite: true }); }
  });
  gsap.set('[data-reveal]', { y: 36 });

  /* ---------- Kinetic statements: words light up as you read ---------- */
  $$('.kinetic').forEach(function (p) {
    gsap.to($$('.word', p), {
      opacity: 1, ease: 'none', stagger: 0.1,
      scrollTrigger: { trigger: p, start: 'top 80%', end: 'bottom 45%', scrub: true }
    });
  });

  /* ---------- 3D fan-in grids ---------- */
  $$('[data-fan]').forEach(function (grid) {
    $$(':scope > *', grid).forEach(function (card, i) {
      gsap.fromTo(card,
        { rotateY: i % 2 ? -22 : 22, rotateX: 14, z: -260, y: 80, opacity: 0 },
        { rotateY: 0, rotateX: 0, z: 0, y: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: card, start: 'top 98%', end: 'top 60%', scrub: 0.7 } });
    });
  });

  var mm = gsap.matchMedia();
  mm.add('(min-width: 768px)', function () {
    /* Scrollytelling progress dots */
    $$('.chapters').forEach(function (wrap) {
      var bars = $$('.chapter-index i', wrap);
      $$('.chapter', wrap).forEach(function (ch, i) {
        if (!bars[i]) return;
        gsap.to(bars[i], { scaleX: 1, ease: 'none', scrollTrigger: { trigger: ch, start: 'top 60%', end: 'bottom 60%', scrub: true } });
      });
      $$('.chapter .glass', wrap).forEach(function (card) {
        gsap.fromTo(card, { rotateY: -18, rotateX: 8, z: -200, opacity: 0.2, transformPerspective: 1400 },
          { rotateY: 0, rotateX: 0, z: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: card, start: 'top 95%', end: 'center 55%', scrub: 0.6 } });
      });
    });

    /* 3D cylinder carousel: vertical scroll rotates the ring */
    $$('.carousel-sec').forEach(function (sec) {
      var ring = $('.ring', sec), cards = $$('.ring-card', ring), n = cards.length;
      if (!n) return;
      sec.classList.add('is-3d');
      var w = 300, angle = 360 / n, radius = Math.round((w / 2) / Math.tan(Math.PI / n)) + 70;
      cards.forEach(function (c, i) { c.style.transform = 'rotateY(' + (i * angle) + 'deg) translateZ(' + radius + 'px)'; });
      gsap.set(ring, { z: -radius, rotateX: -6 });
      gsap.to(ring, {
        rotateY: -(360 - angle), ease: 'none',
        scrollTrigger: { trigger: sec, start: 'top top', end: '+=' + (n * 180), pin: $('.carousel-pin', sec), scrub: 1, anticipatePin: 1 }
      });
      return function () { sec.classList.remove('is-3d'); cards.forEach(function (c) { c.style.transform = ''; }); };
    });

    /* Sticky stack: earlier cards sink back as the next arrives */
    $$('.stack').forEach(function (stack) {
      var cards = $$('.stack-card', stack);
      cards.forEach(function (card, i) {
        if (i === cards.length - 1) return;
        gsap.to(card, {
          scale: 0.88, rotateX: -10, opacity: 0.3, filter: 'blur(2px)', transformPerspective: 1600, ease: 'none',
          scrollTrigger: { trigger: cards[i + 1], start: 'top bottom', end: 'top 104px', scrub: true }
        });
      });
    });

    /* Horizontal pan */
    $$('.hpan').forEach(function (sec) {
      var track = $('.hpan-track', sec);
      var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
      gsap.to(track, { x: function () { return -dist(); }, ease: 'none',
        scrollTrigger: { trigger: sec, start: 'top top', end: function () { return '+=' + dist(); }, pin: $('.hpan-pin', sec), scrub: 1, invalidateOnRefresh: true } });
    });

    /* Zoom CTA: the panel grows to fill the view */
    $$('.zoom').forEach(function (z) {
      gsap.fromTo(z, { scale: 0.72, rotateX: 18, transformPerspective: 1600, borderRadius: '80px' },
        { scale: 1, rotateX: 0, borderRadius: '40px', ease: 'none', scrollTrigger: { trigger: z, start: 'top bottom', end: 'center center', scrub: true } });
      gsap.fromTo($('h2', z), { yPercent: 40, opacity: 0.2 }, { yPercent: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: z, start: 'top 90%', end: 'center center', scrub: true } });
    });

    /* Parallax */
    $$('[data-speed]').forEach(function (el) {
      var s = parseFloat(el.getAttribute('data-speed')) || 0;
      gsap.to(el, { yPercent: -s * 40, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
    });

    /* Pointer tilt + spotlight */
    $$('[data-tilt]').forEach(function (el) {
      var rx = gsap.quickTo(el, 'rotateX', { duration: 0.6, ease: 'power3.out' });
      var ry = gsap.quickTo(el, 'rotateY', { duration: 0.6, ease: 'power3.out' });
      gsap.set(el, { transformPerspective: 1200 });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        rx((0.5 - y) * 10); ry((x - 0.5) * 12);
        el.style.setProperty('--mx', x * 100 + '%'); el.style.setProperty('--my', y * 100 + '%');
      });
      el.addEventListener('pointerleave', function () { rx(0); ry(0); });
    });

    /* Magnetic buttons */
    $$('[data-magnetic]').forEach(function (el) {
      var mx = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
      var my = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        mx((e.clientX - r.left - r.width / 2) * 0.25); my((e.clientY - r.top - r.height / 2) * 0.35);
      });
      el.addEventListener('pointerleave', function () { mx(0); my(0); });
    });
  });

  /* Spotlight on touch-free devices without tilt (all widths) */
  $$('.spot:not([data-tilt])').forEach(function (el) {
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left) + 'px'); el.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  /* Timeline fill */
  $$('.timeline').forEach(function (tl) {
    var fill = $('.tl-fill', tl);
    if (fill) gsap.to(fill, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: tl, start: 'top 65%', end: 'bottom 65%', scrub: true } });
    $$('.tl-step', tl).forEach(function (st) {
      gsap.from(st, { opacity: 0.15, y: 40, ease: 'none', scrollTrigger: { trigger: st, start: 'top 85%', end: 'top 55%', scrub: true } });
    });
  });

  /* Footer wordmark letters rise */
  var wm = $('.wordmark');
  if (wm) {
    wm.innerHTML = wm.textContent.split('').map(function (c) { return '<span>' + c + '</span>'; }).join('');
    gsap.from($$('span', wm), { yPercent: 100, opacity: 0, stagger: 0.04, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: wm, start: 'top 95%', once: true } });
  }

  window.addEventListener('load', function () { reveal(); ScrollTrigger.refresh(); });
  if (document.readyState === 'complete') reveal();

  /* ---------- Contact form ---------- */
  function initForm() {
    var form = $('form[data-contact]');
    if (!form) return;
    var status = $('.form-status', form), btn = $('button[type="submit"]', form);
    function setErr(name, msg) {
      var f = form.elements[name]; if (!f) return;
      var wrap = f.closest('.field'); wrap.classList.toggle('invalid', !!msg);
      f.setAttribute('aria-invalid', msg ? 'true' : 'false');
      var e = $('.err', wrap); if (e) e.textContent = msg || '';
    }
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var d = {
        name: form.elements.name.value.trim(), email: form.elements.email.value.trim(),
        organization: form.elements.organization.value.trim(), service: form.elements.service.value,
        message: form.elements.message.value.trim(), website: form.elements.website.value
      };
      var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email);
      setErr('name', d.name ? '' : 'Please enter your name.');
      setErr('email', emailOk ? '' : 'Please enter a valid email address.');
      setErr('message', d.message ? '' : 'Tell us a little about what you need.');
      if (!d.name || !emailOk || !d.message) { status.className = 'form-status bad'; status.textContent = 'Please check the highlighted fields.'; return; }
      var endpoint = form.getAttribute('data-endpoint');
      if (!endpoint) {
        var body = 'Name: ' + d.name + '\nEmail: ' + d.email + '\nOrganisation: ' + (d.organization || '-') + '\nInterested in: ' + (d.service || '-') + '\n\n' + d.message;
        window.location.href = 'mailto:hello@farmvertex.com?subject=' + encodeURIComponent('Project enquiry from ' + d.name) + '&body=' + encodeURIComponent(body);
        status.className = 'form-status ok';
        status.textContent = 'Your email app should open with the message ready to send. If it does not, write to hello@farmvertex.com.';
        return;
      }
      btn.disabled = true; var label = btn.innerHTML; btn.textContent = 'Sending...';
      status.className = 'form-status'; status.textContent = '';
      fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: d.name, email: d.email, organization: d.organization, message: (d.service ? '[' + d.service + '] ' : '') + d.message, website: d.website }) })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error((res.j && res.j.error) || 'Something went wrong.');
          form.reset(); status.className = 'form-status ok'; status.textContent = 'Thank you. Your message has been sent and we will reply by email.';
        })
        .catch(function (err) { status.className = 'form-status bad'; status.textContent = (err.message || 'Could not send.') + ' You can also email hello@farmvertex.com directly.'; })
        .then(function () { btn.disabled = false; btn.innerHTML = label; });
    });
  }
})();
