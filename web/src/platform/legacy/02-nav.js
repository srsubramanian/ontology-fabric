(function(){
  // ================= Section nav =================
  const links = Array.from(document.querySelectorAll('#toc a'));
  const targets = links.map(a => { const t = document.querySelector(a.getAttribute('href')); return t ? (t.tagName === 'SECTION' ? t : t.closest('section')) : null; });
  if ('IntersectionObserver' in window){
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting){ const i = targets.indexOf(en.target); links.forEach((a, j) => a.classList.toggle('here', j === i)); const cur = links[i], toc = document.getElementById('toc'); if (cur && toc && toc.scrollWidth > toc.clientWidth) toc.scrollTo({ left: cur.offsetLeft - toc.clientWidth / 2 + cur.clientWidth / 2, behavior: 'smooth' }); } });
    }, { rootMargin:'-22% 0px -70% 0px' });
    targets.forEach(t => t && io.observe(t));
  }
})();
