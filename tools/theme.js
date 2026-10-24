/* light / dark switch, shares the choice with the main site */
(function(){
  var root=document.documentElement,btn=document.getElementById('theme'),lab=document.getElementById('theme-label');
  if(!btn)return;
  function eff(){var t=root.getAttribute('data-theme');return t||(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}
  function sync(){var d=eff()==='dark';btn.setAttribute('aria-checked',d);lab.textContent=d?'Dark':'Light'}
  btn.addEventListener('click',function(){var n=eff()==='dark'?'light':'dark';root.setAttribute('data-theme',n);try{localStorage.setItem('sh-theme',n)}catch(e){}sync()});
  if(window.matchMedia){try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',sync)}catch(e){}}
  sync();
})();
