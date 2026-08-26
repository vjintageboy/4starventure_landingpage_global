(function(){
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var els = document.querySelectorAll('.stat-value');
  els.forEach(function(el){ el.dataset.final = el.textContent.trim(); });
  function animate(el){
    var m = el.dataset.final.match(/^([^\d]*)([\d.,]+)(.*)$/);
    if(!m){ return; }
    var pre=m[1], numStr=m[2], suf=m[3];
    var decimals=(numStr.split('.')[1]||'').length;
    var hasComma=numStr.indexOf(',')>-1;
    var target=parseFloat(numStr.replace(/,/g,''));
    var dur=1400, t0=performance.now();
    function fmt(v){ var s=v.toFixed(decimals); if(hasComma){ s=Number(s).toLocaleString('en-US',{minimumFractionDigits:decimals,maximumFractionDigits:decimals}); } return pre+s+suf; }
    function step(now){ var p=Math.min(1,(now-t0)/dur); var e=1-Math.pow(1-p,3); el.textContent=fmt(target*e); if(p<1){ requestAnimationFrame(step); } else { el.textContent=el.dataset.final; } }
    requestAnimationFrame(step);
  }
  if(reduce){ return; }
  var io=new IntersectionObserver(function(ents){ ents.forEach(function(en){ if(en.isIntersecting){ animate(en.target); io.unobserve(en.target); } }); },{threshold:0.5});
  els.forEach(function(e){ io.observe(e); });
})();
