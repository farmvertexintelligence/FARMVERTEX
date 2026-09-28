/* FarmVertex Intelligence - interactions.
   Theme toggle, mobile menu, reveal-on-enter, and GSAP ScrollTrigger 3D depth:
   sections tilt up out of the page as they arrive, stacked cards recede in Z,
   the hero falls back into the scene as you leave it. */
(function () {
  'use strict';
  var doc = document.documentElement;
  doc.classList.add('js');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Theme */
  var THEME_KEY = 'fv-theme';
  function storedTheme() { try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; } }
  var saved = storedTheme();
  if (saved === 'light' || saved === 'dark') doc.setAttribute('data-theme', saved);
  function currentTheme() {
    var t = doc.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function syncThemeIcon() {
    document.querySelectorAll('[data-theme-toggle]').forEach(function (b) {
      var dark = currentTheme() === 'dark';
      b.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
      b.innerHTML = dark ? '<i class="ph ph-sun" aria-hidden="true"></i>' : '<i class="ph ph-moon" aria-hidden="true"></i>';
    });
  }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-theme-toggle]');
    if (!btn) return;
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    doc.setAttribute('data-theme', next);
    try { localStorage.setItem(THEME_KEY, next); } catch (err) { /* storage unavailable */ }
    syncThemeIcon();
  });

  document.addEventListener('DOMContentLoaded', function () {
    syncThemeIcon();

    /* Year */
    document.querySelectorAll('[data-year]').forEach(function (n) { n.textContent = new Date().getFullYear(); });

    /* Mobile menu */
    var menuBtn = document.querySelector('.menu-btn');
    var mobile = document.querySelector('.mobile-nav');
    if (menuBtn && mobile) {
      menuBtn.addEventListener('click', function () {
        var open = mobile.classList.toggle('open');
        menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        menuBtn.innerHTML = open ? '<i class="ph ph-x" aria-hidden="true"></i>' : '<i class="ph ph-list" aria-hidden="true"></i>';
        document.body.style.overflow = open ? 'hidden' : '';
      });
      mobile.addEventListener('click', function (e) {
        if (e.target.closest('a')) { mobile.classList.remove('open'); document.body.style.overflow = ''; menuBtn.setAttribute('aria-expanded', 'false'); }
      });
    }

    /* Split headline lines for the rise-in reveal */
    document.querySelectorAll('[data-split]').forEach(function (h) {
      var parts = h.innerHTML.split(/<br\s*\/?>/i);
      h.innerHTML = parts.map(function (p) { return '<span class="split-line"><span>' + p.trim() + '</span></span>'; }).join('');
      h.classList.add('reveal-lines');
    });

    /* Reveal on enter */
    var revealables = document.querySelectorAll('.reveal, .reveal-lines .split-line');
    if ('IntersectionObserver' in window && !reduce) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
      revealables.forEach(function (el, i) {
        var group = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
        el.style.transitionDelay = Math.min(group, 5) * 80 + 'ms';
        io.observe(el);
      });
    } else {
      revealables.forEach(function (el) { el.classList.add('in'); });
    }

    /* Contact form */
    initForm();

    if (!window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);

    /* Header: frosted after the hero, hides on scroll down, returns on scroll up */
    var header = document.querySelector('.site-header');
    if (header) {
      ScrollTrigger.create({
        start: 'top -40', end: 'max',
        onUpdate: function (self) {
          header.classList.toggle('is-scrolled', self.scroll() > 40);
          if (!document.querySelector('.mobile-nav.open')) header.classList.toggle('is-hidden', self.direction === 1 && self.scroll() > 400);
        },
        onLeaveBack: function () { header.classList.remove('is-scrolled', 'is-hidden'); }
      });
    }

    if (reduce) return;
    var mm = gsap.matchMedia();

    mm.add('(min-width: 768px)', function () {
      /* Hero recedes into the scene */
      var hero = document.querySelector('.hero .hero-copy');
      if (hero) {
        gsap.to(hero, {
          rotateX: 18, z: -260, yPercent: -10, opacity: 0, ease: 'none', transformPerspective: 1200, transformOrigin: '50% 0%',
          scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
        });
      }

      /* Depth blocks tilt up out of the page as they enter */
      gsap.utils.toArray('.depth').forEach(function (el) {
        gsap.fromTo(el,
          { rotateX: 22, z: -220, y: 80, opacity: 0.25, transformPerspective: 1400, transformOrigin: '50% 100%' },
          { rotateX: 0, z: 0, y: 0, opacity: 1, ease: 'none',
            scrollTrigger: { trigger: el, start: 'top 98%', end: 'top 55%', scrub: 0.6 } });
      });

      /* Bento / grid children fan in with alternating Y rotation */
      gsap.utils.toArray('[data-fan]').forEach(function (grid) {
        var kids = grid.children;
        Array.prototype.forEach.call(kids, function (k, i) {
          gsap.fromTo(k,
            { rotateY: i % 2 ? -16 : 16, rotateX: 10, z: -180, opacity: 0, transformPerspective: 1200 },
            { rotateY: 0, rotateX: 0, z: 0, opacity: 1, ease: 'none',
              scrollTrigger: { trigger: k, start: 'top 100%', end: 'top 62%', scrub: 0.6 } });
        });
      });

      /* Sticky 3D stack: each card falls back in Z as the next one arrives */
      var cards = gsap.utils.toArray('.stack-card');
      cards.forEach(function (card, i) {
        if (i === cards.length - 1) return;
        gsap.to(card, {
          scale: 0.9, rotateX: -8, opacity: 0.35, ease: 'none', transformPerspective: 1400, transformOrigin: '50% 0%',
          scrollTrigger: { trigger: cards[i + 1], start: 'top bottom', end: 'top 110px', scrub: true }
        });
      });

      /* Horizontal pan: vertical scroll moves the track sideways while pinned */
      gsap.utils.toArray('.hpan').forEach(function (wrap) {
        var track = wrap.querySelector('.hpan-track');
        if (!track) return;
        var distance = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
        gsap.to(track, {
          x: function () { return -distance(); }, ease: 'none',
          scrollTrigger: { trigger: wrap, start: 'top top', end: function () { return '+=' + distance(); }, pin: true, scrub: 1, invalidateOnRefresh: true }
        });
        gsap.utils.toArray(track.children).forEach(function (c, i) {
          gsap.fromTo(c, { rotateY: -24, z: -120, transformPerspective: 1200 }, {
            rotateY: 0, z: 0, ease: 'none',
            scrollTrigger: { trigger: wrap, start: 'top top', end: function () { return '+=' + (distance() * (i + 1) / track.children.length); }, scrub: true }
          });
        });
      });

      /* Parallax layers */
      gsap.utils.toArray('[data-speed]').forEach(function (el) {
        var s = parseFloat(el.getAttribute('data-speed')) || 0;
        gsap.to(el, { yPercent: s * -30, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
      });
    });

    /* Timeline progress line (all widths) */
    gsap.utils.toArray('.timeline').forEach(function (tl) {
      var bar = tl.querySelector('.timeline-line span');
      if (!bar) return;
      gsap.to(bar, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: tl, start: 'top 70%', end: 'bottom 60%', scrub: true } });
    });

    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
  });

  /* Contact form: posts to the backend when data-endpoint is set, otherwise opens a prefilled email. */
  function initForm() {
    var form = document.querySelector('form[data-contact]');
    if (!form) return;
    var status = form.querySelector('.form-status');
    var btn = form.querySelector('button[type="submit"]');

    function setErr(name, msg) {
      var f = form.querySelector('[name="' + name + '"]');
      if (!f) return;
      var wrap = f.closest('.field');
      wrap.classList.toggle('invalid', !!msg);
      f.setAttribute('aria-invalid', msg ? 'true' : 'false');
      var e = wrap.querySelector('.err');
      if (e) e.textContent = msg || '';
    }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var data = {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        organization: form.organization.value.trim(),
        service: form.service ? form.service.value : '',
        message: form.message.value.trim(),
        website: form.website ? form.website.value : ''
      };
      var ok = true;
      setErr('name', data.name ? '' : 'Please enter your name.'); ok = ok && !!data.name;
      var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email);
      setErr('email', emailOk ? '' : 'Please enter a valid email address.'); ok = ok && emailOk;
      setErr('message', data.message ? '' : 'Tell us a little about what you need.'); ok = ok && !!data.message;
      if (!ok) { status.className = 'form-status bad'; status.textContent = 'Please check the highlighted fields.'; return; }

      var full = data.service ? '[' + data.service + '] ' + data.message : data.message;
      var endpoint = form.getAttribute('data-endpoint');

      if (!endpoint) {
        var body = 'Name: ' + data.name + '\nEmail: ' + data.email + '\nOrganization: ' + (data.organization || '-') + '\nInterest: ' + (data.service || '-') + '\n\n' + data.message;
        window.location.href = 'mailto:hello@farmvertex.com?subject=' + encodeURIComponent('Project enquiry from ' + data.name) + '&body=' + encodeURIComponent(body);
        status.className = 'form-status ok';
        status.textContent = 'Your email app should open with the message ready to send. If it does not, write to hello@farmvertex.com.';
        return;
      }

      btn.disabled = true;
      var label = btn.innerHTML;
      btn.innerHTML = 'Sending...';
      status.className = 'form-status'; status.textContent = '';
      fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name, email: data.email, organization: data.organization, message: full, website: data.website })
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.j && res.j.error ? res.j.error : 'Something went wrong.');
          form.reset();
          status.className = 'form-status ok';
          status.textContent = 'Thank you. Your message has been sent and we will reply by email.';
        })
        .catch(function (err) {
          status.className = 'form-status bad';
          status.textContent = (err && err.message ? err.message : 'Could not send.') + ' You can also email hello@farmvertex.com directly.';
        })
        .then(function () { btn.disabled = false; btn.innerHTML = label; });
    });
  }
})();
